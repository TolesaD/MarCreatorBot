const { Markup } = require('telegraf');
const Bot = require('../models/Bot');
const Admin = require('../models/Admin');

class BotManagementHandler {
  static async handleMyBots(ctx) {
    try {
      const userId = ctx.from.id;
      console.log('📊 Loading bots for user:', userId);
      
      // Get bots where user is owner
      const ownedBots = await Bot.findAll({
        where: { owner_id: userId }
      });
      
      console.log(`🔍 DEBUG: Found ${ownedBots.length} owned bots`);
      
      // Get bots where user is admin (but NOT owner) - CRITICAL FIX
      const adminBots = await Admin.findAll({
        where: { admin_user_id: userId },
        include: [{ model: Bot, as: 'Bot' }]
      }).then(records => 
        records
          .map(r => r.Bot)
          .filter(b => b && b.owner_id !== userId) // EXCLUDE owned bots to prevent duplicates
      );
      
      console.log(`🔍 DEBUG: Found ${adminBots.length} admin-only bots`);
      
      // Combine without duplicates
      const allBots = [...ownedBots, ...adminBots];
      
      console.log(`🔍 DEBUG: Total unique bots: ${allBots.length}`);
      allBots.forEach(bot => {
        console.log(`   - ${bot.bot_name} (ID: ${bot.id}, Owner: ${bot.owner_id === userId})`);
      });
      
      if (allBots.length === 0) {
        const message = '🤖 *No Bots Yet!*\n\n' +
          'You haven\'t created any bots yet. Let\'s create your first bot!\n\n' +
          'With MetaBot Creator you can:\n' +
          '• Create multiple bots\n' +
          '• Manage from one place\n' +
          '• No coding required\n' +
          '• Interactive bots that actually work!';

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Create First Bot', 'create_bot')],
          [Markup.button.callback('🆘 Help', 'help')]
        ]);

        if (ctx.updateType === 'callback_query') {
          await ctx.editMessageText(message, { 
            parse_mode: 'Markdown',
            ...keyboard 
          });
          await ctx.answerCbQuery();
        } else {
          await ctx.replyWithMarkdown(message, keyboard);
        }
        return;
      }
      
      const activeBots = allBots.filter(bot => bot.is_active);
      const inactiveBots = allBots.filter(bot => !bot.is_active);
      
      let message = `🤖 *Your Bot Dashboard*\n\n`;
      message += `📊 *Overview:* ${activeBots.length} active, ${inactiveBots.length} inactive\n\n`;
      
      if (activeBots.length > 0) {
        message += `🟢 *Active Bots:*\n`;
        activeBots.forEach((bot, index) => {
          const isOwner = bot.owner_id === userId;
          message += `${index + 1}. ${bot.bot_name} (@${bot.bot_username}) ${isOwner ? '👑' : '👥'}\n`;
        });
        message += '\n';
      }
      
      if (inactiveBots.length > 0) {
        message += `🔴 *Inactive Bots:*\n`;
        inactiveBots.forEach((bot, index) => {
          const isOwner = bot.owner_id === userId;
          message += `${index + 1}. ${bot.bot_name} (@${bot.bot_username}) ${isOwner ? '👑' : '👥'}\n`;
        });
        message += '\n';
      }
      
      message += `🎯 *Management Instructions:*\n` +
        `• Go to each mini-bot and use /dashboard\n` +
        `• All features available directly in mini-bots\n` +
        `• You get instant notifications for new messages`;

      // CRITICAL FIX: Remove duplicate buttons by using bot.id instead of bot.bot_id
      const uniqueBotsMap = new Map();
      allBots.forEach(bot => {
        uniqueBotsMap.set(bot.id, bot); // Use database ID as key to ensure uniqueness
      });
      
      const uniqueBots = Array.from(uniqueBotsMap.values());
      
      const keyboardButtons = uniqueBots.map(bot => [
        Markup.button.callback(
          `${bot.is_active ? '🟢' : '🔴'} ${bot.bot_name}`,
          `bot_dashboard_${bot.bot_id}`
        )
      ]);
      
      keyboardButtons.push([
        Markup.button.callback('🚀 Create New Bot', 'create_bot'),
        Markup.button.callback('🔄 Refresh', 'my_bots')
      ]);

