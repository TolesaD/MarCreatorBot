// start-railway.js - Updated to be more resilient
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('==================================');

// Load config FIRST
const config = require('./config/environment');

// Now check critical environment variables through config
console.log('🔍 Environment Check:');

if (config.DATABASE_URL) {
  console.log('✅ DATABASE_URL is set - PostgreSQL connected');
  console.log('✅ Mini-bots will persist across deployments');
} else {
  console.log('❌ DATABASE_URL not set - PostgreSQL database not connected');
  console.log('🚨 CRITICAL: Mini-bots will NOT persist across deployments!');
  console.log('💡 Railway should automatically set DATABASE_URL for PostgreSQL databases');
}

console.log('✅ Starting application...');

require('./src/app.js');