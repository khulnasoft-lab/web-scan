// Mock database implementation for development
// This avoids native module compilation issues

let mockData = {
  users: [],
  monitoring_configs: [],
  monitoring_results: []
};

let nextId = {
  users: 1,
  monitoring_configs: 1,
  monitoring_results: 1
};

// Initialize mock database
async function initializeDatabase() {
  try {
    // Create some sample data
    mockData.monitoring_configs = [
      {
        id: 1,
        user_id: 1,
        organization_id: 1,
        name: 'Sample Website Monitor',
        target_url: 'https://example.com',
        scan_type: 'security',
        schedule: '0 */6 * * *', // Every 6 hours
        alert_settings: JSON.stringify({ email: true, sms: false }),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    mockData.monitoring_results = [
      {
        id: 1,
        check_id: 'check_001',
        config_id: 1,
        url: 'https://example.com',
        status_code: 200,
        response_time: 150,
        error_message: null,
        security_headers: JSON.stringify({ 'x-frame-options': 'DENY' }),
        ssl_info: JSON.stringify({ valid: true, expires: '2024-12-31' }),
        performance_metrics: JSON.stringify({ loadTime: 1.2, size: 1024 }),
        timestamp: new Date().toISOString()
      }
    ];
    
    nextId.monitoring_configs = 2;
    nextId.monitoring_results = 2;
    
    console.log('Mock database initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize mock database:', error);
    return false;
  }
}

// Base model class for mock database
class BaseModel {
  constructor(table_name) {
    this.table_name = table_name;
  }

  query(sql, params = []) {
    // Simple mock query implementation
    console.log(`Mock query: ${sql}`, params);
    return mockData[this.table_name] || [];
  }

  create(data) {
    const id = nextId[this.table_name]++;
    const record = {
      id,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (!mockData[this.table_name]) {
      mockData[this.table_name] = [];
    }
    
    mockData[this.table_name].push(record);
    return record;
  }

  findById(id) {
    const table = mockData[this.table_name] || [];
    return table.find(record => record.id === parseInt(id));
  }

  findAll(limit = 50, offset = 0) {
    const table = mockData[this.table_name] || [];
    return table
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit);
  }

  update(id, data) {
    const table = mockData[this.table_name] || [];
    const index = table.findIndex(record => record.id === parseInt(id));
    
    if (index !== -1) {
      table[index] = {
        ...table[index],
        ...data,
        updated_at: new Date().toISOString()
      };
      return table[index];
    }
    
    return null;
  }

  delete(id) {
    const table = mockData[this.table_name] || [];
    const index = table.findIndex(record => record.id === parseInt(id));
    
    if (index !== -1) {
      table.splice(index, 1);
      return true;
    }
    
    return false;
  }
}

// User model
class User extends BaseModel {
  constructor() {
    super('users');
  }

  findByEmail(email) {
    const table = mockData[this.table_name] || [];
    return table.find(user => user.email === email);
  }
}

// Monitoring Config model
class MonitoringConfig extends BaseModel {
  constructor() {
    super('monitoring_configs');
  }

  getActiveConfigs() {
    const table = mockData[this.table_name] || [];
    return table
      .filter(config => config.is_active)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  getUserConfigs(userId) {
    const table = mockData[this.table_name] || [];
    return table
      .filter(config => config.user_id === parseInt(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  getOrganizationConfigs(organizationId) {
    const table = mockData[this.table_name] || [];
    return table
      .filter(config => config.organization_id === parseInt(organizationId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  createConfig(configData) {
    const { user_id, organization_id, name, target_url, scan_type, schedule, alert_settings = {} } = configData;
    return super.create({
      user_id,
      organization_id,
      name,
      target_url,
      scan_type,
      schedule,
      alert_settings: JSON.stringify(alert_settings),
      is_active: true
    });
  }
}

// Monitoring Results model
class MonitoringResults extends BaseModel {
  constructor() {
    super('monitoring_results');
  }

  createResult(resultData) {
    const {
      check_id,
      config_id,
      url,
      status_code,
      response_time,
      error_message,
      security_headers,
      ssl_info,
      performance_metrics
    } = resultData;

    return super.create({
      check_id,
      config_id,
      url,
      status_code,
      response_time,
      error_message,
      security_headers: JSON.stringify(security_headers || {}),
      ssl_info: JSON.stringify(ssl_info || {}),
      performance_metrics: JSON.stringify(performance_metrics || {})
    });
  }

  getResultsByConfig(configId, limit = 50, offset = 0) {
    const table = mockData[this.table_name] || [];
    return table
      .filter(result => result.config_id === parseInt(configId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(offset, offset + limit);
  }

  getLatestResults(limit = 100) {
    const table = mockData[this.table_name] || [];
    return table
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getConfigResults(configId, limit = 50, offset = 0) {
    return this.getResultsByConfig(configId, limit, offset);
  }
}

// Export all models and initialization function
export {
  initializeDatabase,
  User,
  MonitoringConfig,
  MonitoringResults
};

export default {
  initializeDatabase,
  User,
  MonitoringConfig,
  MonitoringResults
};
