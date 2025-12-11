const { Markup } = require('telegraf');
const { Bot, UserBan, User, UserLog, Feedback } = require('../models');
const { escapeMarkdown, safeReplyWithMarkdown, safeEditMessageWithMarkdown } = require('../utils/helpers');

class BanHandler {
  // Check if user is banned from a bot
  static async isUserBanned(botId, userId) {
    try {
      const activeBan = await UserBan.findOne({
        where: { 
          bot_id: botId, 
          user_id: userId,
          is_active: true
        }
      });
      
      return !!activeBan;
    } catch (error) {
      console.error('Check user ban error:', error);
      return false;
    }
  }

  // Get ban information
  static async getBanInfo(botId, userId) {
    try {
      return await UserBan.findOne({
        where: { 
          bot_id: botId, 
          user_id: userId,
          is_active: true
        },
        include: [{
          model: User,
          as: 'BannedBy',
          attributes: ['username', 'first_name']
        }]
      });
    } catch (error) {
      console.error('Get ban info error:', error);
      return null;
    }
  }

  // Get user by username or ID
  static async findUser(identifier) {
    try {
      if (/^\d+$/.test(identifier)) {
        // Search by user ID
        return await User.findOne({ where: { telegram_id: parseInt(identifier) } });
      } else {
        // Search by username (remove @ if present)
        const username = identifier.replace('@', '');
        return await User.findOne({ where: { username: username } });
      }
    } catch (error) {
      console.error('Find user error:', error);
      return null;
    }
  }

