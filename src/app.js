// src/app.js - COMPLETE VERSION WITH FIXES
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
  console.log('🔧 Development mode - Loading .env file');
} else {
  console.log('🚀 Production mode - Using cPanel environment variables');
}

const isCpanel = process.env.HOME && process.env.HOME.includes('/home/');
if (isCpanel) {
  console.log('✅ Running on Yegara.com cPanel');
  process.env.NODE_ENV = 'production';
}

const { Telegraf, Markup } = require('telegraf');
const config = require('../config/environment');
const { connectDB } = require('../database/db');
const MiniBotManager = require('./services/MiniBotManager');

const { startHandler, helpHandler, featuresHandler } = require('./handlers/startHandler');
const { createBotHandler, handleTokenInput, handleNameInput, cancelCreationHandler, isInCreationSession, getCreationStep } = require('./handlers/createBotHandler');
const { myBotsHandler } = require('./handlers/myBotsHandler');
const PlatformAdminHandler = require('./handlers/platformAdminHandler');

// Import the missing handlers
const BanHandler = require('./handlers/banHandler');
const ChannelJoinHandler = require('./handlers/channelJoinHandler');
const ReferralHandler = require('./handlers/referralHandler');

class MetaBotCreator {
  constructor() {
    if (!config.BOT_TOKEN) {
      console.error('❌ BOT_TOKEN is not set');
      process.exit(1);
    }
    
    console.log(`🤖 Creating bot instance with token: ${config.BOT_TOKEN.substring(0, 10)}...`);
    this.bot = new Telegraf(config.BOT_TOKEN, {
      handlerTimeout: 90000,
      telegram: {
        apiRoot: 'https://api.telegram.org',
        agent: null
      }
    });
    this.setupHandlers();
  }
  
