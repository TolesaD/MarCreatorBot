const { Markup } = require('telegraf');
const Feedback = require('../models/Feedback');
const Bot = require('../models/Bot');
const { escapeMarkdown, checkAdminAccess } = require('../utils/helpers');

// Store reply sessions
const replySessions = new Map();

const feedbackHandler = async (ctx, isCallback = false, botId = null) => {
  try {
    // This handler is for main bot only - redirect to mini-bot
    if (!ctx.isMainBot) {
      // This should be handled by MiniBotManager
      return;
    }
    
    let targetBotId = botId;
    
    if (!isCallback) {
      // Extract bot ID from command
      const commandParts = ctx.message.text.split(' ');
      if (commandParts.length < 2) {
        await ctx.reply('❌ Please specify a bot ID. Usage: /feedback <bot_id>');
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
    const message = `📨 *Message Management*\n\n` +
      `View and reply to user messages directly in your mini-bot.\n\n` +
      `Please go to @${access.bot.bot_username} and use:\n` +
      `• /messages - View all messages\n` +
      `• /dashboard - Full admin panel\n\n` +
      `*You'll get instant notifications when users message your bot!*`;
    
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
    console.error('Feedback handler error:', error);
    const message = '❌ Error loading messages';
    if (isCallback) {
      await ctx.answerCbQuery(message);
    } else {
      await ctx.reply(message);
    }
  }
};

// These functions are kept for backward compatibility
const startReplyHandler = async (ctx, feedbackId) => {
  // This should be handled by MiniBotManager in mini-bots
  await ctx.answerCbQuery('⚠️ Please reply from your mini-bot');
};

const handleReplyMessage = async (ctx) => {
  // This should be handled by MiniBotManager in mini-bots
  if (!ctx.isMainBot) return;
  
  await ctx.reply(
    `💬 *Replying in Mini-Bots*\n\n` +
    `Please reply to messages directly in your mini-bots.\n\n` +
    `You'll get instant notifications when users message your bots.`,
    { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 My Bots', 'my_bots')]
      ])
    }
  );
};

const cancelReplyHandler = async (ctx, botId) => {
  const userId = ctx.from.id;
  replySessions.delete(userId);
  
  await ctx.editMessageText('❌ Reply cancelled.', 
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Back to Messages', `feedback:${botId}:1`)]
    ])
  );
};

// Check if user is in reply session
function isInReplySession(userId) {
  return replySessions.has(userId);
}

module.exports = { 
  feedbackHandler, 
  startReplyHandler, 
  handleReplyMessage, 
  cancelReplyHandler,
  isInReplySession,
  replySessions 
};