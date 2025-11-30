// src/services/MiniBotManager.js - COMPLETE BOTOMICS VERSION
const { Telegraf, Markup } = require('telegraf');
const { Bot, UserLog, Feedback, Admin, User, BroadcastHistory } = require('../models');
const ReferralHandler = require('../handlers/referralHandler');

// Import new feature handlers
const ChannelJoinHandler = require('../handlers/channelJoinHandler');
const BanHandler = require('../handlers/banHandler');
const channelVerificationMiddleware = require('../middleware/channelVerification');
const banCheckMiddleware = require('../middleware/banCheck');

// Import Botomics services
const WalletService = require('./walletService');
const SubscriptionService = require('./subscriptionService');

class MiniBotManager {
  constructor() {
    this.activeBots = new Map();
    this.broadcastSessions = new Map();
    this.replySessions = new Map();
    this.adminSessions = new Map();
    this.messageFlowSessions = new Map();
    this.welcomeMessageSessions = new Map();
    
    // Botomics session maps
    this.referralSessions = new Map();
    this.currencySessions = new Map();
    this.pinStartMessageSessions = new Map();
    this.transferOwnershipSessions = new Map();
    this.donationSessions = new Map();
    this.adSessions = new Map();
    
    // Environment detection
    this.isDevelopment = process.env.NODE_ENV === 'development' || 
                        process.env.NODE_ENV === 'dev' || 
                        process.env.DEV_MODE === 'true';
    
    // Bot identification based on environment
    this.mainBotUsername = this.isDevelopment ? 'BotomicsDevBot' : 'BotomicsBot';
    this.mainBotDisplayName = this.isDevelopment ? '🤖 Botomics DEV' : '🤖 Botomics';
    
    console.log(`🚀 MiniBotManager initialized for ${this.isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} environment`);
    console.log(`🔍 Using main bot: @${this.mainBotUsername}`);
  }

  // === NATIVE TELEGRAM EDIT HANDLER ===
  handleNativeMessageEdit = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const editedMessage = ctx.editedMessage || ctx.update.edited_message;
      
      if (!editedMessage || !metaBotInfo) {
        return;
      }
      
      const user = editedMessage.from;
      const messageId = editedMessage.message_id;
      const newContent = editedMessage.text || editedMessage.caption || '[Edited content]';
      
      console.log(`✏️ Native edit detected from user ${user.id} for message ${messageId}`);
      
      // Find the original message in database
      const feedback = await Feedback.findOne({
        where: {
          bot_id: metaBotInfo.mainBotId,
          user_id: user.id,
          message_id: messageId
        }
      });
      
