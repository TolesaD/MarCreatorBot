// src/services/subscriptionService.js - FIXED VERSION
const { UserSubscription, User, Wallet, WalletTransaction, BroadcastHistory, Bot, Admin } = require('../models');
const WalletService = require('./walletService');
const Sequelize = require('sequelize');

class SubscriptionService {
    
    // Get user's subscription tier
    static async getSubscriptionTier(userId) {
        try {
            // Check for active OR cancelled subscriptions still within period
            const subscription = await UserSubscription.findOne({
                where: {
                    user_id: userId,
                    status: { [Sequelize.Op.in]: ['active', 'cancelled'] },
                    current_period_end: {
                        [Sequelize.Op.gt]: new Date()
                    }
                }
            });
            
            if (subscription && subscription.tier === 'premium') {
                return 'premium';
            }
            
            return 'freemium';
        } catch (error) {
            console.error('Get subscription tier error:', error);
            return 'freemium';
        }
    }

    // Check if user can create a new bot
    static async canUserCreateBot(userId) {
        try {
            // Get user's subscription tier
            const tier = await this.getSubscriptionTier(userId);
            
            // Check if user is banned
            const user = await User.findOne({ where: { telegram_id: userId } });
            if (user && user.is_banned) {
                return {
                    canCreate: false,
                    currentCount: 0,
                    botLimit: 0,
                    remaining: 0,
                    reason: 'User is banned'
                };
            }
            
            // Count user's existing active bots
            const botCount = await Bot.count({ 
                where: { 
                    owner_id: userId,
                    is_active: true 
                } 
            });
            
            // Set limits based on subscription tier
            let botLimit;
            if (tier === 'premium') {
                botLimit = 50; // Premium users get 50 bots
            } else {
                botLimit = 5; // Freemium users get 5 bots
            }
            
            const canCreate = botCount < botLimit;
            const remaining = Math.max(0, botLimit - botCount);
            
            return {
                canCreate,
                currentCount: botCount,
                botLimit,
                remaining,
                tier
            };
            
        } catch (error) {
            console.error('canUserCreateBot error:', error);
            // Default to freemium limits on error
            return {
                canCreate: false,
                currentCount: 0,
                botLimit: 5,
                remaining: 0,
                reason: 'Error checking subscription'
            };
        }
    }
    
    // Check if user can add co-admins
    static async canUserAddCoAdmin(userId, botId) {
        try {
            // Get user's subscription tier
            const tier = await this.getSubscriptionTier(userId);
            
            // Premium users have no limit
            if (tier === 'premium') {
                return {
                    canAdd: true,
                    currentCount: 0,
                    limit: null, // null means unlimited
                    tier: 'premium',
                    reason: ''
                };
            }
            
            // Freemium users: count existing co-admins (excluding owner)
            const bot = await Bot.findByPk(botId);
            if (!bot) {
                return {
                    canAdd: false,
                    currentCount: 0,
                    limit: 1,
                    tier: 'freemium',
                    reason: 'Bot not found'
                };
            }
            
            const coAdminCount = await Admin.count({
                where: {
                    bot_id: botId,
                    admin_user_id: { [Sequelize.Op.ne]: bot.owner_id }
                }
            });
            
            // Freemium users can only have 1 co-admin
            const canAdd = coAdminCount < 1;
            
            return {
                canAdd: canAdd,
                currentCount: coAdminCount,
                limit: 1,
                tier: 'freemium',
                reason: canAdd ? '' : 'Freemium users are limited to 1 co-admin'
            };
            
        } catch (error) {
            console.error('canUserAddCoAdmin error:', error);
            return {
                canAdd: false,
                currentCount: 0,
                limit: 1,
                tier: 'freemium',
                reason: 'Error checking co-admin limit'
            };
        }
    }
    
    // Get user subscription details
    static async getUserSubscription(userId) {
        try {
            const subscription = await UserSubscription.findOne({
                where: { user_id: userId },
                order: [['created_at', 'DESC']]
            });
            
            return subscription;
        } catch (error) {
            console.error('Get user subscription error:', error);
            return null;
        }
    }
    
