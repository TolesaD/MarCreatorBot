const { UserSubscription, User, WalletService, Bot, BroadcastHistory, BotAdSettings } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../../database/db').sequelize;

class SubscriptionService {
  async getUserSubscription(userId) {
    return await UserSubscription.findOne({
      where: { 
        user_id: userId,
        status: 'active'
      },
      order: [['created_at', 'DESC']]
    });
  }
  
  async getSubscriptionTier(userId) {
    const subscription = await this.getUserSubscription(userId);
    
    if (subscription && subscription.tier === 'premium') {
      // Check if subscription is still valid
      if (new Date() < new Date(subscription.current_period_end)) {
        return 'premium';
      } else {
        // Subscription expired, downgrade to freemium
        await subscription.update({ status: 'expired' });
        await User.update(
          { premium_status: 'freemium' },
          { where: { telegram_id: userId } }
        );
        return 'freemium';
      }
    }
    
    return 'freemium';
  }
  
  async upgradeToPremium(userId) {
    const currentTier = await this.getSubscriptionTier(userId);
    
    if (currentTier === 'premium') {
      throw new Error('User is already on premium tier.');
    }
    
    // Check wallet balance (5 BOM per month)
    const walletBalance = await WalletService.getBalance(userId);
    if (walletBalance.balance < 5) {
      throw new Error('Insufficient BOM balance. Need 5 BOM for premium subscription.');
    }
    
    if (walletBalance.isFrozen) {
      throw new Error('Wallet is frozen. Cannot upgrade subscription.');
    }
    
    const transaction = await sequelize.transaction();
    
    try {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      
      // Create subscription
      const subscription = await UserSubscription.create({
        user_id: userId,
        tier: 'premium',
        status: 'active',
        monthly_price: 5.00,
        currency: 'BOM',
        current_period_start: now,
        current_period_end: periodEnd,
        auto_renew: true
      }, { transaction });
      
      // Deduct from wallet
      await WalletService.withdraw(
        userId, 
        5, 
        'Monthly premium subscription',
        { subscription_id: subscription.id }
      );
      
      // Update user record
      await User.update(
        { 
          premium_status: 'premium',
          premium_expires_at: periodEnd
        },
        { 
          where: { telegram_id: userId },
          transaction 
        }
      );
      
      await transaction.commit();
      
      console.log(`🎫 User ${userId} upgraded to premium subscription`);
      
      return subscription;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async cancelSubscription(userId) {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription || subscription.tier !== 'premium') {
      throw new Error('No active premium subscription found.');
    }
    
    await subscription.update({
      status: 'cancelled',
      auto_renew: false,
      cancelled_at: new Date()
    });
    
    await User.update(
      { premium_status: 'freemium' },
      { where: { telegram_id: userId } }
    );
    
    console.log(`❌ User ${userId} cancelled premium subscription`);
    
    return subscription;
  }
  
  async processSubscriptionPayment(userId) {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription || subscription.tier !== 'premium') {
      throw new Error('No active premium subscription.');
    }
    
    // Check if it's time for renewal
    const now = new Date();
    if (now < new Date(subscription.current_period_end)) {
      throw new Error('Subscription not due for renewal yet.');
    }
    
    const walletBalance = await WalletService.getBalance(userId);
    
    if (walletBalance.balance < subscription.monthly_price) {
      // Insufficient funds - cancel subscription
      await this.cancelSubscription(userId);
      throw new Error('Insufficient funds for subscription renewal. Subscription cancelled.');
    }
    
    if (walletBalance.isFrozen) {
      throw new Error('Wallet is frozen. Cannot process subscription payment.');
    }
    
    const transaction = await sequelize.transaction();
    
    try {
      // Process payment
      await WalletService.withdraw(
        userId,
        subscription.monthly_price,
        `Monthly premium subscription renewal`,
        { subscription_id: subscription.id }
      );
      
      // Update subscription dates
      const newPeriodStart = new Date(subscription.current_period_end);
      const newPeriodEnd = new Date(newPeriodStart);
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      
      await subscription.update({
        current_period_start: newPeriodStart,
        current_period_end: newPeriodEnd,
        last_payment_date: now,
        payment_count: (subscription.payment_count || 0) + 1
      }, { transaction });
      
      await User.update(
        { premium_expires_at: newPeriodEnd },
        { 
          where: { telegram_id: userId },
          transaction 
        }
      );
      
      await transaction.commit();
      
      console.log(`🔄 Subscription renewed for user ${userId}`);
      
      return subscription;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async checkFeatureAccess(userId, feature) {
    const tier = await this.getSubscriptionTier(userId);
    
    const featureLimits = {
      bot_creation: {
        freemium: 5,
        premium: 9999
      },
      broadcasts_per_week: {
        freemium: 3,
        premium: 9999
      },
      co_admins: {
        freemium: 1,
        premium: 9999
      },
      force_join_channels: {
        freemium: 1,
        premium: 9999
      },
      donation_system: {
        freemium: false,
        premium: true
      },
      pin_messages: {
        freemium: false,
        premium: true
      },
      remove_ads: {
        freemium: false,
        premium: true
      },
      custom_welcome_message: {
        freemium: false,
        premium: true
      },
      advanced_analytics: {
        freemium: false,
        premium: true
      },
      api_access: {
        freemium: false,
        premium: true
      }
    };
    
    return featureLimits[feature] ? featureLimits[feature][tier] : null;
  }

  async getWeeklyBroadcastCount(userId, botId) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const broadcastCount = await BroadcastHistory.count({
      where: {
        bot_id: botId,
        sent_by: userId,
        created_at: {
          [Op.gte]: oneWeekAgo
        }
      }
    });
    
    return broadcastCount;
  }

  async canUserBroadcast(userId, botId) {
    const weeklyLimit = await this.checkFeatureAccess(userId, 'broadcasts_per_week');
    const currentCount = await this.getWeeklyBroadcastCount(userId, botId);
    
    return {
      canBroadcast: currentCount < weeklyLimit,
      currentCount,
      weeklyLimit,
      remaining: weeklyLimit - currentCount
    };
  }

  async getUserBotCount(userId) {
    return await Bot.count({ where: { owner_id: userId } });
  }

  async canUserCreateBot(userId) {
    const botLimit = await this.checkFeatureAccess(userId, 'bot_creation');
    const currentCount = await this.getUserBotCount(userId);
    
    return {
      canCreate: currentCount < botLimit,
      currentCount,
      botLimit,
      remaining: botLimit - currentCount
    };
  }
  
  async getUserAdStatus(userId, botId) {
    const tier = await this.getSubscriptionTier(userId);
    
    if (tier === 'premium') {
      return { canEnableAds: true, reason: 'Premium user' };
    }
    
    // For freemium users, check if they have ads enabled (they shouldn't)
    const adSettings = await BotAdSettings.findOne({ where: { bot_id: botId } });
    if (adSettings && adSettings.is_ad_enabled) {
      return { 
        canEnableAds: false, 
        reason: 'Upgrade to premium to enable ad system'
      };
    }
    
    return { canEnableAds: false, reason: 'Premium feature only' };
  }
  
  async processAutoRenewals() {
    const now = new Date();
    const expiringSubscriptions = await UserSubscription.findAll({
      where: {
        status: 'active',
        auto_renew: true,
        current_period_end: {
          [Op.lt]: new Date(now.getTime() + 24 * 60 * 60 * 1000) // Within next 24 hours
        }
      }
    });
    
    const results = {
      renewed: 0,
      failed: 0,
      cancelled: 0,
      errors: []
    };
    
    for (const subscription of expiringSubscriptions) {
      try {
        const walletBalance = await WalletService.getBalance(subscription.user_id);
        
        if (walletBalance.balance >= subscription.monthly_price && !walletBalance.isFrozen) {
          // Process renewal
          await this.processSubscriptionPayment(subscription.user_id);
          results.renewed++;
          
        } else {
          // Insufficient funds or frozen wallet, cancel subscription
          await this.cancelSubscription(subscription.user_id);
          results.cancelled++;
          
          // Notify user
          try {
            const user = await User.findOne({ where: { telegram_id: subscription.user_id } });
            if (user) {
              // This would be sent via bot in production
              console.log(`⚠️ Subscription cancelled for user ${subscription.user_id} due to insufficient funds`);
            }
          } catch (notifyError) {
            console.error('Failed to notify user:', notifyError);
          }
        }
      } catch (error) {
        results.errors.push({
          subscription_id: subscription.id,
          user_id: subscription.user_id,
          error: error.message
        });
        results.failed++;
      }
    }
    
    return results;
  }
  
  async getSubscriptionStats() {
    const totalSubscriptions = await UserSubscription.count();
    const activeSubscriptions = await UserSubscription.count({ 
      where: { status: 'active', tier: 'premium' } 
    });
    const freemiumUsers = await User.count({ where: { premium_status: 'freemium' } });
    const premiumUsers = await User.count({ where: { premium_status: 'premium' } });
    
    const monthlyRevenue = await UserSubscription.sum('monthly_price', {
      where: { 
        status: 'active',
        tier: 'premium'
      }
    }) || 0;
    
    const estimatedAnnualRevenue = monthlyRevenue * 12;
    
    return {
      totalSubscriptions,
      activeSubscriptions,
      freemiumUsers,
      premiumUsers,
      monthlyRevenue: parseFloat(monthlyRevenue),
      estimatedAnnualRevenue: parseFloat(estimatedAnnualRevenue),
      conversionRate: premiumUsers / (freemiumUsers + premiumUsers) * 100
    };
  }
  
  async forceUpdateSubscription(userId, tier, adminId, notes = '') {
    const user = await User.findOne({ where: { telegram_id: userId } });
    
    if (!user) {
      throw new Error('User not found.');
    }
    
    const transaction = await sequelize.transaction();
    
    try {
      // Cancel any existing subscription
      await UserSubscription.update(
        { status: 'cancelled' },
        { 
          where: { user_id: userId, status: 'active' },
          transaction 
        }
      );
      
      if (tier === 'premium') {
        // Create new premium subscription
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        
        await UserSubscription.create({
          user_id: userId,
          tier: 'premium',
          status: 'active',
          monthly_price: 5.00,
          currency: 'BOM',
          current_period_start: now,
          current_period_end: periodEnd,
          auto_renew: false, // Manual admin upgrade
          metadata: {
            admin_upgrade: true,
            admin_id: adminId,
            notes: notes,
            timestamp: new Date()
          }
        }, { transaction });
        
        await User.update(
          { 
            premium_status: 'premium',
            premium_expires_at: periodEnd
          },
          { 
            where: { telegram_id: userId },
            transaction 
          }
        );
        
        console.log(`🔧 Admin ${adminId} forced premium subscription for user ${userId}`);
        
      } else {
        // Downgrade to freemium
        await User.update(
          { premium_status: 'freemium' },
          { 
            where: { telegram_id: userId },
            transaction 
          }
        );
        
        console.log(`🔧 Admin ${adminId} downgraded user ${userId} to freemium`);
      }
      
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new SubscriptionService();