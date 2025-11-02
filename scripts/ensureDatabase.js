const { sequelize } = require('../database/db');
const { Bot, User, Admin, UserLog, Feedback, BroadcastHistory } = require('../models');

async function ensureDatabase() {
  try {
    console.log('🔄 Ensuring database is properly set up...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');
    
    // Sync all models
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synchronized');
    
    // Check if we have any bots in the database
    const botCount = await Bot.count();
    console.log(`📊 Current bots in database: ${botCount}`);
    
    if (botCount > 0) {
      const activeBots = await Bot.findAll({ where: { is_active: true } });
      console.log(`📊 Active bots: ${activeBots.length}`);
      
      for (const bot of activeBots) {
        console.log(`🤖 Active Bot: ${bot.bot_name} (ID: ${bot.bot_id})`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    return false;
  }
}

module.exports = { ensureDatabase };