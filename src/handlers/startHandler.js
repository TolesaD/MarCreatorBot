const { Markup } = require('telegraf');
const User = require('../models/User');

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
      [Markup.button.url('📺 Tutorials & Updates', 'https://t.me/MarCreator')] // NEW BUTTON
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
          [Markup.button.url('📺 Tutorials', 'https://t.me/MarCreator')] // NEW BUTTON
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
    const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || 'MarCreatorSupportBot';
    
    const helpMessage = `📖 *MarCreator - Complete Help Guide*\n\n` +
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
      `/broadcast - Send to all users\n` +
      `/stats - View statistics\n` +
      `/admins - Manage team (owners only)\n\n` +
      `*💡 Pro Tip:*\n` +
      `• Use bot commands/Menu for quick access\n\n` +
      `*🔒 Legal & Support:*\n` +
      `/privacy - View Privacy Policy\n` +
      `/terms - View Terms of Service\n\n` +
      `*Contact:*\n` +
      `Questions? Contact @${SUPPORT_USERNAME}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create Your First Bot', 'create_bot')],
      [Markup.button.callback('📊 My Bots Dashboard', 'my_bots')],
      [
        Markup.button.callback('⭐ Features', 'features'),
        Markup.button.callback('🔒 Privacy', 'privacy_policy')
      ],
      [
        Markup.button.callback('📋 Terms', 'terms_of_service'),
        Markup.button.callback('🔙 Main Menu', 'start')
      ]
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
    
    // Enhanced fallback with the same comprehensive message
    const fallbackMessage = `📖 MarCreator - Complete Help Guide\n\n` +
      `🚀 Getting Started:\n` +
      `1. Create bot via @BotFather\n` +
      `2. Use /createbot to add it here\n` +
      `3. Go to your mini-bot and use /dashboard\n` +
      `4. Start managing immediately!\n\n` +
      `🔧 Main Commands (in this bot):\n` +
      `/start - Show main menu\n` +
      `/createbot - Create new mini-bot\n` +
      `/mybots - List your bots\n` +
      `/help - This help message\n` +
      `/privacy - Privacy Policy\n` +
      `/terms - Terms of Service\n\n` +
      `🤖 Mini-Bot Management:\n` +
      `• Users message your mini-bot\n` +
      `• You get INSTANT notifications\n` +
      `• Reply directly from notifications\n` +
      `• Use /dashboard in mini-bot for full features\n\n` +
      `Manage bots in the mini-bots using /dashboard`;

    await ctx.reply(
      fallbackMessage,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Create Bot', 'create_bot')],
        [Markup.button.callback('📊 My Bots', 'my_bots')],
        [Markup.button.callback('⭐ Features', 'features')],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ])
    );
  }
};

const featuresHandler = async (ctx) => {
  try {
    const featuresMessage = `⭐ *MarCreator Features*\n\n` +
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