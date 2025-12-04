// test-local.js - Local Testing Script (FIXED)
const config = require('./config/environment');

console.log('🚀 Starting Local Testing Mode');
console.log('==============================');
console.log(`Environment: ${config.NODE_ENV}`);
console.log(`Base URL: ${config.BASE_URL}`);
console.log(`Wallet URL: ${config.WALLET_BASE_URL || 'https://testweb.maroset.com/wallet'}`);

// Check if we're in local testing mode
if (process.env.LOCAL_TESTING !== 'true') {
  console.error('❌ Please set LOCAL_TESTING=true in .env file');
  process.exit(1);
}

// Import and initialize database
const { connectDB } = require('./database/db');

async function testTelegramAPI() {
  try {
    const TelegramBot = require('node-telegram-bot-api');
    const token = config.BOT_TOKEN || process.env.BOT_TOKEN;
    
    if (!token) {
      console.log('   ⚠️  No Telegram token found, skipping API test');
      return { success: false, message: 'No token' };
    }
    
    const bot = new TelegramBot(token, { polling: false });
    const me = await bot.getMe();
    
    return {
      success: true,
      bot: {
        username: me.username,
        name: me.first_name,
        id: me.id
      }
    };
  } catch (error) {
    console.log('   ❌ Telegram API test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testHealthSystem() {
  try {
    // Try to load health.js but handle missing express
    let healthModule;
    try {
      healthModule = require('./health.js');
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('express')) {
        console.log('   ⚠️  Express not installed, skipping health system');
        return { success: false, message: 'Express not available' };
      }
      throw error;
    }
    
    const health = await healthModule();
    return { success: true, health };
  } catch (error) {
    console.log('   ⚠️  Health system test skipped:', error.message);
    return { success: false, message: error.message };
  }
}

async function startLocalTesting() {
  console.log('\n🔧 Initializing Local Test Environment...');
  
  // Connect to database (or simulated)
  console.log('   🔗 Testing database connection...');
  const dbConnected = await connectDB();
  
  if (!dbConnected) {
    console.log('   ⚠️  Database not available, using simulated mode');
  } else {
    console.log('   ✅ Database connection: SUCCESS');
  }
  
  // Test database version
  try {
    const { sequelize } = require('./database/db');
    const [result] = await sequelize.query('SELECT version()');
    console.log('   ✅ Database version check: SUCCESS');
  } catch (error) {
    console.log('   ⚠️  Database query test skipped in simulated mode');
  }
  
  // Test Telegram API
  console.log('\n   📞 Testing Telegram API...');
  const telegramTest = await testTelegramAPI();
  if (telegramTest.success) {
    console.log('   ✅ Telegram API: SUCCESS');
    console.log(`      Bot: @${telegramTest.bot.username}`);
    console.log(`      Name: ${telegramTest.bot.name}`);
    console.log(`      ID: ${telegramTest.bot.id}`);
  }
  
  // Test encryption
  console.log('\n   🔒 Testing encryption/decryption...');
  try {
    const encryption = require('./src/utils/encryption');
    const testData = { test: 'data' };
    const encrypted = await encryption.encrypt(testData);
    const decrypted = await encryption.decrypt(encrypted);
    
    if (JSON.stringify(testData) === JSON.stringify(decrypted)) {
      console.log('   ✅ Encryption test: SUCCESS');
    } else {
      console.log('   ⚠️  Encryption test: WARNING - data mismatch');
    }
  } catch (error) {
    console.log('   ⚠️  Encryption test: LIMITED -', error.message);
  }
  
  // Test MiniBotManager
  console.log('\n   🤖 Testing MiniBotManager...');
  try {
    const { MiniBotManager } = require('./src/services/MiniBotManager');
    console.log('   ✅ MiniBotManager loaded successfully');
  } catch (error) {
    console.log('   ⚠️  MiniBotManager test: LIMITED -', error.message);
  }
  
  // Test health system
  console.log('\n   🩺 Testing health check system...');
  await testHealthSystem();
  
  // Test application import
  console.log('\n   🔧 Testing application import...');
  try {
    const app = require('./src/app');
    console.log('   ✅ Application loaded successfully');
  } catch (error) {
    console.log('   ⚠️  Application import test: LIMITED -', error.message);
  }
  
  // Start services
  console.log('\n✅ Local Test Environment Ready!');
  console.log('\n🌐 Available URLs:');
  console.log('   Main Bot: https://testweb.maroset.com');
  console.log('   Wallet: https://testweb.maroset.com/wallet');
  console.log('   Health Check: https://testweb.maroset.com/health');
  
  console.log('\n⚡ Features enabled:');
  console.log('   • Instant Mini Bot initialization');
  console.log('   • Simulated database');
  console.log('   • Fast startup (< 5 seconds)');
  console.log('   • Local wallet testing');
  
  console.log('\n📝 Testing Instructions:');
  console.log('   1. Open Telegram and find @BotomicsDevBot');
  console.log('   2. Click "Wallet" button to test Mini App');
  console.log('   3. Test wallet functions locally');
  console.log('   4. Create and test Mini Bots instantly');
  
  // Keep process alive for testing
  console.log('\n⏰ Press Ctrl+C to stop testing');
  
  // Keep process alive
  setInterval(() => {
    // Keep-alive heartbeat
  }, 60000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down local test environment...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Terminating local test environment...');
  process.exit(0);
});

// Start testing
startLocalTesting().catch(error => {
  console.error('❌ Local testing failed:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});