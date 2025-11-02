// start-railway.js - Railway-specific start script
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
    console.log(`⚠️  Setting ${key} manually (Railway issue)`);
    process.env[key] = manualEnv[key];
  } else {
    console.log(`✅ ${key} is set: ${process.env[key].substring(0, 10)}...`);
  }
});

console.log('✅ All environment variables ready');
console.log('🏃 Starting application...');

require('./src/app.js');