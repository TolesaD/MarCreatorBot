const { Wallet, WalletTransaction, User } = require('../models');

class WalletService {
  async getOrCreateWallet(userId) {
    let wallet = await Wallet.findOne({ where: { user_id: userId } });
    
    if (!wallet) {
      wallet = await Wallet.create({
        user_id: userId,
        balance: 0.00,
        currency: 'BOM'
      });
      console.log(`💰 Created new wallet for user ${userId}`);
    }
    
    return wallet;
  }
  
  async getBalance(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      balance: wallet.balance,
      currency: wallet.currency,
      isFrozen: wallet.is_frozen
    };
  }
  
  async deposit(userId, amount, description = 'Deposit', metadata = {}) {
    const wallet = await this.getOrCreateWallet(userId);
    
    if (wallet.is_frozen) {
      throw new Error('Wallet is frozen. Cannot process deposit.');
    }
    
    const transaction = await WalletTransaction.create({
      wallet_id: wallet.id,
      type: 'deposit',
      amount: amount,
      currency: 'BOM',
      description: description,
      metadata: metadata,
      status: 'completed'
    });
    
    await wallet.increment('balance', { by: amount });
    await wallet.reload();
    
    console.log(`💰 Deposited ${amount} BOM to user ${userId}`);
    
    return {
      transaction,
      newBalance: wallet.balance
    };
  }
  
  async withdraw(userId, amount, description = 'Withdrawal', metadata = {}) {
    const wallet = await this.getOrCreateWallet(userId);
    
    if (wallet.is_frozen) {
      throw new Error('Wallet is frozen. Cannot process withdrawal.');
    }
    
    if (wallet.balance < amount) {
      throw new Error('Insufficient balance.');
    }
    
    const transaction = await WalletTransaction.create({
      wallet_id: wallet.id,
      type: 'withdrawal',
      amount: -amount,
      currency: 'BOM',
      description: description,
      metadata: metadata,
      status: 'completed'
    });
    
    await wallet.decrement('balance', { by: amount });
    await wallet.reload();
    
    console.log(`💰 Withdrew ${amount} BOM from user ${userId}`);
    
    return {
      transaction,
      newBalance: wallet.balance
    };
  }
  
  async transfer(senderId, receiverId, amount, description = 'Transfer') {
    const senderWallet = await this.getOrCreateWallet(senderId);
    const receiverWallet = await this.getOrCreateWallet(receiverId);
    
    if (senderWallet.is_frozen || receiverWallet.is_frozen) {
      throw new Error('One of the wallets is frozen. Cannot process transfer.');
    }
    
    if (senderWallet.balance < amount) {
      throw new Error('Insufficient balance for transfer.');
    }
    
    // Create transactions for both parties
    const senderTransaction = await WalletTransaction.create({
      wallet_id: senderWallet.id,
      type: 'transfer',
      amount: -amount,
      currency: 'BOM',
      description: `Transfer to user ${receiverId}: ${description}`,
      metadata: { receiver_id: receiverId },
      status: 'completed'
    });
    
    const receiverTransaction = await WalletTransaction.create({
      wallet_id: receiverWallet.id,
      type: 'transfer',
      amount: amount,
      currency: 'BOM',
      description: `Transfer from user ${senderId}: ${description}`,
      metadata: { sender_id: senderId },
      status: 'completed'
    });
    
    // Update balances
    await senderWallet.decrement('balance', { by: amount });
    await receiverWallet.increment('balance', { by: amount });
    
    console.log(`💰 Transferred ${amount} BOM from ${senderId} to ${receiverId}`);
    
    return {
      senderTransaction,
      receiverTransaction,
      senderNewBalance: senderWallet.balance - amount,
      receiverNewBalance: receiverWallet.balance + amount
    };
  }
  
  async getTransactionHistory(userId, limit = 50, offset = 0) {
    const wallet = await this.getOrCreateWallet(userId);
    
    const transactions = await WalletTransaction.findAll({
      where: { wallet_id: wallet.id },
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: offset
    });
    
    const total = await WalletTransaction.count({
      where: { wallet_id: wallet.id }
    });
    
    return {
      transactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  }
  
  async freezeWallet(userId, reason = 'Policy violation') {
    const wallet = await this.getOrCreateWallet(userId);
    await wallet.update({
      is_frozen: true,
      freeze_reason: reason
    });
    
    console.log(`❄️ Frozen wallet for user ${userId}: ${reason}`);
    
    return wallet;
  }
  
  async unfreezeWallet(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    await wallet.update({
      is_frozen: false,
      freeze_reason: null
    });
    
    console.log(`✅ Unfrozen wallet for user ${userId}`);
    
    return wallet;
  }
}

module.exports = new WalletService();