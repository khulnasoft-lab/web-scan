/**
 * Multi-Region Support and Load Balancing
 * Provides geographic distribution and failover capabilities
 */

import { performance } from 'perf_hooks';
import axios from 'axios';

// Regional configuration
const REGIONS = {
  'us-east-1': {
    name: 'US East (Virginia)',
    endpoint: 'https://us-east-api.web-scan.com',
    priority: 1,
    healthCheck: '/health',
    latencyThreshold: 200,
    timezone: 'America/New_York'
  },
  'us-west-2': {
    name: 'US West (Oregon)',
    endpoint: 'https://us-west-api.web-scan.com',
    priority: 2,
    healthCheck: '/health',
    latencyThreshold: 250,
    timezone: 'America/Los_Angeles'
  },
  'eu-west-1': {
    name: 'Europe (Ireland)',
    endpoint: 'https://eu-west-api.web-scan.com',
    priority: 1,
    healthCheck: '/health',
    latencyThreshold: 300,
    timezone: 'Europe/Dublin'
  },
  'ap-southeast-1': {
    name: 'Asia Pacific (Singapore)',
    endpoint: 'https://ap-southeast-api.web-scan.com',
    priority: 1,
    healthCheck: '/health',
    latencyThreshold: 400,
    timezone: 'Asia/Singapore'
  }
};

// Geographic IP to region mapping
const GEO_REGIONS = {
  'US': ['us-east-1', 'us-west-2'],
  'CA': ['us-east-1', 'us-west-2'],
  'GB': ['eu-west-1'],
  'DE': ['eu-west-1'],
  'FR': ['eu-west-1'],
  'SG': ['ap-southeast-1'],
  'JP': ['ap-southeast-1'],
  'AU': ['ap-southeast-1']
};

class MultiRegionManager {
  constructor() {
    this.currentRegion = process.env.AWS_REGION || 'us-east-1';
    this.regionHealth = new Map();
    this.latencyCache = new Map();
    this.failoverHistory = [];
    this.healthCheckInterval = null;
    
    this.initializeHealthChecks();
  }

