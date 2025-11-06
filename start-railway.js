// start-railway.js - PRODUCTION VERSION
console.log('🚀 MarCreatorBot - Production Startup');
console.log('=====================================');

// Debug to see what Railway is actually providing
console.log('🔍 Railway Environment Analysis:');
console.log('   RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT || 'NOT SET');
console.log('   RAILWAY_SERVICE_NAME:', process.env.RAILWAY_SERVICE_NAME || 'NOT SET');
console.log('   RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL || 'NOT SET');

// Check our required variables
const requiredVars = ['BOT_TOKEN', 'DATABASE_URL', 'ENCRYPTION_KEY'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ CRITICAL: Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n💡 RAILWAY SETUP INSTRUCTIONS:');
  console.error('   1. Go to your Railway project');
  console.error('   2. Click on your SERVICE (not the project)');
  console.error('   3. Go to Settings → Variables');
  console.error('   4. Add these exact variable names:');
  console.error('      - BOT_TOKEN');
  console.error('      - DATABASE_URL'); 
  console.error('      - ENCRYPTION_KEY');
  console.error('   5. Redeploy after adding variables');
  process.exit(1);
}

console.log('✅ All required environment variables are set');
console.log(`   BOT_TOKEN: ***${process.env.BOT_TOKEN.slice(-6)}`);
console.log(`   DATABASE_URL: ***${process.env.DATABASE_URL.split('@')[1]}`);
console.log(`   ENCRYPTION_KEY: SET`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'production'}`);
console.log(`   PORT: ${process.env.PORT || 8080}`);

// Start application
(async () => {
  console.log('🏃 Starting application...');
  
  try {
    // Import the main application
    const MetaBotCreator = require('./src/app.js');
    
    console.log('🔧 Creating bot instance...');
    const app = new MetaBotCreator();
    
    console.log('🔄 Initializing application...');
    await app.initialize();
    
    console.log('🚀 Starting bot...');
    app.start();
    
    console.log('✅ MarCreatorBot is now LIVE in production!');
    
  } catch (error) {
    console.error('❌ Startup failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
})();