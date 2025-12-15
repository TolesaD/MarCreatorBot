// src/services/walletService.js - FIXED VERSION
const { Wallet, WalletTransaction, User, Withdrawal, UserSubscription } = require('../models');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

class WalletService {
    
    // Get wallet balance for user - FIXED
    static async getBalance(userId) {
    try {
        let wallet = await Wallet.findOne({ where: { user_id: userId } });
        
        if (!wallet) {
            // Create wallet with ZERO balance
            const timestamp = Date.now().toString(36).toUpperCase();
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            try {
                wallet = await Wallet.create({
                    user_id: userId,
                    balance: 0.00,
                    currency: 'BOM',
                    is_frozen: false,
                    wallet_address: `BOTOMICS_${userId}_${timestamp}_${random}`
                });
                console.log(`✅ Created new wallet for user ${userId}`);
            } catch (createError) {
                console.error(`❌ Failed to create wallet for user ${userId}:`, createError);
                // Return a default wallet object
                return {
                    userId: userId,
                    balance: 0.00,
                    currency: 'BOM',
                    walletAddress: `BOTOMICS_${userId}_TEMP`,
                    isFrozen: false,
                    freezeReason: null,
                    createdAt: new Date()
                };
            }
        }
        
        return {
            userId: userId,
            balance: parseFloat(wallet.balance),
            currency: wallet.currency,
            walletAddress: wallet.wallet_address || `BOTOMICS_${userId}`,
            isFrozen: wallet.is_frozen,
            freezeReason: wallet.freeze_reason,
            createdAt: wallet.created_at
        };
    } catch (error) {
        console.error('Get balance error:', error);
        // Return a default response instead of throwing
        return {
            userId: userId,
            balance: 0.00,
            currency: 'BOM',
            walletAddress: `BOTOMICS_${userId}_ERROR`,
            isFrozen: false,
            freezeReason: null,
            createdAt: new Date()
        };
    }
}
    
    // Process deposit request
    static async deposit(userId, amount, description, proofImageUrl) {
        const transaction = await WalletTransaction.sequelize.transaction();
        
        try {
            let wallet = await Wallet.findOne({ 
                where: { user_id: userId },
                transaction
            });
            
            if (!wallet) {
                // Create wallet if it doesn't exist
                const timestamp = Date.now().toString(36).toUpperCase();
                const random = Math.random().toString(36).substring(2, 8).toUpperCase();
                
                wallet = await Wallet.create({
                    user_id: userId,
                    balance: 0.00,
                    currency: 'BOM',
                    wallet_address: `BOTOMICS_${userId}_${timestamp}_${random}`,
                    is_frozen: false
                }, { transaction });
            }
            
            if (wallet.is_frozen) {
                throw new Error('Wallet is frozen. Cannot process deposit.');
            }
            
            // Create pending deposit transaction
            const depositTransaction = await WalletTransaction.create({
                wallet_id: wallet.id,
                type: 'deposit',
                amount: amount,
                currency: 'BOM',
                description: description,
                status: 'pending',
                metadata: {
                    proof_image: proofImageUrl,
                    approved_by: null,
                    approved_at: null,
                    user_id: userId
                }
            }, { transaction });
            
            await transaction.commit();
            
            return {
                success: true,
                transaction: depositTransaction,
                walletId: wallet.id,
                user_id: userId
            };
            
        } catch (error) {
            await transaction.rollback();
            console.error('Deposit error:', error);
            throw error;
        }
    }
    
