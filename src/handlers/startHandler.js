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

    const welcomeMessage = `🤖 *Welcome to Botomics!*\n\n` +
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
      [Markup.button.url('📺 Tutorials & Updates', 'https://t.me/Botomics')]
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
        `🤖 Welcome to Botomics!\n\n` +
        `Create and manage Telegram bots without coding.\n\n` +
        `All management happens in your mini-bots!\n\n` +
        `Legal: /privacy & /terms\n\n` +
        `Use the buttons below:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Create Bot', 'create_bot')],
          [Markup.button.callback('📊 My Bots', 'my_bots')],
          [Markup.button.callback('❓ Help', 'help')],
          [Markup.button.url('📺 Tutorials', 'https://t.me/Botomics')]
        ])
      );
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      await ctx.reply(
        'Welcome to BotomicsBot! Use /createbot to make a bot.'
      );
    }
  }
};

const helpHandler = async (ctx) => {
  try {
    const helpMessage = `📖 *Botomics - Complete Help Guide*\n\n` +
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
      `*🎯 Advanced Features (in mini-bots):*\n` +
      `*💰 Referral Program:*\n` +
      `• Create referral links to grow your audience\n` +
      `• Set custom rewards for referrals\n` +
      `• Track referral statistics\n` +
      `• Manage withdrawal requests\n` +
      `• Use /referral in your mini-bot\n\n` +
      `*🚫 User Ban System:*\n` +
      `• Ban problematic users by username or ID\n` +
      `• Set custom ban reasons\n` +
      `• View all banned users\n` +
      `• Quick unban functionality\n` +
      `• Use /ban and /unban commands\n\n` +
      `*📢 Force Channel Join:*\n` +
      `• Require users to join channels before using bot\n` +
      `• Add multiple channels\n` +
      `• Real-time verification\n` +
      `• Custom join messages\n\n` +
      `*📊 Management Features (in mini-bots):*\n` +
      `/dashboard - Full admin panel\n` +
      `/broadcast - Send to all users\n` +
      `/stats - View statistics\n` +
      `/admins - Manage team (owners only)\n` +
      `/settings - Bot settings (owners only)\n` +
      `/referral - Referral program management\n` +
      `/ban - Ban user by username/ID\n` +
      `/unban - Unban user by username/ID\n\n` +
      `*💡 Pro Tips:*\n` +
      `• Use bot commands/Menu for quick access\n` +
      `• Add co-admins to help manage messages\n` +
      `• Set up referral program to grow your audience\n` +
      `• Use ban system to maintain community quality\n` +
      `• Force channel join to grow your channels\n\n` +
      `*🔒 Legal & Support:*\n` +
      `/privacy - View Privacy Policy\n` +
      `/terms - View Terms of Service\n` +
      `*Contact:*\n` +
      `Questions? Contact @BotomicsSupportBot\n\n` +
      `*🚀 Ready to create amazing bots?*`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create Your First Bot', 'create_bot')],
      [Markup.button.callback('📊 My Bots Dashboard', 'my_bots')],
      [Markup.button.callback('⭐ See All Features', 'features')],
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
      `🤖 Botomics Help\n\n` +
      `Main Commands:\n` +
      `/start - Main menu\n` +
      `/createbot - Create bot\n` +
      `/mybots - List bots\n` +
      `/help - Help guide\n` +
      `/privacy - Privacy Policy\n` +
      `/terms - Terms of Service\n\n` +
      `Advanced Features:\n` +
      `• Referral Program\n` +
      `• User Ban System\n` +
      `• Force Channel Join\n\n` +
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
    const featuresMessage = `⭐ *Botomics - Complete Features List*\n\n` +
      `*🤖 Bot Creation & Management:*\n` +
      `• Create unlimited mini-bots\n` +
      `• No coding knowledge required\n` +
      `• Easy setup wizard\n` +
      `• One-click activation\n` +
      `• Bot token encryption\n` +
      `• Automatic bot persistence\n\n` +
      `*💬 Advanced Messaging System:*\n` +
      `• Real-time message forwarding\n` +
      `• Instant admin notifications\n` +
      `• One-click reply from notifications\n` +
      `• Message history tracking\n` +
      `• Support for all media types\n` +
      `• Media album handling\n\n` +
      `*📢 Broadcast System:*\n` +
      `• Send messages to all users\n` +
      `• Markdown & HTML formatting\n` +
      `• Delivery statistics\n` +
      `• Rate limiting protection\n` +
      `• Progress tracking\n` +
      `• Failed delivery handling\n\n` +
      `*👥 Admin Management:*\n` +
      `• Add multiple admins\n` +
      `• Role-based permissions\n` +
      `• Admin activity tracking\n` +
      `• Easy team management\n` +
      `• Owner-only settings\n` +
      `• Secure admin verification\n\n` +
      `*💰 Referral Program System:*\n` +
      `• Create custom referral links\n` +
      `• Set referral rewards\n` +
      `• Track referral statistics\n` +
      `• Withdrawal management\n` +
      `• Custom currency support\n` +
      `• Real-time earnings tracking\n\n` +
      `*🚫 User Ban Management:*\n` +
      `• Ban users by username or ID\n` +
      `• Custom ban reasons\n` +
      `• View all banned users\n` +
      `• Quick unban functionality\n` +
      `• Ban notification system\n` +
      `• Bulk ban management\n\n` +
      `*📢 Force Channel Join:*\n` +
      `• Require channel membership\n` +
      `• Add multiple channels\n` +
      `• Real-time verification\n` +
      `• Custom join messages\n` +
      `• Channel management interface\n` +
      `• Join wall for non-members\n\n` +
      `*📊 Analytics & Insights:*\n` +
      `• User growth statistics\n` +
      `• Message volume tracking\n` +
      `• Engagement metrics\n` +
      `• Performance insights\n` +
      `• Referral program analytics\n` +
      `• Ban statistics\n\n` +
      `*⚡ Technical Features:*\n` +
      `• Secure token encryption\n` +
      `• Bot persistence across restarts\n` +
      `• Production-ready architecture\n` +
      `• Automatic error recovery\n` +
      `• Rate limiting protection\n` +
      `• Database optimization\n\n` +
      `*🔒 Security & Privacy:*\n` +
      `• Encrypted bot token storage\n` +
      `• GDPR-compliant data handling\n` +
      `• Regular security updates\n` +
      `• Transparent privacy policy\n` +
      `• User data protection\n` +
      `• Secure API communications\n\n` +
      `*🎯 Perfect For:*\n` +
      `• Businesses & customer support\n` +
      `• Communities & groups\n` +
      `• Content creators\n` +
      `• Developers & entrepreneurs\n` +
      `• Marketing agencies\n` +
      `• Community managers\n\n` +
      `*🚀 Ready to build your bot empire?*`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create Bot Now', 'create_bot')],
      [Markup.button.callback('📊 View My Bots', 'my_bots')],
      [Markup.button.callback('📖 Help Guide', 'help')],
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
      `⭐ Botomics Features\n\n` +
      `• Create mini-bots\n` +
      `• Real-time messaging\n` +
      `• Broadcast system\n` +
      `• Admin management\n` +
      `• Referral program\n` +
      `• User ban system\n` +
      `• Force channel join\n` +
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
    const message = `🤖 *BotomicsBot*\n\n` +
      `I see you sent a message. Here's how I can help you:\n\n` +
      `*Quick Actions:*\n` +
      `• Create and manage Telegram bots\n` +
      `• Handle user messages automatically\n` +
      `• Send broadcasts to all users\n` +
      `• Get instant notifications\n` +
      `• Grow with referral programs\n` +
      `• Manage users with ban system\n` +
      `• Force channel memberships\n\n` +
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