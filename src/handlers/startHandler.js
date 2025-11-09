const { Markup } = require('telegraf');
const User = require('../models/User');

// Store for tracking bot restarts and offline periods
const botState = {
  lastRestartTime: new Date(),
  isProcessingOfflineMessages: false,
  offlineMessageQueue: new Map() // userId -> array of messages during offline
};

class MaintenanceHandler {
  // Called when bot starts up
  static onBotStart() {
    botState.lastRestartTime = new Date();
    console.log('🔄 Bot started - ready to process messages');
  }

  // Check if message was sent while bot was offline
  static wasSentDuringOffline(messageDate) {
    const messageTime = new Date(messageDate * 1000); // Telegram uses seconds
    return messageTime < botState.lastRestartTime;
  }

  // Handle message that was sent while bot was offline
  static async handleOfflineMessage(ctx) {
    const userId = ctx.from.id;
    const messageText = ctx.message.text;
    const messageTime = new Date(ctx.message.date * 1000);
    
    console.log(`📨 Processing offline message from user ${userId}: ${messageText}`);

    try {
      // Notify user we're processing their offline message
      await ctx.reply(`🔄 *Processing Your Message*\n\n` +
        `I was temporarily offline when you sent this message.\n` +
        `Now processing: \`${messageText}\`\n\n` +
        `Thanks for your patience! ✅`, {
        parse_mode: 'Markdown'
      });

      // Process the command/message
      await this.processDelayedMessage(ctx, messageText);
      
    } catch (error) {
      console.error('Error processing offline message:', error);
      await ctx.reply('❌ Sorry, I had trouble processing your previous message. Please try again.');
    }
  }

  // Process delayed message with appropriate handler
  static async processDelayedMessage(ctx, originalText) {
    try {
      if (originalText.startsWith('/start')) {
        await startHandler(ctx);
      } else if (originalText.startsWith('/help')) {
        await helpHandler(ctx);
      } else if (originalText.startsWith('/createbot')) {
        const { createBotHandler } = require('./createBotHandler');
        await createBotHandler(ctx);
      } else if (originalText.startsWith('/mybots')) {
        const { myBotsHandler } = require('./myBotsHandler');
        await myBotsHandler(ctx);
      } else if (originalText.startsWith('/privacy')) {
        // You can call privacy handler directly if available
        await ctx.reply('🔒 Please use /privacy again to view our Privacy Policy.');
      } else if (originalText.startsWith('/terms')) {
        await ctx.reply('📋 Please use /terms again to view our Terms of Service.');
      } else if (originalText.startsWith('/')) {
        // Unknown command during offline period
        await ctx.reply(`❓ Unknown command received while I was offline: ${originalText}\n\nPlease use /help to see available commands.`);
      } else {
        // Regular text message during offline period
        await startHandler(ctx);
      }
    } catch (error) {
      console.error('Error in processDelayedMessage:', error);
      await startHandler(ctx); // Fallback to start handler
    }
  }

  // Get bot status information
  static getBotStatus() {
    return {
      lastRestartTime: botState.lastRestartTime,
      isProcessingOfflineMessages: botState.isProcessingOfflineMessages,
      offlineQueueSize: botState.offlineMessageQueue.size
    };
  }
}

