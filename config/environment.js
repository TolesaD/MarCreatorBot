const path = require('path');
// Only load .env in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const config = {
  // ==================== BOT CONFIGURATION ====================
  BOT_TOKEN: process.env.BOT_TOKEN,
  MAIN_BOT_USERNAME: process.env.MAIN_BOT_USERNAME || '@MarCreatorBot',
  MAIN_BOT_NAME: process.env.MAIN_BOT_NAME || 'MarCreatorBot',
  WEBHOOK_URL: process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT || 3000}`,
  
  // ==================== DATABASE CONFIGURATION ====================
  // CRITICAL FIX: Prefer PostgreSQL in production
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_DIALECT: process.env.DATABASE_DIALECT || (process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite'),
  DB_PATH: process.env.DB_PATH || './metabot_creator.db',
  
  // ... rest of your config remains the same
};

// ==================== VALIDATION & POST-PROCESSING ====================

// Validate required environment variables
const required = ['BOT_TOKEN', 'ENCRYPTION_KEY'];
required.forEach(key => {
  if (!config[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    if (config.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn(`⚠️  ${key} is missing but continuing in development mode`);
    }
  }
});

// CRITICAL FIX: Better PostgreSQL detection for Railway
if (config.NODE_ENV === 'production') {
  // Railway automatically provides DATABASE_URL for PostgreSQL
  if (process.env.DATABASE_URL) {
    config.DATABASE_DIALECT = 'postgres';
    console.log('🚀 Production: Using PostgreSQL (Railway)');
  }
  
  // Production optimizations
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
console.log('   DATABASE:', config.DATABASE_DIALECT.toUpperCase());
console.log('   DATABASE_URL:', config.DATABASE_DIALECT === 'sqlite' ? config.DB_PATH : '***postgres***');

module.exports = config;