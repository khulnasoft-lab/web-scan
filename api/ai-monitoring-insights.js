/**
 * AI Monitoring Insights API
 * Provides AI-powered insights for monitoring data
 */

import MonitoringAIAnalyzer from '../src/ai/analyzers/monitoring-ai-analyzer.js';

// Initialize AI analyzer
const aiAnalyzer = new MonitoringAIAnalyzer({
  confidenceThreshold: 0.7,
  enableLearning: process.env.NODE_ENV === 'development'
});

// Initialize the analyzer
aiAnalyzer.initialize().catch(console.error);

export default async function handler(req, res) {
  try {
    const { configId, timeRange = '24h' } = req.query;
    
    console.log(`🤖 Generating AI insights for config: ${configId}`);

    // Simulate fetching monitoring data (in production, this would fetch from database)
    const monitoringData = await fetchMonitoringData(configId, timeRange);

    // Perform AI analysis
    const aiInsights = await aiAnalyzer.analyze(monitoringData, 'monitoring');

    // Enhance with real-time predictions
    const enhancedInsights = await enhanceWithPredictions(aiInsights, monitoringData);

    const response = {
      success: true,
      configId,
      timeRange,
      timestamp: new Date().toISOString(),
      aiInsights: enhancedInsights,
      metadata: {
        analysisVersion: aiAnalyzer.version,
        confidence: enhancedInsights.confidence,
        processingTime: Date.now() - Date.now() // Will be calculated properly
      }
    };

    console.log(`✅ AI insights generated successfully`);
    console.log(`📊 Health Score: ${enhancedInsights.healthScore}/10`);
    console.log(`🔍 Found ${enhancedInsights.insights.length} insights`);

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ AI monitoring insights failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      metadata: {
        analysisVersion: aiAnalyzer.version,
        errorType: error.name || 'UnknownError'
      }
    });
  }
}

/**
 * Fetch monitoring data for analysis
 * @param {string} configId - Configuration ID
 * @param {string} timeRange - Time range for data
 * @returns {Promise<Object>} Monitoring data
 */
async function fetchMonitoringData(configId, timeRange) {
  // Generate sample monitoring data for demonstration
  const now = new Date();
  const hoursBack = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 24;
  
  const responseTimeData = [];
  const errorData = [];
  
  // Generate sample response time data with some patterns
  for (let i = hoursBack; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
    
    // Simulate response time with some variation and occasional spikes
    let baseResponseTime = 200 + Math.random() * 100;
    
    // Add some patterns
    if (i < 6) baseResponseTime *= 1.5; // Recent degradation
    if (i % 12 === 0) baseResponseTime *= 2; // Periodic spikes
    
    const responseTime = Math.round(baseResponseTime);
    const success = responseTime < 3000 && Math.random() > 0.05; // 5% error rate, higher for slow responses
    
    responseTimeData.push({
      timestamp: timestamp.toISOString(),
      response_time: responseTime,
      success,
      status_code: success ? 200 : (Math.random() > 0.5 ? 500 : 404)
    });
    
    errorData.push({
      timestamp: timestamp.toISOString(),
      success,
      error: success ? null : 'Connection timeout'
    });
  }

  // Generate uptime statistics
  const successfulChecks = errorData.filter(d => d.success).length;
  const totalChecks = errorData.length;
  const uptimePercentage = (successfulChecks / totalChecks) * 100;
  
  const uptimeData = {
    uptime_percentage: uptimePercentage,
    total_checks: totalChecks,
    successful_checks: successfulChecks,
    failed_checks: totalChecks - successfulChecks,
    avg_response_time: responseTimeData.reduce((sum, d) => sum + d.response_time, 0) / responseTimeData.length,
    consecutive_failures: calculateConsecutiveFailures(errorData)
  };

  return {
    configId,
    timeRange,
    responseTimeData,
    errorData,
    uptimeData,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Calculate consecutive failures
 * @param {Array} errorData - Error data array
 * @returns {number} Number of consecutive failures
 */
function calculateConsecutiveFailures(errorData) {
  let consecutiveFailures = 0;
  
  // Count from the most recent data backwards
  for (let i = errorData.length - 1; i >= 0; i--) {
    if (!errorData[i].success) {
      consecutiveFailures++;
    } else {
      break;
    }
  }
  
  return consecutiveFailures;
}

/**
 * Enhance insights with additional predictions
 * @param {Object} insights - Base AI insights
 * @param {Object} monitoringData - Original monitoring data
 * @returns {Promise<Object>} Enhanced insights
 */
async function enhanceWithPredictions(insights, monitoringData) {
  // Add capacity planning predictions
  const capacityPredictions = generateCapacityPredictions(monitoringData);
  
  // Add maintenance window recommendations
  const maintenanceRecommendations = generateMaintenanceRecommendations(insights);
  
  // Add cost optimization insights
  const costOptimizations = generateCostOptimizations(monitoringData);

  return {
    ...insights,
    capacityPredictions,
    maintenanceRecommendations,
    costOptimizations,
    enhancedAt: new Date().toISOString()
  };
}

/**
 * Generate capacity planning predictions
 * @param {Object} monitoringData - Monitoring data
 * @returns {Array} Capacity predictions
 */
function generateCapacityPredictions(monitoringData) {
  const predictions = [];
  
  if (monitoringData.responseTimeData && monitoringData.responseTimeData.length > 10) {
    const avgResponseTime = monitoringData.responseTimeData.reduce((sum, d) => sum + d.response_time, 0) / monitoringData.responseTimeData.length;
    
    if (avgResponseTime > 1000) {
      predictions.push({
        type: 'capacity',
        prediction: 'Server capacity may need scaling within 7 days',
        confidence: 0.75,
        timeframe: '7 days',
        impact: 'high',
        recommendation: 'Consider horizontal scaling or performance optimization'
      });
    }
  }
  
  return predictions;
}

/**
 * Generate maintenance window recommendations
 * @param {Object} insights - AI insights
 * @returns {Array} Maintenance recommendations
 */
function generateMaintenanceRecommendations(insights) {
  const recommendations = [];
  
  const criticalIssues = insights.insights.filter(i => i.severity === 'critical').length;
  
  if (criticalIssues > 0) {
    recommendations.push({
      type: 'maintenance',
      window: 'immediate',
      priority: 'high',
      description: 'Critical issues require immediate maintenance',
      estimatedDuration: '2-4 hours'
    });
  } else if (insights.healthScore < 7) {
    recommendations.push({
      type: 'maintenance',
      window: 'next_weekend',
      priority: 'medium',
      description: 'Preventive maintenance recommended',
      estimatedDuration: '1-2 hours'
    });
  }
  
  return recommendations;
}

/**
 * Generate cost optimization insights
 * @param {Object} monitoringData - Monitoring data
 * @returns {Array} Cost optimizations
 */
function generateCostOptimizations(monitoringData) {
  const optimizations = [];
  
  if (monitoringData.uptimeData && monitoringData.uptimeData.uptime_percentage > 99.5) {
    optimizations.push({
      type: 'cost',
      opportunity: 'Over-provisioned resources detected',
      potentialSavings: '15-25%',
      recommendation: 'Consider right-sizing instances during low-traffic periods',
      confidence: 0.70
    });
  }
  
  return optimizations;
}