      if (feedback) {
        // Update the message in database
        await feedback.update({
          message: newContent,
          is_edited: true,
          edited_at: new Date()
        });
        
        console.log(`✅ Database updated for native edit from user ${user.id}`);
        
        // REMOVED: Admin notifications for edits as requested
        // No longer notifying admins about message edits
        
      } else {
        console.log(`❌ Original message not found in database for native edit`);
      }
      
    } catch (error) {
      console.error('Error handling native message edit:', error);
    }
  };
  
  // Helper method to get environment-specific bot references
  getBotReference(botName = '') {
    const envSuffix = this.isDevelopment ? ' 🚧 DEV' : '';
    return {
      username: this.mainBotUsername,
      displayName: this.mainBotDisplayName,
      fullName: `${botName}${envSuffix}`,
      isDevelopment: this.isDevelopment,
      supportBot: this.isDevelopment ? 'BotomicsDevSupportBot' : 'BotomicsSupportBot'
    };
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
      console.log(`🔄 CRITICAL: Starting mini-bot initialization on server startup (${this.isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'})...`);
      
      await this.clearAllBots();
      
      console.log('⏳ Waiting for database to be fully ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const activeBots = await Bot.findAll({ where: { is_active: true } });
      
      console.log(`📊 Found ${activeBots.length} active bots in database to initialize`);
      
      if (activeBots.length === 0) {
        console.log('ℹ️ No active bots found in database - this is normal for new deployment');
        this.isInitialized = true;
        return 0;
      }
      
      let successCount = 0;
      let failedCount = 0;
      
      console.log(`🚀 INITIALIZING ${activeBots.length} BOTS WITH 10-15 SECOND DELAYS`);
      
      for (let i = 0; i < activeBots.length; i++) {
        const botRecord = activeBots[i];
        const progress = `${i+1}/${activeBots.length}`;
        
        try {
          console.log(`\n🔄 [${progress}] Initializing: ${botRecord.bot_name}`);
          
          const owner = await User.findOne({ where: { telegram_id: botRecord.owner_id } });
          if (owner && owner.is_banned) {
            console.log(`🚫 Skipping bot ${botRecord.bot_name} - owner is banned`);
            await botRecord.update({ is_active: false });
            failedCount++;
            continue;
          }
          
          const success = await this.initializeBotWithEncryptionCheck(botRecord);
          
          if (success) {
            successCount++;
            console.log(`✅ [${progress}] SUCCESS: ${botRecord.bot_name}`);
          } else {
            failedCount++;
            console.log(`❌ [${progress}] FAILED: ${botRecord.bot_name}`);
          }
          
          // Progress tracking
          const progressPercent = ((i + 1) / activeBots.length * 100).toFixed(1);
          const estimatedMinutes = ((activeBots.length - (i + 1)) * 12 / 60).toFixed(1);
          console.log(`📊 ${progressPercent}% complete | ~${estimatedMinutes} minutes remaining`);
          
          // LONG delay between bots (10-15 seconds) - CRITICAL!
          if (i < activeBots.length - 1) {
            const delay = Math.floor(Math.random() * 5000) + 10000; // 10-15 seconds
            console.log(`⏳ Waiting ${delay/1000} seconds before next bot...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
        } catch (error) {
          console.error(`💥 [${progress}] Error: ${botRecord.bot_name} -`, error.message);
          failedCount++;
          
          // Long wait even on error
          if (i < activeBots.length - 1) {
            const errorDelay = 15000; // 15 seconds on error
            console.log(`⏳ Waiting ${errorDelay/1000}s after error...`);
            await new Promise(resolve => setTimeout(resolve, errorDelay));
          }
        }
      }
      
      console.log(`\n🎉 INITIALIZATION COMPLETE: ${successCount}/${activeBots.length} successful (${failedCount} failed)`);
      
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
        handlerTimeout: 90000,
        telegram: { 
          apiRoot: 'https://api.telegram.org',
          agent: null,
          timeout: 30000
        }
      });
      
      const botRef = this.getBotReference(botRecord.bot_name);
      
      bot.context.metaBotInfo = {
        mainBotId: botRecord.id,
        botId: botRecord.bot_id,
        botName: botRef.fullName,
        botUsername: botRecord.bot_username,
        botRecord: botRecord,
        environment: this.isDevelopment ? 'development' : 'production',
        mainBotRef: botRef
      };
      
      this.setupHandlers(bot);
      
      await this.setBotCommands(bot, token);
      
      console.log(`🚀 Launching bot: ${botRecord.bot_name}`);
      
      this.activeBots.set(botRecord.id, { 
        instance: bot, 
        record: botRecord,
        token: token,
        launchedAt: new Date(),
        status: 'launching',
        environment: this.isDevelopment ? 'development' : 'production'
      });
      
      console.log(`✅ Mini-bot stored in activeBots BEFORE launch: ${botRecord.bot_name} - DB ID: ${botRecord.id}`);
      
      // ULTRA-ROBUST POLLING LAUNCH
      try {
        console.log(`🔄 Step 1: Deleting webhook for ${botRecord.bot_name}...`);
        
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log(`✅ Webhook deleted for ${botRecord.bot_name}`);
        
        // LONG wait before polling (8-12 seconds)
        const prePollDelay = Math.floor(Math.random() * 4000) + 8000;
        console.log(`⏳ Waiting ${prePollDelay/1000}s before polling ${botRecord.bot_name}...`);
        await new Promise(resolve => setTimeout(resolve, prePollDelay));
        
        console.log(`🔄 Step 2: Starting polling for ${botRecord.bot_name}...`);
        
        // Start polling WITHOUT waiting for completion
        bot.startPolling({
          dropPendingUpdates: true,
          allowedUpdates: ['message', 'callback_query', 'edited_message'],
          polling: {
            timeout: 25,
            limit: 25,
          }
        });
        
        // Don't wait for polling to initialize - just continue
        console.log(`✅ Bot ${botRecord.bot_name} polling initiated`);
        
        // Update bot status immediately
        const botData = this.activeBots.get(botRecord.id);
        if (botData) {
          botData.status = 'active';
          botData.launchedAt = new Date();
          console.log(`✅ Bot marked as ACTIVE: ${botRecord.bot_name}`);
        }
        
        return true;
        
      } catch (launchError) {
        console.error(`❌ Launch failed for ${botRecord.bot_name}:`, launchError.message);
        
        // MARK AS ACTIVE ANYWAY - the bot might still work
        console.log(`🔄 Marking ${botRecord.bot_name} as active despite error...`);
        const botData = this.activeBots.get(botRecord.id);
        if (botData) {
          botData.status = 'active';
          console.log(`✅ Bot marked as ACTIVE despite error: ${botRecord.bot_name}`);
        }
        
        return true; // Always return true to continue
      }
          
    } catch (error) {
      console.error(`❌ Failed to start bot ${botRecord.bot_name}:`, error.message);
      
      // Only remove from active bots on auth errors
      if (error.code === 401 || error.message.includes('401') || error.message.includes('Unauthorized')) {
        this.activeBots.delete(botRecord.id);
      }
      
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
      
      const userCommands = [
        { command: 'start', description: '🚀 Start the bot' },
        { command: 'help', description: '❓ Get help' },
        { command: 'referral', description: '💰 Referral program' }
      ];
      
      const adminCommands = [
        { command: 'start', description: '🚀 Start the bot' },
        { command: 'dashboard', description: '📊 Admin dashboard' },
        { command: 'broadcast', description: '📢 Send broadcast' },
        { command: 'stats', description: '📈 View statistics' },
        { command: 'admins', description: '👥 Manage admins' },
        { command: 'settings', description: '⚙️ Bot settings' },
        { command: 'help', description: '❓ Get help' },
        { command: 'ban', description: '🚫 Ban user' },
        { command: 'unban', description: '✅ Unban user' },
        { command: 'referral', description: '💰 Referral program' }
      ];
      
      if (userId) {
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
        await bot.telegram.setMyCommands(userCommands);
        console.log('✅ Default user commands set for all users');
      }
    } catch (error) {
      console.error('❌ Failed to set bot commands:', error.message);
    }
  }
  
  setupHandlers = (bot) => {
    console.log('🔄 Setting up handlers for bot...');

    // === NATIVE TELEGRAM EDIT HANDLERS ===
    bot.on('edited_message', async (ctx) => {
      await this.handleNativeMessageEdit(ctx);
    });
    
    // Register callback handlers FIRST
    ReferralHandler.registerCallbacks(bot);
    ChannelJoinHandler.registerCallbacks(bot);
    
    // Add channel verification middleware for ALL messages
    bot.use(async (ctx, next) => {
      try {
        const { metaBotInfo } = ctx;
        if (!metaBotInfo || !ctx.from) {
          return next();
        }

        // Skip verification for admins
        const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, ctx.from.id);
        if (isAdmin) {
          return next();
        }

        // Skip verification for /start command with referral parameter
        if (ctx.message?.text?.startsWith('/start ref-')) {
          return next();
        }

        // Check channel membership for ALL messages
        const membershipCheck = await ChannelJoinHandler.checkChannelMembership(
          ctx, 
          metaBotInfo.mainBotId, 
          ctx.from.id
        );

        if (membershipCheck.required && !membershipCheck.joined) {
          console.log(`🔒 User ${ctx.from.id} needs to join channels`);
          // Show join wall instead of proceeding
          await ChannelJoinHandler.showJoinWall(ctx, metaBotInfo, membershipCheck);
          return;
        }

        return next();
      } catch (error) {
        console.error('Channel verification middleware error:', error);
        return next();
      }
    });

    // Then add other middlewares
    bot.use(banCheckMiddleware);
    
    // Then add the main middleware for session handling
    bot.use(async (ctx, next) => {
      ctx.miniBotManager = this;
      
      // Handle ban text input sessions
      if (ctx.message?.text && await BanHandler.handleBanTextInput(ctx, ctx.message.text)) {
        return;
      }
      
      // Handle channel join text input sessions
      if (ctx.message?.text && await ChannelJoinHandler.handleChannelTextInput(ctx, ctx.message.text)) {
        return;
      }

      // Handle referral settings text input sessions
      if (ctx.message?.text && await ReferralHandler.processReferralSettingChange(ctx, ctx.metaBotInfo?.mainBotId, ctx.message.text)) {
        return;
      }

      if (ctx.from) {
        const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
        if (user && user.is_banned) {
          console.log(`🚫 Banned user ${ctx.from.id} tried to access bot ${ctx.metaBotInfo?.botName}`);
          await ctx.reply('🚫 Your account has been banned from using this platform.');
          return;
        }
      }

      if (ctx.from && ctx.metaBotInfo) {
        await this.setBotCommands(bot, null, ctx.from.id);
      }

      return next();
    });
    
    // Start command with referral handling
    bot.start(async (ctx) => {
      try {
        // Check for referral parameter
        const startPayload = ctx.payload;
        if (startPayload && startPayload.startsWith('ref-')) {
          const referralCode = startPayload.replace('ref-', '');
          await ReferralHandler.handleReferralStart(ctx, referralCode);
        }
        
        await this.handleStart(ctx);
      } catch (error) {
        console.error('Start with referral error:', error);
        await this.handleStart(ctx); // Fallback to normal start
      }
    });
    
    // Existing commands
    bot.command('dashboard', (ctx) => this.handleDashboard(ctx));
    bot.command('broadcast', (ctx) => this.handleBroadcastCommand(ctx));
    bot.command('stats', (ctx) => this.handleStatsCommand(ctx));
    bot.command('admins', (ctx) => this.handleAdminsCommand(ctx));
    bot.command('settings', (ctx) => this.handleSettingsCommand(ctx));
    bot.command('help', (ctx) => this.handleHelp(ctx));
    
    // Ban commands
    bot.command('ban', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ').slice(1);
        if (args.length < 1) {
          await ctx.reply(
            '❌ <b>Usage: /ban &lt;username_or_id&gt; [reason]</b>\n\n' +
            '<b>Examples:</b>\n' +
            '/ban @username Spamming messages\n' +
            '/ban 123456789 Violating rules\n' +
            '/ban @username',
            { parse_mode: 'HTML' }
          );
          return;
        }
        
        const userIdentifier = args[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';
        
        await BanHandler.handleBanCommand(ctx, userIdentifier, reason);
      } catch (error) {
        console.error('Ban command error:', error);
        await ctx.reply('❌ Error processing ban command. Usage: /ban <username_or_id> [reason]');
      }
    });
    
    bot.command('unban', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ').slice(1);
        if (args.length < 1) {
          await ctx.reply(
            '❌ <b>Usage: /unban &lt;username_or_id&gt;</b>\n\n' +
            '<b>Examples:</b>\n' +
            '/unban @username\n' +
            '/unban 123456789',
            { parse_mode: 'HTML' }
          );
          return;
        }
        
        const userIdentifier = args[0];
        await BanHandler.handleUnbanCommand(ctx, userIdentifier);
      } catch (error) {
        console.error('Unban command error:', error);
        await ctx.reply('❌ Error processing unban command. Usage: /unban <username_or_id>');
      }
    });
    
    // Message handlers
    bot.on('text', (ctx) => this.handleTextMessage(ctx));
    bot.on('photo', (ctx) => this.handleImageMessage(ctx));
    bot.on('video', (ctx) => this.handleVideoMessage(ctx));
    bot.on('document', (ctx) => this.handleDocumentMessage(ctx));
    bot.on('audio', (ctx) => this.handleAudioMessage(ctx));
    bot.on('voice', (ctx) => this.handleVoiceMessage(ctx));
    bot.on('media_group', (ctx) => this.handleMediaGroupMessage(ctx));
    
    // EXISTING ACTION HANDLERS
    bot.action(/^mini_(.+)/, (ctx) => this.handleMiniAction(ctx));
    bot.action(/^reply_(.+)/, (ctx) => this.handleReplyAction(ctx));
    bot.action(/^admin_(.+)/, (ctx) => this.handleAdminAction(ctx));
    bot.action(/^remove_admin_(.+)/, (ctx) => this.handleRemoveAdminAction(ctx));
    bot.action(/^settings_(.+)/, (ctx) => this.handleSettingsAction(ctx));
    
    // BOTOMICS ACTION HANDLERS
    bot.action(/^settings_pin_message/, async (ctx) => {
      const { metaBotInfo } = ctx;
      await this.handlePinStartMessage(ctx, metaBotInfo.mainBotId);
    });
    
    bot.action(/^settings_unpin_message/, async (ctx) => {
      const { metaBotInfo } = ctx;
      await this.unpinStartMessage(ctx, metaBotInfo.mainBotId);
    });
    
    bot.action(/^settings_toggle_donations/, async (ctx) => {
      const { metaBotInfo } = ctx;
      await this.toggleDonationSystem(ctx, metaBotInfo.mainBotId);
    });
    
    bot.action(/^transfer_ownership_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await this.handleTransferOwnership(ctx, botId);
    });
    
    bot.action(/^donate_(.+)_(.+)/, async (ctx) => {
      const [, botId, amount] = ctx.match;
      await this.processDonation(ctx, botId, parseFloat(amount));
    });
    
    bot.action(/^donate_custom_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      this.donationSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_custom_amount'
      });
      
      await ctx.reply('💵 Please enter the custom donation amount in BOM:');
      await ctx.answerCbQuery();
    });
    
    bot.action('subscribe_premium', async (ctx) => {
      const { metaBotInfo } = ctx;
      const botRef = this.getBotReference();
      await ctx.reply(
        `🎫 *Premium Subscription*\n\n` +
        `To upgrade to premium, please visit our main bot:\n\n` +
        `Go to @${botRef.username} and use /premium command\n\n` +
        `All premium features will be available across all your bots!`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url(`🔗 Open @${botRef.username}`, `https://t.me/${botRef.username}`)],
            [Markup.button.callback('🔙 Back', 'mini_dashboard')]
          ])
        }
      );
      await ctx.answerCbQuery();
    });
    
    // NEW ACTION HANDLERS FOR ADVANCED FEATURES
    bot.action(/^verify_channels_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.handleChannelVerification(ctx, botId);
    });
    
    bot.action(/^check_channels_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.handleChannelVerification(ctx, botId);
    });
    
    bot.action(/^continue_after_verify_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.handleContinueAfterVerify(ctx, botId);
    });
    
    bot.action(/^channel_manage_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.showChannelManagement(ctx, botId);
    });
    
    bot.action(/^channel_add_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.startAddChannel(ctx, botId);
    });
    
    bot.action(/^ref_dashboard_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.showReferralDashboard(ctx, botId);
    });
    
    bot.action(/^my_referees_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.showUserReferrals(ctx, botId);
    });
    
    bot.action(/^withdraw_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.handleWithdrawal(ctx, botId);
    });
    
    bot.action(/^ref_toggle_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ReferralHandler.toggleReferralProgram(ctx, botId);
    });
    
    bot.action(/^banned_users_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await BanHandler.showBannedUsers(ctx, botId);
    });
    
    bot.action(/^ban_user_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await BanHandler.startBanUser(ctx, botId);
    });
    
    bot.action(/^unban_user_(.+)_(.+)/, async (ctx) => {
      const [, botId, userId] = ctx.match;
      await BanHandler.handleUnbanCommand(ctx, userId);
    });
    
    bot.action(/^ban_management_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await BanHandler.showBanManagement(ctx, botId);
    });
    
    bot.catch((error, ctx) => {
      console.error(`Error in mini-bot ${ctx.metaBotInfo?.botName}:`, error);
    });
    
    console.log('✅ Bot handlers setup complete with all Botomics features');
  };

  // BOTOMICS FEATURES IMPLEMENTATION

  // 1. Pin /start Message Feature
  handlePinStartMessage = async (ctx, botId) => {
    try {
      const { metaBotInfo } = ctx;
      const isOwner = await this.checkOwnerAccess(botId, ctx.from.id);
      
      if (!isOwner) {
        await ctx.reply('❌ Only bot owner can pin start messages.');
        return;
      }
      
      // Check premium access
      const hasPremium = await this.checkPremiumAccess(ctx, 'Pin Start Message');
      if (!hasPremium) {
        return;
      }
      
      this.pinStartMessageSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_pin_message'
      });
      
      await ctx.reply(
        `📌 *Pin Start Message*\n\n` +
        `Please send the message you want to pin for both new and existing users:\n\n` +
        `*This message will be shown to:*\n` +
        `• New users when they start the bot\n` +
        `• Existing users when they use /start\n\n` +
        `*Tips:*\n` +
        `• Use markdown formatting\n` +
        `• Include important information\n` +
        `• Keep it concise\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Pin start message error:', error);
      await ctx.reply('❌ Error starting pin message setup.');
    }
  };

  processPinStartMessage = async (ctx, botId, message) => {
    try {
      const bot = await Bot.findByPk(botId);
      
      await bot.update({
        pinned_start_message: message
      });
      
      const successMsg = await ctx.reply('✅ Start message pinned successfully!');
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      // Show updated settings
      await this.showSettings(ctx, botId);
      
    } catch (error) {
      console.error('Process pin message error:', error);
      await ctx.reply('❌ Error pinning start message.');
    }
  };

  unpinStartMessage = async (ctx, botId) => {
    try {
      const bot = await Bot.findByPk(botId);
      await bot.update({ pinned_start_message: null });
      
      const successMsg = await ctx.reply('✅ Start message unpinned successfully!');
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      await this.showSettings(ctx, botId);
      
    } catch (error) {
      console.error('Unpin start message error:', error);
      await ctx.reply('❌ Error unpinning start message.');
    }
  };

  // 3. Donation System
  handleDonation = async (ctx, botId = null) => {
    try {
      const targetBotId = botId || ctx.metaBotInfo?.mainBotId;
      const bot = await Bot.findByPk(targetBotId);
      
      if (!bot) {
        await ctx.reply('❌ Bot not found.');
        return;
      }
      
      // Check if donation system is enabled
      const subscriptionTier = await SubscriptionService.getSubscriptionTier(bot.owner_id);
      if (subscriptionTier !== 'premium' && !bot.has_donation_enabled) {
        await ctx.reply('❌ Donation system is not enabled for this bot.');
        return;
      }
      
      const message = `☕ *Buy Me a Coffee*\n\n` +
        `Support ${bot.bot_name} by sending a donation!\n\n` +
        `*All donations go directly to the bot owner*\n\n` +
        `*Suggested amounts:*\n` +
        `• 1 BOM ($1.00) - Small coffee\n` +
        `• 5 BOM ($5.00) - Large coffee\n` +
        `• 10 BOM ($10.00) - Lunch\n` +
        `• Custom amount\n\n` +
        `*Current Bot:* ${bot.bot_name} (@${bot.bot_username})`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('1 BOM ☕', `donate_${bot.id}_1`)],
        [Markup.button.callback('5 BOM 🍵', `donate_${bot.id}_5`)],
        [Markup.button.callback('10 BOM 🍲', `donate_${bot.id}_10`)],
        [Markup.button.callback('Custom Amount', `donate_custom_${bot.id}`)],
        [Markup.button.callback('🔙 Back', 'start')]
      ]);
      
      await ctx.replyWithMarkdown(message, keyboard);
      
    } catch (error) {
      console.error('Donation handler error:', error);
      await ctx.reply('❌ Error loading donation options.');
    }
  };

  processDonation = async (ctx, botId, amount) => {
    try {
      const donorId = ctx.from.id;
      const bot = await Bot.findByPk(botId);
      
      // Check donor's wallet balance
      const donorBalance = await WalletService.getBalance(donorId);
      if (donorBalance.balance < amount) {
        await ctx.reply(`❌ Insufficient balance. You need ${amount} BOM but only have ${donorBalance.balance} BOM.`);
        return;
      }
      
      // Process donation
      await WalletService.transfer(
        donorId,
        bot.owner_id,
        amount,
        `Donation to ${bot.bot_name}`
      );
      
      // Notify bot owner
      const botInstance = this.getBotInstanceByDbId(botId);
      if (botInstance) {
        await botInstance.telegram.sendMessage(
          bot.owner_id,
          `🎉 *You received a donation!*\n\n` +
          `*From:* ${ctx.from.first_name}${ctx.from.username ? ` (@${ctx.from.username})` : ''}\n` +
          `*Amount:* ${amount} BOM ($${amount}.00)\n` +
          `*Bot:* ${bot.bot_name}\n\n` +
          `💝 Thank you for creating great bots!`,
          { parse_mode: 'Markdown' }
        );
      }
      
      await ctx.reply(
        `🎉 *Thank you for your donation!*\n\n` +
        `You donated ${amount} BOM to ${bot.bot_name}.\n\n` +
        `The bot owner has been notified of your generosity!`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Process donation error:', error);
      await ctx.reply('❌ Error processing donation.');
    }
  };

  toggleDonationSystem = async (ctx, botId) => {
    try {
      const isOwner = await this.checkOwnerAccess(botId, ctx.from.id);
      if (!isOwner) {
        await ctx.reply('❌ Only bot owner can manage donation system.');
        return;
      }
      
      const subscriptionTier = await SubscriptionService.getSubscriptionTier(ctx.from.id);
      if (subscriptionTier !== 'premium') {
        await ctx.reply('❌ Premium subscription required to enable donation system.');
        return;
      }
      
      const bot = await Bot.findByPk(botId);
      const newStatus = !bot.has_donation_enabled;
      
      await bot.update({ has_donation_enabled: newStatus });
      
      const statusText = newStatus ? 'enabled' : 'disabled';
      const emoji = newStatus ? '✅' : '❌';
      
      const successMsg = await ctx.reply(`${emoji} Donation system ${statusText} for ${bot.bot_name}`);
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      await this.showSettings(ctx, botId);
      
    } catch (error) {
      console.error('Toggle donation system error:', error);
      await ctx.reply('❌ Error toggling donation system.');
    }
  };

  // 4. Transfer Bot Ownership with Security
  handleTransferOwnership = async (ctx, botId) => {
    try {
      const isOwner = await this.checkOwnerAccess(botId, ctx.from.id);
      if (!isOwner) {
        await ctx.reply('❌ Only bot owner can transfer ownership.');
        return;
      }
      
      this.transferOwnershipSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_new_owner'
      });
      
      await ctx.reply(
        `🔄 *Transfer Bot Ownership*\n\n` +
        `Please provide the Telegram User ID or Username of the new owner:\n\n` +
        `*Important:*\n` +
        `• The new owner must have started the main bot\n` +
        `• This action cannot be undone\n` +
        `• You will become a regular admin after transfer\n` +
        `• All bot data will be preserved\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Transfer ownership error:', error);
      await ctx.reply('❌ Error starting ownership transfer.');
    }
  };

  processTransferOwnership = async (ctx, botId, newOwnerInput) => {
    try {
      let newOwnerId;
      
      if (/^\d+$/.test(newOwnerInput)) {
        newOwnerId = parseInt(newOwnerInput);
      } else {
        const username = newOwnerInput.replace('@', '');
        const user = await User.findOne({ where: { username: username } });
        if (!user) {
          await ctx.reply(`❌ User @${username} not found. Ask them to start the main bot first.`);
          return;
        }
        newOwnerId = user.telegram_id;
      }
      
      // Check if new owner exists in our system
      const newOwner = await User.findOne({ where: { telegram_id: newOwnerId } });
      if (!newOwner) {
        await ctx.reply(`❌ User not found in our system. Ask them to start the main bot first.`);
        return;
      }
      
      // Check if transferring to self
      if (newOwnerId === ctx.from.id) {
        await ctx.reply('❌ You already own this bot.');
        return;
      }
      
      const bot = await Bot.findByPk(botId);
      
      // **CRITICAL SECURITY: Store original creator on first transfer**
      let originalCreatorId = bot.original_creator_id;
      if (!originalCreatorId) {
        originalCreatorId = bot.owner_id; // Current owner becomes original creator
      }
      
      // Update ownership history
      const ownershipHistory = bot.ownership_history || [];
      ownershipHistory.push({
        from_user_id: bot.owner_id,
        to_user_id: newOwnerId,
        transferred_at: new Date().toISOString(),
        transferred_by: ctx.from.id
      });
      
      // Transfer ownership with security measures
      const oldOwnerId = bot.owner_id;
      await bot.update({ 
        owner_id: newOwnerId,
        original_creator_id: originalCreatorId,
        ownership_transferred: true,
        ownership_history: ownershipHistory
      });
      
      // Add old owner as admin (but with restricted permissions)
      await Admin.findOrCreate({
        where: {
          bot_id: botId,
          admin_user_id: oldOwnerId
        },
        defaults: {
          admin_username: ctx.from.username,
          added_by: newOwnerId,
          permissions: {
            can_reply: true,
            can_broadcast: true,
            can_manage_admins: false,
            can_view_stats: true,
            can_deactivate: false,
            can_edit_bot: false,
            can_change_token: false // **CRITICAL: Prevent token changes**
          }
        }
      });
      
      // **CRITICAL: Stop and restart the bot to ensure new owner has control**
      await this.stopBot(botId);
      
      // Notify new owner
      const botInstance = this.getBotInstanceByDbId(botId);
      if (botInstance) {
        await botInstance.telegram.sendMessage(
          newOwnerId,
          `🎉 *You are now the owner of ${bot.bot_name}!*\n\n` +
          `*Previous owner:* ${ctx.from.first_name}${ctx.from.username ? ` (@${ctx.from.username})` : ''}\n` +
          `*Bot:* ${bot.bot_name} (@${bot.bot_username})\n\n` +
          `Please ask the person who have transferred you this bot, also must transfer you the actual bot from @BotFather\n\n` +
          `You now have full control over this bot. Use /dashboard to manage it.`,
          { parse_mode: 'Markdown' }
        );
      }
      
      // Restart the bot under new ownership
      await this.initializeBot(bot);
      
      await ctx.reply(
        `✅ *Ownership transferred successfully!*\n\n` +
        `*New owner:* ${newOwner.first_name}${newOwner.username ? ` (@${newOwner.username})` : ''}\n` +
        `*Bot:* ${bot.bot_name}\n\n` +
        `Please go to @BotFather and transfer the full ownership of the bot to the new owner.\n` +
        `You have been added as an admin with restricted permissions.`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Process transfer ownership error:', error);
      await ctx.reply('❌ Error transferring ownership.');
    }
  };

  // Security validation for token changes
  validateBotTokenChange = async (userId, botId) => {
    try {
      const bot = await Bot.findByPk(botId);
      
      // If ownership was transferred, only current owner can change token
      if (bot.ownership_transferred && bot.owner_id !== userId) {
        return {
          allowed: false,
          reason: 'Bot ownership has been transferred. Only the current owner can change the bot token.'
        };
      }
      
      return { allowed: true };
    } catch (error) {
      console.error('Token change validation error:', error);
      return { allowed: false, reason: 'Validation error' };
    }
  };

  // Premium access check utility
  checkPremiumAccess = async (ctx, featureName) => {
    try {
      const userId = ctx.from.id;
      const subscriptionTier = await SubscriptionService.getSubscriptionTier(userId);
      
      if (subscriptionTier !== 'premium') {
        const botRef = this.getBotReference();
        await ctx.reply(
          `🎫 *Premium Feature: ${featureName}*\n\n` +
          `This feature requires a premium subscription.\n\n` +
          `*Benefits of Premium:*\n` +
          `✅ Unlimited bots & broadcasts\n` +
          `✅ Advanced features like message pinning\n` +
          `✅ Donation system\n` +
          `✅ Ad-free experience\n\n` +
          `Upgrade now in our main bot:\n` +
          `@${botRef.username}`,
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url(`⭐ Upgrade @${botRef.username}`, `https://t.me/${botRef.username}`)],
              [Markup.button.callback('🔙 Back', 'mini_dashboard')]
            ])
          }
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Premium access check error:', error);
      await ctx.reply('❌ Error checking premium access.');
      return false;
    }
  };

  // Enhanced start handler with pinned messages
  handleStart = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const user = ctx.from;
      
      console.log(`🚀 Start command received for ${metaBotInfo.botName} from ${user.first_name} (ID: ${user.id})`);
      
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
      
      // Update bot user count
      await this.updateBotUserCount(metaBotInfo.mainBotId);
      
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      
      // Show pinned message if exists (for both new and existing users)
      const bot = await Bot.findByPk(metaBotInfo.mainBotId);
      if (bot.pinned_start_message) {
        await ctx.replyWithMarkdown(bot.pinned_start_message);
      }
      
      // Show ad to non-admin, non-premium users
      if (!isAdmin) {
        const userTier = await SubscriptionService.getSubscriptionTier(user.id);
        if (userTier !== 'premium') {
          await this.displayAdToUser(ctx, metaBotInfo.mainBotId);
        }
      }
      
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

  // Ad display system
  displayAdToUser = async (ctx, botId) => {
    try {
      // Simple ad implementation - can be enhanced with real ad system
      const showAd = Math.random() < 0.3; // 30% chance to show ad
      
      if (showAd) {
        const adMessage = `📢 *Sponsored Message*\n\n` +
          `*Upgrade to Premium for Ad-Free Experience!*\n\n` +
          `Tired of ads? Get premium and enjoy:\n` +
          `• Ad-free bot usage\n` +
          `• Unlimited bots & features\n` +
          `• Priority support\n\n` +
          `Visit @${this.mainBotUsername} to upgrade!`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.url(`⭐ Upgrade @${this.mainBotUsername}`, `https://t.me/${this.mainBotUsername}`)],
          [Markup.button.callback('👍 Got It', 'ad_dismiss')]
        ]);
        
        const sentMessage = await ctx.replyWithMarkdown(adMessage, keyboard);
        
        // Auto-remove ad after 30 seconds
        setTimeout(async () => {
          try {
            await ctx.deleteMessage(sentMessage.message_id);
          } catch (error) {
            // Message already deleted or not accessible
          }
        }, 30000);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Ad display error:', error);
      return false;
    }
  };

  // Update bot user count
  updateBotUserCount = async (botId) => {
    try {
      const userCount = await UserLog.count({
        where: { bot_id: botId }
      });
      
      await Bot.update(
        { user_count: userCount },
        { where: { id: botId } }
      );
      
      return userCount;
    } catch (error) {
      console.error('Update user count error:', error);
      return 0;
    }
  };

  // Enhanced settings with Botomics features - FIXED HORIZONTAL LAYOUT
  showSettings = async (ctx, botId) => {
    try {
      const bot = await Bot.findByPk(botId);
      const botRef = this.getBotReference(bot.bot_name);
      const currentWelcomeMessage = bot.welcome_message || `👋 Welcome to *${bot.bot_name}*!\n\nWe are here to assist you with any questions or concerns you may have.\n\nSimply send us a message, and we'll respond as quickly as possible!\n\n_This Bot is created by @${botRef.username}_`;
      
      // Get feature status
      const ChannelJoin = require('../models/ChannelJoin');
      const ReferralProgram = require('../models/ReferralProgram');
      const UserBan = require('../models/UserBan');
      
      const [channelCount, referralProgram, banCount] = await Promise.all([
        ChannelJoin.count({ where: { bot_id: botId, is_active: true } }),
        ReferralProgram.findOne({ where: { bot_id: botId } }),
        UserBan.count({ where: { bot_id: botId, is_active: true } })
      ]);
      
      const subscriptionTier = await SubscriptionService.getSubscriptionTier(bot.owner_id);
      const isPremium = subscriptionTier === 'premium';
      
      const settingsMessage = `⚙️ *Bot Settings - ${bot.bot_name}*\n\n` +
        `*Subscription Tier:* ${isPremium ? '🎉 PREMIUM' : '🆓 FREEMIUM'}\n\n` +
        `*Current Welcome Message:*\n` +
        `${currentWelcomeMessage.substring(0, 100)}${currentWelcomeMessage.length > 100 ? '...' : ''}\n\n` +
        `*Pinned Start Message:* ${bot.pinned_start_message ? '✅ Set' : '❌ Not set'}\n` +
        `*Donation System:* ${bot.has_donation_enabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
        `*Advanced Features Status:*\n` +
        `📢 Force Channels: ${channelCount > 0 ? '🟢 Active' : '🔴 Inactive'}\n` +
        `💰 Referral Program: ${referralProgram?.is_enabled ? '🟢 Active' : '🔴 Inactive'}\n` +
        `🚫 User Ban System: ${banCount > 0 ? '🟢 Active' : '🔴 Inactive'}\n\n` +
        `*Available Settings:*`;
      
      // FIXED: Horizontal layout with proper button arrangement
      const keyboardButtons = [];
      
      // Row 1: Core Settings
      keyboardButtons.push([
        Markup.button.callback('✏️ Welcome', 'settings_welcome'),
        Markup.button.callback('🔄 Reset', 'settings_reset_welcome')
      ]);
      
      // Row 2: Channel & Referral
      keyboardButtons.push([
        Markup.button.callback('📢 Channels', 'settings_channels'),
        Markup.button.callback('💰 Referral', 'settings_referral')
      ]);
      
      // Row 3: Management Features
      keyboardButtons.push([
        Markup.button.callback('🚫 Ban', `ban_management_${botId}`),
        Markup.button.callback('🔄 Transfer', `transfer_ownership_${botId}`)
      ]);
      
      // Row 4: Premium Features or Upgrade
      if (isPremium) {
        keyboardButtons.push([
          Markup.button.callback(bot.pinned_start_message ? '📌 Edit Pin' : '📌 Pin', 'settings_pin_message'),
          Markup.button.callback(bot.has_donation_enabled ? '❌ Donate' : '☕ Donate', 'settings_toggle_donations')
        ]);
      } else {
        keyboardButtons.push([
          Markup.button.callback('🎫 Upgrade Premium', 'subscribe_premium')
        ]);
      }
      
      // Row 5: Navigation
      keyboardButtons.push([
        Markup.button.callback('🔙 Dashboard', 'mini_dashboard')
      ]);
      
      const keyboard = Markup.inlineKeyboard(keyboardButtons);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(settingsMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(settingsMessage, keyboard);
      }
    } catch (error) {
      console.error('Show settings error:', error);
      await ctx.reply('❌ Error loading settings.');
    }
  };

  // Enhanced text message handler with Botomics sessions
  handleTextMessage = async (ctx) => {
    try {
      const user = ctx.from;
      const message = ctx.message.text;
      const { metaBotInfo } = ctx;
      
      // === WITHDRAWAL SESSION CHECK - AT THE VERY BEGINNING ===
      const ReferralHandler = require('../handlers/referralHandler');
      
      // Check if this is a withdrawal amount input
      if (ReferralHandler.hasActiveWithdrawalSession(user.id, metaBotInfo.mainBotId)) {
        console.log('🔔 Processing withdrawal amount input from user:', user.id);
        const processed = await ReferralHandler.processWithdrawalTextInput(ctx, metaBotInfo.mainBotId, message);
        if (processed) {
          console.log('✅ Withdrawal amount processed successfully');
          return;
        }
      }
      
      // Check if this is a referral settings input
      if (ReferralHandler.hasActiveReferralSession(user.id, metaBotInfo.mainBotId)) {
        console.log('🔔 Processing referral setting input from user:', user.id);
        const processed = await ReferralHandler.processReferralSettingChange(ctx, metaBotInfo.mainBotId, message);
        if (processed) {
          console.log('✅ Referral setting processed successfully');
          return;
        }
      }
      
      // === BOTOMICS SESSION CHECKS ===
      const pinSession = this.pinStartMessageSessions.get(user.id);
      if (pinSession && pinSession.step === 'awaiting_pin_message') {
        if (message === '/cancel') {
          this.pinStartMessageSessions.delete(user.id);
          await ctx.reply('❌ Pin message cancelled.');
          return;
        }
        await this.processPinStartMessage(ctx, pinSession.botId, message);
        this.pinStartMessageSessions.delete(user.id);
        return;
      }
      
      const transferSession = this.transferOwnershipSessions.get(user.id);
      if (transferSession && transferSession.step === 'awaiting_new_owner') {
        if (message === '/cancel') {
          this.transferOwnershipSessions.delete(user.id);
          await ctx.reply('❌ Ownership transfer cancelled.');
          return;
        }
        await this.processTransferOwnership(ctx, transferSession.botId, message);
        this.transferOwnershipSessions.delete(user.id);
        return;
      }
      
      const donationSession = this.donationSessions.get(user.id);
      if (donationSession && donationSession.step === 'awaiting_custom_amount') {
        if (message === '/cancel') {
          this.donationSessions.delete(user.id);
          await ctx.reply('❌ Donation cancelled.');
          return;
        }
        
        const amount = parseFloat(message);
        if (isNaN(amount) || amount <= 0) {
          await ctx.reply('❌ Please enter a valid amount in BOM:');
          return;
        }
        
        await this.processDonation(ctx, donationSession.botId, amount);
        this.donationSessions.delete(user.id);
        return;
      }
      
      // Check referral sessions
      const referralSession = this.referralSessions.get(user.id);
      if (referralSession) {
        if (message === '/cancel') {
          this.referralSessions.delete(user.id);
          await ctx.reply('❌ Referral settings change cancelled.');
          return;
        }
        await ReferralHandler.processReferralSettingChange(ctx, referralSession.botId, message);
        this.referralSessions.delete(user.id);
        return;
      }
      
      // Check currency sessions
      const currencySession = this.currencySessions.get(user.id);
      if (currencySession) {
        if (message === '/cancel') {
          this.currencySessions.delete(user.id);
          await ctx.reply('❌ Currency setting cancelled.');
          return;
        }
        await ReferralHandler.processCurrencySetting(ctx, currencySession.botId, message);
        this.currencySessions.delete(user.id);
        return;
      }
        
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

  // Existing methods continue below (they remain unchanged)
  showAdminDashboard = async (ctx, metaBotInfo) => {
    try {
      const stats = await this.getQuickStats(metaBotInfo.mainBotId);
      const botRef = this.getBotReference(metaBotInfo.botName);
      
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
        [Markup.button.url('🚀 Create More Bots', `https://t.me/${botRef.username}`)]
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
  
  // UPDATED: Use environment-specific bot references
  getWelcomeMessage = async (botId) => {
    try {
      const bot = await Bot.findByPk(botId);
      let welcomeMessage = bot?.welcome_message;
      
      const botRef = this.getBotReference();
      
      // If no custom message, use the current default format with environment-specific bot
      if (!welcomeMessage) {
        return `👋 Welcome to *{botName}*!\n\n` +
          `We are here to assist you with any questions or concerns you may have.\n\n` +
          `Simply send us a message, and we'll respond as quickly as possible!\n\n` +
          `_This Bot is created by @${botRef.username}_`;
      }
      
      // For custom messages, append the creator credit if it's not already there
      const creatorCredit = `_This Bot is created by @${botRef.username}_`;
      if (!welcomeMessage.includes(botRef.username) && !welcomeMessage.includes('BotomicsBot')) {
        welcomeMessage += `\n\n${creatorCredit}`;
      }
      
      return welcomeMessage;
    } catch (error) {
      console.error('Error getting welcome message:', error);
      const botRef = this.getBotReference();
      return `👋 Welcome to *{botName}*!\n\n` +
        `We are here to assist you with any questions or concerns you may have.\n\n` +
        `Simply send us a message, and we'll respond as quickly as possible!\n\n` +
        `_This Bot is created by @${botRef.username}_`;
    }
  };
  
  showUserWelcome = async (ctx, metaBotInfo) => {
  try {
    let welcomeMessage = await this.getWelcomeMessage(metaBotInfo.mainBotId);
    
    welcomeMessage = welcomeMessage.replace(/{botName}/g, metaBotInfo.botName);
    
    await ctx.replyWithMarkdown(welcomeMessage);
  } catch (error) {
    console.error('User welcome error:', error);
    const botRef = this.getBotReference(metaBotInfo.botName);
    await ctx.replyWithMarkdown(`👋 Welcome to *${metaBotInfo.botName}*!\n\nWe are here to assist you with any questions or concerns you may have.\n\nSimply send us a message, and we'll respond as quickly as possible!\n\n_This Bot is created by @${botRef.username}_`);
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

  // Updated settings to include new features
  showSettings = async (ctx, botId) => {
    try {
      const bot = await Bot.findByPk(botId);
      const botRef = this.getBotReference(bot.bot_name);
      const currentWelcomeMessage = bot.welcome_message || `👋 Welcome to *${bot.bot_name}*!\n\nWe are here to assist you with any questions or concerns you may have.\n\nSimply send us a message, and we'll respond as quickly as possible!\n\n_This Bot is created by @${botRef.username}_`;
      
      // Get feature status
      const ChannelJoin = require('../models/ChannelJoin');
      const ReferralProgram = require('../models/ReferralProgram');
      const UserBan = require('../models/UserBan');
      
      const [channelCount, referralProgram, banCount] = await Promise.all([
        ChannelJoin.count({ where: { bot_id: botId, is_active: true } }),
        ReferralProgram.findOne({ where: { bot_id: botId } }),
        UserBan.count({ where: { bot_id: botId, is_active: true } })
      ]);
      
      const subscriptionTier = await SubscriptionService.getSubscriptionTier(bot.owner_id);
      const isPremium = subscriptionTier === 'premium';
      
      const settingsMessage = `⚙️ *Bot Settings - ${bot.bot_name}*\n\n` +
        `*Subscription Tier:* ${isPremium ? '🎉 PREMIUM' : '🆓 FREEMIUM'}\n\n` +
        `*Current Welcome Message:*\n` +
        `${currentWelcomeMessage.substring(0, 100)}${currentWelcomeMessage.length > 100 ? '...' : ''}\n\n` +
        `*Pinned Start Message:* ${bot.pinned_start_message ? '✅ Set' : '❌ Not set'}\n` +
        `*Donation System:* ${bot.has_donation_enabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
        `*Advanced Features Status:*\n` +
        `📢 Force Channels: ${channelCount > 0 ? '🟢 Active' : '🔴 Inactive'}\n` +
        `💰 Referral Program: ${referralProgram?.is_enabled ? '🟢 Active' : '🔴 Inactive'}\n` +
        `🚫 User Ban System: ${banCount > 0 ? '🟢 Active' : '🔴 Inactive'}\n\n` +
        `*Available Settings:*`;
      
      const keyboardButtons = [
        [Markup.button.callback('✏️ Change Welcome Message', 'settings_welcome')],
        [Markup.button.callback('🔄 Reset Welcome Message', 'settings_reset_welcome')]
      ];
      
      // Premium features
      if (isPremium) {
        keyboardButtons.push(
          [Markup.button.callback(bot.pinned_start_message ? '📌 Edit Pinned Message' : '📌 Pin Start Message', 'settings_pin_message')],
          [Markup.button.callback(bot.pinned_start_message ? '❌ Unpin Message' : '📌 Pin Start Message', 'settings_unpin_message')],
          [Markup.button.callback(bot.has_donation_enabled ? '❌ Disable Donations' : '☕ Enable Donations', 'settings_toggle_donations')]
        );
      } else {
        keyboardButtons.push(
          [Markup.button.callback('🎫 Upgrade for More Features', 'subscribe_premium')]
        );
      }
      
      // Always available features
      keyboardButtons.push(
        [Markup.button.callback('📢 Channel Join Settings', 'settings_channels')],
        [Markup.button.callback('💰 Referral Program', 'settings_referral')],
        [Markup.button.callback('🚫 Ban Management', `ban_management_${botId}`)],
        [Markup.button.callback('🔄 Transfer Ownership', `transfer_ownership_${botId}`)],
        [Markup.button.callback('🔙 Dashboard', 'mini_dashboard')]
      );
      
      const keyboard = Markup.inlineKeyboard(keyboardButtons);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(settingsMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(settingsMessage, keyboard);
      }
    } catch (error) {
      console.error('Show settings error:', error);
      await ctx.reply('❌ Error loading settings.');
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
        // NEW SETTINGS
        case 'channels':
          const ChannelJoinHandler = require('../handlers/channelJoinHandler');
          await ChannelJoinHandler.showChannelManagement(ctx, metaBotInfo.mainBotId);
          break;
        case 'referral':
          const ReferralHandler = require('../handlers/referralHandler');
          await ReferralHandler.showReferralManagement(ctx, metaBotInfo.mainBotId);
          break;
        case 'ban_management':
          const BanHandler = require('../handlers/banHandler');
          await BanHandler.showBanManagement(ctx, metaBotInfo.mainBotId);
          break;
        default:
          await ctx.reply('⚠️ Action not available');
      }
    } catch (error) {
      console.error('Settings action error:', error);
      await ctx.reply('❌ Error processing settings action');
    }
  };
  
  // UPDATED: Show the current default format in the change message prompt with environment-specific bot
  startChangeWelcomeMessage = async (ctx, botId) => {
    try {
      this.welcomeMessageSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_welcome_message'
      });
      
      const bot = await Bot.findByPk(botId);
      const botRef = this.getBotReference();
      const currentMessage = bot.welcome_message || `👋 Welcome to *${bot.bot_name}*!\n\nWe are here to assist you with any questions or concerns you may have.\n\nSimply send us a message, and we'll respond as quickly as possible!\n\n_This Bot is created by @${botRef.username}_`;
      
      await ctx.reply(
        `✏️ *Change Welcome Message*\n\n` +
        `*Current Message:*\n${currentMessage}\n\n` +
        `Please send the new welcome message:\n\n` +
        `*Tips:*\n` +
        `• Use {botName} as placeholder for bot name\n` +
        `• Markdown formatting is supported\n` +
        `• Keep it welcoming and informative\n` +
        `• Creator credit will be automatically added\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
      
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
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      await this.showSettings(ctx, botId);
      
    } catch (error) {
      console.error('Reset welcome message error:', error);
      await ctx.reply('❌ Error resetting welcome message.');
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
    
    const botRef = this.getBotReference();
    
    let helpMessage;
    
    if (isAdmin) {
      helpMessage = `🤖 *Admin Help & Support*\n\n` +
        `*Available Commands:*\n` +
        `/dashboard - 📊 Admin dashboard with quick stats\n` +
        `/broadcast - 📢 Send message to all users\n` +
        `/stats - 📈 View bot statistics\n` +
        `/admins - 👥 Manage admin team (owners only)\n` +
        `/settings - ⚙️ Bot settings (owners only)\n` +
        `/help - ❓ This help message\n` +
        `/referral - 💰 Referral program\n` +
        `/ban - 🚫 Ban user by username or ID\n` +
        `/unban - ✅ Unban user by username or ID\n` +
        `*Quick Tips:*\n` +
        `• Click notification buttons to reply instantly\n` +
        `• Use broadcast for important announcements\n` +
        `• Add co-admins to help manage messages\n` +
        `• You can send images, videos, and files as admin\n` +
        `*Need help?* Contact @${botRef.supportBot}`;
    } else {
      helpMessage = `🤖 *Help & Support*\n\n` +
        `*How to use this bot:*\n` +
        `• Send any message to contact our team\n` +
        `• Send images, videos, files, or voice messages\n` +
        `• Edit your messages using /edit command\n` +
        `• We'll respond as quickly as possible\n` +
        `• You'll get notifications when we reply\n\n` +
        `*Available Commands:*\n` +
        `/start - 🚀 Start the bot\n` +
        `/help - ❓ Get help\n` +
        `/referral - 💰 Referral program\n\n` +
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
      
      // === WITHDRAWAL SESSION CHECK - AT THE VERY BEGINNING ===
      // Dynamic import to avoid circular dependencies
      const ReferralHandler = require('../handlers/referralHandler');
      
      // Check if this is a withdrawal amount input
      if (ReferralHandler.hasActiveWithdrawalSession(user.id, metaBotInfo.mainBotId)) {
        console.log('🔔 Processing withdrawal amount input from user:', user.id);
        const processed = await ReferralHandler.processWithdrawalTextInput(ctx, metaBotInfo.mainBotId, message);
        if (processed) {
          console.log('✅ Withdrawal amount processed successfully');
          return; // Stop further processing - IMPORTANT!
        }
      }
      
      // Check if this is a referral settings input
      if (ReferralHandler.hasActiveReferralSession(user.id, metaBotInfo.mainBotId)) {
        console.log('🔔 Processing referral setting input from user:', user.id);
        const processed = await ReferralHandler.processReferralSettingChange(ctx, metaBotInfo.mainBotId, message);
        if (processed) {
          console.log('✅ Referral setting processed successfully');
          return; // Stop further processing - IMPORTANT!
        }
      }
      // === END OF WITHDRAWAL SESSION CHECK ===
      
      // === NEW SESSION CHECKS ===
      
      const pinSession = this.pinStartMessageSessions.get(user.id);
      if (pinSession && pinSession.step === 'awaiting_pin_message') {
        if (message === '/cancel') {
          this.pinStartMessageSessions.delete(user.id);
          await ctx.reply('❌ Pin message cancelled.');
          return;
        }
        await this.processPinStartMessage(ctx, pinSession.botId, message);
        this.pinStartMessageSessions.delete(user.id);
        return;
      }
      
      const transferSession = this.transferOwnershipSessions.get(user.id);
      if (transferSession && transferSession.step === 'awaiting_new_owner') {
        if (message === '/cancel') {
          this.transferOwnershipSessions.delete(user.id);
          await ctx.reply('❌ Ownership transfer cancelled.');
          return;
        }
        await this.processTransferOwnership(ctx, transferSession.botId, message);
        this.transferOwnershipSessions.delete(user.id);
        return;
      }
      
      const donationSession = this.donationSessions.get(user.id);
      if (donationSession && donationSession.step === 'awaiting_custom_amount') {
        if (message === '/cancel') {
          this.donationSessions.delete(user.id);
          await ctx.reply('❌ Donation cancelled.');
          return;
        }
        
        const amount = parseFloat(message);
        if (isNaN(amount) || amount <= 0) {
          await ctx.reply('❌ Please enter a valid amount in BOM:');
          return;
        }
        
        await this.processDonation(ctx, donationSession.botId, amount);
        this.donationSessions.delete(user.id);
        return;
      }
      
      // Check referral sessions FIRST
      const referralSession = this.referralSessions.get(user.id);
      if (referralSession) {
        if (message === '/cancel') {
          this.referralSessions.delete(user.id);
          await ctx.reply('❌ Referral settings change cancelled.');
          return;
        }
        await ReferralHandler.processReferralSettingChange(ctx, referralSession.botId, message);
        this.referralSessions.delete(user.id);
        return;
      }
      
      // Check currency sessions
      const currencySession = this.currencySessions.get(user.id);
      if (currencySession) {
        if (message === '/cancel') {
          this.currencySessions.delete(user.id);
          await ctx.reply('❌ Currency setting cancelled.');
          return;
        }
        await ReferralHandler.processCurrencySetting(ctx, currencySession.botId, message);
        this.currencySessions.delete(user.id);
        return;
      }
        
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
    
    // Add session management methods for referral and currency
    startReferralSettingSession = async (ctx, botId, settingType) => {
      try {
        this.referralSessions.set(ctx.from.id, {
          botId: botId,
          settingType: settingType,
          step: 'awaiting_referral_setting'
        });
        
        let promptMessage = '';
        switch (settingType) {
          case 'rate':
            promptMessage = '💰 *Set Referral Rate*\n\nPlease enter the new referral rate (percentage):\n\n*Example:* 10 for 10%\n\n*Cancel:* Type /cancel';
            break;
          case 'min_withdrawal':
            promptMessage = '💰 *Set Minimum Withdrawal*\n\nPlease enter the new minimum withdrawal amount:\n\n*Example:* 100\n\n*Cancel:* Type /cancel';
            break;
          default:
            promptMessage = '💰 *Change Referral Setting*\n\nPlease enter the new value:\n\n*Cancel:* Type /cancel';
        }
        
        await ctx.reply(promptMessage, { parse_mode: 'Markdown' });
        
      } catch (error) {
        console.error('Start referral setting session error:', error);
        await ctx.reply('❌ Error starting referral setting session.');
      }
    };
    
    startCurrencySettingSession = async (ctx, botId) => {
      try {
        this.currencySessions.set(ctx.from.id, {
          botId: botId,
          step: 'awaiting_currency_input'
        });
        
        await ctx.reply(
          '💰 *Set Custom Currency*\n\n' +
          'Please enter your custom currency code (3-5 characters):\n\n' +
          '*Examples:* USD, EUR, BTC, ETH, COIN\n\n' +
          '*Cancel:* Type /cancel',
          { parse_mode: 'Markdown' }
        );
        
      } catch (error) {
        console.error('Start currency setting session error:', error);
        await ctx.reply('❌ Error starting currency setting session.');
      }
    };

    processWelcomeMessageChange = async (ctx, botId, newMessage) => {
      try {
        const bot = await Bot.findByPk(botId);
        await bot.update({ welcome_message: newMessage });
        
        const successMsg = await ctx.reply('✅ Welcome message updated successfully!');
        await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
        
        await this.showSettings(ctx, botId);
        
      } catch (error) {
        console.error('Process welcome message change error:', error);
        await ctx.reply('❌ Error updating welcome message.');
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
        
        // FIXED: Enhanced message delivery to admins
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
          case 'settings':
            const isOwnerForSettings = await this.checkOwnerAccess(metaBotInfo.mainBotId, user.id);
            if (isOwnerForSettings) {
              await this.showSettings(ctx, metaBotInfo.mainBotId);
            } else {
              await ctx.reply('❌ Only bot owner can change settings.');
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
        
        await ctx.reply(
          `💬 *Replying to ${feedback.user_first_name}*\n\n` +
          `Please type your reply message:\n\n` +
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
        
        const escapeMarkdown = (text) => {
          return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
        };
        
        const safeMessage = escapeMarkdown(message);
        
        for (let i = 0; i < users.length; i++) {
          const user = users[i];
          try {
            await botInstance.telegram.sendMessage(user.user_id, safeMessage, {
              parse_mode: 'MarkdownV2'
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
            
            if (error.message.includes('parse entities')) {
              try {
                await botInstance.telegram.sendMessage(user.user_id, message, {
                  parse_mode: 'HTML'
                });
                successCount++;
                failCount--;
                console.log(`✅ Successfully sent to user ${user.user_id} using HTML format`);
              } catch (htmlError) {
                console.error(`HTML format also failed for user ${user.user_id}:`, htmlError.message);
                
                try {
                  await botInstance.telegram.sendMessage(user.user_id, message);
                  successCount++;
                  failCount--;
                  console.log(`✅ Successfully sent to user ${user.user_id} as plain text`);
                } catch (plainError) {
                  console.error(`Plain text also failed for user ${user.user_id}:`, plainError.message);
                }
              }
            }
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
        where: { bot_id: botId }, // ✅ Use bot_id
        include: [{ model: User, as: 'AdminUser' }] // ✅ Use correct alias
      });

      const bot = await Bot.findByPk(botId);

      let message = `👥 *Admin Management*\n\n` +
        `*Total Admins:* ${admins.length}\n\n` +
        `*Current Admins:*\n`;
      
      admins.forEach((admin, index) => {
        // ✅ Use AdminUser instead of User
        const userInfo = admin.AdminUser ? 
          `@${admin.AdminUser.username} (${admin.AdminUser.first_name})` : 
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
            await ctx.reply(`❌ User @${username} not found. Ask them to start @${this.mainBotUsername} first.`);
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
          await ctx.reply(`❌ User not found. Ask them to start @${this.mainBotUsername} first.`);
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
        const botRef = this.getBotReference();
        const aboutMessage = `ℹ️ *About ${metaBotInfo.botName}*\n\n` +
          `*Bot Username:* @${metaBotInfo.botUsername}\n` +
          `*Created via:* @${botRef.username}\n` +
          `*Create your own bot:* @${botRef.username}`;
        
        await ctx.replyWithMarkdown(aboutMessage);
      } catch (error) {
        console.error('About error:', error);
        await ctx.reply(`About ${metaBotInfo.botName}`);
      }
    };
    
    // FIXED: Enhanced notifyAdminsRealTime method for better message delivery
    notifyAdminsRealTime = async (botId, feedback, user, messageType = 'text', originalMessage = null) => {
    try {
      console.log(`🔔 Sending real-time notification for bot ID: ${botId}, type: ${messageType}`);
      
      // ✅ FIXED: Use the botId parameter instead of this.bot.id
      const admins = await Admin.findAll({
        where: { bot_id: botId }, // ✅ Use bot_id and the parameter
        include: [{
          model: User,
          as: 'AdminUser' // ✅ Use the correct alias from your model
        }]
      });
      
      const bot = await Bot.findByPk(botId);
      
      const botInstance = this.getBotInstanceByDbId(botId);
      
      if (!botInstance) {
        console.error('❌ Bot instance not found for real-time notification');
        this.debugActiveBots();
        return;
      }
      
      console.log(`✅ Bot instance found for notifications: ${bot.bot_name}`);
      
      const mediaEmoji = this.getMediaTypeEmoji(messageType);
      const mediaTypeText = messageType === 'text' ? 'Message' : messageType.charAt(0).toUpperCase() + messageType.slice(1);
      
      // Enhanced notification for all admins including owner
      const allAdmins = [...admins];
      
      // Ensure owner is included if not already in admins list
      const ownerIsAdmin = admins.find(admin => admin.admin_user_id === bot.owner_id);
      if (!ownerIsAdmin) {
        const owner = await User.findOne({ where: { telegram_id: bot.owner_id } });
        if (owner) {
          allAdmins.push({ AdminUser: owner }); // ✅ Use AdminUser alias
        }
      }
      
      let notificationSent = false;
      
      for (const admin of allAdmins) {
        if (admin.AdminUser) { // ✅ Use AdminUser instead of User
          try {
            let notificationMessage;
            
            if (messageType === 'image' && originalMessage && originalMessage.photo) {
              const photo = originalMessage.photo[originalMessage.photo.length - 1];
              await botInstance.telegram.sendPhoto(
                admin.AdminUser.telegram_id, // ✅ Use AdminUser
                photo.file_id,
                {
                  caption: `🔔 *New Image from ${user.first_name}${user.username ? ` (@${user.username})` : ''}*\n\n` +
                           `💬 ${originalMessage.caption || '[No caption]'}`,
                  parse_mode: 'Markdown',
                  ...Markup.inlineKeyboard([
                    [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
                  ])
                }
              );
              notificationSent = true;
              
            } else if (messageType === 'video' && originalMessage && originalMessage.video) {
              await botInstance.telegram.sendVideo(
                admin.AdminUser.telegram_id, // ✅ Use AdminUser
                originalMessage.video.file_id,
                {
                  caption: `🔔 *New Video from ${user.first_name}${user.username ? ` (@${user.username})` : ''}*\n\n` +
                           `💬 ${originalMessage.caption || '[No caption]'}`,
                  parse_mode: 'Markdown',
                  ...Markup.inlineKeyboard([
                    [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
                  ])
                }
              );
              notificationSent = true;
              
            } else {
              // Text message or fallback
              notificationMessage = `🔔 *New ${mediaTypeText} Received*\n\n` +
                `*From:* ${user.first_name}${user.username ? ` (@${user.username})` : ''}\n`;
              
              if (messageType === 'text') {
                notificationMessage += `*Message:* ${feedback.message}`;
              } else {
                notificationMessage += `*Caption:* ${feedback.media_caption || '[No caption]'}\n` +
                  `*Type:* ${messageType}`;
              }
              
              await botInstance.telegram.sendMessage(admin.AdminUser.telegram_id, notificationMessage, { // ✅ Use AdminUser
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                  [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)]
                ])
              });
              notificationSent = true;
            }
            
            console.log(`🔔 Notification sent to admin: ${admin.AdminUser.username || admin.AdminUser.telegram_id}`);
            
          } catch (error) {
            console.error(`Failed to notify admin ${admin.AdminUser.username || admin.AdminUser.telegram_id}:`, error.message);
          }
        }
      }
      
      if (notificationSent) {
        console.log(`✅ Real-time notifications sent successfully for ${bot.bot_name}`);
      } else {
        console.error(`❌ No notifications were sent for ${bot.bot_name}`);
      }
      
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
    console.log(`🌍 Environment: ${this.isDevelopment ? 'DEVELOPMENT 🚧' : 'PRODUCTION 🚀'}`);
    console.log(`🤖 Main Bot: @${this.mainBotUsername}`);
    
    this.debugActiveBots();
    
    return {
      isHealthy: this.isInitialized && !this.initializationPromise,
      activeBots: this.activeBots.size,
      status: this.isInitialized ? 'READY' : 'INITIALIZING',
      environment: this.isDevelopment ? 'development' : 'production',
      mainBot: this.mainBotUsername
    };
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
    console.log(`🌍 Environment: ${this.isDevelopment ? 'DEVELOPMENT 🚧' : 'PRODUCTION 🚀'}`);
    
    if (this.activeBots.size === 0) {
      console.log('❌ No active bots found in memory!');
    } else {
      for (const [dbId, botData] of this.activeBots.entries()) {
        console.log(`🤖 Bot: ${botData.record.bot_name} | DB ID: ${dbId} | Status: ${botData.status} | Environment: ${botData.environment} | Launched: ${botData.launchedAt.toISOString()}`);
      }
    }
  };

  async forceReinitializeAllBots() {
    console.log('🔄 FORCE: Reinitializing all mini-bots...');
    this.isInitialized = false;
    return await this.initializeAllBots();
  }

  getInitializationStatus() {
    return {
      isInitialized: this.isInitialized,
      activeBots: this.activeBots.size,
      status: this.isInitialized ? 'READY' : 'INITIALIZING',
      environment: this.isDevelopment ? 'development' : 'production',
      mainBot: this.mainBotUsername
    };
  }

  // EXISTING MEDIA HANDLERS - KEEP INTACT
  handleImageMessage = async (ctx) => {
    try {
      const user = ctx.from;
      const { metaBotInfo } = ctx;
      
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
      if (isAdmin) {
        await this.handleAdminMediaMessage(ctx, metaBotInfo, user, 'image');
        return;
      }
      
      await this.handleUserImageMessage(ctx, metaBotInfo, user);
      
    } catch (error) {
      console.error('Image message handler error:', error);
      await ctx.reply('❌ An error occurred while processing your image. Please try again.');
    }
  };

    handleVideoMessage = async (ctx) => {
      try {
        const user = ctx.from;
        const { metaBotInfo } = ctx;
        
        const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
        if (isAdmin) {
          // Admin is sending media - forward it to all users
          await this.handleAdminMediaMessage(ctx, metaBotInfo, user, 'video');
          return;
        }
        
        await this.handleUserVideoMessage(ctx, metaBotInfo, user);
        
      } catch (error) {
        console.error('Video message handler error:', error);
        await ctx.reply('❌ An error occurred while processing your video. Please try again.');
      }
    };

    handleDocumentMessage = async (ctx) => {
      try {
        const user = ctx.from;
        const { metaBotInfo } = ctx;
        
        const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
        if (isAdmin) {
          // Admin is sending media - forward it to all users
          await this.handleAdminMediaMessage(ctx, metaBotInfo, user, 'document');
          return;
        }
        
        await this.handleUserDocumentMessage(ctx, metaBotInfo, user);
        
      } catch (error) {
        console.error('Document message handler error:', error);
        await ctx.reply('❌ An error occurred while processing your file. Please try again.');
      }
    };

    handleAudioMessage = async (ctx) => {
      try {
        const user = ctx.from;
        const { metaBotInfo } = ctx;
        
        const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
        if (isAdmin) {
          // Admin is sending media - forward it to all users
          await this.handleAdminMediaMessage(ctx, metaBotInfo, user, 'audio');
          return;
        }
        
        await this.handleUserAudioMessage(ctx, metaBotInfo, user);
        
      } catch (error) {
        console.error('Audio message handler error:', error);
        await ctx.reply('❌ An error occurred while processing your audio. Please try again.');
      }
    };

    handleVoiceMessage = async (ctx) => {
      try {
        const user = ctx.from;
        const { metaBotInfo } = ctx;
        
        const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, user.id);
        if (isAdmin) {
          // Admin is sending media - forward it to all users
          await this.handleAdminMediaMessage(ctx, metaBotInfo, user, 'voice');
          return;
        }
        
        await this.handleUserVoiceMessage(ctx, metaBotInfo, user);
        
      } catch (error) {
        console.error('Voice message handler error:', error);
        await ctx.reply('❌ An error occurred while processing your voice message. Please try again.');
      }
    };

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

    handleAdminMediaMessage = async (ctx, metaBotInfo, user, mediaType) => {
      try {
        // Check if admin is in a reply session (replying to a specific user)
        const replySession = this.replySessions.get(user.id);
        
        if (replySession && replySession.step === 'awaiting_reply') {
          // Admin is replying to a specific user with media
          await this.sendMediaReply(ctx, replySession.userId, replySession.feedbackId, mediaType);
          this.replySessions.delete(user.id);
          return;
        }
        
        // If no reply session, show admin dashboard (don't broadcast media)
        await this.showAdminDashboard(ctx, metaBotInfo);
        const warningMsg = await ctx.reply('⚠️ Use the "Reply Now" buttons to send media to specific users.');
        await this.deleteAfterDelay(ctx, warningMsg.message_id, 5000);
        
      } catch (error) {
        console.error('Admin media message handler error:', error);
        await ctx.reply('❌ An error occurred while processing your media. Please try again.');
      }
    };

    sendMediaReply = async (ctx, targetUserId, feedbackId, mediaType) => {
      try {
        console.log(`💬 Admin sending ${mediaType} reply to user ${targetUserId}`);
        
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

        // Send the media to the specific user
        try {
          if (mediaType === 'image' && ctx.message.photo) {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            await botInstance.telegram.sendPhoto(
              targetUserId,
              photo.file_id,
              {
                caption: ctx.message.caption || '',
                parse_mode: 'Markdown'
              }
            );
          } else if (mediaType === 'video' && ctx.message.video) {
            await botInstance.telegram.sendVideo(
              targetUserId,
              ctx.message.video.file_id,
              {
                caption: ctx.message.caption || '',
                parse_mode: 'Markdown'
              }
            );
          } else if (mediaType === 'document' && ctx.message.document) {
            await botInstance.telegram.sendDocument(
              targetUserId,
              ctx.message.document.file_id,
              {
                caption: ctx.message.caption || '',
                parse_mode: 'Markdown'
              }
            );
          } else if (mediaType === 'audio' && ctx.message.audio) {
            await botInstance.telegram.sendAudio(
              targetUserId,
              ctx.message.audio.file_id,
              {
                caption: ctx.message.caption || '',
                parse_mode: 'Markdown'
              }
            );
          } else if (mediaType === 'voice' && ctx.message.voice) {
            await botInstance.telegram.sendVoice(
              targetUserId,
              ctx.message.voice.file_id,
              {
                caption: ctx.message.caption || '',
                parse_mode: 'Markdown'
              }
            );
          }

          // Update feedback as replied
          await feedback.update({
            is_replied: true,
            reply_message: `[${mediaType} reply] ${ctx.message.caption || ''}`.trim(),
            replied_by: ctx.from.id,
            replied_at: new Date()
          });

          const successMsg = await ctx.reply(`✅ Your ${mediaType} reply has been sent!`);
          await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
          
          console.log(`✅ Admin sent ${mediaType} reply to user ${targetUserId}`);
          
        } catch (error) {
          console.error(`❌ Failed to send ${mediaType} reply to user ${targetUserId}:`, error.message);
          await ctx.reply('❌ Failed to send reply. User might have blocked the bot.');
        }
        
      } catch (error) {
        console.error('Send media reply error:', error);
        await ctx.reply('❌ Error sending media reply.');
      }
    };

    handleUserAudioMessage = async (ctx, metaBotInfo, user) => {
      try {
        await UserLog.upsert({
          bot_id: metaBotInfo.mainBotId,
          user_id: user.id,
          user_username: user.username,
          user_first_name: user.first_name,
          last_interaction: new Date()
        });
        
        const audio = ctx.message.audio;
        const caption = ctx.message.caption || '';
        
        const feedback = await Feedback.create({
          bot_id: metaBotInfo.mainBotId,
          user_id: user.id,
          user_username: user.username,
          user_first_name: user.first_name,
          message: caption || `[Audio: ${audio.title || 'Audio file'}]`,
          message_id: ctx.message.message_id,
          message_type: 'audio',
          media_file_id: audio.file_id,
          media_caption: caption
        });
        
        await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'audio', ctx.message);
        
        const successMsg = await ctx.reply('✅ Your audio has been received.');
        await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
        
        console.log(`🎵 New audio from ${user.first_name} to ${metaBotInfo.botName}`);
        
      } catch (error) {
        console.error('User audio message handler error:', error);
        await ctx.reply('❌ Sorry, there was an error sending your audio. Please try again.');
      }
    };

    handleUserVoiceMessage = async (ctx, metaBotInfo, user) => {
      try {
        await UserLog.upsert({
          bot_id: metaBotInfo.mainBotId,
          user_id: user.id,
          user_username: user.username,
          user_first_name: user.first_name,
          last_interaction: new Date()
        });
        
        const voice = ctx.message.voice;
        
        const feedback = await Feedback.create({
          bot_id: metaBotInfo.mainBotId,
          user_id: user.id,
          user_username: user.username,
          user_first_name: user.first_name,
          message: '[Voice message]',
          message_id: ctx.message.message_id,
          message_type: 'voice',
          media_file_id: voice.file_id,
          media_caption: ''
        });
        
        await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'voice', ctx.message);
        
        const successMsg = await ctx.reply('✅ Your voice message has been received.');
        await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
        
        console.log(`🎤 New voice message from ${user.first_name} to ${metaBotInfo.botName}`);
        
      } catch (error) {
        console.error('User voice message handler error:', error);
        await ctx.reply('❌ Sorry, there was an error sending your voice message. Please try again.');
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
        await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
        
        console.log(`📸 New image from ${user.first_name} to ${metaBotInfo.botName}`);
        
      } catch (error) {
        console.error('User image message handler error:', error);
        await ctx.reply('❌ Sorry, there was an error sending your image. Please try again.');
      }
    };

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
        
        await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'video', ctx.message);
        
        const successMsg = await ctx.reply('✅ Your video has been received.');
        await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
        
        console.log(`🎥 New video from ${user.first_name} to ${metaBotInfo.botName}`);
        
      } catch (error) {
        console.error('User video message handler error:', error);
        await ctx.reply('❌ Sorry, there was an error sending your video. Please try again.');
      }
    };

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
        
        await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'document', ctx.message);
        
        const successMsg = await ctx.reply('✅ Your file has been received.');
        await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
        
        console.log(`📎 New document from ${user.first_name} to ${metaBotInfo.botName}`);
        
      } catch (error) {
        console.error('User document message handler error:', error);
        await ctx.reply('❌ Sorry, there was an error sending your file. Please try again.');
      }
    };

    handleUserMediaGroupMessage = async (ctx, metaBotInfo, user) => {
      try {
        await UserLog.upsert({
          bot_id: metaBotInfo.mainBotId,
          user_id: user.id,
          user_username: user.username,
          user_first_name: user.first_name,
          last_interaction: new Date()
        });
        
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
        
        await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user, 'media_group', ctx.message);
        
        const successMsg = await ctx.reply('✅ Your media album has been received.');
        await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
        
        console.log(`🖼️ New media album from ${user.first_name} to ${metaBotInfo.botName}`);
        
      } catch (error) {
        console.error('User media group handler error:', error);
        await ctx.reply('❌ Sorry, there was an error sending your media. Please try again.');
      }
    };
}

module.exports = new MiniBotManager();