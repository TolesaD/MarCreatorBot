// start-railway.js - Railway Startup with Robust Environment Loading
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');

try {
  // Load environment variables using robust loader
  const envLoader = require('./config/railway-env');
  const envVars = envLoader.load();

  console.log('✅ Environment Variables Status:');
  console.log(`   BOT_TOKEN: SET (${envVars.BOT_TOKEN.length} chars)`);
  console.log(`   ENCRYPTION_KEY: SET (${envVars.ENCRYPTION_KEY.length} chars)`);
  console.log(`   DATABASE_URL: SET (${envVars.DATABASE_URL.length} chars)`);
  console.log(`   DATABASE_URL verified: ${envVars.DATABASE_URL.includes('postgres') ? '✅ PostgreSQL' : '❌ Not PostgreSQL'}`);

  // Inject into process.env for compatibility
  process.env.BOT_TOKEN = envVars.BOT_TOKEN;
  process.env.ENCRYPTION_KEY = envVars.ENCRYPTION_KEY;
  process.env.DATABASE_URL = envVars.DATABASE_URL;

  console.log('🏃 Starting MarCreatorBot application...');
  
  // Start the main application
  require('./src/app.js');

} catch (error) {
  console.error('💥 CRITICAL: Failed to start application:', error.message);
  
  // Start a diagnostic server
  const http = require('http');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('MarCreatorBot - Environment Configuration Required\n\n' +
      'Please configure these environment variables in Railway:\n' +
      '- BOT_TOKEN: Your Telegram bot token\n' +
      '- ENCRYPTION_KEY: 32-character encryption key\n' +
      '- DATABASE_URL: Auto-provided by PostgreSQL service\n\n' +
      'Current Status: ' + error.message
    );
  });

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Diagnostic server running on port ${PORT}`);
    console.log('📱 Visit your Railway app URL for configuration instructions');
  });
}