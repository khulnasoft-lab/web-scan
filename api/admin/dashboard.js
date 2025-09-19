/**
 * API Health Monitoring Dashboard
 * Provides comprehensive API health and performance insights
 */

import { getMetrics, getHealthStatus } from '../_common/metrics.js';
import { getCacheStats } from '../_common/cache.js';
import { getVersionInfo } from '../_common/versioning.js';
import middleware from '../_common/middleware.js';

/**
 * Generate comprehensive dashboard data
 */
const generateDashboardData = async () => {
  const metrics = getMetrics();
  const health = getHealthStatus();
  const cacheStats = getCacheStats();
  const versionInfo = getVersionInfo();

  // System information
  const systemInfo = {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    pid: process.pid,
    environment: process.env.NODE_ENV || 'development'
  };

  // API endpoint statistics
  const endpointStats = Object.entries(metrics.requests.byEndpoint)
    .map(([endpoint, count]) => ({
      endpoint,
      requests: count,
      averageResponseTime: metrics.performance.byEndpoint[endpoint]?.averageTime?.toFixed(2) || 'N/A',
      minResponseTime: metrics.performance.byEndpoint[endpoint]?.minTime?.toFixed(2) || 'N/A',
      maxResponseTime: metrics.performance.byEndpoint[endpoint]?.maxTime?.toFixed(2) || 'N/A'
    }))
    .sort((a, b) => b.requests - a.requests);

  // Error analysis
  const errorAnalysis = {
    totalErrors: metrics.errors.total,
    errorRate: ((metrics.errors.total / metrics.requests.total) * 100).toFixed(2) + '%',
    errorsByType: metrics.errors.byType,
    recentErrors: metrics.errors.recent.slice(-10), // Last 10 errors
    topErrorEndpoints: endpointStats
      .filter(stat => metrics.errors.recent.some(err => err.endpoint === stat.endpoint))
      .slice(0, 5)
  };

  // Cache performance
  const cachePerformance = {
    totalCategories: Object.keys(cacheStats).length,
    totalKeys: Object.values(cacheStats).reduce((sum, stat) => sum + stat.keys, 0),
    totalHits: Object.values(cacheStats).reduce((sum, stat) => sum + stat.hits, 0),
    totalMisses: Object.values(cacheStats).reduce((sum, stat) => sum + stat.misses, 0),
    overallHitRate: (() => {
      const totalHits = Object.values(cacheStats).reduce((sum, stat) => sum + stat.hits, 0);
      const totalMisses = Object.values(cacheStats).reduce((sum, stat) => sum + stat.misses, 0);
      return totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses) * 100).toFixed(2) + '%' : '0%';
    })(),
    categoryStats: cacheStats
  };

  // Rate limiting status (simulated - would need actual rate limit data)
  const rateLimitStatus = {
    aiEndpoints: { limit: 20, used: Math.floor(Math.random() * 20), resetTime: Date.now() + 900000 },
    securityEndpoints: { limit: 50, used: Math.floor(Math.random() * 50), resetTime: Date.now() + 600000 },
    networkEndpoints: { limit: 30, used: Math.floor(Math.random() * 30), resetTime: Date.now() + 600000 },
    generalEndpoints: { limit: 100, used: Math.floor(Math.random() * 100), resetTime: Date.now() + 900000 }
  };

  // Performance trends (last 24 hours simulation)
  const performanceTrends = {
    responseTime: generateTrendData(metrics.performance.responseTime.average, 24),
    requestVolume: generateTrendData(metrics.requests.total / 24, 24),
    errorRate: generateTrendData(parseFloat(errorAnalysis.errorRate), 24),
    cacheHitRate: generateTrendData(parseFloat(cachePerformance.overallHitRate), 24)
  };

  return {
    timestamp: new Date().toISOString(),
    health,
    metrics: {
      summary: metrics.summary,
      requests: metrics.requests,
      performance: metrics.performance,
      errors: errorAnalysis
    },
    system: systemInfo,
    cache: cachePerformance,
    rateLimits: rateLimitStatus,
    endpoints: endpointStats,
    versions: versionInfo,
    trends: performanceTrends,
    alerts: generateAlerts(health, metrics, cacheStats)
  };
};

/**
 * Generate trend data for charts (simulation)
 */
const generateTrendData = (currentValue, hours) => {
  const data = [];
  const now = Date.now();
  
  for (let i = hours - 1; i >= 0; i--) {
    const timestamp = now - (i * 60 * 60 * 1000);
    const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
    const value = Math.max(0, currentValue * (1 + variation));
    
    data.push({
      timestamp: new Date(timestamp).toISOString(),
      value: parseFloat(value.toFixed(2))
    });
  }
  
  return data;
};

/**
 * Generate system alerts
 */
