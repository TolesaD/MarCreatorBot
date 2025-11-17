// 📁 src/handlers/startHandler.js (Enhanced)
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
      `✨ *Choose Your Creation Method:*\n\n` +
      `🎯 *Quick Mini-Bots*\n` +
      `• Simple setup wizard\n` +
      `• Customer support bots\n` +
      `• Basic messaging features\n` +
      `• Perfect for beginners\n\n` +
      `🛠️ *Custom Command Builder*\n` +
      `• Visual drag-and-drop interface\n` +
      `• Create ANY bot interaction\n` +
      `• Educational bots, quizzes, forms\n` +
      `• No coding required\n\n` +
      `🔒 *Legal & Privacy:*\n` +
      `By using this bot, you agree to our:\n` +
      `/terms - Terms of Service\n` +
      `/privacy - Privacy Policy`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create New Bot', 'show_creation_pathways')],
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
    // ... existing fallback code
  }
};

// NEW: Show bot creation pathways
const showCreationPathwaysHandler = async (ctx) => {
  try {
    const pathwaysMessage = `🚀 *Create New Bot*\n\n` +
      `Choose your bot creation method:\n\n` +
      `*1. Quick Mini-Bot* 🎯\n` +
      `• Simple setup wizard\n` +
      `• Basic messaging features\n` +
      `• Perfect for beginners\n` +
      `• Customer support focus\n\n` +
      `*2. Custom Command Builder* 🛠️\n` +
      `• Visual drag-and-drop interface\n` +
      `• Create complex interactions\n` +
      `• Educational bots, quizzes, forms\n` +
      `• No coding required\n` +
      `• Advanced logic and variables`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('ℹ️ About Quick', 'pathway_info_quick'),
        Markup.button.callback('ℹ️ About Custom', 'pathway_info_custom')
      ],
      [
        Markup.button.callback('🎯 Quick Mini-Bot', 'create_quick_bot'),
        Markup.button.callback('🛠️ Custom Builder', 'create_custom_bot')
      ],
      [Markup.button.callback('🔙 Main Menu', 'start')]
    ]);

    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(pathwaysMessage, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      await ctx.answerCbQuery();
    } else {
      await ctx.replyWithMarkdown(pathwaysMessage, keyboard);
    }
  } catch (error) {
    console.error('Pathways handler error:', error);
    await ctx.reply('❌ Error showing creation options. Please try /start');
  }
};

// NEW: Show pathway information
const showPathwayInfoHandler = async (ctx, pathwayType) => {
  try {
    let infoMessage = '';
    
    if (pathwayType === 'quick') {
      infoMessage = `🎯 *Quick Mini-Bot Pathway*\n\n` +
        `*Perfect for:* Customer support, simple announcements, basic interactions\n\n` +
        `*Features:*\n` +
        `• Easy 3-step setup\n` +
        `• Welcome message customization\n` +
        `• Message forwarding to admins\n` +
        `• Broadcast messages\n` +
        `• Admin management\n` +
        `• Basic analytics\n\n` +
        `*Limitations:*\n` +
        `• Fixed interaction patterns\n` +
        `• Limited customization\n` +
        `• Basic functionality only\n\n` +
        `*Best for beginners and simple use cases*`;
    } else {
      infoMessage = `🛠️ *Custom Command Builder Pathway*\n\n` +
        `*Perfect for:* Educational bots, quizzes, surveys, complex workflows\n\n` +
        `*Features:*\n` +
        `• Visual drag-and-drop interface\n` +
        `• Create ANY bot interaction\n` +
        `• Conditional logic (IF/THEN/ELSE)\n` +
        `• Variables and data storage\n` +
        `• Pre-built templates\n` +
        `• Form builders\n` +
        `• Educational templates\n` +
        `• Advanced messaging\n\n` +
        `*Limitations:*\n` +
        `• No external API integrations\n` +
        `• No payment processing\n` +
        `• Platform-native features only\n\n` +
        `*Best for advanced users and complex interactions*`;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back to Pathways', 'show_creation_pathways')],
      [Markup.button.callback(
        `🚀 Create ${pathwayType === 'quick' ? 'Quick Bot' : 'Custom Bot'}`,
        pathwayType === 'quick' ? 'create_quick_bot' : 'create_custom_bot'
      )]
    ]);

    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(infoMessage, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      await ctx.answerCbQuery();
    } else {
      await ctx.replyWithMarkdown(infoMessage, keyboard);
    }
  } catch (error) {
    console.error('Pathway info handler error:', error);
    await ctx.reply('❌ Error loading pathway information');
  }
};

// Enhanced help handler to include custom commands
const helpHandler = async (ctx) => {
  try {
    const helpMessage = `📖 *MarCreator - Complete Help Guide*\n\n` +
      `*🚀 Getting Started:*\n` +
      `1. Choose your creation method\n` +
      `2. Follow the setup wizard\n` +
      `3. Go to your mini-bot and use /dashboard\n` +
      `4. Start managing immediately!\n\n` +
      `*🎯 Two Creation Pathways:*\n\n` +
      `*Quick Mini-Bots:*\n` +
      `• Simple customer support bots\n` +
      `• Basic messaging features\n` +
      `• Easy 3-step setup\n` +
      `• Perfect for beginners\n\n` +
      `*Custom Command Builder:*\n` +
      `• Visual drag-and-drop interface\n` +
      `• Create complex interactions\n` +
      `• Educational bots, quizzes, forms\n` +
      `• No coding required\n\n` +
      `*🔧 Main Commands:*\n` +
      `/start - Show main menu\n` +
      `/createbot - Create new mini-bot\n` +
      `/mybots - List your bots\n` +
      `/help - This help message\n\n` +
      `*🤖 Mini-Bot Management:*\n` +
      `• All management happens in mini-bots\n` +
      `• Use /dashboard in your mini-bot\n` +
      `• Get instant notifications\n` +
      `• Reply directly from notifications\n\n` +
      `*🔒 Legal & Support:*\n` +
      `/privacy - Privacy Policy\n` +
      `/terms - Terms of Service\n` +
      `Questions? Contact @MarCreatorSupportBot`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create New Bot', 'show_creation_pathways')],
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
    // ... existing fallback code
  }
};

// Enhanced features handler
const featuresHandler = async (ctx) => {
  try {
    const featuresMessage = `⭐ *MarCreator Features*\n\n` +
      `*🤖 Two Powerful Creation Methods:*\n\n` +
      `*🎯 Quick Mini-Bots:*\n` +
      `• Simple setup wizard\n` +
      `• Real-time message forwarding\n` +
      `• Broadcast system\n` +
      `• Multi-admin support\n` +
      `• Basic analytics\n\n` +
      `*🛠️ Custom Command Builder (NEW):*\n` +
      `• Visual drag-and-drop interface\n` +
      `• Create ANY bot interaction\n` +
      `• Educational templates\n` +
      `• Conditional logic\n` +
      `• Variables and forms\n` +
      `• Quiz and survey builders\n\n` +
      `*⚡ Technical Excellence:*\n` +
      `• Secure token encryption\n` +
      `• Production-ready architecture\n` +
      `• Automatic error recovery\n` +
      `• Regular updates\n\n` +
      `*Ready to create your perfect bot?*`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Create Bot Now', 'show_creation_pathways')],
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
  showCreationPathwaysHandler,
  showPathwayInfoHandler,
  defaultHandler 
};