// Production optimizations
if (process.env.NODE_ENV === 'production') {
  // Increase event listeners for production
  require('events').EventEmitter.defaultMaxListeners = 20;
  
  // Global error handlers
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });
  
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });
}

const { Telegraf, Markup } = require('telegraf');
const config = require('../config/environment');
const { connectDB } = require('../database/db');
const MiniBotManager = require('./services/MiniBotManager');

// Import handlers
const { startHandler, helpHandler, featuresHandler, defaultHandler } = require('./handlers/startHandler');
const { createBotHandler, handleTokenInput, handleNameInput, cancelCreationHandler, isInCreationSession, getCreationStep } = require('./handlers/createBotHandler');
const { myBotsHandler } = require('./handlers/myBotsHandler');

class MetaBotCreator {
  constructor() {
    // Validate bot token first
    if (!config.BOT_TOKEN || config.BOT_TOKEN === 'NOT SET') {
      console.error('❌ BOT_TOKEN is not set or invalid');
      console.log('💡 Please check your .env file and ensure BOT_TOKEN is set correctly');
      process.exit(1);
    }
    
    console.log(`🤖 Creating bot instance with token: ${config.BOT_TOKEN.substring(0, 10)}...`);
    this.bot = new Telegraf(config.BOT_TOKEN);
    this.setupHandlers();
  }
  
