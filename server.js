
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import historyApiFallback from 'connect-history-api-fallback';
import { createServer } from 'http';
import { initializeDatabase } from './src/database/models.js';
import monitoringService from './src/monitoring/service.js';
import WebSocketServer from './src/websocket/server.js';
import redisClient from './src/cache/redis-client.js';

// Load environment variables from .env file
dotenv.config();

// Create the Express app
const app = express();

// Middleware for parsing JSON and URL-encoded data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000; // The port to run the server on
const API_DIR = '/api'; // Name of the dir containing the lambda functions
const dirPath = path.join(__dirname, API_DIR); // Path to the lambda functions dir
const guiPath = path.join(__dirname, 'dist', 'client');
const placeholderFilePath = path.join(__dirname, 'public', 'placeholder.html');
const handlers = {}; // Will store list of API endpoints
process.env.WC_SERVER = 'true'; // Tells middleware to return in non-lambda mode

// Enable CORS
app.use(cors({
  origin: process.env.API_CORS_ORIGIN || '*',
}));

// Define max requests within each time frame
const limits = [
  { timeFrame: 10 * 60, max: 100, messageTime: '10 minutes' },
  { timeFrame: 60 * 60, max: 250, messageTime: '1 hour' },
  { timeFrame: 12 * 60 * 60, max: 500, messageTime: '12 hours' },
];

// Construct a message to be returned if the user has been rate-limited
const makeLimiterResponseMsg = (retryAfter) => {
  const why = 'This keeps the service running smoothly for everyone. '
  + 'You can get around these limits by running your own instance of Web Scan.';
  return `You've been rate-limited, please try again in ${retryAfter} seconds.\n${why}`;
};

// Create rate limiters for each time frame
const limiters = limits.map(limit => rateLimit({
  windowMs: limit.timeFrame * 1000,
  max: limit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: makeLimiterResponseMsg(limit.messageTime) }
}));

// If rate-limiting enabled, then apply the limiters to the /api endpoint
if (process.env.API_ENABLE_RATE_LIMIT === 'true') {
  app.use(API_DIR, limiters);
}

