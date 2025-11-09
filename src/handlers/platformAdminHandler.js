// src/handlers/platformAdminHandler.js - FIXED COMPLETE VERSION
const { Markup } = require('telegraf');
const { User, Bot, UserLog, Feedback, BroadcastHistory, Admin } = require('../models');
const { formatNumber, escapeMarkdown } = require('../utils/helpers');
const MiniBotManager = require('../services/MiniBotManager');

// Store admin management sessions with TTL
const platformAdminSessions = new Map();
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

// Cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

class PlatformAdminHandler {
  
  // Check if user is platform creator
  static isPlatformCreator(userId) {
    return userId === 1827785384; // Your user ID
  }

  // Fast answerCbQuery with timeout protection
  static async safeAnswerCbQuery(ctx) {
    if (ctx.updateType === 'callback_query') {
      try {
        await Promise.race([
          ctx.answerCbQuery(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 3000)
          )
        ]);
      } catch (error) {
        console.log('Callback query answer timeout or error:', error.message);
      }
    }
  }

  // Cache management
  static setCache(key, data) {
    cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  static getCache(key) {
    const item = cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > CACHE_TTL) {
      cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  // Session management with TTL
  static setSession(userId, data) {
    platformAdminSessions.set(userId, {
      ...data,
      timestamp: Date.now()
    });
  }

  static getSession(userId) {
    const session = platformAdminSessions.get(userId);
    if (!session) return null;
    
    if (Date.now() - session.timestamp > SESSION_TTL) {
      platformAdminSessions.delete(userId);
      return null;
    }
    
    return session;
  }

  // Fast platform statistics with caching
  static async getPlatformStats() {
    const cacheKey = 'platform_stats';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const stats = await Promise.allSettled([
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
              [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      const result = {
        totalUsers: stats[0].status === 'fulfilled' ? stats[0].value : 0,
        totalBotOwners: stats[1].status === 'fulfilled' ? stats[1].value : 0,
        totalBots: stats[2].status === 'fulfilled' ? stats[2].value : 0,
        activeBots: stats[3].status === 'fulfilled' ? stats[3].value : 0,
        totalMessages: stats[4].status === 'fulfilled' ? stats[4].value : 0,
        pendingMessages: stats[5].status === 'fulfilled' ? stats[5].value : 0,
        totalBroadcasts: stats[6].status === 'fulfilled' ? stats[6].value : 0,
        todayUsers: stats[7].status === 'fulfilled' ? stats[7].value : 0
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting platform stats:', error);
      return {
        totalUsers: 0, totalBotOwners: 0, totalBots: 0, activeBots: 0,
        totalMessages: 0, pendingMessages: 0, totalBroadcasts: 0, todayUsers: 0
      };
    }
  }

  // Check if user is banned - REQUIRED BY app.js
  static async checkUserBan(userId) {
    try {
      const user = await User.findOne({ 
        where: { telegram_id: userId },
        attributes: ['is_banned']
      });
      return user ? user.is_banned : false;
    } catch (error) {
      console.error('Check user ban error:', error);
      return false;
    }
  }

  // Optimized platform dashboard
  static async platformDashboard(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Platform admin access required.');
        return;
      }

      // Get stats with loading indicator
      let statsMessage = `👑 *Platform Admin Dashboard*\n\n🔄 Loading statistics...`;
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(statsMessage, { parse_mode: 'Markdown' });
      } else {
        await ctx.replyWithMarkdown(statsMessage);
      }

      const stats = await PlatformAdminHandler.getPlatformStats();

      const dashboardMessage = `👑 *Platform Admin Dashboard*\n\n` +
        `📊 *Platform Statistics:*\n` +
        `👥 Total Users: ${formatNumber(stats.totalUsers)}\n` +
        `👥 Active Today: ${formatNumber(stats.todayUsers)}\n` +
        `🤖 Bot Owners: ${formatNumber(stats.totalBotOwners)}\n` +
        `🤖 Total Bots: ${formatNumber(stats.totalBots)}\n` +
        `🟢 Active Bots: ${formatNumber(stats.activeBots)}\n` +
        `💬 Total Messages: ${formatNumber(stats.totalMessages)}\n` +
        `📨 Pending Messages: ${formatNumber(stats.pendingMessages)}\n` +
        `📢 Total Broadcasts: ${formatNumber(stats.totalBroadcasts)}\n\n` +
        `*Admin Actions:*`;

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
            parse_mode: 'Markdown',
            ...keyboard
          });
        } catch (error) {
          if (error.response?.error_code === 400 && 
              error.response.description.includes('message is not modified')) {
            await PlatformAdminHandler.safeAnswerCbQuery(ctx);
            return;
          }
          throw error;
        }
      } else {
        await ctx.replyWithMarkdown(dashboardMessage, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('Platform dashboard error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading platform dashboard.');
    }
  }

  // Optimized user management with faster queries
  static async userManagement(ctx, page = 1) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const limit = 10;
      const offset = (page - 1) * limit;

      // Use faster query with only needed fields
      const { count, rows: users } = await User.findAndCountAll({
        attributes: ['telegram_id', 'username', 'first_name', 'is_banned', 'last_active'],
        order: [['last_active', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `👥 *User Management* - Page ${page}/${totalPages}\n\n` +
        `*Total Users:* ${formatNumber(count)}\n\n` +
        `*Recent Users:*\n`;

      users.forEach((user, index) => {
        const userInfo = user.username ? 
          `@${user.username} (${user.first_name})` : 
          `${user.first_name} (ID: ${user.telegram_id})`;
        
        const status = user.is_banned ? '🚫 BANNED' : '✅ Active';
        const lastActive = user.last_active ? 
          user.last_active.toLocaleDateString() : 'Never';
        
        message += `*${offset + index + 1}.* ${userInfo}\n` +
          `   Status: ${status}\n` +
          `   Last Active: ${lastActive}\n\n`;
      });

      const keyboardButtons = [];

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
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('User management error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading users');
    }
  }

  // Optimized bot management
  static async botManagement(ctx, page = 1) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
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
        attributes: ['id', 'bot_name', 'bot_username', 'is_active', 'created_at', 'owner_id'],
        order: [['created_at', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `🤖 *Bot Management* - Page ${page}/${totalPages}\n\n` +
        `*Total Bots:* ${formatNumber(count)}\n\n` +
        `*Recent Bots:*\n`;

      bots.forEach((bot, index) => {
        const ownerInfo = bot.Owner ? 
          (bot.Owner.is_banned ? `@${bot.Owner.username} 🚫` : `@${bot.Owner.username}`) : 
          `User#${bot.owner_id}`;
        
        const status = bot.is_active ? '🟢 Active' : '🔴 Inactive';
        
        message += `*${offset + index + 1}.* ${bot.bot_name} (@${bot.bot_username})\n` +
          `   Owner: ${ownerInfo}\n` +
          `   Status: ${status}\n` +
          `   Created: ${bot.created_at.toLocaleDateString()}\n\n`;
      });

      const keyboardButtons = [];

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
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('Bot management error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading bots');
    }
  }

  // Fast ban management
  static async banManagement(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const bannedUsers = await User.findAll({
        where: { is_banned: true },
        attributes: ['telegram_id', 'username', 'first_name', 'banned_at', 'ban_reason'],
        order: [['banned_at', 'DESC']],
        limit: 15
      });

      let message = `🚫 *Ban Management*\n\n` +
        `*Banned Users:* ${bannedUsers.length}\n\n`;

      if (bannedUsers.length === 0) {
        message += `No users are currently banned.`;
      } else {
        bannedUsers.forEach((user, index) => {
          const userInfo = user.username ? 
            `@${user.username} (${user.first_name})` : 
            `${user.first_name} (ID: ${user.telegram_id})`;
          
          message += `*${index + 1}.* ${userInfo}\n` +
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
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('Ban management error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading ban list');
    }
  }

  // Start ban user process - optimized
  static async startBanUser(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      PlatformAdminHandler.setSession(ctx.from.id, {
        action: 'ban_user',
        step: 'awaiting_user_id'
      });

      const message = `🚫 *Ban User*\n\n` +
        `Please provide the user's Telegram ID or username to ban:\n\n` +
        `*Examples:*\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `*Cancel:* Type /cancel`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Cancel', 'platform_bans')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('Start ban user error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting ban process');
    }
  }

  // Start unban user process - optimized
  static async startUnbanUser(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      PlatformAdminHandler.setSession(ctx.from.id, {
        action: 'unban_user',
        step: 'awaiting_user_id'
      });

      const message = `✅ *Unban User*\n\n` +
        `Please provide the user's Telegram ID or username to unban:\n\n` +
        `*Examples:*\n` +
        `• 123456789 (User ID)\n` +
        `• @username\n\n` +
        `*Cancel:* Type /cancel`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Cancel', 'platform_bans')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('Start unban user error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting unban process');
    }
  }

  // Platform broadcast - optimized
  static async startPlatformBroadcast(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const totalUsers = await User.count({ where: { is_banned: false } });

      PlatformAdminHandler.setSession(ctx.from.id, {
        action: 'platform_broadcast',
        step: 'awaiting_message'
      });

      const message = `📢 *Platform Broadcast*\n\n` +
        `*Recipients:* ${formatNumber(totalUsers)} users\n\n` +
        `⚠️ *Important:* This will send a message to ALL users of the platform.\n\n` +
        `Please type your broadcast message:\n\n` +
        `*Cancel:* Type /cancel`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Cancel', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('Start platform broadcast error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting broadcast');
    }
  }

  // Send platform broadcast - optimized with better error handling
  static async sendPlatformBroadcast(ctx, message) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Access denied');
        return;
      }

      const users = await User.findAll({
        attributes: ['telegram_id', 'username', 'first_name'],
        where: { is_banned: false }
      });

      const progressMsg = await ctx.reply(
        `📢 *Platform Broadcast Started*\n\n` +
        `🔄 Sending to ${formatNumber(users.length)} users...\n` +
        `✅ Sent: 0\n` +
        `❌ Failed: 0\n` +
        `⏰ Estimated time: ${Math.ceil(users.length / 20)} seconds`,
        { parse_mode: 'Markdown' }
      );

      let successCount = 0;
      let failCount = 0;
      const failedUsers = [];
      const startTime = Date.now();

      // Process in batches for better performance
      const batchSize = 25;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (user) => {
          try {
            await ctx.telegram.sendMessage(user.telegram_id, message, {
              parse_mode: 'Markdown'
            });
            return { success: true, user };
          } catch (error) {
            return { success: false, user, error: error.message };
          }
        });

        const results = await Promise.allSettled(batchPromises);
        
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            const { success, user, error } = result.value;
            if (success) {
              successCount++;
            } else {
              failCount++;
              failedUsers.push({
                id: user.telegram_id,
                username: user.username,
                error: error
              });
            }
          }
        });

        // Update progress
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.ceil((users.length - i - batchSize) / 20);
        
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          progressMsg.message_id,
          null,
          `📢 *Platform Broadcast Progress*\n\n` +
          `🔄 Sending to ${formatNumber(users.length)} users...\n` +
          `✅ Sent: ${formatNumber(successCount)}\n` +
          `❌ Failed: ${formatNumber(failCount)}\n` +
          `⏰ Elapsed: ${elapsed}s | Remaining: ~${remaining}s`,
          { parse_mode: 'Markdown' }
        );

        // Rate limiting
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
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

      let resultMessage = `✅ *Platform Broadcast Completed!*\n\n` +
        `*Summary:*\n` +
        `👥 Total Recipients: ${formatNumber(users.length)}\n` +
        `✅ Successful: ${formatNumber(successCount)}\n` +
        `❌ Failed: ${formatNumber(failCount)}\n` +
        `📊 Success Rate: ${successRate}%\n` +
        `⏰ Total Time: ${totalTime} seconds\n\n`;

      if (failCount > 0) {
        resultMessage += `*Common failure reasons:*\n` +
          `• User blocked the bot\n` +
          `• User account deleted\n` +
          `• Rate limiting\n\n` +
          `Failed users: ${failedUsers.length}`;
      }

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        resultMessage,
        { parse_mode: 'Markdown' }
      );

      platformAdminSessions.delete(ctx.from.id);

    } catch (error) {
      console.error('Send platform broadcast error:', error);
      await ctx.reply('❌ Error sending platform broadcast: ' + error.message);
      platformAdminSessions.delete(ctx.from.id);
    }
  }

  // Advanced analytics - optimized
  static async advancedAnalytics(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [
        newUsers,
        newBots,
        activeUsers,
        messagesStats
      ] = await Promise.allSettled([
        User.count({ where: { created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo } } }),
        Bot.count({ where: { created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo } } }),
        User.count({ where: { last_active: { [require('sequelize').Op.gte]: thirtyDaysAgo } } }),
        Feedback.findAll({
          where: { created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo } },
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN is_replied = true THEN 1 ELSE 0 END')), 'replied']
          ],
          raw: true
        })
      ]);

      const totalMessages = messagesStats.status === 'fulfilled' ? 
        parseInt(messagesStats.value[0]?.total || 0) : 0;
      const repliedMessages = messagesStats.status === 'fulfilled' ? 
        parseInt(messagesStats.value[0]?.replied || 0) : 0;
      const replyRate = totalMessages > 0 ? ((repliedMessages / totalMessages) * 100).toFixed(1) : 0;

      const analyticsMessage = `📊 *Advanced Analytics* (Last 30 Days)\n\n` +
        `*User Growth:*\n` +
        `👥 New Users: ${formatNumber(newUsers.status === 'fulfilled' ? newUsers.value : 0)}\n` +
        `👥 Active Users: ${formatNumber(activeUsers.status === 'fulfilled' ? activeUsers.value : 0)}\n\n` +
        `*Bot Activity:*\n` +
        `🤖 New Bots: ${formatNumber(newBots.status === 'fulfilled' ? newBots.value : 0)}\n\n` +
        `*Messaging:*\n` +
        `💬 Total Messages: ${formatNumber(totalMessages)}\n` +
        `✅ Replied Messages: ${formatNumber(repliedMessages)}\n` +
        `📊 Reply Rate: ${replyRate}%\n\n` +
        `*Platform Health:*\n` +
        `🟢 System: Operational\n` +
        `📈 Trend: Growing`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Detailed Reports', 'platform_detailed_reports')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(analyticsMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(analyticsMessage, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('Advanced analytics error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading analytics');
    }
  }

  // User statistics - optimized
  static async userStatistics(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      const [
        totalUsers,
        bannedUsers,
        activeToday,
        activeWeek,
        newToday,
        newWeek,
        usersWithBots
      ] = await Promise.allSettled([
        User.count(),
        User.count({ where: { is_banned: true } }),
        User.count({ where: { last_active: { [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
        User.count({ where: { last_active: { [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
        User.count({ where: { created_at: { [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
        User.count({ where: { created_at: { [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
        User.count({ include: [{ model: Bot, as: 'OwnedBots', required: true }] })
      ]);

      const total = totalUsers.status === 'fulfilled' ? totalUsers.value : 0;
      const banned = bannedUsers.status === 'fulfilled' ? bannedUsers.value : 0;
      const withBots = usersWithBots.status === 'fulfilled' ? usersWithBots.value : 0;

      const statsMessage = `📊 *User Statistics*\n\n` +
        `*Overview:*\n` +
        `👥 Total Users: ${formatNumber(total)}\n` +
        `🚫 Banned Users: ${formatNumber(banned)}\n` +
        `✅ Active Users: ${formatNumber(total - banned)}\n\n` +
        
        `*Activity:*\n` +
        `📈 Active Today: ${formatNumber(activeToday.status === 'fulfilled' ? activeToday.value : 0)}\n` +
        `📈 Active This Week: ${formatNumber(activeWeek.status === 'fulfilled' ? activeWeek.value : 0)}\n` +
        `🆕 New Today: ${formatNumber(newToday.status === 'fulfilled' ? newToday.value : 0)}\n` +
        `🆕 New This Week: ${formatNumber(newWeek.status === 'fulfilled' ? newWeek.value : 0)}\n\n` +
        
        `*Bot Ownership:*\n` +
        `🤖 Users with Bots: ${formatNumber(withBots)}\n` +
        `📊 Bot Ownership Rate: ${total > 0 ? ((withBots / total) * 100).toFixed(1) : 0}%\n\n` +
        
        `*Platform Health:*\n` +
        `📱 User Retention: ${total > 0 ? ((activeWeek.value / total) * 100).toFixed(1) : 0}%\n` +
        `🚀 Growth Rate: ${total > 0 ? ((newWeek.value / total) * 100).toFixed(1) : 0}%`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Detailed Reports', 'platform_detailed_reports')],
        [Markup.button.callback('📋 Export Users', 'platform_export_users')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(statsMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(statsMessage, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('User statistics error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading user statistics');
    }
  }

  // Detailed reports feature - optimized
  static async detailedReports(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      // Get comprehensive platform reports
      const [
        userGrowth,
        botGrowth,
        messageStats,
        broadcastStats
      ] = await Promise.allSettled([
        // User growth over last 7 days
        User.findAll({
          where: {
            created_at: { [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          },
          attributes: [
            [require('sequelize').fn('DATE', require('sequelize').col('created_at')), 'date'],
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
          ],
          group: [require('sequelize').fn('DATE', require('sequelize').col('created_at'))],
          raw: true
        }),
        // Bot growth over last 7 days
        Bot.findAll({
          where: {
            created_at: { [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          },
          attributes: [
            [require('sequelize').fn('DATE', require('sequelize').col('created_at')), 'date'],
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
          ],
          group: [require('sequelize').fn('DATE', require('sequelize').col('created_at'))],
          raw: true
        }),
        // Message statistics
        Feedback.findAll({
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN is_replied = true THEN 1 ELSE 0 END')), 'replied']
          ],
          raw: true
        }),
        // Broadcast statistics
        BroadcastHistory.findAll({
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('SUM', require('sequelize').col('total_users')), 'total_recipients'],
            [require('sequelize').fn('AVG', require('sequelize').col('successful_sends')), 'avg_success_rate']
          ],
          raw: true
        })
      ]);

      const totalMessages = messageStats.status === 'fulfilled' ? 
        parseInt(messageStats.value[0]?.total || 0) : 0;
      const repliedMessages = messageStats.status === 'fulfilled' ? 
        parseInt(messageStats.value[0]?.replied || 0) : 0;
      const totalBroadcasts = broadcastStats.status === 'fulfilled' ? 
        parseInt(broadcastStats.value[0]?.total || 0) : 0;
      const totalRecipients = broadcastStats.status === 'fulfilled' ? 
        parseInt(broadcastStats.value[0]?.total_recipients || 0) : 0;
      const avgSuccessRate = broadcastStats.status === 'fulfilled' ? 
        parseFloat(broadcastStats.value[0]?.avg_success_rate || 0) : 0;

      let reportsMessage = `📈 *Detailed Platform Reports*\n\n` +
        `*Message Analytics:*\n` +
        `💬 Total Messages: ${formatNumber(totalMessages)}\n` +
        `✅ Replied Messages: ${formatNumber(repliedMessages)}\n` +
        `📊 Reply Rate: ${totalMessages > 0 ? ((repliedMessages / totalMessages) * 100).toFixed(1) : 0}%\n\n` +
        
        `*Broadcast Performance:*\n` +
        `📢 Total Broadcasts: ${formatNumber(totalBroadcasts)}\n` +
        `👥 Total Recipients: ${formatNumber(totalRecipients)}\n` +
        `📈 Avg Success Rate: ${avgSuccessRate.toFixed(1)}%\n\n` +
        
        `*Growth Trends (Last 7 Days):*\n`;

      // Add user growth trends
      if (userGrowth.status === 'fulfilled' && userGrowth.value.length > 0) {
        reportsMessage += `👥 User Growth: ${userGrowth.value.length} days with new users\n`;
      } else {
        reportsMessage += `👥 User Growth: No new users in last 7 days\n`;
      }

      // Add bot growth trends
      if (botGrowth.status === 'fulfilled' && botGrowth.value.length > 0) {
        reportsMessage += `🤖 Bot Growth: ${botGrowth.value.length} days with new bots\n`;
      } else {
        reportsMessage += `🤖 Bot Growth: No new bots in last 7 days\n`;
      }

      reportsMessage += `\n*Platform Insights:*\n` +
        `📱 Active User Rate: ${((userGrowth.value?.reduce((sum, day) => sum + parseInt(day.count), 0) / 7) || 0).toFixed(1)} users/day\n` +
        `🚀 Bot Creation Rate: ${((botGrowth.value?.reduce((sum, day) => sum + parseInt(day.count), 0) / 7) || 0).toFixed(1)} bots/day`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 User Statistics', 'platform_user_stats')],
        [Markup.button.callback('📋 Export Data', 'platform_export_users')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(reportsMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(reportsMessage, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('Detailed reports error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error loading detailed reports');
    }
  }

  // Start toggle bot process
  static async startToggleBot(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      PlatformAdminHandler.setSession(ctx.from.id, {
        action: 'toggle_bot',
        step: 'awaiting_bot_id'
      });

      const message = `🔄 *Toggle Bot Status*\n\n` +
        `Please provide the bot ID or username to toggle:\n\n` +
        `*Examples:*\n` +
        `• 123 (Bot ID)\n` +
        `• @botusername\n\n` +
        `*Cancel:* Type /cancel`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Cancel', 'platform_bots')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('Start toggle bot error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting toggle process');
    }
  }

  // Start delete bot process
  static async startDeleteBot(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
        return;
      }

      PlatformAdminHandler.setSession(ctx.from.id, {
        action: 'delete_bot',
        step: 'awaiting_bot_id'
      });

      const message = `🗑️ *Delete Bot*\n\n` +
        `⚠️ *Warning:* This will permanently delete the bot and all its data!\n\n` +
        `Please provide the bot ID or username to delete:\n\n` +
        `*Examples:*\n` +
        `• 123 (Bot ID)\n` +
        `• @botusername\n\n` +
        `*Cancel:* Type /cancel`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Cancel', 'platform_bots')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }

      await PlatformAdminHandler.safeAnswerCbQuery(ctx);

    } catch (error) {
      console.error('Start delete bot error:', error);
      await PlatformAdminHandler.safeAnswerCbQuery(ctx);
      await ctx.reply('❌ Error starting delete process');
    }
  }

  // User export feature
  static async exportUsers(ctx) {
    try {
      if (!PlatformAdminHandler.isPlatformCreator(ctx.from.id)) {
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ Access denied');
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
        caption: `📋 *User Export Complete*\n\n` +
                `*Total Users:* ${formatNumber(users.length)}\n` +
                `*Export Date:* ${new Date().toLocaleDateString()}\n\n` +
                `The file contains all user data in CSV format.`,
        parse_mode: 'Markdown'
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

  // Handle platform admin text input - optimized
  static async handlePlatformAdminInput(ctx) {
    try {
      const userId = ctx.from.id;
      const session = PlatformAdminHandler.getSession(userId);

      if (!session) return;

      if (ctx.message.text === '/cancel') {
        platformAdminSessions.delete(userId);
        await ctx.reply('❌ Platform admin action cancelled.');
        return;
      }

      const input = ctx.message.text.trim();

      if (session.action === 'platform_broadcast' && session.step === 'awaiting_message') {
        await PlatformAdminHandler.sendPlatformBroadcast(ctx, input);
      } else if ((session.action === 'ban_user' || session.action === 'unban_user') && session.step === 'awaiting_user_id') {
        await PlatformAdminHandler.processUserBanAction(ctx, session.action, input);
      } else if (session.action === 'toggle_bot' && session.step === 'awaiting_bot_id') {
        await PlatformAdminHandler.processBotToggle(ctx, input);
      } else if (session.action === 'delete_bot' && session.step === 'awaiting_bot_id') {
        await PlatformAdminHandler.processBotDeletion(ctx, input);
      }

      platformAdminSessions.delete(userId);

    } catch (error) {
      console.error('Platform admin input error:', error);
      await ctx.reply('❌ Error processing platform admin action.');
      platformAdminSessions.delete(ctx.from.id);
    }
  }

  // Process user ban action - optimized
  static async processUserBanAction(ctx, action, input) {
    try {
      let targetUserId;
      let targetUser;

      if (/^\d+$/.test(input)) {
        targetUserId = parseInt(input);
        targetUser = await User.findOne({ 
          where: { telegram_id: targetUserId },
          attributes: ['telegram_id', 'username', 'is_banned']
        });
      } else {
        const username = input.replace('@', '').trim();
        targetUser = await User.findOne({ 
          where: { username: username },
          attributes: ['telegram_id', 'username', 'is_banned']
        });
        if (targetUser) targetUserId = targetUser.telegram_id;
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

        await User.update({
          is_banned: true,
          banned_at: new Date(),
          ban_reason: 'Banned by platform admin'
        }, { where: { telegram_id: targetUserId } });

        // Stop user's bots
        const userBots = await Bot.findAll({ 
          where: { owner_id: targetUserId },
          attributes: ['id']
        });
        
        for (const bot of userBots) {
          try {
            await MiniBotManager.stopBot(bot.id);
            await Bot.update({ is_active: false }, { where: { id: bot.id } });
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

        await User.update({
          is_banned: false,
          banned_at: null,
          ban_reason: null
        }, { where: { telegram_id: targetUserId } });

        await ctx.reply(`✅ User @${targetUser.username || targetUser.telegram_id} has been unbanned.`);
      }

      // Clear cache since data changed
      cache.clear();

    } catch (error) {
      console.error('Process user ban action error:', error);
      await ctx.reply('❌ Error processing ban action.');
    }
  }

  // Process bot toggle
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
            await ctx.reply(`❌ Failed to activate bot: Initialization failed. Check bot token.`);
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

      // Clear cache
      cache.clear();

    } catch (error) {
      console.error('Process bot toggle error:', error);
      await ctx.reply('❌ Error toggling bot status.');
    }
  }

  // Process bot deletion
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

      // Clear cache
      cache.clear();

    } catch (error) {
      console.error('Process bot deletion error:', error);
      await ctx.reply('❌ Error deleting bot: ' + error.message);
    }
  }

  // Check if user is in platform admin session
  static isInPlatformAdminSession(userId) {
    const session = platformAdminSessions.get(userId);
    if (!session) return false;
    
    // Check TTL
    if (Date.now() - session.timestamp > SESSION_TTL) {
      platformAdminSessions.delete(userId);
      return false;
    }
    
    return true;
  }
}

// Register platform admin callbacks with error handling
PlatformAdminHandler.registerCallbacks = (bot) => {
  const callbacks = {
    'platform_dashboard': PlatformAdminHandler.platformDashboard,
    'platform_dashboard_refresh': PlatformAdminHandler.platformDashboard,
    'platform_users': (ctx) => PlatformAdminHandler.userManagement(ctx, 1),
    'platform_bots': (ctx) => PlatformAdminHandler.botManagement(ctx, 1),
    'platform_broadcast': PlatformAdminHandler.startPlatformBroadcast,
    'platform_bans': PlatformAdminHandler.banManagement,
    'platform_analytics': PlatformAdminHandler.advancedAnalytics,
    'platform_ban_user': PlatformAdminHandler.startBanUser,
    'platform_unban_user': PlatformAdminHandler.startUnbanUser,
    'platform_user_stats': PlatformAdminHandler.userStatistics,
    'platform_detailed_reports': PlatformAdminHandler.detailedReports,
    'platform_toggle_bot': PlatformAdminHandler.startToggleBot,
    'platform_delete_bot': PlatformAdminHandler.startDeleteBot,
    'platform_export_users': PlatformAdminHandler.exportUsers
  };

  // Register individual callbacks
  Object.entries(callbacks).forEach(([action, handler]) => {
    bot.action(action, async (ctx) => {
      try {
        await handler(ctx);
      } catch (error) {
        console.error(`Error in platform admin callback ${action}:`, error);
        await PlatformAdminHandler.safeAnswerCbQuery(ctx);
        await ctx.reply('❌ An error occurred. Please try again.');
      }
    });
  });

  // Register pagination callbacks
  bot.action(/platform_users:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await PlatformAdminHandler.userManagement(ctx, page);
  });

  bot.action(/platform_bots:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await PlatformAdminHandler.botManagement(ctx, page);
  });
};

module.exports = PlatformAdminHandler;