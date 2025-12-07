// ALWAYS load dotenv first (won't hurt if file doesn't exist)
try {
  require('dotenv').config();
} catch (e) {
  console.log('📝 No .env file found, using environment variables only');
}

console.log('🔍 DEBUGGING STARTUP ON RAILWAY');
console.log('================================');
console.log('📋 Environment check:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   PORT:', process.env.PORT);
console.log('   HOST:', process.env.HOST);
console.log('   RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('   BOT_TOKEN:', process.env.BOT_TOKEN ? 'SET' : 'NOT SET');

// Check for required variables IMMEDIATELY
const requiredVars = ['BOT_TOKEN', 'DATABASE_URL', 'ENCRYPTION_KEY'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  console.error('💡 How to fix on Railway:');
  console.error('   1. Go to Railway Dashboard → Your Project → Variables');
  console.error('   2. Add the missing environment variables');
  console.error('   3. Redeploy your application');
  process.exit(1);
}

console.log('✅ All required environment variables found!');

// Now load dependencies
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');
const cors = require('cors');

// Create config AFTER environment check
const createConfig = require('../config/environment');
const config = createConfig();

console.log('🚀 Starting main app...');
console.log('🚀 Production mode - Using Railway environment variables');
console.log('🔧 Loading environment configuration...');
console.log('   Environment:', config.NODE_ENV);
console.log('   Platform:', config.IS_RAILWAY ? 'Railway 🚂' : 'Local');
console.log('   Port:', config.PORT);
console.log('✅ Running on Railway.com deployment');
const { connectDB } = require('../database/db');
const MiniBotManager = require('./services/MiniBotManager');

// Import handlers
const { startHandler, helpHandler, featuresHandler } = require('./handlers/startHandler');
const { createBotHandler, handleTokenInput, handleNameInput, cancelCreationHandler, isInCreationSession, getCreationStep } = require('./handlers/createBotHandler');
const { myBotsHandler } = require('./handlers/myBotsHandler');
const PlatformAdminHandler = require('./handlers/platformAdminHandler');
const WalletHandler = require('./handlers/walletHandler');

// Import routes
const walletRoutes = require('./routes/walletRoutes');

// Import cron jobs
const SubscriptionCron = require('./services/subscriptionCron'); // NEW

// ==================== DYNAMIC URL HANDLING FOR RAILWAY ====================
// Get Railway public URL (auto-detected on every redeploy)
const getRailwayPublicUrl = () => {
  // Railway provides these environment variables
  if (process.env.RAILWAY_PUBLIC_URL) {
    return process.env.RAILWAY_PUBLIC_URL;
  }
  
  if (process.env.RAILWAY_STATIC_URL) {
    return process.env.RAILWAY_STATIC_URL;
  }
  
  // For service deployments (newer Railway)
  const serviceName = process.env.RAILWAY_SERVICE_NAME;
  const projectName = process.env.RAILWAY_PROJECT_NAME;
  
  if (serviceName && projectName) {
    return `https://${serviceName}-${projectName}.up.railway.app`;
  }
  
  // Development fallback
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // Fallback - this will log so you know to update it
  const fallbackUrl = 'https://botomics-production.up.railway.app';
  console.warn(`⚠️  No Railway URL detected, using fallback: ${fallbackUrl}`);
  return fallbackUrl;
};

const PUBLIC_URL = getRailwayPublicUrl();
console.log(`🌐 Public URL detected: ${PUBLIC_URL}`);

class MetaBotCreator {
  constructor() {
    if (!config.BOT_TOKEN) {
      console.error('❌ BOT_TOKEN is not set');
      console.error('💡 Add BOT_TOKEN to Railway Variables');
      process.exit(1);
    }
    
    console.log(`🤖 Creating bot instance with token: ${config.BOT_TOKEN.substring(0, 10)}...`);
    console.log('🚀 Optimized for Railway.com deployment');
    
    this.bot = new Telegraf(config.BOT_TOKEN, {
      handlerTimeout: 90000,
      telegram: {
        apiRoot: 'https://api.telegram.org',
        agent: null
      }
    });
    
    this.expressApp = express();
    this.setupExpress();
    this.setupHandlers();
  }
  
  setupExpress() {
    console.log('🔄 Setting up Express server for API...');
    
    // Middleware
    this.expressApp.use(cors());
    this.expressApp.use(express.json());
    this.expressApp.use(express.urlencoded({ extended: true }));
    
    // Wallet API Routes - CRITICAL FOR MINI-APP
    this.expressApp.use('/api', walletRoutes);
    console.log('✅ Wallet API routes registered at /api');
    
    // Static files for wallet mini-app
    const walletPath = path.join(__dirname, '../../wallet');
    console.log(`📱 Serving wallet mini-app from: ${walletPath}`);
    
    this.expressApp.use('/wallet', express.static(walletPath));
    
    // Make sure index.html is served at root path
    this.expressApp.get('/wallet', (req, res) => {
      res.sendFile(path.join(walletPath, 'index.html'));
    });
    
    // Update config with current URL for Railway
    config.APP_URL = PUBLIC_URL;
    config.WALLET_URL = `${PUBLIC_URL}/wallet`;
    
    // API endpoint to get current public URL (used by mini-app)
    this.expressApp.get('/api/public-url', (req, res) => {
      const walletUrl = `${PUBLIC_URL}/wallet`;
      res.json({ 
        publicUrl: PUBLIC_URL,
        walletUrl: walletUrl,
        apiUrl: `${PUBLIC_URL}/api`,
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString(),
        platform: 'railway'
      });
    });
    
    // Test endpoint for Railway
    this.expressApp.get('/api/test-railway', (req, res) => {
      res.json({
        success: true,
        message: 'Railway deployment working!',
        publicUrl: PUBLIC_URL,
        walletUrl: `${PUBLIC_URL}/wallet`,
        environment: process.env.NODE_ENV,
        railway: {
          environment: process.env.RAILWAY_ENVIRONMENT,
          serviceName: process.env.RAILWAY_SERVICE_NAME,
          projectName: process.env.RAILWAY_PROJECT_NAME,
          publicUrl: process.env.RAILWAY_PUBLIC_URL,
          staticUrl: process.env.RAILWAY_STATIC_URL
        },
        timestamp: new Date().toISOString()
      });
    });
    
    // Health endpoints
    this.expressApp.get('/api/health', (req, res) => {
      res.json({ 
        status: 'online', 
        service: 'Botomics Platform',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
        platform: 'Railway',
        publicUrl: PUBLIC_URL,
        walletUrl: `${PUBLIC_URL}/wallet`
      });
    });
    
    this.expressApp.get('/api/wallet/health', (req, res) => {
      res.json({ 
        status: 'online', 
        service: 'Botomics Wallet API',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        publicUrl: PUBLIC_URL
      });
    });
    
    // Root endpoint with platform info
    this.expressApp.get('/', (req, res) => {
      const walletUrl = config.WALLET_URL || `${req.protocol}://${req.get('host')}/wallet`;
      const botUrl = `https://t.me/${config.MAIN_BOT_USERNAME.replace('@', '')}`;
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Botomics Platform - Railway</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; text-align: center; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #0088cc; margin-bottom: 10px; }
            .status { background: #4CAF50; color: white; padding: 5px 10px; border-radius: 5px; display: inline-block; margin-bottom: 20px; }
            .links { margin: 30px 0; }
            a { display: inline-block; margin: 10px; padding: 12px 24px; background: #0088cc; color: white; text-decoration: none; border-radius: 5px; transition: background 0.3s; }
            a:hover { background: #006699; }
            .info { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: left; }
            .railway-badge { background: #0a0a0a; color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; margin-left: 10px; }
            .api-endpoints { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: left; font-family: monospace; font-size: 14px; }
            .admin-info { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: left; border-left: 4px solid #ffc107; }
            .url-info { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: left; border-left: 4px solid #4CAF50; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🤖 Botomics Platform <span class="railway-badge">Railway</span></h1>
            <div class="status">🚀 Online & Running</div>
            <p>Telegram bot creation platform with integrated wallet system</p>
            
            <div class="url-info">
              <strong>🌐 Current URLs:</strong><br>
              • Public URL: ${PUBLIC_URL}<br>
              • Wallet Mini-App: ${walletUrl}<br>
              • API Base: ${PUBLIC_URL}/api<br>
              • Health Check: ${PUBLIC_URL}/api/health<br>
              • Railway Test: ${PUBLIC_URL}/api/test-railway
            </div>
            
            <div class="info">
              <strong>Platform Status:</strong><br>
              • Environment: ${config.NODE_ENV}<br>
              • Database: ${config.DATABASE_URL ? 'Connected ✓' : 'Not Connected ✗'}<br>
              • Wallet: ${walletUrl ? 'Available ✓' : 'Not Available ✗'}<br>
              • Server Time: ${new Date().toISOString()}<br>
              • Railway Environment: ${process.env.RAILWAY_ENVIRONMENT || 'Production'}
            </div>
            
            <div class="admin-info">
              <strong>🤫 Admin Commands (Platform Creator Only):</strong><br>
              • <code>/platform</code> - Platform admin dashboard<br>
              • <code>/admin_wallet</code> - Wallet admin dashboard<br>
              • <code>/add_bom &lt;user&gt; &lt;amount&gt;</code> - Add BOM to user<br>
              • <code>/freeze_wallet &lt;user&gt; &lt;reason&gt;</code> - Freeze wallet<br>
              • <code>/unfreeze_wallet &lt;user&gt;</code> - Unfreeze wallet<br>
              • <code>/grant_premium &lt;user&gt; &lt;days&gt;</code> - Grant premium<br>
              • Use Telegram bot for full admin interface
            </div>
            
            <div class="api-endpoints">
              <strong>API Endpoints:</strong><br>
              • <a href="/api/health">/api/health</a> - Health check<br>
              • <a href="/api/wallet/health">/api/wallet/health</a> - Wallet health<br>
              • <a href="/api/public-url">/api/public-url</a> - Get current URLs<br>
              • <a href="/api/test-railway">/api/test-railway</a> - Railway test<br>
              • <a href="/wallet">/wallet</a> - Wallet Mini-App<br>
              • /api/wallet/balance - Get balance<br>
              • /api/wallet/transactions - Transaction history
            </div>
            
            <div class="links">
              <a href="${walletUrl}">💰 Open Wallet</a>
              <a href="${botUrl}">🤖 Open Telegram Bot</a>
              <a href="/api/health">📊 API Health Check</a>
              <a href="https://railway.app">🚂 Railway Dashboard</a>
              <a href="/api/test-railway">🧪 Railway Test</a>
            </div>
            
            <p>Use ${config.MAIN_BOT_USERNAME} on Telegram to access the full platform.</p>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              Deployed on Railway • Node.js ${process.version} • ${process.platform}<br>
              URLs auto-update on Railway redeployments
            </p>
          </div>
        </body>
        </html>
      `);
    });
    
    console.log('✅ Express server setup complete');
  }
  
  setupHandlers() {
    console.log('🔄 Setting up bot handlers...');
    
    this.setupMiniApp();
    
    // Global middleware for all updates
    this.bot.use(async (ctx, next) => {
      ctx.isMainBot = true;
      ctx.miniBotManager = this;
      
      if (PlatformAdminHandler.isPlatformCreator(ctx.from?.id)) {
        return next();
      }
      
      if (ctx.from && await PlatformAdminHandler.checkUserBan(ctx.from.id)) {
        await ctx.reply('🚫 Your account has been banned from using this platform.');
        return;
      }
      
      return next();
    });
    
    // Basic commands
    this.bot.start(startHandler);
    this.bot.help(helpHandler);
    this.bot.command('privacy', this.privacyHandler);
    this.bot.command('terms', this.termsHandler);
    
    // Wallet commands
    this.bot.command('wallet', async (ctx) => {
      await this.openWalletMiniApp(ctx);
    });
    
    this.bot.command('balance', async (ctx) => {
      await WalletHandler.handleWalletCommand(ctx);
    });
    
    this.bot.command('premium', async (ctx) => {
      await this.openWalletMiniApp(ctx, 'premium');
    });
    
    this.bot.command('subscription', async (ctx) => {
      await this.openWalletMiniApp(ctx, 'premium');
    });
    
    // Bot management commands
    this.bot.command('createbot', createBotHandler);
    this.bot.command('mybots', myBotsHandler);
    this.bot.command('cancel', cancelCreationHandler);
    
    // Platform admin commands - NOW WITH WALLET INTEGRATION
    this.bot.command('platform', async (ctx) => {
      if (PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.platformDashboard(ctx);
      } else {
        ctx.reply('❌ Platform admin access required.');
      }
    });
    
    // Admin wallet commands - UPDATED: Now integrated into PlatformAdminHandler
    this.bot.command('admin_wallet', async (ctx) => {
      if (PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.walletAdminDashboard(ctx);
      } else {
        ctx.reply('❌ Admin access required.');
      }
    });
    
    this.bot.command('add_bom', async (ctx) => {
      if (PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.startAddBOM(ctx);
      } else {
        ctx.reply('❌ Admin access required.');
      }
    });
    
    this.bot.command('freeze_wallet', async (ctx) => {
      if (PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.startFreezeWallet(ctx);
      } else {
        ctx.reply('❌ Admin access required.');
      }
    });
    
    this.bot.command('unfreeze_wallet', async (ctx) => {
      if (PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.startUnfreezeWallet(ctx);
      } else {
        ctx.reply('❌ Admin access required.');
      }
    });
    
    this.bot.command('grant_premium', async (ctx) => {
      if (PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.startGrantPremium(ctx);
      } else {
        ctx.reply('❌ Admin access required.');
      }
    });
    
    this.bot.command('subscription_admin', async (ctx) => {
      if (PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.subscriptionAdminDashboard(ctx);
      } else {
        ctx.reply('❌ Admin access required.');
      }
    });
    
    // Quick admin commands with arguments
    this.bot.command('addbom', async (ctx) => {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Admin access required.');
        return;
      }
      
      const args = ctx.message.text.split(' ');
      if (args.length < 3) {
        await ctx.reply('Usage: /addbom <user_id> <amount>');
        await PlatformAdminHandler.startAddBOM(ctx);
        return;
      }
      
      // Quick add BOM with arguments
      try {
        const userIdentifier = args[1];
        const amount = parseFloat(args[2]);
        
        if (!amount || amount <= 0 || isNaN(amount)) {
          await ctx.reply('❌ Invalid amount. Please enter a positive number.');
          return;
        }
        
        // Find user
        let userId;
        if (isNaN(userIdentifier)) {
          const username = userIdentifier.replace('@', '').trim();
          const user = await require('./models').User.findOne({ where: { username: username } });
          if (!user) {
            await ctx.reply('❌ User not found. Please check the ID or username.');
            return;
          }
          userId = user.telegram_id;
        } else {
          userId = parseInt(userIdentifier);
        }
        
        const WalletService = require('./services/walletService');
        const result = await WalletService.adminAdjustBalance(
          userId, 
          amount, 
          'Quick admin BOM addition', 
          ctx.from.id
        );
        
        await ctx.reply(
          `✅ *BOM Added Successfully!*\n\n` +
          `*User ID:* ${userId}\n` +
          `*Amount Added:* ${amount.toFixed(2)} BOM\n` +
          `*New Balance:* ${result.newBalance.toFixed(2)} BOM\n` +
          `*Transaction ID:* ${result.transaction.id}`,
          { parse_mode: 'Markdown' }
        );
        
      } catch (error) {
        console.error('Quick add BOM error:', error);
        await ctx.reply(`❌ Error: ${error.message}`);
      }
    });
    
    // Debug and maintenance commands
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
    
    // Wallet debug command
    this.bot.command('wallet_debug', async (ctx) => {
      try {
        const userId = ctx.from.id;
        const balance = await require('./services/walletService').getBalance(userId);
        const subscription = await require('./services/subscriptionService').getSubscriptionTier(userId);
        
        await ctx.replyWithMarkdown(
          `🔍 *Wallet Debug Info*\n\n` +
          `*User ID:* ${userId}\n` +
          `*Balance:* ${balance.balance.toFixed(2)} ${balance.currency}\n` +
          `*Status:* ${balance.isFrozen ? 'Frozen ❄️' : 'Active ✅'}\n` +
          `*Subscription:* ${subscription}\n` +
          `*Wallet Address:* BOTOMICS_${userId}\n\n` +
          `*Current Platform URL:* ${PUBLIC_URL}\n` +
          `*Wallet URL:* ${PUBLIC_URL}/wallet`
        );
      } catch (error) {
        console.error('Wallet debug error:', error);
        await ctx.reply(`❌ Debug error: ${error.message}`);
      }
    });
    
    // Railway URL command
    this.bot.command('railway_url', async (ctx) => {
      try {
        await ctx.replyWithMarkdown(
          `🌐 *Current Platform URLs*\n\n` +
          `*Public URL:* ${PUBLIC_URL}\n` +
          `*Wallet Mini-App:* ${PUBLIC_URL}/wallet\n` +
          `*API Base:* ${PUBLIC_URL}/api\n\n` +
          `*Save these URLs:*\n` +
          `• Wallet bookmark: ${PUBLIC_URL}/wallet\n` +
          `• Health check: ${PUBLIC_URL}/api/health\n` +
          `• Railway test: ${PUBLIC_URL}/api/test-railway\n\n` +
          `*Note:* URLs auto-update on Railway redeployments.`
        );
      } catch (error) {
        console.error('Railway URL command error:', error);
        await ctx.reply(`❌ Error getting URLs: ${error.message}`);
      }
    });
    
    // Text message handler
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const messageText = ctx.message.text;
      
      // Platform admin session (now includes wallet admin)
      if (PlatformAdminHandler.isInPlatformAdminSession(userId)) {
        await PlatformAdminHandler.handlePlatformAdminInput(ctx);
        return;
      }
      
      // Cancel creation
      if (messageText === '🚫 Cancel Creation') {
        await cancelCreationHandler(ctx);
        return;
      }
      
      // Bot creation session
      if (isInCreationSession(userId)) {
        const step = getCreationStep(userId);
        if (step === 'awaiting_token') {
          await handleTokenInput(ctx);
        } else if (step === 'awaiting_name') {
          await handleNameInput(ctx);
        }
        return;
      }
      
      // Quick actions via text
      if (messageText.toLowerCase() === 'wallet' || messageText === '💰 wallet') {
        await this.openWalletMiniApp(ctx);
        return;
      }
      
      if (messageText.toLowerCase() === 'premium' || messageText === '🎫 premium') {
        await this.openWalletMiniApp(ctx, 'premium');
        return;
      }
      
      if (messageText.toLowerCase() === 'balance' || messageText === '💰 balance') {
        await WalletHandler.handleWalletCommand(ctx);
        return;
      }
      
      if (messageText.toLowerCase() === 'railway' || messageText === '🚂 railway') {
        await ctx.replyWithMarkdown(
          `🚂 *Railway Platform Info*\n\n` +
          `*Current URL:* ${PUBLIC_URL}\n` +
          `*Wallet:* ${PUBLIC_URL}/wallet\n` +
          `*Environment:* ${process.env.RAILWAY_ENVIRONMENT || 'Production'}\n\n` +
          `URLs update automatically on redeployment.`
        );
        return;
      }
      
      // Admin quick access
      if (PlatformAdminHandler.isPlatformCreator(userId)) {
        if (messageText.toLowerCase() === 'admin' || messageText === '👑 admin') {
          await PlatformAdminHandler.platformDashboard(ctx);
          return;
        }
        
        if (messageText.toLowerCase() === 'admin wallet' || messageText === '🏦 admin wallet') {
          await PlatformAdminHandler.walletAdminDashboard(ctx);
          return;
        }
      }
      
      // Default to start handler
      await startHandler(ctx);
    });
    
    // Setup callback handlers
    this.setupCallbackHandlers();
    
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

  setupMiniApp() {
    console.log('🔄 Setting up Mini App for Railway...');
    
    // Get current public URL (dynamic for Railway)
    const walletUrl = config.WALLET_URL || `${PUBLIC_URL}/wallet`;
    
    console.log(`📱 Mini App URL: ${walletUrl}`);
    console.log(`🌐 Public API URL: ${PUBLIC_URL}`);
    
    // Set chat menu button with dynamic URL
    this.bot.telegram.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '💰 Botomics Wallet',
        web_app: { url: walletUrl }
      }
    }).catch(err => {
      console.warn('⚠️  Could not set menu button (may not have permission):', err.message);
    });
    
    console.log(`✅ Mini App configured for Railway deployment`);
    
    // Update the config for use in other handlers
    config.WALLET_URL = walletUrl;
    
    // Handle web app data from mini-app
    this.bot.on('web_app_data', async (ctx) => {
      try {
        const data = JSON.parse(ctx.webAppData.data);
        console.log('📱 Mini App data received:', data.action);
        
        const userId = ctx.from.id;
        
        switch (data.action) {
          case 'get_balance':
            const walletService = require('./services/walletService');
            const balance = await walletService.getBalance(userId);
            await ctx.reply(
              `💰 *Your Wallet Balance*\n\n` +
              `*Balance:* ${balance.balance.toFixed(2)} ${balance.currency}\n` +
              `*Status:* ${balance.isFrozen ? '❄️ Frozen' : '✅ Active'}\n` +
              `*Address:* BOTOMICS_${userId}\n\n` +
              `*1 BOM = $1.00 USD*`,
              { parse_mode: 'Markdown' }
            );
            break;
            
          case 'get_public_url':
            // Send current public URL to mini-app
            await ctx.reply(
              `🌐 *Current Platform URL*\n\n` +
              `*Public URL:* ${PUBLIC_URL}\n` +
              `*Wallet URL:* ${walletUrl}\n` +
              `*API Base:* ${PUBLIC_URL}/api\n` +
              `*Environment:* ${process.env.NODE_ENV || 'production'}\n\n` +
              `Bookmark this for direct access to your wallet.`,
              { parse_mode: 'Markdown' }
            );
            break;
            
          case 'premium_upgrade':
            try {
              await require('./services/subscriptionService').upgradeToPremium(userId);
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
              '*Minimum Purchase:* 5 BOM ($5.00)\n' +
              '*Wallet Address:* BOTOMICS_${userId}',
              { parse_mode: 'Markdown' }
            );
            break;
            
          case 'deposit_submitted':
            await ctx.reply(
              '✅ *Deposit Request Submitted*\n\n' +
              'Your deposit request has been received.\n\n' +
              'An admin will verify your payment proof and add the BOM to your wallet within 1-6 hours.\n\n' +
              'You will receive a notification when it\'s processed.',
              { parse_mode: 'Markdown' }
            );
            break;
            
          case 'withdrawal_requested':
            await ctx.reply(
              '✅ *Withdrawal Request Submitted*\n\n' +
              'Your withdrawal request has been received.\n\n' +
              'It will be processed within 24 hours.\n\n' +
              'You will receive a notification when it\'s completed.',
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
    // Get dynamic URL for Railway
    const walletUrl = config.WALLET_URL || `${PUBLIC_URL}/wallet`;
    const fullUrl = section !== 'main' ? `${walletUrl}#${section}` : walletUrl;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.webApp('🔓 Open Botomics Wallet', fullUrl)],
      [Markup.button.callback('💰 Check Balance', 'wallet_main')],
      [Markup.button.callback('📋 Buy BOM Instructions', 'buy_bom_info')],
      [Markup.button.callback('📞 Support', 'contact_support')]
    ]);
    
    // SIMPLIFIED MESSAGE - NO MARKDOWN FORMATTING ISSUES
    const message = 
      '💰 Botomics Wallet\n\n' +
      'Access your wallet:\n\n' +
      '1. Click "Open Botomics Wallet" button below\n' +
      '2. Use the Mini App inside Telegram\n' +
      '3. Manage balance, transactions, and premium\n\n' +
      'Your Wallet Address: BOTOMICS_' + ctx.from.id + '\n' +
      'Current Wallet URL: ' + walletUrl + '\n\n' +
      'To buy BOM coins: Contact @BotomicsSupportBot\n\n' +
      'Features:\n' +
      '• View balance & transaction history\n' +
      '• Deposit & withdraw BOM coins\n' +
      '• Transfer BOM to other users\n' +
      '• Manage premium subscription';
    
    await ctx.reply(message, keyboard);
    
  } catch (error) {
    console.error('Open wallet mini app error:', error);
    // Try a simpler fallback
    try {
      await ctx.reply(
        '💰 Open your wallet by clicking the menu button below 👇',
        Markup.inlineKeyboard([
          [Markup.button.webApp('Open Wallet', config.WALLET_URL || `${PUBLIC_URL}/wallet`)]
        ])
      );
    } catch (fallbackError) {
      await ctx.reply('❌ Failed to open wallet. Please try again or contact support.');
    }
  }
}
  
  setupCallbackHandlers() {
    console.log('🔄 Setting up main bot callback handlers...');
    
    // Register callbacks from handlers
    PlatformAdminHandler.registerCallbacks(this.bot);
    
    // Basic navigation
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
    
    // Wallet callbacks
    this.bot.action('wallet_main', async (ctx) => {
      await ctx.answerCbQuery();
      await WalletHandler.handleWalletCommand(ctx);
    });
    
    this.bot.action('wallet_deposit', async (ctx) => {
      await ctx.answerCbQuery();
      await WalletHandler.handleDeposit(ctx);
    });
    
    this.bot.action('wallet_withdraw', async (ctx) => {
      await ctx.answerCbQuery();
      await WalletHandler.handleWithdraw(ctx);
    });
    
    this.bot.action('wallet_transfer', async (ctx) => {
      await ctx.answerCbQuery();
      await WalletHandler.handleTransfer(ctx);
    });
    
    this.bot.action('wallet_premium', async (ctx) => {
      await ctx.answerCbQuery();
      await WalletHandler.handlePremium(ctx);
    });
    
    this.bot.action('wallet_history', async (ctx) => {
      await ctx.answerCbQuery();
      await WalletHandler.handleHistory(ctx, 0);
    });
    
    this.bot.action(/wallet_history_(\d+)/, async (ctx) => {
      const page = parseInt(ctx.match[1]);
      await ctx.answerCbQuery();
      await WalletHandler.handleHistory(ctx, page);
    });
    
    this.bot.action('wallet_upgrade_premium', async (ctx) => {
      await ctx.answerCbQuery();
      await WalletHandler.handleUpgradePremium(ctx);
    });
    
    this.bot.action('wallet_cancel_premium', async (ctx) => {
      await ctx.answerCbQuery();
      await WalletHandler.handleCancelPremium(ctx);
    });
    
    // Railway and URL callbacks
    this.bot.action('get_public_url', async (ctx) => {
      await ctx.answerCbQuery();
      const walletUrl = config.WALLET_URL || `${PUBLIC_URL}/wallet`;
      
      await ctx.replyWithMarkdown(
        `🌐 *Current Platform URLs*\n\n` +
        `*Public URL:* ${PUBLIC_URL}\n` +
        `*Wallet Mini-App:* ${walletUrl}\n` +
        `*API Base:* ${PUBLIC_URL}/api\n\n` +
        `*Save these URLs:*\n` +
        `• Wallet bookmark: ${walletUrl}\n` +
        `• Health check: ${PUBLIC_URL}/api/health\n` +
        `• Railway test: ${PUBLIC_URL}/api/test-railway\n\n` +
        `*Note:* URLs update automatically on Railway redeployments.`
      );
    });
    
    this.bot.action('railway_info', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.replyWithMarkdown(
        `🚂 *Railway Platform Info*\n\n` +
        `*Current URL:* ${PUBLIC_URL}\n` +
        `*Wallet:* ${PUBLIC_URL}/wallet\n` +
        `*API:* ${PUBLIC_URL}/api\n` +
        `*Environment:* ${process.env.RAILWAY_ENVIRONMENT || 'Production'}\n\n` +
        `*Auto-update:* URLs update on redeployment\n` +
        `*Mini-app:* Served from /wallet folder\n` +
        `*Database:* Railway PostgreSQL\n\n` +
        `Use /railway_url command anytime to see current URLs.`
      );
    });
    
    // Support and info
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
    
    // Terms and privacy
    this.bot.action('privacy_policy', async (ctx) => {
      await ctx.answerCbQuery();
      await this.privacyHandler(ctx);
    });
    
    this.bot.action('terms_of_service', async (ctx) => {
      await ctx.answerCbQuery();
      await this.termsHandler(ctx);
    });
    
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
    
    // No-op for disabled buttons
    this.bot.action('noop', async (ctx) => {
      await ctx.answerCbQuery();
    });
    
    console.log('✅ Main bot callback handlers setup complete');
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
        `• Price: 3 BOM per month or 30 BOM per year\n` +
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
      console.log('🔄 Starting MetaBot Creator initialization...');
      console.log('🗄️ Connecting to Railway PostgreSQL database...');
      await connectDB();
      
      // Update wallet schema if needed (optional - script might not exist)
      try {
        const { addWalletAddressField } = require('../../scripts/add_wallet_address');
        await addWalletAddressField();
        console.log('✅ Wallet schema updated');
      } catch (error) {
        console.log('⚠️  Wallet address script not found or failed, continuing...');
        console.log('   Error:', error.message);
      }
      
      console.log('✅ MetaBot Creator initialized successfully');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
    }
  }
  
  async start() {
    console.log('🚀 Starting MetaBot Creator on Railway...');
    
    try {
      const PORT = config.PORT;
      const HOST = config.HOST;
      
      // Start Express server
      this.expressApp.listen(PORT, HOST, () => {
        console.log(`🌐 Express server running on ${HOST}:${PORT}`);
        console.log(`📱 Wallet: ${config.WALLET_URL || `http://${HOST}:${PORT}/wallet`}`);
        console.log(`⚡ API: ${config.APP_URL || `http://${HOST}:${PORT}`}/api/health`);
        console.log(`🚀 Railway Environment: ${process.env.RAILWAY_ENVIRONMENT || 'Production'}`);
        console.log(`🌐 Public URL: ${PUBLIC_URL}`);
      });
      
      // Start subscription auto-renewal cron jobs
      console.log('\n⏰ Starting subscription cron jobs...');
      SubscriptionCron.start();
      console.log('✅ Subscription auto-renewal system started');
      
      // Initialize mini-bots
      console.log('\n🚀 Starting mini-bots initialization...');
      const miniBotsResult = await MiniBotManager.initializeAllBots();
      console.log(`✅ ${miniBotsResult} mini-bots initialized`);
      
      // Start main Telegram bot
      console.log('\n🤖 Starting main Telegram bot...');
      await this.bot.launch({
        dropPendingUpdates: true,
        allowedUpdates: ['message', 'callback_query', 'web_app_data']
      });
      
      // Success message
      console.log('\n🎉 MetaBot Creator is now RUNNING on Railway!');
      console.log('===============================================');
      console.log('🚂 Platform: Railway');
      console.log('🌐 Public URL:', PUBLIC_URL);
      console.log('📱 Wallet URL:', PUBLIC_URL + '/wallet');
      console.log('🤖 Main Bot: Manages bot creation & wallet');
      console.log('🤖 Mini-bots: Handle user messages');
      console.log('💰 Botomics: Digital currency system');
      console.log('🎫 Premium: Subscription tiers (3 BOM/month)');
      console.log('⏰ Auto-renewal: Enabled (daily cron)');
      console.log('🏦 ADMIN WALLET COMMANDS (Platform Creator Only):');
      console.log('   /platform - Platform admin dashboard');
      console.log('   /admin_wallet - Wallet admin dashboard');
      console.log('   /add_bom - Add BOM to user');
      console.log('   /freeze_wallet - Freeze user wallet');
      console.log('   /unfreeze_wallet - Unfreeze user wallet');
      console.log('   /grant_premium - Grant premium subscription');
      console.log('   /subscription_admin - Subscription admin');
      console.log('   /addbom <user> <amount> - Quick add BOM');
      console.log('   /railway_url - Show current Railway URLs');
      console.log('===============================================');
      console.log(`🌐 Dashboard: ${PUBLIC_URL}`);
      console.log(`💰 Wallet: ${PUBLIC_URL}/wallet`);
      console.log(`💳 BOM Rate: 1 BOM = $1.00 USD`);
      
      if (config.WEBHOOK_URL) {
        console.log(`🌐 Webhook URL: ${config.WEBHOOK_URL}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to start application:', error);
    }
    
    // Graceful shutdown
    process.once('SIGINT', () => this.shutdown());
    process.once('SIGTERM', () => this.shutdown());
  }
  
  async shutdown() {
    console.log('\n🛑 Shutting down gracefully on Railway...');
    
    if (this.bot) {
      await this.bot.stop();
      console.log('✅ Main bot stopped');
    }
    
    // Stop all mini-bots
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
    console.log('🔧 Starting MetaBot Creator application on Railway...');
    
    const app = new MetaBotCreator();
    await app.initialize();
    await app.start();
    
    return app;
  } catch (error) {
    console.error('❌ Application failed to start:', error);
    setTimeout(() => process.exit(1), 5000);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  startApplication();
}

// Export for testing/importing
module.exports = MetaBotCreator;