// Read and register each API function as an Express routes
fs.readdirSync(dirPath, { withFileTypes: true })
  .filter(dirent => dirent.isFile() && dirent.name.endsWith('.js'))
  .forEach(async dirent => {
    const routeName = dirent.name.split('.')[0];
    const route = `${API_DIR}/${routeName}`;
    // const handler = require(path.join(dirPath, dirent.name));

    const handlerModule = await import(path.join(dirPath, dirent.name));
    const handler = handlerModule.default || handlerModule;
    handlers[route] = handler;

    // Support both GET and POST requests for API endpoints
    app.get(route, async (req, res) => {
      try {
        await handler(req, res);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post(route, async (req, res) => {
      try {
        await handler(req, res);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.put(route, async (req, res) => {
      try {
        await handler(req, res);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete(route, async (req, res) => {
      try {
        await handler(req, res);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  });

const renderPlaceholderPage = async (res, msgId, logs) => {
  const errorMessages = {
    notCompiled: 'Looks like the GUI app has not yet been compiled.<br />'
    + 'Run <code>yarn build</code> to continue, then restart the server.',
    notCompiledSsrHandler: 'Server-side rendering failed to initiate, as SSR handler not found.<br />'
    + 'This can be fixed by running <code>yarn build</code>, then restarting the server.<br />',
    disabledGui:  'Web-Scan API is up and running!<br />Access the endpoints at '
    + `<a href="${API_DIR}"><code>${API_DIR}</code></a>`,
  };
  const logOutput = logs ? `<div class="logs"><code>${logs}</code></div>` : '';
  const errorMessage = (errorMessages[msgId] || 'An mystery error occurred.') + logOutput;
  const placeholderContent = await fs.promises.readFile(placeholderFilePath, 'utf-8');
  const htmlContent = placeholderContent.replace('<!-- CONTENT -->', errorMessage );
  res.status(500).send(htmlContent);
};

// Create a single API endpoint to execute all lambda functions
app.get(API_DIR, async (req, res) => {
  const results = {};
  const { url } = req.query;
  const maxExecutionTime = process.env.API_TIMEOUT_LIMIT || 20000;

  const executeHandler = async (handler, req) => {
    return new Promise(async (resolve, reject) => {
      try {
        const mockRes = {
          status: () => mockRes,
          json: (body) => resolve({ body }),
        };
        await handler({ ...req, query: { url } }, mockRes);
      } catch (err) {
        reject(err);
      }
    });
  };

  const timeout = (ms, jobName = null) => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          `Timed out after ${ms/1000} seconds${jobName ? `, when executing ${jobName}` : ''}`
        ));
      }, ms);
    });
  };

  const handlerPromises = Object.entries(handlers).map(async ([route, handler]) => {
    const routeName = route.replace(`${API_DIR}/`, '');

    try {
      const result = await Promise.race([
        executeHandler(handler, req, res),
        timeout(maxExecutionTime, routeName)
      ]);
      results[routeName] = result.body;
    } catch (err) {
      results[routeName] = { error: err.message };
    }
  });

  await Promise.all(handlerPromises);
  res.json(results);
});

// Skip the marketing homepage, for self-hosted users
app.use((req, res, next) => {
  if (req.path === '/' && process.env.BOSS_SERVER !== 'true' && !process.env.DISABLE_GUI) {
    req.url = '/check';
  }
  next();
});

// Serve up the GUI - if build dir exists, and GUI feature enabled
if (process.env.DISABLE_GUI && process.env.DISABLE_GUI !== 'false') {
  app.get('/', async (req, res) => {
    renderPlaceholderPage(res, 'disabledGui');
  });
} else if (!fs.existsSync(guiPath)) {
  app.get('/', async (req, res) => {
    renderPlaceholderPage(res, 'notCompiled');
  });
} else { // GUI enabled, and build files present, let's go!!
  app.use(express.static('dist/client/'));
  app.use(async (req, res, next) => {
    const ssrHandlerPath = path.join(__dirname, 'dist', 'server', 'entry.mjs');
    import(ssrHandlerPath).then(({ handler: ssrHandler }) => {
      ssrHandler(req, res, next);
    }).catch(async err => {
      renderPlaceholderPage(res, 'notCompiledSsrHandler', err.message);
    });
  });  
}

// Handle SPA routing
app.use(historyApiFallback({
  rewrites: [
    { from: new RegExp(`^${API_DIR}/.*$`), to: (context) => context.parsedUrl.path },
    { from: /^.*$/, to: '/index.html' }
  ]
}));

// Anything left unhandled (which isn't an API endpoint), return a 404
app.use((req, res, next) => {
  if (!req.path.startsWith(`${API_DIR}/`)) {
    res.status(404).sendFile(path.join(__dirname, 'public', 'error.html'));
  } else {
    next();
  }
});

// Print nice welcome message to user
const printMessage = () => {
  console.log(
    `\x1b[36m\n` +
    '    __      __   _         ___ _           _   \n' +
    '    \\ \\    / /__| |__ ___ / __| |_  ___ __| |__\n' +
    '     \\ \\/\\/ / -_) \'_ \\___| (__| \' \\/ -_) _| / /\n' +
    '      \\_/\\_/\\___|_.__/    \\___|_||_\\___\\__|_\\_\\\n' +
    `\x1b[0m\n`,
    `\x1b[1m\x1b[32m🚀 Web-Scan is up and running at http://localhost:${port} \x1b[0m\n\n`,
    `\x1b[2m\x1b[36m🛟 For documentation and support, visit the GitHub repo: ` +
    `https://github.com/khulnasoft/web-scan \n`,
    `💖 Found Web-Scan useful? Consider sponsoring us on GitHub ` +
    `to help fund maintenance & development.\x1b[0m`
  );
};

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Connect to Redis
    await redisClient.connect();
    console.log('Redis connected successfully');

    // Create HTTP server
    const server = createServer(app);

    // Initialize WebSocket server
    const websocketServer = new WebSocketServer(server);
    console.log('WebSocket server initialized');

    // Start server
    server.listen(port, () => {
      printMessage();
      console.log('\x1b[32m🔧 All services initialized successfully\x1b[0m');
      console.log('\x1b[36m📊 Monitoring service started\x1b[0m');
      console.log('\x1b[36m🔌 WebSocket server ready\x1b[0m');
      console.log('\x1b[36m💾 Redis cache connected\x1b[0m');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\x1b[33mReceived SIGTERM, shutting down gracefully...\x1b[0m');
      await redisClient.disconnect();
      server.close(() => {
        console.log('\x1b[32mServer closed\x1b[0m');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('\x1b[33mReceived SIGINT, shutting down gracefully...\x1b[0m');
      await redisClient.disconnect();
      server.close(() => {
        console.log('\x1b[32mServer closed\x1b[0m');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('\x1b[31mFailed to start server:\x1b[0m', error);
    process.exit(1);
  }
}

// Start the server
startServer();

