/**
 * Monitoring AI Analyzer
 * Specialized AI analyzer for monitoring data and predictive analytics
 */

import AIService from '../core/ai-service.js';

class MonitoringAIAnalyzer extends AIService {
  constructor(options = {}) {
    super(options);
    this.name = 'MonitoringAIAnalyzer';
    this.version = '1.0.0';
    
    // Monitoring-specific thresholds and patterns
    this.thresholds = {
      responseTime: {
        good: 500,
        warning: 1000,
        critical: 3000
      },
      uptime: {
        excellent: 99.9,
        good: 99.0,
        warning: 95.0
      },
      errorRate: {
        good: 0.01,
        warning: 0.05,
        critical: 0.1
      }
    };

    // Pattern detection for anomalies
    this.patterns = {
      spikes: [],
      trends: [],
      anomalies: []
    };
  }

  /**
   * Analyze monitoring data for insights and predictions
   * @param {Object} data - Monitoring data
   * @param {string} analysisType - Type of analysis
   * @returns {Promise<Object>} Analysis results
   */
  async performAnalysis(data, analysisType = 'monitoring') {
    console.log('🔍 Starting monitoring AI analysis...');

    try {
      const insights = [];
      const predictions = [];
      const recommendations = [];
      let riskScore = 0;

      // Analyze response time patterns
      if (data.responseTimeData) {
        const responseAnalysis = this.analyzeResponseTimes(data.responseTimeData);
        insights.push(...responseAnalysis.insights);
        predictions.push(...responseAnalysis.predictions);
        recommendations.push(...responseAnalysis.recommendations);
        riskScore += responseAnalysis.riskContribution;
      }

      // Analyze uptime patterns
      if (data.uptimeData) {
        const uptimeAnalysis = this.analyzeUptime(data.uptimeData);
        insights.push(...uptimeAnalysis.insights);
        predictions.push(...uptimeAnalysis.predictions);
        recommendations.push(...uptimeAnalysis.recommendations);
        riskScore += uptimeAnalysis.riskContribution;
      }

      // Analyze error patterns
      if (data.errorData) {
        const errorAnalysis = this.analyzeErrors(data.errorData);
        insights.push(...errorAnalysis.insights);
        predictions.push(...errorAnalysis.predictions);
        recommendations.push(...errorAnalysis.recommendations);
        riskScore += errorAnalysis.riskContribution;
      }

      // Detect anomalies
      const anomalies = this.detectAnomalies(data);
      insights.push(...anomalies);

      // Generate trend predictions
      const trendPredictions = this.predictTrends(data);
      predictions.push(...trendPredictions);

      // Calculate confidence based on data quality
      const confidence = this.calculateConfidence(data);

      const result = {
        insights,
        predictions,
        recommendations: this.prioritizeRecommendations(recommendations),
        riskScore: Math.min(riskScore, 10),
        riskLevel: this.getRiskLevel(riskScore),
        confidence,
        anomalies: anomalies.length,
        trends: this.identifyTrends(data),
        healthScore: this.calculateHealthScore(data),
        summary: this.generateSummary(insights, predictions, riskScore)
      };

      console.log(`✅ Monitoring AI analysis complete. Health Score: ${result.healthScore}/10`);
      return result;

    } catch (error) {
      console.error('❌ Monitoring AI analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze response time patterns
   * @param {Array} responseTimeData - Response time data points
   * @returns {Object} Response time analysis
   */
  analyzeResponseTimes(responseTimeData) {
    const insights = [];
    const predictions = [];
    const recommendations = [];
    let riskContribution = 0;

    if (!responseTimeData || responseTimeData.length === 0) {
      return { insights, predictions, recommendations, riskContribution };
    }

    // Calculate statistics
    const times = responseTimeData.map(d => d.response_time || d.responseTime);
    const avgResponseTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxResponseTime = Math.max(...times);
    const recentTimes = times.slice(-10); // Last 10 measurements
    const recentAvg = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;

    // Trend analysis
    const trend = recentAvg > avgResponseTime ? 'increasing' : 'decreasing';
    const trendPercentage = Math.abs((recentAvg - avgResponseTime) / avgResponseTime) * 100;

    // Generate insights
    if (avgResponseTime > this.thresholds.responseTime.critical) {
      insights.push({
        id: 'response_time_critical',
        type: 'performance',
        severity: 'critical',
        title: 'Critical Response Time Issues',
        description: `Average response time (${avgResponseTime.toFixed(0)}ms) exceeds critical threshold`,
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        actionable: true,
        recommendation: 'Immediate performance optimization required'
      });
      riskContribution += 3;
    } else if (avgResponseTime > this.thresholds.responseTime.warning) {
      insights.push({
        id: 'response_time_warning',
        type: 'performance',
        severity: 'medium',
        title: 'Response Time Degradation',
        description: `Response time (${avgResponseTime.toFixed(0)}ms) is above optimal levels`,
        confidence: 0.85,
        timestamp: new Date().toISOString(),
        actionable: true,
        recommendation: 'Consider performance optimization'
      });
      riskContribution += 1.5;
    }

    // Trend insights
    if (trendPercentage > 20) {
      insights.push({
        id: 'response_time_trend',
        type: 'trend',
        severity: trend === 'increasing' ? 'medium' : 'low',
        title: `Response Time ${trend === 'increasing' ? 'Increasing' : 'Improving'}`,
        description: `Response time has ${trend} by ${trendPercentage.toFixed(1)}% recently`,
        confidence: 0.80,
        timestamp: new Date().toISOString(),
        actionable: trend === 'increasing',
        recommendation: trend === 'increasing' ? 'Monitor and investigate performance degradation' : 'Good performance trend'
      });
    }

    // Predictions
    if (trend === 'increasing' && trendPercentage > 15) {
      predictions.push({
        type: 'performance',
        prediction: 'Response time may continue to increase',
        confidence: 0.75,
        timeframe: '24-48 hours',
        impact: 'medium',
        recommendation: 'Proactive performance monitoring recommended'
      });
    }

    // Recommendations
    if (avgResponseTime > this.thresholds.responseTime.good) {
      recommendations.push({
        priority: avgResponseTime > this.thresholds.responseTime.critical ? 5 : 3,
        action: 'Optimize server performance and database queries',
        component: 'Performance',
        estimatedImpact: 'High',
        effort: 'Medium'
      });
    }

    return { insights, predictions, recommendations, riskContribution };
  }

  /**
   * Analyze uptime patterns
   * @param {Object} uptimeData - Uptime statistics
   * @returns {Object} Uptime analysis
   */
  analyzeUptime(uptimeData) {
    const insights = [];
    const predictions = [];
    const recommendations = [];
    let riskContribution = 0;

    const uptime = uptimeData.uptime_percentage || uptimeData.uptimePercentage || 100;

    if (uptime < this.thresholds.uptime.warning) {
      insights.push({
        id: 'uptime_critical',
        type: 'availability',
        severity: uptime < 90 ? 'critical' : 'high',
        title: 'Low Uptime Detected',
        description: `Uptime (${uptime.toFixed(2)}%) is below acceptable levels`,
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        actionable: true,
        recommendation: 'Investigate and resolve availability issues'
      });
      riskContribution += uptime < 90 ? 4 : 2;
    }

    // Failure pattern analysis
    const consecutiveFailures = uptimeData.consecutive_failures || 0;
    if (consecutiveFailures > 3) {
      insights.push({
        id: 'consecutive_failures',
        type: 'availability',
        severity: 'high',
        title: 'Consecutive Failures Detected',
        description: `${consecutiveFailures} consecutive failures indicate a persistent issue`,
        confidence: 0.90,
        timestamp: new Date().toISOString(),
        actionable: true,
        recommendation: 'Immediate investigation required'
      });
      riskContribution += 2;
    }

    return { insights, predictions, recommendations, riskContribution };
  }

  /**
   * Analyze error patterns
   * @param {Array} errorData - Error data points
   * @returns {Object} Error analysis
   */
  analyzeErrors(errorData) {
    const insights = [];
    const predictions = [];
    const recommendations = [];
    let riskContribution = 0;

    if (!errorData || errorData.length === 0) {
      return { insights, predictions, recommendations, riskContribution };
    }

    // Error rate calculation
    const totalRequests = errorData.length;
    const errorCount = errorData.filter(d => !d.success).length;
    const errorRate = errorCount / totalRequests;

    if (errorRate > this.thresholds.errorRate.critical) {
      insights.push({
        id: 'high_error_rate',
        type: 'reliability',
        severity: 'critical',
        title: 'High Error Rate',
        description: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds critical threshold`,
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        actionable: true,
        recommendation: 'Immediate error investigation and resolution required'
      });
      riskContribution += 3;
    }

    return { insights, predictions, recommendations, riskContribution };
  }

  /**
   * Detect anomalies in monitoring data
   * @param {Object} data - Monitoring data
   * @returns {Array} Detected anomalies
   */
  detectAnomalies(data) {
    const anomalies = [];

    // Simple anomaly detection based on statistical outliers
    if (data.responseTimeData && data.responseTimeData.length > 10) {
      const times = data.responseTimeData.map(d => d.response_time || d.responseTime);
      const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
      const stdDev = Math.sqrt(times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length);
      
      const outliers = times.filter(time => Math.abs(time - mean) > 2 * stdDev);
      
      if (outliers.length > 0) {
        anomalies.push({
          id: 'response_time_anomaly',
          type: 'anomaly',
          severity: 'medium',
          title: 'Response Time Anomalies Detected',
          description: `${outliers.length} response time outliers detected`,
          confidence: 0.80,
          timestamp: new Date().toISOString(),
          actionable: true,
          recommendation: 'Investigate unusual response time spikes'
        });
      }
    }

    return anomalies;
  }

  /**
   * Predict future trends
   * @param {Object} data - Monitoring data
   * @returns {Array} Trend predictions
   */
  predictTrends(data) {
    const predictions = [];

    // Simple linear trend prediction
    if (data.responseTimeData && data.responseTimeData.length >= 5) {
      const recentData = data.responseTimeData.slice(-5);
      const times = recentData.map(d => d.response_time || d.responseTime);
      
      // Calculate simple trend
      const firstHalf = times.slice(0, Math.floor(times.length / 2));
      const secondHalf = times.slice(Math.floor(times.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg * 1.2) {
        predictions.push({
          type: 'trend',
          prediction: 'Response time trend is increasing',
          confidence: 0.70,
          timeframe: '1-2 hours',
          impact: 'medium',
          recommendation: 'Monitor performance closely'
        });
      }
    }

    return predictions;
  }

  /**
   * Calculate overall health score
   * @param {Object} data - Monitoring data
   * @returns {number} Health score (0-10)
   */
  calculateHealthScore(data) {
    let score = 10;

    // Response time impact
    if (data.responseTimeData && data.responseTimeData.length > 0) {
      const avgResponseTime = data.responseTimeData.reduce((sum, d) => sum + (d.response_time || d.responseTime), 0) / data.responseTimeData.length;
      if (avgResponseTime > this.thresholds.responseTime.critical) score -= 4;
      else if (avgResponseTime > this.thresholds.responseTime.warning) score -= 2;
      else if (avgResponseTime > this.thresholds.responseTime.good) score -= 1;
    }

    // Uptime impact
    if (data.uptimeData) {
      const uptime = data.uptimeData.uptime_percentage || data.uptimeData.uptimePercentage || 100;
      if (uptime < 90) score -= 4;
      else if (uptime < this.thresholds.uptime.warning) score -= 2;
      else if (uptime < this.thresholds.uptime.good) score -= 1;
    }

    // Error rate impact
    if (data.errorData && data.errorData.length > 0) {
      const errorRate = data.errorData.filter(d => !d.success).length / data.errorData.length;
      if (errorRate > this.thresholds.errorRate.critical) score -= 3;
      else if (errorRate > this.thresholds.errorRate.warning) score -= 1.5;
    }

    return Math.max(score, 0);
  }

  /**
   * Generate analysis summary
   * @param {Array} insights - Generated insights
   * @param {Array} predictions - Generated predictions
   * @param {number} riskScore - Risk score
   * @returns {Object} Summary
   */
  generateSummary(insights, predictions, riskScore) {
    const criticalIssues = insights.filter(i => i.severity === 'critical').length;
    const highIssues = insights.filter(i => i.severity === 'high').length;
    
    return {
      totalInsights: insights.length,
      criticalIssues,
      highIssues,
      predictions: predictions.length,
      overallHealth: riskScore < 3 ? 'Good' : riskScore < 6 ? 'Fair' : 'Poor',
      summary: `AI detected ${insights.length} insights with ${criticalIssues} critical issues. ${predictions.length} predictions generated.`
    };
  }

  /**
   * Prioritize recommendations by impact and urgency
   * @param {Array} recommendations - List of recommendations
   * @returns {Array} Prioritized recommendations
   */
  prioritizeRecommendations(recommendations) {
    return recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5); // Top 5 recommendations
  }

  /**
   * Identify trends in the data
   * @param {Object} data - Monitoring data
   * @returns {Array} Identified trends
   */
  identifyTrends(data) {
    const trends = [];

    if (data.responseTimeData && data.responseTimeData.length >= 5) {
      const times = data.responseTimeData.map(d => d.response_time || d.responseTime);
      const recentAvg = times.slice(-3).reduce((sum, time) => sum + time, 0) / 3;
      const olderAvg = times.slice(0, 3).reduce((sum, time) => sum + time, 0) / 3;
      
      if (recentAvg > olderAvg * 1.1) {
        trends.push({ type: 'response_time', direction: 'increasing', magnitude: 'moderate' });
      } else if (recentAvg < olderAvg * 0.9) {
        trends.push({ type: 'response_time', direction: 'decreasing', magnitude: 'moderate' });
      }
    }

    return trends;
  }

  /**
   * Calculate confidence based on data quality
   * @param {Object} data - Input data
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(data) {
    let confidence = 0.5;

    // Data completeness
    const dataFields = ['responseTimeData', 'uptimeData', 'errorData'];
    const availableFields = dataFields.filter(field => data[field] && data[field].length > 0);
    confidence += (availableFields.length / dataFields.length) * 0.3;

    // Data recency
    if (data.responseTimeData && data.responseTimeData.length > 0) {
      const latestTimestamp = new Date(data.responseTimeData[data.responseTimeData.length - 1].timestamp);
      const ageHours = (Date.now() - latestTimestamp.getTime()) / (1000 * 60 * 60);
      if (ageHours < 1) confidence += 0.2;
      else if (ageHours < 24) confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Get risk level from score
   * @param {number} score - Risk score
   * @returns {string} Risk level
   */
  getRiskLevel(score) {
    if (score >= 8) return 'Critical';
    if (score >= 6) return 'High';
    if (score >= 4) return 'Medium';
    if (score >= 2) return 'Low';
    return 'Minimal';
  }
}

export default MonitoringAIAnalyzer;