const startHandler = async (ctx) => {
  try {
    const user = ctx.from;
    
    // Check if this message was sent during offline period
    if (MaintenanceHandler.wasSentDuringOffline(ctx.message.date)) {
      await MaintenanceHandler.handleOfflineMessage(ctx);
      return;
    }

    // Save/update user in database
    await User.upsert({
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code,
      last_active: new Date()
    });

    const welcomeMessage = `🤖 *Welcome to MarCreator!*\n\n` +
      `*The Ultimate Telegram Bot Management Platform*\n\n` +
      `✨ *Create & Manage Your Own Bots:*\n` +
      `• 🚀 Create mini-bots without coding\n` +
      `• 💬 Real-time messaging\n` +
      `• 📢 Broadcast to all users\n` +
      `• 👥 Multi-admin support\n` +
      `• 📊 Detailed analytics\n` +
      `• ⚡ Instant notifications\n\n` +
      `🎯 *How It Works:*\n` +
      `1. Create bot with @BotFather\n` +
      `2. Add it here using /createbot\n` +
      `3. Manage it DIRECTLY in the mini-bot\n` +
      `*🚀 All management happens in your mini-bots!*\n\n` +
      `🔒 *Legal & Privacy:*\n` +
      `By using this bot, you agree to our:\n` +
      `/terms - Terms of Service\n` +
      `/privacy - Privacy Policy`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create New Bot', 'create_bot')],
      [
        Markup.button.callback('❓ Help Guide', 'help'),
        Markup.button.callback('⭐ Features', 'features')
      ],
      [
        Markup.button.callback('🔒 Privacy', 'privacy_policy'),
        Markup.button.callback('📋 Terms', 'terms_of_service')
      ],
      [Markup.button.url('📺 Tutorials & Updates', 'https://t.me/MarCreator')]
    ]);

    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(welcomeMessage, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      await ctx.answerCbQuery();
    } else {
      await ctx.replyWithMarkdown(welcomeMessage, keyboard);
    }
    
  } catch (error) {
    console.error('Start handler error:', error);
    
    // Fallback
    try {
      await ctx.reply(
        `🤖 Welcome to MarCreator!\n\n` +
        `Create and manage Telegram bots without coding.\n\n` +
        `All management happens in your mini-bots!\n\n` +
        `Legal: /privacy & /terms\n\n` +
        `Use the buttons below:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Create Bot', 'create_bot')],
          [Markup.button.callback('📊 My Bots', 'my_bots')],
          [Markup.button.callback('❓ Help', 'help')],
          [Markup.button.url('📺 Tutorials', 'https://t.me/MarCreator')]
        ])
      );
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      await ctx.reply(
        'Welcome to MarCreatorBot! Use /createbot to make a bot.'
      );
    }
  }
};

const helpHandler = async (ctx) => {
  try {
    // Check if this message was sent during offline period
    if (MaintenanceHandler.wasSentDuringOffline(ctx.message.date)) {
      await MaintenanceHandler.handleOfflineMessage(ctx);
      return;
    }

    const helpMessage = `📖 *MarCreatorBot - Complete Help Guide*\n\n` +
      `*🚀 Getting Started:*\n` +
      `1. Create bot via @BotFather\n` +
      `2. Use /createbot to add it here\n` +
      `3. Go to your mini-bot and use /dashboard\n` +
      `4. Start managing immediately!\n\n` +
      `*🔧 Main Commands (in this bot):*\n` +
      `/start - Show main menu\n` +
      `/createbot - Create new mini-bot\n` +
      `/mybots - List your bots\n` +
      `/help - This help message\n` +
      `/privacy - Privacy Policy\n` +
      `/terms - Terms of Service\n\n` +
      `*🤖 Mini-Bot Management:*\n` +
      `• Users message your mini-bot\n` +
      `• You get INSTANT notifications\n` +
      `• Reply directly from notifications\n` +
      `• Use /dashboard in mini-bot for full features\n\n` +
      `*📊 Management Features (in mini-bots):*\n` +
      `/dashboard - Full admin panel\n` +
      `/messages - View all user messages\n` +
      `/broadcast - Send to all users\n` +
      `/stats - View statistics\n` +
      `/admins - Manage team (owners only)\n\n` +
      `*💡 Pro Tips:*\n` +
      `• Use bot commands/Menu for quick access\n` +
      `*🔒 Legal & Support:*\n` +
      `/privacy - View Privacy Policy\n` +
      `/terms - View Terms of Service\n` +
      `*Contact @MarCreatorSupportBot for help*`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create Your First Bot', 'create_bot')],
      [Markup.button.callback('📊 My Bots Dashboard', 'my_bots')],
      [
        Markup.button.callback('🔒 Privacy', 'privacy_policy'),
        Markup.button.callback('📋 Terms', 'terms_of_service')
      ],
      [Markup.button.callback('🔙 Main Menu', 'start')]
    ]);

    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(helpMessage, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      await ctx.answerCbQuery();
    } else {
      await ctx.replyWithMarkdown(helpMessage, keyboard);
    }
    
  } catch (error) {
    console.error('Help handler error:', error);
    await ctx.reply(
      `🤖 MarCreator Help\n\n` +
      `Main Commands:\n` +
      `/start - Main menu\n` +
      `/createbot - Create bot\n` +
      `/mybots - List bots\n` +
      `/help - Help guide\n` +
      `/privacy - Privacy Policy\n` +
      `/terms - Terms of Service\n\n` +
      `Manage bots in the mini-bots using /dashboard`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Create Bot', 'create_bot')],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ])
    );
  }
};

const featuresHandler = async (ctx) => {
  try {
    // Check if this message was sent during offline period
    if (MaintenanceHandler.wasSentDuringOffline(ctx.message.date)) {
      await MaintenanceHandler.handleOfflineMessage(ctx);
      return;
    }

    const featuresMessage = `⭐ *MarCreatorBot Features*\n\n` +
      `*🤖 Bot Creation & Management:*\n` +
      `• Create mini-bots\n` +
      `• No coding knowledge required\n` +
      `• Easy setup wizard\n` +
      `• One-click activation\n\n` +
      `*💬 Advanced Messaging System:*\n` +
      `• Real-time message forwarding\n` +
      `• Instant admin notifications\n` +
      `• One-click reply from notifications\n` +
      `• Message history tracking\n\n` +
      `*📢 Broadcast System:*\n` +
      `• Send messages to all users\n` +
      `• Markdown formatting support\n` +
      `• Delivery statistics\n` +
      `• Rate limiting protection\n\n` +
      `*👥 Admin Management:*\n` +
      `• Add multiple admins\n` +
      `• Role-based permissions\n` +
      `• Admin activity tracking\n` +
      `• Easy team management\n\n` +
      `*📊 Analytics & Insights:*\n` +
      `• User growth statistics\n` +
      `• Message volume tracking\n` +
      `• Engagement metrics\n` +
      `• Performance insights\n\n` +
      `*⚡ Technical Features:*\n` +
      `• Secure token encryption\n` +
      `• Bot persistence across restarts\n` +
      `• Production-ready architecture\n` +
      `• Automatic error recovery\n\n` +
      `*🔒 Security & Privacy:*\n` +
      `• Encrypted bot token storage\n` +
      `• GDPR-compliant data handling\n` +
      `• Regular security updates\n` +
      `• Transparent privacy policy\n\n` +
      `*🎯 Perfect For:*\n` +
      `• Businesses & customer support\n` +
      `• Communities & groups\n` +
      `• Content creators\n` +
      `• Developers & entrepreneurs\n\n` +
      `*Ready to create your first bot?*`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create Bot Now', 'create_bot')],
      [Markup.button.callback('📊 View My Bots', 'my_bots')],
      [
        Markup.button.callback('🔒 Privacy Policy', 'privacy_policy'),
        Markup.button.callback('📋 Terms of Service', 'terms_of_service')
      ],
      [Markup.button.callback('🔙 Main Menu', 'start')]
    ]);

    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(featuresMessage, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      await ctx.answerCbQuery();
    } else {
      await ctx.replyWithMarkdown(featuresMessage, keyboard);
    }
  } catch (error) {
    console.error('Features handler error:', error);
    await ctx.reply(
      `⭐ MarCreator Features\n\n` +
      `• Create mini-bots\n` +
      `• Real-time messaging\n` +
      `• Broadcast system\n` +
      `• Admin management\n` +
      `• Analytics & insights\n` +
      `• Secure & private\n\n` +
      `Ready to create your first bot?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Create Bot', 'create_bot')],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ])
    );
  }
};

