const { Markup } = require('telegraf');
const AdvertisingService = require('./services/advertisingService');
const SubscriptionService = require('./services/subscriptionService');

class AdvertisingHandler {
  static async showAdDashboard(ctx, botId) {
    try {
      const userId = ctx.from.id;
      const settings = await AdvertisingService.getBotAdSettings(botId);
      const bot = await require('../models/Bot').findByPk(botId);
      
      // Check if user owns the bot
      if (bot.owner_id !== userId) {
        await ctx.answerCbQuery('❌ Only bot owner can manage ads.');
        return;
      }
      
      const canEnableAds = await SubscriptionService.checkFeatureAccess(userId, 'donation_system');
      const userCount = bot.user_count || 0;
      const minUsers = settings.min_users_required;
      
      const message = `📢 *Advertising Dashboard - ${bot.bot_name}*\n\n` +
        `*Ad Status:* ${settings.is_ad_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n` +
        `*Platform Approval:* ${settings.is_approved ? '✅ Approved' : '⏳ Pending'}\n` +
        `*Current Price:* ${settings.ad_price} BOM per impression\n` +
        `*Total Revenue:* ${settings.total_ad_revenue || 0} BOM\n\n` +
        `*User Statistics:*\n` +
        `👥 Total Users: ${userCount}\n` +
        `📈 Required for Ads: ${minUsers}\n` +
        `✅ Status: ${userCount >= minUsers ? 'Eligible' : 'Not Enough Users'}\n\n` +
        `*Revenue Share (per ad):*\n` +
        `• Bot Owner: 60% (${(settings.ad_price * 0.6).toFixed(4)} BOM)\n` +
        `• Platform: 20% (${(settings.ad_price * 0.2).toFixed(4)} BOM)\n` +
        `• Users: 20% (${(settings.ad_price * 0.2).toFixed(4)} BOM)`;
      
      const keyboardButtons = [];
      
      if (!settings.is_ad_enabled && userCount >= minUsers && canEnableAds) {
        keyboardButtons.push([Markup.button.callback('🟢 Enable Ads', `enable_ads_${botId}`)]);
      }
      
      if (settings.is_ad_enabled) {
        keyboardButtons.push([Markup.button.callback('✏️ Change Ad Price', `change_ad_price_${botId}`)]);
        keyboardButtons.push([Markup.button.callback('📊 Ad Statistics', `ad_stats_${botId}`)]);
      }
      
      keyboardButtons.push([Markup.button.callback('🔙 Bot Dashboard', `bot_dashboard_${botId}`)]);
      
      const keyboard = Markup.inlineKeyboard(keyboardButtons);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Ad dashboard error:', error);
      await ctx.reply('❌ Error loading advertising dashboard.');
    }
  }
  
  static async showAdMarketplace(ctx) {
    try {
      const availableBots = await AdvertisingService.getAvailableBotsForAds();
      
      let message = `🏪 *Ad Marketplace*\n\n`;
      
      if (availableBots.length === 0) {
        message += `No bots available for advertising at the moment.\n\n`;
        message += `Bot owners can enable ads when they have 100+ users and premium subscription.`;
      } else {
        message += `*Available Bots for Advertising:*\n\n`;
        
        availableBots.forEach((settings, index) => {
          const bot = settings.Bot;
          message += `*${index + 1}. ${bot.bot_name}* (@${bot.bot_username})\n`;
          message += `   👥 Users: ${bot.user_count}\n`;
          message += `   💰 Price: ${settings.ad_price} BOM/impression\n`;
          message += `   📊 Estimated CPM: ${(settings.ad_price * 1000).toFixed(2)} BOM\n\n`;
        });
        
        message += `*How it works:*\n`;
        message += `1. Choose a bot from the list\n`;
        message += `2. Set your campaign budget\n`;
        message += `3. Create engaging ad content\n`;
        message += `4. Launch your campaign\n`;
        message += `5. Track performance in real-time`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'ad_marketplace')],
        [Markup.button.callback('🔙 Main Menu', 'start')]
      ]);
      
      if (ctx.updateType === 'callback_query') {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.replyWithMarkdown(message, keyboard);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Ad marketplace error:', error);
      await ctx.reply('❌ Error loading ad marketplace.');
    }
  }
  
  static async startAdCampaign(ctx, botId) {
    try {
      const userId = ctx.from.id;
      
      // Store session for ad campaign creation
      advertisingSessions.set(userId, {
        step: 'awaiting_campaign_title',
        botId: botId,
        data: {}
      });
      
      await ctx.editMessageText(
        `🚀 *Create Ad Campaign*\n\n` +
        `Let's create your advertising campaign!\n\n` +
        `*Step 1/3:* Campaign Title\n\n` +
        `Please enter a title for your campaign:\n` +
        `(This will help you identify your campaign)\n\n` +
        `*Cancel:* Type /cancel`,
        { parse_mode: 'Markdown' }
      );
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Start ad campaign error:', error);
      await ctx.reply('❌ Error starting ad campaign creation.');
    }
  }
}

// Session management for advertising
const advertisingSessions = new Map();

module.exports = {
  AdvertisingHandler,
  advertisingSessions
};