// start-railway.js - PRODUCTION VERSION
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');
console.log('🔧 PRODUCTION: Railway Environment');

// Railway automatically provides these for PostgreSQL
const DATABASE_URL = process.env.DATABASE_URL;

console.log('🔍 Checking Railway Environment:');
console.log(`   RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'NOT SET'}`);
console.log(`   DATABASE_URL: ${DATABASE_URL ? 'SET (' + DATABASE_URL.length + ' chars)' : 'NOT SET'}`);

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found - Railway PostgreSQL not configured');
  console.error('💡 Please add PostgreSQL plugin in Railway dashboard');
  process.exit(1);
}

// For custom variables, we need to handle Railway's variable propagation issue
// Try multiple strategies to get custom variables
console.log('\n🔄 Resolving custom environment variables...');

// Strategy 1: Direct access (should work if Railway fixes their bug)
let BOT_TOKEN = process.env.BOT_TOKEN;
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
let MAIN_BOT_NAME = process.env.MAIN_BOT_NAME || 'MarCreatorBot';

console.log(`   Strategy 1 - BOT_TOKEN: ${BOT_TOKEN ? 'SET' : 'NOT SET'}`);
console.log(`   Strategy 1 - ENCRYPTION_KEY: ${ENCRYPTION_KEY ? 'SET' : 'NOT SET'}`);

// Strategy 2: Check if variables exist but are empty (Railway bug)
if (!BOT_TOKEN && process.env.BOT_TOKEN === '') {
  console.log('⚠️  BOT_TOKEN exists but is empty string (Railway bug)');
}

if (!ENCRYPTION_KEY && process.env.ENCRYPTION_KEY === '') {
  console.log('⚠️  ENCRYPTION_KEY exists but is empty string (Railway bug)');
}

// Final validation
if (!BOT_TOKEN) {
  console.error('\n❌ BOT_TOKEN is required but not set');
  console.error('💡 Railway Variables Setup:');
  console.error('   1. Go to Railway → Your Service → Variables');
  console.error('   2. Add: BOT_TOKEN=your_bot_token_here');
  console.error('   3. Add: ENCRYPTION_KEY=your_32_char_key_here');
  console.error('   4. Redeploy after setting variables');
  process.exit(1);
}

if (!ENCRYPTION_KEY) {
  console.error('\n❌ ENCRYPTION_KEY is required but not set');
  console.error('💡 This is needed to encrypt bot tokens in the database');
  process.exit(1);
}

// Validate encryption key length
if (ENCRYPTION_KEY.length < 32) {
  console.error('❌ ENCRYPTION_KEY must be at least 32 characters');
  process.exit(1);
}

console.log('\n✅ All required variables resolved:');
console.log(`   DATABASE_URL: SET (PostgreSQL connected)`);
console.log(`   BOT_TOKEN: SET (${BOT_TOKEN.length} chars)`);
console.log(`   ENCRYPTION_KEY: SET (${ENCRYPTION_KEY.length} chars)`);
console.log(`   MAIN_BOT_NAME: ${MAIN_BOT_NAME}`);
console.log(`   NODE_ENV: production`);

// Ensure all required variables are set in process.env
process.env.BOT_TOKEN = BOT_TOKEN;
process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
process.env.DATABASE_URL = DATABASE_URL;
process.env.MAIN_BOT_NAME = MAIN_BOT_NAME;
process.env.NODE_ENV = 'production';

console.log('🏃 Starting application from src/app.js...');

// Production error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  setTimeout(() => process.exit(1), 1000);
});

try {
  require('./src/app.js');
} catch (error) {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
}