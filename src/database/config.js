import dotenv from 'dotenv';
import { initializeDatabase } from './models.js';

dotenv.config();

export const databaseConfig = {
  // Connection settings
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'web_scan',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  
  // Pool settings
  pool: {
    max: process.env.DB_POOL_MAX || 20,
    min: process.env.DB_POOL_MIN || 2,
    idle: process.env.DB_POOL_IDLE || 30000,
    acquire: process.env.DB_POOL_ACQUIRE || 20000,
  },
  
  // SSL settings
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ca: process.env.DB_SSL_CA,
    key: process.env.DB_SSL_KEY,
    cert: process.env.DB_SSL_CERT,
  } : false,
  
  // Connection string (overrides individual settings if provided)
  connectionString: process.env.DATABASE_URL,
  
  // Schema settings
  schema: process.env.DB_SCHEMA || 'public',
  
  // Logging
  logging: process.env.DB_LOGGING === 'true',
  
  // Migrations
  migrations: {
    table: process.env.DB_MIGRATIONS_TABLE || 'knex_migrations',
    directory: process.env.DB_MIGRATIONS_DIR || './src/database/migrations',
  },
};

// Build connection string if not provided
if (!databaseConfig.connectionString) {
  const { host, port, database, username, password } = databaseConfig;
  databaseConfig.connectionString = `postgresql://${username}:${password}@${host}:${port}/${database}`;
}

// Validate required configuration
export function validateDatabaseConfig() {
  const required = ['database'];
  const missing = required.filter(key => !databaseConfig[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required database configuration: ${missing.join(', ')}`);
  }
}

// Initialize database with configuration
export async function setupDatabase() {
  try {
    validateDatabaseConfig();
    console.log('Database configuration validated');
    
    await initializeDatabase();
    console.log('Database setup completed successfully');
    
    return true;
  } catch (error) {
    console.error('Database setup failed:', error);
    throw error;
  }
}

// Health check function
export async function databaseHealthCheck() {
  try {
    const { pool } = await import('./models.js');
    const result = await pool.query('SELECT NOW() as time');
    return {
      status: 'healthy',
      timestamp: result.rows[0].time,
      message: 'Database connection is healthy'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      message: `Database connection failed: ${error.message}`
    };
  }
}

// Export configuration
export default databaseConfig;