      const keyboard = Markup.inlineKeyboard(keyboardButtons);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, { 
          parse_mode: 'Markdown',
          ...keyboard 
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
    } catch (error) {
      console.error('Error in handleMyBots:', error);
      await ctx.reply('❌ Error loading your bots. Please try again.');
    }
  }

  static async handleBotDashboard(ctx, botId) {
    try {
      const userId = ctx.from.id;
      console.log('🎯 Loading dashboard for bot:', botId);
      
      const bot = await Bot.findByPk(botId);
      if (!bot) {
        await ctx.answerCbQuery('❌ Bot not found');
        return;
      }
      
      // Check if user can manage this bot
      const isOwner = bot.owner_id === userId;
      const isAdmin = await Admin.findOne({ 
        where: { bot_id: botId, admin_user_id: userId } 
      });
      
      if (!isOwner && !isAdmin) {
        await ctx.answerCbQuery('❌ Access denied');
        return;
      }
      
      // Get basic stats
      const UserLog = require('../models/UserLog');
      const Feedback = require('../models/Feedback');
      const AdminModel = require('../models/Admin');
      
      const userCount = await UserLog.count({ where: { bot_id: botId } });
      const messageCount = await Feedback.count({ where: { bot_id: botId } });
      const pendingCount = await Feedback.count({ where: { bot_id: botId, is_replied: false } });
      const adminCount = await AdminModel.count({ where: { bot_id: botId } });
      
      const message = `🎯 *Bot Dashboard: ${bot.bot_name}*\n\n` +
        `🆔 *Bot ID:* ${bot.bot_id}\n` +
        `🔗 *Status:* ${bot.is_active ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n` +
        `👑 *Role:* ${isOwner ? 'Owner' : 'Admin'}\n\n` +
        `📊 *Statistics:*\n` +
        `   👥 Total Users: ${userCount || 0}\n` +
        `   💬 Total Messages: ${messageCount || 0}\n` +
        `   📨 Pending Replies: ${pendingCount || 0}\n` +
        `   👥 Team Members: ${adminCount + 1}\n\n` +
        `⚡ *Quick Actions:*`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(bot.is_active ? '🔴 Deactivate' : '🟢 Activate', `toggle_bot_${botId}`),
          Markup.button.callback('📊 Stats', `stats_${botId}`)
        ],
        [
          Markup.button.url('🔗 Open Bot', `https://t.me/${bot.bot_username}`),
          Markup.button.callback('👥 Admins', `admin_bot_${botId}`)
        ],
        [
          Markup.button.callback('🗑️ Delete', `delete_bot_${botId}`),
          Markup.button.callback('⬅️ Back', 'my_bots')
        ]
      ]);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, { 
          parse_mode: 'Markdown',
          ...keyboard 
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
    } catch (error) {
      console.error('Error in handleBotDashboard:', error);
      await ctx.answerCbQuery('❌ Error loading dashboard');
    }
  }

  static async handleToggleBot(ctx, botId) {
    try {
      const userId = ctx.from.id;
      
      await ctx.answerCbQuery('🔄 Toggling bot...');
      
      const bot = await Bot.findByPk(botId);
      if (!bot) {
        await ctx.reply('❌ Bot not found');
        return;
      }
      
      // Check if user can manage this bot
      const isOwner = bot.owner_id === userId;
      const isAdmin = await Admin.findOne({ 
        where: { bot_id: botId, admin_user_id: userId } 
      });
      
      if (!isOwner && !isAdmin) {
        await ctx.reply('❌ Access denied');
        return;
      }
      
      // Only owners can deactivate bots
      if (!bot.is_active && !isOwner) {
        await ctx.reply('❌ Only bot owner can activate bots');
        return;
      }
      
      // Toggle bot status
      const newStatus = !bot.is_active;
      await bot.update({ is_active: newStatus });
      
      // Initialize or stop the mini-bot
      const MiniBotManager = require('../services/MiniBotManager');
      if (newStatus) {
        // Check if already active before initializing
        if (!MiniBotManager.activeBots.has(bot.id)) {
          await MiniBotManager.initializeBot(bot);
          await ctx.reply(`✅ Bot activated: ${bot.bot_name}`);
        } else {
          await ctx.reply(`ℹ️ Bot ${bot.bot_name} is already active`);
        }
      } else {
        await MiniBotManager.stopBot(bot.id);
        await ctx.reply(`🔴 Bot deactivated: ${bot.bot_name}`);
      }
      
      // Return to dashboard
      await this.handleBotDashboard(ctx, botId);
      
    } catch (error) {
      console.error('Error in handleToggleBot:', error);
      await ctx.answerCbQuery('❌ Error toggling bot');
    }
  }

  static async handleDeleteBot(ctx, botId) {
    try {
      await ctx.answerCbQuery('🗑️ Preparing deletion...');
      
      const bot = await Bot.findByPk(botId);
      if (!bot) {
        await ctx.reply('❌ Bot not found');
        return;
      }
      
      const message = `🗑️ *Delete Bot Confirmation*\n\n` +
        `You are about to delete: *${bot.bot_name}* (@${bot.bot_username})\n\n` +
        `⚠️ *This action cannot be undone!*\n\n` +
        `All bot data will be permanently deleted:\n` +
        `• User messages\n` +
        `• Broadcast history\n` +
        `• Admin settings\n` +
        `• User logs\n\n` +
        `*Are you absolutely sure?*`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes, Delete Forever', `confirm_delete_${botId}`)],
        [Markup.button.callback('❌ Cancel', `bot_dashboard_${botId}`)]
      ]);
      
      await ctx.editMessageText(message, { 
        parse_mode: 'Markdown',
        ...keyboard 
      });
      
    } catch (error) {
      console.error('Error in handleDeleteBot:', error);
      await ctx.answerCbQuery('❌ Error preparing deletion');
    }
  }

  static async handleConfirmDelete(ctx, botId) {
    try {
      await ctx.answerCbQuery('🗑️ Deleting bot...');
      
      const bot = await Bot.findByPk(botId);
      if (!bot) {
        await ctx.reply('❌ Bot not found');
        return;
      }
      
      // Stop the mini-bot first
      const MiniBotManager = require('../services/MiniBotManager');
      await MiniBotManager.stopBot(bot.id);
      
      // Delete bot from database
      await bot.destroy();
      
      await ctx.editMessageText(
        `✅ *Bot Deleted Successfully*\n\n` +
        `*${bot.bot_name}* has been permanently deleted.\n\n` +
        `All associated data has been removed from the system.`,
        { parse_mode: 'Markdown' }
      );
      
      // Return to bots list after delay
      setTimeout(() => {
        ctx.reply('/mybots');
      }, 2000);
      
    } catch (error) {
      console.error('Error in handleConfirmDelete:', error);
      await ctx.answerCbQuery('❌ Error deleting bot');
    }
  }
}