  setupHandlers() {
    console.log('🔄 Setting up bot handlers...');
    
    // Clear any existing middleware
    this.bot.use(async (ctx, next) => {
      // Add main bot identifier
      ctx.isMainBot = true;
      return next();
    });
    
    // Basic commands
    this.bot.start(startHandler);
    this.bot.help(helpHandler);
    
    // Legal commands
    this.bot.command('privacy', this.privacyHandler);
    this.bot.command('terms', this.termsHandler);
    
    // Main commands - ONLY creation and listing
    this.bot.command('createbot', createBotHandler);
    this.bot.command('mybots', myBotsHandler);
    this.bot.command('cancel', cancelCreationHandler);
    
    // Text message handling - ONLY for main bot functions
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const messageText = ctx.message.text;
      
      console.log(`📨 Received text from ${userId}: ${messageText}`);
      
      // Handle cancel first
      if (messageText === '🚫 Cancel Creation') {
        await cancelCreationHandler(ctx);
        return;
      }
      
      // Handle creation sessions
      if (isInCreationSession(userId)) {
        const step = getCreationStep(userId);
        console.log(`🔄 User ${userId} in creation session, step: ${step}`);
        if (step === 'awaiting_token') {
          await handleTokenInput(ctx);
        } else if (step === 'awaiting_name') {
          await handleNameInput(ctx);
        }
        return;
      }
      
      // All other messages show main menu
      console.log(`🔄 User ${userId} - showing main menu`);
      await startHandler(ctx);
    });
    
    // Setup main bot callback handlers only
    this.setupCallbackHandlers();
    
    // Register admin callbacks
    this.registerAdminCallbacks();
    
    // Error handling
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
    
    // ========== MAIN BOT NAVIGATION ONLY ==========
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
    
    // ========== IGNORE MINI-BOT CALLBACKS ==========
    this.bot.action(/^mini_.+/, async (ctx) => {
      await ctx.answerCbQuery('⚠️ Please use this in your mini-bot');
      await ctx.reply('🔧 This feature is available in your mini-bots. Go to any of your created bots and use /dashboard there.');
    });
    
    this.bot.action(/^reply_.+/, async (ctx) => {
      await ctx.answerCbQuery('⚠️ Please reply from your mini-bot');
      await ctx.reply('💬 Message replying is done in your mini-bots. Visit your bot and use /messages there.');
    });
    
    this.bot.action(/^admin_.+/, async (ctx) => {
      await ctx.answerCbQuery('⚠️ Admin management in mini-bots');
      await ctx.reply('👥 Admin management is available in your mini-bots. Use /admins command there.');
    });
    
    this.bot.action(/^remove_admin_.+/, async (ctx) => {
      await ctx.answerCbQuery('⚠️ Admin removal in mini-bots');
      await ctx.reply('👥 Admin management is available in your mini-bots. Use /admins command there.');
    });
    
    // ========== DEFAULT CATCH-ALL ==========
    this.bot.action(/.+/, async (ctx) => {
      await ctx.answerCbQuery();
      await startHandler(ctx);
    });
    
    console.log('✅ Main bot callback handlers setup complete');
  }
  
  // Privacy Policy Handler
  privacyHandler = async (ctx) => {
    try {
      const privacyMessage = `🔒 *Privacy Policy - MarCreatorBot*\n\n` +
        `*Last Updated: ${new Date().toISOString().split('T')[0]}*\n\n` +
        `*What We Collect:*\n` +
        `• Your Telegram user ID and basic profile info\n` +
        `• Bot tokens (encrypted with AES-256)\n` +
        `• Message data for bot functionality\n` +
        `• Usage statistics for service improvement\n\n` +
        `*How We Use Your Data:*\n` +
        `• To operate and maintain your mini-bots\n` +
        `• To forward messages between users and admins\n` +
        `• To provide bot management features\n` +
        `• For service analytics and improvements\n\n` +
        `*Data Protection:*\n` +
        `• Bot tokens are encrypted at rest\n` +
        `• Database connections use SSL/TLS\n` +
        `• Regular security updates\n\n` +
        `*Data Sharing:*\n` +
        `We do NOT sell, trade, or share your personal data with third parties.\n\n` +
        `@${config.SUPPORT_USERNAME || 'MarCreatorSupportBot'}\n\n` +
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

  // Terms of Service Handler
  termsHandler = async (ctx) => {
    try {
      const termsMessage = `📋 *Terms of Service - MarCreatorBot*\n\n` +
        `*Last Updated: ${new Date().toISOString().split('T')[0]}*\n\n` +
        `*Acceptance of Terms:*\n` +
        `By using MarCreatorBot, you agree to these Terms of Service.\n\n` +
        `*Service Description:*\n` +
        `MarCreatorBot allows users to create and manage Telegram mini-bots for customer support, communities, and business communication.\n\n` +
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
        `• Maximum ${config.MAX_BOTS_PER_USER || 10} bots per user\n` +
        `• Rate limiting applies to prevent abuse\n` +
        `• Service availability is not guaranteed\n` +
        `• Features may change without notice\n\n` +
        `*Data and Privacy:*\n` +
        `• We encrypt your bot tokens\n` +
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
        `• Data loss or corruption\n` +
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
    
    // Bot management callbacks
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
      console.log('🔄 Initializing MetaBot Creator...');
      
      // Connect to database
      console.log('🗄️ Connecting to database...');
      await connectDB();
      console.log('✅ Database connected');
      
      // Clear any existing mini-bots first (CRITICAL FIX)
      console.log('🔄 Cleaning up any existing mini-bot instances...');
      const activeBots = Array.from(MiniBotManager.activeBots.keys());
      for (const botId of activeBots) {
        await MiniBotManager.stopBot(botId);
      }
      console.log(`✅ Cleared ${activeBots.length} existing bot instances`);
      
      // Initialize all active mini-bots (with proper error handling)
      console.log('🤖 Initializing mini-bots...');
      
      // Use setTimeout with proper cleanup to prevent duplicates
      let initializationStarted = false;
      
      const initializeMiniBots = async () => {
        if (initializationStarted) {
          console.log('⚠️ Mini-bot initialization already in progress, skipping...');
          return;
        }
        
        initializationStarted = true;
        try {
          const successCount = await MiniBotManager.initializeAllBots();
          if (successCount > 0) {
            console.log(`✅ ${successCount} mini-bots initialized successfully`);
          } else {
            console.log('ℹ️ No active mini-bots found to initialize');
          }
        } catch (error) {
          console.error('❌ Mini-bot initialization error:', error);
        }
      };
      
      // Delay initialization to ensure main bot is stable
      setTimeout(initializeMiniBots, 5000);
      
      // Debug: Check for duplicates after initialization
      setTimeout(() => {
        console.log('🔍 DEBUG: Checking for duplicate bots...');
        MiniBotManager.debugActiveBots();
      }, 8000);
      
      console.log('✅ MetaBot Creator initialized successfully');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      process.exit(1);
    }
  }
  
  start() {
    console.log('🚀 Starting main bot...');
    
    this.bot.launch()
      .then(() => {
        console.log('🎉 MetaBot Creator MAIN BOT is now RUNNING!');
        console.log('========================================');
        console.log('📱 Main Bot: Manages bot creation only');
        console.log('🤖 Mini-bots: Handle user messages & management');
        console.log('💬 Send /start to see main menu');
        console.log('🔧 Use /createbot to create new bots');
        console.log('📋 Use /mybots to view your bots');
        console.log('🔒 Legal: /privacy & /terms available');
        console.log('========================================');
      })
      .catch(error => {
        console.error('❌ Failed to start main bot:', error);
        console.log('💡 Check your BOT_TOKEN in .env file');
        process.exit(1);
      });
    
    // Enable graceful stop
    process.once('SIGINT', () => this.shutdown());
    process.once('SIGTERM', () => this.shutdown());
  }
  
  async shutdown() {
    console.log('\n🛑 Shutting down gracefully...');
    
    // Stop main bot
    if (this.bot) {
      await this.bot.stop();
      console.log('✅ Main bot stopped');
    }
    
    // Stop all mini-bots with proper cleanup
    const activeBots = Array.from(MiniBotManager.activeBots.keys());
    console.log(`🔄 Stopping ${activeBots.length} mini-bots...`);
    
    for (const botId of activeBots) {
      try {
        await MiniBotManager.stopBot(botId);
        console.log(`✅ Stopped mini-bot: ${botId}`);
      } catch (error) {
        console.error(`❌ Failed to stop mini-bot ${botId}:`, error);
      }
    }
    
    // Clear the active bots map
    MiniBotManager.activeBots.clear();
    
    console.log('👋 All bots stopped successfully');
    process.exit(0);
  }
}

// Start the application
async function startApplication() {
  try {
    console.log('🔧 Starting MetaBot Creator application...');
    
    // Create app instance
    const app = new MetaBotCreator();
    
    // Initialize everything
    await app.initialize();
    
    // Start the bot
    app.start();
    
    return app;
  } catch (error) {
    console.error('❌ Application failed to start:', error);
    process.exit(1);
  }
}

// Start the application
startApplication();

module.exports = MetaBotCreator;