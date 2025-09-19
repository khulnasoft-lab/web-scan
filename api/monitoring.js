import monitoringService from '../src/monitoring/service.js';
import authMiddleware from '../src/auth/middleware.js';
import { User, MonitoringConfig, MonitoringResults } from '../src/database/dev-models.js';

const auth = new authMiddleware();

export default async function handler(req, res) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { action } = req.query;

    switch (action) {
      case 'create-config':
        await handleCreateConfig(req, res);
        break;
      case 'get-configs':
        await handleGetConfigs(req, res);
        break;
      case 'get-config':
        await handleGetConfig(req, res);
        break;
      case 'update-config':
        await handleUpdateConfig(req, res);
        break;
      case 'delete-config':
        await handleDeleteConfig(req, res);
        break;
      case 'get-status':
        await handleGetStatus(req, res);
        break;
      case 'get-results':
        await handleGetResults(req, res);
        break;
      case 'get-metrics':
        await handleGetMetrics(req, res);
        break;
      case 'get-uptime':
        await handleGetUptime(req, res);
        break;
      case 'start-monitoring':
        await handleStartMonitoring(req, res);
        break;
      case 'stop-monitoring':
        await handleStopMonitoring(req, res);
        break;
      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Monitoring API error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleCreateConfig(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const {
      name,
      target_url,
      scan_type = 'http',
      schedule = { interval: 5 },
      alert_settings = {
        email: false,
        sms: false,
        webhook_url: null,
        thresholds: {
          response_time: 5000,
          consecutive_failures: 3,
          ssl_expiry_days: 30
        }
      }
    } = req.body;

    // Validate required fields
    if (!name || !target_url) {
      return res.status(400).json({ error: 'Name and target_url are required' });
    }

    // Validate URL
    try {
      new URL(target_url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const configData = {
      user_id: user.id,
      organization_id: user.organization_id,
      name,
      target_url,
      scan_type,
      schedule,
      alert_settings
    };

    const config = await monitoringService.createMonitoringConfig(configData);
    
    res.status(201).json({
      success: true,
      message: 'Monitoring configuration created successfully',
      config
    });
  } catch (error) {
    console.error('Error creating monitoring config:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleGetConfigs(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const monitoringConfig = new MonitoringConfig();
    let configs;

    if (user.organization_id) {
      configs = await monitoringConfig.getOrganizationConfigs(user.organization_id);
    } else {
      configs = await monitoringConfig.getUserConfigs(user.id);
    }

    res.json({
      success: true,
      configs
    });
  } catch (error) {
    console.error('Error getting monitoring configs:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleGetConfig(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const { configId } = req.query;
    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    const monitoringConfig = new MonitoringConfig();
    const config = await monitoringConfig.findById(configId);

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Check if user has access to this config
    if (config.user_id !== user.id && config.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error getting monitoring config:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleUpdateConfig(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const { configId } = req.query;
    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    const monitoringConfig = new MonitoringConfig();
    const existingConfig = await monitoringConfig.findById(configId);

    if (!existingConfig) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Check if user has access to this config
    if (existingConfig.user_id !== user.id && existingConfig.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = req.body;
    const updatedConfig = await monitoringService.updateMonitoringConfig(configId, updateData);

    res.json({
      success: true,
      message: 'Monitoring configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    console.error('Error updating monitoring config:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleDeleteConfig(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const { configId } = req.query;
    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    const monitoringConfig = new MonitoringConfig();
    const existingConfig = await monitoringConfig.findById(configId);

    if (!existingConfig) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Check if user has access to this config
    if (existingConfig.user_id !== user.id && existingConfig.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await monitoringService.deleteMonitoringConfig(configId);

    res.json({
      success: true,
      message: 'Monitoring configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting monitoring config:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleGetStatus(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const { configId } = req.query;
    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    // Check if user has access to this config
    const monitoringConfig = new MonitoringConfig();
    const config = await monitoringConfig.findById(configId);

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    if (config.user_id !== user.id && config.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const status = await monitoringService.getMonitoringStatus(configId);

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleGetResults(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const { configId, limit = 100, offset = 0 } = req.query;
    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    // Check if user has access to this config
    const monitoringConfig = new MonitoringConfig();
    const config = await monitoringConfig.findById(configId);

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    if (config.user_id !== user.id && config.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const results = await monitoringService.getMonitoringResults(configId, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error getting monitoring results:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleGetMetrics(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const { configId, timeRange = '24h' } = req.query;
    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    // Check if user has access to this config
    const monitoringConfig = new MonitoringConfig();
    const config = await monitoringConfig.findById(configId);

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    if (config.user_id !== user.id && config.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const monitoringResults = new MonitoringResults();
    const metrics = await monitoringResults.getAggregatedMetrics(configId, timeRange);

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Error getting monitoring metrics:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleGetUptime(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const { configId, timeRange = '24h' } = req.query;
    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    // Check if user has access to this config
    const monitoringConfig = new MonitoringConfig();
    const config = await monitoringConfig.findById(configId);

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    if (config.user_id !== user.id && config.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const monitoringResults = new MonitoringResults();
    const uptime = await monitoringResults.getUptimeStats(configId, timeRange);

    res.json({
      success: true,
      uptime
    });
  } catch (error) {
    console.error('Error getting uptime stats:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleStartMonitoring(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const { configId } = req.query;
    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    // Check if user has access to this config
    const monitoringConfig = new MonitoringConfig();
    const config = await monitoringConfig.findById(configId);

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    if (config.user_id !== user.id && config.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await monitoringService.startMonitoring(config);

    res.json({
      success: true,
      message: 'Monitoring started successfully'
    });
  } catch (error) {
    console.error('Error starting monitoring:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleStopMonitoring(req, res) {
  try {
    // Skip authentication in development
    const user = { id: 1, email: 'dev@example.com' };

    const { configId } = req.query;
    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    // Check if user has access to this config
    const monitoringConfig = new MonitoringConfig();
    const config = await monitoringConfig.findById(configId);

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    if (config.user_id !== user.id && config.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await monitoringService.stopMonitoring(configId);

    res.json({
      success: true,
      message: 'Monitoring stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping monitoring:', error);
    res.status(500).json({ error: error.message });
  }
}
