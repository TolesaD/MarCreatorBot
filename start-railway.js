// start-railway.js - FIXED VERSION
console.log('🚀 MarCreatorBot - FIXED STARTUP MODE');
console.log('======================================');
console.log('🔧 FORCING APP STARTUP WITH HARDCODED VALUES');

// HARDCODED VALUES FOR TESTING
process.env.DATABASE_URL = 'postgresql://postgres:kLpoExiXkvPvBYaSERToYbaavbHiawPs@trolley.proxy.rlwy.net:43180/railway';
process.env.BOT_TOKEN = '7983296108:AAH8Dj_5WfhPN7g18jFI2VsexzJAiCjPgpI';
process.env.ENCRYPTION_KEY = 'W370NNal3+hm8KmDwQVOd2tzhW8S5Ma+Fk8MvVMK5QU=';
process.env.MAIN_BOT_NAME = 'MarCreatorBot';
process.env.PORT = '8080';
process.env.NODE_ENV = 'production';

console.log('✅ DATABASE_URL: SET (hardcoded)');
console.log('✅ BOT_TOKEN: SET (hardcoded)'); 
console.log('✅ ENCRYPTION_KEY: SET (hardcoded)');
console.log('✅ PORT: 8080 (hardcoded)');
console.log('✅ NODE_ENV: production (hardcoded)');

// TEST TELEGRAM API CONNECTION IMMEDIATELY
console.log('📡 Testing Telegram API connection before starting app...');
const testToken = process.env.BOT_TOKEN;

const testTelegramConnection = async () => {
  try {
    console.log('   Making API call to Telegram...');
    const response = await fetch(`https://api.telegram.org/bot${testToken}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Telegram API connection SUCCESSFUL:');
      console.log('   Bot Username:', data.result.username);
      console.log('   Bot Name:', data.result.first_name);
      console.log('   Bot ID:', data.result.id);
      console.log('   Can Join Groups:', data.result.can_join_groups);
      console.log('   Can Read Messages:', data.result.can_read_all_group_messages);
    } else {
      console.error('❌ Telegram API connection FAILED:');
      console.error('   Error:', data.description);
      console.error('   Error Code:', data.error_code);
      
      if (data.error_code === 404) {
        console.error('💡 BOT TOKEN IS INVALID OR REVOKED');
      } else if (data.error_code === 401) {
        console.error('💡 UNAUTHORIZED - TOKEN IS WRONG');
      }
    }
  } catch (error) {
    console.error('❌ Network error testing Telegram API:');
    console.error('   Error:', error.message);
    console.error('💡 Railway networking issue or DNS problem');
  }
};

// FIXED: Force the application to start
(async () => {
  await testTelegramConnection();
  
  console.log('🏃 FORCING APPLICATION START...');
  console.log('🤖 EXPECTED BOT BEHAVIOR:');
  console.log('   1. Main bot should connect to Telegram');
  console.log('   2. Should see "MetaBot Creator MAIN BOT is now RUNNING!"');
  console.log('   3. Mini-bots should initialize from database');
  
  try {
    // Import the app and manually start it
    const MetaBotCreator = require('./src/app.js');
    
    console.log('🔧 Manually starting MetaBotCreator...');
    const app = new MetaBotCreator();
    await app.initialize();
    app.start();
    
    console.log('✅ Application manually started successfully!');
    
  } catch (error) {
    console.error('❌ Failed to start application:');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    
    // Try alternative startup method
    console.log('🔄 Trying alternative startup method...');
    try {
      const { startApplication } = require('./src/app.js');
      await startApplication();
    } catch (error2) {
      console.error('❌ Alternative startup also failed:', error2.message);
      process.exit(1);
    }
  }
})();