  setupHandlers() {
    console.log('🔄 Setting up bot handlers...');
    
    // FIXED: Proper middleware setup without nesting
    this.bot.use(async (ctx, next) => {
      ctx.isMainBot = true;
      ctx.miniBotManager = this;
      
      // Skip ban check for platform admin
      if (PlatformAdminHandler.isPlatformCreator(ctx.from?.id)) {
        return next();
      }
      
      // Check if user is banned
      if (ctx.from && await PlatformAdminHandler.checkUserBan(ctx.from.id)) {
        await ctx.reply('🚫 Your account has been banned from using this platform.');
        return;
      }
      
      return next();
    });
    
    // Add session handling middleware
    this.bot.use(async (ctx, next) => {
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
      
      return next();
    });
    
    this.bot.start(startHandler);
    this.bot.help(helpHandler);
    this.bot.command('privacy', this.privacyHandler);
    this.bot.command('terms', this.termsHandler);
    
    // NEW: Platform admin command
    this.bot.command('platform', (ctx) => {
      if (PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        PlatformAdminHandler.platformDashboard(ctx);
      } else {
        ctx.reply('❌ Platform admin access required.');
      }
    });
    
    // DEBUG COMMANDS
    this.bot.command('debug_minibots', async (ctx) => {
      try {
        await ctx.reply('🔄 Debugging mini-bots...');
        const status = MiniBotManager.getInitializationStatus();
        let message = `🔍 *Mini-bot Debug Info*\n\n`;
        message += `*Status:* ${status.status}\n`;
        message += `*Initialized:* ${status.isInitialized ? 'Yes' : 'No'}\n`;
        message += `*Active Bots:* ${status.activeBots}\n`;
        
        const { Bot } = require('./models');
        const activeBots = await Bot.findAll({ where: { is_active: true } });
        message += `*Database Active Bots:* ${activeBots.length}\n`;
        
        await ctx.replyWithMarkdown(message);
        await ctx.reply('🔄 Forcing mini-bot reinitialization...');
        const result = await MiniBotManager.forceReinitializeAllBots();
        await ctx.reply(`✅ Reinitialization completed. ${result} bots started.`);
      } catch (error) {
        console.error('Debug command error:', error);
        await ctx.reply('❌ Debug command failed.');
      }
    });
    
    this.bot.command('test_minibots', async (ctx) => {
      try {
        await ctx.reply('🧪 Testing mini-bot communication...');
        
        MiniBotManager.debugActiveBots();
        
        const { Bot } = require('./models');
        const activeBots = await Bot.findAll({ where: { is_active: true } });
        
        if (activeBots.length === 0) {
          await ctx.reply('❌ No active bots found in database.');
          return;
        }
        
        let testResults = `🧪 *Mini-bot Test Results*\n\n`;
        
        for (const botRecord of activeBots) {
          const botData = MiniBotManager.activeBots.get(botRecord.id);
          if (botData) {
            try {
              const botInfo = await botData.instance.telegram.getMe();
              testResults += `✅ ${botRecord.bot_name} (@${botInfo.username}) - ACTIVE\n`;
            } catch (error) {
              testResults += `❌ ${botRecord.bot_name} - ERROR: ${error.message}\n`;
            }
          } else {
            testResults += `❌ ${botRecord.bot_name} - NOT IN MEMORY\n`;
          }
        }
        
        await ctx.replyWithMarkdown(testResults);
        
      } catch (error) {
        console.error('Test command error:', error);
        await ctx.reply('❌ Test command failed: ' + error.message);
      }
    });
    
    this.bot.command('reinit', async (ctx) => {
      try {
        const userId = ctx.from.id;
        if (userId !== 1827785384) {
          await ctx.reply('❌ Only bot owner can use this command.');
          return;
        }
        await ctx.reply('🔄 Forcing reinitialization of all mini-bots...');
        const result = await MiniBotManager.forceReinitializeAllBots();
        await ctx.reply(`✅ Reinitialization completed. ${result} bots started.`);
      } catch (error) {
        console.error('Reinit command error:', error);
        await ctx.reply('❌ Error during reinitialization.');
      }
    });
    
    this.bot.command('createbot', createBotHandler);
    this.bot.command('mybots', myBotsHandler);
    this.bot.command('cancel', cancelCreationHandler);
    
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const messageText = ctx.message.text;
      
      // Check for platform admin sessions first
      if (PlatformAdminHandler.isInPlatformAdminSession(userId)) {
        await PlatformAdminHandler.handlePlatformAdminInput(ctx);
        return;
      }
      
      if (messageText === '🚫 Cancel Creation') {
        await cancelCreationHandler(ctx);
        return;
      }
      
      if (isInCreationSession(userId)) {
        const step = getCreationStep(userId);
        if (step === 'awaiting_token') {
          await handleTokenInput(ctx);
        } else if (step === 'awaiting_name') {
          await handleNameInput(ctx);
        }
        return;
      }
      
      await startHandler(ctx);
    });
    
    this.setupCallbackHandlers();
    this.registerAdminCallbacks();
    
    // Add the back_to_bot handler for referral system
    this.bot.action('back_to_bot', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await startHandler(ctx);
      } catch (error) {
        console.error('Back to bot error:', error);
        await ctx.reply('Welcome back! How can I help you?');
      }
    });
    
    this.bot.catch((err, ctx) => {
      console.error('❌ Main bot error:', err);
      try {
        ctx.reply('❌ An error occurred. Please try again.');
      } catch (e) {
        console.error('Failed to send error message:', e);
      }
    });
    
    console.log('✅ Main bot handlers setup complete');
  }
  
  setupCallbackHandlers() {
    console.log('🔄 Setting up main bot callback handlers...');
    
    // REGISTER PLATFORM ADMIN CALLBACKS FIRST - This is critical!
    PlatformAdminHandler.registerCallbacks(this.bot);
    
    // Then register other specific callbacks
    this.bot.action('start', async (ctx) => {
      await ctx.answerCbQuery();
      await startHandler(ctx);
    });
    
    this.bot.action('create_bot', async (ctx) => {
      await ctx.answerCbQuery();
      await createBotHandler(ctx);
    });
    
    this.bot.action('my_bots', async (ctx) => {
      await ctx.answerCbQuery();
      await myBotsHandler(ctx);
    });
    
    this.bot.action('help', async (ctx) => {
      await ctx.answerCbQuery();
      await helpHandler(ctx);
    });
    
    this.bot.action('features', async (ctx) => {
      await ctx.answerCbQuery();
      await featuresHandler(ctx);
    });
    
    this.bot.action('privacy_policy', async (ctx) => {
      await ctx.answerCbQuery();
      await this.privacyHandler(ctx);
    });
    
    this.bot.action('terms_of_service', async (ctx) => {
      await ctx.answerCbQuery();
      await this.termsHandler(ctx);
    });
    
    this.bot.action(/^mini_.+/, async (ctx) => {
      await ctx.answerCbQuery('⚠️ Please use this in your mini-bot');
      await ctx.reply('🔧 This feature is available in your mini-bots. Go to any of your created bots and use /dashboard there.');
    });
    
    this.bot.action(/^reply_.+/, async (ctx) => {
      await ctx.answerCbQuery('⚠️ Please reply from your mini-bot');
      await ctx.reply('💬 Message replying is done in your mini-bots.');
    });
    
    this.bot.action(/^admin_.+/, async (ctx) => {
      await ctx.answerCbQuery('⚠️ Admin management in mini-bots');
      await ctx.reply('👥 Admin management is available in your mini-bots. Use /admins command there.');
    });
    
    this.bot.action(/^remove_admin_.+/, async (ctx) => {
      await ctx.answerCbQuery('⚠️ Admin removal in mini-bots');
      await ctx.reply('👥 Admin management is available in your mini-bots. Use /admins command there.');
    });
    
    // REMOVED the catch-all handler that was causing platform admin buttons to redirect to start
    // this.bot.action(/.+/, async (ctx) => {
    //   await ctx.answerCbQuery();
    //   await startHandler(ctx);
    // });
    
    console.log('✅ Main bot callback handlers setup complete');
  }
  
  privacyHandler = async (ctx) => {
    try {
      const privacyMessage = `🔒 *Privacy Policy - MarCreator*\n\n` +
        `*Last Updated: ${new Date().toISOString().split('T')[0]}*\n\n` +
        `*What MarCreator Collect:*\n` +
        `• Basic profile info\n` +
        `• Data for bot functionality\n` +
        `• Usage statistics for service improvement\n\n` +
        `*How MarCreator Use The Data:*\n` +
        `• To operate and maintain your mini-bots\n` +
        `• To forward messages between users and admins\n` +
        `• To provide bot management features\n` +
        `• For service analytics and improvements\n\n` +
        `*Data Protection:*\n` +
        `• Bot tokens are encrypted at rest\n` +
        `• Database connections use SSL/TLS\n` +
        `• Regular security updates\n\n` +
        `*Contact:*\n` +
        `Questions? Contact @${config.SUPPORT_USERNAME || 'MarCreatorSupportBot'}\n\n` +
        `By using this service, you agree to our privacy practices.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Terms of Service', 'terms_of_service')],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(privacyMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(privacyMessage, keyboard);
      }
    } catch (error) {
      console.error('Privacy handler error:', error);
      await ctx.reply(
        `🔒 Privacy Policy\n\n` +
        `We protect your data. We collect only necessary information to provide the service.\n\n` +
        `Contact @${config.SUPPORT_USERNAME || 'MarCreatorSupportBot'} for concerns.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Main Menu', 'start')]
        ])
      );
    }
  }

  termsHandler = async (ctx) => {
    try {
      const termsMessage = `📋 *Terms of Service - MarCreator*\n\n` +
        `*Last Updated: ${new Date().toISOString().split('T')[0]}*\n\n` +
        `*Acceptance of Terms:*\n` +
        `By using MarCreator, you agree to these Terms of Service.\n\n` +
        `*Service Description:*\n` +
        `MarCreator allows users to create and manage Telegram mini-bots for customer support, communities, and business communication.\n\n` +
        `*User Responsibilities:*\n` +
        `• You must own or have permission to use bot tokens\n` +
        `• You are responsible for your mini-bots' actions\n` +
        `• You must comply with Telegram's Terms of Service\n` +
        `• You must not use the service for illegal activities\n\n` +
        `*Prohibited Uses:*\n` +
        `• Spamming, harassment, or abuse\n` +
        `• Illegal or fraudulent activities\n` +
        `• Violating Telegram's Terms of Service\n` +
        `• Attempting to disrupt the service\n\n` +
        `*Service Limitations:*\n` +
        `• Rate limiting applies to prevent abuse\n` +
        `• Features may change without notice\n\n` +
        `*Data and Privacy:*\n` +
        `• We store minimal necessary data\n` +
        `• See /privacy for full details\n\n` +
        `*Termination:*\n` +
        `We may suspend accounts for:\n` +
        `• Terms of Service violations\n` +
        `• Abuse of the service\n` +
        `• Illegal activities\n\n` +
        `*Disclaimer:*\n` +
        `Service provided "as is" without warranties. We're not liable for:\n` +
        `• Bot downtime or service interruptions\n` +
        `• Actions of your mini-bots\n` +
        `• Third-party service issues\n\n` +
        `*Changes to Terms:*\n` +
        `We may update these terms with reasonable notice.\n\n` +
        `*Contact:*\n` +
        `Questions? Contact @${config.SUPPORT_USERNAME || 'MarCreatorSupportBot'}\n\n` +
        `By using this service, you agree to these terms.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔒 Privacy Policy', 'privacy_policy')],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(termsMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(termsMessage, keyboard);
      }
    } catch (error) {
      console.error('Terms handler error:', error);
      await ctx.reply(
        `📋 Terms of Service\n\n` +
        `By using this service, you agree to use it responsibly and follow Telegram's rules.\n\n` +
        `Contact @${config.SUPPORT_USERNAME || 'MarCreatorBotSupport'} for questions.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Main Menu', 'start')]
        ])
      );
    }
  }
  
  registerAdminCallbacks() {
    console.log('🔄 Registering admin callbacks...');
    
    this.bot.action(/bot_dashboard_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      const BotManagementHandler = require('./handlers/botManagementHandler').BotManagementHandler;
      await BotManagementHandler.handleBotDashboard(ctx, botId);
    });
    
    this.bot.action(/toggle_bot_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      const BotManagementHandler = require('./handlers/botManagementHandler').BotManagementHandler;
      await BotManagementHandler.handleToggleBot(ctx, botId);
    });
    
    this.bot.action(/delete_bot_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      const BotManagementHandler = require('./handlers/botManagementHandler').BotManagementHandler;
      await BotManagementHandler.handleDeleteBot(ctx, botId);
    });
    
    this.bot.action(/confirm_delete_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      const BotManagementHandler = require('./handlers/botManagementHandler').BotManagementHandler;
      await BotManagementHandler.handleConfirmDelete(ctx, botId);
    });
    
    console.log('✅ Admin callbacks registered');
  }
  
  async initialize() {
    try {
      console.log('🔄 CRITICAL: Starting MetaBot Creator initialization...');
      console.log('🗄️ Connecting to database...');
      await connectDB();
      console.log('✅ MetaBot Creator initialized successfully');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
    }
  }
  
  async startMiniBotsAutomatically() {
    console.log('\n🚀 AUTOMATIC: Starting mini-bots initialization...');
    console.log('============================================');
    
    try {
      // Wait for main bot to be fully ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const result = await MiniBotManager.initializeAllBots();
      
      if (result > 0) {
        console.log(`✅ AUTOMATIC: ${result} mini-bots started successfully`);
      } else {
        console.log('ℹ️ AUTOMATIC: No active mini-bots found to start');
      }
      
      console.log('============================================\n');
      return result;
    } catch (error) {
      console.error('❌ AUTOMATIC: Mini-bot initialization failed:', error.message);
      return 0;
    }
  }
  
  start() {
    console.log('🚀 Starting main bot FIRST...');
    
    // CRITICAL: Start mini-bots BEFORE main bot to ensure they run
    console.log('🔄 AUTOMATIC: Starting mini-bots initialization IMMEDIATELY...');
    this.startMiniBotsAutomatically().then(result => {
      if (result > 0) {
        console.log(`✅ ${result} mini-bots started BEFORE main bot`);
      }
    });
    
    // Start main bot
    this.bot.launch({
      dropPendingUpdates: true,
      allowedUpdates: ['message', 'callback_query']
    })
      .then(() => {
        console.log('🎉 MetaBot Creator MAIN BOT is now RUNNING!');
        console.log('========================================');
        console.log('📱 Main Bot: Manages bot creation');
        console.log('🤖 Mini-bots: Handle user messages');
        console.log('💬 Send /start to see main menu');
        console.log('🔧 Use /createbot to create new bots');
        console.log('📋 Use /mybots to view your bots');
        console.log('👑 Use /platform for admin dashboard');
        console.log('🔄 Use /reinit to restart mini-bots');
        console.log('🔒 Legal: /privacy & /terms available');
        console.log('========================================');
        
      })
      .catch(error => {
        console.error('❌ Failed to start main bot:', error.message);
        process.exit(1);
      });
    
    process.once('SIGINT', () => this.shutdown());
    process.once('SIGTERM', () => this.shutdown());
  }
  
  async shutdown() {
    console.log('\n🛑 Shutting down gracefully...');
    
    if (this.bot) {
      await this.bot.stop();
      console.log('✅ Main bot stopped');
    }
    
    const activeBots = Array.from(MiniBotManager.activeBots.keys());
    console.log(`🔄 Stopping ${activeBots.length} mini-bots...`);
    
    for (const botId of activeBots) {
      try {
        await MiniBotManager.stopBot(botId);
      } catch (error) {
        console.error(`❌ Failed to stop mini-bot ${botId}:`, error);
      }
    }
    
    MiniBotManager.activeBots.clear();
    console.log('👋 All bots stopped');
    process.exit(0);
  }
}

// Start the application
async function startApplication() {
  try {
    console.log('🔧 Starting MetaBot Creator application...');
    console.log('🚀 Optimized for Yegara.com cPanel deployment');
    
    const app = new MetaBotCreator();
    await app.initialize();
    app.start();
    
    return app;
  } catch (error) {
    console.error('❌ Application failed to start:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startApplication();
}

module.exports = MetaBotCreator;