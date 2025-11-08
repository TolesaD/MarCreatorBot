const { Markup } = require('telegraf');
const User = require('../models/User');
const { userOwnsBots, isBotOwnerOrCreator } = require('../utils/helpers');

const startHandler = async (ctx) => {
  try {
    const user = ctx.from;
    
    // Save/update user in database
    await User.upsert({
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code,
      last_active: new Date()
    });

    // Check if user owns any bots
    const ownsBots = await userOwnsBots(user.id);
    const isOwnerOrCreator = await isBotOwnerOrCreator(user.id);

    const welcomeMessage = `🤖 *Welcome to MarCreatorBot!*\n\n` +
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
      `4. Get instant notifications for new messages\n\n` +
      `*🚀 All management happens in your mini-bots!*\n\n` +
      `🔒 *Legal & Privacy:*\n` +
      `By using this bot, you agree to our:\n` +
      `/terms - Terms of Service\n` +
      `/privacy - Privacy Policy`;

    // Create different keyboard based on user role
    let keyboard;
    if (isOwnerOrCreator) {
      // Full menu for bot owners and creator
      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Create New Bot', 'create_bot')],
        [
          Markup.button.callback('📊 My Bots Dashboard', 'my_bots'),
          Markup.button.callback('❓ Help Guide', 'help')
        ],
        [
          Markup.button.callback('🔒 Privacy', 'privacy_policy'),
          Markup.button.callback('📋 Terms', 'terms_of_service')
        ]
      ]);
    } else {
      // Limited menu for regular users
      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Create Your First Bot', 'create_bot')],
        [
          Markup.button.callback('❓ Help Guide', 'help'),
          Markup.button.callback('⭐ Features', 'features')
        ],
        [
          Markup.button.callback('🔒 Privacy', 'privacy_policy'),
          Markup.button.callback('📋 Terms', 'terms_of_service')
        ]
      ]);
    }

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
        `🤖 Welcome to MarCreatorBot!\n\n` +
        `Create and manage Telegram bots without coding.\n\n` +
        `All management happens in your mini-bots!\n\n` +
        `Legal: /privacy & /terms\n\n` +
        `Use the buttons below:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Create Bot', 'create_bot')],
          [Markup.button.callback('❓ Help', 'help')]
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
    const userId = ctx.from.id;
    const isOwnerOrCreator = await isBotOwnerOrCreator(userId);
    
    let helpMessage;
    
    if (isOwnerOrCreator) {
      // Full help for bot owners
      helpMessage = `📖 *MarCreatorBot - Complete Help Guide*\n\n` +
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
        `• Click notification buttons to reply instantly\n` +
        `• Add co-admins to help manage\n` +
        `• Broadcast important announcements\n\n` +
        `*🔒 Legal & Support:*\n` +
        `/privacy - View Privacy Policy\n` +
        `/terms - View Terms of Service\n` +
        `Contact @MarCreatorSupportBot for help`;
    } else {
      // Basic help for regular users
      helpMessage = `📖 *MarCreatorBot - Getting Started Guide*\n\n` +
        `*🚀 Welcome! Here's how to create your first bot:*\n\n` +
        `*Step 1: Create a Bot with @BotFather*\n` +
        `• Start a chat with @BotFather\n` +
        `• Send /newbot command\n` +
        `• Choose a name for your bot\n` +
        `• Choose a username (must end with 'bot')\n` +
        `• Copy the bot token provided\n\n` +
        `*Step 2: Add Your Bot Here*\n` +
        `• Use /createbot command\n` +
        `• Paste your bot token\n` +
        `• Choose a display name\n` +
        `• Your bot will be ready instantly!\n\n` +
        `*Step 3: Manage Your Bot*\n` +
        `• Users can start chatting with your bot\n` +
        `• You'll get instant notifications\n` +
        `• Reply directly to user messages\n` +
        `• Use commands in your mini-bot for management\n\n` +
        `*🎯 What You Can Do:*\n` +
        `• Customer support bot\n` +
        `• Community announcements\n` +
        `• Business communication\n` +
        `• Personal assistant\n\n` +
        `*🔒 Legal & Privacy:*\n` +
        `We protect your data and ensure secure operation.\n\n` +
        `Ready to create your first bot?`;
    }

    let keyboard;
    if (isOwnerOrCreator) {
      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Create New Bot', 'create_bot')],
        [Markup.button.callback('📊 My Bots Dashboard', 'my_bots')],
        [
          Markup.button.callback('🔒 Privacy', 'privacy_policy'),
          Markup.button.callback('📋 Terms', 'terms_of_service')
        ],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ]);
    } else {
      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Create Your First Bot', 'create_bot')],
        [Markup.button.callback('⭐ See Features', 'features')],
        [
          Markup.button.callback('🔒 Privacy', 'privacy_policy'),
          Markup.button.callback('📋 Terms', 'terms_of_service')
        ],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ]);
    }

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
      `🤖 MarCreatorBot Help\n\n` +
      `Use /createbot to make your first bot!\n\n` +
      `Need help? Contact @MarCreatorSupportBot`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Create Bot', 'create_bot')],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ])
    );
  }
};

const featuresHandler = async (ctx) => {
  try {
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
      `⭐ MarCreatorBot Features\n\n` +
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
    const message = `🤖 *MarCreatorBot*\n\n` +
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
  defaultHandler 
};