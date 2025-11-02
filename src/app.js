// Production optimizations
if (process.env.NODE_ENV === 'production') {
  require('events').EventEmitter.defaultMaxListeners = 20;
  
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
const { connectDB, healthCheck } = require('../database/db');
const MiniBotManager = require('./services/MiniBotManager');
const { ensureDatabase } = require('./scripts/ensureDatabase');

// Import handlers
const { startHandler, helpHandler, featuresHandler } = require('./handlers/startHandler');
const { createBotHandler, handleTokenInput, handleNameInput, cancelCreationHandler, isInCreationSession, getCreationStep } = require('./handlers/createBotHandler');
const { myBotsHandler } = require('./handlers/myBotsHandler');

class MetaBotCreator {
  constructor() {
    if (!config.BOT_TOKEN || config.BOT_TOKEN === 'NOT SET') {
      console.error('❌ BOT_TOKEN is not set or invalid');
      process.exit(1);
    }
    
    console.log(`🤖 Creating bot instance with token: ${config.BOT_TOKEN.substring(0, 10)}...`);
    this.bot = new Telegraf(config.BOT_TOKEN);
    this.setupHandlers();
  }
  
  setupHandlers() {
    console.log('🔄 Setting up bot handlers...');
    
    this.bot.use(async (ctx, next) => {
      ctx.isMainBot = true;
      return next();
    });
    
    // Basic commands
    this.bot.start(startHandler);
    this.bot.help(helpHandler);
    
    // Legal commands
    this.bot.command('privacy', this.privacyHandler);
    this.bot.command('terms', this.termsHandler);
    
    // Main commands
    this.bot.command('createbot', createBotHandler);
    this.bot.command('mybots', myBotsHandler);
    this.bot.command('cancel', cancelCreationHandler);
    
    // Text message handling
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const messageText = ctx.message.text;
      
      console.log(`📨 Received text from ${userId}: ${messageText}`);
      
      if (messageText === '🚫 Cancel Creation') {
        await cancelCreationHandler(ctx);
        return;
      }
      
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
      
      await startHandler(ctx);
    });
    
    this.setupCallbackHandlers();
    this.registerAdminCallbacks();
    
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
    
    this.bot.action(/.+/, async (ctx) => {
      await ctx.answerCbQuery();
      await startHandler(ctx);
    });
    
    console.log('✅ Main bot callback handlers setup complete');
  }
  
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
      
      // Step 1: Connect to database with retries
      console.log('🗄️ Connecting to database...');
      const dbConnected = await connectDB();
      
      if (!dbConnected) {
        console.error('❌ Database connection failed, but continuing...');
        // We'll try to initialize mini-bots anyway in case it's a temporary issue
      }
      
      // Step 2: Ensure database is properly set up
      console.log('🔄 Ensuring database setup...');
      await ensureDatabase();
      
      // Step 3: Wait for database to be fully ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Step 4: Initialize mini-bots with robust error handling
      console.log('🤖 Initializing mini-bots...');
      await this.initializeMiniBotsWithRetry();
      
      console.log('✅ MetaBot Creator initialized successfully');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      // Don't exit, try to continue
    }
  }
  
  async initializeMiniBotsWithRetry(maxRetries = 3) {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        console.log(`🔄 Mini-bot initialization attempt ${retries + 1}/${maxRetries}`);
        
        const successCount = await MiniBotManager.initializeAllBots();
        
        if (successCount > 0) {
          console.log(`✅ ${successCount} mini-bots initialized successfully`);
          return;
        } else {
          console.log('ℹ️ No active mini-bots found to initialize');
          
          // Check if this might be a database timing issue
          const { Bot } = require('../models');
          const activeBots = await Bot.findAll({ where: { is_active: true } });
          console.log(`📊 Database shows ${activeBots.length} active bots`);
          
          if (activeBots.length > 0) {
            console.log('⚠️ Database has active bots but MiniBotManager found 0 - retrying...');
            retries++;
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          // No active bots, this is normal
          return;
        }
      } catch (error) {
        console.error(`❌ Mini-bot initialization attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries < maxRetries) {
          console.log(`🔄 Retrying in 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.error('💥 All mini-bot initialization attempts failed');
        }
      }
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
        
        // Schedule periodic health checks
        setInterval(async () => {
          console.log('🏥 Running scheduled health check...');
          const health = await healthCheck();
          console.log(`📊 Database Health: ${health.healthy ? '✅' : '❌'} - ${health.bots} bots`);
          
          MiniBotManager.healthCheck();
        }, 300000); // Every 5 minutes
        
        // Initial health check after 30 seconds
        setTimeout(async () => {
          console.log('🏥 Running initial health check...');
          const health = await healthCheck();
          console.log(`📊 Initial Database Health: ${health.healthy ? '✅' : '❌'} - ${health.bots} bots`);
          
          MiniBotManager.healthCheck();
        }, 30000);
      })
      .catch(error => {
        console.error('❌ Failed to start main bot:', error);
        console.log('💡 Check your BOT_TOKEN in Railway variables');
        process.exit(1);
      });
    
    // Enable graceful stop
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
        console.log(`✅ Stopped mini-bot: ${botId}`);
      } catch (error) {
        console.error(`❌ Failed to stop mini-bot ${botId}:`, error);
      }
    }
    
    MiniBotManager.activeBots.clear();
    console.log('👋 All bots stopped successfully');
    process.exit(0);
  }
}

// Start the application
async function startApplication() {
  try {
    console.log('🔧 Starting MetaBot Creator application...');
    
    const app = new MetaBotCreator();
    await app.initialize();
    app.start();
    
    return app;
  } catch (error) {
    console.error('❌ Application failed to start:', error);
    process.exit(1);
  }
}

startApplication();

module.exports = MetaBotCreator;