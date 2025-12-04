// Botomics Wallet - Node.js Server (Optional - if you want Node.js backend)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://telegram.org"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.telegram.org"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'Botomics Wallet API',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'production'
    });
});

app.get('/api/wallet/balance', authenticate, async (req, res) => {
    try {
        const { userId } = req.query;
        
        // In production, fetch from database
        const balance = {
            balance: 15.50,
            currency: 'BOM',
            isFrozen: false,
            freezeReason: null,
            userId: userId || 'unknown',
            lastUpdated: new Date().toISOString()
        };
        
        res.json(balance);
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

app.get('/api/wallet/transactions', authenticate, async (req, res) => {
    try {
        const { userId, page = 1, limit = 10, type, status, period } = req.query;
        
        // Mock transactions - replace with database query
        const transactions = [
            {
                id: 'tx_' + Date.now(),
                type: 'deposit',
                amount: 50.00,
                currency: 'BOM',
                description: 'Initial deposit',
                status: 'completed',
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'tx_' + (Date.now() + 1),
                type: 'subscription',
                amount: -5.00,
                currency: 'BOM',
                description: 'Premium subscription',
                status: 'completed',
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        
        // Apply filters (simplified)
        let filtered = transactions;
        if (type && type !== 'all') {
            filtered = filtered.filter(t => t.type === type);
        }
        if (status && status !== 'all') {
            filtered = filtered.filter(t => t.status === status);
        }
        
        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginated = filtered.slice(startIndex, endIndex);
        
        res.json({
            transactions: paginated,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(filtered.length / limit),
                totalItems: filtered.length,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

app.post('/api/wallet/deposit', authenticate, async (req, res) => {
    try {
        const { userId, amount, description, proofImageUrl } = req.body;
        
        if (!userId || !amount || !proofImageUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (amount < 5) {
            return res.status(400).json({ error: 'Minimum deposit is 5 BOM' });
        }
        
        // Create deposit record
        const deposit = {
            id: 'dep_' + Date.now(),
            userId,
            amount: parseFloat(amount),
            description: description || `Deposit of ${amount} BOM`,
            proofImageUrl,
            status: 'pending',
            currency: 'BOM',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // In production, save to database and notify admin
        console.log('Deposit request:', deposit);
        
        res.json({
            success: true,
            message: 'Deposit request submitted for verification',
            transactionId: deposit.id,
            amount: deposit.amount,
            status: deposit.status,
            timestamp: deposit.createdAt
        });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ error: 'Failed to process deposit' });
    }
});

// ... More API endpoints ...

// Serve SPA for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'wallet', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Botomics Wallet Server running on port ${PORT}`);
    console.log(`🌐 https://testweb.maroset.com`);
    console.log(`💰 Wallet: https://testweb.maroset.com/wallet`);
    console.log(`⚡ API: https://testweb.maroset.com/api/health`);
});

// Authentication middleware
function authenticate(req, res, next) {
    // In production, validate Telegram Web App initData
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        // For development, allow without auth
        if (process.env.NODE_ENV === 'development') {
            return next();
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Validate Telegram Web App data
    // This would require implementing Telegram's validation
    next();
}

// Create uploads directory if it doesn't exist
async function ensureUploadsDir() {
    try {
        await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });
        console.log('✅ Uploads directory ready');
    } catch (error) {
        console.error('Failed to create uploads directory:', error);
    }
}

ensureUploadsDir();