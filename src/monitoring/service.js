import { MonitoringConfig, MonitoringResults } from '../database/dev-models.js';
import redisClient from '../cache/redis-client.js';
import WebSocketServer from '../websocket/server.js';
import MonitoringAIAnalyzer from '../ai/analyzers/monitoring-ai-analyzer.js';
import { createServer } from 'http';
import cron from 'node-cron';
import nodemailer from 'nodemailer';

class MonitoringService {
  constructor() {
    this.activeMonitors = new Map(); // configId -> monitor data
    this.alertThresholds = new Map(); // configId -> thresholds
    this.emailTransporter = null;
    this.smsService = null;
    this.aiAnalyzer = new MonitoringAIAnalyzer({
      confidenceThreshold: 0.7,
      enableLearning: true
    });
    this.initializeServices();
  }

  async initializeServices() {
    // Initialize email service
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    // Initialize SMS service (placeholder for Twilio or similar)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      // SMS service initialization would go here
      this.smsService = {
        send: async (to, message) => {
          // Implement SMS sending logic
          console.log(`SMS would be sent to ${to}: ${message}`);
        }
      };
    }

    // Initialize AI analyzer
    await this.aiAnalyzer.initialize();
    
    // Load existing monitoring configurations
    await this.loadMonitoringConfigs();
    
    // Start scheduled monitoring
    this.startScheduledMonitoring();
    
