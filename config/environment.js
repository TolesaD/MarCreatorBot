  // config/environment.js - Updated to use Railway loader
const railwayEnv = require('./railway-env');

// Load environment variables first
const envVars = railwayEnv.getAll();

const config = {
  // ==================== BOT CONFIGURATION ====================
  BOT_TOKEN: envVars.BOT_TOKEN,
  ENCRYPTION_KEY: envVars.ENCRYPTION_KEY,
  DATABASE_URL: envVars.DATABASE_URL,
  
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

// Simple DATABASE_URL validation
if (!config.DATABASE_URL) {
  console.error('❌ DATABASE_URL is required but not set in Railway');
  if (config.NODE_ENV === 'production') {
    process.exit(1);
  }
} else if (!config.DATABASE_URL.includes('postgres')) {
  console.error('❌ DATABASE_URL must be a PostgreSQL connection string');
  console.error('🔍 Current DATABASE_URL:', config.DATABASE_URL);
  if (config.NODE_ENV === 'production') {
    process.exit(1);
  }
} else {
  console.log('✅ DATABASE_URL validation passed - PostgreSQL connection detected');
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

Here is the current config/index.js;
const { sequelize } = require('../../database/db');
const User = require('./User');
const Bot = require('./Bot');
const Admin = require('./Admin');
const Feedback = require('./Feedback');
const UserLog = require('./UserLog');
const BroadcastHistory = require('./BroadcastHistory');

// Define associations

// Bot belongs to User (owner)
Bot.belongsTo(User, { 
  foreignKey: 'owner_id', 
  targetKey: 'telegram_id', 
  as: 'Owner' 
});

// User has many Bots (as owner)
User.hasMany(Bot, { 
  foreignKey: 'owner_id', 
  sourceKey: 'telegram_id', 
  as: 'OwnedBots' 
});

// Admin associations
Admin.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'Bot' 
});

Admin.belongsTo(User, { 
  foreignKey: 'admin_user_id', 
  targetKey: 'telegram_id', 
  as: 'User' 
});

Bot.hasMany(Admin, { 
  foreignKey: 'bot_id', 
  as: 'Admins' 
});

User.hasMany(Admin, { 
  foreignKey: 'admin_user_id', 
  sourceKey: 'telegram_id', 
  as: 'AdminRoles' 
});

// Feedback associations
Feedback.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'Bot' 
});

Bot.hasMany(Feedback, { 
  foreignKey: 'bot_id', 
  as: 'Feedbacks' 
});

Feedback.belongsTo(User, {
  foreignKey: 'replied_by',
  targetKey: 'telegram_id',
  as: 'Replier'
});

// UserLog associations
UserLog.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'Bot' 
});

Bot.hasMany(UserLog, { 
  foreignKey: 'bot_id', 
  as: 'UserLogs' 
});

// BroadcastHistory associations
BroadcastHistory.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'Bot' 
});

Bot.hasMany(BroadcastHistory, { 
  foreignKey: 'bot_id', 
  as: 'BroadcastHistories' 
});

BroadcastHistory.belongsTo(User, {
  foreignKey: 'sent_by',
  targetKey: 'telegram_id',
  as: 'Sender'
});

module.exports = {
  sequelize,
  User,
  Bot,
  Admin,
  Feedback,
  UserLog,
  BroadcastHistory
};