    // Upgrade user to premium - FIXED: No transfer to user_id=0
    static async upgradeToPremium(userId, plan = 'monthly') {
        const transaction = await UserSubscription.sequelize.transaction();
        
        try {
            console.log(`⭐ Premium upgrade for user ${userId}, plan: ${plan}`);
            
            // Get wallet balance using WalletService
            const walletService = require('./walletService');
            const balance = await walletService.getBalance(userId);
            
            // Calculate price
            const price = plan === 'yearly' ? 30 : 3;
            
            console.log(`💰 Premium upgrade price: ${price} BOM for ${plan} plan`);
            
            // Check balance
            if (balance.balance < price) {
                throw new Error(`Insufficient balance. Need ${price} BOM for ${plan}ly premium.`);
            }
            
            // Get user's wallet
            const userWallet = await Wallet.findOne({ 
                where: { user_id: userId },
                transaction 
            });
            
            if (!userWallet) {
                throw new Error('Wallet not found');
            }
            
            // Deduct from balance directly (no transfer to user_id=0)
            const newBalance = parseFloat(userWallet.balance) - price;
            await userWallet.update({
                balance: newBalance
            }, { transaction });
            
            console.log(`💸 Payment processed: ${price} BOM deducted from user ${userId}`);
            
            // Calculate dates
            const now = new Date();
            const periodEnd = new Date(now);
            
            if (plan === 'yearly') {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
            }
            
            // Cancel any existing active subscriptions
            await UserSubscription.update(
                { status: 'cancelled', cancelled_at: now },
                {
                    where: {
                        user_id: userId,
                        status: 'active'
                    },
                    transaction
                }
            );
            
            // Create new subscription
            const subscription = await UserSubscription.create({
                user_id: userId,
                tier: 'premium',
                status: 'active',
                monthly_price: price,
                currency: 'BOM',
                current_period_start: now,
                current_period_end: periodEnd,
                auto_renew: true
            }, { transaction });
            
            // Update user record
            await User.update(
                {
                    premium_status: 'premium',
                    premium_expires_at: periodEnd,
                    premium_started_at: now
                },
                {
                    where: { telegram_id: userId },
                    transaction
                }
            );
            
            // Create transaction record for the payment
            await WalletTransaction.create({
                wallet_id: userWallet.id,
                type: 'subscription',
                amount: -price,
                currency: 'BOM',
                description: `${plan}ly Premium Subscription Payment`,
                status: 'completed',
                metadata: {
                    subscription_id: subscription.id,
                    plan: plan,
                    period_start: now.toISOString(),
                    period_end: periodEnd.toISOString()
                }
            }, { transaction });
            
            await transaction.commit();
            
            console.log(`✅ Premium subscription created for user ${userId}, expires: ${periodEnd.toISOString()}`);
            
            return {
                success: true,
                tier: 'premium',
                plan: plan,
                amount: price,
                expiresAt: periodEnd,
                newBalance: newBalance,
                transactionId: subscription.id
            };
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Upgrade to premium error:', error);
            throw error;
        }
    }
    
    // Cancel subscription
    static async cancelSubscription(userId) {
        const transaction = await UserSubscription.sequelize.transaction();
        
        try {
            const activeSubscription = await UserSubscription.findOne({
                where: {
                    user_id: userId,
                    status: 'active'
                },
                transaction
            });
            
            if (!activeSubscription) {
                throw new Error('No active subscription found');
            }
            
            // Update subscription
            await activeSubscription.update({
                status: 'cancelled',
                auto_renew: false,
                cancelled_at: new Date()
            }, { transaction });
            
            await transaction.commit();
            
            return activeSubscription;
            
        } catch (error) {
            await transaction.rollback();
            console.error('Cancel subscription error:', error);
            throw error;
        }
    }
    
