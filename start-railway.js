// Railway Startup Script - Debug Version
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');

// Debug: Check environment variables BEFORE any processing
console.log('🔍 DEBUG - Raw environment variables:');
console.log('   BOT_TOKEN length:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 'MISSING');
console.log('   ENCRYPTION_KEY length:', process.env.ENCRYPTION_KEY ? process.env.ENCRYPTION_KEY.length : 'MISSING');
console.log('   DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 'MISSING');
console.log('   DATABASE_URL value:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'MISSING');

// Function to strip quotes from environment variables
function stripQuotes(value) {
  if (typeof value === 'string') {
    console.log(`🔍 Processing: "${value.substring(0, 30)}..."`);
    const result = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    console.log(`🔍 Result: "${result.substring(0, 30)}..."`);
    return result;
  }
  return value;
}

// Process environment variables
console.log('🔄 Processing environment variables...');
process.env.BOT_TOKEN = stripQuotes(process.env.BOT_TOKEN);
process.env.ENCRYPTION_KEY = stripQuotes(process.env.ENCRYPTION_KEY);
process.env.DATABASE_URL = stripQuotes(process.env.DATABASE_URL);

console.log(`✅ NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`✅ PORT: ${process.env.PORT || 8080}`);

// Debug after processing
console.log('🔍 DEBUG - After processing:');
console.log('   BOT_TOKEN length:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 'MISSING');
console.log('   ENCRYPTION_KEY length:', process.env.ENCRYPTION_KEY ? process.env.ENCRYPTION_KEY.length : 'MISSING');
console.log('   DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 'MISSING');
console.log('   DATABASE_URL value:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'MISSING');

// Check environment variables
const missingVars = [];

if (!process.env.BOT_TOKEN) {
  missingVars.push('BOT_TOKEN');
  console.error('❌ BOT_TOKEN: Missing');
} else {
  console.log('✅ BOT_TOKEN: Set');
}

if (!process.env.ENCRYPTION_KEY) {
  missingVars.push('ENCRYPTION_KEY');
  console.error('❌ ENCRYPTION_KEY: Missing');
} else {
  console.log('✅ ENCRYPTION_KEY: Set');
}

if (!process.env.DATABASE_URL) {
  missingVars.push('DATABASE_URL');
  console.error('❌ DATABASE_URL: Missing');
} else {
  console.log('✅ DATABASE_URL: Set');
}

if (missingVars.length > 0) {
  console.error('\n💡 Missing variables:', missingVars.join(', '));
  process.exit(1);
}

console.log('✅ All environment variables are set');
console.log('🏃 Starting application from src/app.js...');

// Start the main application
require('./src/app.js');