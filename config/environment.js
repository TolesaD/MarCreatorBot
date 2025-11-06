console.log('🔧 CRITICAL: This version handles Railway auto-quoting and undefined envs');

// Utility: strip quotes and invalid placeholders
function cleanEnv(value) {
  if (!value) return undefined;
  const cleaned = value.replace(/^['"]|['"]$/g, '').trim();
  if (cleaned.toLowerCase() === 'undefined' || cleaned.toLowerCase() === 'null' || cleaned === '') {
    return undefined;
  }
  return cleaned;
}

// Normalize all possible sources
let rawDatabaseUrl = cleanEnv(process.env.DATABASE_URL) || cleanEnv(process.env.RAILWAY_DATABASE_URL);
let rawBotToken = cleanEnv(process.env.BOT_TOKEN);
let rawEncryptionKey = cleanEnv(process.env.ENCRYPTION_KEY);

const config = {
  // ============ BOT CONFIGURATION ============
  BOT_TOKEN: rawBotToken,
  MAIN_BOT_USERNAME: process.env.MAIN_BOT_USERNAME || '@MarCreatorBot',
  MAIN_BOT_NAME: process.env.MAIN_BOT_NAME || 'MarCreatorBot',
  WEBHOOK_URL: process.env.WEBHOOK_URL || `https://${process.env.RAILWAY_STATIC_URL || `localhost:${process.env.PORT || 3000}`}`,

  // ============ DATABASE ============
  DATABASE_URL: rawDatabaseUrl,
  DATABASE_DIALECT: 'postgres',

  // ============ DATABASE POOL ============
  DATABASE_POOL_MAX: parseInt(process.env.DATABASE_POOL_MAX) || 20,
  DATABASE_POOL_IDLE: parseInt(process.env.DATABASE_POOL_IDLE) || 30000,
  DATABASE_POOL_ACQUIRE: parseInt(process.env.DATABASE_POOL_ACQUIRE) || 60000,

  // ============ SECURITY ============
  ENCRYPTION_KEY: rawEncryptionKey,

  // ============ SERVER ============
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'production',
  HOST: process.env.HOST || '0.0.0.0',

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

// ============ DEBUG OUTPUT ============
console.log('✅ NODE_ENV:', config.NODE_ENV);
console.log('✅ PORT:', config.PORT);
console.log('🔧 BOT_TOKEN length:', config.BOT_TOKEN ? config.BOT_TOKEN.length : 'MISSING');
console.log('🔧 ENCRYPTION_KEY length:', config.ENCRYPTION_KEY ? config.ENCRYPTION_KEY.length : 'MISSING');
console.log('🔧 DATABASE_URL:', config.DATABASE_URL ? 'SET' : 'NOT SET');

// Fallback check
if (!config.DATABASE_URL) {
  console.error('❌ DATABASE_URL missing — checking Railway fallback...');
  if (process.env.RAILWAY_DATABASE_URL) {
    config.DATABASE_URL = cleanEnv(process.env.RAILWAY_DATABASE_URL);
    console.log('🔧 Using RAILWAY_DATABASE_URL fallback');
  } else {
    console.error('💥 No valid DATABASE_URL found. Exiting...');
    process.exit(1);
  }
}

// Final sanity log
console.log(
  '🔍 Final DATABASE_URL before app start =',
  config.DATABASE_URL ? config.DATABASE_URL.substring(0, 30) + '...' : 'undefined'
);

module.exports = config;
