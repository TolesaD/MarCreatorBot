// health.js - WITH ENVIRONMENT SUPPORT
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     process.env.NODE_ENV === 'dev' || 
                     process.env.DEV_MODE === 'true';

const mainBotName = isDevelopment ? 'BotomicsDevBot' : 'BotomicsBot';
const serviceName = isDevelopment ? 'BotomicsBot DEV' : 'BotomicsBot';

console.log(`🏥 Health check server starting for ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} environment`);
console.log(`🤖 Service: ${serviceName}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

// Health check endpoint
app.get('/health', (req, res) => {
  const MiniBotManager = require('./src/services/MiniBotManager');
  const botManagerStatus = MiniBotManager.healthCheck();
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: serviceName,
    mainBot: mainBotName,
    isDevelopment: isDevelopment,
    botManager: {
      isHealthy: botManagerStatus.isHealthy,
      activeBots: botManagerStatus.activeBots,
      status: botManagerStatus.status,
      environment: botManagerStatus.environment
    },
    system: {
      node: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  });
});

// Detailed status endpoint
app.get('/status', (req, res) => {
  try {
    const MiniBotManager = require('./src/services/MiniBotManager');
    
    const status = {
      service: serviceName,
      environment: isDevelopment ? 'development 🚧' : 'production 🚀',
      mainBot: mainBotName,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      botManager: MiniBotManager.getInitializationStatus(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        }
      }
    };
    
    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      service: serviceName,
      error: error.message
    });
  }
});

// Simple ping endpoint for load balancers
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'pong', 
    service: serviceName,
    environment: isDevelopment ? 'dev' : 'prod',
    timestamp: new Date().toISOString()
  });
});

// Start health check server (separate from bot)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏥 Health check server running on port ${PORT}`);
  console.log(`🔍 Health endpoints:`);
  console.log(`   http://0.0.0.0:${PORT}/health`);
  console.log(`   http://0.0.0.0:${PORT}/status`);
  console.log(`   http://0.0.0.0:${PORT}/ping`);
});

module.exports = app;