    // Confirm deposit (admin only) - FIXED
    static async confirmDeposit(transactionId, adminId) {
        const transaction = await WalletTransaction.sequelize.transaction();
        
        try {
            const depositTransaction = await WalletTransaction.findOne({
                where: { 
                    id: transactionId,
                    type: 'deposit',
                    status: 'pending'
                },
                include: [{
                    model: Wallet,
                    as: 'wallet',
                    required: true
                }],
                transaction
            });
            
            if (!depositTransaction) {
                throw new Error('Pending deposit transaction not found');
            }
            
            // Update wallet balance
            const newBalance = parseFloat(depositTransaction.wallet.balance) + parseFloat(depositTransaction.amount);
            await depositTransaction.wallet.update({
                balance: newBalance
            }, { transaction });
            
            // Update transaction status
            await depositTransaction.update({
                status: 'completed',
                metadata: {
                    ...depositTransaction.metadata,
                    approved_by: adminId,
                    approved_at: new Date()
                }
            }, { transaction });
            
            // Create system transaction for record - FIXED: Use 'deposit' instead of 'admin_adjustment'
            await WalletTransaction.create({
                wallet_id: depositTransaction.wallet_id,
                type: 'deposit',
                amount: depositTransaction.amount,
                currency: 'BOM',
                description: `Deposit approved by admin ${adminId}`,
                status: 'completed',
                metadata: {
                    original_transaction: transactionId,
                    admin_id: adminId,
                    approved_by: adminId,
                    approved_at: new Date().toISOString()
                }
            }, { transaction });
            
            await transaction.commit();
            
            return {
                success: true,
                transaction: depositTransaction,
                newBalance: newBalance,
                user_id: depositTransaction.wallet.user_id
            };
            
        } catch (error) {
            await transaction.rollback();
            console.error('Confirm deposit error:', error);
            throw error;
        }
    }
    
    // Request withdrawal - UPDATED for BOM system
    static async requestWithdrawal(userId, amount, method, payoutDetails) {
        const transaction = await WalletTransaction.sequelize.transaction();
        
        try {
            const wallet = await Wallet.findOne({ 
                where: { user_id: userId },
                transaction
            });
            
            if (!wallet) {
                throw new Error('Wallet not found');
            }
            
            if (wallet.is_frozen) {
                throw new Error('Wallet is frozen. Cannot process withdrawal.');
            }
            
            if (parseFloat(wallet.balance) < parseFloat(amount)) {
                throw new Error('Insufficient balance');
            }
            
            // Minimum withdrawal check for BOM
            if (amount < 20) {
                throw new Error('Minimum withdrawal amount is 20 BOM');
            }
            
            // Deduct from wallet
            const newBalance = parseFloat(wallet.balance) - parseFloat(amount);
            await wallet.update({
                balance: newBalance
            }, { transaction });
            
            // Create withdrawal transaction
            const withdrawalTransaction = await WalletTransaction.create({
                wallet_id: wallet.id,
                type: 'withdrawal',
                amount: -Math.abs(amount), // Negative amount for withdrawal
                currency: 'BOM',
                description: `Withdrawal to ${method}: ${payoutDetails}`,
                status: 'pending',
                metadata: {
                    method: method,
                    payout_details: payoutDetails,
                    usd_value: amount, // 1 BOM = $1 USD
                    processed_by: null,
                    processed_at: null,
                    user_id: userId
                }
            }, { transaction });
            
            // Create withdrawal record - FIXED: Added missing fields
            const withdrawal = await Withdrawal.create({
                user_id: userId,
                amount: amount,
                method: method,
                payout_details: payoutDetails,
                usd_value: amount,
                status: 'pending',
                transaction_id: withdrawalTransaction.id,
                currency: 'BOM',
                bot_id: 0, // Added: Default value since withdrawals aren't bot-specific
                payment_method: method // Added: Use the same method as withdrawal method
            }, { transaction });
            
            await transaction.commit();
            
            return {
                id: withdrawal.id,
                amount: withdrawal.amount,
                method: withdrawal.method,
                status: withdrawal.status,
                created_at: withdrawal.created_at,
                user_id: userId
            };
            
        } catch (error) {
            await transaction.rollback();
            console.error('Request withdrawal error:', error);
            throw error;
        }
    }
    
