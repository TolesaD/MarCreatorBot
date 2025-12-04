// start-cpanel.js - Yegara.com Specific Startup
console.log('🚀 BotomicsBot - Yegara.com Deployment');
console.log('========================================');

// cPanel specific environment setup
const isCpanel = process.env.HOME && process.env.HOME.includes('/home/');

if (isCpanel) {
  console.log('✅ Running on cPanel/Yegara.com environment');
  console.log('   Home directory:', process.env.HOME);
} else {
  console.log('⚠️  Not running on cPanel - using development mode');
}

// Load environment variables
require('dotenv').config();

console.log('🔍 Environment Check:');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'production');
console.log('   PORT:', process.env.PORT || 3000);
console.log('   BOT_TOKEN:', process.env.BOT_TOKEN ? 'SET' : 'MISSING');
console.log('   ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? 'SET' : 'MISSING');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');

// Validate required environment variables
const requiredVars = ['BOT_TOKEN', 'ENCRYPTION_KEY', 'DATABASE_URL'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n💡 How to fix on Yegara.com:');
  console.error('   1. Go to cPanel → Environment Variables');
  console.error('   2. Add these variables:');
  console.error('      - BOT_TOKEN');
  console.error('      - ENCRYPTION_KEY');
  console.error('      - DATABASE_URL');
  console.error('   3. Set their values');
  process.exit(1);
}

console.log('✅ All environment variables validated');
console.log('🏃 Starting application...');

// Start the application
try {
  require('./src/app.js');
  console.log('✅ Application started successfully on Yegara.com!');
} catch (error) {
  console.error('❌ Failed to start application:', error.message);
  process.exit(1);
}