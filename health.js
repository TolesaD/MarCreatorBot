const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    service: 'MarCreatorBot'
  });
});

// Start health check server (separate from bot)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏥 Health check server running on port ${PORT}`);
});

module.exports = app;