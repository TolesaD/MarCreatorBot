// src/app.js - COMPLETE BOTOMICS PRODUCTION VERSION
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

// Import Wallet Handler for better organization
const WalletHandler = require('./handlers/walletHandler');

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
    
    // Botomics Commands - Only accessible via command or menu
    this.bot.command('wallet', async (ctx) => {
      await this.openWalletMiniApp(ctx);
    });
    
    this.bot.command('premium', async (ctx) => {
      await this.openWalletMiniApp(ctx, 'premium');
    });
    
    this.bot.command('subscription', async (ctx) => {
      await this.openWalletMiniApp(ctx, 'premium');
    });
    
    // Deprecated wallet commands - redirect to mini app
    this.bot.command('deposit', async (ctx) => {
      await this.redirectToMiniApp(ctx, 'deposit');
    });
    
    this.bot.command('withdraw', async (ctx) => {
      await this.redirectToMiniApp(ctx, 'withdraw');
    });
    
    this.bot.command('transfer', async (ctx) => {
      await this.redirectToMiniApp(ctx, 'transfer');
    });
    
    this.bot.command('history', async (ctx) => {
      await this.redirectToMiniApp(ctx, 'history');
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
    
    // Admin wallet management
    this.bot.command('admin_wallet', async (ctx) => {
      if (PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await WalletHandler.handleAdminWalletDashboard(ctx);
      } else {
        ctx.reply('❌ Admin access required.');
      }
    });
    
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
      
      // Handle wallet and premium text commands
      if (messageText.toLowerCase() === 'wallet' || messageText === '💰 wallet') {
        await this.openWalletMiniApp(ctx);
        return;
      }
      
      if (messageText.toLowerCase() === 'premium' || messageText === '🎫 premium') {
        await this.openWalletMiniApp(ctx, 'premium');
        return;
      }
      
      await startHandler(ctx);
    });
    
    this.setupCallbackHandlers();
    this.registerAdminCallbacks();
    this.registerWalletCallbacks();
    
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
    
    // Use testweb.maroset.com for Mini App (FIXED as requested)
    const walletUrl = 'https://testweb.maroset.com/wallet';
    
    // Add Mini App to menu
    this.bot.telegram.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '💰 Botomics Wallet',
        web_app: { url: walletUrl }
      }
    });
    
    console.log(`✅ Mini App configured with URL: ${walletUrl}`);
    
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
              `*Balance:* ${balance.balance.toFixed(2)} ${balance.currency}\n` +
              `*Status:* ${balance.isFrozen ? '❄️ Frozen' : '✅ Active'}\n\n` +
              `*1 BOM = $1.00 USD*`,
              { parse_mode: 'Markdown' }
            );
            break;
            
          case 'premium_upgrade':
            await WalletHandler.handleUpgradePremium(ctx);
            break;
            
          case 'deposit_info':
            await this.redirectToMiniApp(ctx, 'deposit');
            break;
            
          case 'withdraw_info':
            await this.redirectToMiniApp(ctx, 'withdraw');
            break;
            
          case 'transaction_history':
            await this.redirectToMiniApp(ctx, 'history');
            break;
            
          case 'subscription_info':
            await this.openWalletMiniApp(ctx, 'premium');
            break;
            
          case 'contact_support':
            await ctx.reply(
              '📞 *Botomics Support*\n\n' +
              'For assistance with:\n' +
              '• Buying BOM coins\n' +
              '• Wallet deposits/withdrawals\n' +
              '• Premium subscriptions\n' +
              '• Bot creation issues\n' +
              '• Technical problems\n\n' +
              'Contact: @BotomicsSupportBot for buying BOM\n\n' +
              'For other issues, use the Mini App support.',
              { parse_mode: 'Markdown' }
            );
            break;
            
          case 'buy_bom_info':
            await ctx.reply(
              '💰 *Buy BOM Coins*\n\n' +
              'To purchase BOM coins:\n\n' +
              '1. Contact @BotomicsSupportBot\n' +
              '2. Specify amount you want to buy (minimum 5 BOM)\n' +
              '3. Follow payment instructions\n' +
              '4. Submit payment proof\n' +
              '5. Coins will be added after verification\n\n' +
              '*Rate:* 1 BOM = $1.00 USD\n' +
              '*Minimum Purchase:* 5 BOM ($5.00)',
              { parse_mode: 'Markdown' }
            );
            break;
            
          default:
            await ctx.reply('❌ Unknown Mini App action. Please try again.');
        }
      } catch (error) {
        console.error('Mini App error:', error);
        await ctx.reply('❌ Mini App processing error. Please try again later.');
      }
    });
    
    console.log('✅ Mini App setup complete');
  }
  
  async openWalletMiniApp(ctx, section = 'main') {
    try {
      const walletUrl = `https://testweb.maroset.com/wallet${section !== 'main' ? `#${section}` : ''}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp('🔓 Open Botomics Wallet', walletUrl)],
        [Markup.button.callback('📋 Buy BOM Instructions', 'buy_bom_info')],
        [Markup.button.callback('📞 Support', 'contact_support')]
      ]);
      
      await ctx.replyWithMarkdown(
        `💰 *Botomics Wallet*\n\n` +
        `*Access your wallet:*\n\n` +
        `1. Click "Open Botomics Wallet" button below\n` +
        `2. Use the Mini App inside Telegram\n` +
        `3. Manage balance, transactions, and premium\n\n` +
        `*To buy BOM coins:* Contact @BotomicsSupportBot\n\n`,
        keyboard
      );
    } catch (error) {
      console.error('Open wallet mini app error:', error);
      await ctx.reply(
        '❌ Failed to open wallet. Please try again or contact support.'
      );
    }
  }
  
  async redirectToMiniApp(ctx, section) {
    const walletUrl = `https://testweb.maroset.com/wallet#${section}`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.webApp('🔓 Open in Wallet Mini App', walletUrl)],
      [Markup.button.callback('📋 Buy BOM Instructions', 'buy_bom_info')]
    ]);
    
    await ctx.replyWithMarkdown(
      `🔗 *Redirecting to Wallet Mini App*\n\n` +
      `This feature is now available in the Botomics Wallet Mini App.\n\n` +
      `Click the button below to open it inside Telegram:\n\n` +
      `🌐 *URL:* ${walletUrl}`,
      keyboard
    );
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
    
    // Wallet and Premium actions
    this.bot.action('open_wallet', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx);
    });
    
    this.bot.action('open_premium', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx, 'premium');
    });
    
    this.bot.action('buy_bom_info', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        '💰 *Buy BOM Coins*\n\n' +
        'To purchase BOM coins:\n\n' +
        '1. Contact @BotomicsSupportBot\n' +
        '2. Specify amount you want to buy (minimum 5 BOM)\n' +
        '3. Follow payment instructions\n' +
        '4. Submit payment proof\n' +
        '5. Coins will be added after verification\n\n' +
        '*Rate:* 1 BOM = $1.00 USD\n' +
        '*Minimum Purchase:* 5 BOM ($5.00)\n\n' +
        '⚠️ *Only @BotomicsSupportBot is authorized to sell BOM coins*',
        { parse_mode: 'Markdown' }
      );
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
  
  registerWalletCallbacks() {
    console.log('🔄 Registering wallet callbacks...');
    
    // Wallet navigation - redirect to mini app
    this.bot.action('wallet_main', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx);
    });
    
    this.bot.action('wallet_deposit', async (ctx) => {
      await ctx.answerCbQuery();
      await this.redirectToMiniApp(ctx, 'deposit');
    });
    
    this.bot.action('wallet_withdraw', async (ctx) => {
      await ctx.answerCbQuery();
      await this.redirectToMiniApp(ctx, 'withdraw');
    });
    
    this.bot.action('wallet_transfer', async (ctx) => {
      await ctx.answerCbQuery();
      await this.redirectToMiniApp(ctx, 'transfer');
    });
    
    this.bot.action('wallet_history', async (ctx) => {
      await ctx.answerCbQuery();
      await this.redirectToMiniApp(ctx, 'history');
    });
    
    this.bot.action('wallet_premium', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx, 'premium');
    });
    
    this.bot.action('wallet_upgrade_premium', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx, 'premium');
    });
    
    this.bot.action('wallet_cancel_premium', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx, 'premium');
    });
    
    // Deposit actions
    this.bot.action('submit_deposit_proof', async (ctx) => {
      await ctx.answerCbQuery();
      await this.redirectToMiniApp(ctx, 'deposit');
    });
    
    this.bot.action('start_withdrawal', async (ctx) => {
      await ctx.answerCbQuery();
      await this.redirectToMiniApp(ctx, 'withdraw');
    });
    
    this.bot.action('wallet_transfer_start', async (ctx) => {
      await ctx.answerCbQuery();
      await this.redirectToMiniApp(ctx, 'transfer');
    });
    
    // Contact support
    this.bot.action('contact_support', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        '📞 *Botomics Support*\n\n' +
        'For assistance with:\n' +
        '• Buying BOM coins: Contact @BotomicsSupportBot\n' +
        '• Wallet deposits/withdrawals: Use Mini App\n' +
        '• Premium subscriptions: Use Mini App\n' +
        '• Bot creation issues: Use /help command\n' +
        '• Technical problems: Use Mini App support\n\n' +
        'We typically respond within 24 hours.',
        { parse_mode: 'Markdown' }
      );
    });
    
    // Pagination
    this.bot.action(/^wallet_history_(\d+)/, async (ctx) => {
      const page = parseInt(ctx.match[1]);
      await ctx.answerCbQuery();
      await this.redirectToMiniApp(ctx, 'history');
    });
    
    // Admin wallet callbacks
    this.bot.action('admin_pending_deposits', async (ctx) => {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }
      await ctx.answerCbQuery('📥 Loading pending deposits...');
      await this.showPendingDeposits(ctx);
    });
    
    this.bot.action('admin_pending_withdrawals', async (ctx) => {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }
      await ctx.answerCbQuery('📤 Loading pending withdrawals...');
      await this.showPendingWithdrawals(ctx);
    });
    
    this.bot.action('admin_manage_wallet', async (ctx) => {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }
      await ctx.answerCbQuery('👤 Opening wallet management...');
      await this.showWalletManagement(ctx);
    });
    
    this.bot.action('admin_adjust_balance', async (ctx) => {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }
      await ctx.answerCbQuery('🔧 Opening balance adjustment...');
      await this.showBalanceAdjustment(ctx);
    });
    
    this.bot.action('admin_wallet_report', async (ctx) => {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }
      await ctx.answerCbQuery('📊 Generating wallet report...');
      await this.showWalletReport(ctx);
    });
    
    console.log('✅ Wallet callbacks registered');
  }
  
  // Admin wallet management methods
  async showPendingDeposits(ctx) {
    try {
      const pendingDeposits = await WalletService.getPendingDeposits();
      
      let message = `📥 *Pending Deposits*\n\n`;
      
      if (pendingDeposits.length === 0) {
        message += `No pending deposits.\n`;
      } else {
        pendingDeposits.forEach((deposit, index) => {
          const date = new Date(deposit.created_at).toLocaleString();
          message += `${index + 1}. *${date}*\n`;
          message += `   Amount: ${deposit.amount} ${deposit.currency}\n`;
          message += `   User ID: ${deposit.Wallet?.user_id || 'N/A'}\n`;
          message += `   Description: ${deposit.description}\n\n`;
        });
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'admin_pending_deposits')],
        [Markup.button.callback('🔙 Wallet Dashboard', 'admin_wallet')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      console.error('Pending deposits error:', error);
      await ctx.answerCbQuery('❌ Error loading pending deposits');
    }
  }
  
  async showPendingWithdrawals(ctx) {
    try {
      const pendingWithdrawals = await WalletService.getPendingWithdrawals();
      
      let message = `📤 *Pending Withdrawals*\n\n`;
      
      if (pendingWithdrawals.length === 0) {
        message += `No pending withdrawals.\n`;
      } else {
        pendingWithdrawals.forEach((withdrawal, index) => {
          const date = new Date(withdrawal.created_at).toLocaleString();
          message += `${index + 1}. *${date}*\n`;
          message += `   Amount: ${withdrawal.amount} ${withdrawal.currency}\n`;
          message += `   User: ${withdrawal.User?.first_name || 'User'} (${withdrawal.user_id})\n`;
          message += `   Method: ${withdrawal.method}\n`;
          message += `   Details: ${withdrawal.payout_details.substring(0, 50)}...\n\n`;
        });
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'admin_pending_withdrawals')],
        [Markup.button.callback('🔙 Wallet Dashboard', 'admin_wallet')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      console.error('Pending withdrawals error:', error);
      await ctx.answerCbQuery('❌ Error loading pending withdrawals');
    }
  }
  
  async showWalletManagement(ctx) {
    try {
      const message = `👤 *Wallet Management*\n\n` +
        `*Manage user wallets:*\n\n` +
        `Use the following format:\n` +
        `\`/freeze_wallet <user_id> <reason>\`\n` +
        `\`/unfreeze_wallet <user_id>\`\n` +
        `\`/adjust_balance <user_id> <amount> <reason>\`\n\n` +
        `*Examples:*\n` +
        `• Freeze wallet for policy violation:\n` +
        `  \`/freeze_wallet 123456789 "Spam activity"\`\n\n` +
        `• Add 10 BOM to user wallet:\n` +
        `  \`/adjust_balance 123456789 10 "Promotional bonus"\`\n\n` +
        `• Remove 5 BOM from user wallet:\n` +
        `  \`/adjust_balance 123456789 -5 "Refund adjustment"\``;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Wallet Dashboard', 'admin_wallet')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      console.error('Wallet management error:', error);
      await ctx.answerCbQuery('❌ Error loading wallet management');
    }
  }
  
  async showBalanceAdjustment(ctx) {
    try {
      const message = `🔧 *Balance Adjustment*\n\n` +
        `*Format:*\n` +
        `\`/adjust_balance <user_id> <amount> <reason>\`\n\n` +
        `*Parameters:*\n` +
        `• user_id: Telegram user ID\n` +
        `• amount: Positive to add, negative to deduct\n` +
        `• reason: Brief description of adjustment\n\n` +
        `*Examples:*\n` +
        `• Add bonus: \`/adjust_balance 123456789 25 "Welcome bonus"\`\n` +
        `• Deduct fee: \`/adjust_balance 123456789 -5 "Service fee"\`\n\n` +
        `*Note:* All adjustments are logged and require admin authorization.`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Wallet Dashboard', 'admin_wallet')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      console.error('Balance adjustment error:', error);
      await ctx.answerCbQuery('❌ Error loading balance adjustment');
    }
  }
  
  async showWalletReport(ctx) {
    try {
      const stats = await WalletService.getWalletStats();
      
      const message = `📊 *Wallet System Report*\n\n` +
        `*Statistics:*\n` +
        `• Total Wallets: ${stats.totalWallets}\n` +
        `• Active Wallets: ${stats.activeWallets}\n` +
        `• Frozen Wallets: ${stats.frozenWallets}\n` +
        `• Total Balance: ${stats.totalBalance.toFixed(2)} BOM\n\n` +
        `*Financial Summary:*\n` +
        `• Total Deposits: ${stats.totalDeposits.toFixed(2)} BOM\n` +
        `• Total Withdrawals: ${stats.totalWithdrawals.toFixed(2)} BOM\n` +
        `• Net Revenue: ${stats.netRevenue.toFixed(2)} BOM\n\n` +
        `*USD Value (1 BOM = $1.00):*\n` +
        `• Total Balance: $${stats.totalBalance.toFixed(2)}\n` +
        `• Net Revenue: $${stats.netRevenue.toFixed(2)}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'admin_wallet_report')],
        [Markup.button.callback('🔙 Wallet Dashboard', 'admin_wallet')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      console.error('Wallet report error:', error);
      await ctx.answerCbQuery('❌ Error generating wallet report');
    }
  }
  
  privacyHandler = async (ctx) => {
    try {
      const privacyMessage = `🔒 *Privacy Policy - Botomics*\n\n` +
        `*Last Updated: ${new Date().toISOString().split('T')[0]}*\n\n` +
        `*What Botomics Collect:*\n` +
        `• Basic Telegram profile info\n` +
        `• Wallet transaction data\n` +
        `• Bot creation and usage data\n` +
        `• Support communications\n\n` +
        `*How We Use Your Data:*\n` +
        `• To operate and maintain the Botomics platform\n` +
        `• To process wallet transactions\n` +
        `• To provide bot management features\n` +
        `• For customer support\n` +
        `• For service improvements\n\n` +
        `*Data Protection:*\n` +
        `• All data is encrypted at rest\n` +
        `• Database connections use SSL/TLS\n` +
        `• Regular security updates\n` +
        `• Access controls in place\n\n` +
        `*Your Rights:*\n` +
        `• Access your personal data\n` +
        `• Request data deletion\n` +
        `• Opt-out of communications\n\n` +
        `*Contact:*\n` +
        `Questions? Contact @BotomicsSupportBot\n\n` +
        `By using Botomics, you agree to our privacy practices.`;

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
        `We protect your data and only collect necessary information to provide our services.\n\n` +
        `Contact @BotomicsSupportBot for any concerns.`,
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
        `Botomics allows users to create and manage Telegram mini-bots with integrated wallet system.\n\n` +
        `*User Responsibilities:*\n` +
        `• You must own or have permission to use bot tokens\n` +
        `• You are responsible for your mini-bots' actions\n` +
        `• You must comply with Telegram's Terms of Service\n` +
        `• You must not use the service for illegal activities\n\n` +
        `*Wallet Terms:*\n` +
        `• 1 BOM = $1.00 USD fixed rate\n` +
        `• Minimum purchase: 5 BOM ($5.00)\n` +
        `• Minimum withdrawal: 20 BOM ($20.00)\n` +
        `• Processing times: 1-6 hours (deposits), 24 hours (withdrawals)\n` +
        `• Platform may freeze accounts for policy violations\n` +
        `• Only @BotomicsSupportBot is authorized to sell BOM coins\n\n` +
        `*Premium Subscription:*\n` +
        `• Price: 5 BOM per month\n` +
        `• Auto-renewal enabled by default\n` +
        `• Cancel anytime, keep features until billing period ends\n\n` +
        `*Prohibited Uses:*\n` +
        `• Spamming, harassment, or abuse\n` +
        `• Illegal or fraudulent activities\n` +
        `• Money laundering or financial crimes\n` +
        `• Violating Telegram's Terms of Service\n\n` +
        `*Service Limitations:*\n` +
        `• Rate limiting applies to prevent abuse\n` +
        `• Features may change without notice\n` +
        `• Service availability not guaranteed\n\n` +
        `*Termination:*\n` +
        `We may suspend accounts for:\n` +
        `• Terms of Service violations\n` +
        `• Abuse of the service\n` +
        `• Illegal activities\n` +
        `• Fraudulent wallet activity\n\n` +
        `*Disclaimer:*\n` +
        `Service provided "as is" without warranties.\n\n` +
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
        `By using Botomics, you agree to use it responsibly and follow all platform rules.\n\n` +
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
          allowedUpdates: ['message', 'callback_query', 'web_app_data']
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
            console.log('💰 Use /wallet or /premium for Mini App');
            console.log('🔒 Legal: /privacy & /terms available');
            console.log('🛒 Buy BOM: Contact @BotomicsSupportBot');
            console.log('========================================');
            console.log(`🌐 Wallet Mini App: https://testweb.maroset.com/wallet`);
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
        allowedUpdates: ['message', 'callback_query', 'web_app_data']
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