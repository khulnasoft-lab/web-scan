import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/web_scan',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Base model class
class BaseModel {
  constructor(table_name) {
    this.table_name = table_name;
    this.pool = pool;
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Query error', { text, error: error.message });
      throw error;
    }
  }

  async findById(id) {
    const result = await this.query(
      `SELECT * FROM ${this.table_name} WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  async create(data) {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(data);
    
    const result = await this.query(
      `INSERT INTO ${this.table_name} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async update(id, data) {
    const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = [id, ...Object.values(data)];
    
    const result = await this.query(
      `UPDATE ${this.table_name} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async delete(id) {
    const result = await this.query(
      `DELETE FROM ${this.table_name} WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  async findAll(where = {}, orderBy = 'created_at DESC', limit = 50, offset = 0) {
    let whereClause = '';
    const whereValues = [];
    
    if (Object.keys(where).length > 0) {
      const whereConditions = Object.keys(where).map((key, i) => {
        whereValues.push(where[key]);
        return `${key} = $${i + 1}`;
      });
      whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    }
    
    const result = await this.query(
      `SELECT * FROM ${this.table_name} ${whereClause} ORDER BY ${orderBy} LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}`,
      [...whereValues, limit, offset]
    );
    return result.rows;
  }
}

// User model
class User extends BaseModel {
  constructor() {
    super('users');
  }

  async findByEmail(email) {
    const result = await this.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  async create(userData) {
    const { email, password_hash, name, role = 'user' } = userData;
    return super.create({
      email,
      password_hash,
      name,
      role,
    });
  }

  async updateLastLogin(id) {
    const result = await this.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  async getOrganizations(userId) {
    const result = await this.query(
      `SELECT o.*, uo.role, uo.joined_at 
       FROM organizations o 
       JOIN user_organizations uo ON o.id = uo.organization_id 
       WHERE uo.user_id = $1`,
      [userId]
    );
    return result.rows;
  }
}

// Scan History model
class ScanHistory extends BaseModel {
  constructor() {
    super('scan_history');
  }

  async createScan(scanData) {
    const { user_id, organization_id, target_url, scan_type, metadata = {} } = scanData;
    return super.create({
      user_id,
      organization_id,
      target_url,
      scan_type,
      status: 'pending',
      metadata,
    });
  }

  async updateStatus(id, status, error_message = null) {
    const updateData = { status };
    if (status === 'running') {
      updateData.started_at = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date();
    }
    if (error_message) {
      updateData.error_message = error_message;
    }
    return this.update(id, updateData);
  }

  async getUserScans(userId, limit = 20, offset = 0) {
    const result = await this.query(
      `SELECT * FROM scan_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  async getOrganizationScans(organizationId, limit = 20, offset = 0) {
    const result = await this.query(
      `SELECT * FROM scan_history 
       WHERE organization_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    return result.rows;
  }
}

// Scan Results model
class ScanResults extends BaseModel {
  constructor() {
    super('scan_results');
  }

  async createResult(resultData) {
    const { scan_id, endpoint_name, result_data, execution_time, status, error_message } = resultData;
    return super.create({
      scan_id,
      endpoint_name,
      result_data,
      execution_time,
      status,
      error_message,
    });
  }

  async getScanResults(scanId) {
    const result = await this.query(
      'SELECT * FROM scan_results WHERE scan_id = $1 ORDER BY created_at',
      [scanId]
    );
    return result.rows;
  }
}

// Monitoring Config model
class MonitoringConfig extends BaseModel {
  constructor() {
    super('monitoring_configs');
  }

  async createConfig(configData) {
    const { user_id, organization_id, name, target_url, scan_type, schedule, alert_settings = {} } = configData;
    return super.create({
      user_id,
      organization_id,
      name,
      target_url,
      scan_type,
      schedule,
      alert_email: alert_settings.email || false,
      alert_sms: alert_settings.sms || false,
      webhook_url: alert_settings.webhook_url || null,
      alert_thresholds: alert_settings.thresholds || {},
    });
  }

  async getUserConfigs(userId) {
    const result = await this.query(
      'SELECT * FROM monitoring_configs WHERE user_id = $1 AND is_active = true ORDER BY created_at',
      [userId]
    );
    return result.rows;
  }

  async getOrganizationConfigs(organizationId) {
    const result = await this.query(
      'SELECT * FROM monitoring_configs WHERE organization_id = $1 AND is_active = true ORDER BY created_at',
      [organizationId]
    );
    return result.rows;
  }

  async getActiveConfigs() {
    const result = await this.query(
      'SELECT * FROM monitoring_configs WHERE is_active = true ORDER BY created_at'
    );
    return result.rows;
  }

  async findById(id) {
    const result = await this.query(
      'SELECT * FROM monitoring_configs WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  async updateConfig(id, updateData) {
    const { name, target_url, scan_type, schedule, alert_settings, is_active } = updateData;
    const result = await this.query(
      `UPDATE monitoring_configs 
       SET name = COALESCE($1, name), 
           target_url = COALESCE($2, target_url), 
           scan_type = COALESCE($3, scan_type), 
           schedule = COALESCE($4, schedule), 
           alert_email = COALESCE($5, alert_email), 
           alert_sms = COALESCE($6, alert_sms), 
           webhook_url = COALESCE($7, webhook_url), 
           alert_thresholds = COALESCE($8, alert_thresholds), 
           is_active = COALESCE($9, is_active), 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $10 RETURNING *`,
      [
        name, 
        target_url, 
        scan_type, 
        schedule, 
        alert_settings?.email, 
        alert_settings?.sms, 
        alert_settings?.webhook_url, 
        alert_settings?.thresholds, 
        is_active, 
        id
      ]
    );
    return result.rows[0];
  }

  async deleteConfig(id) {
    const result = await this.query(
      'UPDATE monitoring_configs SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }
}

// Monitoring Results model
class MonitoringResults extends BaseModel {
  constructor() {
    super('monitoring_results');
  }

  async createResult(resultData) {
    const {
      check_id,
      config_id,
      url,
      status_code,
      response_time,
      timestamp,
      success,
      error,
      headers,
      content_length,
      ssl_info
    } = resultData;

    return super.create({
      check_id,
      config_id,
      url,
      status_code,
      response_time,
      timestamp,
      success,
      error,
      headers,
      content_length,
      ssl_info
    });
  }

  async getConfigResults(configId, limit = 100, offset = 0) {
    const result = await this.query(
      'SELECT * FROM monitoring_results WHERE config_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
      [configId, limit, offset]
    );
    return result.rows;
  }

  async getRecentResults(configId, hours = 24) {
    const result = await this.query(
      `SELECT * FROM monitoring_results 
       WHERE config_id = $1 AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '${hours} hours' 
       ORDER BY timestamp DESC`,
      [configId]
    );
    return result.rows;
  }

  async getResultsByTimeRange(configId, startTime, endTime) {
    const result = await this.query(
      'SELECT * FROM monitoring_results WHERE config_id = $1 AND timestamp BETWEEN $2 AND $3 ORDER BY timestamp DESC',
      [configId, startTime, endTime]
    );
    return result.rows;
  }

  async getAggregatedMetrics(configId, timeRange = '24h') {
    let interval;
    switch (timeRange) {
      case '1h':
        interval = '5 minutes';
        break;
      case '24h':
        interval = '1 hour';
        break;
      case '7d':
        interval = '1 day';
        break;
      case '30d':
        interval = '1 day';
        break;
      default:
        interval = '1 hour';
    }

    const result = await this.query(
      `SELECT 
         time_bucket('${interval}', timestamp) as bucket,
         AVG(response_time) as avg_response_time,
         MIN(response_time) as min_response_time,
         MAX(response_time) as max_response_time,
         COUNT(*) as total_checks,
         COUNT(CASE WHEN success = true THEN 1 END) as successful_checks,
         COUNT(CASE WHEN success = false THEN 1 END) as failed_checks,
         ROUND(AVG(CASE WHEN success = true THEN response_time ELSE NULL END), 2) as avg_success_response_time
       FROM monitoring_results 
       WHERE config_id = $1 AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
       GROUP BY bucket 
       ORDER BY bucket DESC`,
      [configId]
    );
    return result.rows;
  }

  async getUptimeStats(configId, timeRange = '24h') {
    const result = await this.query(
      `SELECT 
         COUNT(*) as total_checks,
         COUNT(CASE WHEN success = true THEN 1 END) as successful_checks,
         COUNT(CASE WHEN success = false THEN 1 END) as failed_checks,
         ROUND((COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / COUNT(*)), 2) as uptime_percentage,
         AVG(response_time) as avg_response_time,
         MIN(response_time) as min_response_time,
         MAX(response_time) as max_response_time
       FROM monitoring_results 
       WHERE config_id = $1 AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '${timeRange}'`,
      [configId]
    );
    return result.rows[0];
  }

  async cleanupOldData(daysToKeep = 30) {
    const result = await this.query(
      'DELETE FROM monitoring_results WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL \'30 days\' RETURNING id',
      [daysToKeep]
    );
    return result.rowCount;
  }
}

// Vulnerability Assessment model
class VulnerabilityAssessment extends BaseModel {
  constructor() {
    super('vulnerability_assessments');
  }

  async createAssessment(assessmentData) {
    const {
      scan_id,
      cve_id,
      vulnerability_name,
      description,
      severity,
      cvss_score,
      cvss_vector,
      attack_vector,
      attack_complexity,
      privileges_required,
      user_interaction,
      scope,
      confidentiality_impact,
      integrity_impact,
      availability_impact,
      remediation,
      references = [],
      affected_components = [],
      is_exploitable = false
    } = assessmentData;

    return super.create({
      scan_id,
      cve_id,
      vulnerability_name,
      description,
      severity,
      cvss_score,
      cvss_vector,
      attack_vector,
      attack_complexity,
      privileges_required,
      user_interaction,
      scope,
      confidentiality_impact,
      integrity_impact,
      availability_impact,
      remediation,
      references,
      affected_components,
      is_exploitable,
    });
  }

  async getScanVulnerabilities(scanId) {
    const result = await this.query(
      'SELECT * FROM vulnerability_assessments WHERE scan_id = $1 ORDER BY cvss_score DESC',
      [scanId]
    );
    return result.rows;
  }

  async getVulnerabilitiesBySeverity(severity) {
    const result = await this.query(
      'SELECT * FROM vulnerability_assessments WHERE severity = $1 ORDER BY created_at DESC',
      [severity]
    );
    return result.rows;
  }
}

// API Security Results model
class ApiSecurityResults extends BaseModel {
  constructor() {
    super('api_security_results');
  }

  async createApiResult(resultData) {
    const {
      scan_id,
      endpoint_url,
      method,
      api_type,
      vulnerability_type,
      owasp_category,
      severity,
      description,
      proof_of_concept,
      remediation,
      request_data,
      response_data
    } = resultData;

    return super.create({
      scan_id,
      endpoint_url,
      method,
      api_type,
      vulnerability_type,
      owasp_category,
      severity,
      description,
      proof_of_concept,
      remediation,
      request_data,
      response_data,
    });
  }

  async getScanApiResults(scanId) {
    const result = await this.query(
      'SELECT * FROM api_security_results WHERE scan_id = $1 ORDER BY severity DESC, created_at',
      [scanId]
    );
    return result.rows;
  }
}

// Compliance Assessment model
class ComplianceAssessment extends BaseModel {
  constructor() {
    super('compliance_assessments');
  }

  async createAssessment(assessmentData) {
    const { scan_id, framework_id, organization_id, assessment_data = {} } = assessmentData;
    return super.create({
      scan_id,
      framework_id,
      organization_id,
      assessment_data,
    });
  }

  async updateScore(id, score) {
    return this.update(id, { overall_score: score, status: 'completed' });
  }

  async getOrganizationAssessments(organizationId) {
    const result = await this.query(
      `SELECT ca.*, cf.name as framework_name, cf.version as framework_version 
       FROM compliance_assessments ca 
       JOIN compliance_frameworks cf ON ca.framework_id = cf.id 
       WHERE ca.organization_id = $1 
       ORDER BY ca.created_at DESC`,
      [organizationId]
    );
    return result.rows;
  }
}

// Audit Log model
class AuditLog extends BaseModel {
  constructor() {
    super('audit_logs');
  }

  async logAction(logData) {
    const {
      user_id,
      organization_id,
      action,
      resource_type,
      resource_id,
      old_values,
      new_values,
      ip_address,
      user_agent
    } = logData;

    return super.create({
      user_id,
      organization_id,
      action,
      resource_type,
      resource_id,
      old_values,
      new_values,
      ip_address,
      user_agent,
    });
  }

  async getUserLogs(userId, limit = 50, offset = 0) {
    const result = await this.query(
      'SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows;
  }

  async getOrganizationLogs(organizationId, limit = 50, offset = 0) {
    const result = await this.query(
      'SELECT * FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [organizationId, limit, offset]
    );
    return result.rows;
  }
}

// ML Model model
class MlModel extends BaseModel {
  constructor() {
    super('ml_models');
  }

  async createModel(modelData) {
    const {
      name,
      model_type,
      version,
      model_data,
      training_data_size,
      accuracy,
      precision,
      recall,
      f1_score
    } = modelData;

    return super.create({
      name,
      model_type,
      version,
      model_data,
      training_data_size,
      accuracy,
      precision,
      recall,
      f1_score,
    });
  }

  async getActiveModels(modelType = null) {
    let query = 'SELECT * FROM ml_models WHERE is_active = true';
    const params = [];
    
    if (modelType) {
      query += ' AND model_type = $1';
      params.push(modelType);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await this.query(query, params);
    return result.rows;
  }
}

// Plugin model
class Plugin extends BaseModel {
  constructor() {
    super('plugins');
  }

  async createPlugin(pluginData) {
    const {
      name,
      slug,
      version,
      description,
      author,
      is_official = false,
      settings_schema = {}
    } = pluginData;

    return super.create({
      name,
      slug,
      version,
      description,
      author,
      is_official,
      settings_schema,
    });
  }

  async getActivePlugins() {
    const result = await this.query(
      'SELECT * FROM plugins WHERE is_active = true ORDER BY is_official DESC, name'
    );
    return result.rows;
  }

  async getUserPlugins(userId) {
    const result = await this.query(
      `SELECT up.*, p.name, p.description, p.version, p.is_official 
       FROM user_plugins up 
       JOIN plugins p ON up.plugin_id = p.id 
       WHERE up.user_id = $1 AND up.is_active = true 
       ORDER BY up.installed_at DESC`,
      [userId]
    );
    return result.rows;
  }
}

// Database initialization
export async function initializeDatabase() {
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    
    // Here you could run migrations if needed
    console.log('Database schema is ready');
    
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Export all models and the pool
export {
  pool,
  User,
  ScanHistory,
  ScanResults,
  MonitoringConfig,
  MonitoringResults,
  VulnerabilityAssessment,
  ApiSecurityResults,
  ComplianceAssessment,
  AuditLog,
  MlModel,
  Plugin,
};
