const { Telegraf } = require('telegraf');

// Load environment variables directly
require('dotenv').config();

async function setCommands() {
  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    
    if (!BOT_TOKEN) {
      console.error('❌ BOT_TOKEN is not set in environment variables');
      console.log('💡 How to fix:');
      console.log('   1. Make sure .env file exists with BOT_TOKEN');
      console.log('   2. Or set BOT_TOKEN environment variable');
      console.log('   3. For cPanel: Add BOT_TOKEN in Environment Variables section');
      process.exit(1);
    }
    
    console.log(`🤖 Setting commands for bot token: ${BOT_TOKEN.substring(0, 10)}...`);
    
    const bot = new Telegraf(BOT_TOKEN);
    
    // Default commands for regular users (global scope)
    await bot.telegram.setMyCommands([
      { command: 'start', description: '🚀 Start the bot' },
      { command: 'help', description: '❓ Get help' }
    ], {
      scope: {
        type: 'default'
      }
    });
    
    console.log('✅ Default commands set successfully for all users!');
    console.log('📱 Regular users will see: 🚀 Start, ❓ Help');
    
    // Also set admin commands for bot owner (you) specifically
    const ADMIN_USER_ID = 1827785384; // Your user ID
    
    await bot.telegram.setMyCommands([
      { command: 'start', description: '🚀 Start the bot' },
      { command: 'createbot', description: '🤖 Create a new mini-bot' },
      { command: 'mybots', description: '📊 Admin dashboard' },
      { command: 'help', description: '❓ Get help' }
    ], {
      scope: {
        type: 'chat',
        chat_id: ADMIN_USER_ID
      }
    });
    
    console.log(`✅ Admin commands set for user ${ADMIN_USER_ID}!`);
    console.log('👑 Bot owner will see: 🚀 Start, 🤖 Create Bot, 📊 My Bots, ❓ Help');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to set commands:', error.message);
    
    if (error.response) {
      console.error('Telegram API Error:', error.response.description);
    }
    
    process.exit(1);
  }
}

setCommands();