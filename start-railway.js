// Railway Startup - Ultra Minimal Version
console.log('🚀 MarCreatorBot - Railway Startup');

// CRITICAL: NO environment variable processing
// Just log what we receive from Railway
console.log('🔍 Raw Environment Variables from Railway:');
console.log('   BOT_TOKEN exists:', !!process.env.BOT_TOKEN);
console.log('   ENCRYPTION_KEY exists:', !!process.env.ENCRYPTION_KEY);
console.log('   DATABASE_URL exists:', !!process.env.DATABASE_URL);

if (process.env.DATABASE_URL) {
  console.log('   DATABASE_URL length:', process.env.DATABASE_URL.length);
  console.log('   DATABASE_URL value:', process.env.DATABASE_URL);
} else {
  console.log('❌ DATABASE_URL is missing from Railway');
  process.exit(1);
}

// Simple check - if DATABASE_URL is corrupted, exit immediately
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'undefined' || process.env.DATABASE_URL.length < 20) {
  console.error('❌ DATABASE_URL is corrupted or invalid');
  console.error('   Current value:', process.env.DATABASE_URL);
  console.error('💡 Check Railway Variables - DATABASE_URL should be a PostgreSQL connection string');
  process.exit(1);
}

console.log('✅ Environment variables received from Railway');
console.log('🏃 Starting application...');

// Start the main application
require('./src/app.js');