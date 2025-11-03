const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
  // ==================== BOT CONFIGURATION ====================
  BOT_TOKEN: process.env.BOT_TOKEN,
  MAIN_BOT_USERNAME: process.env.MAIN_BOT_USERNAME || '@MarCreatorBot',
  MAIN_BOT_NAME: process.env.MAIN_BOT_NAME || 'MarCreatorBot',
  WEBHOOK_URL: process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT || 3000}`,
  
  // ==================== DATABASE CONFIGURATION ====================
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_DIALECT: 'postgres', // Force PostgreSQL
  
  // Connection pool settings
  DATABASE_POOL_MAX: parseInt(process.env.DATABASE_POOL_MAX) || 20,
  DATABASE_POOL_IDLE: parseInt(process.env.DATABASE_POOL_IDLE) || 30000,
  DATABASE_POOL_ACQUIRE: parseInt(process.env.DATABASE_POOL_ACQUIRE) || 60000,
  
  // ==================== ENCRYPTION ====================
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  
  // ==================== SERVER CONFIGURATION ====================
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'production',
  HOST: process.env.HOST || '0.0.0.0',
  
  // ==================== SECURITY & LIMITS ====================
  MAX_BOTS_PER_USER: parseInt(process.env.MAX_BOTS_PER_USER) || 10,
  MAX_ADMINS_PER_BOT: parseInt(process.env.MAX_ADMINS_PER_BOT) || 10,
  MAX_BROADCAST_LENGTH: parseInt(process.env.MAX_BROADCAST_LENGTH) || 4000,
  
  // Rate limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // ==================== FEATURE FLAGS ====================
  ENABLE_BROADCASTS: process.env.ENABLE_BROADCASTS !== 'false',
  ENABLE_TEAM_MANAGEMENT: process.env.ENABLE_TEAM_MANAGEMENT !== 'false',
  ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
  ENABLE_MINI_BOT_DASHBOARD: process.env.ENABLE_MINI_BOT_DASHBOARD !== 'false',
  ENABLE_DIRECT_MANAGEMENT: process.env.ENABLE_DIRECT_MANAGEMENT !== 'false',
  
  // ==================== MINI-BOT SPECIFIC ====================
  MINI_BOT_COMMANDS_ENABLED: process.env.MINI_BOT_COMMANDS_ENABLED !== 'false',
  REAL_TIME_NOTIFICATIONS: process.env.REAL_TIME_NOTIFICATIONS !== 'false',
  AUTO_RESTART_BOTS: process.env.AUTO_RESTART_BOTS !== 'false',
  
  // ==================== WATERMARK & BRANDING ====================
  WATERMARK_TEXT: '✨ Created with [MarCreatorBot](https://t.me/MarCreatorBot)',
  BOT_NAME: process.env.BOT_NAME || 'MarCreatorBot',
  SUPPORT_USERNAME: process.env.SUPPORT_USERNAME || 'MarCreatorSupportBot',
  
  // ==================== LOGGING ====================
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || './logs/app.log',
  
  // ==================== BACKUP & MAINTENANCE ====================
  BACKUP_ENABLED: process.env.BACKUP_ENABLED === 'true',
  BACKUP_SCHEDULE: process.env.BACKUP_SCHEDULE || '0 2 * * *',
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS) || 7,
  
  // ==================== PERFORMANCE ====================
  CACHE_ENABLED: process.env.CACHE_ENABLED !== 'false',
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 300000,
  
  // Mini-bot performance
  MINI_BOT_TIMEOUT: parseInt(process.env.MINI_BOT_TIMEOUT) || 90000,
  BROADCAST_RATE_LIMIT: parseInt(process.env.BROADCAST_RATE_LIMIT) || 20,
  
  // ==================== MONITORING ====================
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
  METRICS_ENABLED: process.env.METRICS_ENABLED === 'true',
  
  // ==================== BOT PERSISTENCE ====================
  PERSIST_BOT_SESSIONS: process.env.PERSIST_BOT_SESSIONS !== 'false',
  AUTO_RECONNECT_BOTS: process.env.AUTO_RECONNECT_BOTS !== 'false',
};

// ==================== VALIDATION & POST-PROCESSING ====================

// Validate required environment variables
const required = ['BOT_TOKEN', 'ENCRYPTION_KEY', 'DATABASE_URL'];
required.forEach(key => {
  if (!config[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    if (config.NODE_ENV === 'production') {
      console.error(`💡 For Railway, make sure ${key} is set in your project variables`);
      process.exit(1);
    } else {
      console.warn(`⚠️  ${key} is missing but continuing in development mode`);
    }
  }
});

// Validate DATABASE_URL for PostgreSQL (Railway compatible)
if (config.DATABASE_URL) {
  // Simple check - just verify it contains 'postgres'
  const isPostgreSQL = config.DATABASE_URL && config.DATABASE_URL.includes('postgres');
  
  if (isPostgreSQL) {
    console.log('✅ DATABASE_URL validation passed - PostgreSQL connection detected');
  } else {
    console.error('❌ DATABASE_URL must be a PostgreSQL connection string');
    console.error('🔍 Current DATABASE_URL:', config.DATABASE_URL ? 'SET' : 'MISSING');
    if (config.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// Webhook URL validation
if (config.NODE_ENV === 'production' && !config.WEBHOOK_URL.includes('https')) {
  console.warn('⚠️  WARNING: Production webhook URL should use HTTPS for security');
}

// Production optimizations
if (config.NODE_ENV === 'production') {
  config.CACHE_ENABLED = true;
  config.REAL_TIME_NOTIFICATIONS = true;
  config.AUTO_RESTART_BOTS = true;
  config.PERSIST_BOT_SESSIONS = true;
  config.AUTO_RECONNECT_BOTS = true;
}

// ==================== EXPORT CONFIGURATION ====================

console.log('🔧 Loading environment configuration...');
console.log('✅ Environment loaded:');
console.log('   NODE_ENV:', config.NODE_ENV);
console.log('   PORT:', config.PORT);
console.log('   BOT_TOKEN:', config.BOT_TOKEN ? '***' + config.BOT_TOKEN.slice(-4) : 'NOT SET');
console.log('   MAIN_BOT:', config.MAIN_BOT_NAME);
console.log('   DATABASE: POSTGRESQL');
console.log('   DATABASE_URL:', config.DATABASE_URL ? '***' + config.DATABASE_URL.split('@')[1] : 'NOT SET');

module.exports = config;