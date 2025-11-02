// Railway Startup Script
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');

// Set basic environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || 8080;

console.log(`✅ NODE_ENV is set: ${process.env.NODE_ENV}`);
console.log(`✅ PORT is set: ${process.env.PORT}`);

// Check environment variables with better error messages
const missingVars = [];

if (!process.env.BOT_TOKEN) {
  missingVars.push('BOT_TOKEN');
  console.error('❌ BOT_TOKEN: Missing - Your main bot token from BotFather');
}

if (!process.env.ENCRYPTION_KEY) {
  missingVars.push('ENCRYPTION_KEY');
  console.error('❌ ENCRYPTION_KEY: Missing - A 32-character random string for encryption');
}

if (!process.env.DATABASE_URL) {
  missingVars.push('DATABASE_URL');
  console.error('❌ DATABASE_URL: Missing - PostgreSQL database URL (auto-provided by Railway)');
}

if (missingVars.length > 0) {
  console.error('\n💡 HOW TO FIX:');
  console.error('   1. Go to your Railway project dashboard: https://railway.app');
  console.error('   2. Click on your project');
  console.error('   3. Go to the "Variables" tab');
  console.error('   4. Add the following variables:');
  console.error('');
  
  if (missingVars.includes('BOT_TOKEN')) {
    console.error('   BOT_TOKEN:');
    console.error('   - Get this from @BotFather on Telegram');
    console.error('   - Command: /newbot');
    console.error('   - Example: 1234567890:ABCdefGHIjklMNopQRstUVwxYZ');
    console.error('');
  }
  
  if (missingVars.includes('ENCRYPTION_KEY')) {
    console.error('   ENCRYPTION_KEY:');
    console.error('   - Generate a random 32-character string');
    console.error('   - You can use: https://randomkeygen.com/');
    console.error('   - Example: MySuperSecretEncryptionKey123!');
    console.error('');
  }
  
  if (missingVars.includes('DATABASE_URL')) {
    console.error('   DATABASE_URL:');
    console.error('   - This is automatically provided by Railway');
    console.error('   - Go to your project, click "New", then "Database"');
    console.error('   - Select "PostgreSQL"');
    console.error('   - Railway will automatically add DATABASE_URL');
    console.error('');
  }
  
  console.error('   5. After adding variables, Railway will automatically redeploy');
  console.error('   6. Your bot should then start successfully');
  
  process.exit(1);
}

console.log('✅ All environment variables are set');
console.log('🏃 Starting application...');

// Start the main application
require('./app.js');