// cpanel-wallet.js - cPanel/LiteSpeed Wallet Server
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve wallet files
app.use('/wallet', express.static(path.join(__dirname, 'wallet')));

// Serve index.html for /wallet
app.get('/wallet', (req, res) => {
  res.sendFile(path.join(__dirname, 'wallet', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'botomics-wallet',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Wallet server running on port ${PORT}`);
  console.log(`🌐 Wallet available at: http://localhost:${PORT}/wallet`);
});