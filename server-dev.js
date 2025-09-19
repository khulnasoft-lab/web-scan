import express from 'express';
import cors from 'cors';
import historyApiFallback from 'connect-history-api-fallback';
import { createServer } from 'http';
import { initializeDatabase, User, MonitoringConfig, MonitoringResults } from './src/database/dev-models.js';
import monitoringService from './src/monitoring/service.js';
import WebSocketServer from './src/websocket/server.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import security features
import {
  rateLimitConfigs,
  securityHeaders,
  corsConfig,
  requestLogger,
  errorHandler,
  healthCheck
} from './api/_common/security.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const API_DIR = '/api';

// Security middleware (apply early)
app.use(securityHeaders);
app.use(corsConfig);
app.use(requestLogger);

// Health check (before rate limiting)
app.use(healthCheck);

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // Reduced for security
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'dist')));

// API routes
const handlers = {};

// Register API routes function
async function registerApiRoutes() {
  const apiDir = path.join(__dirname, 'api');
  console.log(`📁 Looking for API files in: ${apiDir}`);
  
  await registerApiDirectory(apiDir, '');
  
  console.log(`🎯 Total routes registered: ${Object.keys(handlers).length}`);
  console.log(`📋 Registered routes:`, Object.keys(handlers));
}

// Recursively register API routes from directories
async function registerApiDirectory(dirPath, prefix) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);
    
    if (item.isDirectory()) {
      // Recursively process subdirectories
      await registerApiDirectory(itemPath, `${prefix}/${item.name}`);
    } else if (item.isFile() && item.name.endsWith('.js') && !item.name.includes('webpack') && !item.name.includes('config')) {
      const routeName = item.name.split('.')[0];
      const route = `${API_DIR}${prefix}/${routeName}`;
      
      try {
        const handlerModule = await import(itemPath);
        const handler = handlerModule.default || handlerModule;
        handlers[route] = handler;

        // Apply appropriate rate limiting based on route category
        let rateLimit = rateLimitConfigs.general; // Default
        if (route.includes('/ai')) {
          rateLimit = rateLimitConfigs.ai;
        } else if (route.includes('/security')) {
          rateLimit = rateLimitConfigs.security;
        } else if (route.includes('/network')) {
          rateLimit = rateLimitConfigs.network;
        }

        // Support both GET and POST requests for API endpoints with rate limiting
        app.get(route, rateLimit, handler);
        app.post(route, rateLimit, handler);
        app.put(route, rateLimit, handler);
        app.delete(route, rateLimit, handler);

        console.log(`✅ Registered API route: ${route}`);
      } catch (error) {
        console.error(`❌ Failed to load route ${route}:`, error);
      }
    }
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.log('Warning: Database initialization failed, continuing without database');
    }

    // Register API routes
    await registerApiRoutes();

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Fallback to index.html for SPA routing (exclude API routes)
    app.use(historyApiFallback({
      rewrites: [
        { from: /^\/api\/.*$/, to: function(context) {
          return context.parsedUrl.pathname;
        }}
      ]
    }));

    // Create HTTP server
    const server = createServer(app);

    // Initialize WebSocket server
    const websocketServer = new WebSocketServer(server);
    console.log('WebSocket server initialized');

    // Initialize monitoring service (with mock data if database not available)
    try {
      await monitoringService.initializeServices();
      console.log('Monitoring service initialized');
    } catch (error) {
      console.log('Warning: Monitoring service initialization failed:', error.message);
    }

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Development server running on port ${PORT}`);
      console.log(`📊 API available at: http://localhost:${PORT}${API_DIR}`);
      console.log(`🔌 WebSocket server available at: ws://localhost:${PORT}`);
      console.log(`🌐 Frontend available at: http://localhost:${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(console.error);
