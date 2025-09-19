import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 1 hour default TTL
  }

  async connect() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
      return true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  // Basic cache operations
  async get(key) {
    if (!this.isConnected) {
      console.warn('Redis not connected, returning null');
      return null;
    }
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping SET operation');
      return false;
    }
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl > 0) {
        await this.client.setEx(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping DEL operation');
      return false;
    }
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected) {
      return false;
    }
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  // Advanced cache operations
  async mget(keys) {
    if (!this.isConnected) {
      return keys.map(() => null);
    }
    try {
      const values = await this.client.mGet(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Redis MGET error:', error);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs, ttl = this.defaultTTL) {
    if (!this.isConnected) {
      return false;
    }
    try {
      const pipeline = this.client.multi();
      
      for (const [key, value] of keyValuePairs) {
        const serializedValue = JSON.stringify(value);
        if (ttl > 0) {
          pipeline.setEx(key, ttl, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Redis MSET error:', error);
      return false;
    }
  }

  // Cache with pattern matching
  async keys(pattern = '*') {
    if (!this.isConnected) {
      return [];
    }
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Redis KEYS error:', error);
      return [];
    }
  }

  async deletePattern(pattern) {
    if (!this.isConnected) {
      return 0;
    }
    try {
      const keysToDelete = await this.keys(pattern);
      if (keysToDelete.length === 0) {
        return 0;
      }
      const deleted = await this.client.del(keysToDelete);
      return deleted;
    } catch (error) {
      console.error('Redis DELETE PATTERN error:', error);
      return 0;
    }
  }

  // Cache statistics
  async getInfo() {
    if (!this.isConnected) {
      return null;
    }
    try {
      return await this.client.info();
    } catch (error) {
      console.error('Redis INFO error:', error);
      return null;
    }
  }

  async getMemoryUsage() {
    if (!this.isConnected) {
      return null;
    }
    try {
      const info = await this.client.info('memory');
      const lines = info.split('\n');
      const memoryInfo = {};
      
      for (const line of lines) {
        if (line.startsWith('used_memory:')) {
          memoryInfo.used_memory = line.split(':')[1].trim();
        } else if (line.startsWith('used_memory_peak:')) {
          memoryInfo.used_memory_peak = line.split(':')[1].trim();
        } else if (line.startsWith('used_memory_human:')) {
          memoryInfo.used_memory_human = line.split(':')[1].trim();
        }
      }
      
      return memoryInfo;
    } catch (error) {
      console.error('Redis memory usage error:', error);
      return null;
    }
  }

  // Cache utilities
  generateKey(prefix, ...parts) {
    const cleanParts = parts.map(part => 
      String(part).replace(/[^a-zA-Z0-9_-]/g, '_')
    );
    return `${prefix}:${cleanParts.join(':')}`;
  }

  async getOrSet(key, fetchFunction, ttl = this.defaultTTL) {
    // Try to get from cache first
    const cachedValue = await this.get(key);
    if (cachedValue !== null) {
      return cachedValue;
    }

    // If not in cache, fetch the value
    try {
      const value = await fetchFunction();
      
      // Set in cache for future requests
      await this.set(key, value, ttl);
      
      return value;
    } catch (error) {
      console.error('Error in getOrSet fetch function:', error);
      throw error;
    }
  }

  // Scan result caching
  async cacheScanResult(scanId, endpointName, result, ttl = 1800) {
    // 30 minutes TTL for scan results
    const key = this.generateKey('scan', scanId, endpointName);
    return await this.set(key, result, ttl);
  }

  async getScanResult(scanId, endpointName) {
    const key = this.generateKey('scan', scanId, endpointName);
    return await this.get(key);
  }

  async invalidateScanResults(scanId) {
    const pattern = this.generateKey('scan', scanId, '*');
    return await this.deletePattern(pattern);
  }

  // API response caching
  async cacheApiResponse(url, response, ttl = 600) {
    // 10 minutes TTL for API responses
    const key = this.generateKey('api', url);
    return await this.set(key, response, ttl);
  }

  async getApiResponse(url) {
    const key = this.generateKey('api', url);
    return await this.get(key);
  }

  // User session caching
  async cacheUserSession(userId, sessionData, ttl = 86400) {
    // 24 hours TTL for user sessions
    const key = this.generateKey('session', userId);
    return await this.set(key, sessionData, ttl);
  }

  async getUserSession(userId) {
    const key = this.generateKey('session', userId);
    return await this.get(key);
  }

  async invalidateUserSession(userId) {
    const key = this.generateKey('session', userId);
    return await this.del(key);
  }

  // Monitoring data caching
  async cacheMonitoringData(configId, data, ttl = 300) {
    // 5 minutes TTL for monitoring data
    const key = this.generateKey('monitoring', configId);
    return await this.set(key, data, ttl);
  }

  async getMonitoringData(configId) {
    const key = this.generateKey('monitoring', configId);
    return await this.get(key);
  }

  // Rate limiting
  async checkRateLimit(key, limit, windowSeconds) {
    const rateKey = this.generateKey('rate_limit', key);
    const windowKey = this.generateKey('rate_window', key);
    
    try {
      const pipeline = this.client.multi();
      
      // Increment the counter
      pipeline.incr(rateKey);
      
      // Set expiration if it's a new window
      pipeline.expire(rateKey, windowSeconds);
      
      // Get current count
      pipeline.get(rateKey);
      
      const results = await pipeline.exec();
      const currentCount = parseInt(results[2][1]);
      
      return {
        allowed: currentCount <= limit,
        currentCount,
        limit,
        resetTime: windowSeconds
      };
    } catch (error) {
      console.error('Rate limiting error:', error);
      return { allowed: true, currentCount: 0, limit, resetTime: windowSeconds };
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', message: 'Redis client is not connected' };
      }
      
      const ping = await this.client.ping();
      if (ping === 'PONG') {
        const memory = await this.getMemoryUsage();
        return {
          status: 'healthy',
          message: 'Redis connection is healthy',
          memory
        };
      } else {
        return { status: 'unhealthy', message: 'Redis ping failed' };
      }
    } catch (error) {
      return { status: 'error', message: `Redis health check failed: ${error.message}` };
    }
  }
}

// Export singleton instance
const redisClient = new RedisClient();

export default redisClient;

// Export utility functions for convenience
export const cacheKeys = {
  scan: (scanId, endpoint) => `scan:${scanId}:${endpoint}`,
  api: (url) => `api:${url}`,
  session: (userId) => `session:${userId}`,
  monitoring: (configId) => `monitoring:${configId}`,
  rateLimit: (key) => `rate_limit:${key}`,
  user: (userId) => `user:${userId}`,
  organization: (orgId) => `organization:${orgId}`,
};