    // Process auto-renewals
    static async processAutoRenewals() {
        try {
            console.log('🔄 Processing subscription auto-renewals...');
            
            const today = new Date();
            
            // 1. Handle expired active subscriptions
            const activeSubscriptions = await UserSubscription.findAll({
                where: {
                    status: 'active',
                    auto_renew: true,
                    current_period_end: {
                        [Sequelize.Op.lt]: today
                    }
                }
            });
            
            let renewedCount = 0;
            let failedCount = 0;
            
            for (const subscription of activeSubscriptions) {
                try {
                    await this.renewSubscription(subscription);
                    renewedCount++;
                } catch (error) {
                    console.error(`Failed to renew subscription ${subscription.id}:`, error.message);
                    
                    await subscription.update({
                        status: 'expired',
                        auto_renew: false
                    });
                    
                    await User.update(
                        { premium_status: 'freemium' },
                        { where: { telegram_id: subscription.user_id } }
                    );
                    
                    failedCount++;
                }
            }
            
            // 2. Handle cancelled subscriptions whose period has ended
            const cancelledSubscriptions = await UserSubscription.findAll({
                where: {
                    status: 'cancelled',
                    current_period_end: {
                        [Sequelize.Op.lt]: today
                    }
                }
            });
            
            for (const subscription of cancelledSubscriptions) {
                // Update user to freemium if still premium
                await User.update(
                    { premium_status: 'freemium' },
                    { 
                        where: { 
                            telegram_id: subscription.user_id,
                            premium_status: 'premium'
                        } 
                    }
                );
                
                // Optionally update subscription status to expired
                await subscription.update({
                    status: 'expired'
                });
            }
            
            console.log(`✅ Auto-renewals completed. Renewed: ${renewedCount}, Failed: ${failedCount}`);
            
            return { renewedCount, failedCount };
            
        } catch (error) {
            console.error('Process auto-renewals error:', error);
            throw error;
        }
    }
    