// Register the class methods as bot handlers
module.exports = (bot) => {
  console.log('✅ BotManagementHandler loaded');
  
  // Register commands
  //bot.command('mybots', BotManagementHandler.handleMyBots);
  
  // Register actions
  bot.action(/bot_dashboard_(.+)/, async (ctx) => {
    const botId = ctx.match[1];
    await BotManagementHandler.handleBotDashboard(ctx, botId);
  });
  
  bot.action(/toggle_bot_(.+)/, async (ctx) => {
    const botId = ctx.match[1];
    await BotManagementHandler.handleToggleBot(ctx, botId);
  });
  
  bot.action(/delete_bot_(.+)/, async (ctx) => {
    const botId = ctx.match[1];
    await BotManagementHandler.handleDeleteBot(ctx, botId);
  });
  
  bot.action(/confirm_delete_(.+)/, async (ctx) => {
    const botId = ctx.match[1];
    await BotManagementHandler.handleConfirmDelete(ctx, botId);
  });
  
  bot.action(/admin_bot_(.+)/, async (ctx) => {
    const botId = ctx.match[1];
    const { adminHandler } = require('./adminHandler');
    await adminHandler(ctx, true, botId);
  });
  
  bot.action(/stats_(.+)/, async (ctx) => {
    const botId = ctx.match[1];
    // Redirect to use stats in mini-bot
    const bot = await require('../models/Bot').findByPk(botId);
    if (bot) {
      await ctx.reply(
        `📊 *Statistics for ${bot.bot_name}*\n\n` +
        `Please view statistics directly in your mini-bot:\n\n` +
        `Go to @${bot.bot_username} and use /stats`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url(`🔗 Open ${bot.bot_name}`, `https://t.me/${bot.bot_username}`)],
            [Markup.button.callback('📋 My Bots', 'my_bots')]
          ])
        }
      );
    }
  });
};

module.exports.BotManagementHandler = BotManagementHandler;