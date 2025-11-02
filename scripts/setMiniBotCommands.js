const { Telegraf } = require('telegraf');
const { Bot } = require('../src/models');
const { connectDB } = require('../database/db');

async function setMiniBotCommands() {
  try {
    await connectDB();
    
    const activeBots = await Bot.findAll({ where: { is_active: true } });
    
    console.log(`🔄 Setting commands for ${activeBots.length} mini-bots...`);
    
    for (const botRecord of activeBots) {
      try {
        const token = botRecord.getDecryptedToken();
        if (!token) continue;
        
        const bot = new Telegraf(token);
        
        await bot.telegram.setMyCommands([
          { command: 'start', description: 'Start the bot' },
          { command: 'dashboard', description: 'Admin dashboard' },
          { command: 'messages', description: 'View user messages' },
          { command: 'broadcast', description: 'Send broadcast' },
          { command: 'stats', description: 'View statistics' },
          { command: 'admins', description: 'Manage admins' },
          { command: 'help', description: 'Get help' }
        ], {
          scope: { type: 'all_private_chats' }
        });
        
        console.log(`✅ Commands set for ${botRecord.bot_name}`);
        
        await bot.stop();
      } catch (error) {
        console.error(`❌ Failed to set commands for ${botRecord.bot_name}:`, error.message);
      }
    }
    
    console.log('✅ All mini-bot commands set successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to set mini-bot commands:', error);
    process.exit(1);
  }
}

setMiniBotCommands();