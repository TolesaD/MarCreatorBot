// start-railway.js - PRODUCTION WORKING VERSION
console.log('🚀 MarCreatorBot - Production Startup');
console.log('=====================================');

// Enhanced environment variable debugging
console.log('🔍 Environment Analysis:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   PORT:', process.env.PORT);
console.log('   RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('   RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL);

// Check if we're actually running on Railway
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL;

if (!isRailway) {
  console.log('⚠️  Running in non-Railway environment');
}

// Check required variables with better validation
const requiredVars = [
  { name: 'BOT_TOKEN', minLength: 40, description: 'Telegram Bot Token' },
  { name: 'ENCRYPTION_KEY', minLength: 40, description: 'Encryption Key' },
  { name: 'DATABASE_URL', minLength: 50, description: 'Database URL' }
];

let allVarsValid = true;

for (const { name, minLength, description } of requiredVars) {
  const value = process.env[name];
  
  if (!value) {
    console.error(`❌ ${name}: MISSING - ${description}`);
    allVarsValid = false;
  } else if (value.length < minLength) {
    console.error(`❌ ${name}: TOO SHORT (${value.length} chars, need ${minLength}+) - ${description}`);
    allVarsValid = false;
  } else {
    console.log(`✅ ${name}: SET (${value.length} chars)`);
  }
}

if (!allVarsValid) {
  console.error('\n🚨 RAILWAY CONFIGURATION REQUIRED:');
  console.error('   1. Go to Railway Dashboard');
  console.error('   2. Click on your SERVICE (not project)');
  console.error('   3. Go to Settings → Variables');
  console.error('   4. Add these exact variable names:');
  console.error('      - BOT_TOKEN: Your Telegram bot token');
  console.error('      - ENCRYPTION_KEY: Your encryption key');
  console.error('      - DATABASE_URL: Railway auto-provides this');
  console.error('   5. Redeploy after saving');
  console.error('\n💡 If DATABASE_URL is missing, Railway may not have provisioned a database');
  process.exit(1);
}

console.log('✅ All environment variables validated');
console.log('🏃 Starting application...');

// Start the application
try {
  require('./src/app.js');
} catch (error) {
  console.error('❌ Failed to start application:', error.message);
  process.exit(1);
}