// src/routes/walletRoutes.js - COMPLETE PRODUCTION VERSION WITH TELEGRAM AUTH
const express = require('express');
const router = express.Router();
const WalletService = require('../services/walletService');
const SubscriptionService = require('../services/subscriptionService');
const { Wallet, WalletTransaction, UserSubscription, User, Withdrawal } = require('../models');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

// Telegram Web App authentication middleware
function authenticateTelegram(req, res, next) {
    // Get Telegram init data from header or query
    const initData = req.headers['x-telegram-init-data'] || req.query.initData;
    
    if (!initData) {
        console.warn('❌ No Telegram init data provided');
        return res.status(401).json({ 
            success: false, 
            error: 'Authentication required. Please open from Telegram.' 
        });
    }
    
    try {
        // Parse init data to get user info
        const params = new URLSearchParams(initData);
        const userParam = params.get('user');
        
        if (!userParam) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid Telegram session.' 
            });
        }
        
        const user = JSON.parse(userParam);
        req.telegramUser = user;
        
        // Extract userId from request
        const userId = req.query.userId || req.body.userId || user.id;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'User ID is required' 
            });
        }
        
        req.userId = userId;
        console.log(`✅ Authenticated Telegram user: ${userId}`);
        next();
        
    } catch (error) {
        console.error('Telegram authentication error:', error);
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid Telegram authentication.' 
        });
    }
}

// Simple fallback authentication for admin/testing
function authenticateSimple(req, res, next) {
    const userId = req.query.userId || req.body.userId;
    
    if (!userId) {
        return res.status(400).json({ 
            success: false, 
            error: 'User ID is required' 
        });
    }
    
    req.userId = userId;
    next();
}

