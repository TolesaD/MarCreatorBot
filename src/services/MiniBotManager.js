// src/services/MiniBotManager.js - COMPLETE VERSION
const { Telegraf, Markup } = require('telegraf');
const { Bot, UserLog, Feedback, Admin, User, BroadcastHistory } = require('../models');

class MiniBotManager {
  constructor() {
    this.activeBots = new Map();
    this.broadcastSessions = new Map();
    this.replySessions = new Map();
    this.adminSessions = new Map();
    this.messageFlowSessions = new Map();
    this.welcomeMessageSessions = new Map();
    this.customCommandSessions = new Map();
    this.initializationPromise = null;
    this.isInitialized = false;
    this.initializationAttempts = 0;
    this.maxInitializationAttempts = 5;
  }

  // ==================== CORE BOT MANAGEMENT ====================
  
  async initializeAllBots() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this._initializeAllBots();
    const result = await this.initializationPromise;
    this.initializationPromise = null;
    return result;
  }

  async _initializeAllBots() {
    try {
      console.log('🔄 Starting mini-bot initialization...');
      await this.clearAllBots();
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const activeBots = await Bot.findAll({ where: { is_active: true } });
      console.log(`📊 Found ${activeBots.length} active bots to initialize`);
      
      if (activeBots.length === 0) {
        this.isInitialized = true;
        return 0;
      }
      
      let successCount = 0;
      for (const botRecord of activeBots) {
        try {
          const owner = await User.findOne({ where: { telegram_id: botRecord.owner_id } });
          if (owner && owner.is_banned) {
            await botRecord.update({ is_active: false });
            continue;
          }
          
          const success = await this.initializeBot(botRecord);
          if (success) successCount++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Error initializing bot ${botRecord.bot_name}:`, error.message);
        }
      }
      
      console.log(`🎉 Initialized ${successCount}/${activeBots.length} mini-bots`);
      this.isInitialized = true;
      return successCount;
    } catch (error) {
      console.error('Error initializing all bots:', error);
      this.isInitialized = false;
      return 0;
    }
  }

  async initializeBot(botRecord) {
    try {
      console.log(`🔄 Initializing: ${botRecord.bot_name} (Type: ${botRecord.bot_type})`);
      
      if (this.activeBots.has(botRecord.id)) {
        await this.stopBot(botRecord.id);
      }
      
      const token = botRecord.getDecryptedToken();
      if (!token || !this.isValidBotToken(token)) {
        console.error(`Invalid token for bot ${botRecord.bot_name}`);
        return false;
      }
      
      const bot = new Telegraf(token, {
        handlerTimeout: 120000,
        telegram: { apiRoot: 'https://api.telegram.org', agent: null }
      });
      
      bot.context.metaBotInfo = {
        mainBotId: botRecord.id,
        botId: botRecord.bot_id,
        botName: botRecord.bot_name,
        botUsername: botRecord.bot_username,
        botRecord: botRecord,
        isCustomBot: botRecord.bot_type === 'custom'
      };
      
      this.setupHandlers(bot, botRecord);
      await this.setBotCommands(bot, token);
      
      this.activeBots.set(botRecord.id, { 
        instance: bot, 
        record: botRecord,
        token: token,
        launchedAt: new Date(),
        status: 'launching'
      });
      
      bot.launch({
        dropPendingUpdates: true,
        allowedUpdates: ['message', 'callback_query', 'my_chat_member']
      }).then(() => {
        console.log(`✅ Bot launch completed: ${botRecord.bot_name}`);
        const botData = this.activeBots.get(botRecord.id);
        if (botData) {
          botData.status = 'active';
          botData.launchedAt = new Date();
        }
      }).catch(launchError => {
        console.error(`Bot launch failed for ${botRecord.bot_name}:`, launchError.message);
        try {
          bot.startPolling();
          console.log(`✅ Bot started with polling: ${botRecord.bot_name}`);
          const botData = this.activeBots.get(botRecord.id);
          if (botData) botData.status = 'active';
        } catch (pollError) {
          this.activeBots.delete(botRecord.id);
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to start bot ${botRecord.bot_name}:`, error.message);
      this.activeBots.delete(botRecord.id);
      return false;
    }
  }

  async clearAllBots() {
    console.log('🔄 Clearing all existing bot instances...');
    const botIds = Array.from(this.activeBots.keys());
    for (const botId of botIds) {
      try {
        await this.stopBot(botId);
      } catch (error) {
        console.error(`Error stopping bot ${botId}:`, error);
      }
    }
    console.log(`✅ Cleared ${botIds.length} bot instances`);
  }

  async stopBot(botId) {
    try {
      const botData = this.activeBots.get(botId);
      if (botData && botData.instance) {
        console.log(`🛑 Stopping bot ${botId}...`);
        await botData.instance.stop();
        this.activeBots.delete(botId);
        console.log(`✅ Bot ${botId} stopped successfully`);
      }
    } catch (error) {
      console.error(`Error stopping bot ${botId}:`, error);
    }
  }

  // ==================== HANDLER SETUP ====================

  setupHandlers = (bot, botRecord) => {
    console.log(`🔄 Setting up handlers for ${botRecord.bot_name} (Type: ${botRecord.bot_type})`);
    
    bot.use(async (ctx, next) => {
      ctx.miniBotManager = this;
      if (ctx.from) {
        const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
        if (user && user.is_banned) {
          await ctx.reply('🚫 Your account has been banned.');
          return;
        }
      }
      return next();
    });
    
    // Common handlers
    bot.start((ctx) => this.handleStart(ctx));
    bot.help((ctx) => this.handleHelp(ctx));
    
    // Type-specific message handling
    if (botRecord.bot_type === 'custom') {
      bot.on('text', (ctx) => this.handleCustomBotMessage(ctx));
    } else {
      bot.on('text', (ctx) => this.handleQuickBotMessage(ctx));
    }
    
    // Admin commands
    bot.command('dashboard', (ctx) => this.handleDashboard(ctx));
    bot.command('broadcast', (ctx) => this.handleBroadcastCommand(ctx));
    bot.command('stats', (ctx) => this.handleStatsCommand(ctx));
    bot.command('admins', (ctx) => this.handleAdminsCommand(ctx));
    bot.command('settings', (ctx) => this.handleSettingsCommand(ctx));
    
    // Media handlers
    bot.on('photo', (ctx) => this.handleImageMessage(ctx));
    bot.on('video', (ctx) => this.handleVideoMessage(ctx));
    bot.on('document', (ctx) => this.handleDocumentMessage(ctx));
    bot.on('audio', (ctx) => this.handleAudioMessage(ctx));
    bot.on('voice', (ctx) => this.handleVoiceMessage(ctx));
    bot.on('media_group', (ctx) => this.handleMediaGroupMessage(ctx));
    
    // Action handlers
    bot.action(/^mini_(.+)/, (ctx) => this.handleMiniAction(ctx));
    bot.action(/^reply_(.+)/, (ctx) => this.handleReplyAction(ctx));
    bot.action(/^admin_(.+)/, (ctx) => this.handleAdminAction(ctx));
    bot.action(/^remove_admin_(.+)/, (ctx) => this.handleRemoveAdminAction(ctx));
    bot.action(/^settings_(.+)/, (ctx) => this.handleSettingsAction(ctx));
    
    bot.catch((error, ctx) => {
      console.error(`Error in mini-bot ${ctx.metaBotInfo?.botName}:`, error);
    });
  };

  // ==================== MESSAGE HANDLERS ====================

  handleStart = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      if (!metaBotInfo) {
        return await ctx.reply('🤖 Welcome! This bot is being configured. Please try again later.');
      }

      const user = ctx.from;
      console.log(`🚀 Start command received for ${metaBotInfo.botName} (Type: ${metaBotInfo.botRecord.bot_type}) from ${user.first_name}`);
      
      await this.setBotCommands(ctx.telegram, null, user.id);
      
      try {
        const botExists = await Bot.findByPk(metaBotInfo.mainBotId);
        if (botExists) {
          await UserLog.upsert({
            bot_id: metaBotInfo.mainBotId,
            user_id: user.id,
            user_username: user.username,
            user_first_name: user.first_name,
            last_interaction: new Date(),
            first_interaction: new Date(),
            interaction_count: 1
          });
        }
      } catch (dbError) {
        console.error('User log error:', dbError.message);
      }
      
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      
      if (isAdmin) {
        await this.showAdminDashboard(ctx, metaBotInfo);
      } else {
        if (metaBotInfo.botRecord.bot_type === 'custom') {
          await this.showCustomBotWelcome(ctx, metaBotInfo);
        } else {
          await this.showQuickBotWelcome(ctx, metaBotInfo);
        }
      }
    } catch (error) {
      console.error('Start handler error:', error);
      await ctx.reply('👋 Welcome! There was a temporary issue. Please try again.');
    }
  };

  handleCustomBotMessage = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const user = ctx.from;
      const message = ctx.message.text;

      if (!metaBotInfo) {
        await this.handleQuickBotMessage(ctx);
        return;
      }

      console.log(`🛠️ Custom bot message: ${metaBotInfo.botName}, User: ${user.first_name}, Message: ${message}`);

      if (message.startsWith('/')) {
        return;
      }

      const sessionKey = `${user.id}_${metaBotInfo.mainBotId}`;
      const userSession = this.customCommandSessions.get(sessionKey);
      
      if (userSession) {
        await this.continueCustomFlow(ctx, metaBotInfo, user, message, userSession);
        return;
      }

      if (metaBotInfo.botRecord.custom_flow_data) {
        const flow = metaBotInfo.botRecord.custom_flow_data;
        const triggerStep = flow.steps?.find(step => step.type === 'trigger' && step.trigger === message);
        if (triggerStep) {
          await this.startCustomFlow(ctx, metaBotInfo, user, flow, triggerStep);
          return;
        }
      }

      await this.handleUserMessage(ctx, metaBotInfo, user, message);
    } catch (error) {
      console.error('Custom bot message handler error:', error);
      await this.handleQuickBotMessage(ctx);
    }
  };

  handleQuickBotMessage = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const user = ctx.from;
      const message = ctx.message.text;

      if (!metaBotInfo) return;

      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      if (isAdmin) {
        await this.showAdminDashboard(ctx, metaBotInfo);
      } else {
        await this.handleUserMessage(ctx, metaBotInfo, user, message);
      }
    } catch (error) {
      console.error('Quick bot message handler error:', error);
    }
  };

  // ==================== CUSTOM FLOW HANDLERS ====================

  startCustomFlow = async (ctx, metaBotInfo, user, flow, triggerStep) => {
    const sessionKey = `${user.id}_${metaBotInfo.mainBotId}`;
    this.customCommandSessions.set(sessionKey, {
      flow: flow,
      currentStepIndex: 0,
      userData: {},
      startedAt: new Date()
    });
    await this.executeCustomStep(ctx, metaBotInfo, user, sessionKey, 0);
  };

  continueCustomFlow = async (ctx, metaBotInfo, user, message, userSession) => {
    const sessionKey = `${user.id}_${metaBotInfo.mainBotId}`;
    const currentStep = userSession.flow.steps[userSession.currentStepIndex];
    
    if (currentStep && currentStep.type === 'ask_question') {
      userSession.userData[currentStep.variable] = message;
      userSession.currentStepIndex++;
      
      if (userSession.currentStepIndex < userSession.flow.steps.length) {
        await this.executeCustomStep(ctx, metaBotInfo, user, sessionKey, userSession.currentStepIndex);
      } else {
        await this.completeCustomFlow(ctx, metaBotInfo, user, userSession);
        this.customCommandSessions.delete(sessionKey);
      }
    }
  };

  executeCustomStep = async (ctx, metaBotInfo, user, sessionKey, stepIndex) => {
    const userSession = this.customCommandSessions.get(sessionKey);
    if (!userSession) return;
    
    const step = userSession.flow.steps[stepIndex];
    if (!step) return;

    if (step.type === 'send_message') {
      await ctx.replyWithMarkdown(this.replaceFlowVariables(step.message, userSession.userData));
    } else if (step.type === 'ask_question') {
      await ctx.replyWithMarkdown(this.replaceFlowVariables(step.question, userSession.userData));
    }
    
    userSession.currentStepIndex = stepIndex;
    this.customCommandSessions.set(sessionKey, userSession);
  };

  completeCustomFlow = async (ctx, metaBotInfo, user, userSession) => {
    if (userSession.flow.completion_message) {
      const completionMessage = this.replaceFlowVariables(userSession.flow.completion_message, userSession.userData);
      await ctx.replyWithMarkdown(completionMessage);
    }
    console.log(`✅ Custom flow completed for user ${user.id} in bot ${metaBotInfo.botName}`);
  };

  replaceFlowVariables = (text, userData) => {
    let result = text;
    for (const [key, value] of Object.entries(userData)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return result;
  };

  // ==================== WELCOME MESSAGES ====================

  showCustomBotWelcome = async (ctx, metaBotInfo) => {
    try {
      const botRecord = metaBotInfo.botRecord;
      if (botRecord.custom_flow_data && botRecord.custom_flow_data.welcome_message) {
        const welcomeMessage = botRecord.custom_flow_data.welcome_message.replace(/{botName}/g, metaBotInfo.botName);
        await ctx.replyWithMarkdown(welcomeMessage);
      } else {
        await ctx.replyWithMarkdown(
          `🛠️ *Welcome to ${metaBotInfo.botName}!*\n\n` +
          `This is a custom command bot with interactive features.\n\n` +
          `*Available Commands:*\n` +
          `Use the menu (/) button to see available commands\n\n` +
          `_This bot was created with @MarCreatorBot_`
        );
      }
    } catch (error) {
      console.error('Custom bot welcome error:', error);
      await this.showQuickBotWelcome(ctx, metaBotInfo);
    }
  };

  showQuickBotWelcome = async (ctx, metaBotInfo) => {
    try {
      let welcomeMessage = await this.getWelcomeMessage(metaBotInfo.mainBotId);
      welcomeMessage = welcomeMessage.replace(/{botName}/g, metaBotInfo.botName);
      await ctx.replyWithMarkdown(welcomeMessage);
    } catch (error) {
      await ctx.replyWithMarkdown(`👋 Welcome to *${metaBotInfo.botName}*!\n\nWe are here to assist you.\n\n_This Bot is created by @MarCreatorBot_`);
    }
  };

  // ==================== USER MESSAGE HANDLING ====================

  handleUserMessage = async (ctx, metaBotInfo, user, message) => {
    try {
      await UserLog.upsert({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        last_interaction: new Date()
      });
      
      const feedback = await Feedback.create({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        message: message,
        message_id: ctx.message.message_id,
        message_type: 'text'
      });
      
      await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'text', ctx.message);
      
      const successMsg = await ctx.reply('✅ Your message has been received.');
      this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
    } catch (error) {
      console.error('User message handler error:', error);
      await ctx.reply('❌ Sorry, there was an error. Please try again.');
    }
  };

  handleImageMessage = async (ctx) => {
    try {
      const user = ctx.from;
      const { metaBotInfo } = ctx;
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      
      if (isAdmin) {
        const replySession = this.replySessions.get(user.id);
        if (replySession && replySession.step === 'awaiting_reply') {
          await this.sendMediaReply(ctx, replySession.userId, replySession.feedbackId, 'image');
          this.replySessions.delete(user.id);
          return;
        }
        await this.showAdminDashboard(ctx, metaBotInfo);
      } else {
        await this.handleUserImageMessage(ctx, metaBotInfo, user);
      }
    } catch (error) {
      console.error('Image message handler error:', error);
      await ctx.reply('❌ An error occurred while processing your image.');
    }
  };

  handleUserImageMessage = async (ctx, metaBotInfo, user) => {
    try {
      await UserLog.upsert({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        last_interaction: new Date()
      });
      
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const caption = ctx.message.caption || '';
      
      const feedback = await Feedback.create({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        message: caption || '[Image]',
        message_id: ctx.message.message_id,
        message_type: 'image',
        media_file_id: photo.file_id,
        media_caption: caption
      });
      
      await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'image', ctx.message);
      
      const successMsg = await ctx.reply('✅ Your image has been received.');
      this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
    } catch (error) {
      console.error('User image message handler error:', error);
      await ctx.reply('❌ Sorry, there was an error sending your image.');
    }
  };

  // Add similar methods for other media types (video, document, audio, voice) following the same pattern

  // ==================== ADMIN FEATURES ====================

  showAdminDashboard = async (ctx, metaBotInfo) => {
    try {
      const stats = await this.getQuickStats(metaBotInfo.mainBotId);
      const dashboardMessage = `🤖 *Admin Dashboard - ${metaBotInfo.botName}*\n\n` +
        `*Quick Stats:*\n` +
        `📨 ${stats.pendingMessages} pending messages\n` +
        `👥 ${stats.totalUsers} total users\n` +
        `💬 ${stats.totalMessages} total messages\n\n` +
        `*Quick Access:*\n` +
        `• Use commands from menu (/) button\n` +
        `• Or click buttons below`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📢 Send Broadcast', 'mini_broadcast')],
        [Markup.button.callback('📊 Statistics', 'mini_stats')],
        [Markup.button.callback('👥 Manage Admins', 'mini_admins')],
        [Markup.button.callback('⚙️ Bot Settings', 'mini_settings')],
        [Markup.button.url('🚀 Create More Bots', 'https://t.me/MarCreatorBot')]
      ]);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(dashboardMessage, { parse_mode: 'Markdown', ...keyboard });
      } else {
        await ctx.replyWithMarkdown(dashboardMessage, keyboard);
      }
    } catch (error) {
      console.error('Admin dashboard error:', error);
      await ctx.reply('❌ Error loading dashboard.');
    }
  };

  handleBroadcastCommand = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, ctx.from.id);
      if (!isAdmin) {
        await ctx.reply('❌ Admin access required.');
        return;
      }
      await this.startBroadcast(ctx, metaBotInfo.mainBotId);
    } catch (error) {
      console.error('Broadcast command error:', error);
      await ctx.reply('❌ Error starting broadcast.');
    }
  };

  startBroadcast = async (ctx, botId) => {
    try {
      const userCount = await UserLog.count({ where: { bot_id: botId } });
      if (userCount === 0) {
        await ctx.reply('❌ No users found for broadcasting.');
        return;
      }
      
      this.broadcastSessions.set(ctx.from.id, { botId: botId, step: 'awaiting_message' });
      await ctx.reply(`📢 *Send Broadcast*\n\n*Recipients:* ${userCount} users\n\nPlease type your broadcast message:\n\n*Cancel:* Type /cancel`, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Start broadcast error:', error);
      await ctx.reply('❌ Error starting broadcast.');
    }
  };

  sendBroadcast = async (ctx, botId, message) => {
    try {
      const users = await UserLog.findAll({ where: { bot_id: botId }, attributes: ['user_id'] });
      let successCount = 0;
      let failCount = 0;
      
      const progressMsg = await ctx.reply(`🔄 Sending broadcast to ${users.length} users...\n✅ Sent: 0\n❌ Failed: 0`);
      const botInstance = this.getBotInstanceByDbId(botId);
      
      if (!botInstance) {
        await ctx.reply('❌ Bot not active. Please restart the main bot.');
        return;
      }
      
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          await botInstance.telegram.sendMessage(user.user_id, message);
          successCount++;
          
          if (i % 10 === 0) {
            await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null, `🔄 Sending broadcast to ${users.length} users...\n✅ Sent: ${successCount}\n❌ Failed: ${failCount}`);
          }
          
          if (i % 30 === 0) await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          failCount++;
        }
      }
      
      await BroadcastHistory.create({
        bot_id: botId,
        sent_by: ctx.from.id,
        message: message,
        total_users: users.length,
        successful_sends: successCount,
        failed_sends: failCount
      });
      
      const successRate = ((successCount / users.length) * 100).toFixed(1);
      await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null, `✅ *Broadcast Completed!*\n\n*Recipients:* ${users.length}\n*✅ Successful:* ${successCount}\n*❌ Failed:* ${failCount}\n*📊 Success Rate:* ${successRate}%`, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Send broadcast error:', error);
      await ctx.reply('❌ Error sending broadcast: ' + error.message);
    }
  };

  // ==================== STATISTICS ====================

  showStats = async (ctx, botId) => {
    try {
      const userCount = await UserLog.count({ where: { bot_id: botId } });
      const messageCount = await Feedback.count({ where: { bot_id: botId } });
      const pendingCount = await Feedback.count({ where: { bot_id: botId, is_replied: false } });
      
      const messageTypes = await Feedback.findAll({
        where: { bot_id: botId },
        attributes: ['message_type', [Feedback.sequelize.fn('COUNT', Feedback.sequelize.col('id')), 'count']],
        group: ['message_type']
      });
      
      let typeBreakdown = '';
      messageTypes.forEach(type => {
        typeBreakdown += `• ${this.getMediaTypeEmoji(type.message_type)} ${type.message_type}: ${type.dataValues.count}\n`;
      });
      
      const statsMessage = `📊 *Bot Statistics*\n\n` +
        `👥 Total Users: ${userCount}\n` +
        `💬 Total Messages: ${messageCount}\n` +
        `📨 Pending Replies: ${pendingCount}\n` +
        `🔄 Status: ✅ Active\n\n` +
        `*Message Types:*\n${typeBreakdown}`;
      
      await ctx.replyWithMarkdown(statsMessage);
    } catch (error) {
      console.error('Show stats error:', error);
      await ctx.reply('❌ Error loading statistics.');
    }
  };

  getQuickStats = async (botId) => {
    try {
      const userCount = await UserLog.count({ where: { bot_id: botId } });
      const messageCount = await Feedback.count({ where: { bot_id: botId } });
      const pendingCount = await Feedback.count({ where: { bot_id: botId, is_replied: false } });
      return { totalUsers: userCount, totalMessages: messageCount, pendingMessages: pendingCount };
    } catch (error) {
      return { totalUsers: 0, totalMessages: 0, pendingMessages: 0 };
    }
  };

  // ==================== ADMIN MANAGEMENT ====================

  handleAdminsCommand = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const isOwner = await this.checkOwnerAccess(metaBotInfo.mainBotId, ctx.from.id);
      if (!isOwner) {
        await ctx.reply('❌ Only bot owner can manage admins.');
        return;
      }
      await this.showAdmins(ctx, metaBotInfo.mainBotId);
    } catch (error) {
      console.error('Admins command error:', error);
      await ctx.reply('❌ Error loading admins.');
    }
  };

  showAdmins = async (ctx, botId) => {
    try {
      const admins = await Admin.findAll({
        where: { bot_id: botId },
        include: [{ model: User, as: 'User' }]
      });
      
      const bot = await Bot.findByPk(botId);
      let message = `👥 *Admin Management*\n\n*Total Admins:* ${admins.length}\n\n*Current Admins:*\n`;
      
      admins.forEach((admin, index) => {
        const userInfo = admin.User ? `@${admin.User.username} (${admin.User.first_name})` : `User#${admin.admin_user_id}`;
        const isOwner = admin.admin_user_id === bot.owner_id;
        message += `*${index + 1}.* ${userInfo} ${isOwner ? '👑 (Owner)' : ''}\n`;
      });
      
      const keyboardButtons = [];
      admins.filter(admin => admin.admin_user_id !== bot.owner_id).forEach(admin => {
        keyboardButtons.push([Markup.button.callback(`➖ Remove ${admin.User?.username || `User#${admin.admin_user_id}`}`, `remove_admin_${admin.id}`)]);
      });
      
      keyboardButtons.push(
        [Markup.button.callback('➕ Add Admin', 'admin_add')],
        [Markup.button.callback('🔙 Dashboard', 'mini_dashboard')]
      );
      
      const keyboard = Markup.inlineKeyboard(keyboardButtons);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
    } catch (error) {
      console.error('Show admins error:', error);
      await ctx.reply('❌ Error loading admins.');
    }
  };

  // ==================== SETTINGS ====================

  handleSettingsCommand = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const isOwner = await this.checkOwnerAccess(metaBotInfo.mainBotId, ctx.from.id);
      if (!isOwner) {
        await ctx.reply('❌ Only bot owner can change settings.');
        return;
      }
      await this.showSettings(ctx, metaBotInfo.mainBotId);
    } catch (error) {
      console.error('Settings command error:', error);
      await ctx.reply('❌ Error loading settings.');
    }
  };

  showSettings = async (ctx, botId) => {
    try {
      const bot = await Bot.findByPk(botId);
      const currentWelcomeMessage = bot.welcome_message || `👋 Welcome to *${bot.bot_name}*!\n\nWe are here to assist you with any questions or concerns you may have.\n\nSimply send us a message, and we'll respond as quickly as possible!\n\n_This Bot is created by @MarCreatorBot_`;
      
      const settingsMessage = `⚙️ *Bot Settings - ${bot.bot_name}*\n\n*Current Welcome Message:*\n${currentWelcomeMessage.substring(0, 100)}${currentWelcomeMessage.length > 100 ? '...' : ''}\n\n*Available Settings:*`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Change Welcome Message', 'settings_welcome')],
        [Markup.button.callback('🔄 Reset Welcome Message', 'settings_reset_welcome')],
        [Markup.button.callback('🔙 Dashboard', 'mini_dashboard')]
      ]);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(settingsMessage, { parse_mode: 'Markdown', ...keyboard });
      } else {
        await ctx.replyWithMarkdown(settingsMessage, keyboard);
      }
    } catch (error) {
      console.error('Show settings error:', error);
      await ctx.reply('❌ Error loading settings.');
    }
  };

  // ==================== HELP COMMAND ====================

  handleHelp = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, ctx.from.id);
      
      let helpMessage;
      if (isAdmin) {
        helpMessage = `🤖 *Admin Help & Support*\n\n` +
          `*Available Commands:*\n` +
          `/dashboard - 📊 Admin dashboard with quick stats\n` +
          `/broadcast - 📢 Send message to all users\n` +
          `/stats - 📈 View bot statistics\n` +
          `/admins - 👥 Manage admin team (owners only)\n` +
          `/settings - ⚙️ Bot settings (owners only)\n` +
          `/help - ❓ This help message\n\n` +
          `*Quick Tips:*\n` +
          `• Click notification buttons to reply instantly\n` +
          `• Use broadcast for important announcements\n` +
          `• Add co-admins to help manage messages\n` +
          `• You can send images, videos, and files as admin\n\n` +
          `*Need help?* Contact @MarCreatorSupportBot`;
      } else {
        helpMessage = `🤖 *Help & Support*\n\n` +
          `*How to use this bot:*\n` +
          `• Send any message to contact our team\n` +
          `• Send images, videos, files, or voice messages\n` +
          `• We'll respond as quickly as possible\n` +
          `• You'll get notifications when we reply\n\n` +
          `*Available Commands:*\n` +
          `/start - 🚀 Start the bot\n` +
          `/help - ❓ Get help\n\n` +
          `*We're here to help! 🤝*`;
      }
      
      await ctx.replyWithMarkdown(helpMessage);
    } catch (error) {
      console.error('Help command error:', error);
      await ctx.reply('Use /start to begin.');
    }
  };

  // ==================== UTILITY METHODS ====================

  deleteAfterDelay = async (ctx, messageId, delay = 5000) => {
    try {
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(messageId);
        } catch (error) {
          // Message already deleted or not accessible
        }
      }, delay);
    } catch (error) {
      console.error('Error setting up message deletion:', error);
    }
  };

  isValidBotToken(token) {
    if (!token || typeof token !== 'string') return false;
    const tokenPattern = /^\d+:[a-zA-Z0-9_-]+$/;
    return tokenPattern.test(token);
  }

  async setBotCommands(bot, token, userId = null) {
    try {
      const baseCommands = [
        { command: 'start', description: '🚀 Start the bot' },
        { command: 'help', description: '❓ Get help' }
      ];
      
      const adminCommands = [
        { command: 'start', description: '🚀 Start the bot' },
        { command: 'dashboard', description: '📊 Admin dashboard' },
        { command: 'broadcast', description: '📢 Send broadcast' },
        { command: 'stats', description: '📈 View statistics' },
        { command: 'admins', description: '👥 Manage admins' },
        { command: 'settings', description: '⚙️ Bot settings' },
        { command: 'help', description: '❓ Get help' }
      ];
      
      if (userId) {
        const isAdmin = await this.checkAdminAccess(bot.context.metaBotInfo.mainBotId, userId);
        if (isAdmin) {
          await bot.telegram.setMyCommands(adminCommands, { scope: { type: 'chat', chat_id: userId } });
        } else {
          await bot.telegram.setMyCommands(baseCommands, { scope: { type: 'chat', chat_id: userId } });
        }
      } else {
        await bot.telegram.setMyCommands(baseCommands);
      }
    } catch (error) {
      console.error('Failed to set bot commands:', error.message);
    }
  }

  getWelcomeMessage = async (botId) => {
    try {
      const bot = await Bot.findByPk(botId);
      let welcomeMessage = bot?.welcome_message;
      
      if (!welcomeMessage) {
        return `👋 Welcome to *{botName}*!\n\nWe are here to assist you with any questions or concerns you may have.\n\nSimply send us a message, and we'll respond as quickly as possible!\n\n_This Bot is created by @MarCreatorBot_`;
      }
      
      const creatorCredit = "_This Bot is created by @MarCreatorBot_";
      if (!welcomeMessage.includes('@MarCreatorBot') && !welcomeMessage.includes('MarCreatorBot')) {
        welcomeMessage += `\n\n${creatorCredit}`;
      }
      
      return welcomeMessage;
    } catch (error) {
      return `👋 Welcome to *{botName}*!\n\nWe are here to assist you with any questions or concerns you may have.\n\nSimply send us a message, and we'll respond as quickly as possible!\n\n_This Bot is created by @MarCreatorBot_`;
    }
  };

  getBotInstanceByDbId = (dbId) => {
    const botData = this.activeBots.get(parseInt(dbId));
    return botData ? botData.instance : null;
  };

  getMediaTypeEmoji = (messageType) => {
    const emojiMap = {
      'text': '💬',
      'image': '🖼️',
      'video': '🎥',
      'document': '📎',
      'media_group': '🖼️',
      'audio': '🎵',
      'voice': '🎤',
      'sticker': '🤡'
    };
    return emojiMap[messageType] || '📄';
  };

  checkAdminAccess = async (botId, userId) => {
    try {
      const bot = await Bot.findByPk(botId);
      if (bot.owner_id == userId) return true;
      const admin = await Admin.findOne({ where: { bot_id: botId, admin_user_id: userId } });
      return !!admin;
    } catch (error) {
      return false;
    }
  };

  checkOwnerAccess = async (botId, userId) => {
    try {
      const bot = await Bot.findByPk(botId);
      return bot.owner_id == userId;
    } catch (error) {
      return false;
    }
  };

  // ==================== NOTIFICATION SYSTEM ====================

  notifyAdminsRealTime = async (botId, feedback, user, messageType = 'text', originalMessage = null) => {
    try {
      const admins = await Admin.findAll({
        where: { bot_id: botId },
        include: [{ model: User, as: 'User' }]
      });
      
      const bot = await Bot.findByPk(botId);
      const botInstance = this.getBotInstanceByDbId(botId);
      
      if (!botInstance) return;
      
      const mediaEmoji = this.getMediaTypeEmoji(messageType);
      const mediaTypeText = messageType === 'text' ? 'Message' : messageType.charAt(0).toUpperCase() + messageType.slice(1);
      
      for (const admin of admins) {
        if (admin.User) {
          try {
            let notificationMessage = `🔔 *New ${mediaTypeText} Received*\n\n` +
              `*From:* ${user.first_name}${user.username ? ` (@${user.username})` : ''}\n`;
            
            if (messageType === 'text') {
              notificationMessage += `*Message:* ${feedback.message}`;
            } else {
              notificationMessage += `*Caption:* ${feedback.media_caption || '[No caption]'}\n` +
                `*Type:* ${messageType}`;
            }
            
            await botInstance.telegram.sendMessage(admin.User.telegram_id, notificationMessage, {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
              ])
            });
          } catch (error) {
            console.error(`Failed to notify admin ${admin.User.username}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('Real-time notification error:', error);
    }
  };

  // ==================== ACTION HANDLERS ====================

  handleMiniAction = async (ctx) => {
    try {
      const action = ctx.match[1];
      const { metaBotInfo } = ctx;
      const user = ctx.from;
      
      await ctx.answerCbQuery();
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      
      if (!isAdmin && !['about', 'stats'].includes(action)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }
      
      switch (action) {
        case 'dashboard':
          await this.showAdminDashboard(ctx, metaBotInfo);
          break;
        case 'broadcast':
          await this.startBroadcast(ctx, metaBotInfo.mainBotId);
          break;
        case 'stats':
          await this.showStats(ctx, metaBotInfo.mainBotId);
          break;
        case 'admins':
          const isOwner = await this.checkOwnerAccess(metaBotInfo.mainBotId, user.id);
          if (isOwner) {
            await this.showAdmins(ctx, metaBotInfo.mainBotId);
          } else {
            await ctx.reply('❌ Only bot owner can manage admins.');
          }
          break;
        case 'settings':
          const isOwnerForSettings = await this.checkOwnerAccess(metaBotInfo.mainBotId, user.id);
          if (isOwnerForSettings) {
            await this.showSettings(ctx, metaBotInfo.mainBotId);
          } else {
            await ctx.reply('❌ Only bot owner can change settings.');
          }
          break;
        default:
          await ctx.reply('⚠️ Action not available');
      }
    } catch (error) {
      console.error('Mini action error:', error);
      await ctx.reply('❌ Error processing action');
    }
  };

  handleReplyAction = async (ctx) => {
    try {
      const feedbackId = ctx.match[1];
      const { metaBotInfo } = ctx;
      const user = ctx.from;
      
      await ctx.answerCbQuery();
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      if (!isAdmin) {
        await ctx.reply('❌ Admin access required.');
        return;
      }
      
      await this.startReply(ctx, feedbackId);
    } catch (error) {
      console.error('Reply action error:', error);
      await ctx.reply('❌ Error starting reply');
    }
  };

  startReply = async (ctx, feedbackId) => {
    try {
      const feedback = await Feedback.findByPk(feedbackId);
      if (!feedback) {
        await ctx.reply('❌ Message not found');
        return;
      }
      
      this.replySessions.set(ctx.from.id, {
        feedbackId: feedbackId,
        userId: feedback.user_id,
        step: 'awaiting_reply'
      });
      
      await ctx.reply(`💬 *Replying to ${feedback.user_first_name}*\n\nPlease type your reply message:\n\n*Cancel:* Type /cancel`, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Start reply error:', error);
      await ctx.reply('❌ Error starting reply');
    }
  };

  sendReply = async (ctx, feedbackId, userId, replyText) => {
    try {
      const feedback = await Feedback.findByPk(feedbackId);
      if (!feedback) {
        await ctx.reply('❌ Message not found.');
        return;
      }

      const botInstance = this.getBotInstanceByDbId(feedback.bot_id);
      if (!botInstance) {
        await ctx.reply('❌ Bot not active. Please restart the main bot.');
        return;
      }
      
      await botInstance.telegram.sendMessage(userId, `💬 *Reply from admin:*\n\n${replyText}\n\n_This is a reply to your message_`, { parse_mode: 'Markdown' });
      
      await feedback.update({
        is_replied: true,
        reply_message: replyText,
        replied_by: ctx.from.id,
        replied_at: new Date()
      });
      
      const successMsg = await ctx.reply('✅ Reply sent successfully!');
      this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
    } catch (error) {
      console.error('Send reply error:', error);
      await ctx.reply('❌ Error sending reply. User might have blocked the bot.');
    }
  };

  // ==================== TEXT MESSAGE HANDLER ====================

  handleTextMessage = async (ctx) => {
    try {
      const user = ctx.from;
      const message = ctx.message.text;
      const { metaBotInfo } = ctx;
      
      const welcomeSession = this.welcomeMessageSessions.get(user.id);
      if (welcomeSession && welcomeSession.step === 'awaiting_welcome_message') {
        if (message === '/cancel') {
          this.welcomeMessageSessions.delete(user.id);
          await ctx.reply('❌ Welcome message change cancelled.');
          return;
        }
        await this.processWelcomeMessageChange(ctx, welcomeSession.botId, message);
        this.welcomeMessageSessions.delete(user.id);
        return;
      }
      
      const broadcastSession = this.broadcastSessions.get(user.id);
      if (broadcastSession && broadcastSession.step === 'awaiting_message') {
        if (message === '/cancel') {
          this.broadcastSessions.delete(user.id);
          await ctx.reply('❌ Broadcast cancelled.');
          return;
        }
        await this.sendBroadcast(ctx, broadcastSession.botId, message);
        this.broadcastSessions.delete(user.id);
        return;
      }
      
      const replySession = this.replySessions.get(user.id);
      if (replySession && replySession.step === 'awaiting_reply') {
        if (message === '/cancel') {
          this.replySessions.delete(user.id);
          await ctx.reply('❌ Reply cancelled.');
          return;
        }
        await this.sendReply(ctx, replySession.feedbackId, replySession.userId, message);
        this.replySessions.delete(user.id);
        return;
      }
      
      const adminSession = this.adminSessions.get(user.id);
      if (adminSession && adminSession.step === 'awaiting_admin_input') {
        if (message === '/cancel') {
          this.adminSessions.delete(user.id);
          await ctx.reply('❌ Admin addition cancelled.');
          return;
        }
        await this.processAddAdmin(ctx, adminSession.botId, message);
        this.adminSessions.delete(user.id);
        return;
      }
      
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      if (isAdmin) {
        await this.showAdminDashboard(ctx, metaBotInfo);
        return;
      }
      
      await this.handleUserMessage(ctx, metaBotInfo, user, message);
    } catch (error) {
      console.error('Text message handler error:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  };

  // ==================== ADDITIONAL UTILITY METHODS ====================

  processWelcomeMessageChange = async (ctx, botId, newMessage) => {
    try {
      const bot = await Bot.findByPk(botId);
      await bot.update({ welcome_message: newMessage });
      const successMsg = await ctx.reply('✅ Welcome message updated successfully!');
      this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      await this.showSettings(ctx, botId);
    } catch (error) {
      console.error('Process welcome message change error:', error);
      await ctx.reply('❌ Error updating welcome message.');
    }
  };

  startAddAdmin = async (ctx, botId) => {
    try {
      this.adminSessions.set(ctx.from.id, { botId: botId, step: 'awaiting_admin_input' });
      await ctx.reply(`👥 *Add New Admin*\n\nPlease send the new admin's Telegram *User ID* or *Username*:\n\n*Cancel:* Type /cancel`, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Start add admin error:', error);
      await ctx.reply('❌ Error adding admin');
    }
  };

  processAddAdmin = async (ctx, botId, input) => {
    try {
      let targetUserId;
      if (/^\d+$/.test(input)) {
        targetUserId = parseInt(input);
      } else {
        const username = input.replace('@', '');
        const user = await User.findOne({ where: { username: username } });
        if (!user) {
          await ctx.reply(`❌ User @${username} not found. Ask them to start @MarCreatorBot first.`);
          return;
        }
        targetUserId = user.telegram_id;
      }
      
      const existingAdmin = await Admin.findOne({ where: { bot_id: botId, admin_user_id: targetUserId } });
      if (existingAdmin) {
        await ctx.reply('❌ This user is already an admin.');
        return;
      }
      
      const targetUser = await User.findOne({ where: { telegram_id: targetUserId } });
      if (!targetUser) {
        await ctx.reply('❌ User not found. Ask them to start @MarCreatorBot first.');
        return;
      }
      
      await Admin.create({
        bot_id: botId,
        admin_user_id: targetUserId,
        admin_username: targetUser.username,
        added_by: ctx.from.id,
        permissions: { can_reply: true, can_broadcast: true, can_manage_admins: false, can_view_stats: true, can_deactivate: false }
      });
      
      const userDisplay = targetUser.username ? `@${targetUser.username}` : `User#${targetUserId}`;
      const successMsg = await ctx.reply(`✅ *${userDisplay} added as admin!*\n\nThey can now reply to messages and send broadcasts.`, { parse_mode: 'Markdown' });
      this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
    } catch (error) {
      console.error('Process add admin error:', error);
      await ctx.reply('❌ Error adding admin.');
    }
  };

  removeAdmin = async (ctx, botId, adminId) => {
    try {
      const admin = await Admin.findByPk(adminId);
      if (!admin) {
        await ctx.reply('❌ Admin not found.');
        return;
      }
      
      const bot = await Bot.findByPk(botId);
      if (admin.admin_user_id === bot.owner_id) {
        await ctx.reply('❌ Cannot remove bot owner.');
        return;
      }
      
      const adminUsername = admin.admin_username || `User#${admin.admin_user_id}`;
      await admin.destroy();
      
      const successMsg = await ctx.reply(`✅ Admin ${adminUsername} has been removed successfully.`);
      this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      await this.showAdmins(ctx, botId);
    } catch (error) {
      console.error('Remove admin error:', error);
      await ctx.reply('❌ Error removing admin.');
    }
  };

  handleAdminAction = async (ctx) => {
    try {
      const action = ctx.match[1];
      const { metaBotInfo } = ctx;
      const user = ctx.from;
      
      await ctx.answerCbQuery();
      const isOwner = await this.checkOwnerAccess(metaBotInfo.mainBotId, user.id);
      if (!isOwner) {
        await ctx.reply('❌ Only bot owner can manage admins.');
        return;
      }
      
      if (action === 'add') {
        await this.startAddAdmin(ctx, metaBotInfo.mainBotId);
      }
    } catch (error) {
      console.error('Admin action error:', error);
      await ctx.reply('❌ Error processing admin action');
    }
  };

  handleRemoveAdminAction = async (ctx) => {
    try {
      const adminId = ctx.match[1];
      const { metaBotInfo } = ctx;
      const user = ctx.from;
      
      await ctx.answerCbQuery();
      const isOwner = await this.checkOwnerAccess(metaBotInfo.mainBotId, user.id);
      if (!isOwner) {
        await ctx.reply('❌ Only bot owner can remove admins.');
        return;
      }
      
      await this.removeAdmin(ctx, metaBotInfo.mainBotId, adminId);
    } catch (error) {
      console.error('Remove admin action error:', error);
      await ctx.reply('❌ Error removing admin');
    }
  };

  handleSettingsAction = async (ctx) => {
    try {
      const action = ctx.match[1];
      const { metaBotInfo } = ctx;
      const user = ctx.from;
      
      await ctx.answerCbQuery();
      const isOwner = await this.checkOwnerAccess(metaBotInfo.mainBotId, user.id);
      if (!isOwner) {
        await ctx.reply('❌ Only bot owner can change settings.');
        return;
      }
      
      switch (action) {
        case 'welcome':
          await this.startChangeWelcomeMessage(ctx, metaBotInfo.mainBotId);
          break;
        case 'reset_welcome':
          await this.resetWelcomeMessage(ctx, metaBotInfo.mainBotId);
          break;
        default:
          await ctx.reply('⚠️ Action not available');
      }
    } catch (error) {
      console.error('Settings action error:', error);
      await ctx.reply('❌ Error processing settings action');
    }
  };

  startChangeWelcomeMessage = async (ctx, botId) => {
    try {
      this.welcomeMessageSessions.set(ctx.from.id, { botId: botId, step: 'awaiting_welcome_message' });
      const bot = await Bot.findByPk(botId);
      const currentMessage = bot.welcome_message || `👋 Welcome to *${bot.bot_name}*!\n\nWe are here to assist you with any questions or concerns you may have.\n\nSimply send us a message, and we'll respond as quickly as possible!\n\n_This Bot is created by @MarCreatorBot_`;
      
      await ctx.reply(`✏️ *Change Welcome Message*\n\n*Current Message:*\n${currentMessage}\n\nPlease send the new welcome message:\n\n*Tips:*\n• Use {botName} as placeholder for bot name\n• Markdown formatting is supported\n• Keep it welcoming and informative\n\n*Cancel:* Type /cancel`, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Start change welcome message error:', error);
      await ctx.reply('❌ Error starting welcome message change.');
    }
  };

  resetWelcomeMessage = async (ctx, botId) => {
    try {
      const bot = await Bot.findByPk(botId);
      await bot.update({ welcome_message: null });
      const successMsg = await ctx.reply('✅ Welcome message reset to default.');
      this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      await this.showSettings(ctx, botId);
    } catch (error) {
      console.error('Reset welcome message error:', error);
      await ctx.reply('❌ Error resetting welcome message.');
    }
  };

  // ==================== HEALTH CHECK AND DEBUGGING ====================

  debugActiveBots = () => {
    console.log('\n🐛 DEBUG: Active Bots Status');
    console.log(`📊 Total active bots: ${this.activeBots.size}`);
    console.log(`🏁 Initialization status: ${this.isInitialized ? 'COMPLETE' : 'PENDING'}`);
    
    for (const [dbId, botData] of this.activeBots.entries()) {
      console.log(`🤖 Bot: ${botData.record.bot_name} | DB ID: ${dbId} | Type: ${botData.record.bot_type} | Status: ${botData.status}`);
    }
  };

  healthCheck = () => {
    console.log('🏥 Mini-bot Manager Health Check:');
    console.log(`📊 Active bots: ${this.activeBots.size}`);
    console.log(`🏁 Initialized: ${this.isInitialized}`);
    console.log(`🔄 Initialization in progress: ${!!this.initializationPromise}`);
    
    this.debugActiveBots();
    
    return {
      isHealthy: this.isInitialized && !this.initializationPromise,
      activeBots: this.activeBots.size,
      status: this.isInitialized ? 'READY' : 'INITIALIZING'
    };
  };

  // Add media reply method
  sendMediaReply = async (ctx, targetUserId, feedbackId, mediaType) => {
    try {
      const feedback = await Feedback.findByPk(feedbackId);
      if (!feedback) {
        await ctx.reply('❌ Original message not found.');
        return;
      }

      const botInstance = this.getBotInstanceByDbId(feedback.bot_id);
      if (!botInstance) {
        console.error('❌ Bot instance not found for media reply');
        await ctx.reply('❌ Bot not active. Please restart the main bot.');
        return;
      }

      try {
        if (mediaType === 'image' && ctx.message.photo) {
          const photo = ctx.message.photo[ctx.message.photo.length - 1];
          await botInstance.telegram.sendPhoto(targetUserId, photo.file_id, {
            caption: ctx.message.caption || '',
            parse_mode: 'Markdown'
          });
        } else if (mediaType === 'video' && ctx.message.video) {
          await botInstance.telegram.sendVideo(targetUserId, ctx.message.video.file_id, {
            caption: ctx.message.caption || '',
            parse_mode: 'Markdown'
          });
        }

        await feedback.update({
          is_replied: true,
          reply_message: `[${mediaType} reply] ${ctx.message.caption || ''}`.trim(),
          replied_by: ctx.from.id,
          replied_at: new Date()
        });

        const successMsg = await ctx.reply(`✅ Your ${mediaType} reply has been sent!`);
        this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      } catch (error) {
        console.error(`Failed to send ${mediaType} reply to user ${targetUserId}:`, error.message);
        await ctx.reply('❌ Failed to send reply. User might have blocked the bot.');
      }
    } catch (error) {
      console.error('Send media reply error:', error);
      await ctx.reply('❌ Error sending media reply.');
    }
  };
}

module.exports = new MiniBotManager();