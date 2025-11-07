const { Markup } = require('telegraf');
const { Bot, Admin } = require('../models');
const { escapeMarkdown } = require('../utils/helpers');

const myBotsHandler = async (ctx) => {
  try {
    const userId = ctx.from.id;
    console.log(`🔍 DEBUG myBotsHandler: Loading bots for user ${userId} (type: ${typeof userId})`);
    
    // Get bots where user is owner - FIXED: Handle string/number comparison
    const ownedBots = await Bot.findAll({
      where: { owner_id: userId },
      order: [['created_at', 'DESC']]
    });
    
    console.log(`🔍 DEBUG: Found ${ownedBots.length} owned bots`);
    ownedBots.forEach(bot => {
      console.log(`   OWNED: ${bot.bot_name} (ID: ${bot.id}, Owner ID: ${bot.owner_id}, type: ${typeof bot.owner_id})`);
    });
    
    // Get admin records
    const adminRecords = await Admin.findAll({
      where: { admin_user_id: userId }
    });
    
    console.log(`🔍 DEBUG: Found ${adminRecords.length} admin records`);
    adminRecords.forEach(record => {
      console.log(`   ADMIN RECORD: Bot ID: ${record.bot_id}, Admin User: ${record.admin_user_id}`);
    });
    
    // Get bot IDs from admin records (excluding owned bots) - FIXED: Proper string comparison
    const adminBotIds = adminRecords
      .map(record => record.bot_id)
      .filter(botId => {
        // EXCLUDE bots where user is already owner - FIXED: Use == for loose comparison
        const isOwner = ownedBots.some(ownedBot => ownedBot.id == botId);
        if (isOwner) {
          console.log(`   EXCLUDING bot ${botId} - user is owner`);
        }
        return !isOwner;
      });
    
    console.log(`🔍 DEBUG: Admin bot IDs after filtering: ${adminBotIds.join(', ')}`);
    
    // Fetch only non-owned admin bots
    const adminBots = adminBotIds.length > 0 ? await Bot.findAll({
      where: { 
        id: adminBotIds
      }
    }) : [];
    
    console.log(`🔍 DEBUG: Found ${adminBots.length} admin-only bots`);
    adminBots.forEach(bot => {
      console.log(`   ADMIN: ${bot.bot_name} (ID: ${bot.id})`);
    });
    
    // Combine - no duplicates possible now
    const allBots = [...ownedBots, ...adminBots];
    
    console.log(`🔍 DEBUG: Final unique bots: ${allBots.length}`);
    allBots.forEach(bot => {
      // FIXED: Use == for loose comparison to handle string vs number
      const isOwner = bot.owner_id == userId;
      console.log(`   FINAL: ${bot.bot_name} (ID: ${bot.id}) - Owner: ${isOwner} (owner_id: ${bot.owner_id} vs user_id: ${userId})`);
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
      // FIXED: Use == for loose comparison
      const isOwner = bot.owner_id == userId;
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