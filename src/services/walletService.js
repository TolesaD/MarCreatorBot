const { Op } = require('sequelize');
const { Wallet, WalletTransaction, User, Withdrawal } = require('../models');
const sequelize = require('../../database/db').sequelize;

class WalletService {
  async getOrCreateWallet(userId) {
    let wallet = await Wallet.findOne({ where: { user_id: userId } });
    
    if (!wallet) {
      // Create user record if not exists
      const user = await User.findOne({ where: { telegram_id: userId } });
      if (!user) {
        await User.create({
          telegram_id: userId,
          first_name: `User_${userId}`,
          username: null,
          is_bot: false
        });
      }
      
      wallet = await Wallet.create({
        user_id: userId,
        balance: 0.00,
        currency: 'BOM',
        is_frozen: false
      });
      console.log(`💰 Created new wallet for user ${userId}`);
    }
    
    return wallet;
  }
  
  async getBalance(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      balance: parseFloat(wallet.balance),
      currency: wallet.currency,
      isFrozen: wallet.is_frozen,
      freezeReason: wallet.freeze_reason
    };
  }
  
  async deposit(userId, amount, description = 'Deposit', proofImage = null, metadata = {}) {
    const wallet = await this.getOrCreateWallet(userId);
    
    if (wallet.is_frozen) {
      throw new Error('Wallet is frozen. Cannot process deposit.');
    }
    
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive.');
    }
    
    const transaction = await sequelize.transaction();
    
    try {
      const walletTransaction = await WalletTransaction.create({
        wallet_id: wallet.id,
        type: 'deposit',
        amount: amount,
        currency: 'BOM',
        description: description,
        metadata: { ...metadata, proof_image: proofImage },
        status: 'pending', // Will be marked completed after admin verification
        proof_image_url: proofImage
      }, { transaction });
      
      console.log(`💰 Deposit request created for user ${userId}: ${amount} BOM`);
      
      await transaction.commit();
      
      return {
        transaction: walletTransaction,
        newBalance: parseFloat(wallet.balance)
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async confirmDeposit(transactionId, adminId) {
    const transaction = await WalletTransaction.findByPk(transactionId);
    
    if (!transaction || transaction.type !== 'deposit' || transaction.status !== 'pending') {
      throw new Error('Invalid deposit transaction.');
    }
    
    const wallet = await Wallet.findByPk(transaction.wallet_id);
    
    if (wallet.is_frozen) {
      throw new Error('Wallet is frozen. Cannot confirm deposit.');
    }
    
    const dbTransaction = await sequelize.transaction();
    
    try {
      // Update transaction status
      await transaction.update({
        status: 'completed',
        metadata: { 
          ...transaction.metadata,
          confirmed_by: adminId,
          confirmed_at: new Date()
        }
      }, { transaction: dbTransaction });
      
      // Update wallet balance
      await wallet.increment('balance', { 
        by: transaction.amount,
        transaction: dbTransaction 
      });
      
      await dbTransaction.commit();
      
      console.log(`✅ Deposit confirmed: ${transaction.amount} BOM to user ${wallet.user_id}`);
      
      return {
        transaction,
        newBalance: parseFloat(wallet.balance) + parseFloat(transaction.amount)
      };
    } catch (error) {
      await dbTransaction.rollback();
      throw error;
    }
  }
  
  async rejectDeposit(transactionId, adminId, reason) {
    const transaction = await WalletTransaction.findByPk(transactionId);
    
    if (!transaction || transaction.type !== 'deposit' || transaction.status !== 'pending') {
      throw new Error('Invalid deposit transaction.');
    }
    
    await transaction.update({
      status: 'failed',
      metadata: { 
        ...transaction.metadata,
        rejected_by: adminId,
        rejected_at: new Date(),
        rejection_reason: reason
      }
    });
    
    console.log(`❌ Deposit rejected for transaction ${transactionId}: ${reason}`);
    
    return transaction;
  }
  
  async requestWithdrawal(userId, amount, method, payoutDetails) {
    const wallet = await this.getOrCreateWallet(userId);
    
    if (wallet.is_frozen) {
      throw new Error('Wallet is frozen. Cannot process withdrawal.');
    }
    
    if (amount < 20) {
      throw new Error('Minimum withdrawal amount is 20 BOM.');
    }
    
    if (parseFloat(wallet.balance) < amount) {
      throw new Error('Insufficient balance for withdrawal.');
    }
    
    const usdValue = amount * 1; // 1 BOM = $1.00 USD
    
    const withdrawal = await sequelize.transaction(async (t) => {
      // Create withdrawal request
      const withdrawal = await Withdrawal.create({
        user_id: userId,
        telegram_id: userId,
        amount: amount,
        currency: 'BOM',
        usd_value: usdValue,
        method: method,
        payout_details: payoutDetails,
        status: 'pending'
      }, { transaction: t });
      
      // Create transaction record
      await WalletTransaction.create({
        wallet_id: wallet.id,
        type: 'withdrawal',
        amount: -amount,
        currency: 'BOM',
        description: `Withdrawal request #${withdrawal.id} via ${method}`,
        status: 'pending',
        metadata: { withdrawal_id: withdrawal.id }
      }, { transaction: t });
      
      // Reserve the amount
      await wallet.decrement('balance', { 
        by: amount,
        transaction: t 
      });
      
      return withdrawal;
    });
    
    console.log(`📤 Withdrawal request created for user ${userId}: ${amount} BOM via ${method}`);
    
    return withdrawal;
  }
  
  async processWithdrawal(withdrawalId, adminId, action, notes = null) {
    const withdrawal = await Withdrawal.findByPk(withdrawalId);
    
    if (!withdrawal || withdrawal.status !== 'pending') {
      throw new Error('Invalid withdrawal request.');
    }
    
    const wallet = await Wallet.findOne({ where: { user_id: withdrawal.user_id } });
    
    if (!wallet) {
      throw new Error('Wallet not found.');
    }
    
    const transaction = await sequelize.transaction();
    
    try {
      if (action === 'approve') {
        // Approve withdrawal
        await withdrawal.update({
          status: 'processing',
          processed_by: adminId,
          admin_notes: notes,
          processed_at: new Date()
        }, { transaction });
        
        // Update transaction status
        await WalletTransaction.update({
          status: 'completed',
          metadata: { 
            processed_by: adminId,
            processed_at: new Date()
          }
        }, {
          where: {
            wallet_id: wallet.id,
            type: 'withdrawal',
            status: 'pending',
            metadata: { withdrawal_id: withdrawalId }
          },
          transaction
        });
        
        console.log(`✅ Withdrawal ${withdrawalId} approved by admin ${adminId}`);
        
      } else if (action === 'reject') {
        // Reject withdrawal
        await withdrawal.update({
          status: 'rejected',
          processed_by: adminId,
          rejection_reason: notes,
          processed_at: new Date()
        }, { transaction });
        
        // Update transaction status
        await WalletTransaction.update({
          status: 'failed',
          metadata: { 
            rejected_by: adminId,
            rejection_reason: notes,
            rejected_at: new Date()
          }
        }, {
          where: {
            wallet_id: wallet.id,
            type: 'withdrawal',
            status: 'pending',
            metadata: { withdrawal_id: withdrawalId }
          },
          transaction
        });
        
        // Return reserved amount to wallet
        await wallet.increment('balance', { 
          by: withdrawal.amount,
          transaction 
        });
        
        console.log(`❌ Withdrawal ${withdrawalId} rejected by admin ${adminId}`);
        
      } else if (action === 'complete') {
        // Mark as completed
        await withdrawal.update({
          status: 'completed',
          processed_by: adminId,
          admin_notes: notes,
          processed_at: new Date()
        }, { transaction });
        
        console.log(`🎉 Withdrawal ${withdrawalId} marked as completed by admin ${adminId}`);
      }
      
      await transaction.commit();
      return withdrawal;
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async transfer(senderId, receiverId, amount, description = 'Transfer') {
    const senderWallet = await this.getOrCreateWallet(senderId);
    const receiverWallet = await this.getOrCreateWallet(receiverId);
    
    if (senderWallet.is_frozen || receiverWallet.is_frozen) {
      throw new Error('One of the wallets is frozen. Cannot process transfer.');
    }
    
    if (parseFloat(senderWallet.balance) < amount) {
      throw new Error('Insufficient balance for transfer.');
    }
    
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive.');
    }
    
    const transaction = await sequelize.transaction();
    
    try {
      // Create transactions for both parties
      const senderTransaction = await WalletTransaction.create({
        wallet_id: senderWallet.id,
        type: 'transfer',
        amount: -amount,
        currency: 'BOM',
        description: `Transfer to user ${receiverId}: ${description}`,
        metadata: { receiver_id: receiverId },
        status: 'completed'
      }, { transaction });
      
      const receiverTransaction = await WalletTransaction.create({
        wallet_id: receiverWallet.id,
        type: 'transfer',
        amount: amount,
        currency: 'BOM',
        description: `Transfer from user ${senderId}: ${description}`,
        metadata: { sender_id: senderId },
        status: 'completed'
      }, { transaction });
      
      // Update balances
      await senderWallet.decrement('balance', { by: amount, transaction });
      await receiverWallet.increment('balance', { by: amount, transaction });
      
      await transaction.commit();
      
      console.log(`💰 Transferred ${amount} BOM from ${senderId} to ${receiverId}`);
      
      return {
        senderTransaction,
        receiverTransaction,
        senderNewBalance: parseFloat(senderWallet.balance) - amount,
        receiverNewBalance: parseFloat(receiverWallet.balance) + amount
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async getTransactionHistory(userId, limit = 10, offset = 0) {
    const wallet = await this.getOrCreateWallet(userId);
    
    const { count, rows } = await WalletTransaction.findAndCountAll({
      where: { wallet_id: wallet.id },
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: offset
    });
    
    return {
      transactions: rows.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        currency: tx.currency,
        description: tx.description,
        status: tx.status,
        created_at: tx.created_at,
        metadata: tx.metadata
      })),
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
        totalPages: Math.ceil(count / limit),
        currentPage: Math.floor(offset / limit) + 1
      }
    };
  }
  
  async freezeWallet(userId, reason = 'Policy violation', adminId = null) {
    const wallet = await this.getOrCreateWallet(userId);
    
    const transaction = await sequelize.transaction();
    
    try {
      await wallet.update({
        is_frozen: true,
        freeze_reason: reason
      }, { transaction });
      
      // Create audit transaction
      await WalletTransaction.create({
        wallet_id: wallet.id,
        type: 'admin_adjustment',
        amount: 0,
        currency: 'BOM',
        description: `Wallet frozen: ${reason}`,
        status: 'completed',
        metadata: { 
          action: 'freeze',
          reason: reason,
          admin_id: adminId,
          timestamp: new Date()
        }
      }, { transaction });
      
      await transaction.commit();
      
      console.log(`❄️ Frozen wallet for user ${userId}: ${reason}`);
      
      return wallet;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async unfreezeWallet(userId, adminId = null) {
    const wallet = await this.getOrCreateWallet(userId);
    
    const transaction = await sequelize.transaction();
    
    try {
      await wallet.update({
        is_frozen: false,
        freeze_reason: null
      }, { transaction });
      
      // Create audit transaction
      await WalletTransaction.create({
        wallet_id: wallet.id,
        type: 'admin_adjustment',
        amount: 0,
        currency: 'BOM',
        description: 'Wallet unfrozen',
        status: 'completed',
        metadata: { 
          action: 'unfreeze',
          admin_id: adminId,
          timestamp: new Date()
        }
      }, { transaction });
      
      await transaction.commit();
      
      console.log(`✅ Unfrozen wallet for user ${userId}`);
      
      return wallet;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async adminAdjustBalance(userId, amount, reason, adminId) {
    const wallet = await this.getOrCreateWallet(userId);
    
    if (wallet.is_frozen) {
      throw new Error('Wallet is frozen. Cannot adjust balance.');
    }
    
    const transaction = await sequelize.transaction();
    
    try {
      // Create transaction record
      const walletTransaction = await WalletTransaction.create({
        wallet_id: wallet.id,
        type: 'admin_adjustment',
        amount: amount,
        currency: 'BOM',
        description: `Admin adjustment: ${reason}`,
        status: 'completed',
        metadata: { 
          reason: reason,
          admin_id: adminId,
          timestamp: new Date()
        }
      }, { transaction });
      
      // Update wallet balance
      if (amount > 0) {
        await wallet.increment('balance', { by: amount, transaction });
      } else {
        await wallet.decrement('balance', { by: Math.abs(amount), transaction });
      }
      
      await wallet.reload({ transaction });
      await transaction.commit();
      
      console.log(`🔧 Admin ${adminId} adjusted wallet for user ${userId} by ${amount} BOM: ${reason}`);
      
      return {
        transaction: walletTransaction,
        newBalance: parseFloat(wallet.balance)
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async getPendingDeposits() {
    return await WalletTransaction.findAll({
      where: {
        type: 'deposit',
        status: 'pending'
      },
      order: [['created_at', 'DESC']],
      include: [{
        model: Wallet,
        attributes: ['user_id']
      }]
    });
  }
  
  async getPendingWithdrawals() {
    return await Withdrawal.findAll({
      where: {
        status: 'pending'
      },
      order: [['created_at', 'DESC']],
      include: [{
        model: User,
        as: 'User',
        attributes: ['telegram_id', 'first_name', 'username']
      }]
    });
  }
  
  async getTotalPlatformBalance() {
    const result = await Wallet.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('balance')), 'total_balance']
      ],
      where: {
        is_frozen: false
      }
    });
    
    return parseFloat(result.get('total_balance')) || 0;
  }
  
  async getWalletStats() {
    const totalWallets = await Wallet.count();
    const activeWallets = await Wallet.count({ where: { is_frozen: false } });
    const frozenWallets = await Wallet.count({ where: { is_frozen: true } });
    const totalBalance = await this.getTotalPlatformBalance();
    
    const totalDeposits = await WalletTransaction.sum('amount', {
      where: {
        type: 'deposit',
        status: 'completed'
      }
    }) || 0;
    
    const totalWithdrawals = await WalletTransaction.sum('amount', {
      where: {
        type: 'withdrawal',
        status: 'completed'
      }
    }) || 0;
    
    return {
      totalWallets,
      activeWallets,
      frozenWallets,
      totalBalance: parseFloat(totalBalance),
      totalDeposits: parseFloat(totalDeposits),
      totalWithdrawals: Math.abs(parseFloat(totalWithdrawals)),
      netRevenue: parseFloat(totalDeposits) - Math.abs(parseFloat(totalWithdrawals))
    };
  }
}

module.exports = new WalletService();