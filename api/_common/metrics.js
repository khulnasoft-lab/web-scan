/**
 * API Performance Monitoring & Metrics
 * Tracks API performance, usage statistics, and health metrics
 */

import { performance } from 'perf_hooks';

// Metrics storage
const metrics = {
  requests: {
    total: 0,
    byEndpoint: {},
    byStatus: {},
    byMethod: {}
  },
  performance: {
    responseTime: {
      total: 0,
      count: 0,
      average: 0,
      min: Infinity,
      max: 0,
      percentiles: {}
    },
    byEndpoint: {}
  },
  errors: {
    total: 0,
    byType: {},
    recent: []
  },
  system: {
    startTime: Date.now(),
    uptime: 0,
    memoryUsage: {},
    cpuUsage: {}
  }
};

// Response time tracking
const responseTimes = [];

/**
 * Performance monitoring middleware
 */
export const performanceMiddleware = (req, res, next) => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  // Track request
  metrics.requests.total++;
  metrics.requests.byMethod[req.method] = (metrics.requests.byMethod[req.method] || 0) + 1;
  
  const endpoint = req.route?.path || req.path;
  metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1;
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    const endMemory = process.memoryUsage();
    
    // Track response time
    responseTimes.push(responseTime);
    if (responseTimes.length > 1000) {
      responseTimes.shift(); // Keep only last 1000 measurements
    }
    
    // Update performance metrics
    metrics.performance.responseTime.total += responseTime;
    metrics.performance.responseTime.count++;
    metrics.performance.responseTime.average = 
      metrics.performance.responseTime.total / metrics.performance.responseTime.count;
    metrics.performance.responseTime.min = Math.min(metrics.performance.responseTime.min, responseTime);
    metrics.performance.responseTime.max = Math.max(metrics.performance.responseTime.max, responseTime);
    
    // Track by endpoint
    if (!metrics.performance.byEndpoint[endpoint]) {
      metrics.performance.byEndpoint[endpoint] = {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0
      };
    }
    
    const endpointMetrics = metrics.performance.byEndpoint[endpoint];
    endpointMetrics.count++;
    endpointMetrics.totalTime += responseTime;
    endpointMetrics.averageTime = endpointMetrics.totalTime / endpointMetrics.count;
    endpointMetrics.minTime = Math.min(endpointMetrics.minTime, responseTime);
    endpointMetrics.maxTime = Math.max(endpointMetrics.maxTime, responseTime);
    
    // Track status codes
    metrics.requests.byStatus[res.statusCode] = (metrics.requests.byStatus[res.statusCode] || 0) + 1;
    
    // Track errors
    if (res.statusCode >= 400) {
      metrics.errors.total++;
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      metrics.errors.byType[errorType] = (metrics.errors.byType[errorType] || 0) + 1;
      
      // Keep recent errors (last 100)
      metrics.errors.recent.push({
        timestamp: new Date().toISOString(),
        endpoint,
        method: req.method,
        status: res.statusCode,
        responseTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      if (metrics.errors.recent.length > 100) {
        metrics.errors.recent.shift();
      }
    }
    
    // Log slow requests (>5 seconds)
    if (responseTime > 5000) {
      console.warn(`🐌 Slow request detected: ${req.method} ${endpoint} - ${responseTime.toFixed(2)}ms`);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Calculate percentiles for response times
 */
const calculatePercentiles = () => {
  if (responseTimes.length === 0) return {};
  
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const percentiles = [50, 75, 90, 95, 99];
  const result = {};
  
  percentiles.forEach(p => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    result[`p${p}`] = sorted[index] || 0;
  });
  
  return result;
};

/**
 * Get current metrics
 */
export const getMetrics = () => {
  // Update system metrics
  metrics.system.uptime = Date.now() - metrics.system.startTime;
  metrics.system.memoryUsage = process.memoryUsage();
  
  // Calculate percentiles
  metrics.performance.responseTime.percentiles = calculatePercentiles();
  
  return {
    ...metrics,
    timestamp: new Date().toISOString(),
    summary: {
      totalRequests: metrics.requests.total,
      averageResponseTime: `${metrics.performance.responseTime.average.toFixed(2)}ms`,
      errorRate: `${((metrics.errors.total / metrics.requests.total) * 100).toFixed(2)}%`,
      uptime: `${Math.floor(metrics.system.uptime / 1000)}s`,
      memoryUsage: `${Math.round(metrics.system.memoryUsage.heapUsed / 1024 / 1024)}MB`
    }
  };
};

/**
 * Get health status
 */
export const getHealthStatus = () => {
  const currentMetrics = getMetrics();
  const errorRate = (metrics.errors.total / metrics.requests.total) * 100;
  const avgResponseTime = metrics.performance.responseTime.average;
  
  let status = 'healthy';
  const issues = [];
  
  // Check error rate
  if (errorRate > 10) {
    status = 'unhealthy';
    issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
  } else if (errorRate > 5) {
    status = 'degraded';
    issues.push(`Elevated error rate: ${errorRate.toFixed(2)}%`);
  }
  
  // Check response time
  if (avgResponseTime > 10000) {
    status = 'unhealthy';
    issues.push(`Very slow response time: ${avgResponseTime.toFixed(2)}ms`);
  } else if (avgResponseTime > 5000) {
    status = status === 'healthy' ? 'degraded' : status;
    issues.push(`Slow response time: ${avgResponseTime.toFixed(2)}ms`);
  }
  
  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  if (memoryUsagePercent > 90) {
    status = 'unhealthy';
    issues.push(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
  }
  
  return {
    status,
    issues,
    metrics: currentMetrics.summary,
    timestamp: new Date().toISOString()
  };
};

/**
 * Reset metrics
 */
export const resetMetrics = () => {
  metrics.requests = { total: 0, byEndpoint: {}, byStatus: {}, byMethod: {} };
  metrics.performance = {
    responseTime: { total: 0, count: 0, average: 0, min: Infinity, max: 0, percentiles: {} },
    byEndpoint: {}
  };
  metrics.errors = { total: 0, byType: {}, recent: [] };
  responseTimes.length = 0;
  
  console.log('📊 Metrics reset');
  return { success: true, timestamp: new Date().toISOString() };
};

/**
 * Get top endpoints by usage
 */
export const getTopEndpoints = (limit = 10) => {
  const endpoints = Object.entries(metrics.requests.byEndpoint)
    .map(([endpoint, count]) => ({
      endpoint,
      requests: count,
      averageResponseTime: metrics.performance.byEndpoint[endpoint]?.averageTime?.toFixed(2) || 'N/A'
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, limit);
  
  return endpoints;
};

export default {
  performanceMiddleware,
  getMetrics,
  getHealthStatus,
  resetMetrics,
  getTopEndpoints
};
