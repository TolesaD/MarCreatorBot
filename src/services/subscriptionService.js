const { UserSubscription, User, WalletService } = require('../models');
const { Op } = require('sequelize');

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
    
    // Create subscription
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    
    const subscription = await UserSubscription.create({
      user_id: userId,
      tier: 'premium',
      status: 'active',
      monthly_price: 5.00,
      currency: 'BOM',
      current_period_start: now,
      current_period_end: periodEnd,
      auto_renew: true
    });
    
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
      { where: { telegram_id: userId } }
    );
    
    console.log(`🎫 User ${userId} upgraded to premium subscription`);
    
    return subscription;
  }
  
  async cancelSubscription(userId) {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription || subscription.tier !== 'premium') {
      throw new Error('No active premium subscription found.');
    }
    
    await subscription.update({
      status: 'cancelled',
      auto_renew: false
    });
    
    await User.update(
      { premium_status: 'freemium' },
      { where: { telegram_id: userId } }
    );
    
    console.log(`❌ User ${userId} cancelled premium subscription`);
    
    return subscription;
  }
  
  async checkFeatureAccess(userId, feature) {
    const tier = await this.getSubscriptionTier(userId);
    
    const featureLimits = {
      bot_creation: {
        freemium: 5,
        premium: 9999
      },
      broadcasts: {
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
      pin_start_message: {
        freemium: false,
        premium: true
      },
      ads: {
        freemium: true,
        premium: false
      }
    };
    
    return featureLimits[feature] ? featureLimits[feature][tier] : null;
  }
  
  async processAutoRenewals() {
    const now = new Date();
    const expiringSubscriptions = await UserSubscription.findAll({
      where: {
        status: 'active',
        auto_renew: true,
        current_period_end: {
          [Op.lt]: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // Within next 7 days
        }
      }
    });
    
    const results = {
      renewed: 0,
      failed: 0,
      errors: []
    };
    
    for (const subscription of expiringSubscriptions) {
      try {
        const walletBalance = await WalletService.getBalance(subscription.user_id);
        
        if (walletBalance.balance >= subscription.monthly_price) {
          // Renew subscription
          const newPeriodEnd = new Date(subscription.current_period_end);
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
          
          await subscription.update({
            current_period_start: subscription.current_period_end,
            current_period_end: newPeriodEnd
          });
          
          await WalletService.withdraw(
            subscription.user_id,
            subscription.monthly_price,
            'Auto-renew premium subscription',
            { subscription_id: subscription.id }
          );
          
          await User.update(
            { premium_expires_at: newPeriodEnd },
            { where: { telegram_id: subscription.user_id } }
          );
          
          results.renewed++;
        } else {
          // Insufficient funds, cancel subscription
          await this.cancelSubscription(subscription.user_id);
          results.failed++;
        }
      } catch (error) {
        results.errors.push({
          subscription_id: subscription.id,
          error: error.message
        });
        results.failed++;
      }
    }
    
    return results;
  }
}

module.exports = new SubscriptionService();