    // Renew a single subscription
    static async renewSubscription(subscription) {
        const transaction = await UserSubscription.sequelize.transaction();
        
        try {
            const wallet = await Wallet.findOne({ 
                where: { user_id: subscription.user_id },
                transaction
            });
            
            if (!wallet) {
                throw new Error('Wallet not found');
            }
            
            if (parseFloat(wallet.balance) < subscription.monthly_price) {
                throw new Error('Insufficient balance for renewal');
            }
            
            // Deduct from wallet
            const newBalance = parseFloat(wallet.balance) - subscription.monthly_price;
            await wallet.update({
                balance: newBalance
            }, { transaction });
            
            // Calculate new period
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);
            
            // Update subscription
            await subscription.update({
                current_period_start: now,
                current_period_end: periodEnd
            }, { transaction });
            
            // Update user record
            await User.update(
                {
                    premium_status: 'premium',
                    premium_expires_at: periodEnd
                },
                {
                    where: { telegram_id: subscription.user_id },
                    transaction
                }
            );
            
            // Create renewal transaction
            await WalletTransaction.create({
                wallet_id: wallet.id,
                type: 'subscription',
                amount: -subscription.monthly_price,
                currency: subscription.currency,
                description: 'Monthly premium subscription renewal',
                status: 'completed',
                metadata: {
                    subscription_id: subscription.id,
                    renewal: true,
                    period_start: now.toISOString(),
                    period_end: periodEnd.toISOString()
                }
            }, { transaction });
            
            await transaction.commit();
            
            return subscription;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // Get subscription statistics (admin)
    static async getSubscriptionStats() {
        try {
            const [
                totalSubscriptions,
                activeSubscriptions,
                cancelledSubscriptions,
                totalUsers,
                premiumUsers,
                totalRevenue
            ] = await Promise.all([
                UserSubscription.count(),
                UserSubscription.count({
                    where: {
                        status: 'active',
                        current_period_end: {
                            [Sequelize.Op.gt]: new Date()
                        }
                    }
                }),
                UserSubscription.count({ where: { status: 'cancelled' } }),
                User.count(),
                User.count({ where: { premium_status: 'premium' } }),
                WalletTransaction.sum('amount', {
                    where: {
                        type: 'subscription',
                        status: 'completed'
                    }
                })
            ]);
            
            const freemiumUsers = totalUsers - premiumUsers;
            const monthlyRevenue = Math.abs(totalRevenue || 0) / (totalSubscriptions || 1) * activeSubscriptions;
            const estimatedAnnualRevenue = monthlyRevenue * 12;
            const conversionRate = totalUsers > 0 ? (premiumUsers / totalUsers) * 100 : 0;
            
            return {
                totalSubscriptions,
                activeSubscriptions,
                cancelledSubscriptions,
                freemiumUsers,
                premiumUsers,
                monthlyRevenue,
                estimatedAnnualRevenue,
                conversionRate: parseFloat(conversionRate.toFixed(1))
            };
        } catch (error) {
            console.error('Get subscription stats error:', error);
            throw error;
        }
    }
    
    // Force update subscription (admin only)
    static async forceUpdateSubscription(userId, tier, adminId, reason) {
        const transaction = await UserSubscription.sequelize.transaction();
        
        try {
            const now = new Date();
            let periodEnd;
            
            if (tier === 'premium') {
                periodEnd = new Date(now);
                periodEnd.setMonth(periodEnd.getMonth() + 1);
                
                // Cancel any existing subscriptions
                await UserSubscription.update(
                    { status: 'cancelled', cancelled_at: now },
                    {
                        where: {
                            user_id: userId,
                            status: 'active'
                        },
                        transaction
                    }
                );
                
                // Create new subscription
                await UserSubscription.create({
                    user_id: userId,
                    tier: 'premium',
                    status: 'active',
                    monthly_price: 0.00, // Free admin grant
                    currency: 'BOM',
                    current_period_start: now,
                    current_period_end: periodEnd,
                    auto_renew: false,
                    metadata: {
                        admin_granted: true,
                        admin_id: adminId,
                        reason: reason
                    }
                }, { transaction });
                
                // Update user
                await User.update(
                    {
                        premium_status: 'premium',
                        premium_expires_at: periodEnd,
                        premium_started_at: now
                    },
                    {
                        where: { telegram_id: userId },
                        transaction
                    }
                );
                
            } else {
                // Downgrade to freemium
                await UserSubscription.update(
                    {
                        status: 'cancelled',
                        cancelled_at: now,
                        auto_renew: false
                    },
                    {
                        where: {
                            user_id: userId,
                            status: 'active'
                        },
                        transaction
                    }
                );
                
                await User.update(
                    { premium_status: 'freemium' },
                    {
                        where: { telegram_id: userId },
                        transaction
                    }
                );
            }
            
            await transaction.commit();
            
            return {
                success: true,
                userId: userId,
                tier: tier,
                expiresAt: tier === 'premium' ? periodEnd : null,
                adminId: adminId,
                reason: reason,
                timestamp: now.toISOString()
            };
            
        } catch (error) {
            await transaction.rollback();
            console.error('Force update subscription error:', error);
            throw error;
        }
    }

    // Get weekly broadcast count
    static async getWeeklyBroadcastCount(userId, botId) {
        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            
            const count = await BroadcastHistory.count({
                where: {
                    bot_id: botId,
                    sent_by: userId,
                    sent_at: {
                        [Sequelize.Op.gte]: oneWeekAgo
                    }
                }
            });
            
            return count;
        } catch (error) {
            console.error('Get weekly broadcast count error:', error);
            return 0;
        }
    }

    // Check if user can broadcast
    static async canUserBroadcast(userId, botId) {
        try {
            const subscriptionTier = await this.getSubscriptionTier(userId);
            const weeklyLimit = subscriptionTier === 'premium' ? 999999 : 3; // Unlimited for premium
            
            const currentCount = await this.getWeeklyBroadcastCount(userId, botId);
            const canBroadcast = currentCount < weeklyLimit;
            const remaining = weeklyLimit - currentCount;
            
            return {
                canBroadcast: canBroadcast,
                currentCount: currentCount,
                weeklyLimit: weeklyLimit,
                remaining: remaining > 0 ? remaining : 0,
                isPremium: subscriptionTier === 'premium'
            };
        } catch (error) {
            console.error('Can user broadcast error:', error);
            // Default to allowing broadcast on error
            return {
                canBroadcast: true,
                currentCount: 0,
                weeklyLimit: 3,
                remaining: 3,
                isPremium: false
            };
        }
    }

