// src/app.js - COMPLETE FIXED VERSION
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
    
    this.bot.use(async (ctx, next) => {
      ctx.isMainBot = true;
      return next();
    });
    
    this.bot.start(startHandler);
    this.bot.help(helpHandler);
    this.bot.command('privacy', this.privacyHandler);
    this.bot.command('terms', this.termsHandler);
    
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
        `*What We Collect:*\n` +
        `• Your Telegram user ID and basic profile info\n` +
        `• Bot tokens (encrypted with AES-256)\n` +
        `• Message data for bot functionality\n\n` +
        `*Data Protection:*\n` +
        `• Bot tokens are encrypted at rest\n` +
        `• Database connections use SSL/TLS\n\n` +
        `Contact @${config.SUPPORT_USERNAME || 'MarCreatorSupportBot'} for concerns.`;

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
      await ctx.reply('🔒 Privacy Policy - We protect your data.');
    }
  }

  termsHandler = async (ctx) => {
    try {
      const termsMessage = `📋 *Terms of Service - MarCreatorBot*\n\n` +
        `*Service Description:*\n` +
        `MarCreatorBot allows users to create and manage Telegram mini-bots.\n\n` +
        `*User Responsibilities:*\n` +
        `• You must own or have permission to use bot tokens\n` +
        `• You are responsible for your mini-bots' actions\n` +
        `• You must comply with Telegram's Terms of Service\n\n` +
        `Contact @${config.SUPPORT_USERNAME || 'MarCreatorSupportBot'} for questions.`;

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
      await ctx.reply('📋 Terms of Service - Use responsibly.');
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
      await new Promise(resolve => setTimeout(resolve, 5000));
      
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
        console.log('🔄 Use /reinit to restart mini-bots');
        console.log('========================================');
        
        // CRITICAL: Start mini-bots automatically after main bot is running
        console.log('🔄 AUTOMATIC: Starting mini-bots in 3 seconds...');
        
        // Use a more reliable approach
        setTimeout(() => {
          this.startMiniBotsAutomatically().then(result => {
            if (result === 0) {
              console.log('💡 TIP: Use /reinit to manually start mini-bots if needed');
            }
          });
        }, 3000);
        
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

// Only start if this is the main module
if (require.main === module) {
  startApplication();
}

module.exports = MetaBotCreator;