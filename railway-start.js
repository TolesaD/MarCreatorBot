// railway-start.js - Simple start script for Railway
console.log('🚀 Starting MarCreatorBot on Railway...');

// Check if required environment variables are set
if (!process.env.BOT_TOKEN) {
  console.error('❌ CRITICAL: BOT_TOKEN environment variable is not set!');
  console.error('💡 Please set BOT_TOKEN in Railway Dashboard → Variables → Plaintext');
  process.exit(1);
}

if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ CRITICAL: ENCRYPTION_KEY environment variable is not set!');
  console.error('💡 Please set ENCRYPTION_KEY in Railway Dashboard → Variables → Plaintext');
  process.exit(1);
}

console.log('✅ Environment variables check passed');
console.log('🏃 Starting main application...');

// Start the main app
require('./src/app.js');