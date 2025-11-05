#!/usr/bin/env node

console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');

// Detect environment
const isProduction = process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';
console.log(`🔧 ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}: Railway Environment`);

console.log('🔍 Checking Railway Environment:');
console.log(`   RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'NOT SET'}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '[SET]' : 'NOT SET'}`);  // Hide full URL for security

// Optional: Debug nearby vars
if (!process.env.DATABASE_URL && isProduction) {
  console.log('=== DEBUG: Nearby Env Vars ===');
  Object.keys(process.env).forEach(key => {
    if (key.toLowerCase().includes('db') || key.toLowerCase().includes('postgre') || key.toLowerCase().includes('railway')) {
      console.log(`   ${key}: ${process.env[key] ? '[PRESENT]' : 'MISSING'}`);
    }
  });
  console.log('=== END DEBUG ===');
}

// Check for DB URL in production
if (isProduction && !process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found - Railway PostgreSQL not configured');
  console.log('💡 Please add/link PostgreSQL plugin in Railway dashboard: https://docs.railway.app/databases/postgresql');
  console.log('💡 Or set manually in Variables tab (but auto-link is recommended).');
  process.exit(1);  // Exit only after full debug
} else if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL detected - Proceeding to app startup...');
}

// Proceed to start your main app (e.g., require('./app.js') or server.listen())
console.log('===================================');
console.log('🔥 Starting main application...');

// Example: Import and start your bot/server here
// require('./your-main-file.js');
// Or if this is the entry, add your bot logic below

// Placeholder - replace with your actual startup
// e.g., const bot = require('./bot'); bot.start();
console.log('✅ Startup complete! (Add your bot init here)');