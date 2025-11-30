// src/app.js - COMPLETE BOTOMICS VERSION
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

// Import services
const WalletService = require('./services/walletService');
const SubscriptionService = require('./services/subscriptionService');

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
  
  // Add Mini App FIRST
  this.setupMiniApp();
  
  // Middleware
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
  
    
    // Commands
    this.bot.start(startHandler);
    this.bot.help(helpHandler);
    this.bot.command('privacy', this.privacyHandler);
    this.bot.command('terms', this.termsHandler);
    
    // Botomics Commands
    this.bot.command('wallet', async (ctx) => {
      await this.showWallet(ctx);
    });
    
    this.bot.command('premium', async (ctx) => {
      await this.showPremium(ctx);
    });
    
    this.bot.command('subscription', async (ctx) => {
      await this.showPremium(ctx);
    });
    
    // Platform Admin
    this.bot.command('platform', (ctx) => {
      if (PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        PlatformAdminHandler.platformDashboard(ctx);
      } else {
        ctx.reply('❌ Platform admin access required.');
      }
    });
    
    // Bot Management
    this.bot.command('createbot', createBotHandler);
    this.bot.command('mybots', myBotsHandler);
    this.bot.command('cancel', cancelCreationHandler);
    
    // Debug Commands
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
    
    // Text handler
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const messageText = ctx.message.text;
      
      // Platform admin sessions
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

  setupMiniApp() {
  console.log('🔄 Setting up Mini App...');
  
  // Add Mini App to menu
  this.bot.telegram.setChatMenuButton({
    menu_button: {
      type: 'web_app',
      text: '💰 Botomics Wallet',
      web_app: { url: 'https://testweb.maroset.com/wallet' } // CHANGE TO YOUR ACTUAL URL
    }
  });
  
  // Mini App handler
  this.bot.on('web_app_data', async (ctx) => {
    try {
      const data = JSON.parse(ctx.webAppData.data);
      console.log('📱 Mini App data received:', data);
      
      const userId = ctx.from.id;
      
      switch (data.action) {
        case 'get_balance':
          const balance = await WalletService.getBalance(userId);
          await ctx.reply(
            `💰 *Your Wallet Balance*\n\n` +
            `*Balance:* ${balance.balance} ${balance.currency}\n` +
            `*Status:* ${balance.isFrozen ? '❄️ Frozen' : '✅ Active'}\n\n` +
            `*1 BOM = $1.00 USD*`,
            { parse_mode: 'Markdown' }
          );
          break;
          
        case 'premium_upgrade':
          await this.upgradeToPremium(ctx);
          break;
          
        case 'deposit_info':
          await this.showDepositInstructions(ctx);
          break;
          
        case 'withdraw_info':
          await this.showWithdrawalInstructions(ctx);
          break;
          
        case 'transaction_history':
          await this.showTransactionHistory(ctx, 0);
          break;
          
        case 'subscription_info':
          await this.showPremium(ctx);
          break;
          
        default:
          await ctx.reply('❌ Unknown Mini App action');
      }
    } catch (error) {
      console.error('Mini App error:', error);
      await ctx.reply('❌ Mini App processing error');
    }
  });
  
  console.log('✅ Mini App setup complete');
}

