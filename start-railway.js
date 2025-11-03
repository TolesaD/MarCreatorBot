// Railway Startup Script - Quote Handling Version
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');
console.log('🔧 CRITICAL: This version handles Railway auto-quoting');

// Function to strip quotes from environment variables
function stripQuotes(value) {
  if (typeof value === 'string') {
    // Remove surrounding quotes if present
    return value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
  return value;
}

// Process environment variables (strip quotes)
process.env.BOT_TOKEN = stripQuotes(process.env.BOT_TOKEN);
process.env.ENCRYPTION_KEY = stripQuotes(process.env.ENCRYPTION_KEY);
process.env.DATABASE_URL = stripQuotes(process.env.DATABASE_URL);
process.env.MAIN_BOT_NAME = stripQuotes(process.env.MAIN_BOT_NAME);
process.env.MAIN_BOT_USERNAME = stripQuotes(process.env.MAIN_BOT_USERNAME);

console.log(`✅ NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`✅ PORT: ${process.env.PORT || 8080}`);

// Debug: Show actual values (masked)
console.log(`🔧 BOT_TOKEN length: ${process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 'MISSING'}`);
console.log(`🔧 ENCRYPTION_KEY length: ${process.env.ENCRYPTION_KEY ? process.env.ENCRYPTION_KEY.length : 'MISSING'}`);
console.log(`🔧 DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'MISSING'}`);

// Check environment variables
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
  console.error('   1. Railway automatically adds quotes to values with special characters');
  console.error('   2. This code now automatically strips quotes');
  console.error('   3. Check your Railway variables for any syntax issues');
  console.error('   4. Missing variables: ' + missingVars.join(', '));
  
  process.exit(1);
}

console.log('✅ All environment variables are set');
console.log('🏃 Starting application...');

// Start the main application
require('./app.js');