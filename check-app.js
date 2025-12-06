// check-app.js - Check for syntax errors
console.log('🔍 Checking app for errors...');

try {
  // Check if config loads
  console.log('📋 Loading config...');
  const config = require('./config/environment');
  console.log('✅ Config loaded:', config.NODE_ENV);
  
  // Check if database module loads
  console.log('🗄️ Checking database module...');
  const db = require('./database/db');
  console.log('✅ Database module loaded');
  
  // Check if app module loads
  console.log('🤖 Checking app module...');
  const MetaBotCreator = require('./src/app.js');
  console.log('✅ App module loaded');
  
  // Now start the app
  console.log('\n🚀 Starting application...');
  if (require.main === module) {
    const app = new MetaBotCreator();
    app.initialize().then(() => {
      console.log('✅ App initialized');
      app.start();
    }).catch(err => {
      console.error('❌ App init error:', err);
      // Start server anyway
      startFallbackServer();
    });
  }
  
} catch (error) {
  console.error('❌ FATAL ERROR:', error.message);
  console.error(error.stack);
  
  // Start fallback server
  startFallbackServer();
}

function startFallbackServer() {
  console.log('\n🔄 Starting fallback server...');
  const express = require('express');
  const app = express();
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  
  app.get('/', (req, res) => {
    res.json({ 
      status: 'online (error recovery)',
      timestamp: new Date().toISOString(),
      message: 'Main app failed, but server is running'
    });
  });
  
  app.listen(PORT, HOST, () => {
    console.log(`✅ Server running on ${HOST}:${PORT}`);
  });
}