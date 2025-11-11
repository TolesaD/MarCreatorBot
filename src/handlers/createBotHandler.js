const { Markup } = require('telegraf');
const Bot = require('../models/Bot');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { generateBotId } = require('../utils/helpers');
const { validateBotName, validateBotToken, quickTokenCheck } = require('../utils/validators');

// Store bot creation sessions in memory
const botCreationSessions = new Map();

const createBotHandler = async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Check if user already has an active session
    if (botCreationSessions.has(userId)) {
      await ctx.reply('⚠️ You already have a bot creation in progress. Please complete or cancel it first.');
      return;
    }
    
    // Check user bot limit
    const userBotCount = await Bot.count({ where: { owner_id: userId } });
    const maxBots = parseInt(process.env.MAX_BOTS_PER_USER) || 10;
    
    if (userBotCount >= maxBots) {
      await ctx.reply(
        `❌ You have reached the maximum limit of ${maxBots} bots.\n\n` +
        `Please delete some bots before creating new ones.`
      );
      return;
    }
    
    // Initialize session with timestamp
    botCreationSessions.set(userId, {
      step: 'awaiting_token',
      data: {},
      createdAt: Date.now()
    });

    const message = `🤖 *Bot Creation Wizard*\n\n` +
      `*Step 1/2:* Please enter your bot token obtained from @BotFather\n\n` +
      `*How to get token:*\n` +
      `1. Start @BotFather\n` +
      `2. Send /newbot\n` +
      `3. Follow the instructions\n` +
      `4. Copy the token and paste here\n\n` +
      `*Format:* \`1234567890:ABCdefGHIjklMNOPQRSTuvwXYZ123456\`\n\n` +
      `*Security Note:* 🔒 Your token is encrypted and stored securely.\n\n`+
      `To cancel this process, type /cancel here below.`;

    await ctx.replyWithMarkdown(message, Markup.removeKeyboard());
    
  } catch (error) {
    console.error('Create bot handler error:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
    // Cleanup session on error
    botCreationSessions.delete(ctx.from.id);
  }
};