    // Check if user can add a new channel for force join feature
    static async canUserAddChannel(userId, botId) {
        try {
            // Get user's subscription tier
            const tier = await this.getSubscriptionTier(userId);
            
            // Premium users have no limit
            if (tier === 'premium') {
                return {
                    canAdd: true,
                    currentCount: 0,
                    limit: null, // null means unlimited
                    tier: 'premium',
                    reason: ''
                };
            }
            
            // Freemium users: count existing channels for this bot
            // Note: You'll need to import the ChannelJoin model
            const ChannelJoin = require('../models').ChannelJoin;
            
            const channelCount = await ChannelJoin.count({
                where: {
                    bot_id: botId,
                    is_active: true
                }
            });
            
            // Freemium users can only have 1 channel
            const canAdd = channelCount < 1;
            
            return {
                canAdd: canAdd,
                currentCount: channelCount,
                limit: 1,
                tier: 'freemium',
                reason: canAdd ? '' : 'Freemium users are limited to 1 channel for force join feature'
            };
            
        } catch (error) {
            console.error('canUserAddChannel error:', error);
            return {
                canAdd: false,
                currentCount: 0,
                limit: 1,
                tier: 'freemium',
                reason: 'Error checking channel limit'
            };
        }
    }

    // Check feature access
    static async checkFeatureAccess(userId, feature) {
        try {
            const tier = await this.getSubscriptionTier(userId);
            
            if (tier === 'premium') {
                return true; // Premium users have access to all features
            }
            
            // Freemium feature limitations
            const freemiumLimits = {
                'pin_messages': false,
                'donation_system': false,
                'remove_ads': false,
                'unlimited_broadcasts': false,
                'advanced_analytics': false,
                'unlimited_co_admins': false,
                'co_admins': false,
                'multiple_force_join_channels': false
            };
            
            // Check if feature requires premium
            if (feature === 'co_admins') {
                return false; // Freemium users have limited co-admins
            }
            
            if (feature === 'multiple_force_join_channels') {
                return false; // Freemium users can only have 1 channel
            }
            
            return freemiumLimits[feature] || false;
        } catch (error) {
            console.error('Check feature access error:', error);
            return false;
        }
    }

    // Get user's feature status
    static async getUserFeatures(userId) {
        try {
            const tier = await this.getSubscriptionTier(userId);
            const isPremium = tier === 'premium';
            
            // Get co-admin limit info for specific user
            const coAdminInfo = {
                enabled: true, // Everyone gets co-admins
                limit: isPremium ? 'Unlimited' : '1 co-admin max',
                unlimited: isPremium
            };
            
            // Channel limit info
            const channelJoinInfo = {
                enabled: true, // Everyone gets force join feature
                limit: isPremium ? 'Unlimited' : '1 channel max',
                unlimited: isPremium
            };
            
            return {
                tier: tier,
                isPremium: isPremium,
                features: {
                    pin_messages: isPremium,
                    donation_system: isPremium,
                    remove_ads: isPremium,
                    unlimited_broadcasts: isPremium,
                    advanced_analytics: isPremium,
                    co_admins: coAdminInfo,
                    multiple_channels: isPremium,
                    force_join_channels: channelJoinInfo,
                    basic_broadcasts: true, // Everyone gets basic broadcasts
                    referral_program: true,
                    channel_management: true
                },
                limits: {
                    weekly_broadcasts: isPremium ? 'Unlimited' : '3 per week',
                    max_bots: isPremium ? '50 bots' : '5 bots',
                    max_co_admins: isPremium ? 'Unlimited' : '1 co-admin',
                    max_force_join_channels: isPremium ? 'Unlimited' : '1 channel',
                    storage: isPremium ? 'Unlimited' : '100MB'
                }
            };
        } catch (error) {
            console.error('Get user features error:', error);
            return {
                tier: 'freemium',
                isPremium: false,
                features: {
                    pin_messages: false,
                    donation_system: false,
                    remove_ads: false,
                    unlimited_broadcasts: false,
                    advanced_analytics: false,
                    co_admins: {
                        enabled: true,
                        limit: '1 co-admin max',
                        unlimited: false
                    },
                    multiple_channels: false,
                    force_join_channels: {
                        enabled: true,
                        limit: '1 channel max',
                        unlimited: false
                    },
                    basic_broadcasts: true,
                    referral_program: true,
                    channel_management: true
                },
                limits: {
                    weekly_broadcasts: '3 per week',
                    max_bots: '5 bots',
                    max_co_admins: '1 co-admin',
                    max_force_join_channels: '1 channel',
                    storage: '100MB'
                }
            };
        }
    }