  /**
   * Initialize continuous health checks for all regions
   */
  initializeHealthChecks() {
    console.log('🌍 Initializing multi-region health checks...');
    
    // Initial health check
    this.checkAllRegionsHealth();
    
    // Set up periodic health checks every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkAllRegionsHealth();
    }, 30000);
    
    console.log('✅ Multi-region health monitoring started');
  }

  /**
   * Check health of all regions
   */
  async checkAllRegionsHealth() {
    const healthPromises = Object.entries(REGIONS).map(async ([regionId, config]) => {
      try {
        const startTime = performance.now();
        const response = await axios.get(`${config.endpoint}${config.healthCheck}`, {
          timeout: 5000,
          headers: {
            'User-Agent': 'WebScan-HealthCheck/1.0'
          }
        });
        
        const latency = performance.now() - startTime;
        
        const health = {
          regionId,
          status: response.status === 200 ? 'healthy' : 'unhealthy',
          latency: Math.round(latency),
          lastCheck: new Date().toISOString(),
          responseTime: latency,
          statusCode: response.status,
          healthy: response.status === 200 && latency < config.latencyThreshold * 2
        };
        
        this.regionHealth.set(regionId, health);
        this.updateLatencyCache(regionId, latency);
        
        return health;
      } catch (error) {
        const health = {
          regionId,
          status: 'unhealthy',
          latency: null,
          lastCheck: new Date().toISOString(),
          error: error.message,
          healthy: false
        };
        
        this.regionHealth.set(regionId, health);
        return health;
      }
    });

    const results = await Promise.allSettled(healthPromises);
    const healthyRegions = results
      .filter(result => result.status === 'fulfilled' && result.value.healthy)
      .length;
    
    console.log(`🌍 Health check complete: ${healthyRegions}/${Object.keys(REGIONS).length} regions healthy`);
    
    // Log unhealthy regions
    results.forEach(result => {
      if (result.status === 'fulfilled' && !result.value.healthy) {
        console.warn(`⚠️ Region ${result.value.regionId} is unhealthy:`, result.value);
      }
    });
  }

  /**
   * Update latency cache with rolling average
   */
  updateLatencyCache(regionId, latency) {
    if (!this.latencyCache.has(regionId)) {
      this.latencyCache.set(regionId, []);
    }
    
    const latencies = this.latencyCache.get(regionId);
    latencies.push(latency);
    
    // Keep only last 10 measurements
    if (latencies.length > 10) {
      latencies.shift();
    }
    
    this.latencyCache.set(regionId, latencies);
  }

  /**
   * Get average latency for a region
   */
  getAverageLatency(regionId) {
    const latencies = this.latencyCache.get(regionId) || [];
    if (latencies.length === 0) return null;
    
    return latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
  }

  /**
   * Determine best region for a request based on geography and health
   */
  getBestRegion(clientIP = null, userCountry = null) {
    // Get healthy regions
    const healthyRegions = Array.from(this.regionHealth.entries())
      .filter(([_, health]) => health.healthy)
      .map(([regionId]) => regionId);
    
    if (healthyRegions.length === 0) {
      console.warn('⚠️ No healthy regions available, using current region');
      return this.currentRegion;
    }

    // If we have geographic information, prefer nearby regions
    if (userCountry && GEO_REGIONS[userCountry]) {
      const preferredRegions = GEO_REGIONS[userCountry]
        .filter(regionId => healthyRegions.includes(regionId));
      
      if (preferredRegions.length > 0) {
        // Among preferred regions, choose the one with lowest latency
        return this.selectByLatency(preferredRegions);
      }
    }

    // Fallback to lowest latency among all healthy regions
    return this.selectByLatency(healthyRegions);
  }

  /**
   * Select region with lowest average latency
   */
  selectByLatency(regionIds) {
    let bestRegion = regionIds[0];
    let bestLatency = Infinity;
    
    regionIds.forEach(regionId => {
      const avgLatency = this.getAverageLatency(regionId);
      if (avgLatency && avgLatency < bestLatency) {
        bestLatency = avgLatency;
        bestRegion = regionId;
      }
    });
    
    return bestRegion;
  }

  /**
   * Execute request with automatic failover
   */
  async executeWithFailover(endpoint, options = {}, maxRetries = 3) {
    const preferredRegion = this.getBestRegion(options.clientIP, options.userCountry);
    let attempts = 0;
    let lastError = null;
    
    // Try preferred region first, then failover to other healthy regions
    const regionOrder = [preferredRegion, ...this.getFailoverRegions(preferredRegion)];
    
    for (const regionId of regionOrder) {
      if (attempts >= maxRetries) break;
      
      const regionConfig = REGIONS[regionId];
      if (!regionConfig) continue;
      
      const health = this.regionHealth.get(regionId);
      if (!health || !health.healthy) continue;
      
      try {
        attempts++;
        console.log(`🌍 Attempting request to ${regionId} (attempt ${attempts})`);
        
        const startTime = performance.now();
        const response = await axios({
          ...options,
          url: `${regionConfig.endpoint}${endpoint}`,
          timeout: options.timeout || 30000,
          headers: {
            ...options.headers,
            'X-Region': regionId,
            'X-Attempt': attempts.toString()
          }
        });
        
        const duration = performance.now() - startTime;
        
        // Log successful request
        console.log(`✅ Request successful via ${regionId} in ${Math.round(duration)}ms`);
        
        // Update latency cache
        this.updateLatencyCache(regionId, duration);
        
        return {
          data: response.data,
          region: regionId,
          latency: Math.round(duration),
          attempts,
          status: response.status
        };
        
      } catch (error) {
        lastError = error;
        console.warn(`❌ Request failed for ${regionId}:`, error.message);
        
        // Mark region as potentially unhealthy if it's a server error
        if (error.response && error.response.status >= 500) {
          const health = this.regionHealth.get(regionId);
          if (health) {
            health.healthy = false;
            health.lastError = error.message;
            this.regionHealth.set(regionId, health);
          }
        }
        
        // Record failover attempt
        this.failoverHistory.push({
          timestamp: new Date().toISOString(),
          fromRegion: regionId,
          error: error.message,
          attempt: attempts
        });
        
        // Keep only last 100 failover records
        if (this.failoverHistory.length > 100) {
          this.failoverHistory.shift();
        }
      }
    }
    
    // All regions failed
    throw new Error(`All regions failed after ${attempts} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Get failover regions in order of preference
   */
  getFailoverRegions(excludeRegion) {
    return Object.keys(REGIONS)
      .filter(regionId => regionId !== excludeRegion)
      .filter(regionId => {
        const health = this.regionHealth.get(regionId);
        return health && health.healthy;
      })
      .sort((a, b) => {
        const latencyA = this.getAverageLatency(a) || Infinity;
        const latencyB = this.getAverageLatency(b) || Infinity;
        return latencyA - latencyB;
      });
  }

  /**
   * Get comprehensive region status
   */
  getRegionStatus() {
    const status = {
      currentRegion: this.currentRegion,
      totalRegions: Object.keys(REGIONS).length,
      healthyRegions: 0,
      unhealthyRegions: 0,
      regions: {},
      lastUpdate: new Date().toISOString()
    };

    this.regionHealth.forEach((health, regionId) => {
      const config = REGIONS[regionId];
      const avgLatency = this.getAverageLatency(regionId);
      
      status.regions[regionId] = {
        ...health,
        name: config.name,
        endpoint: config.endpoint,
        averageLatency: avgLatency ? Math.round(avgLatency) : null,
        priority: config.priority,
        timezone: config.timezone
      };
      
      if (health.healthy) {
        status.healthyRegions++;
      } else {
        status.unhealthyRegions++;
      }
    });

    return status;
  }

  /**
   * Get failover statistics
   */
  getFailoverStats() {
    const now = Date.now();
    const last24h = this.failoverHistory.filter(
      record => now - new Date(record.timestamp).getTime() < 24 * 60 * 60 * 1000
    );
    
    const regionFailures = {};
    last24h.forEach(record => {
      regionFailures[record.fromRegion] = (regionFailures[record.fromRegion] || 0) + 1;
    });
    
    return {
      totalFailovers: this.failoverHistory.length,
      last24Hours: last24h.length,
      regionFailures,
      recentFailovers: this.failoverHistory.slice(-10)
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    console.log('🌍 Multi-region manager destroyed');
  }
}

// Export singleton instance
const multiRegionManager = new MultiRegionManager();

// Graceful shutdown
process.on('SIGTERM', () => {
  multiRegionManager.destroy();
});

process.on('SIGINT', () => {
  multiRegionManager.destroy();
});

export default multiRegionManager;
export { MultiRegionManager, REGIONS, GEO_REGIONS };
