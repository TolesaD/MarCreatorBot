// debug-start.js - Debug startup issues
console.log('🔍 DEBUGGING STARTUP ON RAILWAY');
console.log('================================');

// Check critical environment variables
console.log('📋 Environment check:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   PORT:', process.env.PORT);
console.log('   HOST:', process.env.HOST);
console.log('   RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('   BOT_TOKEN:', process.env.BOT_TOKEN ? 'SET' : 'NOT SET');

// Try to start your app
try {
  console.log('\n🚀 Attempting to start main app...');
  require('./src/app.js');
  console.log('✅ Main app required successfully');
} catch (error) {
  console.error('❌ Error requiring main app:', error.message);
  console.error('Stack:', error.stack);
  
  // Try minimal server as fallback
  console.log('\n🔄 Trying minimal server as fallback...');
  const express = require('express');
  const app = express();
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  
  app.get('/', (req, res) => {
    res.json({ 
      status: 'online (fallback)',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  });
  
  app.listen(PORT, HOST, () => {
    console.log(`✅ Fallback server running on ${HOST}:${PORT}`);
  });
}