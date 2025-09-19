/**
 * ML-Based Performance Predictor
 * Uses machine learning to predict API performance and detect anomalies
 */

import { Matrix } from 'ml-matrix';
import { SimpleLinearRegression, MultivariateLinearRegression } from 'ml-regression';
import { KMeans } from 'ml-kmeans';
import { getMetrics } from '../../api/_common/metrics.js';

class MLPerformancePredictor {
  constructor() {
    this.models = {
      responseTimePredictor: null,
      anomalyDetector: null,
      loadPredictor: null,
      errorRatePredictor: null
    };
    
    this.trainingData = {
      responseTime: [],
      requestVolume: [],
      errorRate: [],
      systemMetrics: [],
      timestamps: []
    };
    
    this.isInitialized = false;
    this.predictionHistory = [];
    this.anomalies = [];
  }

  /**
   * Initialize the ML predictor with historical data
   */
  async initialize() {
    console.log('🤖 Initializing ML Performance Predictor...');
    
    try {
      // Generate synthetic historical data for training
      await this.generateTrainingData();
      
      // Train all models
      await this.trainModels();
      
      this.isInitialized = true;
      console.log('✅ ML Performance Predictor initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize ML Performance Predictor:', error);
      return false;
    }
  }

  /**
   * Generate synthetic training data based on realistic patterns
   */
  async generateTrainingData() {
    console.log('📊 Generating training data...');
    
    const now = Date.now();
    const hoursOfData = 168; // 1 week of hourly data
    
    for (let i = hoursOfData; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000);
      const hour = new Date(timestamp).getHours();
      const dayOfWeek = new Date(timestamp).getDay();
      
      // Simulate realistic patterns
      const baseLoad = this.simulateLoadPattern(hour, dayOfWeek);
      const responseTime = this.simulateResponseTime(baseLoad, hour);
      const errorRate = this.simulateErrorRate(baseLoad, responseTime);
      
      this.trainingData.timestamps.push(timestamp);
      this.trainingData.requestVolume.push(baseLoad);
      this.trainingData.responseTime.push(responseTime);
      this.trainingData.errorRate.push(errorRate);
      this.trainingData.systemMetrics.push([
        baseLoad,
        responseTime,
        errorRate,
        hour,
        dayOfWeek,
        Math.random() * 100 // CPU usage simulation
      ]);
    }
    
