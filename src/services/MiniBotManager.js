const { Telegraf, Markup } = require('telegraf');
const { Bot, UserLog, Feedback, Admin, User, BroadcastHistory } = require('../models');

class MiniBotManager {
  constructor() {
    this.activeBots = new Map();
    this.broadcastSessions = new Map();
    this.replySessions = new Map();
    this.adminSessions = new Map();
    this.messageFlowSessions = new Map(); // For real-time message flow
  }
  
  // Add this helper method for deleting messages after delay
  deleteAfterDelay = async (ctx, messageId, delay = 5000) => {
    try {
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(messageId);
        } catch (error) {
          // Message might already be deleted or not accessible
          console.log('Message already deleted or not accessible');
        }
      }, delay);
    } catch (error) {
      console.error('Error setting up message deletion:', error);
    }
  }
  
async initializeAllBots() {
  try {
    console.log('🔄 Initializing all active mini-bots...');
    const activeBots = await Bot.findAll({ where: { is_active: true } });
    
    console.log(`🔍 DEBUG: Found ${activeBots.length} active bots in database`);
    
    // DEBUG: Log each bot found
    activeBots.forEach(bot => {
      console.log(`🔍 DEBUG Bot: ${bot.bot_name} (ID: ${bot.id}) - Username: @${bot.bot_username}`);
    });
    
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    for (const botRecord of activeBots) {
      try {
        // CRITICAL FIX: Check if already active before initializing
        if (this.activeBots.has(botRecord.id)) {
          console.log(`⏭️ Skipping already active bot: ${botRecord.bot_name}`);
          skippedCount++;
          continue;
        }
        
        console.log(`🚀 Attempting to initialize: ${botRecord.bot_name}`);
        const success = await this.initializeBot(botRecord);
        if (success) {
          successCount++;
          console.log(`✅ Successfully initialized: ${botRecord.bot_name}`);
        } else {
          failedCount++;
          console.log(`❌ Failed to initialize: ${botRecord.bot_name}`);
        }
      } catch (error) {
        failedCount++;
        console.error(`Failed to initialize bot ${botRecord.bot_name}:`, error.message);
      }
    }
    
    console.log(`✅ ${successCount}/${activeBots.length} mini-bots initialized successfully (${skippedCount} skipped, ${failedCount} failed)`);
    this.debugActiveBots();
    return successCount;
  } catch (error) {
    console.error('Error initializing all bots:', error);
    return 0;
  }
}
  