// Default handler for any unrecognized messages
const defaultHandler = async (ctx) => {
  try {
    // Check if this message was sent during offline period
    if (MaintenanceHandler.wasSentDuringOffline(ctx.message.date)) {
      await MaintenanceHandler.handleOfflineMessage(ctx);
      return;
    }

    const message = `🤖 *MarCreator*\n\n` +
      `I see you sent a message. Here's how I can help you:\n\n` +
      `*Quick Actions:*\n` +
      `• Create and manage Telegram bots\n` +
      `• Handle user messages automatically\n` +
      `• Send broadcasts to all users\n` +
      `• Get instant notifications\n\n` +
      `*🔒 Legal & Privacy:*\n` +
      `/privacy - Privacy Policy\n` +
      `/terms - Terms of Service\n\n` +
      `*🎯 All management happens in your mini-bots!*\n\n` +
      `Use the buttons below to get started.`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create New Bot', 'create_bot')],
      [Markup.button.callback('📊 My Bots', 'my_bots')],
      [Markup.button.callback('❓ Help', 'help')],
      [Markup.button.callback('⭐ Features', 'features')],
      [
        Markup.button.callback('🔒 Privacy', 'privacy_policy'),
        Markup.button.callback('📋 Terms', 'terms_of_service')
      ]
    ]);

    await ctx.replyWithMarkdown(message, keyboard);
  } catch (error) {
    console.error('Default handler error:', error);
    await ctx.reply('Please use /start to see the main menu.');
  }
};

module.exports = { 
  startHandler, 
  helpHandler, 
  featuresHandler,
  defaultHandler,
  MaintenanceHandler 
};