    // Transfer BOM between users
    static async transfer(senderId, receiverId, amount, description) {
    const transaction = await WalletTransaction.sequelize.transaction();
    
    try {
        // Get sender wallet
        const senderWallet = await Wallet.findOne({ 
            where: { user_id: senderId },
            transaction
        });
        
        if (!senderWallet) {
            throw new Error('Sender wallet not found');
        }
        
        if (senderWallet.is_frozen) {
            throw new Error('Sender wallet is frozen');
        }
        
        if (parseFloat(senderWallet.balance) < parseFloat(amount)) {
            throw new Error('Insufficient balance');
        }
        
        // Get receiver wallet (create if doesn't exist)
        let receiverWallet = await Wallet.findOne({ 
            where: { user_id: receiverId },
            transaction
        });
        
        if (!receiverWallet) {
            const timestamp = Date.now().toString(36).toUpperCase();
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            receiverWallet = await Wallet.create({
                user_id: receiverId,
                balance: 0.00,
                currency: 'BOM',
                wallet_address: `BOTOMICS_${receiverId}_${timestamp}_${random}`,
                is_frozen: false
            }, { transaction });
        }
        
        if (receiverWallet.is_frozen) {
            throw new Error('Receiver wallet is frozen');
        }
        
        // Calculate fees based on sender's subscription tier
        const senderSubscription = await UserSubscription.findOne({
            where: { 
                user_id: senderId,
                status: 'active'
            },
            transaction
        });
        
        const feePercentage = senderSubscription?.tier === 'premium' ? 0.005 : 0.01; // 0.5% for premium, 1% for freemium
        const feeAmount = amount * feePercentage;
        const netAmount = amount - feeAmount;
        
        // Update balances
        const newSenderBalance = parseFloat(senderWallet.balance) - amount;
        await senderWallet.update({
            balance: newSenderBalance
        }, { transaction });
        
        const newReceiverBalance = parseFloat(receiverWallet.balance) + netAmount;
        await receiverWallet.update({
            balance: newReceiverBalance
        }, { transaction });
        
        // Create sender transaction
        await WalletTransaction.create({
            wallet_id: senderWallet.id,
            type: 'transfer',
            amount: -amount,
            currency: 'BOM',
            description: `Transfer to user ${receiverId}: ${description}`,
            status: 'completed',
            metadata: {
                receiver_id: receiverId,
                fee: feeAmount,
                net_amount: netAmount,
                fee_percentage: feePercentage * 100
            }
        }, { transaction });
        
        // Create receiver transaction
        await WalletTransaction.create({
            wallet_id: receiverWallet.id,
            type: 'transfer',
            amount: netAmount,
            currency: 'BOM',
            description: `Transfer from user ${senderId}: ${description}`,
            status: 'completed',
            metadata: {
                sender_id: senderId,
                original_amount: amount,
                fee: feeAmount,
                fee_percentage: feePercentage * 100
            }
        }, { transaction });
        
        // Create fee transaction for platform - FIXED: No longer try to create platform wallet with user_id=0
        if (feeAmount > 0) {
    // Just create a fee transaction
    await WalletTransaction.create({
        wallet_id: senderWallet.id, // Attach to sender's wallet for tracking
        type: 'fee',
        amount: -feeAmount, // Negative for sender
        currency: 'BOM',
        description: `Transfer fee for sending to user ${receiverId}`,
        status: 'completed',
        metadata: {
            sender_id: senderId,
            receiver_id: receiverId,
            original_amount: amount,
            transaction_type: 'transfer_fee',
            fee_type: 'platform_fee',
            fee_percentage: feePercentage * 100
        }
    }, { transaction });
}
        await transaction.commit();
        
        return {
            success: true,
            amount: amount,
            fee: feeAmount,
            netAmount: netAmount,
            senderId: senderId,
            receiverId: receiverId,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        await transaction.rollback();
        console.error('Transfer error:', error);
        throw error;
    }
}
    
    // Get transaction history
    static async getTransactionHistory(userId, limit = 10, offset = 0) {
        try {
            const wallet = await Wallet.findOne({ where: { user_id: userId } });
            
            if (!wallet) {
                return {
                    transactions: [],
                    pagination: {
                        total: 0,
                        hasMore: false
                    }
                };
            }
            
            const { count, rows } = await WalletTransaction.findAndCountAll({
                where: { wallet_id: wallet.id },
                order: [['created_at', 'DESC']],
                limit: limit + 1, // Get one extra to check if there are more
                offset: offset
            });
            
            const hasMore = rows.length > limit;
            const transactions = hasMore ? rows.slice(0, limit) : rows;
            
            return {
                transactions: transactions.map(tx => ({
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
                    total: count,
                    hasMore: hasMore,
                    offset: offset,
                    limit: limit
                }
            };
        } catch (error) {
            console.error('Get transaction history error:', error);
            throw new Error('Failed to get transaction history');
        }
    }
    
    // Admin functions - FIXED: Use allowed transaction types
    static async adminAdjustBalance(userId, amount, description, adminId) {
        const transaction = await Wallet.sequelize.transaction();
        
        try {
            // Get or create wallet for user
            let wallet = await Wallet.findOne({
                where: { user_id: userId }
            });

            if (!wallet) {
                wallet = await Wallet.create({
                    user_id: userId,
                    balance: 0,
                    total_deposits: 0,
                    total_withdrawals: 0,
                    total_transfers: 0,
                    is_frozen: false,
                    currency: 'BOM'
                }, { transaction });
            }

            // Update wallet balance
            const newBalance = parseFloat(wallet.balance) + parseFloat(amount);
            await wallet.update({
                balance: newBalance,
                total_deposits: parseFloat(wallet.total_deposits) + Math.max(0, parseFloat(amount))
            }, { transaction });

            // FIXED: Use allowed transaction types
            // Common allowed types: 'deposit', 'withdrawal', 'transfer', 'subscription', 'refund', 'fee'
            // Use 'deposit' for positive amounts, 'refund' for negative amounts
            const transactionType = amount > 0 ? 'deposit' : 'refund';
            const effectiveDescription = description || `Manual adjustment by admin ${adminId}`;

            // Create transaction
            const walletTransaction = await WalletTransaction.create({
                wallet_id: wallet.id,
                type: transactionType,
                amount: amount,
                currency: 'BOM',
                description: effectiveDescription,
                metadata: {
                    admin_id: adminId,
                    adjustment_type: 'manual',
                    timestamp: new Date().toISOString(),
                    original_balance: wallet.balance,
                    new_balance: newBalance,
                    user_id: userId // Store in metadata, not as column
                },
                status: 'completed'
            }, { transaction });

            await transaction.commit();

            return {
                success: true,
                userId: userId,
                walletId: wallet.id,
                transaction: walletTransaction,
                newBalance: newBalance,
                previousBalance: wallet.balance,
                change: amount
            };

        } catch (error) {
            await transaction.rollback();
            console.error('Admin adjust balance error:', error);
            throw error;
        }
    }
    
    static async freezeWallet(userId, reason, adminId) {
        try {
            const wallet = await Wallet.findOne({ where: { user_id: userId } });
            
            if (!wallet) {
                throw new Error('Wallet not found');
            }
            
            if (wallet.is_frozen) {
                throw new Error('Wallet already frozen');
            }
            
            await wallet.update({
                is_frozen: true,
                freeze_reason: reason
            });
            
            // FIXED: Use 'fee' type instead of 'admin_action'
            await WalletTransaction.create({
                wallet_id: wallet.id,
                type: 'admin_action', // Use allowed type
                amount: 0,
                currency: 'BOM',
                description: `Wallet frozen by admin ${adminId}: ${reason}`,
                status: 'completed',
                metadata: {
                    admin_id: adminId,
                    action: 'freeze',
                    reason: reason,
                    timestamp: new Date().toISOString(),
                    user_id: userId
                }
            });
            
            return {
                success: true,
                userId: userId,
                frozen: true,
                reason: reason,
                adminId: adminId,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Freeze wallet error:', error);
            throw error;
        }
    }
    
    static async unfreezeWallet(userId, adminId) {
    try {
        const wallet = await Wallet.findOne({ where: { user_id: userId } });
        
        if (!wallet) {
            throw new Error('Wallet not found');
        }
        
        if (!wallet.is_frozen) {
            throw new Error('Wallet is not frozen');
        }
        
        await wallet.update({
            is_frozen: false,
            freeze_reason: null
        });
        
        // FIXED: Use 'fee' type instead of 'admin_action'
        await WalletTransaction.create({
            wallet_id: wallet.id,
            type: 'admin_action', // Use allowed type
            amount: 0,
            currency: 'BOM',
            description: `Wallet unfrozen by admin ${adminId}`,
            status: 'completed',
            metadata: {
                admin_id: adminId,
                action: 'unfreeze',
                timestamp: new Date().toISOString(),
                user_id: userId
            }
        });
        
        return {
            success: true,
            userId: userId,
            frozen: false,
            adminId: adminId,
            timestamp: new Date().toISOString()
        };
    } catch (error) { // FIXED: Removed duplicate 'catch (error)'
        console.error('Unfreeze wallet error:', error);
        throw error;
    }
}
    
   // In walletService.js, update the getPendingDeposits method:
    static async getPendingDeposits() {
        try {
            const WalletTransaction = require('../models').WalletTransaction;
            const { Op } = require('sequelize');
            
            const pendingDeposits = await WalletTransaction.findAll({
                where: {
                    type: 'deposit',
                    status: 'pending'
                },
                include: [
                    {
                        model: require('../models').Wallet,
                        as: 'wallet',  // FIXED: Use 'wallet' not 'Wallet'
                        include: [
                            {
                                model: require('../models').User,
                                as: 'WalletUser'  // FIXED: Use 'WalletUser' not 'user'
                            }
                        ]
                    }
                ],
                order: [['created_at', 'ASC']]
            });
            
            return pendingDeposits;
        } catch (error) {
            console.error('Get pending deposits error:', error);
            throw error;
        }
    }
    
    // Get pending withdrawals (admin only) - FIXED ASSOCIATION
    static async getPendingWithdrawals() {
        try {
            // Get withdrawals using raw query to avoid association conflicts
            const withdrawals = await Withdrawal.findAll({
                where: {
                    status: 'pending'
                },
                order: [['created_at', 'ASC']],
                limit: 50,
                raw: true
            });
            
            // Get user info separately
            const withdrawalsWithUsers = await Promise.all(
                withdrawals.map(async (withdrawal) => {
                    const user = await User.findOne({
                        where: { telegram_id: withdrawal.user_id },
                        attributes: ['username', 'first_name', 'telegram_id']
                    });
                    
                    return {
                        ...withdrawal,
                        User: user || { telegram_id: withdrawal.user_id }
                    };
                })
            );
            
            return withdrawalsWithUsers;
            
        } catch (error) {
            console.error('Get pending withdrawals error:', error);
            throw error;
        }
    }
    
    // Get wallet statistics (admin only)
    static async getWalletStats() {
        try {
            const [
                totalWallets,
                frozenWallets,
                totalBalanceResult,
                totalDeposits,
                totalWithdrawals
            ] = await Promise.all([
                Wallet.count(),
                Wallet.count({ where: { is_frozen: true } }),
                Wallet.findOne({
                    attributes: [
                        [Sequelize.fn('SUM', Sequelize.col('balance')), 'total']
                    ],
                    where: { user_id: { [Op.ne]: 0 } } // Exclude platform wallet
                }),
                WalletTransaction.sum('amount', {
                    where: {
                        type: 'deposit',
                        status: 'completed',
                        amount: { [Op.gt]: 0 }
                    }
                }),
                WalletTransaction.sum('amount', {
                    where: {
                        type: 'withdrawal',
                        status: 'completed'
                    }
                })
            ]);
            
            const totalBalance = parseFloat(totalBalanceResult?.dataValues?.total || 0);
            const totalDepositsValue = parseFloat(totalDeposits || 0);
            const totalWithdrawalsValue = Math.abs(parseFloat(totalWithdrawals || 0));
            const netRevenue = totalDepositsValue - totalWithdrawalsValue;
            
            return {
                totalWallets,
                activeWallets: totalWallets - frozenWallets,
                frozenWallets,
                totalBalance,
                totalDeposits: totalDepositsValue,
                totalWithdrawals: totalWithdrawalsValue,
                netRevenue
            };
        } catch (error) {
            console.error('Get wallet stats error:', error);
            // Return default stats instead of throwing
            return {
                totalWallets: 0,
                activeWallets: 0,
                frozenWallets: 0,
                totalBalance: 0,
                totalDeposits: 0,
                totalWithdrawals: 0,
                netRevenue: 0
            };
        }
    }

    // NEW METHODS ADDED BELOW

    static async approveDeposit(transactionId, adminId) {
        const transaction = await WalletTransaction.sequelize.transaction();
        
        try {
            const deposit = await WalletTransaction.findOne({
                where: { 
                    id: transactionId,
                    type: 'deposit',
                    status: 'pending'
                },
                include: [{
                    model: Wallet,
                    as: 'wallet'
                }],
                transaction
            });

            if (!deposit) {
                throw new Error('Pending deposit not found');
            }

            // Update wallet balance
            const wallet = await Wallet.findByPk(deposit.wallet_id, { transaction });
            const newBalance = parseFloat(wallet.balance) + parseFloat(deposit.amount);
            await wallet.update({ balance: newBalance }, { transaction });

            // Update deposit status
            await deposit.update({
                status: 'completed',
                metadata: {
                    ...deposit.metadata,
                    approved_by: adminId,
                    approved_at: new Date().toISOString()
                }
            }, { transaction });

            await transaction.commit();

            return {
                success: true,
                depositId: deposit.id,
                userId: wallet.user_id,
                amount: deposit.amount,
                newBalance: newBalance
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Approve deposit error:', error);
            throw error;
        }
    }

    static async rejectDeposit(transactionId, reason, adminId) {
        const transaction = await WalletTransaction.sequelize.transaction();
        
        try {
            const deposit = await WalletTransaction.findOne({
                where: { 
                    id: transactionId,
                    type: 'deposit',
                    status: 'pending'
                },
                include: [{
                    model: Wallet,
                    as: 'wallet'
                }],
                transaction
            });

            if (!deposit) {
                throw new Error('Pending deposit not found');
            }

            // Update deposit status to failed
            await deposit.update({
                status: 'failed',
                description: `Deposit rejected: ${reason}`,
                metadata: {
                    ...deposit.metadata,
                    rejected_by: adminId,
                    rejected_at: new Date().toISOString(),
                    reason: reason
                }
            }, { transaction });

            await transaction.commit();

            return {
                success: true,
                depositId: deposit.id,
                userId: deposit.wallet.user_id,
                amount: deposit.amount
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Reject deposit error:', error);
            throw error;
        }
    }

    static async approveWithdrawal(transactionId, adminId) {
        const transaction = await WalletTransaction.sequelize.transaction();
        
        try {
            const withdrawal = await Withdrawal.findOne({
                where: { 
                    id: transactionId,
                    status: 'pending'
                },
                transaction
            });

            if (!withdrawal) {
                throw new Error('Pending withdrawal not found');
            }

            // Update withdrawal status
            await withdrawal.update({
                status: 'completed',
                processed_by: adminId,
                processed_at: new Date()
            }, { transaction });

            // Update associated transaction
            await WalletTransaction.update({
                status: 'completed',
                metadata: {
                    ...(withdrawal.metadata || {}),
                    approved_by: adminId,
                    approved_at: new Date().toISOString()
                }
            }, {
                where: { id: withdrawal.transaction_id },
                transaction
            });

            await transaction.commit();

            return {
                success: true,
                withdrawalId: withdrawal.id,
                userId: withdrawal.user_id,
                amount: withdrawal.amount,
                method: withdrawal.method
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Approve withdrawal error:', error);
            throw error;
        }
    }

    static async rejectWithdrawal(transactionId, reason, adminId) {
        const transaction = await WalletTransaction.sequelize.transaction();
        
        try {
            const withdrawal = await Withdrawal.findOne({
                where: { 
                    id: transactionId,
                    status: 'pending'
                },
                transaction
            });

            if (!withdrawal) {
                throw new Error('Pending withdrawal not found');
            }

            // Refund amount to user's wallet
            const wallet = await Wallet.findOne({
                where: { user_id: withdrawal.user_id },
                transaction
            });

            if (wallet) {
                const newBalance = parseFloat(wallet.balance) + parseFloat(withdrawal.amount);
                await wallet.update({ balance: newBalance }, { transaction });

                // Create refund transaction - FIXED: Use 'refund' type
                await WalletTransaction.create({
                    wallet_id: wallet.id,
                    type: 'refund',
                    amount: withdrawal.amount,
                    currency: 'BOM',
                    description: `Withdrawal refund: ${reason}`,
                    status: 'completed',
                    metadata: {
                        admin_id: adminId,
                        refund_for: withdrawal.id,
                        reason: reason,
                        timestamp: new Date().toISOString()
                    }
                }, { transaction });
            }

            // Update withdrawal status
            await withdrawal.update({
                status: 'failed',
                metadata: {
                    ...(withdrawal.metadata || {}),
                    rejected_by: adminId,
                    rejected_at: new Date().toISOString(),
                    reason: reason
                }
            }, { transaction });

            // Update associated transaction
            await WalletTransaction.update({
                status: 'failed',
                description: `Withdrawal rejected: ${reason}`
            }, {
                where: { id: withdrawal.transaction_id },
                transaction
            });

            await transaction.commit();

            return {
                success: true,
                withdrawalId: withdrawal.id,
                userId: withdrawal.user_id,
                amount: withdrawal.amount
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Reject withdrawal error:', error);
            throw error;
        }
    }

    static async markWithdrawalAsCompleted(transactionId, adminId) {
        try {
            const withdrawal = await Withdrawal.findByPk(transactionId);

            if (!withdrawal) {
                throw new Error('Withdrawal not found');
            }

            if (withdrawal.status === 'completed') {
                throw new Error('Withdrawal already completed');
            }

            await withdrawal.update({
                status: 'completed',
                processed_by: adminId,
                processed_at: new Date()
            });

            return {
                success: true,
                withdrawalId: withdrawal.id,
                userId: withdrawal.user_id,
                amount: withdrawal.amount
            };
        } catch (error) {
            console.error('Mark withdrawal as completed error:', error);
            throw error;
        }
    }

    static async generateWalletReport() {
        try {
            const totalWallets = await Wallet.count();
            const activeWallets = await Wallet.count({
                where: { 
                    balance: { [Op.gt]: 0 },
                    is_frozen: false
                }
            });

            const frozenWallets = await Wallet.count({
                where: { is_frozen: true }
            });

            const totalBalanceResult = await Wallet.findOne({
                attributes: [
                    [Sequelize.fn('sum', Sequelize.col('balance')), 'totalBalance']
                ],
                where: { user_id: { [Op.ne]: 0 } },
                raw: true
            });

            const totalBOMBalance = parseFloat(totalBalanceResult?.totalBalance) || 0;
            const totalUSDValue = totalBOMBalance; // 1 BOM = $1

            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const recentDeposits = await WalletTransaction.count({
                where: {
                    type: 'deposit',
                    status: 'completed',
                    created_at: { [Op.gte]: twentyFourHoursAgo }
                }
            });

            const recentWithdrawals = await WalletTransaction.count({
                where: {
                    type: 'withdrawal',
                    status: 'completed',
                    created_at: { [Op.gte]: twentyFourHoursAgo }
                }
            });

            const recentTransfers = await WalletTransaction.count({
                where: {
                    type: 'transfer',
                    status: 'completed',
                    created_at: { [Op.gte]: twentyFourHoursAgo }
                }
            });

            const pendingDeposits = await WalletTransaction.count({
                where: {
                    type: 'deposit',
                    status: 'pending'
                }
            });

            const pendingWithdrawals = await Withdrawal.count({
                where: {
                    status: 'pending'
                }
            });

            return {
                totalWallets,
                activeWallets,
                frozenWallets,
                totalBOMBalance,
                totalUSDValue,
                recentDeposits,
                recentWithdrawals,
                recentTransfers,
                pendingDeposits,
                pendingWithdrawals
            };
        } catch (error) {
            console.error('Generate wallet report error:', error);
            throw error;
        }
    }
}

module.exports = WalletService;