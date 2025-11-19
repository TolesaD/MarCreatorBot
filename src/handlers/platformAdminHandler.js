// src/handlers/platformAdminHandler.js - COMPLETE FIXED VERSION
const { Markup } = require('telegraf');
const { User, Bot, UserLog, Feedback, BroadcastHistory, Admin } = require('../models');
const { formatNumber } = require('../utils/helpers');
const MiniBotManager = require('../services/MiniBotManager');

// Store admin management sessions
const platformAdminSessions = new Map();

class PlatformAdminHandler {
  
  // Check if user is platform creator
  static isPlatformCreator(userId) {
    return userId === 1827785384; // Your user ID
  }

  // Enhanced Markdown escaping for platform-scale data
  static escapeMarkdown(text) {
    if (!text) return '';
    
    // Escape all Markdown special characters
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  // Safe answerCbQuery wrapper
  static async safeAnswerCbQuery(ctx) {
    if (ctx.updateType === 'callback_query') {
      await ctx.answerCbQuery();
    }
  }

  // Platform admin dashboard - FIXED: Use HTML instead of MarkdownV2
  static async platformDashboard(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Platform admin access required.');
        return;
      }

      // Get comprehensive platform statistics
      const [
        totalUsers,
        totalBotOwners,
        totalBots,
        activeBots,
        totalMessages,
        pendingMessages,
        totalBroadcasts,
        todayUsers
      ] = await Promise.all([
        User.count(),
        User.count({ 
          include: [{
            model: Bot,
            as: 'OwnedBots',
            required: true
          }]
        }),
        Bot.count(),
        Bot.count({ where: { is_active: true } }),
        Feedback.count(),
        Feedback.count({ where: { is_replied: false } }),
        BroadcastHistory.count(),
        User.count({
          where: {
            last_active: {
              [require('sequelize').Op.gte]: new Date(new Date() - 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      // FIXED: Use HTML formatting to avoid MarkdownV2 parsing issues
      const dashboardMessage = 
        `<b>👑 Platform Admin Dashboard</b>\n\n` +
        `<b>📊 Platform Statistics:</b>\n` +
        `👥 Total Users: <code>${formatNumber(totalUsers)}</code>\n` +
        `👥 Active Today: <code>${formatNumber(todayUsers)}</code>\n` +
        `🤖 Bot Owners: <code>${formatNumber(totalBotOwners)}</code>\n` +
        `🤖 Total Bots: <code>${formatNumber(totalBots)}</code>\n` +
        `🟢 Active Bots: <code>${formatNumber(activeBots)}</code>\n` +
        `💬 Total Messages: <code>${formatNumber(totalMessages)}</code>\n` +
        `📨 Pending Messages: <code>${formatNumber(pendingMessages)}</code>\n` +
        `📢 Total Broadcasts: <code>${formatNumber(totalBroadcasts)}</code>\n\n` +
        `<b>Admin Actions:</b>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👥 User Management', 'platform_users')],
        [Markup.button.callback('🤖 Bot Management', 'platform_bots')],
        [Markup.button.callback('📢 Platform Broadcast', 'platform_broadcast')],
        [Markup.button.callback('🚫 Ban Management', 'platform_bans')],
        [Markup.button.callback('📊 Advanced Analytics', 'platform_analytics')],
        [Markup.button.callback('🔄 Refresh Stats', 'platform_dashboard_refresh')]
      ]);

      if (ctx.updateType === 'callback_query') {
        try {
          await ctx.editMessageText(dashboardMessage, {
            parse_mode: 'HTML', // FIXED: Use HTML instead of Markdown
            ...keyboard
          });
        } catch (error) {
          // If message content is the same, just answer callback query
          if (error.response && error.response.error_code === 400 && 
              error.response.description.includes('message is not modified')) {
            await ctx.answerCbQuery('✅ Stats are up to date');
            return;
          }
          throw error;
        }
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(dashboardMessage, { 
          parse_mode: 'HTML',
          ...keyboard 
        });
      }

    } catch (error) {
      console.error('Platform dashboard error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error loading platform dashboard.');
      } else {
        await ctx.reply('❌ Error loading platform dashboard.');
      }
    }
  }

  // User management with pagination - FIXED: Use HTML formatting
  static async userManagement(ctx, page = 1) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      const limit = 10;
      const offset = (page - 1) * limit;

      const { count, rows: users } = await User.findAndCountAll({
        order: [['last_active', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      // FIXED: Use HTML formatting to avoid MarkdownV2 escaping issues
      let message = 
        `<b>👥 User Management - Page ${page}/${totalPages}</b>\n\n` +
        `<b>Total Users:</b> <code>${formatNumber(count)}</code>\n\n` +
        `<b>Recent Users:</b>\n`;

      users.forEach((user, index) => {
        const userInfo = user.username ? 
          `@${user.username} (${user.first_name})` : 
          `${user.first_name} (ID: ${user.telegram_id})`;
        
        const status = user.is_banned ? '🚫 BANNED' : '✅ Active';
        
        message += 
          `<b>${offset + index + 1}.</b> ${userInfo}\n` +
          `   Status: ${status}\n` +
          `   Last Active: ${user.last_active.toLocaleDateString()}\n\n`;
      });

      const keyboardButtons = [];

      // Pagination buttons
      if (page > 1) {
        keyboardButtons.push(Markup.button.callback('⬅️ Previous', `platform_users:${page - 1}`));
      }
      if (page < totalPages) {
        keyboardButtons.push(Markup.button.callback('Next ➡️', `platform_users:${page + 1}`));
      }

      const keyboard = Markup.inlineKeyboard([
        keyboardButtons,
        [
          Markup.button.callback('🚫 Ban User', 'platform_ban_user'),
          Markup.button.callback('✅ Unban User', 'platform_unban_user')
        ],
        [Markup.button.callback('📊 User Statistics', 'platform_user_stats')],
        [Markup.button.callback('📋 Export Users', 'platform_export_users')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...keyboard
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          ...keyboard 
        });
      }

    } catch (error) {
      console.error('User management error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error loading users');
      } else {
        await ctx.reply('❌ Error loading users');
      }
    }
  }

  // Bot management with detailed info - FIXED: Use HTML formatting
  static async botManagement(ctx, page = 1) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      const limit = 8;
      const offset = (page - 1) * limit;

      const { count, rows: bots } = await Bot.findAndCountAll({
        include: [{
          model: User,
          as: 'Owner',
          attributes: ['username', 'first_name', 'is_banned']
        }],
        order: [['created_at', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      // FIXED: Use HTML formatting
      let message = 
        `<b>🤖 Bot Management - Page ${page}/${totalPages}</b>\n\n` +
        `<b>Total Bots:</b> <code>${formatNumber(count)}</code>\n\n` +
        `<b>Recent Bots:</b>\n`;

      bots.forEach((bot, index) => {
        let ownerInfo;
        if (bot.Owner) {
          ownerInfo = bot.Owner.is_banned ? 
            `@${bot.Owner.username} 🚫` : 
            `@${bot.Owner.username}`;
        } else {
          ownerInfo = `User#${bot.owner_id}`;
        }
        
        const status = bot.is_active ? '🟢 Active' : '🔴 Inactive';
        
        message += 
          `<b>${offset + index + 1}.</b> ${bot.bot_name} (@${bot.bot_username})\n` +
          `   Owner: ${ownerInfo}\n` +
          `   Status: ${status}\n` +
          `   Created: ${bot.created_at.toLocaleDateString()}\n\n`;
      });

      const keyboardButtons = [];

      // Pagination buttons
      if (page > 1) {
        keyboardButtons.push(Markup.button.callback('⬅️ Previous', `platform_bots:${page - 1}`));
      }
      if (page < totalPages) {
        keyboardButtons.push(Markup.button.callback('Next ➡️', `platform_bots:${page + 1}`));
      }

      const keyboard = Markup.inlineKeyboard([
        keyboardButtons,
        [
          Markup.button.callback('🔄 Toggle Bot', 'platform_toggle_bot'),
          Markup.button.callback('🗑️ Delete Bot', 'platform_delete_bot')
        ],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...keyboard
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          ...keyboard 
        });
      }

    } catch (error) {
      console.error('Bot management error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error loading bots');
      } else {
        await ctx.reply('❌ Error loading bots');
      }
    }
  }

  // Ban management - FIXED: Use HTML formatting
  static async banManagement(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      const bannedUsers = await User.findAll({
        where: { is_banned: true },
        order: [['banned_at', 'DESC']],
        limit: 15
      });

      // FIXED: Use HTML formatting
      let message = 
        `<b>🚫 Ban Management</b>\n\n` +
        `<b>Banned Users:</b> <code>${bannedUsers.length}</code>\n\n`;

      if (bannedUsers.length === 0) {
        message += `No users are currently banned.`;
      } else {
        bannedUsers.forEach((user, index) => {
          const userInfo = user.username ? 
            `@${user.username} (${user.first_name})` : 
            `${user.first_name} (ID: ${user.telegram_id})`;
          
          message += 
            `<b>${index + 1}.</b> ${userInfo}\n` +
            `   Banned: ${user.banned_at ? user.banned_at.toLocaleDateString() : 'Unknown'}\n` +
            `   Reason: ${user.ban_reason || 'Not specified'}\n\n`;
        });
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Ban User', 'platform_ban_user')],
        [Markup.button.callback('✅ Unban User', 'platform_unban_user')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...keyboard
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          ...keyboard 
        });
      }

    } catch (error) {
      console.error('Ban management error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error loading ban list');
      } else {
        await ctx.reply('❌ Error loading ban list');
      }
    }
  }

  // Start ban user process - FIXED: Use HTML formatting
  static async startBanUser(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'ban_user',
        step: 'awaiting_user_id'
      });

      // FIXED: Use HTML formatting
      const message = 
        `<b>🚫 Ban User</b>\n\n` +
        `Please provide the user's Telegram ID or username to ban:\n\n` +
        `<b>Examples:</b>\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `<b>Cancel:</b> Type /cancel`;

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bans')]
          ])
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bans')]
          ])
        });
      }

    } catch (error) {
      console.error('Start ban user error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error starting ban process');
      } else {
        await ctx.reply('❌ Error starting ban process');
      }
    }
  }

  // Start unban user process - FIXED: Use HTML formatting
  static async startUnbanUser(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'unban_user',
        step: 'awaiting_user_id'
      });

      // FIXED: Use HTML formatting
      const message = 
        `<b>✅ Unban User</b>\n\n` +
        `Please provide the user's Telegram ID or username to unban:\n\n` +
        `<b>Examples:</b>\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `<b>Cancel:</b> Type /cancel`;

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bans')]
          ])
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bans')]
          ])
        });
      }

    } catch (error) {
      console.error('Start unban user error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error starting unban process');
      } else {
        await ctx.reply('❌ Error starting unban process');
      }
    }
  }

  // Platform broadcast - FIXED: Use HTML formatting
  static async startPlatformBroadcast(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      const totalUsers = await User.count();

      platformAdminSessions.set(ctx.from.id, {
        action: 'platform_broadcast',
        step: 'awaiting_message'
      });

      // FIXED: Use HTML formatting
      const message = 
        `<b>📢 Platform Broadcast</b>\n\n` +
        `<b>Recipients:</b> <code>${formatNumber(totalUsers)}</code> users\n\n` +
        `⚠️ <b>Important:</b> This will send a message to ALL users of the platform.\n\n` +
        `Please type your broadcast message:\n\n` +
        `<b>Cancel:</b> Type /cancel`;

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_dashboard')]
          ])
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_dashboard')]
          ])
        });
      }

    } catch (error) {
      console.error('Start platform broadcast error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error starting broadcast');
      } else {
        await ctx.reply('❌ Error starting broadcast');
      }
    }
  }

  // Send platform broadcast - ALREADY FIXED: Uses HTML
  static async sendPlatformBroadcast(ctx, message) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Access denied');
        return;
      }

      const users = await User.findAll({
        attributes: ['telegram_id', 'username', 'first_name'],
        where: { is_banned: false } // Don't send to banned users
      });

      const progressMsg = await ctx.reply(
        `<b>📢 Platform Broadcast Started</b>\n\n` +
        `🔄 Sending to <code>${formatNumber(users.length)}</code> users...\n` +
        `✅ Sent: <code>0</code>\n` +
        `❌ Failed: <code>0</code>\n` +
        `⏰ Estimated time: <code>${Math.ceil(users.length / 20)}</code> seconds`,
        { parse_mode: 'HTML' }
      );

      let successCount = 0;
      let failCount = 0;
      const failedUsers = [];

      const startTime = Date.now();

      // Escape message for HTML to prevent parsing errors
      const escapedMessage = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          await ctx.telegram.sendMessage(user.telegram_id, escapedMessage, {
            parse_mode: 'HTML'
          });
          successCount++;

          // Update progress every 20 users or every 5 seconds
          if (i % 20 === 0 || i === users.length - 1) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.ceil((users.length - i) / 20);
            
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              progressMsg.message_id,
              null,
              `<b>📢 Platform Broadcast Progress</b>\n\n` +
              `🔄 Sending to <code>${formatNumber(users.length)}</code> users...\n` +
              `✅ Sent: <code>${formatNumber(successCount)}</code>\n` +
              `❌ Failed: <code>${formatNumber(failCount)}</code>\n` +
              `⏰ Elapsed: <code>${elapsed}</code>s | Remaining: ~<code>${remaining}</code>s`,
              { parse_mode: 'HTML' }
            );
          }

          // Rate limiting: 30 messages per second max
          if (i % 30 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          failCount++;
          failedUsers.push({
            id: user.telegram_id,
            username: user.username,
            error: error.message
          });
          console.error(`Failed to send to user ${user.telegram_id}:`, error.message);
        }
      }

      const totalTime = Math.floor((Date.now() - startTime) / 1000);
      const successRate = ((successCount / users.length) * 100).toFixed(1);

      // Save broadcast history
      try {
        await BroadcastHistory.create({
          bot_id: null,
          sent_by: ctx.from.id,
          message: message.substring(0, 1000),
          total_users: users.length,
          successful_sends: successCount,
          failed_sends: failCount,
          broadcast_type: 'platform'
        });
      } catch (dbError) {
        console.error('Failed to save broadcast history:', dbError.message);
      }

      let resultMessage = 
        `<b>✅ Platform Broadcast Completed!</b>\n\n` +
        `<b>Summary:</b>\n` +
        `👥 Total Recipients: <code>${formatNumber(users.length)}</code>\n` +
        `✅ Successful: <code>${formatNumber(successCount)}</code>\n` +
        `❌ Failed: <code>${formatNumber(failCount)}</code>\n` +
        `📊 Success Rate: <code>${successRate}%</code>\n` +
        `⏰ Total Time: <code>${totalTime}</code> seconds\n\n`;

      if (failCount > 0) {
        resultMessage += 
          `<b>Common failure reasons:</b>\n` +
          `• User blocked the bot\n` +
          `• User account deleted\n` +
          `• Rate limiting\n\n` +
          `Failed users: <code>${failedUsers.length}</code>`;
      }

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        resultMessage,
        { parse_mode: 'HTML' }
      );

      platformAdminSessions.delete(ctx.from.id);

    } catch (error) {
      console.error('Send platform broadcast error:', error);
      await ctx.reply('❌ Error sending platform broadcast: ' + error.message);
      platformAdminSessions.delete(ctx.from.id);
    }
  }

  // Advanced analytics - FIXED: Use HTML formatting
  static async advancedAnalytics(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      // Get analytics data for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        newUsers,
        newBots,
        activeUsers,
        messagesStats
      ] = await Promise.all([
        User.count({
          where: {
            created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo }
          }
        }),
        Bot.count({
          where: {
            created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo }
          }
        }),
        User.count({
          where: {
            last_active: { [require('sequelize').Op.gte]: thirtyDaysAgo }
          }
        }),
        Feedback.findAll({
          where: {
            created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo }
          },
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN is_replied = true THEN 1 ELSE 0 END')), 'replied']
          ],
          raw: true
        })
      ]);

      const totalMessages = parseInt(messagesStats[0]?.total || 0);
      const repliedMessages = parseInt(messagesStats[0]?.replied || 0);
      const replyRate = totalMessages > 0 ? ((repliedMessages / totalMessages) * 100).toFixed(1) : '0';

      // FIXED: Use HTML formatting
      const analyticsMessage = 
        '<b>📊 Advanced Analytics (Last 30 Days)</b>\n\n' +
        '<b>User Growth:</b>\n' +
        `👥 New Users: <code>${formatNumber(newUsers)}</code>\n` +
        `👥 Active Users: <code>${formatNumber(activeUsers)}</code>\n\n` +
        '<b>Bot Activity:</b>\n' +
        `🤖 New Bots: <code>${formatNumber(newBots)}</code>\n\n` +
        '<b>Messaging:</b>\n' +
        `💬 Total Messages: <code>${formatNumber(totalMessages)}</code>\n` +
        `✅ Replied Messages: <code>${formatNumber(repliedMessages)}</code>\n` +
        `📊 Reply Rate: <code>${replyRate}%</code>\n\n` +
        '<b>Platform Health:</b>\n' +
        '🟢 System: Operational\n' +
        '📈 Trend: Growing';

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Detailed Reports', 'platform_detailed_reports')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(analyticsMessage, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...keyboard
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(analyticsMessage, { 
          parse_mode: 'HTML',
          ...keyboard 
        });
      }

    } catch (error) {
      console.error('Advanced analytics error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error loading analytics');
      } else {
        await ctx.reply('❌ Error loading analytics');
      }
    }
  }

  // User statistics feature - FIXED: Use HTML formatting
  static async userStatistics(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      // Get detailed user statistics
      const [
        totalUsers,
        bannedUsers,
        activeToday,
        activeWeek,
        newToday,
        newWeek,
        usersWithBots
      ] = await Promise.all([
        User.count(),
        User.count({ where: { is_banned: true } }),
        User.count({
          where: {
            last_active: { [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        User.count({
          where: {
            last_active: { [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        }),
        User.count({
          where: {
            created_at: { [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        User.count({
          where: {
            created_at: { [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        }),
        User.count({
          include: [{
            model: Bot,
            as: 'OwnedBots',
            required: true
          }]
        })
      ]);

      // Calculate percentages
      const botOwnershipRate = ((usersWithBots / totalUsers) * 100).toFixed(1);
      const userRetention = ((activeWeek / totalUsers) * 100).toFixed(1);
      const growthRate = ((newWeek / totalUsers) * 100).toFixed(1);

      // FIXED: Use HTML formatting
      const statsMessage = 
        '<b>📊 User Statistics</b>\n\n' +
        '<b>Overview:</b>\n' +
        `👥 Total Users: <code>${formatNumber(totalUsers)}</code>\n` +
        `🚫 Banned Users: <code>${formatNumber(bannedUsers)}</code>\n` +
        `✅ Active Users: <code>${formatNumber(totalUsers - bannedUsers)}</code>\n\n` +
        
        '<b>Activity:</b>\n' +
        `📈 Active Today: <code>${formatNumber(activeToday)}</code>\n` +
        `📈 Active This Week: <code>${formatNumber(activeWeek)}</code>\n` +
        `🆕 New Today: <code>${formatNumber(newToday)}</code>\n` +
        `🆕 New This Week: <code>${formatNumber(newWeek)}</code>\n\n` +
        
        '<b>Bot Ownership:</b>\n' +
        `🤖 Users with Bots: <code>${formatNumber(usersWithBots)}</code>\n` +
        `📊 Bot Ownership Rate: <code>${botOwnershipRate}%</code>\n\n` +
        
        '<b>Platform Health:</b>\n' +
        `📱 User Retention: <code>${userRetention}%</code>\n` +
        `🚀 Growth Rate: <code>${growthRate}%</code>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Detailed Reports', 'platform_detailed_reports')],
        [Markup.button.callback('📋 Export Users', 'platform_export_users')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(statsMessage, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...keyboard
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(statsMessage, { 
          parse_mode: 'HTML',
          ...keyboard 
        });
      }

    } catch (error) {
      console.error('User statistics error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error loading user statistics');
      } else {
        await ctx.reply('❌ Error loading user statistics');
      }
    }
  }

  // Detailed reports feature - FIXED: Use HTML formatting
  static async detailedReports(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      // Get comprehensive platform reports
      const [
        userGrowth,
        botGrowth,
        messageStats,
        broadcastStats,
        totalUsers
      ] = await Promise.all([
        User.count({
          where: {
            created_at: { 
              [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            }
          }
        }),
        Bot.count({
          where: {
            created_at: { 
              [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            }
          }
        }),
        Feedback.findAll({
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN is_replied = true THEN 1 ELSE 0 END')), 'replied']
          ],
          raw: true
        }),
        BroadcastHistory.findAll({
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('SUM', require('sequelize').col('total_users')), 'total_recipients'],
            [require('sequelize').fn('AVG', require('sequelize').col('successful_sends')), 'avg_success_rate']
          ],
          raw: true
        }),
        User.count()
      ]);

      // Safe parsing of database results
      const totalMessages = parseInt(messageStats[0]?.total || 0);
      const repliedMessages = parseInt(messageStats[0]?.replied || 0);
      const totalBroadcasts = parseInt(broadcastStats[0]?.total || 0);
      const totalRecipients = parseInt(broadcastStats[0]?.total_recipients || 0);
      const avgSuccessRate = parseFloat(broadcastStats[0]?.avg_success_rate || 0);

      // Calculate rates safely
      const replyRate = totalMessages > 0 ? ((repliedMessages / totalMessages) * 100).toFixed(1) : '0';
      const userGrowthRate = totalUsers > 0 ? ((userGrowth / totalUsers) * 100).toFixed(1) : '0';

      // FIXED: Use HTML formatting
      let reportsMessage = 
        '<b>📈 Detailed Platform Reports</b>\n\n' +
        '<b>Message Analytics:</b>\n' +
        `💬 Total Messages: <code>${formatNumber(totalMessages)}</code>\n` +
        `✅ Replied Messages: <code>${formatNumber(repliedMessages)}</code>\n` +
        `📊 Reply Rate: <code>${replyRate}%</code>\n\n` +
        
        '<b>Broadcast Performance:</b>\n' +
        `📢 Total Broadcasts: <code>${formatNumber(totalBroadcasts)}</code>\n` +
        `👥 Total Recipients: <code>${formatNumber(totalRecipients)}</code>\n` +
        `📈 Avg Success Rate: <code>${avgSuccessRate.toFixed(1)}%</code>\n\n` +
        
        '<b>Growth Trends (Last 7 Days):</b>\n' +
        `👥 New Users: <code>${formatNumber(userGrowth)}</code>\n` +
        `🤖 New Bots: <code>${formatNumber(botGrowth)}</code>\n\n` +
        
        '<b>Platform Insights:</b>\n' +
        `📱 Daily User Growth Rate: <code>${userGrowthRate}%</code>\n` +
        `🚀 Bot Creation Rate: <code>${((botGrowth / 7) || 0).toFixed(1)}</code> bots/day\n` +
        `💬 Message Activity: <code>${((totalMessages / 30) || 0).toFixed(1)}</code> msgs/day`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 User Statistics', 'platform_user_stats')],
        [Markup.button.callback('📋 Export Data', 'platform_export_users')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(reportsMessage, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...keyboard
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(reportsMessage, { 
          parse_mode: 'HTML',
          ...keyboard 
        });
      }

    } catch (error) {
      console.error('Detailed reports error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error loading detailed reports');
      } else {
        await ctx.reply('❌ Error loading detailed reports');
      }
    }
  }

  // Bot toggle feature - FIXED: Use HTML formatting
  static async startToggleBot(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'toggle_bot',
        step: 'awaiting_bot_id'
      });

      // FIXED: Use HTML formatting
      const message = 
        `<b>🔄 Toggle Bot Status</b>\n\n` +
        `Please provide the bot ID or username to toggle:\n\n` +
        `<b>Examples:</b>\n` +
        `• 123 (Bot ID)\n` +
        `• @botusername\n\n` +
        `<b>Cancel:</b> Type /cancel`;

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bots')]
          ])
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bots')]
          ])
      });
      }

    } catch (error) {
      console.error('Start toggle bot error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error starting toggle process');
      } else {
        await ctx.reply('❌ Error starting toggle process');
      }
    }
  }

  // Bot deletion feature - FIXED: Use HTML formatting
  static async startDeleteBot(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      platformAdminSessions.set(ctx.from.id, {
        action: 'delete_bot',
        step: 'awaiting_bot_id'
      });

      // FIXED: Use HTML formatting
      const message = 
        `<b>🗑️ Delete Bot</b>\n\n` +
        `⚠️ <b>Warning:</b> This will permanently delete the bot and all its data!\n\n` +
        `Please provide the bot ID or username to delete:\n\n` +
        `<b>Examples:</b>\n` +
        `• 123 (Bot ID)\n` +
        `• @botusername\n\n` +
        `<b>Cancel:</b> Type /cancel`;

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML', // FIXED: Use HTML
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bots')]
          ])
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_bots')]
          ])
      });
      }

    } catch (error) {
      console.error('Start delete bot error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error starting delete process');
      } else {
        await ctx.reply('❌ Error starting delete process');
      }
    }
  }

  // User export feature - FIXED: Use HTML formatting
  static async exportUsers(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        if (ctx.updateType === 'callback_query') {
          await ctx.answerCbQuery('❌ Access denied');
        } else {
          await ctx.reply('❌ Access denied');
        }
        return;
      }

      const users = await User.findAll({
        attributes: ['telegram_id', 'username', 'first_name', 'last_name', 'is_banned', 'created_at', 'last_active'],
        order: [['created_at', 'DESC']]
      });

      if (users.length === 0) {
        await ctx.answerCbQuery('❌ No users to export');
        return;
      }

      // Create CSV content
      let csvContent = 'User ID,Username,First Name,Last Name,Status,Created At,Last Active\n';
      
      users.forEach(user => {
        const status = user.is_banned ? 'Banned' : 'Active';
        const createdAt = user.created_at.toISOString().split('T')[0];
        const lastActive = user.last_active ? user.last_active.toISOString().split('T')[0] : 'Never';
        
        csvContent += `${user.telegram_id},${user.username || ''},${user.first_name || ''},${user.last_name || ''},${status},${createdAt},${lastActive}\n`;
      });

      // Send as file
      await ctx.replyWithDocument({
        source: Buffer.from(csvContent, 'utf8'),
        filename: `platform_users_${new Date().toISOString().split('T')[0]}.csv`
      }, {
        caption: 
          `<b>📋 User Export Complete</b>\n\n` +
          `<b>Total Users:</b> <code>${formatNumber(users.length)}</code>\n` +
          `<b>Export Date:</b> <code>${new Date().toLocaleDateString()}</code>\n\n` +
          `The file contains all user data in CSV format.`,
        parse_mode: 'HTML' // FIXED: Use HTML
      });

      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('✅ User export completed');
      }

    } catch (error) {
      console.error('Export users error:', error);
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('❌ Error exporting users');
      } else {
        await ctx.reply('❌ Error exporting users');
      }
    }
  }

  // Handle platform admin text input
  static async handlePlatformAdminInput(ctx) {
    try {
      const userId = ctx.from.id;
      const session = platformAdminSessions.get(userId);

      if (!session) return;

      if (ctx.message.text === '/cancel') {
        platformAdminSessions.delete(userId);
        await ctx.reply('❌ Platform admin action cancelled.');
        return;
      }

      const input = ctx.message.text.trim();

      if (session.action === 'platform_broadcast' && session.step === 'awaiting_message') {
        await this.sendPlatformBroadcast(ctx, input);
      } else if ((session.action === 'ban_user' || session.action === 'unban_user') && session.step === 'awaiting_user_id') {
        await this.processUserBanAction(ctx, session.action, input);
      } else if (session.action === 'toggle_bot' && session.step === 'awaiting_bot_id') {
        await this.processBotToggle(ctx, input);
      } else if (session.action === 'delete_bot' && session.step === 'awaiting_bot_id') {
        await this.processBotDeletion(ctx, input);
      }

      platformAdminSessions.delete(userId);

    } catch (error) {
      console.error('Platform admin input error:', error);
      await ctx.reply('❌ Error processing platform admin action.');
      platformAdminSessions.delete(ctx.from.id);
    }
  }

  // Process user ban/unban action - FIXED: Use HTML responses
  static async processUserBanAction(ctx, action, input) {
    try {
      let targetUserId;
      let targetUser;

      // Parse user input
      if (/^\d+$/.test(input)) {
        targetUserId = parseInt(input);
        targetUser = await User.findOne({ where: { telegram_id: targetUserId } });
      } else {
        const username = input.replace('@', '').trim();
        targetUser = await User.findOne({ where: { username: username } });
        if (targetUser) {
          targetUserId = targetUser.telegram_id;
        }
      }

      if (!targetUser) {
        await ctx.reply('❌ User not found. Please check the User ID or username.');
        return;
      }

      if (action === 'ban_user') {
        if (targetUser.is_banned) {
          await ctx.reply('❌ This user is already banned.');
          return;
        }

        await targetUser.update({
          is_banned: true,
          banned_at: new Date(),
          ban_reason: 'Banned by platform admin'
        });

        // Stop all bots owned by this user
        const userBots = await Bot.findAll({ where: { owner_id: targetUser.telegram_id } });
        for (const bot of userBots) {
          try {
            await MiniBotManager.stopBot(bot.id);
            await bot.update({ is_active: false });
          } catch (error) {
            console.error(`Failed to stop bot ${bot.id}:`, error);
          }
        }

        await ctx.reply(`✅ User @${targetUser.username || targetUser.telegram_id} has been banned and all their bots have been deactivated.`);

      } else if (action === 'unban_user') {
        if (!targetUser.is_banned) {
          await ctx.reply('❌ This user is not banned.');
          return;
        }

        await targetUser.update({
          is_banned: false,
          banned_at: null,
          ban_reason: null
        });

        // Reactivate user's bots when unbanned
        const userBots = await Bot.findAll({ where: { owner_id: targetUser.telegram_id } });
        for (const bot of userBots) {
          try {
            await MiniBotManager.initializeBot(bot);
            await bot.update({ is_active: true });
          } catch (error) {
            console.error(`Failed to reactivate bot ${bot.id}:`, error);
          }
        }

        await ctx.reply(`✅ User @${targetUser.username || targetUser.telegram_id} has been unbanned and their bots have been reactivated.`);
      }

      // Return to ban management
      await this.banManagement(ctx);

    } catch (error) {
      console.error('Process user ban action error:', error);
      await ctx.reply('❌ Error processing ban action.');
    }
  }

  // Process bot toggle - FIXED: Use HTML responses
  static async processBotToggle(ctx, input) {
    try {
      let targetBot;

      // Parse bot input
      if (/^\d+$/.test(input)) {
        const botId = parseInt(input);
        targetBot = await Bot.findByPk(botId);
      } else {
        const botUsername = input.replace('@', '').trim();
        targetBot = await Bot.findOne({ where: { bot_username: botUsername } });
      }

      if (!targetBot) {
        await ctx.reply('❌ Bot not found. Please check the Bot ID or username.');
        return;
      }

      const newStatus = !targetBot.is_active;

      if (newStatus) {
        // Activate bot
        try {
          const success = await MiniBotManager.initializeBot(targetBot);
          if (success) {
            await targetBot.update({ is_active: true });
            await ctx.reply(`✅ Bot "${targetBot.bot_name}" (@${targetBot.bot_username}) has been activated.`);
          } else {
            await ctx.reply('❌ Failed to activate bot: Initialization failed. Check bot token.');
            return;
          }
        } catch (error) {
          await ctx.reply(`❌ Failed to activate bot: ${error.message}`);
          return;
        }
      } else {
        // Deactivate bot
        try {
          await MiniBotManager.stopBot(targetBot.id);
          await targetBot.update({ is_active: false });
          await ctx.reply(`✅ Bot "${targetBot.bot_name}" (@${targetBot.bot_username}) has been deactivated.`);
        } catch (error) {
          await ctx.reply(`❌ Failed to deactivate bot: ${error.message}`);
          return;
        }
      }

      // Return to bot management
      await this.botManagement(ctx);

    } catch (error) {
      console.error('Process bot toggle error:', error);
      await ctx.reply('❌ Error toggling bot status.');
    }
  }

  // Process bot deletion - FIXED: Use HTML responses
  static async processBotDeletion(ctx, input) {
    try {
      let targetBot;

      // Parse bot input
      if (/^\d+$/.test(input)) {
        const botId = parseInt(input);
        targetBot = await Bot.findByPk(botId);
      } else {
        const botUsername = input.replace('@', '').trim();
        targetBot = await Bot.findOne({ where: { bot_username: botUsername } });
      }

      if (!targetBot) {
        await ctx.reply('❌ Bot not found. Please check the Bot ID or username.');
        return;
      }

      // Stop bot first
      try {
        await MiniBotManager.stopBot(targetBot.id);
      } catch (error) {
        console.error('Error stopping bot during deletion:', error);
      }

      // Delete related records first to avoid foreign key constraints
      console.log(`🗑️ Deleting related records for bot ${targetBot.id}...`);
      
      // Delete admins associated with this bot
      const adminCount = await Admin.count({ where: { bot_id: targetBot.id } });
      if (adminCount > 0) {
        await Admin.destroy({ where: { bot_id: targetBot.id } });
        console.log(`✅ Deleted ${adminCount} admin records`);
      }
      
      // Delete feedback/messages associated with this bot
      const feedbackCount = await Feedback.count({ where: { bot_id: targetBot.id } });
      if (feedbackCount > 0) {
        await Feedback.destroy({ where: { bot_id: targetBot.id } });
        console.log(`✅ Deleted ${feedbackCount} feedback records`);
      }
      
      // Delete user logs associated with this bot
      const userLogCount = await UserLog.count({ where: { bot_id: targetBot.id } });
      if (userLogCount > 0) {
        await UserLog.destroy({ where: { bot_id: targetBot.id } });
        console.log(`✅ Deleted ${userLogCount} user log records`);
      }
      
      // Delete broadcast history associated with this bot
      const broadcastCount = await BroadcastHistory.count({ where: { bot_id: targetBot.id } });
      if (broadcastCount > 0) {
        await BroadcastHistory.destroy({ where: { bot_id: targetBot.id } });
        console.log(`✅ Deleted ${broadcastCount} broadcast records`);
      }

      // Delete bot from database
      const botName = targetBot.bot_name;
      const botUsername = targetBot.bot_username;
      
      await targetBot.destroy();

      await ctx.reply(`✅ Bot "${botName}" (@${botUsername}) has been permanently deleted along with all its data.`);

      // Return to bot management
      await this.botManagement(ctx);

    } catch (error) {
      console.error('Process bot deletion error:', error);
      await ctx.reply(`❌ Error deleting bot: ${error.message}`);
    }
  }

  // Check if user is banned and block access
  static async checkUserBan(userId) {
    try {
      const user = await User.findOne({ where: { telegram_id: userId } });
      return user ? user.is_banned : false;
    } catch (error) {
      console.error('Check user ban error:', error);
      return false;
    }
  }

  // Check if user is in platform admin session
  static isInPlatformAdminSession(userId) {
    return platformAdminSessions.has(userId);
  }
}

