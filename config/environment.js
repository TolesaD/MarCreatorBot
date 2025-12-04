// config/environment.js - UPDATED WITH ENVIRONMENT DETECTION
const path = require('path');
require('dotenv').config();

// Determine which environment file to load
const env = process.env.NODE_ENV || 'development';
const envFile = `.env.${env}`;

console.log(`🌍 Loading environment: ${env}`);

// Try to load specific environment file
try {
  require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });
  console.log(`✅ Loaded environment file: ${envFile}`);
} catch (error) {
  console.log(`⚠️ Could not load ${envFile}, using default .env`);
}

// Fallback to main .env file
require('dotenv').config();

// Environment-specific configuration
const isDevelopment = env === 'development';
const isProduction = env === 'production';

// Determine main bot name based on environment
const mainBotName = isDevelopment ? 'BotomicsDevBot' : 'BotomicsBot';
const mainBotUsername = isDevelopment ? '@BotomicsDevBot' : '@BotomicsBot';
const supportUsername = isDevelopment ? 'BotomicsDevSupportBot' : 'BotomicsSupportBot';

const config = {
  // ==================== ENVIRONMENT ====================
  NODE_ENV: env,
  IS_DEVELOPMENT: isDevelopment,
  IS_PRODUCTION: isProduction,
  
  // ==================== BOT CONFIGURATION ====================
  BOT_TOKEN: process.env.BOT_TOKEN,
  MAIN_BOT_USERNAME: mainBotUsername,
  MAIN_BOT_NAME: mainBotName,
  WEBHOOK_URL: process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT || 3000}`,
  
  // ==================== PLATFORM IDENTITY ====================
  PLATFORM_NAME: process.env.PLATFORM_NAME || 'Botomics',
  BOT_NAME: mainBotName,
  BOT_USERNAME: mainBotUsername.replace('@', ''),
  SUPPORT_USERNAME: supportUsername,
  TUTORIALS_CHANNEL: process.env.TUTORIALS_CHANNEL || 'https://t.me/Botmics',
  UPDATES_CHANNEL: process.env.UPDATES_CHANNEL || 'https://t.me/Botomics',
  PLATFORM_URL: process.env.PLATFORM_URL || 'https://testweb.maroset.com',
  
  // ==================== WATERMARK & BRANDING ====================
  WATERMARK_TEXT: process.env.WATERMARK_TEXT || `✨ Created with [${mainBotName}](https://t.me/${mainBotUsername.replace('@', '')})`,
  
  // ==================== DATABASE CONFIGURATION ====================
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_DIALECT: 'postgres',
  
  // Connection pool settings
  DATABASE_POOL_MAX: parseInt(process.env.DATABASE_POOL_MAX) || 10,
  DATABASE_POOL_IDLE: parseInt(process.env.DATABASE_POOL_IDLE) || 30000,
  DATABASE_POOL_ACQUIRE: parseInt(process.env.DATABASE_POOL_ACQUIRE) || 60000,
  
  // ==================== ENCRYPTION ====================
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  
  // ==================== SERVER CONFIGURATION ====================
  PORT: process.env.PORT || (isDevelopment ? 3001 : 3000),
  HOST: process.env.HOST || '0.0.0.0',
  
  // ==================== SECURITY & LIMITS ====================
  MAX_BOTS_PER_USER: parseInt(process.env.MAX_BOTS_PER_USER) || (isDevelopment ? 3 : 10),
  MAX_ADMINS_PER_BOT: parseInt(process.env.MAX_ADMINS_PER_BOT) || (isDevelopment ? 3 : 10),
  MAX_BROADCAST_LENGTH: parseInt(process.env.MAX_BROADCAST_LENGTH) || (isDevelopment ? 1000 : 4000),
  
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
  
  // ==================== LOGGING ====================
  LOG_LEVEL: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  LOG_FILE: process.env.LOG_FILE || './logs/app.log',
  
  // ==================== BACKUP & MAINTENANCE ====================
  BACKUP_ENABLED: process.env.BACKUP_ENABLED === 'true',
  BACKUP_SCHEDULE: process.env.BACKUP_SCHEDULE || '0 2 * * *',
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS) || 7,
  
  // ==================== PERFORMANCE ====================
  CACHE_ENABLED: process.env.CACHE_ENABLED !== 'false',
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 300000,
  
  // Mini-bot performance
  MINI_BOT_TIMEOUT: parseInt(process.env.MINI_BOT_TIMEOUT) || (isDevelopment ? 30000 : 90000),
  BROADCAST_RATE_LIMIT: parseInt(process.env.BROADCAST_RATE_LIMIT) || (isDevelopment ? 5 : 20),
  
  // ==================== MONITORING ====================
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
  METRICS_ENABLED: process.env.METRICS_ENABLED === 'true',
  
  // ==================== BOT PERSISTENCE ====================
  PERSIST_BOT_SESSIONS: process.env.PERSIST_BOT_SESSIONS !== 'false',
  AUTO_RECONNECT_BOTS: process.env.AUTO_RECONNECT_BOTS !== 'false',
};

// ==================== VALIDATION ====================
console.log('🔧 Loading environment configuration...');

// Detect cPanel environment
const isCpanel = process.env.HOME && process.env.HOME.includes('/home/');
if (isCpanel) {
  console.log('✅ Running on Yegara.com cPanel');
}

console.log('   Environment:', config.NODE_ENV);
console.log('   Port:', config.PORT);

// Validate critical configuration
if (!config.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is required but not set');
  console.error('💡 How to fix:');
  console.error('   1. Check your .env file or environment variables');
  console.error(`   2. For ${env} environment, use @${mainBotName} token`);
  if (config.NODE_ENV === 'production') {
    process.exit(1);
  }
}

if (!config.ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY is required but not set');
  console.error('💡 How to fix:');
  console.error('   1. Check your .env file or environment variables');
  console.error('   2. Add ENCRYPTION_KEY with your encryption key');
  if (config.NODE_ENV === 'production') {
    process.exit(1);
  }
}

if (!config.DATABASE_URL) {
  console.error('❌ DATABASE_URL is required but not set');
  console.error('💡 How to fix:');
  console.error('   1. Check your .env file or environment variables');
  console.error('   2. Add DATABASE_URL with your database connection string');
  if (config.NODE_ENV === 'production') {
    process.exit(1);
  }
}

console.log('✅ Environment configuration loaded:');
console.log('   BOT_TOKEN:', config.BOT_TOKEN ? '***' + config.BOT_TOKEN.slice(-6) : 'NOT SET');
console.log('   ENCRYPTION_KEY:', config.ENCRYPTION_KEY ? 'SET' : 'NOT SET');
console.log('   DATABASE_URL:', config.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('   MAIN_BOT:', config.MAIN_BOT_NAME);
console.log('   ENVIRONMENT:', isDevelopment ? 'DEVELOPMENT 🚧' : 'PRODUCTION 🚀');

module.exports = config;