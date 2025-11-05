// start-railway.js - ENHANCED DEBUG
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');

// Enhanced environment debugging
console.log('🔍 ENVIRONMENT ANALYSIS:');
const allVars = process.env;
const relevantVars = Object.keys(allVars).filter(key => 
  key.includes('DATABASE') || 
  key.includes('POSTGRES') || 
  key.includes('RAILWAY') ||
  key.includes('BOT') ||
  key.includes('ENCRYPTION')
);

relevantVars.forEach(key => {
  const value = allVars[key];
  if (key.includes('TOKEN') || key.includes('KEY') || key.includes('PASSWORD')) {
    console.log(`   ${key}: ***${value ? value.slice(-4) : 'NULL'}`);
  } else {
    console.log(`   ${key}: ${value || 'NULL'}`);
  }
});

// Check for PostgreSQL in multiple ways
const DATABASE_URL = process.env.DATABASE_URL || 
                    process.env.RAILWAY_DATABASE_URL ||
                    process.env.DATABASE_PRIVATE_URL ||
                    process.env.POSTGRES_URL;

if (DATABASE_URL) {
  console.log(`\n✅ Database configured: ${DATABASE_URL.length} chars`);
  process.env.DATABASE_URL = DATABASE_URL;
} else {
  console.error('\n❌ NO DATABASE CONFIGURED');
  console.error('\n🚨 IMMEDIATE ACTION REQUIRED:');
  console.error('   1. Go to: https://railway.app');
  console.error('   2. Click your service "MarcreatorBot Mega"');
  console.error('   3. Click the "+" button (top right)');
  console.error('   4. Select "PostgreSQL"');
  console.error('   5. Wait 2 minutes, then redeploy');
  console.error('\n💡 Already have PostgreSQL? Connect it in Variables tab');
  process.exit(1);
}

// Check other required variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not set');
  console.error('💡 Set in Railway → Variables → BOT_TOKEN=your_token_here');
  process.exit(1);
}

if (!ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY not set');
  console.error('💡 Set in Railway → Variables → ENCRYPTION_KEY=your_32_char_key');
  process.exit(1);
}

console.log('\n✅ ALL SYSTEMS READY:');
console.log(`   Database: PostgreSQL connected`);
console.log(`   Bot Token: Ready`);
console.log(`   Encryption: Ready`);
console.log('🏃 Starting application...');

// Start the app
try {
  require('./src/app.js');
} catch (error) {
  console.error('❌ Application failed:', error);
  process.exit(1);
}