// start-railway.js - PRODUCTION VERSION
console.log('🚀 MarCreatorBot - Production Startup');
console.log('=====================================');

// Validate critical environment variables
const requiredEnvVars = ['BOT_TOKEN', 'DATABASE_URL', 'ENCRYPTION_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('💡 Please set these in Railway project → Settings → Variables');
  process.exit(1);
}

console.log('✅ Environment check passed');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'production'}`);
console.log(`   PORT: ${process.env.PORT || 8080}`);

// Start application
(async () => {
  console.log('🏃 Starting application...');
  
  try {
    const { startApplication } = require('./src/app.js');
    await startApplication();
    
    console.log('✅ MarCreatorBot is now LIVE in production!');
    
  } catch (error) {
    console.error('❌ Startup failed:', error.message);
    process.exit(1);
  }
})();