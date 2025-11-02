const { Markup } = require('telegraf');
const Bot = require('../models/Bot');
const UserLog = require('../models/UserLog');
const BroadcastHistory = require('../models/BroadcastHistory');
const { checkAdminAccess, escapeMarkdown } = require('../utils/helpers');
const { sanitizeMessage } = require('../utils/validators');

// Store broadcast sessions
const broadcastSessions = new Map();

const broadcastHandler = async (ctx, isCallback = false, botId = null) => {
  try {
    // This handler is for main bot only - redirect to mini-bot
    if (!ctx.isMainBot) {
      // This should be handled by MiniBotManager
      return;
    }
    
    let targetBotId = botId;
    
    if (!isCallback) {
      const commandParts = ctx.message.text.split(' ');
      if (commandParts.length < 2) {
        await ctx.reply('❌ Please specify a bot ID. Usage: /broadcast <bot_id>');
        return;
      }
      targetBotId = commandParts[1];
    }
    
    const userId = ctx.from.id;
    
    // Check access
    const access = await checkAdminAccess(userId, targetBotId);
    
    if (!access.hasAccess) {
      const message = '❌ Access denied or bot not found.';
      if (isCallback) {
        await ctx.answerCbQuery(message);
      } else {
        await ctx.reply(message);
      }
      return;
    }
    
    // Redirect to use in mini-bot
    const message = `📢 *Broadcast Management*\n\n` +
      `Broadcast features are available directly in your mini-bot.\n\n` +
      `Please go to @${access.bot.bot_username} and use:\n` +
      `• /broadcast - Send broadcasts\n` +
      `• /dashboard - Full admin panel\n\n` +
      `*All management happens in your mini-bots!*`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(`🔗 Open ${access.bot.bot_name}`, `https://t.me/${access.bot.bot_username}`)],
      [Markup.button.callback('📋 My Bots', 'my_bots')]
    ]);
    
    if (isCallback) {
      await ctx.editMessageText(message, { 
        parse_mode: 'Markdown',
        ...keyboard 
      });
    } else {
      await ctx.replyWithMarkdown(message, keyboard);
    }
    
    await ctx.answerCbQuery();
    
  } catch (error) {
    console.error('Broadcast handler error:', error);
    const message = '❌ Error loading broadcast';
    if (isCallback) {
      await ctx.answerCbQuery(message);
    } else {
      await ctx.reply(message);
    }
  }
};

// These functions are kept for backward compatibility but redirect to mini-bot usage
const handleBroadcastMessage = async (ctx) => {
  // This should be handled by MiniBotManager in mini-bots
  if (!ctx.isMainBot) return;
  
  await ctx.reply(
    `📢 *Broadcasts in Mini-Bots*\n\n` +
    `Please use broadcast features directly in your mini-bots.\n\n` +
    `Go to your bot and use /broadcast command there.`,
    { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 My Bots', 'my_bots')]
      ])
    }
  );
};

const confirmBroadcastHandler = async (ctx, botId) => {
  await ctx.answerCbQuery('⚠️ Use broadcasts in your mini-bot');
  await ctx.reply(
    `Please go to your mini-bot to send broadcasts.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('📋 My Bots', 'my_bots')]
    ])
  );
};

const cancelBroadcastHandler = async (ctx, botId) => {
  await ctx.editMessageText('❌ Broadcast cancelled.', 
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Back to Bot', `manage_bot:${botId}`)]
    ])
  );
};

// Check if user is in broadcast session
function isInBroadcastSession(userId) {
  return broadcastSessions.has(userId);
}

module.exports = { 
  broadcastHandler, 
  handleBroadcastMessage, 
  confirmBroadcastHandler, 
  cancelBroadcastHandler,
  isInBroadcastSession,
  broadcastSessions 
};