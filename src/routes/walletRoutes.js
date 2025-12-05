// src/routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const WalletService = require('../services/walletService');
const SubscriptionService = require('../services/subscriptionService');

// Middleware to check if user is authenticated
function authenticate(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.userId = userId;
  next();
}

// Wallet balance
router.get('/balance', authenticate, async (req, res) => {
  try {
    const balance = await WalletService.getBalance(req.userId);
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deposit request
router.post('/deposit', authenticate, async (req, res) => {
  try {
    const { amount, description, proofImage } = req.body;
    const result = await WalletService.deposit(req.userId, amount, description, proofImage);
    res.json({
      success: true,
      transaction: result.transaction,
      message: 'Deposit request submitted. Awaiting admin approval.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Withdrawal request
router.post('/withdraw', authenticate, async (req, res) => {
  try {
    const { amount, method, payoutDetails } = req.body;
    const result = await WalletService.requestWithdrawal(req.userId, amount, method, payoutDetails);
    res.json({
      success: true,
      withdrawal: result,
      message: 'Withdrawal request submitted.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer BOM
router.post('/transfer', authenticate, async (req, res) => {
  try {
    const { receiverId, amount, description } = req.body;
    const result = await WalletService.transfer(req.userId, receiverId, amount, description);
    res.json({
      success: true,
      transaction: result,
      message: 'Transfer completed successfully.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transaction history
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const history = await WalletService.getTransactionHistory(req.userId, limit, (page - 1) * limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subscription status
router.get('/subscription/status', authenticate, async (req, res) => {
  try {
    const tier = await SubscriptionService.getSubscriptionTier(req.userId);
    const subscription = await SubscriptionService.getUserSubscription(req.userId);
    res.json({
      tier,
      subscription,
      user_id: req.userId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upgrade to premium
router.post('/subscription/upgrade', authenticate, async (req, res) => {
  try {
    const subscription = await SubscriptionService.upgradeToPremium(req.userId);
    res.json({
      success: true,
      subscription,
      message: 'Premium subscription activated successfully.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel subscription
router.post('/subscription/cancel', authenticate, async (req, res) => {
  try {
    const subscription = await SubscriptionService.cancelSubscription(req.userId);
    res.json({
      success: true,
      subscription,
      message: 'Subscription cancelled successfully.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoints
router.get('/admin/pending-deposits', async (req, res) => {
  try {
    const deposits = await WalletService.getPendingDeposits();
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/approve-deposit/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    const result = await WalletService.confirmDeposit(id, adminId);
    res.json({
      success: true,
      result,
      message: 'Deposit approved.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/pending-withdrawals', async (req, res) => {
  try {
    const withdrawals = await WalletService.getPendingWithdrawals();
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/process-withdrawal/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminId, notes } = req.body;
    const result = await WalletService.processWithdrawal(id, adminId, action, notes);
    res.json({
      success: true,
      result,
      message: `Withdrawal ${action}ed.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;