    console.log(`📈 Generated ${this.trainingData.timestamps.length} training samples`);
  }

  /**
   * Simulate realistic load patterns
   */
  simulateLoadPattern(hour, dayOfWeek) {
    // Business hours pattern (9 AM - 6 PM higher load)
    let baseLoad = 10;
    
    if (hour >= 9 && hour <= 18) {
      baseLoad = 50 + Math.random() * 30;
    } else if (hour >= 19 && hour <= 23) {
      baseLoad = 20 + Math.random() * 15;
    } else {
      baseLoad = 5 + Math.random() * 10;
    }
    
    // Weekend reduction
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseLoad *= 0.6;
    }
    
    // Add some noise
    baseLoad += (Math.random() - 0.5) * 10;
    
    return Math.max(1, baseLoad);
  }

  /**
   * Simulate response time based on load
   */
  simulateResponseTime(load, hour) {
    let baseResponseTime = 200; // Base 200ms
    
    // Response time increases with load
    baseResponseTime += load * 2;
    
    // Peak hours have higher response times
    if (hour >= 9 && hour <= 18) {
      baseResponseTime *= 1.3;
    }
    
    // Add random spikes
    if (Math.random() < 0.05) {
      baseResponseTime *= 3; // 5% chance of slow response
    }
    
    // Add noise
    baseResponseTime += (Math.random() - 0.5) * 50;
    
    return Math.max(50, baseResponseTime);
  }

  /**
   * Simulate error rate based on load and response time
   */
  simulateErrorRate(load, responseTime) {
    let errorRate = 0.5; // Base 0.5% error rate
    
    // Higher load increases error rate
    if (load > 60) {
      errorRate += (load - 60) * 0.1;
    }
    
    // Slow responses correlate with errors
    if (responseTime > 1000) {
      errorRate += (responseTime - 1000) * 0.001;
    }
    
    // Random error spikes
    if (Math.random() < 0.02) {
      errorRate += Math.random() * 5; // 2% chance of error spike
    }
    
    return Math.max(0, Math.min(20, errorRate)); // Cap at 20%
  }

  /**
   * Train all ML models
   */
  async trainModels() {
    console.log('🎓 Training ML models...');
    
    try {
      // Train response time predictor
      await this.trainResponseTimePredictor();
      
      // Train anomaly detector
      await this.trainAnomalyDetector();
      
      // Train load predictor
      await this.trainLoadPredictor();
      
      // Train error rate predictor
      await this.trainErrorRatePredictor();
      
      console.log('✅ All ML models trained successfully');
    } catch (error) {
      console.error('❌ Failed to train ML models:', error);
      throw error;
    }
  }

  /**
   * Train response time prediction model
   */
  async trainResponseTimePredictor() {
    const features = this.trainingData.systemMetrics.map(metrics => [
      metrics[0], // request volume
      metrics[3], // hour
      metrics[4], // day of week
      metrics[5]  // CPU usage
    ]);
    
    const targets = this.trainingData.responseTime;
    
    this.models.responseTimePredictor = new MultivariateLinearRegression(features, targets);
    console.log('📈 Response time predictor trained');
  }

  /**
   * Train anomaly detection model using K-Means clustering
   */
  async trainAnomalyDetector() {
    const data = this.trainingData.systemMetrics;
    const matrix = new Matrix(data);
    
    // Use K-Means with 3 clusters (normal, warning, critical)
    this.models.anomalyDetector = new KMeans(matrix, 3);
    console.log('🔍 Anomaly detector trained');
  }

  /**
   * Train load prediction model
   */
  async trainLoadPredictor() {
    const timeFeatures = this.trainingData.timestamps.map(timestamp => {
      const date = new Date(timestamp);
      return [
        date.getHours(),
        date.getDay(),
        date.getDate(),
        Math.sin(2 * Math.PI * date.getHours() / 24), // Cyclical hour
        Math.cos(2 * Math.PI * date.getHours() / 24)
      ];
    });
    
    const targets = this.trainingData.requestVolume;
    
    this.models.loadPredictor = new MultivariateLinearRegression(timeFeatures, targets);
    console.log('📊 Load predictor trained');
  }

  /**
   * Train error rate prediction model
   */
  async trainErrorRatePredictor() {
    const features = this.trainingData.systemMetrics.map(metrics => [
      metrics[0], // request volume
      metrics[1], // response time
      metrics[5]  // CPU usage
    ]);
    
    const targets = this.trainingData.errorRate;
    
    this.models.errorRatePredictor = new MultivariateLinearRegression(features, targets);
    console.log('📉 Error rate predictor trained');
  }

  /**
   * Make performance predictions
   */
  async makePredictions() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const currentMetrics = getMetrics();
    const now = new Date();
    
    try {
      // Predict next hour's performance
      const predictions = {
        timestamp: new Date().toISOString(),
        nextHour: {
          responseTime: this.predictResponseTime(currentMetrics, now),
          requestVolume: this.predictRequestVolume(now),
          errorRate: this.predictErrorRate(currentMetrics),
          anomalyScore: this.detectAnomalies(currentMetrics)
        },
        next24Hours: this.predict24HourTrend(now),
        recommendations: this.generateRecommendations(currentMetrics)
      };
      
      // Store prediction history
      this.predictionHistory.push(predictions);
      if (this.predictionHistory.length > 100) {
        this.predictionHistory.shift();
      }
      
      return predictions;
    } catch (error) {
      console.error('❌ Failed to make predictions:', error);
      return null;
    }
  }

  /**
   * Predict response time for next hour
   */
  predictResponseTime(currentMetrics, timestamp) {
    if (!this.models.responseTimePredictor) return null;
    
    const features = [
      currentMetrics.requests.total || 50,
      timestamp.getHours(),
      timestamp.getDay(),
      Math.random() * 100 // Simulated CPU usage
    ];
    
    const prediction = this.models.responseTimePredictor.predict(features);
    return Math.max(50, prediction);
  }

  /**
   * Predict request volume
   */
  predictRequestVolume(timestamp) {
    if (!this.models.loadPredictor) return null;
    
    const nextHour = new Date(timestamp.getTime() + 60 * 60 * 1000);
    const features = [
      nextHour.getHours(),
      nextHour.getDay(),
      nextHour.getDate(),
      Math.sin(2 * Math.PI * nextHour.getHours() / 24),
      Math.cos(2 * Math.PI * nextHour.getHours() / 24)
    ];
    
    const prediction = this.models.loadPredictor.predict(features);
    return Math.max(1, prediction);
  }

  /**
   * Predict error rate
   */
  predictErrorRate(currentMetrics) {
    if (!this.models.errorRatePredictor) return null;
    
    const features = [
      currentMetrics.requests.total || 50,
      currentMetrics.performance.responseTime.average || 500,
      Math.random() * 100 // Simulated CPU usage
    ];
    
    const prediction = this.models.errorRatePredictor.predict(features);
    return Math.max(0, Math.min(20, prediction));
  }

  /**
   * Detect anomalies in current metrics
   */
  detectAnomalies(currentMetrics) {
    if (!this.models.anomalyDetector) return 0;
    
    const currentData = [
      currentMetrics.requests.total || 50,
      currentMetrics.performance.responseTime.average || 500,
      (currentMetrics.errors.total / currentMetrics.requests.total) * 100 || 1,
      new Date().getHours(),
      new Date().getDay(),
      Math.random() * 100 // Simulated CPU usage
    ];
    
    const cluster = this.models.anomalyDetector.nearest(currentData);
    
    // Calculate anomaly score based on distance to cluster center
    const center = this.models.anomalyDetector.centroids[cluster.index];
    const distance = Math.sqrt(
      currentData.reduce((sum, val, i) => sum + Math.pow(val - center[i], 2), 0)
    );
    
    // Normalize to 0-1 scale
    const anomalyScore = Math.min(1, distance / 1000);
    
    if (anomalyScore > 0.7) {
      this.anomalies.push({
        timestamp: new Date().toISOString(),
        score: anomalyScore,
        metrics: currentData,
        severity: anomalyScore > 0.9 ? 'critical' : 'warning'
      });
      
      // Keep only recent anomalies
      if (this.anomalies.length > 50) {
        this.anomalies.shift();
      }
    }
    
    return anomalyScore;
  }

  /**
   * Predict 24-hour performance trend
   */
  predict24HourTrend(startTime) {
    const trend = [];
    
    for (let i = 1; i <= 24; i++) {
      const futureTime = new Date(startTime.getTime() + i * 60 * 60 * 1000);
      
      trend.push({
        hour: i,
        timestamp: futureTime.toISOString(),
        predictedLoad: this.predictRequestVolume(futureTime),
        predictedResponseTime: this.predictResponseTime({requests: {total: 50}}, futureTime),
        confidence: Math.max(0.5, 1 - (i * 0.02)) // Confidence decreases over time
      });
    }
    
    return trend;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(currentMetrics) {
    const recommendations = [];
    
    const avgResponseTime = currentMetrics.performance.responseTime.average || 500;
    const errorRate = (currentMetrics.errors.total / currentMetrics.requests.total) * 100 || 1;
    const requestRate = currentMetrics.requests.total || 50;
    
    // Response time recommendations
    if (avgResponseTime > 2000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Response times are critically high. Consider scaling up resources.',
        action: 'scale_up',
        impact: 'high'
      });
    } else if (avgResponseTime > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Response times are elevated. Monitor cache hit rates and optimize slow endpoints.',
        action: 'optimize_cache',
        impact: 'medium'
      });
    }
    
    // Error rate recommendations
    if (errorRate > 5) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: 'Error rate is high. Check logs and investigate failing endpoints.',
        action: 'investigate_errors',
        impact: 'high'
      });
    }
    
    // Load recommendations
    if (requestRate > 100) {
      recommendations.push({
        type: 'capacity',
        priority: 'medium',
        message: 'Request volume is high. Consider implementing additional rate limiting.',
        action: 'adjust_rate_limits',
        impact: 'medium'
      });
    }
    
    // Proactive recommendations
    const futureLoad = this.predictRequestVolume(new Date(Date.now() + 60 * 60 * 1000));
    if (futureLoad > requestRate * 1.5) {
      recommendations.push({
        type: 'proactive',
        priority: 'medium',
        message: 'Predicted load increase in the next hour. Consider pre-warming caches.',
        action: 'prewarm_cache',
        impact: 'medium'
      });
    }
    
    return recommendations;
  }

  /**
   * Get prediction accuracy metrics
   */
  getAccuracyMetrics() {
    if (this.predictionHistory.length < 2) {
      return null;
    }
    
    // Calculate accuracy for recent predictions
    const recentPredictions = this.predictionHistory.slice(-10);
    const currentMetrics = getMetrics();
    
    return {
      responseTimeAccuracy: this.calculateAccuracy(
        recentPredictions.map(p => p.nextHour.responseTime),
        currentMetrics.performance.responseTime.average
      ),
      errorRateAccuracy: this.calculateAccuracy(
        recentPredictions.map(p => p.nextHour.errorRate),
        (currentMetrics.errors.total / currentMetrics.requests.total) * 100
      ),
      totalPredictions: this.predictionHistory.length,
      anomaliesDetected: this.anomalies.length
    };
  }

  /**
   * Calculate prediction accuracy
   */
  calculateAccuracy(predictions, actual) {
    if (predictions.length === 0) return 0;
    
    const errors = predictions.map(pred => Math.abs(pred - actual) / actual);
    const meanError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
    
    return Math.max(0, 1 - meanError); // Convert to accuracy (0-1)
  }
}

// Export singleton instance
const mlPredictor = new MLPerformancePredictor();

export default mlPredictor;
export { MLPerformancePredictor };
