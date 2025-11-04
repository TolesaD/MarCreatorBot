// Railway Startup - Minimal Version (NO PROCESSING)
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');

// CRITICAL: Do NOT process environment variables
// Just check if they exist
console.log('🔍 Environment Variables Status:');
console.log('   BOT_TOKEN:', process.env.BOT_TOKEN ? `SET (${process.env.BOT_TOKEN.length} chars)` : 'MISSING');
console.log('   ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? `SET (${process.env.ENCRYPTION_KEY.length} chars)` : 'MISSING');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? `SET (${process.env.DATABASE_URL.length} chars)` : 'MISSING');

if (process.env.DATABASE_URL) {
  console.log('   DATABASE_URL starts with:', process.env.DATABASE_URL.substring(0, 25));
  console.log('   DATABASE_URL contains postgres:', process.env.DATABASE_URL.includes('postgres'));
}

// Simple validation
if (!process.env.BOT_TOKEN || !process.env.ENCRYPTION_KEY || !process.env.DATABASE_URL) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Additional DATABASE_URL validation
if (!process.env.DATABASE_URL.includes('postgres')) {
  console.error('❌ DATABASE_URL is not a PostgreSQL connection string');
  console.error('   Current value:', process.env.DATABASE_URL);
  process.exit(1);
}

console.log('✅ All environment variables are valid');
console.log('🏃 Starting application from src/app.js...');

// Start the main application
require('./src/app.js');