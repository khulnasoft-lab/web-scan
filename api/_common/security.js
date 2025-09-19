/**
 * API Security & Rate Limiting Module
 * Provides comprehensive security features for the Web-Scan API
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

// Rate limiting configurations for different endpoint types
export const rateLimitConfigs = {
  // General API endpoints
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    }
  }),

  // AI endpoints (more restrictive due to computational cost)
  ai: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 AI requests per windowMs
    message: {
      error: 'Too many AI requests from this IP, please try again later.',
      retryAfter: '15 minutes',
      hint: 'AI analysis is computationally intensive. Please use responsibly.'
    },
    standardHeaders: true,
    legacyHeaders: false
  }),

  // Security scanning endpoints (moderate restrictions)
  security: rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 50, // Limit each IP to 50 security scans per windowMs
    message: {
      error: 'Too many security scan requests from this IP, please try again later.',
      retryAfter: '10 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  }),

  // Network diagnostic endpoints (moderate restrictions)
  network: rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 30, // Limit each IP to 30 network requests per windowMs
    message: {
      error: 'Too many network diagnostic requests from this IP, please try again later.',
      retryAfter: '10 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  })
};

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// CORS configuration
export const corsConfig = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4321',
      'https://web-scan.netlify.app',
      'https://web-scan.vercel.app'
    ];
    
    // Check if origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
});

// Input validation helpers
export const validateUrl = (url) => {
  if (!url || typeof url !== 'string') {
    throw new Error('URL parameter is required and must be a string');
  }
  
  try {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    
    // Block localhost and private IPs for security
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.2') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.')) {
      throw new Error('Private IP addresses and localhost are not allowed');
    }
    
    return parsedUrl;
  } catch (error) {
    throw new Error(`Invalid URL format: ${error.message}`);
  }
};

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      duration: `${duration}ms`,
      status: res.statusCode,
      timestamp: new Date().toISOString()
    };
    
    // Log based on status code
    if (res.statusCode >= 400) {
      console.warn('🚨 API Request Warning:', logData);
    } else {
      console.log('📊 API Request:', logData);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Error handling middleware
export const errorHandler = (err, req, res, next) => {
  console.error('❌ API Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
};

// Health check bypass for monitoring
export const healthCheck = (req, res, next) => {
  if (req.path === '/health') {
    return res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    });
  }
  next();
};

export default {
  rateLimitConfigs,
  securityHeaders,
  corsConfig,
  validateUrl,
  requestLogger,
  errorHandler,
  healthCheck
};