    // Get subscription expiration info
    static async getSubscriptionExpiration(userId) {
        try {
            const subscription = await UserSubscription.findOne({
                where: {
                    user_id: userId,
                    status: 'active',
                    current_period_end: {
                        [Sequelize.Op.gt]: new Date()
                    }
                }
            });
            
            if (!subscription) {
                return {
                    hasActive: false,
                    expiresIn: null,
                    expiresAt: null,
                    autoRenew: false
                };
            }
            
            const now = new Date();
            const expiresAt = subscription.current_period_end;
            const expiresIn = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)); // Days
            
            return {
                hasActive: true,
                tier: subscription.tier,
                expiresIn: expiresIn,
                expiresAt: expiresAt,
                autoRenew: subscription.auto_renew,
                monthlyPrice: subscription.monthly_price,
                currency: subscription.currency
            };
        } catch (error) {
            console.error('Get subscription expiration error:', error);
            return {
                hasActive: false,
                expiresIn: null,
                expiresAt: null,
                autoRenew: false
            };
        }
    }

    // Update subscription auto-renew setting - FIXED
    static async updateAutoRenew(userId, autoRenew) {
        try {
            console.log(`🔄 Setting auto-renew to ${autoRenew} for user ${userId}`);
            
            // Find all active subscriptions for user
            const subscriptions = await UserSubscription.findAll({
                where: {
                    user_id: userId,
                    status: 'active'
                }
            });
            
            if (!subscriptions || subscriptions.length === 0) {
                console.log(`❌ No active subscription found for user ${userId}`);
                throw new Error('No active subscription found');
            }
            
            // Update auto-renew for all active subscriptions
            for (const subscription of subscriptions) {
                await subscription.update({
                    auto_renew: autoRenew,
                    updated_at: new Date()
                });
            }
            
            console.log(`✅ Auto-renew set to ${autoRenew} for user ${userId}`);
            
            return {
                success: true,
                autoRenew: autoRenew,
                updatedAt: new Date(),
                message: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'} successfully.`
            };
        } catch (error) {
            console.error('❌ Update auto-renew error:', error);
            throw new Error('Failed to update auto-renewal. Please try again.');
        }
    }

    // Get all active subscriptions (admin)
    static async getAllActiveSubscriptions() {
        try {
            const subscriptions = await UserSubscription.findAll({
                where: {
                    status: 'active',
                    current_period_end: {
                        [Sequelize.Op.gt]: new Date()
                    }
                },
                include: [{
                    model: User,
                    as: 'SubscriptionUser',
                    attributes: ['telegram_id', 'username', 'first_name', 'premium_status']
                }],
                order: [['current_period_end', 'ASC']]
            });
            
            return subscriptions.map(sub => ({
                id: sub.id,
                userId: sub.user_id,
                tier: sub.tier,
                username: sub.SubscriptionUser?.username || `User#${sub.user_id}`,
                firstName: sub.SubscriptionUser?.first_name || 'Unknown',
                monthlyPrice: sub.monthly_price,
                currency: sub.currency,
                periodStart: sub.current_period_start,
                periodEnd: sub.current_period_end,
                autoRenew: sub.auto_renew,
                daysRemaining: Math.ceil((sub.current_period_end - new Date()) / (1000 * 60 * 60 * 24))
            }));
        } catch (error) {
            console.error('Get all active subscriptions error:', error);
            return [];
        }
    }

    // Check all renewals (platform admin)
    static async checkAllRenewals() {
        try {
            console.log('🔄 Force checking all subscription renewals...');
            
            const now = new Date();
            
            // Get subscriptions that should have been renewed
            const subscriptions = await UserSubscription.findAll({
                where: {
                    status: 'active',
                    current_period_end: {
                        [Sequelize.Op.lt]: now
                    }
                }
            });
            
            let renewed = 0;
            let expired = 0;
            let processed = 0;
            
            for (const subscription of subscriptions) {
                try {
                    const wallet = await Wallet.findOne({
                        where: { user_id: subscription.user_id }
                    });
                    
                    if (wallet && parseFloat(wallet.balance) >= subscription.monthly_price) {
                        // Auto-renew
                        const newBalance = parseFloat(wallet.balance) - subscription.monthly_price;
                        await wallet.update({ balance: newBalance });
                        
                        const newPeriodEnd = new Date(now);
                        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
                        
                        await subscription.update({
                            current_period_start: now,
                            current_period_end: newPeriodEnd
                        });
                        
                        // Create renewal transaction
                        await WalletTransaction.create({
                            wallet_id: wallet.id,
                            type: 'subscription',
                            amount: -subscription.monthly_price,
                            currency: subscription.currency,
                            description: 'Monthly premium subscription renewal (force check)',
                            status: 'completed',
                            metadata: {
                                subscription_id: subscription.id,
                                renewal: true,
                                forced_check: true,
                                period_start: now.toISOString(),
                                period_end: newPeriodEnd.toISOString()
                            }
                        });
                        
                        renewed++;
                    } else {
                        // Expire subscription
                        await subscription.update({
                            status: 'expired',
                            auto_renew: false
                        });
                        
                        await User.update(
                            { premium_status: 'freemium' },
                            { where: { telegram_id: subscription.user_id } }
                        );
                        
                        expired++;
                    }
                    
                    processed++;
                } catch (error) {
                    console.error(`Error processing subscription ${subscription.id}:`, error.message);
                }
            }
            
            console.log(`✅ Force renewal check completed. Processed: ${processed}, Renewed: ${renewed}, Expired: ${expired}`);
            
            return {
                processed,
                renewed,
                expired,
                total: subscriptions.length
            };
        } catch (error) {
            console.error('Check all renewals error:', error);
            throw error;
        }
    }

    // Revoke premium (platform admin) - FIXED
    static async revokePremium(userId, adminId) {
        const transaction = await UserSubscription.sequelize.transaction();
        
        try {
            const now = new Date();
            
            console.log(`❌ Admin ${adminId} revoking premium for user ${userId}`);
            
            // Find all active subscriptions
            const activeSubscriptions = await UserSubscription.findAll({
                where: {
                    user_id: userId,
                    status: 'active'
                },
                transaction
            });
            
            let revokedCount = 0;
            
            // Revoke all active subscriptions
            for (const subscription of activeSubscriptions) {
                await subscription.update({
                    status: 'cancelled',
                    auto_renew: false,
                    cancelled_at: now,
                    metadata: {
                        ...(subscription.metadata || {}),
                        revoked_by_admin: true,
                        admin_id: adminId,
                        revocation_date: now.toISOString()
                    }
                }, { transaction });
                revokedCount++;
            }
            
            // Also update any premium user records
            const user = await User.findOne({
                where: { telegram_id: userId },
                transaction
            });
            
            if (user && user.premium_status === 'premium') {
                await user.update({
                    premium_status: 'freemium',
                    premium_expires_at: null
                }, { transaction });
            }
            
            await transaction.commit();
            
            console.log(`✅ Premium revoked for user ${userId}, ${revokedCount} subscriptions cancelled`);
            
            return {
                success: true,
                userId: userId,
                adminId: adminId,
                subscriptionsRevoked: revokedCount,
                timestamp: now.toISOString(),
                message: `Premium subscription revoked. ${revokedCount} subscription(s) cancelled. User is now on freemium.`
            };
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Revoke premium error:', error);
            throw error;
        }
    }

    // Extend premium (platform admin)
    static async extendPremium(userId, days, adminId) {
        const transaction = await UserSubscription.sequelize.transaction();
        
        try {
            const now = new Date();
            const extensionMs = days * 24 * 60 * 60 * 1000;
            
            console.log(`📅 Admin ${adminId} extending premium for user ${userId} by ${days} days`);
            
            // Find existing subscription or create one
            let subscription = await UserSubscription.findOne({
                where: {
                    user_id: userId,
                    tier: 'premium',
                    status: { [Sequelize.Op.in]: ['active', 'cancelled'] }
                },
                transaction
            });
            
            let newPeriodEnd;
            
            if (subscription) {
                // Extend existing subscription
                const currentEnd = new Date(subscription.current_period_end);
                newPeriodEnd = new Date(Math.max(currentEnd.getTime(), now.getTime()) + extensionMs);
                
                await subscription.update({
                    status: 'active',
                    current_period_end: newPeriodEnd,
                    auto_renew: false,
                    metadata: {
                        ...(subscription.metadata || {}),
                        extended_by_admin: true,
                        admin_id: adminId,
                        extension_days: days,
                        original_end: subscription.current_period_end.toISOString(),
                        new_end: newPeriodEnd.toISOString()
                    }
                }, { transaction });
            } else {
                // Create new subscription
                newPeriodEnd = new Date(now.getTime() + extensionMs);
                
                subscription = await UserSubscription.create({
                    user_id: userId,
                    tier: 'premium',
                    status: 'active',
                    monthly_price: 0.00, // Free extension
                    currency: 'BOM',
                    current_period_start: now,
                    current_period_end: newPeriodEnd,
                    auto_renew: false,
                    metadata: {
                        admin_granted: true,
                        admin_id: adminId,
                        extension_days: days,
                        free_extension: true
                    }
                }, { transaction });
            }
            
            // Update user
            await User.update(
                {
                    premium_status: 'premium',
                    premium_expires_at: newPeriodEnd,
                    premium_started_at: subscription.current_period_start
                },
                {
                    where: { telegram_id: userId },
                    transaction
                }
            );
            
            await transaction.commit();
            
            console.log(`✅ Premium extended for user ${userId}, new expiry: ${newPeriodEnd.toISOString()}`);
            
            return {
                success: true,
                userId: userId,
                days: days,
                adminId: adminId,
                newExpiry: newPeriodEnd,
                timestamp: now.toISOString(),
                message: `Premium subscription extended by ${days} days. New expiry: ${newPeriodEnd.toLocaleDateString()}`
            };
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Extend premium error:', error);
            throw error;
        }
    }

    // Process subscription webhook (for future payment integrations)
    static async processWebhook(webhookData) {
        try {
            // This is a placeholder for future payment gateway integration
            console.log('Webhook received:', webhookData);
            
            return {
                processed: true,
                message: 'Webhook processed successfully',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Process webhook error:', error);
            return {
                processed: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // NEW: Get subscription status for API (used by wallet)
    static async getSubscriptionStatus(userId) {
        try {
            const subscription = await UserSubscription.findOne({
                where: {
                    user_id: userId,
                    status: 'active'
                }
            });
            
            if (!subscription) {
                return {
                    tier: 'freemium',
                    status: 'inactive',
                    autoRenew: false,
                    nextBillingDate: null,
                    startDate: null
                };
            }
            
            return {
                tier: subscription.tier,
                status: subscription.status,
                autoRenew: subscription.auto_renew,
                nextBillingDate: subscription.current_period_end,
                startDate: subscription.current_period_start,
                currentPeriodEnd: subscription.current_period_end,
                currentPeriodStart: subscription.current_period_start
            };
        } catch (error) {
            console.error('Get subscription status error:', error);
            return {
                tier: 'freemium',
                status: 'inactive',
                autoRenew: false,
                nextBillingDate: null,
                startDate: null
            };
        }
    }

    // NEW: Toggle auto-renew (for wallet UI)
    static async toggleAutoRenew(userId) {
        try {
            const subscription = await UserSubscription.findOne({
                where: {
                    user_id: userId,
                    status: 'active'
                }
            });
            
            if (!subscription) {
                throw new Error('No active subscription found');
            }
            
            const newAutoRenew = !subscription.auto_renew;
            
            await subscription.update({
                auto_renew: newAutoRenew,
                updated_at: new Date()
            });
            
            return {
                success: true,
                autoRenew: newAutoRenew,
                message: `Auto-renewal ${newAutoRenew ? 'enabled' : 'disabled'} successfully.`
            };
        } catch (error) {
            console.error('Toggle auto-renew error:', error);
            throw new Error('Failed to toggle auto-renewal');
        }
    }
}

module.exports = SubscriptionService;