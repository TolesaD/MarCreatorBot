// start-railway.js - SAFE VERSION (No Variable Modification)
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');
console.log('🔧 SAFE: No environment variable modification');

// Debug: Show actual environment state
console.log('🔍 Environment Variable Analysis:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   PORT: ${process.env.PORT || 8080}`);
console.log(`   BOT_TOKEN length: ${process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 'MISSING'}`);
console.log(`   ENCRYPTION_KEY length: ${process.env.ENCRYPTION_KEY ? process.env.ENCRYPTION_KEY.length : 'MISSING'}`);
console.log(`   DATABASE_URL length: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 'MISSING'}`);

// Check for required variables WITHOUT modifying them
const missingVars = [];
const invalidVars = [];

if (!process.env.BOT_TOKEN) {
  missingVars.push('BOT_TOKEN');
} else if (process.env.BOT_TOKEN.length < 40) {
  invalidVars.push(`BOT_TOKEN (too short: ${process.env.BOT_TOKEN.length} chars)`);
}

if (!process.env.ENCRYPTION_KEY) {
  missingVars.push('ENCRYPTION_KEY');
} else if (process.env.ENCRYPTION_KEY.length < 40) {
  invalidVars.push(`ENCRYPTION_KEY (too short: ${process.env.ENCRYPTION_KEY.length} chars)`);
}

if (!process.env.DATABASE_URL) {
  missingVars.push('DATABASE_URL');
} else if (process.env.DATABASE_URL.length < 50) {
  invalidVars.push(`DATABASE_URL (too short: ${process.env.DATABASE_URL.length} chars)`);
}

// Report issues
if (missingVars.length > 0) {
  console.error('❌ Missing required variables:', missingVars.join(', '));
}

if (invalidVars.length > 0) {
  console.error('❌ Invalid variables (too short):', invalidVars.join(', '));
  console.error('💡 This usually means Railway added quotes or formatting');
  console.error('💡 Check your Railway variables - remove any extra quotes');
}

if (missingVars.length > 0 || invalidVars.length > 0) {
  console.error('\n🚨 RAILWAY VARIABLE SETUP:');
  console.error('   1. Go to Railway → Your Service → Settings → Variables');
  console.error('   2. Check these variables have correct values:');
  console.error('      - BOT_TOKEN: Should be ~46 characters (from BotFather)');
  console.error('      - ENCRYPTION_KEY: Should be 44 characters (base64)');
  console.error('      - DATABASE_URL: Should be ~91 characters');
  console.error('   3. Remove any surrounding quotes from values');
  console.error('   4. Redeploy after changes');
  process.exit(1);
}

console.log('✅ All environment variables validated');
console.log(`   BOT_TOKEN: ***${process.env.BOT_TOKEN.slice(-6)}`);
console.log(`   ENCRYPTION_KEY: Valid (${process.env.ENCRYPTION_KEY.length} chars)`);
console.log(`   DATABASE_URL: Valid (${process.env.DATABASE_URL.length} chars)`);

console.log('🏃 Starting application from src/app.js...');

try {
  // Start the application WITHOUT modifying environment variables
  require('./src/app.js');
  console.log('✅ Application started successfully!');
} catch (error) {
  console.error('❌ Failed to start application:');
  console.error('   Error:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}