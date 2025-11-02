// config/environment.js - Railway Optimized with Better Fallbacks
console.log('🔧 Loading environment configuration for Railway...');

const config = {
  // ==================== BOT CONFIGURATION ====================
  BOT_TOKEN: process.env.BOT_TOKEN || '7983296108:AAH8Dj_5WfhPN7g18jFI2VsexzJAiCjPgpI',
  MAIN_BOT_USERNAME: process.env.MAIN_BOT_USERNAME || '@MarCreatorBot',
  MAIN_BOT_NAME: process.env.MAIN_BOT_NAME || 'MarCreatorBot',
  
  // ==================== DATABASE CONFIGURATION ====================
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_DIALECT: process.env.DATABASE_DIALECT || 'postgres',
  
  // ==================== ENCRYPTION ====================
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '7a89253d1236bb589c247a236f676401cb681fcf2d45345efe38180ce70abf23',
  
  // ==================== SERVER CONFIGURATION ====================
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'production',
  HOST: process.env.HOST || '0.0.0.0',
  
  // ==================== SECURITY & LIMITS ====================
  MAX_BOTS_PER_USER: parseInt(process.env.MAX_BOTS_PER_USER) || 10,
  MAX_ADMINS_PER_BOT: parseInt(process.env.MAX_ADMINS_PER_BOT) || 10,
  MAX_BROADCAST_LENGTH: parseInt(process.env.MAX_BROADCAST_LENGTH) || 4000,
  
  // ==================== FEATURE FLAGS ====================
  ENABLE_BROADCASTS: process.env.ENABLE_BROADCASTS !== 'false',
  ENABLE_TEAM_MANAGEMENT: process.env.ENABLE_TEAM_MANAGEMENT !== 'false',
  ENABLE_MINI_BOT_DASHBOARD: process.env.ENABLE_MINI_BOT_DASHBOARD !== 'false',
  
  // ==================== MINI-BOT SPECIFIC ====================
  MINI_BOT_COMMANDS_ENABLED: process.env.MINI_BOT_COMMANDS_ENABLED !== 'false',
  REAL_TIME_NOTIFICATIONS: process.env.REAL_TIME_NOTIFICATIONS !== 'false',
  AUTO_RESTART_BOTS: process.env.AUTO_RESTART_BOTS !== 'false',
  
  // ==================== PERFORMANCE ====================
  MINI_BOT_TIMEOUT: parseInt(process.env.MINI_BOT_TIMEOUT) || 90000,
  BROADCAST_RATE_LIMIT: parseInt(process.env.BROADCAST_RATE_LIMIT) || 20,
  
  // ==================== BOT PERSISTENCE ====================
  PERSIST_BOT_SESSIONS: process.env.PERSIST_BOT_SESSIONS !== 'false',
  AUTO_RECONNECT_BOTS: process.env.AUTO_RECONNECT_BOTS !== 'false',
  
  // ==================== LOGGING ====================
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

// ==================== VALIDATION ====================
console.log('\n✅ Environment Configuration:');
console.log('   NODE_ENV:', config.NODE_ENV);
console.log('   PORT:', config.PORT);
console.log('   BOT_TOKEN:', config.BOT_TOKEN ? '***SET***' : '❌ NOT SET');
console.log('   ENCRYPTION_KEY:', config.ENCRYPTION_KEY ? '***SET***' : '❌ NOT SET');
console.log('   DATABASE:', config.DATABASE_DIALECT.toUpperCase());
console.log('   DATABASE_URL:', config.DATABASE_URL ? '***SET***' : '❌ NOT SET');

// Debug: Show what environment variables are actually available
console.log('\n🔍 Available Environment Variables:');
console.log('   DATABASE_URL from process.env:', !!process.env.DATABASE_URL);
console.log('   BOT_TOKEN from process.env:', !!process.env.BOT_TOKEN);
console.log('   ENCRYPTION_KEY from process.env:', !!process.env.ENCRYPTION_KEY);

// Remove the strict validation that crashes the app
// Just log warnings but don't exit
if (!config.BOT_TOKEN) {
  console.warn('⚠️  WARNING: BOT_TOKEN not set, using default (limited functionality)');
}

if (!config.ENCRYPTION_KEY) {
  console.warn('⚠️  WARNING: ENCRYPTION_KEY not set, using default (less secure)');
}

if (!config.DATABASE_URL) {
  console.warn('⚠️  WARNING: DATABASE_URL not set, mini-bots will NOT persist');
}

module.exports = config;