  // Ban a user by username or ID
  static async banUser(ctx, botId, userIdentifier, reason = 'No reason provided') {
    try {
      const adminId = ctx.from.id;
      
      // Find the target user
      const targetUser = await this.findUser(userIdentifier);
      if (!targetUser) {
        await ctx.reply('❌ User not found. Please provide a valid username (with @) or user ID.');
        return false;
      }

      // Check if user is already banned
      const existingBan = await this.getBanInfo(botId, targetUser.telegram_id);
      if (existingBan) {
        await ctx.reply(`❌ @${targetUser.username || targetUser.telegram_id} is already banned.`);
        return false;
      }

      // Create ban record
      await UserBan.create({
        bot_id: botId,
        user_id: targetUser.telegram_id,
        banned_by: adminId,
        reason: reason,
        is_active: true,
        banned_at: new Date()
      });

      // Update user's ban status in main user table
      await targetUser.update({
        is_banned: true,
        ban_reason: reason,
        banned_at: new Date()
      });

      // Notify the banned user if possible
      const botInstance = ctx.miniBotManager?.getBotInstanceByDbId(botId);
      if (botInstance) {
        try {
          await botInstance.telegram.sendMessage(
            targetUser.telegram_id,
            `🚫 *You have been banned*\n\n` +
            `You can no longer use this bot.\n\n` +
            `*Reason:* ${escapeMarkdown(reason)}\n\n` +
            `Contact the bot administrator if you believe this is a mistake.`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          console.log('Could not notify banned user:', error.message);
        }
      }

      await ctx.reply(
        `✅ <b>User Banned Successfully</b>\n\n` +
        `<b>User:</b> ${escapeMarkdown(targetUser.first_name)}${targetUser.username ? ` (@${escapeMarkdown(targetUser.username)})` : ''}\n` +
        `<b>User ID:</b> <code>${targetUser.telegram_id}</code>\n` +
        `<b>Reason:</b> ${escapeMarkdown(reason)}\n` +
        `<b>Banned by:</b> ${escapeMarkdown(ctx.from.first_name)}`,
        { parse_mode: 'HTML' }
      );

      return true;

    } catch (error) {
      console.error('Ban user error:', error);
      await ctx.reply('❌ Error banning user.');
      return false;
    }
  }

  // Unban a user by username or ID
  static async unbanUser(ctx, botId, userIdentifier) {
    try {
      const adminId = ctx.from.id;
      
      // Find the target user
      const targetUser = await this.findUser(userIdentifier);
      if (!targetUser) {
        await ctx.reply('❌ User not found. Please provide a valid username (with @) or user ID.');
        return false;
      }

      // Find active ban
      const activeBan = await this.getBanInfo(botId, targetUser.telegram_id);
      if (!activeBan) {
        await ctx.reply(`❌ @${targetUser.username || targetUser.telegram_id} is not currently banned.`);
        return false;
      }

      // Update ban record
      await activeBan.update({
        is_active: false,
        unbanned_at: new Date(),
        unbanned_by: adminId
      });

      // Update user's ban status in main user table
      await targetUser.update({
        is_banned: false,
        ban_reason: null,
        banned_at: null
      });

      // Notify the unbanned user if possible
      const botInstance = ctx.miniBotManager?.getBotInstanceByDbId(botId);
      if (botInstance) {
        try {
          await botInstance.telegram.sendMessage(
            targetUser.telegram_id,
            `✅ *Your access has been restored*\n\n` +
            `You can now use the bot again.\n\n` +
            `Welcome back! 🎉`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          console.log('Could not notify unbanned user:', error.message);
        }
      }

      await ctx.reply(
        `✅ <b>User Unbanned Successfully</b>\n\n` +
        `<b>User:</b> ${escapeMarkdown(targetUser.first_name)}${targetUser.username ? ` (@${escapeMarkdown(targetUser.username)})` : ''}\n` +
        `<b>User ID:</b> <code>${targetUser.telegram_id}</code>\n` +
        `<b>Unbanned by:</b> ${escapeMarkdown(ctx.from.first_name)}`,
        { parse_mode: 'HTML' }
      );

      return true;

    } catch (error) {
      console.error('Unban user error:', error);
      await ctx.reply('❌ Error unbanning user.');
      return false;
    }
  }

  // Show banned users list
  static async showBannedUsers(ctx, botId) {
    try {
      const bannedUsers = await UserBan.findAll({
        where: { 
          bot_id: botId,
          is_active: true 
        },
        include: [
          {
            model: User,
            as: 'User',
            attributes: ['username', 'first_name', 'last_name', 'telegram_id']
          },
          {
            model: User,
            as: 'BannedBy',
            attributes: ['username', 'first_name']
          }
        ],
        order: [['banned_at', 'DESC']]
      });

      let message = `🚫 *Banned Users*\n\n`;

      if (bannedUsers.length === 0) {
        message += `No users are currently banned.`;
      } else {
        message += `*Total Banned:* ${bannedUsers.length}\n\n`;
        
        bannedUsers.forEach((ban, index) => {
          const userInfo = ban.User?.username ? 
            `@${ban.User.username}` : 
            `${ban.User?.first_name || 'Unknown'} (ID: ${ban.user_id})`;
          
          const adminInfo = ban.BannedBy?.username ? 
            `@${ban.BannedBy.username}` : 
            ban.BannedBy?.first_name || 'Unknown';
          
          const banDate = new Date(ban.banned_at).toLocaleDateString();
          const reason = ban.reason || 'No reason provided';
          
          message += `*${index + 1}. ${userInfo}*\n` +
            `   👮 Banned by: ${adminInfo}\n` +
            `   📅 Date: ${banDate}\n` +
            `   📝 Reason: ${reason}\n\n`;
        });
      }

      const keyboardButtons = [];

      if (bannedUsers.length > 0) {
        // Add unban buttons for first 5 users
        bannedUsers.slice(0, 5).forEach(ban => {
          const displayName = ban.User?.username ? 
            `@${ban.User.username}` : 
            `User${ban.user_id}`.substring(0, 10);
          
          keyboardButtons.push([
            Markup.button.callback(
              `✅ Unban ${displayName}`,
              `unban_user_${botId}_${ban.user_id}`
            )
          ]);
        });

        keyboardButtons.push([
          Markup.button.callback('🔄 Refresh List', `banned_users_${botId}`)
        ]);
      }

      keyboardButtons.push([
        Markup.button.callback('👤 Ban User', `ban_user_${botId}`),
        Markup.button.callback('🔙 Back to Admin', 'mini_dashboard')
      ]);

      const keyboard = Markup.inlineKeyboard(keyboardButtons);

      if (ctx.updateType === 'callback_query') {
        await safeEditMessageWithMarkdown(ctx, message, keyboard);
      } else {
        await safeReplyWithMarkdown(ctx, message, keyboard);
      }

    } catch (error) {
      console.error('Show banned users error:', error);
      await ctx.reply('❌ Error loading banned users list.');
    }
  }

  // Start ban user process
  static async startBanUser(ctx, botId) {
    try {
      await ctx.answerCbQuery();
      
      this.banSessions = this.banSessions || new Map();
      this.banSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_user_identifier'
      });

      await ctx.reply(
        `🚫 *Ban User*\n\n` +
        `Please send the username (with @) or user ID of the user to ban:\n\n` +
        `*Examples:*\n` +
        `• @username\n` +
        `• 123456789\n\n` +
        `*Cancel:* Type /cancel`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', `ban_management_${botId}`)]
          ])
        }
      );

    } catch (error) {
      console.error('Start ban user error:', error);
      await ctx.reply('❌ Error starting ban process.');
    }
  }

  // Process ban user input
  static async processBanUser(ctx, botId, userIdentifier) {
    try {
      if (userIdentifier === '/cancel') {
        this.banSessions?.delete(ctx.from.id);
        await ctx.reply('❌ Ban process cancelled.');
        await this.showBanManagement(ctx, botId);
        return;
      }

      this.banSessions?.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_ban_reason',
        userIdentifier: userIdentifier
      });

      await ctx.reply(
        `🚫 *Ban User - Reason*\n\n` +
        `User: ${userIdentifier}\n\n` +
        `Please provide the reason for banning this user:\n\n` +
        `*Cancel:* Type /cancel`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', `ban_management_${botId}`)]
          ])
        }
      );

    } catch (error) {
      console.error('Process ban user error:', error);
      await ctx.reply('❌ Error processing ban.');
    }
  }

  // Complete ban process
  static async completeBanUser(ctx, botId, userIdentifier, reason) {
    try {
      await this.banUser(ctx, botId, userIdentifier, reason);
      this.banSessions?.delete(ctx.from.id);
      await this.showBanManagement(ctx, botId);

    } catch (error) {
      console.error('Complete ban user error:', error);
      await ctx.reply('❌ Error completing ban process.');
    }
  }

  // Handle ban command
  static async handleBanCommand(ctx, userIdentifier, reason) {
    try {
      const { metaBotInfo } = ctx;
      if (!metaBotInfo) {
        await ctx.reply('❌ This command can only be used in mini-bots.');
        return;
      }

      // Check admin permissions
      const isAdmin = await ctx.miniBotManager?.checkAdminAccess(metaBotInfo.mainBotId, ctx.from.id);
      if (!isAdmin) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      await this.banUser(ctx, metaBotInfo.mainBotId, userIdentifier, reason);

    } catch (error) {
      console.error('Handle ban command error:', error);
      await ctx.reply('❌ Error processing ban command.');
    }
  }

  // Handle unban command
  static async handleUnbanCommand(ctx, userIdentifier) {
    try {
      const { metaBotInfo } = ctx;
      if (!metaBotInfo) {
        await ctx.reply('❌ This command can only be used in mini-bots.');
        return;
      }

      // Check admin permissions
      const isAdmin = await ctx.miniBotManager?.checkAdminAccess(metaBotInfo.mainBotId, ctx.from.id);
      if (!isAdmin) {
        await ctx.reply('❌ Admin access required.');
        return;
      }

      await this.unbanUser(ctx, metaBotInfo.mainBotId, userIdentifier);

    } catch (error) {
      console.error('Handle unban command error:', error);
      await ctx.reply('❌ Error processing unban command.');
    }
  }

  // Ban middleware for mini-bots
  static banCheckMiddleware() {
    return async (ctx, next) => {
      try {
        const { metaBotInfo } = ctx;
        if (!metaBotInfo || !ctx.from) {
          return next();
        }

        // Skip ban check for admins
        const isAdmin = await ctx.miniBotManager?.checkAdminAccess(metaBotInfo.mainBotId, ctx.from.id);
        if (isAdmin) {
          return next();
        }

        // Check if user is banned
        const isBanned = await BanHandler.isUserBanned(metaBotInfo.mainBotId, ctx.from.id);
        if (isBanned) {
          const banInfo = await BanHandler.getBanInfo(metaBotInfo.mainBotId, ctx.from.id);
          await ctx.reply(
            `🚫 *Access Denied*\n\n` +
            `You have been banned from using this bot.\n\n` +
            `*Reason:* ${banInfo?.reason || 'No reason provided'}\n\n` +
            `Contact the bot administrator if you believe this is a mistake.`,
            { parse_mode: 'Markdown' }
          );
          return;
        }

        return next();

      } catch (error) {
        console.error('Ban check middleware error:', error);
        return next();
      }
    };
  }

   // Show ban management interface to admins
  static async showBanManagement(ctx, botId) {
    try {
      const bannedUsers = await UserBan.count({
        where: { 
          bot_id: botId,
          is_active: true 
        }
      });

      // Simple message without complex formatting
      const message = `🚫 User Ban Management\n\n` +
        `Currently Banned: ${bannedUsers} users\n\n` +
        `Available Actions:\n` +
        `• View all banned users\n` +
        `• Ban new users by username or ID\n` +
        `• Unban existing users\n` +
        `• Manage ban reasons\n\n` +
        `Usage:\n` +
        `• Use /ban <username_or_id> <reason> to ban\n` +
        `• Use /unban <username_or_id> to unban\n` +
        `• Or use the buttons below`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 View Banned Users', `banned_users_${botId}`)],
        [Markup.button.callback('👤 Ban User', `ban_user_${botId}`)],
        [Markup.button.callback('🔙 Back to Admin', 'mini_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, keyboard);
      } else {
        await ctx.reply(message, keyboard);
      }

    } catch (error) {
      console.error('Show ban management error:', error);
      await ctx.reply('❌ Error loading ban management.');
    }
  }

  // Handle text input for ban process
  static async handleBanTextInput(ctx, text) {
    try {
      const userId = ctx.from.id;
      const session = this.banSessions?.get(userId);
      
      if (!session) return false;

      if (text === '/cancel') {
        this.banSessions.delete(userId);
        await ctx.reply('❌ Ban process cancelled.');
        await this.showBanManagement(ctx, session.botId);
        return true;
      }

      if (session.step === 'awaiting_user_identifier') {
        await this.processBanUser(ctx, session.botId, text);
        return true;
      }

      if (session.step === 'awaiting_ban_reason') {
        await this.completeBanUser(ctx, session.botId, session.userIdentifier, text);
        return true;
      }

      return false;

    } catch (error) {
      console.error('Handle ban text input error:', error);
      return false;
    }
  }
}

// Session storage
BanHandler.banSessions = new Map();

module.exports = BanHandler;