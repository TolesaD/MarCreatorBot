// TEMPORARY: Hardcoded values for testing
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');
console.log('🔧 TEMPORARY: Using hardcoded values for testing');

// Temporary hardcoded values - REPLACE WITH YOUR ACTUAL VALUES
process.env.DATABASE_URL = 'postgresql://postgres:kLpoExiXkvPvBYaSERToYbaavbHiawPs@trolley.proxy.rlwy.net:43180/railway';
process.env.BOT_TOKEN = 'your-actual-bot-token-here'; // REPLACE
process.env.ENCRYPTION_KEY = 'your-actual-encryption-key-here'; // REPLACE
process.env.MAIN_BOT_NAME = 'MarCreatorBot';
process.env.PORT = '8080';
process.env.NODE_ENV = 'production';

console.log('✅ DATABASE_URL: SET (hardcoded)');
console.log('✅ BOT_TOKEN: SET (hardcoded)'); 
console.log('✅ ENCRYPTION_KEY: SET (hardcoded)');
console.log('✅ All environment variables are set (temporary)');
console.log('🏃 Starting application from src/app.js...');

try {
  require('./src/app.js');
} catch (error) {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
}