    // Start AI insights generation
    this.startAIInsightsGeneration();
  }

  async loadMonitoringConfigs() {
    try {
      const monitoringConfig = new MonitoringConfig();
      const configs = await monitoringConfig.getActiveConfigs();
      
      for (const config of configs) {
        await this.startMonitoring(config);
      }
    } catch (error) {
      console.error('Error loading monitoring configurations:', error);
    }
  }

  async startMonitoring(config) {
    const monitor = {
      id: config.id,
      url: config.target_url,
      interval: config.check_interval * 1000, // Convert to milliseconds
      thresholds: config.thresholds,
      notifications: config.notifications,
      lastCheck: null,
      status: 'active',
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    };

    this.activeMonitors.set(config.id, monitor);
    this.alertThresholds.set(config.id, config.thresholds);

    // Start the monitoring loop
    this.monitoringLoop(config.id);

    console.log(`Started monitoring for ${config.target_url} (ID: ${config.id})`);
  }

  async stopMonitoring(configId) {
    const monitor = this.activeMonitors.get(configId);
    if (monitor) {
      monitor.status = 'stopped';
      this.activeMonitors.delete(configId);
      this.alertThresholds.delete(configId);
      console.log(`Stopped monitoring for config ID: ${configId}`);
    }
  }

  async monitoringLoop(configId) {
    const monitor = this.activeMonitors.get(configId);
    if (!monitor || monitor.status !== 'active') return;

    try {
      const result = await this.performMonitoringCheck(monitor);
      await this.processMonitoringResult(configId, result);
      
      // Schedule next check
      setTimeout(() => this.monitoringLoop(configId), monitor.interval);
    } catch (error) {
      console.error(`Error in monitoring loop for config ${configId}:`, error);
      // Schedule retry with exponential backoff
      const retryDelay = Math.min(monitor.interval * 2, 300000); // Max 5 minutes
      setTimeout(() => this.monitoringLoop(configId), retryDelay);
    }
  }

  async performMonitoringCheck(monitor) {
    const startTime = Date.now();
    const checkId = `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Perform HTTP check
      const response = await fetch(monitor.url, {
        method: 'GET',
        timeout: monitor.thresholds.response_time || 30000,
        headers: {
          'User-Agent': 'Web-Scan-Monitor/1.0'
        }
      });

      const responseTime = Date.now() - startTime;
      const result = {
        check_id: checkId,
        config_id: monitor.id,
        url: monitor.url,
        status_code: response.status,
        response_time: responseTime,
        timestamp: new Date().toISOString(),
        success: response.ok,
        error: null,
        headers: Object.fromEntries(response.headers.entries()),
        content_length: response.headers.get('content-length'),
        ssl_info: await this.checkSSL(monitor.url)
      };

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        check_id: checkId,
        config_id: monitor.id,
        url: monitor.url,
        status_code: null,
        response_time: responseTime,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
        headers: null,
        content_length: null,
        ssl_info: null
      };
    }
  }

  async checkSSL(url) {
    try {
      // This is a simplified SSL check
      // In a real implementation, you'd use a proper SSL checker
      const urlObj = new URL(url);
      if (urlObj.protocol === 'https:') {
        return {
          valid: true,
          expires_in: 30, // days (placeholder)
          issuer: 'Unknown'
        };
      }
      return { valid: false, reason: 'Not HTTPS' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async processMonitoringResult(configId, result) {
    const monitor = this.activeMonitors.get(configId);
    if (!monitor) return;

    // Update monitor state
    monitor.lastCheck = result.timestamp;
    
    if (result.success) {
      monitor.consecutiveSuccesses++;
      monitor.consecutiveFailures = 0;
    } else {
      monitor.consecutiveFailures++;
      monitor.consecutiveSuccesses = 0;
    }

    // Store result in database
    await this.storeMonitoringResult(result);

    // Check for alerts
    const alerts = await this.checkAlerts(configId, result, monitor);
    
    // Send alerts if any
    for (const alert of alerts) {
      await this.sendAlert(configId, alert);
    }

    // Broadcast real-time update via WebSocket
    await this.broadcastMonitoringUpdate(configId, result);

    // Cache recent results
    await this.cacheMonitoringResult(configId, result);
  }

  async storeMonitoringResult(result) {
    try {
      const monitoringResults = new MonitoringResults();
      await monitoringResults.createResult(result);
    } catch (error) {
      console.error('Error storing monitoring result:', error);
    }
  }

  async checkAlerts(configId, result, monitor) {
    const alerts = [];
    const thresholds = this.alertThresholds.get(configId);

    if (!thresholds) return alerts;

    // Check response time threshold
    if (result.response_time > thresholds.response_time) {
      alerts.push({
        type: 'response_time',
        severity: 'warning',
        message: `Response time ${result.response_time}ms exceeds threshold ${thresholds.response_time}ms`,
        value: result.response_time,
        threshold: thresholds.response_time
      });
    }

    // Check status code
    if (!result.success || (result.status_code >= 400)) {
      alerts.push({
        type: 'status_code',
        severity: 'critical',
        message: `HTTP ${result.status_code || 'Connection Error'} detected`,
        value: result.status_code,
        threshold: 200
      });
    }

    // Check consecutive failures
    if (monitor.consecutiveFailures >= thresholds.consecutive_failures) {
      alerts.push({
        type: 'consecutive_failures',
        severity: 'critical',
        message: `${monitor.consecutiveFailures} consecutive failures detected`,
        value: monitor.consecutiveFailures,
        threshold: thresholds.consecutive_failures
      });
    }

    // Check SSL expiration
    if (result.ssl_info && result.ssl_info.expires_in < thresholds.ssl_expiry_days) {
      alerts.push({
        type: 'ssl_expiry',
        severity: 'warning',
        message: `SSL certificate expires in ${result.ssl_info.expires_in} days`,
        value: result.ssl_info.expires_in,
        threshold: thresholds.ssl_expiry_days
      });
    }

    return alerts;
  }

  async sendAlert(configId, alert) {
    const monitor = this.activeMonitors.get(configId);
    if (!monitor || !monitor.notifications) return;

    const alertMessage = {
      config_id: configId,
      url: monitor.url,
      ...alert,
      timestamp: new Date().toISOString()
    };

    // Send email alerts
    if (monitor.notifications.email && this.emailTransporter) {
      await this.sendEmailAlert(monitor.notifications.email, alertMessage);
    }

    // Send SMS alerts
    if (monitor.notifications.sms && this.smsService) {
      await this.sendSMSAlert(monitor.notifications.sms, alertMessage);
    }

    // Store alert in database for audit trail
    await this.storeAlert(alertMessage);
  }

  async sendEmailAlert(emailRecipients, alert) {
    try {
      const subject = `Web-Scan Alert: ${alert.type} - ${alert.severity.toUpperCase()}`;
      const html = `
        <h2>Monitoring Alert</h2>
        <p><strong>URL:</strong> ${alert.url}</p>
        <p><strong>Type:</strong> ${alert.type}</p>
        <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
        <p><strong>Message:</strong> ${alert.message}</p>
        <p><strong>Timestamp:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
        <hr>
        <p>This alert was generated by Web-Scan Monitoring System</p>
      `;

      await this.emailTransporter.sendMail({
        to: Array.isArray(emailRecipients) ? emailRecipients.join(',') : emailRecipients,
        subject,
        html
      });

      console.log(`Email alert sent for ${alert.url}`);
    } catch (error) {
      console.error('Error sending email alert:', error);
    }
  }

  async sendSMSAlert(phoneNumbers, alert) {
    try {
      const message = `Web-Scan Alert: ${alert.type} - ${alert.severity} - ${alert.url}`;
      
      for (const phone of (Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers])) {
        await this.smsService.send(phone, message);
      }

      console.log(`SMS alert sent for ${alert.url}`);
    } catch (error) {
      console.error('Error sending SMS alert:', error);
    }
  }

  async storeAlert(alert) {
    try {
      // Store alert in database for audit trail
      // This would use the AuditLog model
      console.log('Storing alert:', alert);
    } catch (error) {
      console.error('Error storing alert:', error);
    }
  }

  async broadcastMonitoringUpdate(configId, result) {
    try {
      // Broadcast to WebSocket clients
      // This would integrate with the WebSocket server
      console.log(`Broadcasting monitoring update for config ${configId}`);
    } catch (error) {
      console.error('Error broadcasting monitoring update:', error);
    }
  }

  async cacheMonitoringResult(configId, result) {
    try {
      const cacheKey = `monitoring:${configId}:recent`;
      const recentResults = await redisClient.get(cacheKey) || [];
      
      recentResults.unshift(result);
      
      // Keep only last 100 results
      if (recentResults.length > 100) {
        recentResults.splice(100);
      }

      await redisClient.set(cacheKey, recentResults, 3600); // Cache for 1 hour
    } catch (error) {
      console.error('Error caching monitoring result:', error);
    }
  }

  startScheduledMonitoring() {
    // Run comprehensive monitoring every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('Running scheduled comprehensive monitoring check...');
      await this.performComprehensiveCheck();
    });

    // Clean up old monitoring data every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Cleaning up old monitoring data...');
      await this.cleanupOldData();
    });

    console.log('Scheduled monitoring tasks started');
  }

  async performComprehensiveCheck() {
    // Perform comprehensive health checks on all active monitors
    const activeConfigs = Array.from(this.activeMonitors.values());
    
    for (const config of activeConfigs) {
      if (config.status === 'active') {
        // Additional comprehensive checks can be added here
        console.log(`Comprehensive check for ${config.url}`);
      }
    }
  }

  async cleanupOldData() {
    try {
      // Clean up old monitoring results (keep last 30 days)
      const monitoringResults = new MonitoringResults();
      await monitoringResults.cleanupOldData(30);
      
      console.log('Old monitoring data cleaned up');
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }

  // Public API methods
  async createMonitoringConfig(configData) {
    try {
      const monitoringConfig = new MonitoringConfig();
      const config = await monitoringConfig.createConfig(configData);
      
      await this.startMonitoring(config);
      return config;
    } catch (error) {
      console.error('Error creating monitoring config:', error);
      throw error;
    }
  }

  async updateMonitoringConfig(configId, updateData) {
    try {
      const monitoringConfig = new MonitoringConfig();
      await monitoringConfig.updateConfig(configId, updateData);
      
      // Restart monitoring with new configuration
      await this.stopMonitoring(configId);
      const updatedConfig = await monitoringConfig.findById(configId);
      await this.startMonitoring(updatedConfig);
      
      return updatedConfig;
    } catch (error) {
      console.error('Error updating monitoring config:', error);
      throw error;
    }
  }

  async deleteMonitoringConfig(configId) {
    try {
      await this.stopMonitoring(configId);
      
      const monitoringConfig = new MonitoringConfig();
      await monitoringConfig.deleteConfig(configId);
      
      return true;
    } catch (error) {
      console.error('Error deleting monitoring config:', error);
      throw error;
    }
  }

  async getMonitoringStatus(configId) {
    const monitor = this.activeMonitors.get(configId);
    if (!monitor) {
      throw new Error('Monitoring configuration not found');
    }

    return {
      config_id: configId,
      status: monitor.status,
      last_check: monitor.lastCheck,
      consecutive_failures: monitor.consecutiveFailures,
      consecutive_successes: monitor.consecutiveSuccesses,
      url: monitor.url
    };
  }

  async getMonitoringResults(configId, limit = 100, offset = 0) {
    try {
      const monitoringResults = new MonitoringResults();
      return await monitoringResults.getConfigResults(configId, limit, offset);
    } catch (error) {
      console.error('Error getting monitoring results:', error);
      throw error;
    }
  }

  /**
   * Start AI insights generation
   */
  startAIInsightsGeneration() {
    // Generate AI insights every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('🤖 Generating AI insights for all active monitors...');
      
      for (const [configId, monitor] of this.activeMonitors) {
        try {
          await this.generateAndBroadcastAIInsights(configId);
        } catch (error) {
          console.error(`Error generating AI insights for config ${configId}:`, error);
        }
      }
    });
    
    console.log('✅ AI insights generation scheduled (every 5 minutes)');
  }

  /**
   * Generate and broadcast AI insights for a specific configuration
   * @param {string} configId - Configuration ID
   */
  async generateAndBroadcastAIInsights(configId) {
    try {
      // Fetch recent monitoring data
      const monitoringResults = new MonitoringResults();
      const recentResults = await monitoringResults.getConfigResults(configId, 50, 0);
      
      if (recentResults.length === 0) {
        return; // No data to analyze
      }

      // Prepare data for AI analysis
      const monitoringData = {
        configId,
        responseTimeData: recentResults.map(result => ({
          timestamp: result.created_at,
          response_time: result.response_time,
          success: result.status_code >= 200 && result.status_code < 400
        })),
        errorData: recentResults.map(result => ({
          timestamp: result.created_at,
          success: result.status_code >= 200 && result.status_code < 400,
          error: result.error_message
        })),
        uptimeData: this.calculateUptimeStats(recentResults)
      };

      // Generate AI insights
      const aiInsights = await this.aiAnalyzer.analyze(monitoringData, 'monitoring');

      // Broadcast AI insights via WebSocket
      const wsServer = WebSocketServer.getInstance();
      if (wsServer) {
        wsServer.broadcast('ai_insights', {
          configId,
          insights: aiInsights,
          timestamp: new Date().toISOString()
        });
        
        console.log(`🤖 AI insights broadcasted for config ${configId}`);
        console.log(`📊 Health Score: ${aiInsights.healthScore}/10, Insights: ${aiInsights.insights.length}`);
      }

      // Store insights in cache for API access
      if (redisClient && redisClient.isConnected) {
        const cacheKey = `ai_insights:${configId}`;
        await redisClient.setex(cacheKey, 300, JSON.stringify(aiInsights)); // Cache for 5 minutes
      }

    } catch (error) {
      console.error(`Error generating AI insights for config ${configId}:`, error);
    }
  }

  /**
   * Calculate uptime statistics from results
   * @param {Array} results - Monitoring results
   * @returns {Object} Uptime statistics
   */
  calculateUptimeStats(results) {
    if (results.length === 0) {
      return {
        uptime_percentage: 100,
        total_checks: 0,
        successful_checks: 0,
        failed_checks: 0,
        avg_response_time: 0,
        consecutive_failures: 0
      };
    }

    const successfulChecks = results.filter(r => r.status_code >= 200 && r.status_code < 400).length;
    const totalChecks = results.length;
    const uptimePercentage = (successfulChecks / totalChecks) * 100;
    const avgResponseTime = results.reduce((sum, r) => sum + (r.response_time || 0), 0) / totalChecks;

    // Calculate consecutive failures from most recent
    let consecutiveFailures = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].status_code < 200 || results[i].status_code >= 400) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    return {
      uptime_percentage: uptimePercentage,
      total_checks: totalChecks,
      successful_checks: successfulChecks,
      failed_checks: totalChecks - successfulChecks,
      avg_response_time: avgResponseTime,
      consecutive_failures: consecutiveFailures
    };
  }
}

// Export singleton instance
const monitoringService = new MonitoringService();

export default monitoringService;
