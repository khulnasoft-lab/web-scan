import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { io } from 'socket.io-client';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AIInsights from './AIInsights';

interface MonitoringConfig {
  id: string;
  name: string;
  target_url: string;
  scan_type: string;
  schedule: any;
  alert_settings: any;
  is_active: boolean;
  created_at: string;
}

interface MonitoringResult {
  check_id: string;
  config_id: string;
  url: string;
  status_code: number;
  response_time: number;
  timestamp: string;
  success: boolean;
  error?: string;
  headers?: any;
  content_length?: number;
  ssl_info?: any;
}

interface MonitoringStatus {
  config_id: string;
  status: string;
  last_check: string;
  consecutive_failures: number;
  consecutive_successes: number;
  url: string;
}

interface UptimeStats {
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  uptime_percentage: number;
  avg_response_time: number;
  min_response_time: number;
  max_response_time: number;
}

const MonitoringDashboard: React.FC = () => {
  const [configs, setConfigs] = useState<MonitoringConfig[]>([]);
  const [results, setResults] = useState<MonitoringResult[]>([]);
  const [statuses, setStatuses] = useState<{ [key: string]: MonitoringStatus }>({});
  const [uptimeStats, setUptimeStats] = useState<{ [key: string]: UptimeStats }>({});
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ai-insights'>('overview');
  const [newConfig, setNewConfig] = useState({
    name: '',
    target_url: '',
    scan_type: 'http',
    schedule: { interval: 5 },
    alert_settings: {
      email: false,
      sms: false,
      webhook_url: '',
      thresholds: {
        response_time: 5000,
        consecutive_failures: 3,
        ssl_expiry_days: 30
      }
    }
  });

  const socket = io(process.env.REACT_APP_WS_URL || 'http://localhost:3000');

  useEffect(() => {
    fetchConfigs();
    setupWebSocket();
    
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedConfig) {
      fetchResults(selectedConfig);
      fetchUptimeStats(selectedConfig);
    }
  }, [selectedConfig]);

  const setupWebSocket = () => {
    socket.on('connect', () => {
      console.log('Connected to WebSocket');
    });

    socket.on('monitoring_update', (data) => {
      console.log('Received monitoring update:', data);
      // Update results in real-time
      if (data.config_id === selectedConfig) {
        setResults(prev => [data, ...prev.slice(0, 99)]);
      }
      
      // Update status
      setStatuses(prev => ({
        ...prev,
        [data.config_id]: {
          ...prev[data.config_id],
          last_check: data.timestamp,
          consecutive_failures: data.success ? 0 : (prev[data.config_id]?.consecutive_failures || 0) + 1,
          consecutive_successes: data.success ? (prev[data.config_id]?.consecutive_successes || 0) + 1 : 0
        }
      }));

      // Show notification for failures
      if (!data.success) {
        toast.error(`Monitoring alert: ${data.url} - ${data.error || 'Request failed'}`);
      }
    });

    socket.on('alert', (alert) => {
      toast.error(`Alert: ${alert.message}`, {
        position: 'top-right',
        autoClose: 5000,
      });
    });
  };

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/monitoring?action=get-configs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs);
        
        // Fetch status for each config
        data.configs.forEach(async (config: MonitoringConfig) => {
          await fetchConfigStatus(config.id);
        });
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast.error('Failed to fetch monitoring configurations');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigStatus = async (configId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/monitoring?action=get-status&configId=${configId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatuses(prev => ({
          ...prev,
          [configId]: data.status
        }));
      }
    } catch (error) {
      console.error('Error fetching config status:', error);
    }
  };

  const fetchResults = async (configId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/monitoring?action=get-results&configId=${configId}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  };

  const fetchUptimeStats = async (configId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/monitoring?action=get-uptime&configId=${configId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUptimeStats(prev => ({
          ...prev,
          [configId]: data.uptime
        }));
      }
    } catch (error) {
      console.error('Error fetching uptime stats:', error);
    }
  };

  const handleCreateConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/monitoring?action=create-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newConfig)
      });
      
      if (response.ok) {
        toast.success('Monitoring configuration created successfully');
        setShowCreateModal(false);
        setNewConfig({
          name: '',
          target_url: '',
          scan_type: 'http',
          schedule: { interval: 5 },
          alert_settings: {
            email: false,
            sms: false,
            webhook_url: '',
            thresholds: {
              response_time: 5000,
              consecutive_failures: 3,
              ssl_expiry_days: 30
            }
          }
        });
        fetchConfigs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create configuration');
      }
    } catch (error) {
      console.error('Error creating config:', error);
      toast.error('Failed to create monitoring configuration');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'stopped': return 'red';
      default: return 'gray';
    }
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'green';
    if (uptime >= 95) return 'yellow';
    return 'red';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const chartData = results.slice(0, 20).reverse().map(result => ({
    time: new Date(result.timestamp).toLocaleTimeString(),
    responseTime: result.response_time,
    status: result.success ? 1 : 0
  }));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ToastContainer />
      
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Monitoring Dashboard</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Create Monitor
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => setActiveTab('ai-insights')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ai-insights'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🤖 AI Insights
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Configuration Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {configs.map((config) => (
          <div
            key={config.id}
            className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedConfig === config.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedConfig(config.id)}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
              <span
                className={`px-2 py-1 text-xs rounded-full bg-${getStatusColor(
                  statuses[config.id]?.status || 'unknown'
                )}-100 text-${getStatusColor(statuses[config.id]?.status || 'unknown')}-800`}
              >
                {statuses[config.id]?.status || 'unknown'}
              </span>
            </div>
            
            <p className="text-gray-600 text-sm mb-2 truncate">{config.target_url}</p>
            
            {uptimeStats[config.id] && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Uptime</span>
                  <span
                    className={`text-sm font-semibold text-${getUptimeColor(
                      uptimeStats[config.id].uptime_percentage
                    )}-600`}
                  >
                    {uptimeStats[config.id].uptime_percentage.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Response</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {uptimeStats[config.id].avg_response_time.toFixed(0)}ms
                  </span>
                </div>
              </div>
            )}
            
            {statuses[config.id] && (
              <div className="mt-4 text-xs text-gray-500">
                Last check: {formatTimestamp(statuses[config.id].last_check)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts and Details */}
      {selectedConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Response Time Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Response Time (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Status Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Success Rate</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="status"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                  name="Success (1=Success, 0=Failure)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Results */}
          <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Results</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Response Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.slice(0, 10).map((result) => (
                    <tr key={result.check_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTimestamp(result.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            result.success
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {result.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.response_time}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.error || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'ai-insights' && (
        <AIInsights 
          configId={selectedConfig} 
          apiEndpoint="http://localhost:3001/api"
        />
      )}

      {/* Create Config Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Create Monitoring Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newConfig.name}
                  onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter monitor name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target URL
                </label>
                <input
                  type="url"
                  value={newConfig.target_url}
                  onChange={(e) => setNewConfig({ ...newConfig, target_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check Interval (minutes)
                </label>
                <input
                  type="number"
                  value={newConfig.schedule.interval}
                  onChange={(e) => setNewConfig({
                    ...newConfig,
                    schedule: { ...newConfig.schedule, interval: parseInt(e.target.value) }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateConfig}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitoringDashboard;
