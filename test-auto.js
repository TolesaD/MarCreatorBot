// test-auto.js - Test automatic initialization
console.log('🧪 Testing automatic initialization...');

const MiniBotManager = require('./src/services/MiniBotManager');

async function testAutoInit() {
  console.log('1. Testing MiniBotManager directly...');
  
  try {
    const result = await MiniBotManager.initializeAllBots();
    console.log(`✅ MiniBotManager result: ${result} bots started`);
    
    console.log('2. Checking initialization status...');
    const status = MiniBotManager.getInitializationStatus();
    console.log('Status:', status);
    
    console.log('3. Debugging active bots...');
    MiniBotManager.debugActiveBots();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAutoInit();