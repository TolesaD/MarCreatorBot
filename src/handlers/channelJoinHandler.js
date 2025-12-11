const { Markup } = require('telegraf');
const { Bot, ChannelJoin, UserLog } = require('../models');
const { escapeMarkdown, safeReplyWithMarkdown, safeEditMessageWithMarkdown } = require('../utils/helpers');

class ChannelJoinHandler {
  // Check if user has joined all required channels
  static async checkChannelMembership(ctx, botId, userId) {
    try {
      const requiredChannels = await ChannelJoin.findAll({
        where: { 
          bot_id: botId, 
          is_active: true 
        }
      });

      if (requiredChannels.length === 0) {
        return { required: false, joined: true };
      }

      const bot = await Bot.findByPk(botId);
      if (!bot) {
        return { required: false, joined: true };
      }

      // Get bot instance from MiniBotManager
      const MiniBotManager = require('../services/MiniBotManager');
      const botInstance = MiniBotManager.getBotInstanceByDbId(botId);
      
      if (!botInstance) {
        console.error('❌ Bot instance not found for channel verification');
        return { required: false, joined: true };
      }

      const notJoinedChannels = [];

      for (const channel of requiredChannels) {
        try {
          // Use the actual channel ID (not username) for membership check
          const channelId = channel.channel_id.startsWith('@') ? channel.channel_id : `@${channel.channel_username}`;
          
          const member = await botInstance.telegram.getChatMember(channelId, userId);
          const isMember = ['member', 'administrator', 'creator'].includes(member.status);
          
          if (!isMember) {
            notJoinedChannels.push(channel);
          }
        } catch (error) {
          console.error(`Error checking channel membership for ${channel.channel_username}:`, error.message);
          notJoinedChannels.push(channel);
        }
      }

      return {
        required: true,
        joined: notJoinedChannels.length === 0,
        notJoinedChannels: notJoinedChannels,
        totalChannels: requiredChannels.length,
        joinedChannels: requiredChannels.length - notJoinedChannels.length
      };

    } catch (error) {
      console.error('Channel membership check error:', error);
      return { required: false, joined: true };
    }
  }

  // Check channel limits based on subscription tier
static async checkChannelLimit(ctx, botId) {
  try {
    const SubscriptionService = require('../services/subscriptionService');
    
    // USE SUBSCRIPTION SERVICE INSTEAD OF DIRECT QUERY
    const channelLimit = await SubscriptionService.checkFeatureAccess(ctx.from.id, 'force_join_channels');
    
    // Count current active channels for this bot
    const activeChannelsCount = await ChannelJoin.count({
      where: { 
        bot_id: botId, 
        is_active: true 
      }
    });

    // Apply subscription limits
    if (activeChannelsCount >= channelLimit) {
      return {
        allowed: false,
        reason: `❌ ${channelLimit === 1 ? 'Freemium Limit Reached!' : 'Channel Limit Reached!'}\n\n` +
                `You have ${activeChannelsCount}/${channelLimit} active channels.\n\n` +
                `*Freemium:* 1 channel max\n` +
                `*Premium:* Unlimited channels\n\n` +
                `💎 Upgrade to Premium for unlimited channels!`,
        tier: channelLimit === 1 ? 'freemium' : 'premium',
        currentCount: activeChannelsCount,
        limit: channelLimit
      };
    }

    return { 
      allowed: true, 
      tier: channelLimit === 1 ? 'freemium' : 'premium',
      currentCount: activeChannelsCount,
      limit: channelLimit
    };
    
  } catch (error) {
    console.error('Channel limit check error:', error);
    // Default to freemium limits if there's an error
    const activeChannelsCount = await ChannelJoin.count({
      where: { 
        bot_id: botId, 
        is_active: true 
      }
    });
    
    if (activeChannelsCount >= 1) {
      return {
        allowed: false,
        reason: `❌ Channel limit reached.\n\nPlease upgrade to Premium for unlimited channels.`,
        tier: 'freemium'
      };
    }
    
    return { allowed: true, tier: 'freemium' };
  }
}

// Update the startAddChannel method to show current usage:
static async startAddChannel(ctx, botId) {
  try {
    await ctx.answerCbQuery();
    
    // Check channel limit before allowing addition
    const limitCheck = await this.checkChannelLimit(ctx, botId);
    if (!limitCheck.allowed) {
      await ctx.reply(limitCheck.reason, { 
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💎 Upgrade to Premium', 'premium_upgrade')],
          [Markup.button.callback('🔙 Back', `channel_manage_${botId}`)]
        ])
      });
      return;
    }
    
    this.channelSessions = this.channelSessions || new Map();
    this.channelSessions.set(ctx.from.id, {
      botId: botId,
      step: 'awaiting_channel_info'
    });

    await ctx.reply(
      `➕ *Add Required Channel*\n\n` +
      `Please send the channel information in this format:\n\n` +
      `\`@channel_username Channel Title\`\n\n` +
      `*Example:*\n` +
      `\`@MyChannel My Awesome Channel\`\n\n` +
      `*Important:*\n` +
      `• Your bot must be admin in the channel\n` +
      `• Use the channel username (with @)\n` +
      `• Channel title can be any descriptive name\n\n` +
      `*Your Plan:* ${limitCheck.tier === 'premium' ? '💎 Premium' : '🎫 Freemium'}\n` +
      `*Current Usage:* ${limitCheck.currentCount}/${limitCheck.limit} channels\n` +
      `*Channel Limit:* ${limitCheck.tier === 'premium' ? 'Unlimited' : '1 channel'}\n\n` +
      `*Cancel:* Type /cancel`,
      { 
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚫 Cancel', `channel_manage_${botId}`)]
        ])
      }
    );

  } catch (error) {
    console.error('Start add channel error:', error);
    await ctx.reply('❌ Error starting channel addition.');
  }
}

  // Disable all channels
  static async disableAllChannels(ctx, botId) {
    try {
      await ctx.answerCbQuery('🚫 Disabling all channels...');
      
      await ChannelJoin.update(
        { is_active: false },
        { where: { bot_id: botId, is_active: true } }
      );
      
      await ctx.reply('✅ All channels have been disabled. Users can now access the bot without joining channels.');
      await this.showChannelManagement(ctx, botId);
      
    } catch (error) {
      console.error('Disable all channels error:', error);
      await ctx.answerCbQuery('❌ Error disabling channels');
    }
  }

  // Enable all channels
  static async enableAllChannels(ctx, botId) {
    try {
      await ctx.answerCbQuery('✅ Enabling all channels...');
      
      await ChannelJoin.update(
        { is_active: true },
        { where: { bot_id: botId } }
      );
      
      await ctx.reply('✅ All channels have been enabled. Users must join all channels to access the bot.');
      await this.showChannelManagement(ctx, botId);
      
    } catch (error) {
      console.error('Enable all channels error:', error);
      await ctx.answerCbQuery('❌ Error enabling channels');
    }
  }

  // Show join wall to users
  static async showJoinWall(ctx, metaBotInfo, membershipCheck) {
    try {
      const { notJoinedChannels, totalChannels, joinedChannels } = membershipCheck;
      
      let message = `🔒 *Channel Membership Required*\n\n` +
        `To use *${metaBotInfo.botName}*, you need to join our channels:\n\n` +
        `📊 *Progress:* ${joinedChannels}/${totalChannels} channels joined\n\n` +
        `*Required Channels:*\n`;

      notJoinedChannels.forEach((channel, index) => {
        message += `${index + 1}. ${channel.channel_title}\n` +
          `   👉 ${channel.channel_username}\n\n`;
      });

      message += `\n✅ Join all channels above, then click the verification button below.`;

      const channelButtons = notJoinedChannels.map(channel => [
        Markup.button.url(
          `📢 Join ${channel.channel_title}`,
          `https://t.me/${channel.channel_username.replace('@', '')}`
        )
      ]);

      const keyboard = Markup.inlineKeyboard([
        ...channelButtons,
        [Markup.button.callback('✅ I Have Joined All Channels', `verify_channels_${metaBotInfo.mainBotId}`)],
        [Markup.button.callback('🔄 Check Again', `check_channels_${metaBotInfo.mainBotId}`)]
      ]);

      // Use reply instead of edit if there's no message to edit
      if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message) {
        try {
          await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...keyboard
          });
        } catch (error) {
          if (error.description.includes('message is not modified')) {
            // Ignore this error - message is already correct
            await ctx.answerCbQuery();
          } else {
            throw error;
          }
        }
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }

    } catch (error) {
      console.error('Show join wall error:', error);
      await ctx.reply('❌ Error loading channel requirements. Please try again.');
    }
  }

  // Handle channel verification
  static async handleChannelVerification(ctx, botId) {
    try {
      await ctx.answerCbQuery('🔍 Checking channel membership...');
      
      const userId = ctx.from.id;
      const membershipCheck = await this.checkChannelMembership(ctx, botId, userId);

      if (membershipCheck.joined) {
        // User has joined all channels, allow access
        await ctx.editMessageText(
          `✅ *Verification Successful!*\n\n` +
          `You have successfully joined all required channels.\n\n` +
          `You can now access *${ctx.metaBotInfo?.botName || 'the bot'}* features.`,
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🚀 Continue', `continue_after_verify_${botId}`)]
            ])
          }
        );
      } else {
        // User hasn't joined all channels
        await ctx.editMessageText(
          `❌ *Verification Failed*\n\n` +
          `You haven't joined all required channels yet.\n\n` +
          `Please join the remaining channels and try again.`,
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Check Again', `check_channels_${botId}`)]
            ])
          }
        );
      }

    } catch (error) {
      console.error('Channel verification error:', error);
      await ctx.answerCbQuery('❌ Verification error');
    }
  }

  // Continue after successful verification
  static async handleContinueAfterVerify(ctx, botId) {
    try {
      await ctx.answerCbQuery();
      
      const metaBotInfo = ctx.metaBotInfo;
      if (!metaBotInfo) {
        await ctx.reply('❌ Session error. Please use /start again.');
        return;
      }

      // Show the normal welcome message
      const MiniBotManager = require('../services/MiniBotManager');
      const welcomeMessage = await MiniBotManager.getWelcomeMessage(botId);
      const formattedMessage = welcomeMessage.replace(/{botName}/g, metaBotInfo.botName);
      
      await ctx.editMessageText(formattedMessage, { 
        parse_mode: 'Markdown' 
      });

    } catch (error) {
      console.error('Continue after verify error:', error);
      await ctx.reply('Welcome! How can I help you?');
    }
  }

  // Admin: Show channel management dashboard
  static async showChannelManagement(ctx, botId) {
    try {
      const channels = await ChannelJoin.findAll({
        where: { bot_id: botId },
        order: [['created_at', 'DESC']]
      });

      const activeChannels = channels.filter(c => c.is_active);
      const inactiveChannels = channels.filter(c => !c.is_active);

      let message = `📢 *Channel Join Settings*\n\n` +
        `Force users to join channels before using your bot.\n\n` +
        `*Active Channels:* ${activeChannels.length}\n` +
        `*Inactive Channels:* ${inactiveChannels.length}\n\n`;

      if (activeChannels.length > 0) {
        message += `*Required Channels:*\n`;
        activeChannels.forEach((channel, index) => {
          message += `${index + 1}. ${channel.channel_title}\n` +
            `   @${channel.channel_username}\n` +
            `   ID: \`${channel.channel_id}\`\n\n`;
        });
      } else {
        message += `⚠️ No channels configured. Users can access the bot without joining any channels.\n\n`;
      }

      message += `*Instructions:*\n` +
        `• Add your bot as admin to channels\n` +
        `• Use "Add Channel" to require joining\n` +
        `• Users must join ALL channels to access this bot`;

      const keyboardButtons = [
        [Markup.button.callback('➕ Add Channel', `channel_add_${botId}`)],
      ];

      if (activeChannels.length > 0) {
        keyboardButtons.push(
          [Markup.button.callback('🚫 Disable All Channels', `channel_disable_all_${botId}`)]
        );
      }

      if (inactiveChannels.length > 0) {
        keyboardButtons.push(
          [Markup.button.callback('✅ Enable All Channels', `channel_enable_all_${botId}`)]
        );
      }

      keyboardButtons.push(
        [Markup.button.callback('🔙 Back to Settings', `mini_settings`)]
      );

      const keyboard = Markup.inlineKeyboard(keyboardButtons);

      if (ctx.updateType === 'callback_query') {
        try {
          // Add a small random string to prevent "message not modified" error
          const uniqueMessage = message + `\n\n_Last updated: ${new Date().toLocaleTimeString()}_`;
          await ctx.editMessageText(uniqueMessage, {
            parse_mode: 'Markdown',
            ...keyboard
          });
        } catch (error) {
          if (error.description && error.description.includes('message is not modified')) {
            // Just answer the callback query without editing the message
            await ctx.answerCbQuery();
          } else {
            // Try alternative approach - send new message
            await ctx.reply(message, {
              parse_mode: 'Markdown',
              ...keyboard
            });
          }
        }
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }

    } catch (error) {
      console.error('Show channel management error:', error);
      await ctx.reply('❌ Error loading channel settings.');
    }
  }

  // Admin: Start add channel process
  static async startAddChannel(ctx, botId) {
    try {
      await ctx.answerCbQuery();
      
      // Check channel limit before allowing addition
      const limitCheck = await this.checkChannelLimit(ctx, botId);
      if (!limitCheck.allowed) {
        await ctx.reply(limitCheck.reason, { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💎 Upgrade to Premium', 'premium_upgrade')],
            [Markup.button.callback('🔙 Back', `channel_manage_${botId}`)]
          ])
        });
        return;
      }
      
      this.channelSessions = this.channelSessions || new Map();
      this.channelSessions.set(ctx.from.id, {
        botId: botId,
        step: 'awaiting_channel_info'
      });

      await ctx.reply(
        `➕ *Add Required Channel*\n\n` +
        `Please send the channel information in this format:\n\n` +
        `\`@channel_username Channel Title\`\n\n` +
        `*Example:*\n` +
        `\`@MyChannel My Awesome Channel\`\n\n` +
        `*Important:*\n` +
        `• Your bot must be admin in the channel\n` +
        `• Use the channel username (with @)\n` +
        `• Channel title can be any descriptive name\n\n` +
        `*Your Plan:* ${limitCheck.tier === 'premium' ? '💎 Premium' : '🎫 Freemium'}\n` +
        `*Channel Limit:* ${limitCheck.tier === 'premium' ? 'Unlimited' : '1 channel'}\n\n` +
        `*Cancel:* Type /cancel`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Cancel', `channel_manage_${botId}`)]
          ])
        }
      );

    } catch (error) {
      console.error('Start add channel error:', error);
      await ctx.reply('❌ Error starting channel addition.');
    }
  }

  // Admin: Process channel addition
  static async processAddChannel(ctx, botId, input) {
  try {
    if (input === '/cancel') {
      this.channelSessions?.delete(ctx.from.id);
      await ctx.reply('❌ Channel addition cancelled.');
      await this.showChannelManagement(ctx, botId);
      return;
    }

    // Check channel limit again (safety measure)
    const limitCheck = await this.checkChannelLimit(ctx, botId);
    if (!limitCheck.allowed) {
      await ctx.reply(limitCheck.reason, { 
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💎 Upgrade to Premium', 'premium_upgrade')],
          [Markup.button.callback('🔙 Back', `channel_manage_${botId}`)]
        ])
      });
      this.channelSessions?.delete(ctx.from.id);
      return;
    }

    // Parse input: "@username Channel Title" or "channel_id @username Channel Title"
    const match = input.match(/^(@[a-zA-Z0-9_]+)\s+(.+)$/);
    if (!match) {
      await ctx.reply(
        '❌ Invalid format. Please use:\n\n' +
        '`@channel_username Channel Title`\n\n' +
        '*Example:*\n' +
        '`@MyChannel My Awesome Channel`\n\n' +
        '*Important:* Your bot must be admin in the channel!',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const [, channelUsername, channelTitle] = match;
    
    // Use the username as the channel ID (Telegram API can handle both)
    const channelId = channelUsername;

    // Check if channel already exists
    const existingChannel = await ChannelJoin.findOne({
      where: { 
        bot_id: botId, 
        channel_username: channelUsername 
      }
    });

    if (existingChannel) {
      await existingChannel.update({ is_active: true });
      await ctx.reply(`✅ Channel "${channelTitle}" re-enabled successfully!`);
    } else {
      await ChannelJoin.create({
        bot_id: botId,
        channel_id: channelId,
        channel_username: channelUsername,
        channel_title: channelTitle,
        is_active: true
      });
      await ctx.reply(`✅ Channel "${channelTitle}" added successfully!\n\n` +
        `*Important:* Make sure your bot is admin in @${channelUsername.replace('@', '')} for the force join to work!`,
        { parse_mode: 'Markdown' }
      );
    }

    this.channelSessions?.delete(ctx.from.id);
    await this.showChannelManagement(ctx, botId);

  } catch (error) {
    console.error('Process add channel error:', error);
    await ctx.reply('❌ Error adding channel. Please make sure:\n\n• The channel exists\n• Your bot is admin in the channel\n• You used the correct format');
  }
}

  // Handle text input for channel sessions
  static async handleChannelTextInput(ctx, text) {
    try {
      const userId = ctx.from.id;
      const session = this.channelSessions?.get(userId);
      
      if (!session) return false;

      if (text === '/cancel') {
        this.channelSessions.delete(userId);
        await ctx.reply('❌ Channel addition cancelled.');
        await this.showChannelManagement(ctx, session.botId);
        return true;
      }

      if (session.step === 'awaiting_channel_info') {
        await this.processAddChannel(ctx, session.botId, text);
        return true;
      }

      return false;

    } catch (error) {
      console.error('Handle channel text input error:', error);
      return false;
    }
  }

  // Middleware for channel verification
  static channelVerificationMiddleware() {
    return async (ctx, next) => {
      try {
        const { metaBotInfo } = ctx;
        if (!metaBotInfo || !ctx.from) {
          return next();
        }

        // Skip verification for admins
        const isAdmin = await ctx.miniBotManager?.checkAdminAccess(metaBotInfo.mainBotId, ctx.from.id);
        if (isAdmin) {
          return next();
        }

        // Check channel membership
        const membershipCheck = await this.checkChannelMembership(
          ctx, 
          metaBotInfo.mainBotId, 
          ctx.from.id
        );

        if (membershipCheck.required && !membershipCheck.joined) {
          // Show join wall instead of proceeding
          await this.showJoinWall(ctx, metaBotInfo, membershipCheck);
          return;
        }

        return next();

      } catch (error) {
        console.error('Channel verification middleware error:', error);
        return next();
      }
    };
  }

  // Register callback handlers
  static registerCallbacks(bot) {
    console.log('🔄 Registering channel join callback handlers...');
    
    bot.action(/^channel_manage_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.showChannelManagement(ctx, botId);
    });
    
    bot.action(/^channel_add_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.startAddChannel(ctx, botId);
    });
    
    bot.action(/^channel_disable_all_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.disableAllChannels(ctx, botId);
    });
    
    bot.action(/^channel_enable_all_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.enableAllChannels(ctx, botId);
    });
    
    bot.action(/^channel_test_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.handleTestChannelCheck(ctx, botId);
    });
    
    bot.action(/^verify_channels_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.handleChannelVerification(ctx, botId);
    });
    
    bot.action(/^check_channels_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.handleChannelVerification(ctx, botId);
    });
    
    bot.action(/^continue_after_verify_(.+)/, async (ctx) => {
      const botId = ctx.match[1];
      await ChannelJoinHandler.handleContinueAfterVerify(ctx, botId);
    });
    
    bot.action('premium_upgrade', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        `💎 *Premium Subscription*\n\n` +
        `Upgrade to Premium to unlock:\n` +
        `• Unlimited force join channels\n` +
        `• Advanced bot features\n` +
        `• Priority support\n\n` +
        `*Monthly Price:* 3 BOM\n\n` +
        `Contact @BotomicsSupportBot to upgrade your account.`,
        { parse_mode: 'Markdown' }
      );
    });
    
    console.log('✅ Channel join callback handlers registered');
  }
}

// Session storage for channel addition
ChannelJoinHandler.channelSessions = new Map();

module.exports = ChannelJoinHandler;