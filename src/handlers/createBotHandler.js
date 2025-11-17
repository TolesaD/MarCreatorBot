// 📁 src/handlers/createBotHandler.js - PRODUCTION READY WITH CUSTOM BUILDER
const { Markup } = require('telegraf');
const Bot = require('../models/Bot');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { generateBotId } = require('../utils/helpers');
const { validateBotName, validateBotToken, quickTokenCheck } = require('../utils/validators');
const TemplateService = require('../services/TemplateService');

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
    
    // Show creation pathways
    const message = `🚀 *Create New Bot*\n\n` +
      `Choose your bot creation method:\n\n` +
      `*🎯 Quick Mini-Bot*\n` +
      `• Simple setup wizard\n` +
      `• Customer support focus\n` +
      `• Basic messaging features\n` +
      `• Perfect for beginners\n\n` +
      `*🛠️ Custom Command Builder*\n` +
      `• Visual drag-and-drop interface\n` +
      `• Create complex interactions\n` +
      `• Educational bots, quizzes, forms\n` +
      `• No coding required`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🎯 Quick Mini-Bot', 'create_quick_bot'),
        Markup.button.callback('🛠️ Custom Builder', 'create_custom_bot')
      ],
      [Markup.button.callback('🔙 Back', 'start')]
    ]);

    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      await ctx.answerCbQuery();
    } else {
      await ctx.replyWithMarkdown(message, keyboard);
    }
    
  } catch (error) {
    console.error('Create bot handler error:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

// NEW: Handle quick bot creation
const handleQuickBotCreation = async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Check if user already has an active session
    if (botCreationSessions.has(userId)) {
      await ctx.reply('⚠️ You already have a bot creation in progress. Please complete or cancel it first.');
      return;
    }
    
    // Initialize session with timestamp
    botCreationSessions.set(userId, {
      step: 'awaiting_token',
      data: {
        bot_type: 'quick'
      },
      createdAt: Date.now()
    });

    const message = `🎯 *Quick Mini-Bot Creation*\n\n` +
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
    console.error('Quick bot creation error:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
    botCreationSessions.delete(ctx.from.id);
  }
};

// NEW: Handle custom bot creation with template
const handleCustomBotCreation = async (ctx, templateId = null) => {
  try {
    const userId = ctx.from.id;
    
    // Check if user already has an active session
    if (botCreationSessions.has(userId)) {
      await ctx.reply('⚠️ You already have a bot creation in progress. Please complete or cancel it first.');
      return;
    }
    
    // Initialize session with timestamp
    botCreationSessions.set(userId, {
      step: 'awaiting_token',
      data: {
        bot_type: 'custom',
        template_id: templateId
      },
      createdAt: Date.now()
    });

    let templateInfo = '';
    if (templateId) {
      const templateService = new TemplateService();
      const template = templateService.getTemplate(templateId);
      if (template) {
        templateInfo = `\n*Template:* ${template.name}\n*Description:* ${template.description}\n\n`;
      }
    }

    const message = `🛠️ *Custom Command Bot Creation*${templateInfo}\n\n` +
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
    console.error('Custom bot creation error:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
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
    
    const botType = session.data.bot_type === 'custom' ? 'Custom Command Bot' : 'Quick Mini-Bot';
    
    await ctx.reply(
      `✅ *Token verified successfully!*\n\n` +
      `🤖 *Bot Found:*\n` +
      `• *Name:* ${validation.botInfo.first_name}\n` +
      `• *Username:* @${validation.botInfo.username}\n` +
      `• *ID:* ${validation.botInfo.id}\n` +
      `• *Type:* ${botType}\n\n` +
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

// Right before creating the bot, add this:
console.log('🔍 DEBUG: Creating bot with type:', session.data.bot_type);
console.log('🔍 DEBUG: Full session data:', JSON.stringify(session, null, 2));

// Create bot record (token will be encrypted by model hook)
const bot = await Bot.create(botData);

// Add this after creation to verify:
console.log('🔍 DEBUG: Bot created with type:', bot.bot_type);

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
    
    // Prepare bot data
    const botData = {
      bot_id: botId,
      owner_id: userId,
      bot_token: session.data.token, // Will be encrypted automatically
      bot_name: botName,
      bot_username: session.data.bot_username,
      bot_type: session.data.bot_type || 'quick'
    };
    
    // Add template flow data for custom bots
    if (session.data.bot_type === 'custom' && session.data.template_id) {
      const templateService = new TemplateService();
      const template = templateService.getTemplate(session.data.template_id);
      if (template) {
        botData.custom_flow_data = template.flow;
      }
    }
    
    // Create bot record (token will be encrypted by model hook)
    const bot = await Bot.create(botData);
    
    console.log(`✅ Bot created in database: ${botName} (ID: ${bot.id}, Type: ${session.data.bot_type})`);
    
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
    
    const botType = session.data.bot_type === 'custom' ? 'Custom Command Bot' : 'Quick Mini-Bot';
    const botTypeEmoji = session.data.bot_type === 'custom' ? '🛠️' : '🎯';
    
    let successMessage = `${botTypeEmoji} *${botType} Created Successfully!*\n\n` +
      `*Bot Name:* ${botName}\n` +
      `*Bot Username:* @${session.data.bot_username}\n` +
      `*Bot ID:* \`${botId}\`\n` +
      `*Bot Type:* ${botType}\n\n`;
    
    if (session.data.bot_type === 'custom') {
      if (session.data.template_id) {
        const templateService = new TemplateService();
        const template = templateService.getTemplate(session.data.template_id);
        successMessage += `*Template:* ${template ? template.name : 'Custom'}\n\n`;
      }
      successMessage += `✅ Your custom command bot is now active!\n\n` +
        `*Next Steps:*\n` +
        `• Go to your bot dashboard to manage custom commands\n` +
        `• Create interactive flows and automations\n` +
        `• Users can start chatting with @${session.data.bot_username}`;
    } else {
      successMessage += `✅ Your quick mini-bot is now active! Users can start chatting with @${session.data.bot_username}\n\n` +
        `*You can now manage your bot directly in your mini-bot using:*\n` +
        `• /dashboard - Admin panel\n` +
        `• /broadcast - Send broadcasts\n` +
        `• /stats - View statistics\n` +
        `• /admins - Manage admins (owner only)`;
    }
    
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

// NEW: Show template selection for custom bots
const showCustomBotTemplates = async (ctx) => {
  try {
    const templateService = new TemplateService();
    const templates = templateService.getTemplatesForDisplay();
    
    let templateMessage = `🛠️ *Custom Command Builder*\n\n` +
      `*Choose a Template or Start Fresh*\n\n`;
    
    // Display educational templates
    if (templates.educational && templates.educational.length > 0) {
      templateMessage += `📚 *Educational Templates:*\n`;
      templates.educational.forEach((template, index) => {
        templateMessage += `\n${template.icon} *${template.name}*\n` +
          `${template.description}\n` +
          `📊 Difficulty: ${template.difficulty} | Steps: ${template.stepCount}\n`;
      });
      templateMessage += `\n`;
    }
    
    // Display engagement templates
    if (templates.engagement && templates.engagement.length > 0) {
      templateMessage += `🎯 *Engagement Templates:*\n`;
      templates.engagement.forEach((template, index) => {
        templateMessage += `\n${template.icon} *${template.name}*\n` +
          `${template.description}\n` +
          `📊 Difficulty: ${template.difficulty} | Steps: ${template.stepCount}\n`;
      });
    }
    
    templateMessage += `\n*Or start with a blank canvas and build your own custom flow!*`;

    const keyboardButtons = [];
    
    // Add template buttons (limit to 6 for better UX)
    const allTemplates = [
      ...(templates.educational || []),
      ...(templates.engagement || [])
    ].slice(0, 6);
    
    allTemplates.forEach(template => {
      keyboardButtons.push([
        Markup.button.callback(
          `${template.icon} ${template.name}`,
          `use_template_${template.id}`
        )
      ]);
    });

    keyboardButtons.push([
      Markup.button.callback('🆕 Start from Scratch', 'create_blank_flow'),
      Markup.button.callback('⬅️ Back to Pathways', 'create_bot')
    ]);

    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(templateMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboardButtons)
      });
      await ctx.answerCbQuery();
    } else {
      await ctx.replyWithMarkdown(templateMessage, Markup.inlineKeyboard(keyboardButtons));
    }
  } catch (error) {
    console.error('Template selection error:', error);
    await ctx.reply('❌ Error loading templates. Please try again.');
  }
};

// NEW: Handle template selection
const handleTemplateSelection = async (ctx, templateId) => {
  try {
    const templateService = new TemplateService();
    const template = templateService.getTemplate(templateId);
    
    if (!template) {
      await ctx.answerCbQuery('❌ Template not found');
      return;
    }

    const templateInfo = `📋 *Template: ${template.name}*\n\n` +
      `*Description:* ${template.description}\n` +
      `*Category:* ${template.category.charAt(0).toUpperCase() + template.category.slice(1)}\n` +
      `*Difficulty:* ${template.difficulty}\n` +
      `*Steps:* ${template.flow.steps.length}\n\n` +
      `*Features included:*\n` +
      `• Pre-configured logic flow\n` +
      `• Ready-to-use questions and messages\n` +
      `• Easy customization options\n\n` +
      `Ready to create your bot with this template?`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Create Bot with Template', `confirm_template_${templateId}`)],
      [Markup.button.callback('⬅️ Back to Templates', 'create_custom_bot')]
    ]);

    await ctx.editMessageText(templateInfo, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Template selection error:', error);
    await ctx.answerCbQuery('❌ Error loading template');
  }
};

// NEW: Handle template confirmation
const handleTemplateConfirmation = async (ctx, templateId) => {
  try {
    await ctx.answerCbQuery('🛠️ Starting bot creation...');
    await handleCustomBotCreation(ctx, templateId);
  } catch (error) {
    console.error('Template confirmation error:', error);
    await ctx.answerCbQuery('❌ Error starting bot creation');
  }
};

// NEW: Handle blank flow creation
const handleBlankFlowCreation = async (ctx) => {
  try {
    await ctx.answerCbQuery('🛠️ Starting blank bot creation...');
    await handleCustomBotCreation(ctx);
  } catch (error) {
    console.error('Blank flow creation error:', error);
    await ctx.answerCbQuery('❌ Error starting bot creation');
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
  botCreationSessions,
  // NEW: Custom command builder functions
  handleQuickBotCreation,
  handleCustomBotCreation,
  showCustomBotTemplates,
  handleTemplateSelection,
  handleTemplateConfirmation,
  handleBlankFlowCreation
};