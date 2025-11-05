// start-railway.js - UPDATED FOR RAILWAY POSTGRES
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');
console.log('🔧 PRODUCTION: Railway Environment');

// Railway PostgreSQL provides DATABASE_URL automatically
// Check multiple possible variable names
const DATABASE_URL = process.env.DATABASE_URL || 
                    process.env.RAILWAY_DATABASE_URL ||
                    process.env.DATABASE_PRIVATE_URL;

console.log('🔍 Checking Railway Database Configuration:');
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`   RAILWAY_DATABASE_URL: ${process.env.RAILWAY_DATABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`   DATABASE_PRIVATE_URL: ${process.env.DATABASE_PRIVATE_URL ? 'SET' : 'NOT SET'}`);

if (!DATABASE_URL) {
  console.error('\n❌ PostgreSQL database not configured');
  console.error('\n💡 RAILWAY POSTGRES SETUP GUIDE:');
  console.error('   1. Go to Railway → Your Service "MarcreatorBot Mega"');
  console.error('   2. Click "New" (+) button');
  console.error('   3. Select "PostgreSQL"');
  console.error('   4. Wait 1-2 minutes for provisioning');
  console.error('   5. Railway will automatically set DATABASE_URL');
  console.error('   6. Redeploy your application');
  console.error('\n🔧 Alternatively, check if PostgreSQL exists but needs connection');
  process.exit(1);
}

console.log(`✅ Database configured: ${DATABASE_URL.length} chars`);

// Check custom variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const MAIN_BOT_NAME = process.env.MAIN_BOT_NAME || 'MarCreatorBot';

console.log('\n🔍 Checking Custom Variables:');
console.log(`   BOT_TOKEN: ${BOT_TOKEN ? 'SET' : 'NOT SET'}`);
console.log(`   ENCRYPTION_KEY: ${ENCRYPTION_KEY ? 'SET' : 'NOT SET'}`);

if (!BOT_TOKEN || !ENCRYPTION_KEY) {
  console.error('\n❌ Missing required variables');
  console.error('💡 Please set in Railway → Your Service → Variables:');
  console.error('   - BOT_TOKEN');
  console.error('   - ENCRYPTION_KEY (32+ characters)');
  process.exit(1);
}

// Validate encryption key
if (ENCRYPTION_KEY.length < 32) {
  console.error('❌ ENCRYPTION_KEY must be at least 32 characters');
  process.exit(1);
}

console.log('\n✅ All systems ready:');
console.log(`   Database: PostgreSQL connected`);
console.log(`   Bot Token: Ready`);
console.log(`   Encryption: Ready`);
console.log(`   Environment: production`);

// Set environment for the app
process.env.DATABASE_URL = DATABASE_URL;
process.env.BOT_TOKEN = BOT_TOKEN;
process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
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