// Railway Startup Script
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');
console.log('🔧 CRITICAL: This version includes fixes for mini-bot persistence');

// Function to strip quotes from environment variables (for Railway auto-quoting)
function stripQuotes(value) {
  if (typeof value === 'string') {
    return value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
  return value;
}

// Process environment variables
process.env.BOT_TOKEN = stripQuotes(process.env.BOT_TOKEN);
process.env.ENCRYPTION_KEY = stripQuotes(process.env.ENCRYPTION_KEY);
process.env.DATABASE_URL = stripQuotes(process.env.DATABASE_URL);
process.env.MAIN_BOT_NAME = stripQuotes(process.env.MAIN_BOT_NAME);
process.env.MAIN_BOT_USERNAME = stripQuotes(process.env.MAIN_BOT_USERNAME);

console.log(`✅ NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`✅ PORT: ${process.env.PORT || 8080}`);

// Debug: Show variable status (masked for security)
console.log(`🔧 BOT_TOKEN: ${process.env.BOT_TOKEN ? 'SET (' + process.env.BOT_TOKEN.length + ' chars)' : 'MISSING'}`);
console.log(`🔧 ENCRYPTION_KEY: ${process.env.ENCRYPTION_KEY ? 'SET (' + process.env.ENCRYPTION_KEY.length + ' chars)' : 'MISSING'}`);
console.log(`🔧 DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'MISSING'}`);

// Check required environment variables
const missingVars = [];

if (!process.env.BOT_TOKEN) {
  missingVars.push('BOT_TOKEN');
  console.error('❌ BOT_TOKEN: Missing - Your main bot token from BotFather');
} else {
  console.log('✅ BOT_TOKEN: Set');
}

if (!process.env.ENCRYPTION_KEY) {
  missingVars.push('ENCRYPTION_KEY');
  console.error('❌ ENCRYPTION_KEY: Missing - A 32-character random string for encryption');
} else {
  console.log('✅ ENCRYPTION_KEY: Set');
}

if (!process.env.DATABASE_URL) {
  missingVars.push('DATABASE_URL');
  console.error('❌ DATABASE_URL: Missing - PostgreSQL database URL (auto-provided by Railway)');
} else {
  console.log('✅ DATABASE_URL: Set');
}

if (missingVars.length > 0) {
  console.error('\n💡 HOW TO FIX:');
  console.error('   1. Go to your Railway project dashboard: https://railway.app');
  console.error('   2. Click on your project');
  console.error('   3. Go to the "Variables" tab');
  console.error('   4. Add the missing variables: ' + missingVars.join(', '));
  console.error('   5. Railway will automatically redeploy');
  
  process.exit(1);
}

console.log('✅ All environment variables are set');
console.log('🏃 Starting application from src/app.js...');

// Start the main application - CORRECT PATH
require('./src/app.js');