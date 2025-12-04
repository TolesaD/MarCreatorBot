// server.js - Complete Production Server with PostgreSQL Support
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

// Initialize Express app
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const USE_HTTPS = process.env.USE_HTTPS === 'true';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://testweb.maroset.com';

// PostgreSQL Connection Pool
let dbPool;
try {
  if (process.env.DATABASE_URL) {
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    console.log('✅ PostgreSQL connection pool created');
  }
} catch (error) {
  console.error('❌ Failed to create PostgreSQL pool:', error.message);
}

// Test database connection
async function testDatabaseConnection() {
  if (!dbPool) return false;
  
  try {
    const client = await dbPool.connect();
    console.log('✅ PostgreSQL connection test successful');
    
    // Check if wallet tables exist
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('wallets', 'wallet_transactions', 'withdrawals')
    `);
    
    console.log(`📊 Found ${tablesCheck.rows.length} wallet tables`);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection test failed:', error.message);
    return false;
  }
}

// Middleware
app.use(cors({
  origin: ['https://testweb.maroset.com', 'https://web.telegram.org'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Security middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = await testDatabaseConnection();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Botomics Wallet API',
    version: '1.0.0',
    database: dbStatus ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// Telegram Web App verification middleware
function verifyTelegramAuth(req, res, next) {
  const initData = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!initData) {
    return res.status(401).json({ error: 'No authorization data provided' });
  }
  
  try {
    // Parse initData string
    const params = new URLSearchParams(initData);
    
    // Extract hash and remove it from parameters
    const hash = params.get('hash');
    params.delete('hash');
    
    // Sort parameters alphabetically
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Generate secret key
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    
    // Generate data check string
    const dataCheckString = sortedParams;
    
    // Calculate hash
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Verify hash
    if (calculatedHash === hash) {
      // Extract user data
      const userData = JSON.parse(params.get('user') || '{}');
      req.user = userData;
      next();
    } else {
      res.status(401).json({ error: 'Invalid authorization data' });
    }
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// ==================== WALLET API ROUTES ====================

// Get wallet balance
app.get('/api/wallet/balance', verifyTelegramAuth, async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({ error: 'Database unavailable' });
  }
  
  try {
    const userId = req.user.id;
    const client = await dbPool.connect();
    
    // Get or create wallet
    const walletResult = await client.query(
      'SELECT * FROM wallets WHERE user_id = $1',
      [userId]
    );
    
    let wallet;
    if (walletResult.rows.length === 0) {
      // Create new wallet
      const newWallet = await client.query(
        `INSERT INTO wallets (user_id, balance, currency, is_frozen, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, NOW(), NOW()) 
         RETURNING *`,
        [userId, 0.00, 'BOM', false]
      );
      wallet = newWallet.rows[0];
    } else {
      wallet = walletResult.rows[0];
    }
    
    client.release();
    
    res.json({
      balance: parseFloat(wallet.balance),
      currency: wallet.currency,
      isFrozen: wallet.is_frozen,
      freezeReason: wallet.freeze_reason
    });
  } catch (error) {
    console.error('Balance API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Request deposit
app.post('/api/wallet/deposit', verifyTelegramAuth, async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({ error: 'Database unavailable' });
  }
  
  try {
    const { amount, description, proofImageUrl } = req.body;
    const userId = req.user.id;
    
    if (!amount || amount < 5) {
      return res.status(400).json({ error: 'Minimum deposit amount is 5 BOM' });
    }
    
    const client = await dbPool.connect();
    
    // Get wallet
    const walletResult = await client.query(
      'SELECT * FROM wallets WHERE user_id = $1',
      [userId]
    );
    
    if (walletResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    const wallet = walletResult.rows[0];
    
    if (wallet.is_frozen) {
      client.release();
      return res.status(403).json({ error: 'Wallet is frozen' });
    }
    
    // Create deposit transaction
    const transaction = await client.query(
      `INSERT INTO wallet_transactions 
       (wallet_id, type, amount, currency, description, status, proof_image_url, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
       RETURNING *`,
      [
        wallet.id,
        'deposit',
        amount,
        'BOM',
        description || `Deposit of ${amount} BOM`,
        'pending',
        proofImageUrl
      ]
    );
    
    client.release();
    
    res.json({
      success: true,
      message: 'Deposit request submitted for verification',
      transactionId: transaction.rows[0].id,
      amount: amount
    });
  } catch (error) {
    console.error('Deposit API error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Request withdrawal
app.post('/api/wallet/withdraw', verifyTelegramAuth, async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({ error: 'Database unavailable' });
  }
  
  try {
    const { amount, method, payoutDetails } = req.body;
    const userId = req.user.id;
    
    if (!amount || amount < 20) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is 20 BOM' });
    }
    
    if (!method || !payoutDetails) {
      return res.status(400).json({ error: 'Method and payout details are required' });
    }
    
    const client = await dbPool.connect();
    
    // Get wallet
    const walletResult = await client.query(
      'SELECT * FROM wallets WHERE user_id = $1',
      [userId]
    );
    
    if (walletResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    const wallet = walletResult.rows[0];
    
    if (wallet.is_frozen) {
      client.release();
      return res.status(403).json({ error: 'Wallet is frozen' });
    }
    
    if (parseFloat(wallet.balance) < amount) {
      client.release();
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    try {
      // Create withdrawal request
      const withdrawal = await client.query(
        `INSERT INTO withdrawals 
         (user_id, telegram_id, amount, currency, usd_value, method, payout_details, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
         RETURNING *`,
        [
          userId,
          userId,
          amount,
          'BOM',
          amount * 1, // 1 BOM = $1.00
          method,
          payoutDetails,
          'pending'
        ]
      );
      
      // Create transaction record
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, amount, currency, description, status, metadata, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          wallet.id,
          'withdrawal',
          -amount,
          'BOM',
          `Withdrawal request #${withdrawal.rows[0].id} via ${method}`,
          'pending',
          JSON.stringify({ withdrawal_id: withdrawal.rows[0].id })
        ]
      );
      
      // Reserve the amount
      await client.query(
        'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
        [amount, wallet.id]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Withdrawal request submitted',
        withdrawalId: withdrawal.rows[0].id,
        amount: amount,
        usdValue: amount * 1
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Withdrawal API error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get transaction history
app.get('/api/wallet/transactions', verifyTelegramAuth, async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({ error: 'Database unavailable' });
  }
  
  try {
    const userId = req.user.id;
    const { page = 0, limit = 10, type, status } = req.query;
    const offset = page * limit;
    
    const client = await dbPool.connect();
    
    // Get wallet
    const walletResult = await client.query(
      'SELECT id FROM wallets WHERE user_id = $1',
      [userId]
    );
    
    if (walletResult.rows.length === 0) {
      client.release();
      return res.json({
        transactions: [],
        pagination: {
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: false
        }
      });
    }
    
    const walletId = walletResult.rows[0].id;
    
    // Build query
    let query = 'SELECT * FROM wallet_transactions WHERE wallet_id = $1';
    let params = [walletId];
    let paramCount = 1;
    
    if (type && type !== 'all') {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      params.push(type);
    }
    
    if (status && status !== 'all') {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (paramCount + 1) + ' OFFSET $' + (paramCount + 2);
    params.push(parseInt(limit), parseInt(offset));
    
    // Get transactions
    const transactions = await client.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM wallet_transactions WHERE wallet_id = $1';
    const countParams = [walletId];
    
    if (type && type !== 'all') {
      countQuery += ' AND type = $2';
      countParams.push(type);
    }
    
    if (status && status !== 'all') {
      countQuery += ' AND status = $' + (countParams.length + 1);
      countParams.push(status);
    }
    
    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    client.release();
    
    res.json({
      transactions: transactions.rows.map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount)
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + limit < total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page) + 1
      }
    });
  } catch (error) {
    console.error('Transactions API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SUBSCRIPTION API ROUTES ====================

// Get subscription status
app.get('/api/subscription/status', verifyTelegramAuth, async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({ error: 'Database unavailable' });
  }
  
  try {
    const userId = req.user.id;
    const client = await dbPool.connect();
    
    // Check user subscription
    const subscriptionResult = await client.query(
      `SELECT * FROM user_subscriptions 
       WHERE user_id = $1 AND status = 'active' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    
    // Check user table for premium status
    const userResult = await client.query(
      'SELECT premium_status FROM users WHERE telegram_id = $1',
      [userId]
    );
    
    client.release();
    
    let tier = 'freemium';
    let subscription = null;
    
    if (subscriptionResult.rows.length > 0) {
      subscription = subscriptionResult.rows[0];
      const currentPeriodEnd = new Date(subscription.current_period_end);
      if (currentPeriodEnd > new Date()) {
        tier = 'premium';
      }
    } else if (userResult.rows.length > 0 && userResult.rows[0].premium_status === 'premium') {
      tier = 'premium';
    }
    
    res.json({
      tier: tier,
      isPremium: tier === 'premium',
      nextBillingDate: subscription?.current_period_end,
      autoRenew: subscription?.auto_renew || false,
      createdAt: subscription?.created_at,
      monthlyPrice: subscription?.monthly_price || 5.00
    });
  } catch (error) {
    console.error('Subscription status API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upgrade to premium
app.post('/api/subscription/upgrade', verifyTelegramAuth, async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({ error: 'Database unavailable' });
  }
  
  try {
    const userId = req.user.id;
    const client = await dbPool.connect();
    
    await client.query('BEGIN');
    
    try {
      // Check if already premium
      const existingSub = await client.query(
        `SELECT * FROM user_subscriptions 
         WHERE user_id = $1 AND status = 'active' AND tier = 'premium'`,
        [userId]
      );
      
      if (existingSub.rows.length > 0) {
        const periodEnd = new Date(existingSub.rows[0].current_period_end);
        if (periodEnd > new Date()) {
          throw new Error('User is already on premium tier');
        }
      }
      
      // Check wallet balance
      const walletResult = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1',
        [userId]
      );
      
      if (walletResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }
      
      const wallet = walletResult.rows[0];
      
      if (wallet.is_frozen) {
        throw new Error('Wallet is frozen');
      }
      
      if (parseFloat(wallet.balance) < 5) {
        throw new Error('Insufficient BOM balance. Need 5 BOM for premium subscription');
      }
      
      // Create subscription
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      
      const subscription = await client.query(
        `INSERT INTO user_subscriptions 
         (user_id, tier, status, monthly_price, currency, current_period_start, current_period_end, auto_renew, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
         RETURNING *`,
        [
          userId,
          'premium',
          'active',
          5.00,
          'BOM',
          now,
          periodEnd,
          true
        ]
      );
      
      // Create transaction
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, amount, currency, description, status, metadata, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          wallet.id,
          'subscription',
          -5.00,
          'BOM',
          'Monthly premium subscription',
          'completed',
          JSON.stringify({ subscription_id: subscription.rows[0].id })
        ]
      );
      
      // Update wallet balance
      await client.query(
        'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
        [5.00, wallet.id]
      );
      
      // Update user record
      await client.query(
        `INSERT INTO users (telegram_id, premium_status, premium_expires_at, created_at) 
         VALUES ($1, $2, $3, NOW()) 
         ON CONFLICT (telegram_id) 
         DO UPDATE SET premium_status = $2, premium_expires_at = $3, updated_at = NOW()`,
        [userId, 'premium', periodEnd]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Successfully upgraded to premium subscription',
        tier: 'premium',
        nextBillingDate: periodEnd
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Upgrade API error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== STATIC FILE SERVING ====================

// Serve wallet files
app.use('/wallet', express.static(path.join(__dirname, 'wallet')));

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler
app.use((req, res) => {
  if (req.url.startsWith('/api')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    res.status(404).sendFile(path.join(__dirname, 'wallet', 'index.html'));
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== SERVER STARTUP ====================

async function startServer() {
  try {
    console.log('🚀 Starting Botomics Wallet Server...');
    console.log('====================================');
    
    // Test database connection
    console.log('📊 Testing database connection...');
    const dbConnected = await testDatabaseConnection();
    
    if (!dbConnected) {
      console.warn('⚠️ Database connection failed - running in limited mode');
      console.warn('💡 Wallet features will be unavailable');
    }
    
    let server;
    
    if (USE_HTTPS && SSL_CERT_PATH && SSL_KEY_PATH) {
      try {
        const https = require('https');
        const options = {
          key: fs.readFileSync(SSL_KEY_PATH),
          cert: fs.readFileSync(SSL_CERT_PATH)
        };
        server = https.createServer(options, app);
        console.log('🔒 HTTPS server configured');
      } catch (sslError) {
        console.error('❌ SSL error:', sslError.message);
        console.log('⚠️  Falling back to HTTP');
        const http = require('http');
        server = http.createServer(app);
      }
    } else {
      const http = require('http');
      server = http.createServer(app);
    }
    
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\n🌐 Available URLs:`);
      console.log(`   Wallet: http${USE_HTTPS ? 's' : ''}://localhost:${PORT}/wallet`);
      console.log(`   API: http${USE_HTTPS ? 's' : ''}://localhost:${PORT}/api`);
      console.log(`   Health: http${USE_HTTPS ? 's' : ''}://localhost:${PORT}/api/health`);
      console.log(`\n📊 Database: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`\n✅ Botomics Wallet System is ready!`);
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down server...');
      server.close(() => {
        console.log('✅ Server closed');
        if (dbPool) {
          dbPool.end();
          console.log('✅ Database pool closed');
        }
        process.exit(0);
      });
    });
    
    // Error handling
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log('💡 Try a different port: PORT=3001 npm start');
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;