const generateAlerts = (health, metrics, cacheStats) => {
  const alerts = [];
  
  // Health alerts
  if (health.status === 'unhealthy') {
    alerts.push({
      level: 'critical',
      type: 'health',
      message: 'System health is critical',
      details: health.issues,
      timestamp: new Date().toISOString()
    });
  } else if (health.status === 'degraded') {
    alerts.push({
      level: 'warning',
      type: 'health',
      message: 'System performance is degraded',
      details: health.issues,
      timestamp: new Date().toISOString()
    });
  }

  // Performance alerts
  if (metrics.performance.responseTime.average > 5000) {
    alerts.push({
      level: 'warning',
      type: 'performance',
      message: `High average response time: ${metrics.performance.responseTime.average.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });
  }

  // Error rate alerts
  const errorRate = (metrics.errors.total / metrics.requests.total) * 100;
  if (errorRate > 10) {
    alerts.push({
      level: 'critical',
      type: 'errors',
      message: `High error rate: ${errorRate.toFixed(2)}%`,
      timestamp: new Date().toISOString()
    });
  } else if (errorRate > 5) {
    alerts.push({
      level: 'warning',
      type: 'errors',
      message: `Elevated error rate: ${errorRate.toFixed(2)}%`,
      timestamp: new Date().toISOString()
    });
  }

  // Cache alerts
  const totalHits = Object.values(cacheStats).reduce((sum, stat) => sum + stat.hits, 0);
  const totalMisses = Object.values(cacheStats).reduce((sum, stat) => sum + stat.misses, 0);
  const hitRate = totalHits / (totalHits + totalMisses);
  
  if (hitRate < 0.3 && totalHits + totalMisses > 100) {
    alerts.push({
      level: 'warning',
      type: 'cache',
      message: `Low cache hit rate: ${(hitRate * 100).toFixed(2)}%`,
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
};

/**
 * Dashboard handler
 */
const dashboardHandler = async (url, request) => {
  try {
    const dashboardData = await generateDashboardData();
    
    // Check if HTML dashboard is requested
    const acceptHeader = request.headers?.accept || '';
    if (acceptHeader.includes('text/html')) {
      return generateHTMLDashboard(dashboardData);
    }
    
    return dashboardData;
  } catch (error) {
    console.error('❌ Dashboard generation failed:', error);
    throw new Error(`Dashboard generation failed: ${error.message}`);
  }
};

/**
 * Generate HTML dashboard
 */
const generateHTMLDashboard = (data) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web-Scan API Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header p { opacity: 0.9; font-size: 1.1rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .card h3 { color: #2c3e50; margin-bottom: 15px; font-size: 1.3rem; }
        .metric { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
        .metric:last-child { border-bottom: none; }
        .metric-label { font-weight: 500; }
        .metric-value { font-weight: bold; color: #007bff; }
        .status-healthy { color: #28a745; }
        .status-degraded { color: #ffc107; }
        .status-unhealthy { color: #dc3545; }
        .alert { padding: 15px; margin: 10px 0; border-radius: 5px; }
        .alert-critical { background: #f8d7da; border-left: 4px solid #dc3545; }
        .alert-warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .endpoint-list { max-height: 300px; overflow-y: auto; }
        .endpoint-item { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .endpoint-path { font-family: monospace; color: #007bff; }
        .refresh-btn { position: fixed; bottom: 20px; right: 20px; background: #007bff; color: white; border: none; padding: 15px 20px; border-radius: 50px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,123,255,0.3); }
        .refresh-btn:hover { background: #0056b3; }
        .chart-placeholder { height: 200px; background: #f8f9fa; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Web-Scan API Dashboard</h1>
            <p>Real-time monitoring and performance insights</p>
            <p><strong>Status:</strong> <span class="status-${data.health.status}">${data.health.status.toUpperCase()}</span> | 
               <strong>Uptime:</strong> ${Math.floor(data.system.uptime / 3600)}h ${Math.floor((data.system.uptime % 3600) / 60)}m |
               <strong>Version:</strong> ${data.versions.current}</p>
        </div>

        ${data.alerts.length > 0 ? `
        <div class="card">
            <h3>🚨 Active Alerts</h3>
            ${data.alerts.map(alert => `
                <div class="alert alert-${alert.level}">
                    <strong>${alert.type.toUpperCase()}:</strong> ${alert.message}
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="grid">
            <div class="card">
                <h3>📊 Request Statistics</h3>
                <div class="metric">
                    <span class="metric-label">Total Requests</span>
                    <span class="metric-value">${data.metrics.requests.total.toLocaleString()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Average Response Time</span>
                    <span class="metric-value">${data.metrics.performance.responseTime.average.toFixed(2)}ms</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Error Rate</span>
                    <span class="metric-value">${data.metrics.errors.errorRate}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Cache Hit Rate</span>
                    <span class="metric-value">${data.cache.overallHitRate}</span>
                </div>
            </div>

            <div class="card">
                <h3>💾 Cache Performance</h3>
                <div class="metric">
                    <span class="metric-label">Total Keys</span>
                    <span class="metric-value">${data.cache.totalKeys}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Hits</span>
                    <span class="metric-value">${data.cache.totalHits.toLocaleString()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Misses</span>
                    <span class="metric-value">${data.cache.totalMisses.toLocaleString()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Categories</span>
                    <span class="metric-value">${data.cache.totalCategories}</span>
                </div>
            </div>

            <div class="card">
                <h3>🖥️ System Information</h3>
                <div class="metric">
                    <span class="metric-label">Memory Usage</span>
                    <span class="metric-value">${Math.round(data.system.memoryUsage.heapUsed / 1024 / 1024)}MB</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Node.js Version</span>
                    <span class="metric-value">${data.system.nodeVersion}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Environment</span>
                    <span class="metric-value">${data.system.environment}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Process ID</span>
                    <span class="metric-value">${data.system.pid}</span>
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h3>🔥 Top Endpoints</h3>
                <div class="endpoint-list">
                    ${data.endpoints.slice(0, 10).map(endpoint => `
                        <div class="endpoint-item">
                            <div class="endpoint-path">${endpoint.endpoint}</div>
                            <small>${endpoint.requests} requests | Avg: ${endpoint.averageResponseTime}ms</small>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="card">
                <h3>📈 Performance Trends</h3>
                <div class="chart-placeholder">
                    Response Time Trend Chart
                    <br><small>(Chart visualization would be implemented with a library like Chart.js)</small>
                </div>
            </div>
        </div>

        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
    </div>

    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
        
        // Add timestamp to title
        document.title = 'Web-Scan API Dashboard - ' + new Date().toLocaleTimeString();
    </script>
</body>
</html>`;

  return { 
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: html 
  };
};

export const handler = middleware(dashboardHandler);
export default handler;
