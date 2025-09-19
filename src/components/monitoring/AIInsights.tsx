import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { io } from 'socket.io-client';

interface AIInsight {
  id: string;
  type: 'security' | 'performance' | 'trend' | 'prediction';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  confidence: number;
  timestamp: string;
  actionable: boolean;
  recommendation?: string;
}

interface VulnerabilityData {
  name: string;
  count: number;
  severity: string;
  color: string;
}

interface AIAnalysisResult {
  riskScore: number;
  riskLevel: string;
  vulnerabilities: any[];
  recommendations: any[];
  insights: AIInsight[];
  confidence: number;
  timestamp: string;
}

interface AIInsightsProps {
  configId?: string | null;
  apiEndpoint?: string;
}

const AIInsights: React.FC<AIInsightsProps> = ({ 
  configId, 
  apiEndpoint = 'http://localhost:3001/api' 
}) => {
  const [aiData, setAiData] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Sample data for demonstration
  const sampleInsights: AIInsight[] = [
    {
      id: '1',
      type: 'security',
      severity: 'high',
      title: 'SSL Certificate Expiring Soon',
      description: 'SSL certificate will expire in 15 days. Renewal recommended.',
      confidence: 0.95,
      timestamp: new Date().toISOString(),
      actionable: true,
      recommendation: 'Renew SSL certificate before expiration'
    },
    {
      id: '2',
      type: 'trend',
      severity: 'medium',
      title: 'Response Time Increasing',
      description: 'Average response time has increased by 23% over the last 7 days.',
      confidence: 0.87,
      timestamp: new Date().toISOString(),
      actionable: true,
      recommendation: 'Investigate server performance and optimize bottlenecks'
    },
    {
      id: '3',
      type: 'prediction',
      severity: 'low',
      title: 'Traffic Spike Predicted',
      description: 'AI predicts 40% traffic increase next week based on historical patterns.',
      confidence: 0.72,
      timestamp: new Date().toISOString(),
      actionable: true,
      recommendation: 'Scale infrastructure to handle increased load'
    }
  ];

  const vulnerabilityData: VulnerabilityData[] = [
    { name: 'Critical', count: 2, severity: 'critical', color: '#ef4444' },
    { name: 'High', count: 5, severity: 'high', color: '#f97316' },
    { name: 'Medium', count: 8, severity: 'medium', color: '#eab308' },
    { name: 'Low', count: 12, severity: 'low', color: '#22c55e' }
  ];

  const riskTrendData = [
    { date: '2024-01-01', riskScore: 6.2, predictions: 6.5 },
    { date: '2024-01-02', riskScore: 5.8, predictions: 6.1 },
    { date: '2024-01-03', riskScore: 6.5, predictions: 6.8 },
    { date: '2024-01-04', riskScore: 5.9, predictions: 6.2 },
    { date: '2024-01-05', riskScore: 7.1, predictions: 7.3 },
    { date: '2024-01-06', riskScore: 6.8, predictions: 7.0 },
    { date: '2024-01-07', riskScore: 6.3, predictions: 6.6 }
  ];

  useEffect(() => {
    fetchAIInsights();
    
    // Set up WebSocket connection for real-time AI insights
    const socket = io(apiEndpoint.replace('/api', ''));
    
    socket.on('connect', () => {
      console.log('🤖 Connected to AI insights WebSocket');
    });

    socket.on('ai_insights', (data: any) => {
      if (data.configId === configId) {
        console.log('🤖 Received real-time AI insights:', data);
        setAiData(data.insights);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    });

    socket.on('disconnect', () => {
      console.log('🤖 Disconnected from AI insights WebSocket');
    });

    // Fallback: Update every 30 seconds if no WebSocket updates
    const interval = setInterval(fetchAIInsights, 30000);
    
    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [configId]);

  const fetchAIInsights = async () => {
    if (!configId) return;
    
    setLoading(true);
    setError(null);

    try {
      // For now, use sample data. In production, this would call the AI API
      const sampleData: AIAnalysisResult = {
        riskScore: 6.5,
        riskLevel: 'Medium',
        vulnerabilities: vulnerabilityData,
        recommendations: [
          'Update SSL certificate',
          'Implement additional security headers',
          'Optimize server response time'
        ],
        insights: sampleInsights,
        confidence: 0.85,
        timestamp: new Date().toISOString()
      };

      setAiData(sampleData);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AI insights');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📊';
    }
  };

  if (loading && !aiData) {
    return (
      <div className="ai-insights-container">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading AI insights...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-insights-container">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">❌</span>
            <span className="text-red-800">Error loading AI insights: {error}</span>
          </div>
          <button 
            onClick={fetchAIInsights}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-insights-container space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h2 className="text-2xl font-bold text-gray-800">🤖 AI Security Insights</h2>
          {aiData && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Confidence: {Math.round((aiData.confidence || 0) * 100)}%
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdate}
          {loading && <span className="ml-2 animate-pulse">🔄</span>}
        </div>
      </div>

      {/* Risk Score Overview */}
      {aiData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overall Risk Score</p>
                <p className="text-3xl font-bold text-gray-900">{aiData.riskScore}/10</p>
                <p className={`text-sm font-medium ${
                  aiData.riskLevel === 'Critical' ? 'text-red-600' :
                  aiData.riskLevel === 'High' ? 'text-orange-600' :
                  aiData.riskLevel === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {aiData.riskLevel} Risk
                </p>
              </div>
              <div className="text-4xl">
                {aiData.riskLevel === 'Critical' ? '🚨' :
                 aiData.riskLevel === 'High' ? '⚠️' :
                 aiData.riskLevel === 'Medium' ? '⚡' : '✅'}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Vulnerabilities</p>
                <p className="text-3xl font-bold text-gray-900">
                  {vulnerabilityData.reduce((sum, v) => sum + v.count, 0)}
                </p>
                <p className="text-sm text-gray-500">Across all severity levels</p>
              </div>
              <div className="text-4xl">🛡️</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Recommendations</p>
                <p className="text-3xl font-bold text-gray-900">{aiData.recommendations.length}</p>
                <p className="text-sm text-gray-500">Actionable items</p>
              </div>
              <div className="text-4xl">💡</div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vulnerability Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Vulnerability Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={vulnerabilityData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                label={({ name, count }) => `${name}: ${count}`}
              >
                {vulnerabilityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Risk Trend & Predictions</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={riskTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
              <YAxis domain={[0, 10]} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="riskScore" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Actual Risk Score"
              />
              <Line 
                type="monotone" 
                dataKey="predictions" 
                stroke="#ef4444" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="AI Predictions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Insights List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">AI-Generated Insights</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {sampleInsights.map((insight) => (
            <div key={insight.id} className="p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <span className="text-2xl">{getSeverityIcon(insight.severity)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="text-lg font-medium text-gray-900">{insight.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(insight.severity)}`}>
                      {insight.severity.toUpperCase()}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                      {Math.round(insight.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-gray-600 mb-3">{insight.description}</p>
                  {insight.recommendation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        <strong>💡 Recommendation:</strong> {insight.recommendation}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-sm text-gray-500">
                  {new Date(insight.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">🚀 Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <span className="mr-2">🔄</span>
            Run Full AI Scan
          </button>
          <button className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <span className="mr-2">📊</span>
            Generate Report
          </button>
          <button className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <span className="mr-2">⚙️</span>
            Configure AI
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
