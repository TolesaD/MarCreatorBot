const { Markup } = require('telegraf');
const { Bot, Admin } = require('../models');
const { escapeMarkdown } = require('../utils/helpers');

const myBotsHandler = async (ctx) => {
  try {
    const userId = ctx.from.id;
    console.log(`🔍 DEBUG myBotsHandler: Loading bots for user ${userId}`);
    
    // Get bots where user is owner
    const ownedBots = await Bot.findAll({
      where: { owner_id: userId },
      order: [['created_at', 'DESC']]
    });
    
    console.log(`🔍 DEBUG: Found ${ownedBots.length} owned bots`);
    
    // SIMPLIFIED: Get admin bots without complex includes
    const adminRecords = await Admin.findAll({
      where: { admin_user_id: userId }
    });
    
    console.log(`🔍 DEBUG: Found ${adminRecords.length} admin records`);
    
    // Get bot IDs from admin records
    const adminBotIds = adminRecords.map(record => record.bot_id);
    
    // Fetch the actual bot records
    const adminBots = adminBotIds.length > 0 ? await Bot.findAll({
      where: { 
        id: adminBotIds,
        owner_id: { $ne: userId } // EXCLUDE owned bots
      }
    }) : [];
    
    console.log(`🔍 DEBUG: Found ${adminBots.length} admin-only bots`);
    
    // Combine without duplicates
    const allBots = [...ownedBots, ...adminBots];
    
    console.log(`🔍 DEBUG: Total unique bots in myBotsHandler: ${allBots.length}`);
    allBots.forEach(bot => {
      console.log(`   - ${bot.bot_name} (ID: ${bot.id}) - Owner: ${bot.owner_id === userId}`);
    });
    
    if (allBots.length === 0) {
      const message = `📭 *You don't have any bots yet!*\n\n` +
        `Create your first bot to get started.`;
      
      return await ctx.replyWithMarkdown(message, 
        Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Create New Bot', 'create_bot')],
          [Markup.button.callback('❓ How to Create', 'help')]
        ])
      );
    }
    
    let message = `🤖 *Your Bots*\n\n` +
      `*Total:* ${allBots.length} bots\n\n`;
    
    allBots.forEach((bot, index) => {
      const isOwner = bot.owner_id === userId;
      const status = bot.is_active ? '✅ Active' : '❌ Inactive';
      message += `*${index + 1}. ${escapeMarkdown(bot.bot_name)}*\n` +
        `@${bot.bot_username} | ${status} | ${isOwner ? '👑 Owner' : '👥 Admin'}\n\n`;
    });
    
    message += `*🎯 Management Instructions:*\n` +
      `• Go to each mini-bot and use /dashboard\n` +
      `• View messages, send broadcasts, manage admins\n` +
      `• All features available directly in mini-bots\n\n` +
      `*💡 Tip:* Use the Menu for quick access!`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create New Bot', 'create_bot')],
      [Markup.button.callback('🔄 Refresh', 'my_bots')],
      [Markup.button.callback('❓ Help', 'help')]
    ]);
    
    await ctx.replyWithMarkdown(message, keyboard);
    
  } catch (error) {
    console.error('My bots error:', error);
    await ctx.reply('❌ Error loading bots. Please try again.');
  }
};

module.exports = { myBotsHandler };