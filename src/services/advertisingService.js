const { BotAdSettings, AdCampaign, AdEvent, Bot, User, WalletService } = require('../models');

class AdvertisingService {
  async getBotAdSettings(botId) {
    let settings = await BotAdSettings.findOne({ where: { bot_id: botId } });
    
    if (!settings) {
      settings = await BotAdSettings.create({
        bot_id: botId,
        ad_price: 0.10,
        is_ad_enabled: false,
        min_users_required: 100,
        is_approved: false
      });
    }
    
    return settings;
  }
  
  async updateBotAdPrice(botId, newPrice, userId) {
    const settings = await this.getBotAdSettings(botId);
    const bot = await Bot.findByPk(botId);
    
    // Check if user owns the bot
    if (bot.owner_id !== userId) {
      throw new Error('Only bot owner can update ad settings.');
    }
    
    // Check if price was changed in the last month
    if (settings.last_price_change) {
      const lastChange = new Date(settings.last_price_change);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      if (lastChange > oneMonthAgo) {
        throw new Error('Ad price can only be changed once per month.');
      }
    }
    
    await settings.update({
      ad_price: newPrice,
      last_price_change: new Date()
    });
    
    return settings;
  }
  
  async enableBotAds(botId, userId, nicheId) {
    const settings = await this.getBotAdSettings(botId);
    const bot = await Bot.findByPk(botId);
    
    if (bot.owner_id !== userId) {
      throw new Error('Only bot owner can enable ads.');
    }
    
    // Check if bot has minimum users
    if (bot.user_count < settings.min_users_required) {
      throw new Error(`Bot needs at least ${settings.min_users_required} users to enable ads. Current: ${bot.user_count}`);
    }
    
    await settings.update({
      niche_id: nicheId,
      is_ad_enabled: true,
      is_approved: false // Needs platform approval
    });
    
    return settings;
  }
  
  async approveBotForAds(botId, approvedBy) {
    const settings = await this.getBotAdSettings(botId);
    
    await settings.update({
      is_approved: true
    });
    
    return settings;
  }
  
  async createAdCampaign(advertiserId, botId, title, content, budget) {
    const settings = await this.getBotAdSettings(botId);
    
    if (!settings.is_ad_enabled || !settings.is_approved) {
      throw new Error('Bot is not available for advertising.');
    }
    
    // Check advertiser wallet balance
    const walletBalance = await WalletService.getBalance(advertiserId);
    if (walletBalance.balance < budget) {
      throw new Error('Insufficient BOM balance for ad campaign.');
    }
    
    const campaign = await AdCampaign.create({
      advertiser_id: advertiserId,
      bot_id: botId,
      title: title,
      content: content,
      budget: budget,
      status: 'active'
    });
    
    // Reserve budget
    await WalletService.withdraw(
      advertiserId,
      budget,
      `Ad campaign: ${title}`,
      { campaign_id: campaign.id }
    );
    
    return campaign;
  }
  
  async recordAdImpression(campaignId, userId, botId) {
    const campaign = await AdCampaign.findByPk(campaignId);
    const settings = await this.getBotAdSettings(botId);
    
    if (campaign.status !== 'active') {
      return null;
    }
    
    // Calculate revenue share
    const adPrice = settings.ad_price;
    const platformShare = adPrice * 0.2; // 20%
    const botOwnerShare = adPrice * 0.6; // 60%
    const userShare = adPrice * 0.2;     // 20%
    
    const event = await AdEvent.create({
      campaign_id: campaignId,
      user_id: userId,
      bot_id: botId,
      event_type: 'impression',
      revenue: adPrice,
      platform_share: platformShare,
      bot_owner_share: botOwnerShare,
      user_share: userShare
    });
    
    // Update campaign spend
    await campaign.increment('spent', { by: adPrice });
    
    // Distribute revenue
    const bot = await Bot.findByPk(botId);
    
    // To bot owner
    await WalletService.deposit(
      bot.owner_id,
      botOwnerShare,
      'Ad revenue share',
      { event_id: event.id, type: 'bot_owner_share' }
    );
    
    // To user
    await WalletService.deposit(
      userId,
      userShare,
      'Ad watching reward',
      { event_id: event.id, type: 'user_reward' }
    );
    
    // Platform share remains in system (handled separately)
    
    // Update bot total revenue
    await settings.increment('total_ad_revenue', { by: botOwnerShare });
    await bot.increment('total_ad_revenue', { by: botOwnerShare });
    
    return event;
  }
  
  async getAvailableBotsForAds(nicheId = null) {
    const whereClause = {
      is_ad_enabled: true,
      is_approved: true
    };
    
    if (nicheId) {
      whereClause.niche_id = nicheId;
    }
    
    return await BotAdSettings.findAll({
      where: whereClause,
      include: [{
        model: Bot,
        as: 'Bot',
        attributes: ['id', 'bot_name', 'bot_username', 'user_count']
      }],
      order: [[{ model: Bot, as: 'Bot' }, 'user_count', 'DESC']]
    });
  }
  
  async getUserAdEarnings(userId) {
    const userEvents = await AdEvent.findAll({
      where: { user_id: userId },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('user_share')), 'total_earnings']
      ]
    });
    
    return userEvents[0]?.get('total_earnings') || 0;
  }
}

module.exports = new AdvertisingService();