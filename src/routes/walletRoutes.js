const express = require('express');
const router = express.Router();
const { verifyTelegramAuth } = require('../middleware/auth');
const WalletService = require('../services/walletService');

// Get wallet balance
router.get('/balance', verifyTelegramAuth, async (req, res) => {
  try {
    const balance = await WalletService.getBalance(req.user.id);
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request deposit
router.post('/deposit', verifyTelegramAuth, async (req, res) => {
  try {
    const { amount, description, proofImageUrl } = req.body;
    const result = await WalletService.deposit(req.user.id, amount, description, proofImageUrl);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Request withdrawal
router.post('/withdraw', verifyTelegramAuth, async (req, res) => {
  try {
    const { amount, method, payoutDetails } = req.body;
    const result = await WalletService.requestWithdrawal(req.user.id, amount, method, payoutDetails);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Transfer funds
router.post('/transfer', verifyTelegramAuth, async (req, res) => {
  try {
    const { receiverId, amount, description } = req.body;
    const result = await WalletService.transfer(req.user.id, receiverId, amount, description);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get transaction history
router.get('/transactions', verifyTelegramAuth, async (req, res) => {
  try {
    const { page = 0, limit = 10 } = req.query;
    const result = await WalletService.getTransactionHistory(req.user.id, parseInt(limit), parseInt(page) * parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;