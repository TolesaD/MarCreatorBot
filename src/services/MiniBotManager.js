// src/services/MiniBotManager.js - SIMPLIFIED VERSION
const { Telegraf, Markup } = require('telegraf');
const { Bot, UserLog, Feedback, Admin, User, BroadcastHistory } = require('../models');

class MiniBotManager {
  constructor() {
    this.activeBots = new Map();
    this.broadcastSessions = new Map();
    this.replySessions = new Map();
    this.adminSessions = new Map();
    this.messageFlowSessions = new Map();
    this.initializationPromise = null;
    this.isInitialized = false;
    this.initializationAttempts = 0;
    this.maxInitializationAttempts = 5;
  }
  
  deleteAfterDelay = async (ctx, messageId, delay = 5000) => {
    try {
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(messageId);
        } catch (error) {
          console.log('Message already deleted or not accessible');
        }
      }, delay);
    } catch (error) {
      console.error('Error setting up message deletion:', error);
    }
  };
  
  async initializeAllBots() {
    if (this.initializationPromise) {
      console.log('🔄 Initialization already in progress, waiting...');
      return this.initializationPromise;
    }
    
    this.initializationPromise = this._initializeAllBots();
    const result = await this.initializationPromise;
    this.initializationPromise = null;
    return result;
  }
  
  async _initializeAllBots() {
    try {
      console.log('🔄 CRITICAL: Starting mini-bot initialization on server startup...');
      
      await this.clearAllBots();
      
      console.log('⏳ Waiting for database to be fully ready...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const activeBots = await Bot.findAll({ where: { is_active: true } });
      
      console.log(`📊 Found ${activeBots.length} active bots in database to initialize`);
      
      if (activeBots.length === 0) {
        console.log('ℹ️ No active bots found in database - this is normal for new deployment');
        this.isInitialized = true;
        return 0;
      }
      
      let successCount = 0;
      let failedCount = 0;
      
      for (const botRecord of activeBots) {
        try {
          console.log(`\n🔄 Attempting to initialize: ${botRecord.bot_name} (ID: ${botRecord.id})`);
          
          // FIXED: Only check for banned users, don't skip initialization for non-platform-creator bots
          const owner = await User.findOne({ where: { telegram_id: botRecord.owner_id } });
          if (owner && owner.is_banned) {
            console.log(`🚫 Skipping bot ${botRecord.bot_name} - owner is banned`);
            // Deactivate the bot if owner is banned
            await botRecord.update({ is_active: false });
            failedCount++;
            continue;
          }
          
          // Don't use timeout - let each bot initialize at its own pace
          const success = await this.initializeBotWithEncryptionCheck(botRecord);
          
          if (success) {
            successCount++;
            console.log(`✅ Initialization started: ${botRecord.bot_name}`);
          } else {
            failedCount++;
            console.error(`❌ Failed to initialize: ${botRecord.bot_name}`);
          }
          
          // Small delay between bots
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`💥 Critical error initializing bot ${botRecord.bot_name}:`, error.message);
          failedCount++;
          // Continue with next bot even if this one fails
          console.log(`🔄 Continuing with next bot despite error...`);
        }
      }
      
      console.log(`\n🎉 INITIALIZATION SUMMARY: ${successCount}/${activeBots.length} mini-bots initialization started (${failedCount} failed)`);
      
      // Wait a bit for bots to finish launching
      console.log('⏳ Waiting for bots to complete launch...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      this.isInitialized = true;
      this.debugActiveBots();
      
      return successCount;
      
    } catch (error) {
      console.error('💥 CRITICAL: Error initializing all bots:', error);
      this.isInitialized = false;
      return 0;
    }
  }
  
  async initializeBotWithEncryptionCheck(botRecord) {
    try {
      console.log(`🔐 Testing encryption for bot: ${botRecord.bot_name}`);
      
      const decryptionTest = await botRecord.testTokenDecryption();
      if (!decryptionTest.success) {
        console.error(`❌ Token decryption failed for ${botRecord.bot_name}: ${decryptionTest.message}`);
        return false;
      }
      
      console.log(`✅ Token decryption test passed for: ${botRecord.bot_name}`);
      return await this.initializeBot(botRecord);
      
    } catch (error) {
      console.error(`💥 Encryption check failed for ${botRecord.bot_name}:`, error.message);
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
  
  async initializeBot(botRecord) {
    try {
      console.log(`🔄 Starting initialization for: ${botRecord.bot_name} (DB ID: ${botRecord.id})`);
      
      if (this.activeBots.has(botRecord.id)) {
        console.log(`⚠️ Bot ${botRecord.bot_name} (DB ID: ${botRecord.id}) is already active, stopping first...`);
        await this.stopBot(botRecord.id);
      }
      
      console.log(`🔐 Getting decrypted token for: ${botRecord.bot_name}`);
      const token = botRecord.getDecryptedToken();
      if (!token) {
        console.error(`❌ No valid token for bot ${botRecord.bot_name}`);
        return false;
      }
      
      if (!this.isValidBotToken(token)) {
        console.error(`❌ Invalid token format for bot ${botRecord.bot_name}`);
        return false;
      }
      
      console.log(`🔄 Creating Telegraf instance for: ${botRecord.bot_name}`);
      
      const bot = new Telegraf(token, {
        handlerTimeout: 120000, // Increased timeout
        telegram: { 
          apiRoot: 'https://api.telegram.org',
          agent: null
        }
      });
      
      bot.context.metaBotInfo = {
        mainBotId: botRecord.id,
        botId: botRecord.bot_id,
        botName: botRecord.bot_name,
        botUsername: botRecord.bot_username,
        botRecord: botRecord
      };
      
      this.setupHandlers(bot);
      
      // Set default commands for new users
      await this.setBotCommands(bot, token);
      
      console.log(`🚀 Launching bot: ${botRecord.bot_name}`);
      
      // Store the bot instance IMMEDIATELY before launch
      this.activeBots.set(botRecord.id, { 
        instance: bot, 
        record: botRecord,
        token: token,
        launchedAt: new Date(),
        status: 'launching' // Mark as launching
      });
      
      console.log(`✅ Mini-bot stored in activeBots BEFORE launch: ${botRecord.bot_name} - DB ID: ${botRecord.id}`);
      
      // Launch without waiting for completion
      bot.launch({
        dropPendingUpdates: true,
        allowedUpdates: ['message', 'callback_query', 'my_chat_member']
      }).then(() => {
        console.log(`✅ Bot launch completed: ${botRecord.bot_name}`);
        
        // Update status to active after successful launch
        const botData = this.activeBots.get(botRecord.id);
        if (botData) {
          botData.status = 'active';
          botData.launchedAt = new Date();
          console.log(`✅ Bot marked as ACTIVE: ${botRecord.bot_name}`);
        }
        
      }).catch(launchError => {
        console.error(`❌ Bot launch failed for ${botRecord.bot_name}:`, launchError.message);
        
        // Try alternative launch method
        console.log(`🔄 Trying alternative launch for ${botRecord.bot_name}...`);
        try {
          bot.startPolling();
          console.log(`✅ Bot started with polling: ${botRecord.bot_name}`);
          
          // Update status
          const botData = this.activeBots.get(botRecord.id);
          if (botData) {
            botData.status = 'active';
            console.log(`✅ Bot marked as ACTIVE after polling: ${botRecord.bot_name}`);
          }
        } catch (pollError) {
          console.error(`❌ Alternative launch failed for ${botRecord.bot_name}:`, pollError.message);
          // Remove from active bots if both methods fail
          this.activeBots.delete(botRecord.id);
        }
      });
      
      // Return true immediately since we stored the bot instance
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to start bot ${botRecord.bot_name}:`, error.message);
      this.activeBots.delete(botRecord.id);
      return false;
    }
  }

  isValidBotToken(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    const tokenPattern = /^\d+:[a-zA-Z0-9_-]+$/;
    const isValid = tokenPattern.test(token);
    
    if (!isValid) {
      console.error(`❌ Invalid token format: ${token.substring(0, 10)}...`);
    }
    
    return isValid;
  }
  
  async setBotCommands(bot, token, userId = null) {
    try {
      console.log('🔄 Setting bot commands for menu...');
      
      // Default commands for regular users
      const userCommands = [
        { command: 'start', description: '🚀 Start the bot' },
        { command: 'help', description: '❓ Get help' }
      ];
      
      // Admin commands for bot owners and admins
      const adminCommands = [
        { command: 'start', description: '🚀 Start the bot' },
        { command: 'dashboard', description: '📊 Admin dashboard' },
        { command: 'broadcast', description: '📢 Send broadcast' },
        { command: 'stats', description: '📈 View statistics' },
        { command: 'admins', description: '👥 Manage admins' },
        { command: 'help', description: '❓ Get help' }
      ];
      
      if (userId) {
        // Set commands for specific user
        const isAdmin = await this.checkAdminAccess(bot.context.metaBotInfo.mainBotId, userId);
        
        if (isAdmin) {
          await bot.telegram.setMyCommands(adminCommands, {
            scope: {
              type: 'chat',
              chat_id: userId
            }
          });
          console.log(`✅ Admin commands set for user ${userId}`);
        } else {
          await bot.telegram.setMyCommands(userCommands, {
            scope: {
              type: 'chat',
              chat_id: userId
            }
          });
          console.log(`✅ User commands set for user ${userId}`);
        }
      } else {
        // Set default commands for all users
        await bot.telegram.setMyCommands(userCommands);
        console.log('✅ Default user commands set for all users');
      }
    } catch (error) {
      console.error('❌ Failed to set bot commands:', error.message);
    }
  }
  
  setupHandlers = (bot) => {
    console.log('🔄 Setting up handlers for bot...');
    
    // Add middleware to set role-based commands and check bans
    bot.use(async (ctx, next) => {
      ctx.miniBotManager = this;
      
      // FIXED: Check if user is banned before processing any message
      if (ctx.from) {
        const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
        if (user && user.is_banned) {
          console.log(`🚫 Banned user ${ctx.from.id} tried to access bot ${ctx.metaBotInfo?.botName}`);
          await ctx.reply('🚫 Your account has been banned from using this platform.');
          return;
        }
      }
      
      // Set appropriate commands for this user
      if (ctx.from && ctx.metaBotInfo) {
        await this.setBotCommands(bot, null, ctx.from.id);
      }
      
      return next();
    });
    
    bot.start((ctx) => this.handleStart(ctx));
    bot.command('dashboard', (ctx) => this.handleDashboard(ctx));
    // REMOVED: messages command
    bot.command('broadcast', (ctx) => this.handleBroadcastCommand(ctx));
    bot.command('stats', (ctx) => this.handleStatsCommand(ctx));
    bot.command('admins', (ctx) => this.handleAdminsCommand(ctx));
    bot.command('help', (ctx) => this.handleHelp(ctx));
    
    // TEXT MESSAGES
    bot.on('text', (ctx) => this.handleTextMessage(ctx));
    
    // IMAGE MESSAGES - Handle both direct and forwarded images
    bot.on('photo', (ctx) => this.handleImageMessage(ctx));
    
    // VIDEO MESSAGES - Handle both direct and forwarded videos
    bot.on('video', (ctx) => this.handleVideoMessage(ctx));
    
    // DOCUMENT MESSAGES - Handle files that might be images/videos
    bot.on('document', (ctx) => this.handleDocumentMessage(ctx));
    
    // MEDIA GROUP MESSAGES - Handle albums with multiple images/videos
    bot.on('media_group', (ctx) => this.handleMediaGroupMessage(ctx));
    
    bot.action(/^mini_(.+)/, (ctx) => this.handleMiniAction(ctx));
    bot.action(/^reply_(.+)/, (ctx) => this.handleReplyAction(ctx));
    bot.action(/^admin_(.+)/, (ctx) => this.handleAdminAction(ctx));
    bot.action(/^remove_admin_(.+)/, (ctx) => this.handleRemoveAdminAction(ctx));
    
    bot.catch((error, ctx) => {
      console.error(`Error in mini-bot ${ctx.metaBotInfo?.botName}:`, error);
    });
    
    console.log('✅ Bot handlers setup complete with image/video support');
  };

  // NEW: Handle image messages (both direct and forwarded)
  handleImageMessage = async (ctx) => {
    try {
      const user = ctx.from;
      const { metaBotInfo } = ctx;
      
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      if (isAdmin) {
        await this.showAdminDashboard(ctx, metaBotInfo);
        return;
      }
      
      await this.handleUserImageMessage(ctx, metaBotInfo, user);
      
    } catch (error) {
      console.error('Image message handler error:', error);
      await ctx.reply('❌ An error occurred while processing your image. Please try again.');
    }
  };

  // NEW: Handle video messages (both direct and forwarded)
  handleVideoMessage = async (ctx) => {
    try {
      const user = ctx.from;
      const { metaBotInfo } = ctx;
      
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      if (isAdmin) {
        await this.showAdminDashboard(ctx, metaBotInfo);
        return;
      }
      
      await this.handleUserVideoMessage(ctx, metaBotInfo, user);
      
    } catch (error) {
      console.error('Video message handler error:', error);
      await ctx.reply('❌ An error occurred while processing your video. Please try again.');
    }
  };

  // NEW: Handle document messages (for files that might be images/videos)
  handleDocumentMessage = async (ctx) => {
    try {
      const user = ctx.from;
      const { metaBotInfo } = ctx;
      
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      if (isAdmin) {
        await this.showAdminDashboard(ctx, metaBotInfo);
        return;
      }
      
      await this.handleUserDocumentMessage(ctx, metaBotInfo, user);
      
    } catch (error) {
      console.error('Document message handler error:', error);
      await ctx.reply('❌ An error occurred while processing your file. Please try again.');
    }
  };

  // NEW: Handle media group messages (albums with multiple images/videos)
  handleMediaGroupMessage = async (ctx) => {
    try {
      const user = ctx.from;
      const { metaBotInfo } = ctx;
      
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      if (isAdmin) {
        await this.showAdminDashboard(ctx, metaBotInfo);
        return;
      }
      
      await this.handleUserMediaGroupMessage(ctx, metaBotInfo, user);
      
    } catch (error) {
      console.error('Media group handler error:', error);
      await ctx.reply('❌ An error occurred while processing your media. Please try again.');
    }
  };

  // NEW: Process user image message
  handleUserImageMessage = async (ctx, metaBotInfo, user) => {
    try {
      await UserLog.upsert({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        last_interaction: new Date()
      });
      
      // Get the largest available photo
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
      
      // FIXED: Pass the original message context to forward the actual image
      await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'image', ctx.message);
      
      const successMsg = await ctx.reply('✅ Your image has been received.');
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      console.log(`📸 New image from ${user.first_name} to ${metaBotInfo.botName}`);
      
    } catch (error) {
      console.error('User image message handler error:', error);
      await ctx.reply('❌ Sorry, there was an error sending your image. Please try again.');
    }
  };

  // NEW: Process user video message
  handleUserVideoMessage = async (ctx, metaBotInfo, user) => {
    try {
      await UserLog.upsert({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        last_interaction: new Date()
      });
      
      const video = ctx.message.video;
      const caption = ctx.message.caption || '';
      
      const feedback = await Feedback.create({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        message: caption || '[Video]',
        message_id: ctx.message.message_id,
        message_type: 'video',
        media_file_id: video.file_id,
        media_caption: caption
      });
      
      // FIXED: Pass the original message context to forward the actual video
      await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'video', ctx.message);
      
      const successMsg = await ctx.reply('✅ Your video has been received.');
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      console.log(`🎥 New video from ${user.first_name} to ${metaBotInfo.botName}`);
      
    } catch (error) {
      console.error('User video message handler error:', error);
      await ctx.reply('❌ Sorry, there was an error sending your video. Please try again.');
    }
  };

  // NEW: Process user document message
  handleUserDocumentMessage = async (ctx, metaBotInfo, user) => {
    try {
      await UserLog.upsert({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        last_interaction: new Date()
      });
      
      const document = ctx.message.document;
      const caption = ctx.message.caption || '';
      
      const feedback = await Feedback.create({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        message: caption || `[File: ${document.file_name || 'Document'}]`,
        message_id: ctx.message.message_id,
        message_type: 'document',
        media_file_id: document.file_id,
        media_caption: caption
      });
      
      // FIXED: Pass the original message context to forward the actual document
      await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'document', ctx.message);
      
      const successMsg = await ctx.reply('✅ Your file has been received.');
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      console.log(`📎 New document from ${user.first_name} to ${metaBotInfo.botName}`);
      
    } catch (error) {
      console.error('User document message handler error:', error);
      await ctx.reply('❌ Sorry, there was an error sending your file. Please try again.');
    }
  };

  // NEW: Process user media group message (albums)
  handleUserMediaGroupMessage = async (ctx, metaBotInfo, user) => {
    try {
      await UserLog.upsert({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        last_interaction: new Date()
      });
      
      // For media groups, we'll store the first media and note it's an album
      const mediaGroup = ctx.message.media_group_id;
      const messageType = ctx.message.photo ? 'image' : 
                         ctx.message.video ? 'video' : 
                         ctx.message.document ? 'document' : 'media_group';
      
      let fileId = '';
      if (ctx.message.photo) {
        fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      } else if (ctx.message.video) {
        fileId = ctx.message.video.file_id;
      } else if (ctx.message.document) {
        fileId = ctx.message.document.file_id;
      }
      
      const caption = ctx.message.caption || '';
      
      const feedback = await Feedback.create({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        message: caption || `[Media Album: ${messageType}]`,
        message_id: ctx.message.message_id,
        message_type: 'media_group',
        media_file_id: fileId,
        media_caption: caption,
        media_group_id: mediaGroup
      });
      
      // FIXED: Pass the original message context to forward the actual media
      await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'media_group', ctx.message);
      
      const successMsg = await ctx.reply('✅ Your media album has been received.');
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      console.log(`🖼️ New media album from ${user.first_name} to ${metaBotInfo.botName}`);
      
    } catch (error) {
      console.error('User media group handler error:', error);
      await ctx.reply('❌ Sorry, there was an error sending your media. Please try again.');
    }
  };

  getBotInstanceByDbId = (dbId) => {
    const botData = this.activeBots.get(parseInt(dbId));
    if (!botData) {
      console.error(`❌ Bot instance not found for DB ID: ${dbId}`);
      console.error(`📊 Available bot IDs:`, Array.from(this.activeBots.keys()));
      return null;
    }
    return botData.instance;
  };

  debugActiveBots = () => {
    console.log('\n🐛 DEBUG: Active Bots Status');
    console.log(`📊 Total active bots: ${this.activeBots.size}`);
    console.log(`🏁 Initialization status: ${this.isInitialized ? 'COMPLETE' : 'PENDING'}`);
    console.log(`🔄 Initialization attempts: ${this.initializationAttempts}`);
    
    if (this.activeBots.size === 0) {
      console.log('❌ No active bots found in memory!');
    } else {
      for (const [dbId, botData] of this.activeBots.entries()) {
        console.log(`🤖 Bot: ${botData.record.bot_name} | DB ID: ${dbId} | Status: ${botData.status} | Launched: ${botData.launchedAt.toISOString()}`);
      }
    }
  };

  async forceReinitializeAllBots() {
    console.log('🔄 FORCE: Reinitializing all mini-bots...');
    this.initializationAttempts = 0;
    this.isInitialized = false;
    return await this.initializeAllBots();
  }

  async forceInitializeAllBotsDebug() {
    console.log('🔄 FORCE DEBUG: Initializing all mini-bots with debug...');
    
    const { Bot } = require('../models');
    const activeBots = await Bot.findAll({ where: { is_active: true } });
    
    console.log(`📊 DEBUG: Found ${activeBots.length} active bots in database`);
    
    for (const botRecord of activeBots) {
      try {
        console.log(`🔧 DEBUG: Attempting to initialize ${botRecord.bot_name}...`);
        console.log(`   - Bot ID: ${botRecord.id}`);
        console.log(`   - Bot Name: ${botRecord.bot_name}`);
        console.log(`   - Is Active: ${botRecord.is_active}`);
        console.log(`   - Owner ID: ${botRecord.owner_id}`);
        
        const token = botRecord.getDecryptedToken();
        console.log(`   - Token available: ${!!token}`);
        if (token) {
          console.log(`   - Token preview: ${token.substring(0, 10)}...`);
        }
        
        const success = await this.initializeBot(botRecord);
        console.log(`   - Initialization result: ${success ? 'SUCCESS' : 'FAILED'}`);
        
      } catch (error) {
        console.error(`💥 DEBUG: Error initializing ${botRecord.bot_name}:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.debugActiveBots();
  }

  getInitializationStatus() {
    return {
      isInitialized: this.isInitialized,
      activeBots: this.activeBots.size,
      attempts: this.initializationAttempts,
      maxAttempts: this.maxInitializationAttempts,
      status: this.isInitialized ? 'READY' : 'INITIALIZING'
    };
  }

  handleStart = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const user = ctx.from;
      
      console.log(`🚀 Start command received for ${metaBotInfo.botName} from ${user.first_name} (ID: ${user.id})`);
      
      // Ensure commands are set for this user
      await this.setBotCommands(ctx.telegram, null, user.id);
      
      await UserLog.upsert({
        bot_id: metaBotInfo.mainBotId,
        user_id: user.id,
        user_username: user.username,
        user_first_name: user.first_name,
        last_interaction: new Date(),
        first_interaction: new Date(),
        interaction_count: 1
      });
      
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      
      if (isAdmin) {
        await this.showAdminDashboard(ctx, metaBotInfo);
      } else {
        await this.showUserWelcome(ctx, metaBotInfo);
      }
      
    } catch (error) {
      console.error('Start handler error:', error);
      await ctx.reply('Welcome! Send me a message, image, or video.');
    }
  };
  
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
        [Markup.button.url('🚀 Create More Bots', 'https://t.me/MarCreatorBot')]
      ]);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(dashboardMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(dashboardMessage, keyboard);
      }
    } catch (error) {
      console.error('Admin dashboard error:', error);
      await ctx.reply('❌ Error loading dashboard.');
    }
  };
  
  showUserWelcome = async (ctx, metaBotInfo) => {
    try {
      const welcomeMessage = `👋 Welcome to *${metaBotInfo.botName}*!\n\n` +
        `We are here to assist you with any questions or concerns you may have.\n\n` +
        `Simply send us a message, image, or video, and we'll respond as quickly as possible!\n\n` +
        `_This Bot is created by @MarCreatorBot_`;
      
      await ctx.replyWithMarkdown(welcomeMessage);
    } catch (error) {
      console.error('User welcome error:', error);
      await ctx.reply(`Welcome to ${metaBotInfo.botName}!`);
    }
  };
  
  handleDashboard = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, ctx.from.id);
      
      if (isAdmin) {
        await this.showAdminDashboard(ctx, metaBotInfo);
      } else {
        await ctx.reply('❌ Admin access required. Use /start for user features.');
      }
    } catch (error) {
      console.error('Dashboard error:', error);
      await ctx.reply('❌ Error loading dashboard.');
    }
  };
  
  // REMOVED: handleMessagesCommand function
  
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
  
  handleStatsCommand = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      await this.showStats(ctx, metaBotInfo.mainBotId);
    } catch (error) {
      console.error('Stats command error:', error);
      await ctx.reply('❌ Error loading statistics.');
    }
  };
  
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
  
  handleHelp = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, ctx.from.id);
      
      let helpMessage;
      
      if (isAdmin) {
        // Admin help content
        helpMessage = `🤖 *Admin Help & Support*\n\n` +
          `*Available Commands:*\n` +
          `/dashboard - 📊 Admin dashboard with quick stats\n` +
          `/broadcast - 📢 Send message to all users\n` +
          `/stats - 📈 View bot statistics\n` +
          `/admins - 👥 Manage admin team (owners only)\n` +
          `/help - ❓ This help message\n\n` +
          `*Quick Tips:*\n` +
          `• Click notification buttons to reply instantly\n` +
          `• Use broadcast for important announcements\n` +
          `• Add co-admins to help manage messages\n\n` +
          `*Need help?* Contact @MarCreatorSupportBot`;
      } else {
        // Regular user help content
        helpMessage = `🤖 *Help & Support*\n\n` +
          `*How to use this bot:*\n` +
          `• Send any message, image, or video to contact our team\n` +
          `• We'll respond as quickly as possible\n` +
          `• You'll get notifications when we reply\n\n` +
          `*Available Commands:*\n` +
          `/start - 🚀 Start the bot\n` +
          `/help - ❓ Get help\n\n` +
          `*We're here to help! 🤝*\n`;
      }
      
      await ctx.replyWithMarkdown(helpMessage);
      
    } catch (error) {
      console.error('Help command error:', error);
      await ctx.reply('Use /start to begin.');
    }
  };
  
  handleTextMessage = async (ctx) => {
    try {
      const user = ctx.from;
      const message = ctx.message.text;
      const { metaBotInfo } = ctx;
      
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
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      console.log(`📨 New message from ${user.first_name} to ${metaBotInfo.botName}`);
      
    } catch (error) {
      console.error('User message handler error:', error);
      await ctx.reply('❌ Sorry, there was an error sending your message. Please try again.');
    }
  };
  
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
        case 'about':
          await this.showAbout(ctx, metaBotInfo);
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
  
  showUserMessages = async (ctx, botId) => {
    try {
      const pendingMessages = await Feedback.findAll({
        where: { bot_id: botId, is_replied: false },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      if (pendingMessages.length === 0) {
        await ctx.reply('📭 No pending messages. All caught up! ✅');
        return;
      }
      
      let message = `📨 *User Messages*\n\n` +
        `*Total Pending:* ${pendingMessages.length}\n\n`;
      
      pendingMessages.forEach((feedback, index) => {
        const userInfo = feedback.user_username ? 
          `@${feedback.user_username}` : 
          `User#${feedback.user_id}`;
        
        let preview = feedback.message;
        if (feedback.message_type !== 'text') {
          preview = `[${this.getMediaTypeEmoji(feedback.message_type)} ${feedback.message_type.toUpperCase()}] ${preview}`;
        }
        
        preview = preview.length > 50 ? 
          preview.substring(0, 50) + '...' : 
          preview;
        
        message += `*${index + 1}.* ${userInfo} (${feedback.user_first_name})\n` +
          `💬 ${preview}\n` +
          `🕒 ${feedback.created_at.toLocaleDateString()}\n\n`;
      });
      
      const keyboardButtons = pendingMessages.slice(0, 5).map(feedback => [
        Markup.button.callback(
          `📩 Reply to ${feedback.user_first_name}`,
          `reply_${feedback.id}`
        )
      ]);
      
      keyboardButtons.push([
        Markup.button.callback('🔙 Dashboard', 'mini_dashboard')
      ]);
      
      const keyboard = Markup.inlineKeyboard(keyboardButtons);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
    } catch (error) {
      console.error('Show messages error:', error);
      await ctx.reply('❌ Error loading messages.');
    }
  };

  // NEW: Helper function to get emoji for media type
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
      
      let mediaInfo = '';
      if (feedback.message_type !== 'text') {
        mediaInfo = `\n*Media Type:* ${feedback.message_type}\n`;
      }
      
      await ctx.reply(
        `💬 *Replying to ${feedback.user_first_name}*\n\n` +
        `*Their message:* ${feedback.message}\n` +
        mediaInfo +
        `\nPlease type your reply message:\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Start reply error:', error);
      await ctx.reply('❌ Error starting reply');
    }
  };
  
  sendReply = async (ctx, feedbackId, userId, replyText) => {
    try {
      console.log(`💬 Attempting to send reply for feedback ID: ${feedbackId}`);
      
      const feedback = await Feedback.findByPk(feedbackId);
      if (!feedback) {
        await ctx.reply('❌ Message not found.');
        return;
      }

      console.log(`🔍 Feedback found, bot_id: ${feedback.bot_id}`);
      
      const botInstance = this.getBotInstanceByDbId(feedback.bot_id);
      
      if (!botInstance) {
        console.error('❌ Bot instance not found for reply');
        this.debugActiveBots();
        await ctx.reply('❌ Bot not active. Please restart the main bot to activate all mini-bots.');
        return;
      }
      
      console.log(`✅ Bot instance found, sending reply to user: ${userId}`);
      
      await botInstance.telegram.sendMessage(
        userId,
        `💬 *Reply from admin:*\n\n${replyText}\n\n` +
        `_This is a reply to your message_`,
        { parse_mode: 'Markdown' }
      );
      
      await feedback.update({
        is_replied: true,
        reply_message: replyText,
        replied_by: ctx.from.id,
        replied_at: new Date()
      });
      
      const successMsg = await ctx.reply('✅ Reply sent successfully!');
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
    } catch (error) {
      console.error('Send reply error:', error);
      await ctx.reply('❌ Error sending reply. User might have blocked the bot.');
    }
  };
  
  startBroadcast = async (ctx, botId) => {
    try {
      const userCount = await UserLog.count({ where: { bot_id: botId } });
      
      if (userCount === 0) {
        await ctx.reply('❌ No users found for broadcasting.');
        return;
      }
      
      this.broadcastSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_message'
      });
      
      await ctx.reply(
        `📢 *Send Broadcast*\n\n` +
        `*Recipients:* ${userCount} users\n\n` +
        `Please type your broadcast message:\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Start broadcast error:', error);
      await ctx.reply('❌ Error starting broadcast.');
    }
  };
  
  sendBroadcast = async (ctx, botId, message) => {
    try {
      console.log(`📢 Starting broadcast for bot ID: ${botId}`);
      
      const users = await UserLog.findAll({ 
        where: { bot_id: botId },
        attributes: ['user_id']
      });
      
      console.log(`📊 Broadcasting to ${users.length} users`);
      
      let successCount = 0;
      let failCount = 0;
      
      const progressMsg = await ctx.reply(`🔄 Sending broadcast to ${users.length} users...\n✅ Sent: 0\n❌ Failed: 0`);
      
      const botInstance = this.getBotInstanceByDbId(botId);
      
      if (!botInstance) {
        console.error('❌ Bot instance not found for broadcast');
        this.debugActiveBots();
        await ctx.reply('❌ Bot not active. Please restart the main bot to activate all mini-bots.');
        return;
      }
      
      console.log(`✅ Bot instance found, starting broadcast...`);
      
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          await botInstance.telegram.sendMessage(user.user_id, message, {
            parse_mode: 'Markdown'
          });
          successCount++;
          
          if (i % 10 === 0) {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              progressMsg.message_id,
              null,
              `🔄 Sending broadcast to ${users.length} users...\n✅ Sent: ${successCount}\n❌ Failed: ${failCount}`
            );
          }
          
          if (i % 30 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          failCount++;
          console.error(`Failed to send to user ${user.user_id}:`, error.message);
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
      
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        `✅ *Broadcast Completed!*\n\n` +
        `*Recipients:* ${users.length}\n` +
        `*✅ Successful:* ${successCount}\n` +
        `*❌ Failed:* ${failCount}\n` +
        `*📊 Success Rate:* ${successRate}%`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Send broadcast error:', error);
      await ctx.reply('❌ Error sending broadcast: ' + error.message);
    }
  };
  
  showStats = async (ctx, botId) => {
    try {
      const userCount = await UserLog.count({ where: { bot_id: botId } });
      const messageCount = await Feedback.count({ where: { bot_id: botId } });
      const pendingCount = await Feedback.count({ 
        where: { bot_id: botId, is_replied: false } 
      });
      
      // Get message type breakdown
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
  
  showAdmins = async (ctx, botId) => {
    try {
      const admins = await Admin.findAll({
        where: { bot_id: botId },
        include: [{ model: User, as: 'User' }]
      });
      
      const bot = await Bot.findByPk(botId);
      
      let message = `👥 *Admin Management*\n\n` +
        `*Total Admins:* ${admins.length}\n\n` +
        `*Current Admins:*\n`;
      
      admins.forEach((admin, index) => {
        const userInfo = admin.User ? 
          `@${admin.User.username} (${admin.User.first_name})` : 
          `User#${admin.admin_user_id}`;
        
        const isOwner = admin.admin_user_id === bot.owner_id;
        
        message += `*${index + 1}.* ${userInfo} ${isOwner ? '👑 (Owner)' : ''}\n`;
      });
      
      const keyboardButtons = [];
      
      admins.filter(admin => admin.admin_user_id !== bot.owner_id).forEach(admin => {
        keyboardButtons.push([
          Markup.button.callback(
            `➖ Remove ${admin.User?.username || `User#${admin.admin_user_id}`}`,
            `remove_admin_${admin.id}`
          )
        ]);
      });
      
      keyboardButtons.push(
        [Markup.button.callback('➕ Add Admin', 'admin_add')],
        [Markup.button.callback('🔙 Dashboard', 'mini_dashboard')]
      );
      
      const keyboard = Markup.inlineKeyboard(keyboardButtons);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
    } catch (error) {
      console.error('Show admins error:', error);
      await ctx.reply('❌ Error loading admins.');
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
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      await this.showAdmins(ctx, botId);
      
    } catch (error) {
      console.error('Remove admin error:', error);
      await ctx.reply('❌ Error removing admin.');
    }
  };
  
  startAddAdmin = async (ctx, botId) => {
    try {
      this.adminSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_admin_input'
      });
      
      await ctx.reply(
        `👥 *Add New Admin*\n\n` +
        `Please send the new admin's Telegram *User ID* or *Username*:\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
      
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
      
      const existingAdmin = await Admin.findOne({
        where: { bot_id: botId, admin_user_id: targetUserId }
      });
      
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
        permissions: {
          can_reply: true,
          can_broadcast: true,
          can_manage_admins: false,
          can_view_stats: true,
          can_deactivate: false
        }
      });
      
      const userDisplay = targetUser.username ? `@${targetUser.username}` : `User#${targetUserId}`;
      
      const successMsg = await ctx.reply(
        `✅ *${userDisplay} added as admin!*\n\n` +
        `They can now reply to messages and send broadcasts.`,
        { parse_mode: 'Markdown' }
      );
      
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
    } catch (error) {
      console.error('Process add admin error:', error);
      await ctx.reply('❌ Error adding admin.');
    }
  };
  
  showAbout = async (ctx, metaBotInfo) => {
    try {
      const aboutMessage = `ℹ️ *About ${metaBotInfo.botName}*\n\n` +
        `*Bot Username:* @${metaBotInfo.botUsername}\n` +
        `*Created via:* @MarCreatorBot\n\n` +
        `*Create your own bot:* @MarCreatorBot`;
      
      await ctx.replyWithMarkdown(aboutMessage);
    } catch (error) {
      console.error('About error:', error);
      await ctx.reply(`About ${metaBotInfo.botName}`);
    }
  };
  
// FIXED: Enhanced to handle media forwarding with actual files
notifyAdminsRealTime = async (botId, feedback, user, messageType = 'text', originalMessage = null) => {
  try {
    console.log(`🔔 Sending real-time notification for bot ID: ${botId}, type: ${messageType}`);
    
    const admins = await Admin.findAll({
      where: { bot_id: botId },
      include: [{ model: User, as: 'User' }]
    });
    
    const bot = await Bot.findByPk(botId);
    
    const botInstance = this.getBotInstanceByDbId(botId);
    
    if (!botInstance) {
      console.error('❌ Bot instance not found for real-time notification');
      this.debugActiveBots();
      return;
    }
    
    const mediaEmoji = this.getMediaTypeEmoji(messageType);
    const mediaTypeText = messageType === 'text' ? 'Message' : messageType.charAt(0).toUpperCase() + messageType.slice(1);
    
    // Send the actual media with buttons in a single message
    for (const admin of admins) {
      if (admin.User) {
        try {
          // FIXED: Combine media and buttons in single message
          if (messageType === 'image' && originalMessage && originalMessage.photo) {
            // Forward the actual image with buttons
            await botInstance.telegram.sendPhoto(
              admin.User.telegram_id,
              originalMessage.photo[originalMessage.photo.length - 1].file_id,
              {
                caption: `🔔 *New Image from ${user.first_name}${user.username ? ` (@${user.username})` : ''}*\n\n` +
                         `💬 ${originalMessage.caption || '[No caption]'}\n\n` +
                         `*Quick Actions:*`,
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                  [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
                ])
              }
            );
          } else if (messageType === 'video' && originalMessage && originalMessage.video) {
            // Forward the actual video with buttons
            await botInstance.telegram.sendVideo(
              admin.User.telegram_id,
              originalMessage.video.file_id,
              {
                caption: `🔔 *New Video from ${user.first_name}${user.username ? ` (@${user.username})` : ''}*\n\n` +
                         `💬 ${originalMessage.caption || '[No caption]'}\n\n` +
                         `*Quick Actions:*`,
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                  [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
                ])
              }
            );
          } else if (messageType === 'document' && originalMessage && originalMessage.document) {
            // Forward the actual document with buttons
            await botInstance.telegram.sendDocument(
              admin.User.telegram_id,
              originalMessage.document.file_id,
              {
                caption: `🔔 *New File from ${user.first_name}${user.username ? ` (@${user.username})` : ''}*\n\n` +
                         `💬 ${originalMessage.caption || '[No caption]'}\n\n` +
                         `*Quick Actions:*`,
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                  [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
                ])
              }
            );
          } else if (messageType === 'media_group' && originalMessage) {
            // For media groups, send a notification with buttons
            await botInstance.telegram.sendMessage(
              admin.User.telegram_id,
              `🔔 *Media Album from ${user.first_name}${user.username ? ` (@${user.username})` : ''}*\n\n` +
              `💬 ${originalMessage.caption || '[No caption]'}\n\n` +
              `*This is a media album with multiple files.*\n\n` +
              `*Quick Actions:*`,
              { 
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                  [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
                ])
              }
            );
          } else {
            // For text messages or fallback - single message with buttons
            let notificationMessage = `🔔 *New ${mediaTypeText} Received*\n\n` +
              `*From:* ${user.first_name}${user.username ? ` (@${user.username})` : ''}\n`;
            
            if (messageType === 'text') {
              notificationMessage += `*Message:* ${feedback.message}\n\n`;
            } else {
              notificationMessage += `*Caption:* ${feedback.media_caption || '[No caption]'}\n` +
                `*Type:* ${messageType}\n\n`;
            }
            
            notificationMessage += `*Quick Actions:*`;
            
            await botInstance.telegram.sendMessage(admin.User.telegram_id, notificationMessage, {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
              ])
            });
          }
          
          console.log(`🔔 Media notification sent to admin: ${admin.User.username}`);
        } catch (error) {
          console.error(`Failed to notify admin ${admin.User.username}:`, error.message);
        }
      }
    }
    
    // Also notify the owner if they're not in the admin list
    const owner = await User.findOne({ where: { telegram_id: bot.owner_id } });
    if (owner && !admins.find(a => a.admin_user_id === owner.telegram_id)) {
      try {
        // Same forwarding logic for owner - single message with buttons
        if (messageType === 'image' && originalMessage && originalMessage.photo) {
          await botInstance.telegram.sendPhoto(
            owner.telegram_id,
            originalMessage.photo[originalMessage.photo.length - 1].file_id,
            {
              caption: `🔔 *New Image from ${user.first_name}${user.username ? ` (@${user.username})` : ''}*\n\n` +
                       `💬 ${originalMessage.caption || '[No caption]'}\n\n` +
                       `*Quick Actions:*`,
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
              ])
            }
          );
        } else if (messageType === 'video' && originalMessage && originalMessage.video) {
          await botInstance.telegram.sendVideo(
            owner.telegram_id,
            originalMessage.video.file_id,
            {
              caption: `🔔 *New Video from ${user.first_name}${user.username ? ` (@${user.username})` : ''}*\n\n` +
                       `💬 ${originalMessage.caption || '[No caption]'}\n\n` +
                       `*Quick Actions:*`,
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
              ])
            }
          );
        } else if (messageType === 'document' && originalMessage && originalMessage.document) {
          await botInstance.telegram.sendDocument(
            owner.telegram_id,
            originalMessage.document.file_id,
            {
              caption: `🔔 *New File from ${user.first_name}${user.username ? ` (@${user.username})` : ''}*\n\n` +
                       `💬 ${originalMessage.caption || '[No caption]'}\n\n` +
                       `*Quick Actions:*`,
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
              ])
            }
          );
        } else {
          let notificationMessage = `🔔 *New ${mediaTypeText} Received*\n\n` +
            `*From:* ${user.first_name}${user.username ? ` (@${user.username})` : ''}\n`;
          
          if (messageType === 'text') {
            notificationMessage += `*Message:* ${feedback.message}\n\n`;
          } else {
            notificationMessage += `*Caption:* ${feedback.media_caption || '[No caption]'}\n` +
              `*Type:* ${messageType}\n\n`;
          }
          
          notificationMessage += `*Quick Actions:*`;
          
          await botInstance.telegram.sendMessage(owner.telegram_id, notificationMessage, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
            ])
          });
        }
        
        console.log(`🔔 Media notification sent to owner: ${owner.username}`);
      } catch (error) {
        console.error('Failed to notify owner:', error.message);
      }
    }
    
    console.log(`🔔 Real-time media notification sent for ${bot.bot_name}`);
    
  } catch (error) {
    console.error('Real-time notification error:', error);
  }
};
  
  getQuickStats = async (botId) => {
    try {
      const userCount = await UserLog.count({ where: { bot_id: botId } });
      const messageCount = await Feedback.count({ where: { bot_id: botId } });
      const pendingCount = await Feedback.count({ 
        where: { bot_id: botId, is_replied: false } 
      });
      
      return {
        totalUsers: userCount,
        totalMessages: messageCount,
        pendingMessages: pendingCount
      };
    } catch (error) {
      return { totalUsers: 0, totalMessages: 0, pendingMessages: 0 };
    }
  };
  
  checkAdminAccess = async (botId, userId) => {
    try {
      const bot = await Bot.findByPk(botId);
      if (bot.owner_id == userId) return true;
      
      const admin = await Admin.findOne({
        where: { bot_id: botId, admin_user_id: userId }
      });
      
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
  
  stopBot = async (botId) => {
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
  };

  healthCheck = () => {
    console.log('🏥 Mini-bot Manager Health Check:');
    console.log(`📊 Active bots: ${this.activeBots.size}`);
    console.log(`🏁 Initialized: ${this.isInitialized}`);
    console.log(`🔄 Initialization in progress: ${!!this.initializationPromise}`);
    console.log(`🔄 Initialization attempts: ${this.initializationAttempts}`);
    
    this.debugActiveBots();
    
    return {
      isHealthy: this.isInitialized && !this.initializationPromise,
      activeBots: this.activeBots.size,
      status: this.isInitialized ? 'READY' : 'INITIALIZING',
      attempts: this.initializationAttempts
    };
  };
}

module.exports = new MiniBotManager();