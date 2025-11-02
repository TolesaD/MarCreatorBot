// start-railway.js - Updated for PostgreSQL
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('==================================');

// Manual fallback environment variables for Railway
const manualEnv = {
  BOT_TOKEN: '7983296108:AAH8Dj_5WfhPN7g18jFI2VsexzJAiCjPgpI',
  ENCRYPTION_KEY: '7a89253d1236bb589c247a236f676401cb681fcf2d45345efe38180ce70abf23',
  DATABASE_DIALECT: 'postgres',
  NODE_ENV: 'production',
  PORT: '3000'
};

// Apply manual environment variables if not set
Object.keys(manualEnv).forEach(key => {
  if (!process.env[key]) {
    console.log(`⚠️  Setting ${key} manually`);
    process.env[key] = manualEnv[key];
  } else {
    console.log(`✅ ${key} is set`);
  }
});

// Check if DATABASE_URL is set (Railway provides this automatically for PostgreSQL)
if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL not set - PostgreSQL database not connected');
  console.log('💡 Please add PostgreSQL database in Railway Dashboard');
  console.log('   Railway → New → Database → PostgreSQL');
} else {
  console.log('✅ DATABASE_URL is set - PostgreSQL connected');
}

console.log('✅ All environment variables ready');
console.log('🏃 Starting application...');

require('./src/app.js');