const handleTokenInput = async (ctx) => {
  const userId = ctx.from.id;
  const session = botCreationSessions.get(userId);
  
  if (!session || session.step !== 'awaiting_token') return;
  
  const token = ctx.message.text.trim();
  
  // Quick format validation first
  const quickCheck = quickTokenCheck(token);
  if (!quickCheck.valid) {
    await ctx.reply(
      `❌ ${quickCheck.error}\n\n` +
      `Please enter a valid bot token in the format:\n` +
      `\`1234567890:ABCdefGHIjklMNOPQRSTuvwXYZ123456\`\n\n` +
      `Make sure you copied the entire token from @BotFather:`
    );
    return;
  }
  
  await ctx.reply('🔍 Verifying your bot token...');
  
  try {
    // CRITICAL FIX: Check for duplicate token BEFORE validation
    const existingBotWithToken = await Bot.findOne({
      where: { bot_token: token }
    });
    
    if (existingBotWithToken) {
      botCreationSessions.delete(userId);
      await ctx.reply(
        `❌ This bot token is already registered in the system!\n\n` +
        `Token: \`${token.substring(0, 15)}...\`\n\n` +
        `Each bot token can only be used once. Please create a new bot with @BotFather and use a fresh token.`
      );
      return;
    }
    
    // Comprehensive token validation
    const validation = await validateBotToken(token, userId);
    
    if (!validation.isValid) {
      let errorMessage = '❌ **Token validation failed:**\n\n';
      
      validation.errors.forEach(error => {
        errorMessage += `• ${error}\n`;
      });
      
      if (validation.suggestions.length > 0) {
        errorMessage += '\n💡 **Suggestions:**\n';
        validation.suggestions.forEach(suggestion => {
          errorMessage += `• ${suggestion}\n`;
        });
      }
      
      // Cleanup session on validation failure
      botCreationSessions.delete(userId);
      
      await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
      return;
    }
    
    // CRITICAL FIX: Check for duplicate bot username
    const existingBotWithUsername = await Bot.findOne({
      where: { bot_username: validation.botInfo.username }
    });
    
    if (existingBotWithUsername) {
      botCreationSessions.delete(userId);
      await ctx.reply(
        `❌ Bot @${validation.botInfo.username} is already registered in the system!\n\n` +
        `Please create a new bot with @BotFather with a different username.`
      );
      return;
    }
    
    // Token is valid, store in session
    session.data.token = token;
    session.data.bot_username = validation.botInfo.username;
    session.data.bot_first_name = validation.botInfo.first_name;
    session.data.bot_id = validation.botInfo.id;
    session.step = 'awaiting_name';
    
    await ctx.reply(
      `✅ *Token verified successfully!*\n\n` +
      `🤖 *Bot Found:*\n` +
      `• *Name:* ${validation.botInfo.first_name}\n` +
      `• *Username:* @${validation.botInfo.username}\n` +
      `• *ID:* ${validation.botInfo.id}\n\n` +
      `*Step 2/2:* Please enter a display name for your bot:\n\n` +
      `This name will be used in your management dashboard.`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Token verification error:', error);
    await ctx.reply('❌ Error verifying token. Please try again:');
    // Cleanup session on general errors
    botCreationSessions.delete(userId);
  }
};

const handleNameInput = async (ctx) => {
  const userId = ctx.from.id;
  const session = botCreationSessions.get(userId);
  
  if (!session || session.step !== 'awaiting_name') return;
  
  const botName = ctx.message.text.trim();
  
  // Validate bot name
  const validation = validateBotName(botName);
  if (!validation.valid) {
    await ctx.reply(`❌ ${validation.error} Please enter a valid name:`);
    return;
  }
  
  // SIMPLE FIX: Get all user's bots and check names manually (SQLite compatible)
  const userBots = await Bot.findAll({
    where: { owner_id: userId }
  });
  
  const existingBot = userBots.find(bot => 
    bot.bot_name.toLowerCase() === botName.toLowerCase()
  );
  
  if (existingBot) {
    await ctx.reply(`❌ You already have a bot named "${botName}". Please choose a different name:`);
    return;
  }
  
  await ctx.reply('⏳ Creating your bot...');
  
  try {
    // Generate unique bot ID
    const botId = generateBotId();
    
    // Final duplicate check before creation
    const finalTokenCheck = await Bot.findOne({
      where: { bot_token: session.data.token }
    });
    
    if (finalTokenCheck) {
      botCreationSessions.delete(userId);
      await ctx.reply(
        `❌ This bot token was just registered by another user. Please try creating a new bot.`
      );
      return;
    }
    
    // Create bot record (token will be encrypted by model hook)
    const bot = await Bot.create({
      bot_id: botId,
      owner_id: userId,
      bot_token: session.data.token, // Will be encrypted automatically
      bot_name: botName,
      bot_username: session.data.bot_username
    });
    
    console.log(`✅ Bot created in database: ${botName} (ID: ${bot.id})`);
    
    // Add owner as admin with full permissions
    await Admin.create({
      bot_id: bot.id,
      admin_user_id: userId,
      admin_username: ctx.from.username || 'unknown',
      added_by: userId,
      permissions: {
        can_reply: true,
        can_broadcast: true,
        can_manage_admins: true,
        can_view_stats: true,
        can_deactivate: true,
        can_edit_bot: true
      }
    });
    
    // Update user last active
    await User.update(
      { last_active: new Date() },
      { where: { telegram_id: userId } }
    );
    
    // Cleanup session FIRST before sending messages
    botCreationSessions.delete(userId);
    
    const successMessage = `🎉 *Bot Created Successfully!*\n\n` +
      `*Bot Name:* ${botName}\n` +
      `*Bot Username:* @${session.data.bot_username}\n` +
      `*Bot ID:* \`${botId}\`\n\n` +
      `✅ Your bot is now active! Users can start chatting with @${session.data.bot_username}\n\n` +
      `*You can now manage your bot directly in your mini-bot using:*\n` +
      `• /dashboard - Admin panel\n` +
      `• /broadcast - Send broadcasts\n` +
      `• /stats - View statistics\n` +
      `• /admins - Manage admins (owner only)`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('🔗 Open Your Mini-Bot', `https://t.me/${session.data.bot_username}`)],
      [Markup.button.callback('📋 My Bots', 'my_bots')],
      [Markup.button.callback('🚀 Create Another Bot', 'create_bot')],
    ]);

    await ctx.replyWithMarkdown(successMessage, keyboard);
    
    // Initialize the mini-bot AFTER cleaning session
    try {
      const MiniBotManager = require('../services/MiniBotManager');
      await MiniBotManager.initializeBot(bot);
      console.log(`✅ Mini-bot initialized: ${botName} (@${session.data.bot_username})`);
    } catch (initError) {
      console.error('Failed to initialize mini-bot:', initError);
      // Don't spam the user with initialization errors
    }
    
  } catch (error) {
    console.error('Bot creation error:', error);
    console.error('Error details:', error.message);
    
    // Cleanup session on error
    botCreationSessions.delete(userId);
    
    let errorMessage = '❌ Error creating bot. ';
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      if (error.errors && error.errors[0].path === 'bot_token') {
        errorMessage += 'This bot token is already registered. Please use a different token.';
      } else if (error.errors && error.errors[0].path === 'bot_username') {
        errorMessage += 'This bot username is already registered. Please create a new bot with a different username.';
      } else {
        errorMessage += 'A bot with this name or token already exists.';
      }
    } else {
      errorMessage += 'Please try again later.';
    }
    
    await ctx.reply(errorMessage);
  }
};

// Cancel creation handler
const cancelCreationHandler = async (ctx) => {
  const userId = ctx.from.id;
  
  if (botCreationSessions.has(userId)) {
    botCreationSessions.delete(userId);
    await ctx.reply('❌ Bot creation cancelled.', Markup.removeKeyboard());
    
    // Show main menu
    const { startHandler } = require('./startHandler');
    await startHandler(ctx);
  } else {
    await ctx.reply('No active bot creation to cancel.');
  }
};

// Timeout handler to cleanup stale sessions
function cleanupStaleSessions() {
  const now = Date.now();
  const STALE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  for (const [userId, session] of botCreationSessions.entries()) {
    if (!session.createdAt) {
      session.createdAt = now;
    }
    
    if (now - session.createdAt > STALE_TIMEOUT) {
      botCreationSessions.delete(userId);
      console.log(`🧹 Cleaned up stale session for user ${userId}`);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupStaleSessions, 10 * 60 * 1000);

// Check if user is in bot creation session
function isInCreationSession(userId) {
  return botCreationSessions.has(userId);
}

// Get current session step
function getCreationStep(userId) {
  const session = botCreationSessions.get(userId);
  return session ? session.step : null;
}

module.exports = { 
  createBotHandler, 
  handleTokenInput, 
  handleNameInput,
  cancelCreationHandler,
  isInCreationSession,
  getCreationStep,
  botCreationSessions 
};