// Add this method to get next reset date
getNextResetDate() {
  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((7 - now.getDay()) % 7 + 1) % 7);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday.toLocaleDateString();
}
  
  setupCallbackHandlers() {
    console.log('🔄 Setting up main bot callback handlers...');
    
    // Platform admin
    PlatformAdminHandler.registerCallbacks(this.bot);
    
    // Basic commands
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
    
    // Botomics features
    this.bot.action('wallet_main', async (ctx) => {
      await this.showWallet(ctx);
    });
    
    this.bot.action('wallet_deposit', async (ctx) => {
      await this.showDepositInstructions(ctx);
    });
    
    this.bot.action('wallet_withdraw', async (ctx) => {
      await this.showWithdrawalInstructions(ctx);
    });
    
    this.bot.action('wallet_history', async (ctx) => {
      await this.showTransactionHistory(ctx, 0);
    });
    
    this.bot.action('subscribe_premium', async (ctx) => {
      await this.showPremium(ctx);
    });
    
    this.bot.action('upgrade_premium', async (ctx) => {
      await this.upgradeToPremium(ctx);
    });
    
    this.bot.action('cancel_premium', async (ctx) => {
      await this.cancelPremium(ctx);
    });
    
    // Pagination
    this.bot.action(/^wallet_history_(\d+)/, async (ctx) => {
      const page = parseInt(ctx.match[1]);
      await this.showTransactionHistory(ctx, page);
    });
    
    // Mini-bot redirects
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
    
    console.log('✅ Main bot callback handlers setup complete');
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
  
  // Botomics Features Implementation
  async showWallet(ctx) {
    try {
      const userId = ctx.from.id;
      const wallet = await WalletService.getBalance(userId);
      
      const message = `💰 *Your Botomics Wallet*\n\n` +
        `*Balance:* ${wallet.balance} ${wallet.currency}\n` +
        `*Status:* ${wallet.isFrozen ? '❄️ Frozen' : '✅ Active'}\n\n` +
        `*1 ${wallet.currency} = $1.00 USD*\n\n` +
        `*Available Actions:*`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💳 Deposit BOM', 'wallet_deposit')],
        [Markup.button.callback('📤 Withdraw BOM', 'wallet_withdraw')],
        [Markup.button.callback('🔄 Transaction History', 'wallet_history')],
        [Markup.button.callback('🎫 Subscribe Premium', 'subscribe_premium')],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ]);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery();
      }
    } catch (error) {
      console.error('Wallet show error:', error);
      await ctx.reply('❌ Error loading wallet.');
    }
  }
  
  async showDepositInstructions(ctx) {
    try {
      const message = `💳 *Deposit BOM Coins*\n\n` +
        `To add BOM coins to your wallet:\n\n` +
        `1. *Rate:* 1 BOM = $1.00 USD\n` +
        `2. Send payment to our platform address\n` +
        `3. Submit transaction proof for verification\n` +
        `4. Coins will be added after verification\n\n` +
        `*Minimum Deposit:* $5 (5 BOM)\n` +
        `*Processing Time:* 1-6 hours\n\n` +
        `💡 *Contact @BotomicsSupport for payment details*`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📸 Submit Proof', 'submit_deposit_proof')],
        [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Deposit instructions error:', error);
      await ctx.reply('❌ Error showing deposit instructions.');
    }
  }
  
  async showWithdrawalInstructions(ctx) {
    try {
      const userId = ctx.from.id;
      const wallet = await WalletService.getBalance(userId);
      
      const message = `📤 *Withdraw BOM Coins*\n\n` +
        `*Current Balance:* ${wallet.balance} BOM\n` +
        `*Minimum Withdrawal:* 20 BOM ($20.00)\n\n` +
        `*Withdrawal Process:*\n` +
        `1. Enter amount (minimum 20 BOM)\n` +
        `2. Provide payment details\n` +
        `3. Submit withdrawal request\n` +
        `4. Processed within 24 hours\n\n` +
        `*Available Methods:* PayPal, Bank Transfer, Crypto`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💰 Request Withdrawal', 'start_withdrawal')],
        [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Withdrawal instructions error:', error);
      await ctx.reply('❌ Error showing withdrawal instructions.');
    }
  }
  
  async showTransactionHistory(ctx, page = 0) {
    try {
      const userId = ctx.from.id;
      const limit = 10;
      const offset = page * limit;
      
      const history = await WalletService.getTransactionHistory(userId, limit, offset);
      
      let message = `📊 *Transaction History* - Page ${page + 1}\n\n`;
      
      if (history.transactions.length === 0) {
        message += `No transactions found.\n\n`;
      } else {
        history.transactions.forEach((tx, index) => {
          const date = new Date(tx.created_at).toLocaleDateString();
          const time = new Date(tx.created_at).toLocaleTimeString();
          const amount = tx.amount > 0 ? `+${tx.amount}` : tx.amount.toString();
          const emoji = tx.amount > 0 ? '🟢' : '🔴';
          const typeEmoji = {
            'deposit': '💳',
            'withdrawal': '📤',
            'transfer': '🔄',
            'subscription': '🎫',
            'donation': '☕',
            'ad_revenue': '📢',
            'reward': '🎁'
          }[tx.type] || '💸';
          
          message += `${emoji} ${typeEmoji} *${date} ${time}*\n`;
          message += `   ${tx.description}\n`;
          message += `   Amount: ${amount} ${tx.currency}\n\n`;
        });
      }
      
      const keyboardButtons = [];
      
      if (page > 0) {
        keyboardButtons.push(Markup.button.callback('⬅️ Previous', `wallet_history_${page - 1}`));
      }
      
      if (history.pagination.hasMore) {
        keyboardButtons.push(Markup.button.callback('Next ➡️', `wallet_history_${page + 1}`));
      }
      
      if (keyboardButtons.length > 0) {
        keyboardButtons.push(Markup.button.callback('🔙 Back to Wallet', 'wallet_main'));
        const keyboard = Markup.inlineKeyboard([keyboardButtons]);
        await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      } else {
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
        ]);
        await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Transaction history error:', error);
      await ctx.reply('❌ Error loading transaction history.');
    }
  }
  
  async showPremium(ctx) {
    try {
      const userId = ctx.from.id;
      const currentTier = await SubscriptionService.getSubscriptionTier(userId);
      const wallet = await WalletService.getBalance(userId);
      
      const message = `🎫 *Premium Subscription*\n\n` +
        `*Current Tier:* ${currentTier === 'premium' ? '🎉 PREMIUM' : '🆓 FREEMIUM'}\n` +
        `*Wallet Balance:* ${wallet.balance} BOM\n\n` +
        `*Premium Benefits:*\n` +
        `✅ Unlimited bot creation\n` +
        `✅ Unlimited broadcasts\n` +
        `✅ Unlimited co-admins\n` +
        `✅ Unlimited force-join channels\n` +
        `✅ Enable donation system\n` +
        `✅ Pin /start message\n` +
        `✅ Ad-free experience\n` +
        `✅ Priority support\n\n` +
        `*Price:* 5 BOM per month ($5.00)\n` +
        `*Auto-renewal:* Enabled by default`;
      
      const keyboardButtons = [];
      
      if (currentTier === 'freemium') {
        if (wallet.balance >= 5) {
          keyboardButtons.push([Markup.button.callback('⭐ Upgrade to Premium', 'upgrade_premium')]);
        } else {
          keyboardButtons.push([Markup.button.callback('💳 Add BOM Coins', 'wallet_deposit')]);
        }
      } else {
        keyboardButtons.push([Markup.button.callback('✅ Premium Active', 'wallet_main')]);
        keyboardButtons.push([Markup.button.callback('❌ Cancel Subscription', 'cancel_premium')]);
      }
      
      keyboardButtons.push([Markup.button.callback('🔙 Main Menu', 'start')]);
      
      const keyboard = Markup.inlineKeyboard(keyboardButtons);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery();
      }
    } catch (error) {
      console.error('Premium subscription error:', error);
      await ctx.reply('❌ Error loading subscription info.');
    }
  }
  
  async upgradeToPremium(ctx) {
    try {
      const userId = ctx.from.id;
      
      await ctx.answerCbQuery('🔄 Processing upgrade...');
      
      await SubscriptionService.upgradeToPremium(userId);
      
      await ctx.editMessageText(
        `🎉 *Welcome to Premium!*\n\n` +
        `Your subscription has been activated successfully!\n\n` +
        `You now have access to all premium features:\n` +
        `• Unlimited bots & broadcasts\n` +
        `• Advanced bot management\n` +
        `• Ad-free experience\n` +
        `• And much more!\n\n` +
        `*Next billing date:* ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
          ])
        }
      );
    } catch (error) {
      console.error('Upgrade premium error:', error);
      await ctx.answerCbQuery(`❌ ${error.message}`);
    }
  }
  
  async cancelPremium(ctx) {
    try {
      const userId = ctx.from.id;
      
      await ctx.answerCbQuery('🔄 Cancelling subscription...');
      
      await SubscriptionService.cancelSubscription(userId);
      
      await ctx.editMessageText(
        `❌ *Premium Subscription Cancelled*\n\n` +
        `Your premium subscription has been cancelled.\n\n` +
        `*Note:* You will keep premium features until the end of your current billing period.\n\n` +
        `You can upgrade again anytime from your wallet.`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back to Wallet', 'wallet_main')]
          ])
        }
      );
    } catch (error) {
      console.error('Cancel premium error:', error);
      await ctx.answerCbQuery(`❌ ${error.message}`);
    }
  }
  
  privacyHandler = async (ctx) => {
    try {
      const privacyMessage = `🔒 *Privacy Policy - Botomics*\n\n` +
        `*Last Updated: ${new Date().toISOString().split('T')[0]}*\n\n` +
        `*What Botomics Collect:*\n` +
        `• Basic profile info\n` +
        `• Data for bot functionality\n` +
        `• Usage statistics for service improvement\n\n` +
        `*How Botomics Use The Data:*\n` +
        `• To operate and maintain your mini-bots\n` +
        `• To forward messages between users and admins\n` +
        `• To provide bot management features\n` +
        `• For service analytics and improvements\n\n` +
        `*Data Protection:*\n` +
        `• Bot tokens are encrypted at rest\n` +
        `• Database connections use SSL/TLS\n` +
        `• Regular security updates\n\n` +
        `*Contact:*\n` +
        `Questions? Contact @BotomicsSupportBot\n\n` +
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
        `Contact @BotomicsSupportBot for concerns.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Main Menu', 'start')]
        ])
      );
    }
  }

  termsHandler = async (ctx) => {
    try {
      const termsMessage = `📋 *Terms of Service - Botomics*\n\n` +
        `*Last Updated: ${new Date().toISOString().split('T')[0]}*\n\n` +
        `*Acceptance of Terms:*\n` +
        `By using Botomics, you agree to these Terms of Service.\n\n` +
        `*Service Description:*\n` +
        `Botomics allows users to create and manage Telegram mini-bots for customer support, communities, and business communication.\n\n` +
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
        `Questions? Contact @BotomicsSupportBot\n\n` +
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
        `Contact @BotomicsSupportBot for questions.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Main Menu', 'start')]
        ])
      );
    }
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
      throw error;
    }
  }
  
  start() {
    console.log('🚀 Starting bot initialization sequence...');
    
    this.startMiniBotsAutomatically().then(result => {
      console.log(`✅ STEP 1 COMPLETE: ${result} mini-bots initialized`);
      
      console.log('⏳ Waiting 10 seconds before starting main bot...');
      setTimeout(() => {
        console.log('🚀 STEP 2: Starting main bot...');
        
        this.bot.launch({
          dropPendingUpdates: true,
          allowedUpdates: ['message', 'callback_query']
        })
          .then(() => {
            console.log('🎉 MetaBot Creator MAIN BOT is now RUNNING!');
            console.log('========================================');
            console.log('📱 Main Bot: Manages bot creation & wallet');
            console.log('🤖 Mini-bots: Handle user messages');
            console.log('💰 Botomics: Digital currency system');
            console.log('🎫 Premium: Subscription tiers');
            console.log('💬 Send /start to see main menu');
            console.log('🔧 Use /createbot to create new bots');
            console.log('📋 Use /mybots to view your bots');
            console.log('👑 Use /platform for admin dashboard');
            console.log('🔒 Legal: /privacy & /terms available');
            console.log('========================================');
          })
          .catch(error => {
            console.error('❌ Failed to start main bot:', error.message);
          });
      }, 10000);
    }).catch(error => {
      console.error('❌ Mini-bot initialization failed:', error);
      this.startMainBotWithDelay();
    });
    
    process.once('SIGINT', () => this.shutdown());
    process.once('SIGTERM', () => this.shutdown());
  }

  startMainBotWithDelay() {
    console.log('⏳ Starting main bot with 15 second delay...');
    setTimeout(() => {
      this.bot.launch({
        dropPendingUpdates: true,
        allowedUpdates: ['message', 'callback_query']
      })
        .then(() => {
          console.log('🎉 Main bot started (mini-bots may be unavailable)');
        })
        .catch(error => {
          console.error('❌ Main bot failed to start:', error.message);
        });
    }, 15000);
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