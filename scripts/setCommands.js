const { Telegraf } = require('telegraf');
const config = require('../config/environment');

async function setCommands() {
  try {
    const bot = new Telegraf(config.BOT_TOKEN);
    
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'createbot', description: 'Create a new mini-bot' },
      { command: 'mybots', description: 'Manage your bots' },
      { command: 'help', description: 'Get help' }
    ]);
    
    console.log('✅ Bot commands set successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to set commands:', error);
    process.exit(1);
  }
}

setCommands();