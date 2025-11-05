const config = {
  // ==================== BOT CONFIGURATION ====================
  BOT_TOKEN: process.env.BOT_TOKEN,
  MAIN_BOT_USERNAME: process.env.MAIN_BOT_USERNAME || '@MarCreatorBot',
  MAIN_BOT_NAME: process.env.MAIN_BOT_NAME || 'MarCreatorBot',
  WEBHOOK_URL: process.env.WEBHOOK_URL || `https://${process.env.RAILWAY_STATIC_URL || `localhost:${process.env.PORT || 3000}`}`,
  
  // ==================== DATABASE CONFIGURATION ====================
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_DIALECT: 'postgres',
  
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

// ==================== EXPORT CONFIGURATION ====================

console.log('🔧 Loading environment configuration...');

// ==================== ENHANCED DEBUGGING ====================

console.log('🔧 ENHANCED DEBUG: Environment Variables');
console.log('=========================================');
console.log('DATABASE_URL from process.env:', process.env.DATABASE_URL);
console.log('DATABASE_URL type:', typeof process.env.DATABASE_URL);
console.log('DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0);

if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL first 50 chars:', process.env.DATABASE_URL.substring(0, 50));
  console.log('DATABASE_URL last 20 chars:', process.env.DATABASE_URL.substring(process.env.DATABASE_URL.length - 20));
}

console.log('MAIN_BOT_NAME:', process.env.MAIN_BOT_NAME);
console.log('BOT_TOKEN length:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0);
console.log('ENCRYPTION_KEY length:', process.env.ENCRYPTION_KEY ? process.env.ENCRYPTION_KEY.length : 0);
console.log('=========================================');

// ==================== VALIDATION & POST-PROCESSING ====================

// Better DATABASE_URL handling
if (!config.DATABASE_URL) {
  console.error('❌ DATABASE_URL is required but not set');
  console.error('💡 Check Railway environment variables:');
  console.error('   - Go to your project → Settings → Variables');
  console.error('   - Ensure DATABASE_URL is set');
  
  // Try to get from Railway's default environment variable
  if (process.env.RAILWAY_DATABASE_URL) {
    console.log('🔧 Using RAILWAY_DATABASE_URL instead');
    config.DATABASE_URL = process.env.RAILWAY_DATABASE_URL;
  } else {
    console.error('💥 No DATABASE_URL available');
    if (config.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// Webhook URL fix for Railway
if (config.NODE_ENV === 'production' && !config.WEBHOOK_URL.includes('https')) {
  console.warn('⚠️  WARNING: Production webhook URL should use HTTPS for security');
  // Auto-fix for Railway
  if (process.env.RAILWAY_STATIC_URL) {
    config.WEBHOOK_URL = `https://${process.env.RAILWAY_STATIC_URL}`;
    console.log('🔧 Auto-fixed WEBHOOK_URL for Railway:', config.WEBHOOK_URL);
  }
}

module.exports = config;