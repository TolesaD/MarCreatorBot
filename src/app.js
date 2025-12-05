// src/app.js - UPDATED WITH INTEGRATED WALLET API
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
const express = require('express');
const path = require('path');
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

// Import Wallet Handler
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
    
    // Create Express app for API endpoints
    this.expressApp = express();
    this.setupExpress();
    this.setupHandlers();
  }
  
  setupExpress() {
    console.log('🔄 Setting up Express server for API...');
    
    // Middleware
    this.expressApp.use(express.json());
    this.expressApp.use(express.urlencoded({ extended: true }));
    
    // Serve wallet static files from root
    this.expressApp.use('/wallet', express.static(path.join(__dirname, '../../wallet')));
    
    // Serve other static files
    this.expressApp.use(express.static('public'));
    
    // Wallet API endpoints
    this.expressApp.get('/api/wallet/health', (req, res) => {
      res.json({ 
        status: 'online', 
        service: 'Botomics Wallet API',
        version: '2.0.0',
        timestamp: new Date().toISOString()
      });
    });
    
    this.expressApp.get('/api/wallet/balance', async (req, res) => {
      try {
        const { userId } = req.query;
        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }
        
        const balance = await WalletService.getBalance(userId);
        res.json(balance);
      } catch (error) {
        console.error('Balance API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    this.expressApp.get('/api/wallet/transactions', async (req, res) => {
      try {
        const { userId, page = 1, limit = 10 } = req.query;
        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }
        
        const history = await WalletService.getTransactionHistory(
          userId, 
          parseInt(limit), 
          (parseInt(page) - 1) * parseInt(limit)
        );
        res.json(history);
      } catch (error) {
        console.error('Transactions API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    this.expressApp.post('/api/wallet/deposit', async (req, res) => {
      try {
        const { userId, amount, description, proofImageUrl } = req.body;
        
        if (!userId || !amount || !proofImageUrl) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = await WalletService.deposit(
          userId, 
          parseFloat(amount), 
          description || `Deposit of ${amount} BOM`,
          proofImageUrl
        );
        
        res.json({
          success: true,
          message: 'Deposit request submitted for verification',
          transaction: result.transaction
        });
      } catch (error) {
        console.error('Deposit API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    this.expressApp.post('/api/wallet/withdraw', async (req, res) => {
      try {
        const { userId, amount, method, payoutDetails } = req.body;
        
        if (!userId || !amount || !method || !payoutDetails) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = await WalletService.requestWithdrawal(
          userId,
          parseFloat(amount),
          method,
          payoutDetails
        );
        
        res.json({
          success: true,
          message: 'Withdrawal request submitted',
          withdrawal: result
        });
      } catch (error) {
        console.error('Withdrawal API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    this.expressApp.post('/api/wallet/transfer', async (req, res) => {
      try {
        const { senderId, receiverId, amount, description } = req.body;
        
        if (!senderId || !receiverId || !amount) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = await WalletService.transfer(
          senderId,
          receiverId,
          parseFloat(amount),
          description || `Transfer of ${amount} BOM`
        );
        
        res.json({
          success: true,
          message: 'Transfer completed',
          transaction: result
        });
      } catch (error) {
        console.error('Transfer API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Subscription API endpoints
    this.expressApp.get('/api/subscription/status', async (req, res) => {
      try {
        const { userId } = req.query;
        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }
        
        const tier = await SubscriptionService.getSubscriptionTier(userId);
        const subscription = await SubscriptionService.getUserSubscription(userId);
        
        res.json({
          tier,
          subscription,
          userId
        });
      } catch (error) {
        console.error('Subscription API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    this.expressApp.post('/api/subscription/upgrade', async (req, res) => {
      try {
        const { userId } = req.body;
        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }
        
        const subscription = await SubscriptionService.upgradeToPremium(userId);
        
        res.json({
          success: true,
          message: 'Premium subscription activated',
          subscription
        });
      } catch (error) {
        console.error('Upgrade API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    this.expressApp.post('/api/subscription/cancel', async (req, res) => {
      try {
        const { userId } = req.body;
        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }
        
        const subscription = await SubscriptionService.cancelSubscription(userId);
        
        res.json({
          success: true,
          message: 'Subscription cancelled',
          subscription
        });
      } catch (error) {
        console.error('Cancel API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Default route
    this.expressApp.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Botomics Platform</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
            h1 { color: #0088cc; }
            .links { margin: 20px 0; }
            a { display: inline-block; margin: 10px; padding: 10px 20px; background: #0088cc; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>🤖 Botomics Platform</h1>
          <p>Telegram bot creation platform with integrated wallet system</p>
          <div class="links">
            <a href="/wallet">💰 Open Wallet</a>
            <a href="https://t.me/BotomicsBot">🤖 Open Bot</a>
            <a href="/api/wallet/health">📊 API Health</a>
          </div>
          <p>Use @BotomicsBot on Telegram to access the full platform.</p>
        </body>
        </html>
      `);
    });
    
    console.log('✅ Express server setup complete');
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
      await this.openWalletMiniApp(ctx);
    });
    
    this.bot.command('premium', async (ctx) => {
      await this.openWalletMiniApp(ctx, 'premium');
    });
    
    this.bot.command('subscription', async (ctx) => {
      await this.openWalletMiniApp(ctx, 'premium');
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
    
    // Use relative URL for Mini App
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
            try {
              await SubscriptionService.upgradeToPremium(userId);
              await ctx.reply(
                '🎉 *Premium Subscription Activated!*\n\n' +
                'Your premium subscription has been successfully activated.\n\n' +
                '*Benefits:*\n' +
                '✅ Unlimited bot creation\n' +
                '✅ Unlimited broadcasts\n' +
                '✅ All premium features unlocked\n\n' +
                'Thank you for upgrading! 🚀',
                { parse_mode: 'Markdown' }
              );
            } catch (error) {
              await ctx.reply(`❌ Error: ${error.message}`);
            }
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
              'Contact: @BotomicsSupportBot\n\n' +
              'We typically respond within 24 hours.',
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
              '4. Submit payment proof in wallet\n' +
              '5. Coins will be added after verification\n\n' +
              '*Rate:* 1 BOM = $1.00 USD\n' +
              '*Minimum Purchase:* 5 BOM ($5.00)',
              { parse_mode: 'Markdown' }
            );
            break;
            
          default:
            await ctx.reply('✅ Action processed in wallet Mini App.');
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
        `*To buy BOM coins:* Contact @BotomicsSupportBot\n\n` +
        `*Features:*\n` +
        `• View balance & transaction history\n` +
        `• Deposit & withdraw BOM coins\n` +
        `• Transfer BOM to other users\n` +
        `• Manage premium subscription\n`,
        keyboard
      );
    } catch (error) {
      console.error('Open wallet mini app error:', error);
      await ctx.reply(
        '❌ Failed to open wallet. Please try again or contact support.'
      );
    }
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
    
    // Wallet actions
    this.bot.action('open_wallet', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx);
    });
    
    this.bot.action('buy_bom_info', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        '💰 *Buy BOM Coins*\n\n' +
        'To purchase BOM coins:\n\n' +
        '1. Contact @BotomicsSupportBot\n' +
        '2. Specify amount you want to buy (minimum 5 BOM)\n' +
        '3. Follow payment instructions\n' +
        '4. Submit payment proof in wallet\n' +
        '5. Coins will be added after verification\n\n' +
        '*Rate:* 1 BOM = $1.00 USD\n' +
        '*Minimum Purchase:* 5 BOM ($5.00)\n\n' +
        '⚠️ *Only @BotomicsSupportBot is authorized to sell BOM coins*',
        { parse_mode: 'Markdown' }
      );
    });
    
    this.bot.action('contact_support', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        '📞 *Botomics Support*\n\n' +
        'For assistance with:\n' +
        '• Buying BOM coins: Contact @BotomicsSupportBot\n' +
        '• Wallet deposits/withdrawals: Use Mini App\n' +
        '• Premium subscriptions: Use Mini App\n' +
        '• Bot creation issues: Use /help command\n' +
        '• Technical problems: Contact @BotomicsSupportBot\n\n' +
        'We typically respond within 24 hours.',
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
    
    // Wallet navigation
    this.bot.action('wallet_main', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx);
    });
    
    this.bot.action('wallet_deposit', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx, 'deposit');
    });
    
    this.bot.action('wallet_withdraw', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx, 'withdraw');
    });
    
    this.bot.action('wallet_transfer', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx, 'transfer');
    });
    
    this.bot.action('wallet_history', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx, 'history');
    });
    
    this.bot.action('wallet_premium', async (ctx) => {
      await ctx.answerCbQuery();
      await this.openWalletMiniApp(ctx, 'premium');
    });
    
    // Admin wallet callbacks
    this.bot.action('admin_pending_deposits', async (ctx) => {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }
      await ctx.answerCbQuery('📥 Loading pending deposits...');
      await WalletHandler.showPendingDeposits(ctx);
    });
    
    this.bot.action('admin_pending_withdrawals', async (ctx) => {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Admin access required');
        return;
      }
      await ctx.answerCbQuery('📤 Loading pending withdrawals...');
      await WalletHandler.showPendingWithdrawals(ctx);
    });
    
    console.log('✅ Wallet callbacks registered');
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
  
  async start() {
    console.log('🚀 Starting MetaBot Creator...');
    
    try {
      // Start Express server for API
      const PORT = process.env.PORT || 3000;
      this.expressApp.listen(PORT, () => {
        console.log(`🌐 Express server running on port ${PORT}`);
        console.log(`📱 Wallet: http://localhost:${PORT}/wallet`);
        console.log(`⚡ API: http://localhost:${PORT}/api/wallet/health`);
      });
      
      // Start mini-bots
      console.log('\n🚀 Starting mini-bots initialization...');
      const miniBotsResult = await MiniBotManager.initializeAllBots();
      console.log(`✅ ${miniBotsResult} mini-bots initialized`);
      
      // Start main Telegram bot
      console.log('\n🤖 Starting main Telegram bot...');
      await this.bot.launch({
        dropPendingUpdates: true,
        allowedUpdates: ['message', 'callback_query', 'web_app_data']
      });
      
      console.log('\n🎉 MetaBot Creator is now RUNNING!');
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
      
    } catch (error) {
      console.error('❌ Failed to start application:', error);
    }
    
    // Graceful shutdown
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
    await app.start();
    
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