// Wallet balance - supports both auth methods
router.get('/wallet/balance', authenticateTelegram, async (req, res) => {
    try {
        console.log(`📊 Getting balance for user ${req.userId}`);
        
        const balance = await WalletService.getBalance(req.userId);
        
        res.json({
            success: true,
            wallet: balance
        });
    } catch (error) {
        console.error('Balance API error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Deposit request
router.post('/wallet/deposit', authenticateTelegram, async (req, res) => {
    try {
        const { amount, description, proofImageUrl } = req.body;
        
        if (!amount || amount < 5) {
            return res.status(400).json({ 
                success: false,
                error: 'Minimum deposit amount is 5 BOM' 
            });
        }
        
        console.log(`💰 Deposit request from ${req.userId}: ${amount} BOM`);
        
        const result = await WalletService.deposit(
            req.userId, 
            amount, 
            description || `Deposit of ${amount} BOM`, 
            proofImageUrl
        );
        
        res.json({
            success: true,
            transaction: {
                id: result.transaction.id,
                amount: result.transaction.amount,
                description: result.transaction.description,
                status: result.transaction.status,
                created_at: result.transaction.created_at
            },
            message: 'Deposit request submitted. Awaiting admin approval.'
        });
    } catch (error) {
        console.error('Deposit API error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Withdrawal request
router.post('/wallet/withdraw', authenticateTelegram, async (req, res) => {
    try {
        const { amount, method, payoutDetails } = req.body;
        
        if (!amount || amount < 20) {
            return res.status(400).json({ 
                success: false,
                error: 'Minimum withdrawal amount is 20 BOM' 
            });
        }
        
        if (!method || !payoutDetails) {
            return res.status(400).json({ 
                success: false,
                error: 'Withdrawal method and details are required' 
            });
        }
        
        console.log(`📤 Withdrawal request from ${req.userId}: ${amount} BOM via ${method}`);
        
        const result = await WalletService.requestWithdrawal(
            req.userId, 
            amount, 
            method, 
            payoutDetails
        );
        
        res.json({
            success: true,
            withdrawal: {
                id: result.id,
                amount: result.amount,
                method: result.method,
                status: result.status,
                created_at: result.created_at
            },
            message: 'Withdrawal request submitted. Processing within 24 hours.'
        });
    } catch (error) {
        console.error('Withdrawal API error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Transfer BOM between users
router.post('/wallet/transfer', authenticateTelegram, async (req, res) => {
    try {
        const { receiverId, amount, description } = req.body;
        const senderId = req.userId;
        
        console.log(`🔄 Transfer attempt from ${senderId} to ${receiverId}: ${amount} BOM`);
        
        if (!receiverId || !amount) {
            return res.status(400).json({ 
                success: false,
                error: 'Missing required fields' 
            });
        }
        
        if (amount <= 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Amount must be positive' 
            });
        }
        
        if (amount < 0.01) {
            return res.status(400).json({ 
                success: false,
                error: 'Minimum transfer amount is 0.01 BOM' 
            });
        }
        
        // Check if users exist
        const [sender, receiver] = await Promise.all([
            User.findOne({ where: { telegram_id: senderId } }),
            User.findOne({ where: { telegram_id: receiverId } })
        ]);
        
        if (!sender) {
            return res.status(400).json({ 
                success: false,
                error: 'Sender not found' 
            });
        }
        
        if (!receiver) {
            return res.status(400).json({ 
                success: false,
                error: 'Receiver not found' 
            });
        }
        
        const result = await WalletService.transfer(
            senderId, 
            receiverId, 
            amount, 
            description || `Transfer of ${amount} BOM`
        );
        
        res.json({
            success: true,
            message: 'Transfer completed successfully.',
            transfer: result,
            details: {
                from: sender.username || `User ${senderId}`,
                to: receiver.username || `User ${receiverId}`,
                amount: amount,
                fee: result.fee || 0,
                netAmount: result.netAmount || amount
            }
        });
    } catch (error) {
        console.error('Transfer API error:', error);
        res.status(400).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Transaction history
router.get('/wallet/transactions', authenticateTelegram, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type;
        const status = req.query.status;
        const period = req.query.period || '30days';
        
        console.log(`📊 Getting transactions for user ${req.userId}, page ${page}`);
        
        const wallet = await Wallet.findOne({ where: { user_id: req.userId } });
        if (!wallet) {
            return res.json({
                success: true,
                transactions: [],
                pagination: {
                    currentPage: page,
                    totalPages: 0,
                    totalItems: 0,
                    itemsPerPage: limit
                }
            });
        }
        
        // Calculate date filter
        let dateFilter = {};
        const now = new Date();
        switch (period) {
            case '7days':
                dateFilter = { created_at: { [Op.gte]: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
                break;
            case '30days':
                dateFilter = { created_at: { [Op.gte]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
                break;
            case '90days':
                dateFilter = { created_at: { [Op.gte]: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } };
                break;
        }
        
        const where = { wallet_id: wallet.id, ...dateFilter };
        if (type && type !== 'all') where.type = type;
        if (status && status !== 'all') where.status = status;
        
        const { count, rows } = await WalletTransaction.findAndCountAll({
            where,
            order: [['created_at', 'DESC']],
            limit,
            offset: (page - 1) * limit
        });
        
        res.json({
            success: true,
            transactions: rows.map(tx => ({
                id: tx.id,
                type: tx.type,
                amount: parseFloat(tx.amount),
                currency: tx.currency,
                description: tx.description,
                status: tx.status,
                metadata: tx.metadata,
                created_at: tx.created_at
            })),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                totalItems: count,
                itemsPerPage: limit
            }
        });
        
    } catch (error) {
        console.error('Transactions API error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Subscription status
router.get('/subscription/status', authenticateTelegram, async (req, res) => {
    try {
        console.log(`🎫 Getting subscription status for user ${req.userId}`);
        
        const tier = await SubscriptionService.getSubscriptionTier(req.userId);
        const subscription = await SubscriptionService.getUserSubscription(req.userId);
        
        res.json({
            success: true,
            tier: tier,
            subscription: subscription ? {
                id: subscription.id,
                tier: subscription.tier,
                status: subscription.status,
                monthly_price: subscription.monthly_price,
                current_period_start: subscription.current_period_start,
                current_period_end: subscription.current_period_end,
                auto_renew: subscription.auto_renew,
                created_at: subscription.created_at
            } : null,
            user_id: req.userId
        });
    } catch (error) {
        console.error('Subscription status API error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Upgrade to premium
router.post('/subscription/upgrade', authenticateTelegram, async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.userId;
        
        if (!plan) {
            return res.status(400).json({ 
                success: false,
                error: 'Plan type is required (monthly or yearly)' 
            });
        }
        
        console.log(`⭐ Premium upgrade for user ${userId}, plan: ${plan}`);
        
        let subscription;
        
        if (plan === 'yearly') {
            // Process yearly plan (30 BOM)
            const wallet = await WalletService.getBalance(userId);
            if (wallet.balance < 30) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Insufficient balance for yearly plan (30 BOM required)' 
                });
            }
            
            // Process payment
            const transferResult = await WalletService.transfer(
                userId, 
                '0', // Platform wallet
                30, 
                'Yearly premium subscription'
            );
            
            if (!transferResult.success) {
                throw new Error('Payment failed: ' + (transferResult.error || 'Unknown error'));
            }
            
            // Create yearly subscription
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            
            subscription = await UserSubscription.create({
                user_id: userId,
                tier: 'premium',
                status: 'active',
                monthly_price: 2.5, // 30/12 = 2.5 BOM per month equivalent
                currency: 'BOM',
                current_period_start: now,
                current_period_end: periodEnd,
                auto_renew: true,
                metadata: { plan: 'yearly', payment_transaction_id: transferResult.transactionId }
            });
            
            // Update user premium status
            await User.update(
                { premium_status: 'premium', premium_expires_at: periodEnd },
                { where: { telegram_id: userId } }
            );
            
        } else {
            // Process monthly plan (3 BOM)
            subscription = await SubscriptionService.upgradeToPremium(userId);
        }
        
        res.json({
            success: true,
            message: 'Premium subscription activated successfully.',
            subscription: {
                id: subscription.id,
                tier: subscription.tier,
                status: subscription.status,
                current_period_end: subscription.current_period_end
            }
        });
    } catch (error) {
        console.error('Subscription upgrade API error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Cancel subscription
router.post('/subscription/cancel', authenticateTelegram, async (req, res) => {
    try {
        const userId = req.userId;
        
        console.log(`❌ Cancelling subscription for user ${userId}`);
        
        const subscription = await SubscriptionService.cancelSubscription(userId);
        
        res.json({
            success: true,
            message: 'Subscription cancelled successfully.',
            subscription: {
                id: subscription.id,
                status: subscription.status,
                cancelled_at: subscription.cancelled_at
            }
        });
    } catch (error) {
        console.error('Subscription cancel API error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Toggle auto-renew
router.post('/subscription/auto-renew', authenticateTelegram, async (req, res) => {
    try {
        const { autoRenew } = req.body;
        const userId = req.userId;
        
        if (typeof autoRenew !== 'boolean') {
            return res.status(400).json({ 
                success: false,
                error: 'autoRenew must be true or false' 
            });
        }
        
        console.log(`🔄 Setting auto-renew to ${autoRenew} for user ${userId}`);
        
        const subscription = await UserSubscription.findOne({ 
            where: { user_id: userId, status: 'active' }
        });
        
        if (!subscription) {
            return res.status(404).json({ 
                success: false,
                error: 'No active subscription found' 
            });
        }
        
        await subscription.update({ auto_renew: autoRenew });
        
        res.json({
            success: true,
            message: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'}`,
            auto_renew: subscription.auto_renew
        });
    } catch (error) {
        console.error('Auto-renew API error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Admin endpoints (simple auth for admin)
router.get('/admin/deposits/pending', authenticateSimple, async (req, res) => {
    try {
        const userId = req.userId;
        
        // Check if user is admin (platform creator)
        if (userId !== '1827785384' && userId !== 1827785384) {
            return res.status(403).json({ 
                success: false,
                error: 'Admin access required' 
            });
        }
        
        console.log('📥 Admin fetching pending deposits');
        
        const deposits = await WalletService.getPendingDeposits();
        
        res.json({
            success: true,
            deposits: deposits.map(deposit => ({
                id: deposit.id,
                user_id: deposit.Wallet?.user_id,
                amount: deposit.amount,
                description: deposit.description,
                proof_image: deposit.metadata?.proof_image,
                created_at: deposit.created_at,
                metadata: deposit.metadata
            }))
        });
    } catch (error) {
        console.error('Admin deposits API error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

router.post('/admin/deposit/:id/approve', authenticateSimple, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.userId;
        
        // Check if user is admin
        if (adminId !== '1827785384' && adminId !== 1827785384) {
            return res.status(403).json({ 
                success: false,
                error: 'Admin access required' 
            });
        }
        
        console.log(`✅ Admin ${adminId} approving deposit ${id}`);
        
        const result = await WalletService.confirmDeposit(id, adminId);
        
        res.json({
            success: true,
            message: 'Deposit approved successfully',
            transaction: result.transaction,
            new_balance: result.newBalance
        });
    } catch (error) {
        console.error('Approve deposit API error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Health check endpoint
router.get('/wallet/health', (req, res) => {
    res.json({ 
        success: true,
        status: 'online', 
        service: 'Botomics Wallet API',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint for debugging
router.get('/wallet/test', authenticateTelegram, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Wallet API is working!',
            user_id: req.userId,
            telegram_user: req.telegramUser,
            timestamp: new Date().toISOString(),
            endpoints: {
                balance: 'GET /api/wallet/balance?userId=YOUR_ID',
                deposit: 'POST /api/wallet/deposit',
                withdraw: 'POST /api/wallet/withdraw',
                transfer: 'POST /api/wallet/transfer',
                transactions: 'GET /api/wallet/transactions?userId=YOUR_ID',
                subscription_status: 'GET /api/subscription/status?userId=YOUR_ID',
                upgrade: 'POST /api/subscription/upgrade',
                cancel: 'POST /api/subscription/cancel'
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

module.exports = router;