async initializeBot(botRecord) {
  try {
    console.log(`🔄 Starting initialization for: ${botRecord.bot_name} (DB ID: ${botRecord.id})`);
    
    // CRITICAL FIX: Check if bot is already active with this database ID
    if (this.activeBots.has(botRecord.id)) {
      console.log(`⚠️ Bot ${botRecord.bot_name} (DB ID: ${botRecord.id}) is already active, skipping...`);
      const existingBot = this.activeBots.get(botRecord.id);
      return !!existingBot;
    }
    
    const token = botRecord.getDecryptedToken();
    if (!token) {
      console.error(`❌ No valid token for bot ${botRecord.bot_name}`);
      return false;
    }
    
    console.log(`🔄 Creating Telegraf instance for: ${botRecord.bot_name}`);
    
    const bot = new Telegraf(token, {
      handlerTimeout: 90000,
      telegram: { 
        apiRoot: 'https://api.telegram.org',
        agent: null
      }
    });
    
    // Store the database ID in context for easy lookup
    bot.context.metaBotInfo = {
      mainBotId: botRecord.id, // This is the database ID
      botId: botRecord.bot_id, // This is the custom bot ID
      botName: botRecord.bot_name,
      botUsername: botRecord.bot_username,
      botRecord: botRecord
    };
    
    this.setupHandlers(bot);
    
    console.log(`🚀 Launching bot: ${botRecord.bot_name}`);
    
    // CRITICAL FIX: Wait for bot to launch properly
    try {
      await bot.launch({
        dropPendingUpdates: true,
        allowedUpdates: ['message', 'callback_query', 'my_chat_member']
      });
      console.log(`✅ Bot launched successfully: ${botRecord.bot_name}`);
    } catch (launchError) {
      console.error(`❌ Bot launch failed: ${botRecord.bot_name}`, launchError.message);
      return false;
    }
    
    // Set bot commands for menu/sidebar
    await this.setBotCommands(bot, token);
    
    // Store with database ID as key
    this.activeBots.set(botRecord.id, { 
      instance: bot, 
      record: botRecord,
      token: token
    });
    
    console.log(`✅ Mini-bot stored in activeBots: ${botRecord.bot_name} - DB ID: ${botRecord.id}`);
    console.log(`📊 Current active bots count: ${this.activeBots.size}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to start bot ${botRecord.bot_name}:`, error.message);
    // Ensure bot is removed from active bots on error
    this.activeBots.delete(botRecord.id);
    return false;
  }
}
  
  async setBotCommands(bot, token) {
    try {
      console.log('🔄 Setting bot commands for menu...');
      await bot.telegram.setMyCommands([
        { command: 'start', description: '🚀 Start the bot' },
        { command: 'dashboard', description: '📊 Admin dashboard' },
        { command: 'messages', description: '📨 View user messages' },
        { command: 'broadcast', description: '📢 Send broadcast' },
        { command: 'stats', description: '📈 View statistics' },
        { command: 'admins', description: '👥 Manage admins' },
        { command: 'help', description: '❓ Get help' }
      ]);
      console.log('✅ Bot menu commands set successfully');
    } catch (error) {
      console.error('❌ Failed to set bot commands:', error.message);
    }
  }
  
  setupHandlers = (bot) => {
    console.log('🔄 Setting up handlers for bot...');
    
    // Use arrow functions for all handlers to maintain 'this' context
    bot.use(async (ctx, next) => {
      ctx.miniBotManager = this;
      return next();
    });
    
    bot.start((ctx) => this.handleStart(ctx));
    bot.command('dashboard', (ctx) => this.handleDashboard(ctx));
    bot.command('messages', (ctx) => this.handleMessagesCommand(ctx));
    bot.command('broadcast', (ctx) => this.handleBroadcastCommand(ctx));
    bot.command('stats', (ctx) => this.handleStatsCommand(ctx));
    bot.command('admins', (ctx) => this.handleAdminsCommand(ctx));
    bot.command('help', (ctx) => this.handleHelp(ctx));
    bot.on('text', (ctx) => this.handleTextMessage(ctx));
    
    bot.action(/^mini_(.+)/, (ctx) => this.handleMiniAction(ctx));
    bot.action(/^reply_(.+)/, (ctx) => this.handleReplyAction(ctx));
    bot.action(/^admin_(.+)/, (ctx) => this.handleAdminAction(ctx));
    bot.action(/^remove_admin_(.+)/, (ctx) => this.handleRemoveAdminAction(ctx));
    bot.action(/^view_message_(.+)/, (ctx) => this.handleViewMessage(ctx));
    bot.action(/^quick_reply_(.+)/, (ctx) => this.handleQuickReply(ctx));
    
    bot.catch((error, ctx) => {
      console.error(`Error in mini-bot ${ctx.metaBotInfo?.botName}:`, error);
    });
    
    console.log('✅ Bot handlers setup complete');
  }

  // CRITICAL FIX: Get bot instance by database ID
  getBotInstanceByDbId = (dbId) => {
    const botData = this.activeBots.get(parseInt(dbId));
    if (!botData) {
      console.error(`❌ Bot instance not found for DB ID: ${dbId}`);
      console.error(`📊 Available bot IDs:`, Array.from(this.activeBots.keys()));
      return null;
    }
    return botData.instance;
  }

  debugActiveBots = () => {
    console.log('🐛 DEBUG: Active Bots Status');
    console.log(`📊 Total active bots: ${this.activeBots.size}`);
    
    for (const [dbId, botData] of this.activeBots.entries()) {
      console.log(`🤖 Bot: ${botData.record.bot_name} | DB ID: ${dbId} | Bot ID: ${botData.record.bot_id}`);
    }
    
    if (this.activeBots.size === 0) {
      console.log('❌ No active bots found in memory!');
    }
  }
  
  // NEW: Real-time message flow to admins
  handleViewMessage = async (ctx) => {
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
      
      const feedback = await Feedback.findByPk(feedbackId);
      if (!feedback) {
        await ctx.reply('❌ Message not found.');
        return;
      }
      
      const message = `📨 *Message from ${feedback.user_first_name}*\n\n` +
        `👤 *User:* ${feedback.user_username ? `@${feedback.user_username}` : `User#${feedback.user_id}`}\n` +
        `🕒 *Time:* ${feedback.created_at.toLocaleString()}\n` +
        `💬 *Message:* ${feedback.message}\n\n` +
        `*Quick Actions:*`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📩 Reply Now', `quick_reply_${feedback.id}`)],
        [Markup.button.callback('📋 All Messages', 'mini_messages')],
        [Markup.button.callback('🔙 Dashboard', 'mini_dashboard')]
      ]);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
    } catch (error) {
      console.error('View message error:', error);
      await ctx.answerCbQuery('❌ Error loading message');
    }
  }
  
  handleQuickReply = async (ctx) => {
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
      console.error('Quick reply error:', error);
      await ctx.answerCbQuery('❌ Error starting reply');
    }
  }
  
  handleStart = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const user = ctx.from;
      
      console.log(`🚀 Start command received for ${metaBotInfo.botName} from ${user.first_name}`);
      
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
      await ctx.reply('Welcome! Send me a message.');
    }
  }
  
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
        [Markup.button.callback('📨 User Messages', 'mini_messages')],
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
  }
  
  showUserWelcome = async (ctx, metaBotInfo) => {
    try {
      const welcomeMessage = `👋 Welcome to *${metaBotInfo.botName}*!\n\n` +
        `Our support team is here to assist you with any questions or concerns you may have\n\n` +
        `Please describe your query, and we'll ensure reaches the right team member promptly!\n\n` +
        `_This Bot is created by @MarCreatorBot._`;
      
      await ctx.replyWithMarkdown(welcomeMessage);
    } catch (error) {
      console.error('User welcome error:', error);
      await ctx.reply(`Welcome to ${metaBotInfo.botName}!`);
    }
  }
  
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
  }
  
  handleMessagesCommand = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      const isAdmin = await this.checkAdminAccess(metaBotInfo.mainBotId, ctx.from.id);
      
      if (!isAdmin) {
        await ctx.reply('❌ Admin access required.');
        return;
      }
      
      await this.showUserMessages(ctx, metaBotInfo.mainBotId);
    } catch (error) {
      console.error('Messages command error:', error);
      await ctx.reply('❌ Error loading messages.');
    }
  }
  
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
  }
  
  handleStatsCommand = async (ctx) => {
    try {
      const { metaBotInfo } = ctx;
      await this.showStats(ctx, metaBotInfo.mainBotId);
    } catch (error) {
      console.error('Stats command error:', error);
      await ctx.reply('❌ Error loading statistics.');
    }
  }
  
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
  }
  
  handleHelp = async (ctx) => {
    try {
      const helpMessage = `🤖 *Help & Support*\n\n` +
        `*For Users:*\n` +
        `• Send any message to contact admins\n\n` +
        `*For Admins:*\n` +
        `• Use /dashboard for admin features\n` +
        `• /messages - View user messages\n` +
        `• /broadcast - Send broadcasts\n` +
        `• /stats - View statistics\n` +
        `• Use menu (/) button for quick access\n\n` +
        `*Need help?* Contact @MarCreatorSupportBot`;
      
      await ctx.replyWithMarkdown(helpMessage);
    } catch (error) {
      console.error('Help command error:', error);
      await ctx.reply('Use /start to begin.');
    }
  }
  
  handleTextMessage = async (ctx) => {
    try {
      const user = ctx.from;
      const message = ctx.message.text;
      const { metaBotInfo } = ctx;
      
      // Check sessions first
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
      
      // Regular message handling
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
  }
  
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
      
      // Send INSTANT real-time notification to admins with message flow
      await this.notifyAdminsRealTime(metaBotInfo.mainBotId, feedback, user);
      
      // Send success message and schedule deletion after 5 seconds
      const successMsg = await ctx.reply('✅ Your message has been received. We will reply soon!');
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
      console.log(`📨 New message from ${user.first_name} to ${metaBotInfo.botName}`);
      
    } catch (error) {
      console.error('User message handler error:', error);
      await ctx.reply('❌ Sorry, there was an error sending your message. Please try again.');
    }
  }
  
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
        case 'messages':
          await this.showUserMessages(ctx, metaBotInfo.mainBotId);
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
  }
  
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
  }
  
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
  }
  
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
  }
  
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
        
        const preview = feedback.message.length > 50 ? 
          feedback.message.substring(0, 50) + '...' : 
          feedback.message;
        
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
  }
  
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
        `*Their message:* ${feedback.message}\n\n` +
        `Please type your reply message:\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Start reply error:', error);
      await ctx.reply('❌ Error starting reply');
    }
  }
  
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
      
      // Send success message and schedule deletion after 5 seconds
      const successMsg = await ctx.reply('✅ Reply sent successfully!');
      await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
      
    } catch (error) {
      console.error('Send reply error:', error);
      await ctx.reply('❌ Error sending reply. User might have blocked the bot.');
    }
  }
  
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
  }
  
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
  }
  
  showStats = async (ctx, botId) => {
    try {
      const userCount = await UserLog.count({ where: { bot_id: botId } });
      const messageCount = await Feedback.count({ where: { bot_id: botId } });
      const pendingCount = await Feedback.count({ 
        where: { bot_id: botId, is_replied: false } 
      });
      
      const statsMessage = `📊 *Bot Statistics*\n\n` +
        `👥 Total Users: ${userCount}\n` +
        `💬 Total Messages: ${messageCount}\n` +
        `📨 Pending Replies: ${pendingCount}\n` +
        `🔄 Status: ✅ Active\n\n` +
        `*Managed via @MarCreatorBot*`;
      
      await ctx.replyWithMarkdown(statsMessage);
      
    } catch (error) {
      console.error('Show stats error:', error);
      await ctx.reply('❌ Error loading statistics.');
    }
  }
  
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
  }
  
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
    
    // Send success message and schedule deletion after 5 seconds
    const successMsg = await ctx.reply(`✅ Admin ${adminUsername} has been removed successfully.`);
    await this.deleteAfterDelay(ctx, successMsg.message_id, 5000);
    
    await this.showAdmins(ctx, botId);
    
  } catch (error) {
    console.error('Remove admin error:', error);
    await ctx.reply('❌ Error removing admin.');
  }
}
  
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
  }
  
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
    
    // Send success message and schedule deletion after 5 seconds
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
}
  
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
  }
  
  notifyAdminsRealTime = async (botId, feedback, user) => {
    try {
      console.log(`🔔 Sending real-time notification for bot ID: ${botId}`);
      
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
      
      const notificationMessage = `🔔 *New Message Received*\n\n` +
        `*From:* ${user.first_name}${user.username ? ` (@${user.username})` : ''}\n` +
        `*Message:* ${feedback.message}\n\n` +
        `*Quick Actions:*`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📩 Reply Now', `reply_${feedback.id}`)],
        [Markup.button.callback('📨 View All Messages', 'mini_messages')]
      ]);
      
      console.log(`📤 Notifying ${admins.length} admins`);
      
      for (const admin of admins) {
        if (admin.User) {
          try {
            await botInstance.telegram.sendMessage(admin.User.telegram_id, notificationMessage, {
              parse_mode: 'Markdown',
              ...keyboard
            });
            console.log(`🔔 Notification sent to admin: ${admin.User.username}`);
          } catch (error) {
            console.error(`Failed to notify admin ${admin.User.username}:`, error.message);
          }
        }
      }
      
      const owner = await User.findOne({ where: { telegram_id: bot.owner_id } });
      if (owner && !admins.find(a => a.admin_user_id === owner.telegram_id)) {
        try {
          await botInstance.telegram.sendMessage(owner.telegram_id, notificationMessage, {
            parse_mode: 'Markdown',
            ...keyboard
          });
          console.log(`🔔 Notification sent to owner: ${owner.username}`);
        } catch (error) {
          console.error('Failed to notify owner:', error.message);
        }
      }
      
      console.log(`🔔 Real-time notification sent for ${bot.bot_name}`);
      
    } catch (error) {
      console.error('Real-time notification error:', error);
    }
  }
  
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
  }
  
  checkAdminAccess = async (botId, userId) => {
    try {
      const bot = await Bot.findByPk(botId);
      if (bot.owner_id === userId) return true;
      
      const admin = await Admin.findOne({
        where: { bot_id: botId, admin_user_id: userId }
      });
      
      return !!admin;
    } catch (error) {
      return false;
    }
  }
  
  checkOwnerAccess = async (botId, userId) => {
    try {
      const bot = await Bot.findByPk(botId);
      return bot.owner_id === userId;
    } catch (error) {
      return false;
    }
  }
  
  stopBot = async (botId) => {
    try {
      const botData = this.activeBots.get(botId);
      if (botData && botData.instance) {
        await botData.instance.stop();
        this.activeBots.delete(botId);
      }
    } catch (error) {
      console.error(`Error stopping bot ${botId}:`, error);
    }
  }

  // Add this method to ensure bots stay active
  ensureBotPersistence = async () => {
    try {
      console.log('🔍 Ensuring bot persistence...');
      const activeBots = await Bot.findAll({ where: { is_active: true } });
      
      for (const botRecord of activeBots) {
        if (!this.activeBots.has(botRecord.id)) {
          console.log(`🔄 Re-initializing inactive bot: ${botRecord.bot_name}`);
          await this.initializeBot(botRecord);
        }
      }
      
      console.log(`✅ Persistence check complete. ${this.activeBots.size} bots active.`);
    } catch (error) {
      console.error('❌ Persistence check error:', error);
    }
  }

  // Add this method to check bot health
  checkBotHealth = async () => {
    try {
      console.log('🏥 Checking bot health...');
      const activeBots = Array.from(this.activeBots.entries());
      
      for (const [dbId, botData] of activeBots) {
        try {
          // Simple health check - try to get bot info
          await botData.instance.telegram.getMe();
          console.log(`✅ Bot healthy: ${botData.record.bot_name}`);
        } catch (error) {
          console.error(`❌ Bot unhealthy: ${botData.record.bot_name}`, error.message);
          // Reinitialize unhealthy bot
          console.log(`🔄 Reinitializing unhealthy bot: ${botData.record.bot_name}`);
          await this.stopBot(dbId);
          await this.initializeBot(botData.record);
        }
      }
      
      console.log('✅ Bot health check completed');
    } catch (error) {
      console.error('❌ Bot health check error:', error);
    }
  }
}

module.exports = new MiniBotManager();