const { Markup } = require('telegraf');
const { User, Bot, UserLog, Feedback } = require('../models');

// Store admin management sessions
const platformAdminSessions = new Map();

class PlatformAdminHandler {
  
  // Check if user is platform creator
  static isPlatformCreator(userId) {
    return userId === 1827785384; // Your user ID
  }

  // Platform admin dashboard
  static async platformDashboard(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Platform admin access required.');
        return;
      }

      // Get platform statistics
      const totalUsers = await User.count();
      const totalBotOwners = await Bot.count({
        attributes: ['owner_id'],
        group: ['owner_id']
      });
      const totalBots = await Bot.count();
      const activeBots = await Bot.count({ where: { is_active: true } });
      const totalMessages = await Feedback.count();

      const dashboardMessage = `👑 *Platform Admin Dashboard*\n\n` +
        `📊 *Platform Statistics:*\n` +
        `👥 Total Users: ${totalUsers}\n` +
        `🤖 Bot Owners: ${totalBotOwners.length}\n` +
        `🤖 Total Bots: ${totalBots}\n` +
        `🟢 Active Bots: ${activeBots}\n` +
        `💬 Total Messages: ${totalMessages}\n\n` +
        `*Admin Actions:*`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 User Management', 'platform_users')],
        [Markup.button.callback('🤖 Bot Management', 'platform_bots')],
        [Markup.button.callback('📢 Platform Broadcast', 'platform_broadcast')],
        [Markup.button.callback('🚫 Ban Management', 'platform_bans')],
        [Markup.button.callback('🔄 Refresh Stats', 'platform_dashboard')]
      ]);

      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(dashboardMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(dashboardMessage, keyboard);
      }

      await ctx.answerCbQuery();

    } catch (error) {
      console.error('Platform dashboard error:', error);
      await ctx.reply('❌ Error loading platform dashboard.');
    }
  }

  // User management
  static async userManagement(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Access denied');
        return;
      }

      const users = await User.findAll({
        order: [['last_active', 'DESC']],
        limit: 50
      });

      let message = `👥 *User Management*\n\n` +
        `*Total Users:* ${users.length}\n\n` +
        `*Recent Users:*\n`;

      users.forEach((user, index) => {
        const userInfo = user.username ? 
          `@${user.username} (${user.first_name})` : 
          `${user.first_name} (ID: ${user.telegram_id})`;
        
        const botCount = 'N/A'; // You might want to add this to your User model
        
        message += `*${index + 1}.* ${userInfo}\n` +
          `   Last Active: ${user.last_active.toLocaleDateString()}\n\n`;
      });

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Export Users', 'platform_export_users')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });

    } catch (error) {
      console.error('User management error:', error);
      await ctx.answerCbQuery('❌ Error loading users');
    }
  }

  // Bot management
  static async botManagement(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Access denied');
        return;
      }

      const bots = await Bot.findAll({
        include: [{
          model: User,
          as: 'Owner',
          attributes: ['username', 'first_name']
        }],
        order: [['created_at', 'DESC']],
        limit: 20
      });

      let message = `🤖 *Bot Management*\n\n` +
        `*Total Bots:* ${bots.length}\n\n` +
        `*Recent Bots:*\n`;

      bots.forEach((bot, index) => {
        const ownerInfo = bot.Owner ? 
          `@${bot.Owner.username}` : 
          `User#${bot.owner_id}`;
        
        message += `*${index + 1}.* ${bot.bot_name} (@${bot.bot_username})\n` +
          `   Owner: ${ownerInfo}\n` +
          `   Status: ${bot.is_active ? '🟢 Active' : '🔴 Inactive'}\n` +
          `   Created: ${bot.created_at.toLocaleDateString()}\n\n`;
      });

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'platform_bots')],
        [Markup.button.callback('🔙 Back to Dashboard', 'platform_dashboard')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });

    } catch (error) {
      console.error('Bot management error:', error);
      await ctx.answerCbQuery('❌ Error loading bots');
    }
  }

  // Platform broadcast
  static async startPlatformBroadcast(ctx) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Access denied');
        return;
      }

      const totalUsers = await User.count();

      platformAdminSessions.set(ctx.from.id, {
        action: 'platform_broadcast',
        step: 'awaiting_message'
      });

      await ctx.editMessageText(
        `📢 *Platform Broadcast*\n\n` +
        `*Recipients:* ${totalUsers} users\n\n` +
        `This will send a message to ALL users of the platform.\n\n` +
        `Please type your broadcast message:\n\n` +
        `*Cancel:* Type /cancel`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', 'platform_dashboard')]
          ])
        }
      );

    } catch (error) {
      console.error('Start platform broadcast error:', error);
      await ctx.answerCbQuery('❌ Error starting broadcast');
    }
  }

  // Send platform broadcast
  static async sendPlatformBroadcast(ctx, message) {
    try {
      if (!this.isPlatformCreator(ctx.from.id)) {
        await ctx.reply('❌ Access denied');
        return;
      }

      const users = await User.findAll({
        attributes: ['telegram_id']
      });

      const progressMsg = await ctx.reply(`🔄 Sending platform broadcast to ${users.length} users...\n✅ Sent: 0\n❌ Failed: 0`);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          await ctx.telegram.sendMessage(user.telegram_id, message, {
            parse_mode: 'Markdown'
          });
          successCount++;

          // Update progress every 10 users
          if (i % 10 === 0) {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              progressMsg.message_id,
              null,
              `🔄 Sending platform broadcast to ${users.length} users...\n✅ Sent: ${successCount}\n❌ Failed: ${failCount}`
            );
          }

          // Small delay to avoid rate limits
          if (i % 20 === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          failCount++;
          console.error(`Failed to send to user ${user.telegram_id}:`, error.message);
        }
      }

      const successRate = ((successCount / users.length) * 100).toFixed(1);

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        `✅ *Platform Broadcast Completed!*\n\n` +
        `*Recipients:* ${users.length}\n` +
        `*✅ Successful:* ${successCount}\n` +
        `*❌ Failed:* ${failCount}\n` +
        `*📊 Success Rate:* ${successRate}%`,
        { parse_mode: 'Markdown' }
      );

      platformAdminSessions.delete(ctx.from.id);

    } catch (error) {
      console.error('Send platform broadcast error:', error);
      await ctx.reply('❌ Error sending platform broadcast: ' + error.message);
      platformAdminSessions.delete(ctx.from.id);
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

      if (session.action === 'platform_broadcast' && session.step === 'awaiting_message') {
        await this.sendPlatformBroadcast(ctx, ctx.message.text);
      }

      platformAdminSessions.delete(userId);

    } catch (error) {
      console.error('Platform admin input error:', error);
      await ctx.reply('❌ Error processing platform admin action.');
      platformAdminSessions.delete(ctx.from.id);
    }
  }

  // Check if user is in platform admin session
  static isInPlatformAdminSession(userId) {
    return platformAdminSessions.has(userId);
  }
}

// Register platform admin callbacks
PlatformAdminHandler.registerCallbacks = (bot) => {
  bot.action('platform_dashboard', async (ctx) => {
    await PlatformAdminHandler.platformDashboard(ctx);
  });

  bot.action('platform_users', async (ctx) => {
    await PlatformAdminHandler.userManagement(ctx);
  });

  bot.action('platform_bots', async (ctx) => {
    await PlatformAdminHandler.botManagement(ctx);
  });

  bot.action('platform_broadcast', async (ctx) => {
    await PlatformAdminHandler.startPlatformBroadcast(ctx);
  });

  bot.action('platform_export_users', async (ctx) => {
    await ctx.answerCbQuery('📊 Feature coming soon!');
  });

  bot.action('platform_bans', async (ctx) => {
    await ctx.answerCbQuery('🚫 Ban management coming soon!');
  });
};

module.exports = PlatformAdminHandler;