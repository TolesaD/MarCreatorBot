const Bot = require('../models/Bot');
const MiniBotManager = require('./MiniBotManager');

class BotService {
  async createBot(botData) {
    try {
      const bot = await Bot.create(botData);
      
      // Initialize the mini-bot only if it's active
      let initialized = false;
      if (bot.is_active) {
        initialized = await MiniBotManager.initializeBot(bot);
      }
      
      return {
        success: true,
        bot: bot,
        initialized: initialized
      };
    } catch (error) {
      console.error('Bot creation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async deactivateBot(botId, userId) {
    try {
      const bot = await Bot.findOne({ where: { bot_id: botId } });
      
      if (!bot) {
        return { success: false, error: 'Bot not found' };
      }
      
      if (bot.owner_id !== userId) {
        return { success: false, error: 'Only owner can deactivate bot' };
      }
      
      // Stop the mini-bot
      await MiniBotManager.stopBot(bot.id);
      
      // Update bot status
      await bot.update({ is_active: false });
      
      return { success: true };
    } catch (error) {
      console.error('Bot deactivation error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async activateBot(botId, userId) {
    try {
      const bot = await Bot.findOne({ where: { bot_id: botId } });
      
      if (!bot) {
        return { success: false, error: 'Bot not found' };
      }
      
      if (bot.owner_id !== userId) {
        return { success: false, error: 'Only owner can activate bot' };
      }
      
      // Update bot status first
      await bot.update({ is_active: true });
      
      // Initialize the mini-bot only if not already active
      let initialized = false;
      if (!MiniBotManager.activeBots.has(bot.id)) {
        initialized = await MiniBotManager.initializeBot(bot);
      } else {
        console.log(`ℹ️ Bot ${bot.bot_name} is already active, skipping initialization`);
        initialized = true;
      }
      
      return { 
        success: true, 
        initialized: initialized 
      };
    } catch (error) {
      console.error('Bot activation error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async getUserBots(userId) {
    try {
      const bots = await Bot.findAll({
        where: { owner_id: userId },
        order: [['created_at', 'DESC']]
      });
      
      return { success: true, bots: bots };
    } catch (error) {
      console.error('Get user bots error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async getBotByToken(token) {
    try {
      const bot = await Bot.findOne({ where: { bot_token: token } });
      return { success: true, bot: bot };
    } catch (error) {
      console.error('Get bot by token error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async updateBotWelcomeMessage(botId, welcomeMessage, userId) {
    try {
      const bot = await Bot.findOne({ where: { bot_id: botId } });
      
      if (!bot) {
        return { success: false, error: 'Bot not found' };
      }
      
      if (bot.owner_id !== userId) {
        return { success: false, error: 'Only owner can update welcome message' };
      }
      
      await bot.update({ welcome_message: welcomeMessage });
      
      return { success: true };
    } catch (error) {
      console.error('Update welcome message error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new BotService();