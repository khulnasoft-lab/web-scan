/**
 * Comprehensive Logging and Observability System
 * Structured logging with multiple transports and observability features
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    trace: 5
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
    trace: 'cyan'
  }
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, traceId, userId, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      service: service || 'web-scan-api',
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
      hostname: require('os').hostname(),
      ...(traceId && { traceId }),
      ...(userId && { userId }),
      ...meta
    };
    
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}] ${service || 'API'}: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'web-scan-api',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      tailable: true
    }),
    
    // HTTP access logs
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      level: 'http',
      maxsize: 25 * 1024 * 1024, // 25MB
      maxFiles: 7,
      tailable: true
    }),
    
    // Performance logs
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      level: 'info',
      maxsize: 25 * 1024 * 1024, // 25MB
      maxFiles: 5,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf((info) => {
          if (info.type === 'performance') {
            return JSON.stringify(info);
          }
          return null;
        }),
        winston.format.filter((info) => info.type === 'performance')
      )
    })
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

/**
 * Enhanced logging methods with context
 */
class EnhancedLogger {
  constructor(baseLogger) {
    this.logger = baseLogger;
    this.context = {};
  }

  // Set context for all subsequent logs
  setContext(context) {
    this.context = { ...this.context, ...context };
    return this;
  }

  // Clear context
  clearContext() {
    this.context = {};
    return this;
  }

  // Create child logger with context
  child(context) {
    const childLogger = new EnhancedLogger(this.logger);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  // Log methods
  error(message, meta = {}) {
    this.logger.error(message, { ...this.context, ...meta });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, { ...this.context, ...meta });
  }

  info(message, meta = {}) {
    this.logger.info(message, { ...this.context, ...meta });
  }

  http(message, meta = {}) {
    this.logger.http(message, { ...this.context, ...meta });
  }

  debug(message, meta = {}) {
    this.logger.debug(message, { ...this.context, ...meta });
  }

  trace(message, meta = {}) {
    this.logger.log('trace', message, { ...this.context, ...meta });
  }

  // Performance logging
  performance(operation, duration, meta = {}) {
    this.logger.info(`Performance: ${operation}`, {
      ...this.context,
      ...meta,
      type: 'performance',
      operation,
      duration,
      timestamp: new Date().toISOString()
    });
  }

  // API request logging
  apiRequest(req, res, duration) {
    const logData = {
      type: 'api_request',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      contentLength: res.get('Content-Length'),
      referer: req.get('Referer'),
      apiVersion: req.headers['x-api-version'],
      traceId: req.headers['x-trace-id'] || this.generateTraceId()
    };

    if (res.statusCode >= 400) {
      this.error('API Request Error', logData);
    } else {
      this.http('API Request', logData);
    }
  }

  // Security event logging
  security(event, details = {}) {
    this.warn(`Security Event: ${event}`, {
      ...this.context,
      type: 'security',
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  // Business logic logging
  business(event, details = {}) {
    this.info(`Business Event: ${event}`, {
      ...this.context,
      type: 'business',
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  // System health logging
  health(component, status, metrics = {}) {
    this.info(`Health Check: ${component}`, {
      ...this.context,
      type: 'health',
      component,
      status,
      metrics,
      timestamp: new Date().toISOString()
    });
  }

  // Generate trace ID for request tracking
  generateTraceId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  // Structured error logging with stack traces
  logError(error, context = {}) {
    this.error(error.message, {
      ...this.context,
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      timestamp: new Date().toISOString()
    });
  }

  // Log with custom level
  log(level, message, meta = {}) {
    this.logger.log(level, message, { ...this.context, ...meta });
  }
}

// Create enhanced logger instance
const enhancedLogger = new EnhancedLogger(logger);

/**
 * Express middleware for request logging
 */
export const requestLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Add trace ID to request
  req.traceId = req.headers['x-trace-id'] || enhancedLogger.generateTraceId();
  res.set('X-Trace-Id', req.traceId);
  
  // Create request-scoped logger
  req.logger = enhancedLogger.child({
    traceId: req.traceId,
    method: req.method,
    url: req.url
  });

  // Log request start
  req.logger.debug('Request started', {
    headers: req.headers,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Log the completed request
    req.logger.apiRequest(req, res, duration);
    
    originalEnd.apply(this, args);
  };

  next();
};

/**
 * Performance monitoring decorator
 */
export const performanceMonitor = (operation) => {
  return (target, propertyName, descriptor) => {
    const method = descriptor.value;
    
    descriptor.value = async function(...args) {
      const startTime = Date.now();
      const logger = enhancedLogger.child({ operation, method: propertyName });
      
      try {
        logger.debug(`Starting ${operation}`);
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        logger.performance(operation, duration, { success: true });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.performance(operation, duration, { success: false, error: error.message });
        logger.logError(error, { operation });
        throw error;
      }
    };
    
    return descriptor;
  };
};

/**
 * Log aggregation and analysis
 */
export class LogAnalyzer {
  constructor(logger) {
    this.logger = logger;
  }

  // Analyze error patterns
  async analyzeErrors(timeRange = '1h') {
    // In a real implementation, this would query log files or a log aggregation service
    return {
      totalErrors: 0,
      errorsByType: {},
      errorsByEndpoint: {},
      topErrors: [],
      timeRange
    };
  }

  // Analyze performance trends
  async analyzePerformance(timeRange = '1h') {
    return {
      averageResponseTime: 0,
      slowestEndpoints: [],
      performanceTrends: [],
      timeRange
    };
  }

  // Generate health report
  async generateHealthReport() {
    return {
      timestamp: new Date().toISOString(),
      logVolume: await this.getLogVolume(),
      errorRate: await this.getErrorRate(),
      performanceMetrics: await this.getPerformanceMetrics(),
      alerts: await this.getActiveAlerts()
    };
  }

  async getLogVolume() {
    // Implementation would count log entries
    return { total: 0, byLevel: {} };
  }

  async getErrorRate() {
    // Implementation would calculate error rate
    return 0;
  }

  async getPerformanceMetrics() {
    // Implementation would analyze performance logs
    return {};
  }

  async getActiveAlerts() {
    // Implementation would check for alert conditions
    return [];
  }
}

// Create log analyzer instance
export const logAnalyzer = new LogAnalyzer(enhancedLogger);

// Export the enhanced logger as default
export default enhancedLogger;

// Export the base winston logger for advanced use cases
export { logger as winstonLogger };