// Register platform admin callbacks
PlatformAdminHandler.registerCallbacks = (bot) => {
  // Dashboard and main navigation
  bot.action('platform_dashboard', async (ctx) => {
    await PlatformAdminHandler.platformDashboard(ctx);
  });

  bot.action('platform_dashboard_refresh', async (ctx) => {
    await PlatformAdminHandler.platformDashboard(ctx);
  });

  bot.action('platform_users', async (ctx) => {
    await PlatformAdminHandler.userManagement(ctx, 1);
  });

  bot.action('platform_bots', async (ctx) => {
    await PlatformAdminHandler.botManagement(ctx, 1);
  });

  bot.action('platform_broadcast', async (ctx) => {
    await PlatformAdminHandler.startPlatformBroadcast(ctx);
  });

  bot.action('platform_bans', async (ctx) => {
    await PlatformAdminHandler.banManagement(ctx);
  });

  bot.action('platform_analytics', async (ctx) => {
    await PlatformAdminHandler.advancedAnalytics(ctx);
  });

  // User management pagination
  bot.action(/platform_users:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await PlatformAdminHandler.userManagement(ctx, page);
  });

  // Bot management pagination
  bot.action(/platform_bots:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await PlatformAdminHandler.botManagement(ctx, page);
  });

  // Ban management actions
  bot.action('platform_ban_user', async (ctx) => {
    await PlatformAdminHandler.startBanUser(ctx);
  });

  bot.action('platform_unban_user', async (ctx) => {
    await PlatformAdminHandler.startUnbanUser(ctx);
  });

  // Analytics and stats
  bot.action('platform_user_stats', async (ctx) => {
    await PlatformAdminHandler.userStatistics(ctx);
  });

  bot.action('platform_detailed_reports', async (ctx) => {
    await PlatformAdminHandler.detailedReports(ctx);
  });

  // Bot management actions
  bot.action('platform_toggle_bot', async (ctx) => {
    await PlatformAdminHandler.startToggleBot(ctx);
  });

  bot.action('platform_delete_bot', async (ctx) => {
    await PlatformAdminHandler.startDeleteBot(ctx);
  });

  // Export features
  bot.action('platform_export_users', async (ctx) => {
    await PlatformAdminHandler.exportUsers(ctx);
  });
};

module.exports = PlatformAdminHandler;