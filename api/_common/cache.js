/**
 * API Response Caching System
 * Provides intelligent caching for Web-Scan API responses
 */

import NodeCache from 'node-cache';
import crypto from 'crypto';

// Cache configurations for different endpoint types
const cacheConfigs = {
  // DNS records - cache for 1 hour (DNS changes infrequently)
  dns: { ttl: 3600, checkperiod: 600 },
  
  // SSL/TLS certificates - cache for 6 hours (certificates change rarely)
  ssl: { ttl: 21600, checkperiod: 3600 },
  tls: { ttl: 21600, checkperiod: 3600 },
  
  // Security headers - cache for 30 minutes (can change with deployments)
  headers: { ttl: 1800, checkperiod: 300 },
  security: { ttl: 1800, checkperiod: 300 },
  
  // Network diagnostics - cache for 15 minutes (network conditions change)
  ports: { ttl: 900, checkperiod: 180 },
  network: { ttl: 900, checkperiod: 180 },
  
  // AI analysis - cache for 2 hours (computationally expensive)
  ai: { ttl: 7200, checkperiod: 1200 },
  
  // General endpoints - cache for 30 minutes
  general: { ttl: 1800, checkperiod: 300 }
};

// Create cache instances for different categories
const caches = {};
Object.keys(cacheConfigs).forEach(category => {
  caches[category] = new NodeCache(cacheConfigs[category]);
});

/**
 * Generate a cache key from URL and additional parameters
 */
const generateCacheKey = (url, params = {}) => {
  const data = { url, ...params };
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
};

/**
 * Determine cache category from route path
 */
const getCacheCategory = (route) => {
  if (route.includes('/ai')) return 'ai';
  if (route.includes('/dns')) return 'dns';
  if (route.includes('/ssl') || route.includes('/tls')) return 'ssl';
  if (route.includes('/headers') || route.includes('/security')) return 'security';
  if (route.includes('/ports') || route.includes('/network')) return 'network';
  return 'general';
};

/**
 * Cache middleware factory
 */
export const createCacheMiddleware = (options = {}) => {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if disabled
    if (process.env.DISABLE_CACHE === 'true') {
      return next();
    }

    const route = req.route?.path || req.path;
    const category = options.category || getCacheCategory(route);
    const cache = caches[category];
    
    // Generate cache key
    const cacheKey = generateCacheKey(req.query.url || req.url, {
      query: req.query,
      route: route
    });

    // Try to get from cache
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      console.log(`💾 Cache HIT for ${route} (${category})`);
      
      // Add cache headers
      res.set({
        'X-Cache': 'HIT',
        'X-Cache-Category': category,
        'X-Cache-TTL': cacheConfigs[category].ttl
      });
      
      return res.json(cachedResponse);
    }

    console.log(`🔄 Cache MISS for ${route} (${category})`);

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode === 200 && data && !data.error) {
        cache.set(cacheKey, data);
        console.log(`💾 Cached response for ${route} (${category})`);
      }

      // Add cache headers
      res.set({
        'X-Cache': 'MISS',
        'X-Cache-Category': category,
        'X-Cache-TTL': cacheConfigs[category].ttl
      });

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Cache statistics
 */
export const getCacheStats = () => {
  const stats = {};
  
  Object.keys(caches).forEach(category => {
    const cache = caches[category];
    stats[category] = {
      keys: cache.keys().length,
      hits: cache.getStats().hits,
      misses: cache.getStats().misses,
      hitRate: cache.getStats().hits / (cache.getStats().hits + cache.getStats().misses) || 0,
      ttl: cacheConfigs[category].ttl
    };
  });

  return stats;
};

/**
 * Clear cache for specific category or all
 */
export const clearCache = (category = null) => {
  if (category && caches[category]) {
    const keysCleared = caches[category].keys().length;
    caches[category].flushAll();
    console.log(`🗑️ Cleared ${keysCleared} keys from ${category} cache`);
    return { category, keysCleared };
  } else {
    const totalCleared = {};
    Object.keys(caches).forEach(cat => {
      totalCleared[cat] = caches[cat].keys().length;
      caches[cat].flushAll();
    });
    console.log('🗑️ Cleared all caches:', totalCleared);
    return totalCleared;
  }
};

/**
 * Cache warming for common endpoints
 */
export const warmCache = async (commonUrls = ['example.com', 'google.com']) => {
  console.log('🔥 Starting cache warming...');
  
  const warmingPromises = [];
  const endpoints = ['/api/dns', '/api/security/ssl', '/api/security/headers'];
  
  commonUrls.forEach(url => {
    endpoints.forEach(endpoint => {
      const warmUrl = `http://localhost:${process.env.PORT || 3001}${endpoint}?url=${url}`;
      warmingPromises.push(
        fetch(warmUrl).catch(err => console.warn(`Cache warming failed for ${warmUrl}:`, err.message))
      );
    });
  });

  await Promise.allSettled(warmingPromises);
  console.log('🔥 Cache warming completed');
};

// Cache event listeners
Object.keys(caches).forEach(category => {
  const cache = caches[category];
  
  cache.on('set', (key, value) => {
    console.log(`💾 Cache SET: ${category}/${key.substring(0, 8)}...`);
  });
  
  cache.on('expired', (key, value) => {
    console.log(`⏰ Cache EXPIRED: ${category}/${key.substring(0, 8)}...`);
  });
});

export default {
  createCacheMiddleware,
  getCacheStats,
  clearCache,
  warmCache,
  caches
};
