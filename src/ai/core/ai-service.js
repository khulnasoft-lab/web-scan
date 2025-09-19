/**
 * Core AI Service - Base class for all AI-powered features
 * Provides common functionality for AI models and analysis
 */

import { EventEmitter } from 'events';

class AIService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      confidenceThreshold: options.confidenceThreshold || 0.8,
      enableLearning: options.enableLearning || false,
      modelPath: options.modelPath || './models/',
      maxCacheSize: options.maxCacheSize || 1000,
      ...options
    };
    
    this.cache = new Map();
    this.models = new Map();
    this.isInitialized = false;
    this.stats = {
      totalAnalyses: 0,
      successfulAnalyses: 0,
      averageConfidence: 0,
      lastAnalysis: null
    };
  }

  /**
   * Initialize the AI service
   */
  async initialize() {
    try {
      console.log('🤖 Initializing AI Service...');
      
      // Load configuration
      await this.loadConfiguration();
      
      // Initialize models
      await this.initializeModels();
      
      // Set up cache cleanup
      this.setupCacheCleanup();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ AI Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Load AI configuration from environment
   */
  async loadConfiguration() {
    this.config = {
      ...this.config,
      confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || this.config.confidenceThreshold,
      enableLearning: process.env.AI_ENABLE_LEARNING === 'true',
      modelPath: process.env.AI_MODEL_PATH || this.config.modelPath,
    };
  }

  /**
   * Initialize AI models (to be overridden by subclasses)
   */
  async initializeModels() {
    // Base implementation - subclasses should override
    console.log('📊 Base AI models initialized');
  }

  /**
   * Analyze data using AI models
   * @param {Object} data - Data to analyze
   * @param {string} analysisType - Type of analysis to perform
   * @returns {Promise<Object>} Analysis results
   */
  async analyze(data, analysisType = 'general') {
    if (!this.isInitialized) {
      throw new Error('AI Service not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(data, analysisType);
    
    try {
      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cachedResult = this.cache.get(cacheKey);
        console.log(`📋 Cache hit for ${analysisType} analysis`);
        return cachedResult;
      }

      // Perform analysis
      const result = await this.performAnalysis(data, analysisType);
      
      // Add metadata
      result.metadata = {
        analysisType,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        confidence: result.confidence || 0,
        cached: false
      };

      // Cache result if confidence is high enough
      if (result.confidence >= this.config.confidenceThreshold) {
        this.cacheResult(cacheKey, result);
      }

      // Update statistics
      this.updateStats(result);

      this.emit('analysisComplete', result);
      return result;

    } catch (error) {
      console.error(`❌ AI Analysis failed for ${analysisType}:`, error);
      this.emit('analysisError', { error, analysisType, data });
      throw error;
    }
  }

  /**
   * Perform the actual analysis (to be overridden by subclasses)
   * @param {Object} data - Data to analyze
   * @param {string} analysisType - Type of analysis
   * @returns {Promise<Object>} Analysis results
   */
  async performAnalysis(data, analysisType) {
    // Base implementation - subclasses should override
    return {
      result: 'Base analysis completed',
      confidence: 0.5,
      recommendations: [],
      insights: []
    };
  }

  /**
   * Generate cache key for data and analysis type
   * @param {Object} data - Data to analyze
   * @param {string} analysisType - Analysis type
   * @returns {string} Cache key
   */
  generateCacheKey(data, analysisType) {
    const dataHash = this.hashObject(data);
    return `${analysisType}_${dataHash}`;
  }

  /**
   * Simple hash function for objects
   * @param {Object} obj - Object to hash
   * @returns {string} Hash string
   */
  hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache analysis result
   * @param {string} key - Cache key
   * @param {Object} result - Result to cache
   */
  cacheResult(key, result) {
    // Implement LRU cache behavior
    if (this.cache.size >= this.config.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    result.metadata.cached = true;
    this.cache.set(key, result);
  }

  /**
   * Update service statistics
   * @param {Object} result - Analysis result
   */
  updateStats(result) {
    this.stats.totalAnalyses++;
    if (result.confidence >= this.config.confidenceThreshold) {
      this.stats.successfulAnalyses++;
    }
    
    // Update average confidence
    const totalConfidence = this.stats.averageConfidence * (this.stats.totalAnalyses - 1) + result.confidence;
    this.stats.averageConfidence = totalConfidence / this.stats.totalAnalyses;
    
    this.stats.lastAnalysis = new Date().toISOString();
  }

  /**
   * Set up periodic cache cleanup
   */
  setupCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 30 * 60 * 1000; // 30 minutes
      
      for (const [key, result] of this.cache.entries()) {
        const resultAge = now - new Date(result.metadata.timestamp).getTime();
        if (resultAge > maxAge) {
          this.cache.delete(key);
        }
      }
    }, 10 * 60 * 1000); // Run every 10 minutes
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      modelsLoaded: this.models.size,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ AI Service cache cleared');
  }

  /**
   * Shutdown the AI service
   */
  async shutdown() {
    console.log('🔄 Shutting down AI Service...');
    this.clearCache();
    this.models.clear();
    this.isInitialized = false;
    this.emit('shutdown');
    console.log('✅ AI Service shutdown complete');
  }
}

export default AIService;
