// test-quick.js - QUICK LOCAL TEST
require('dotenv').config();

console.log('⚡ QUICK TEST - MarCreatorBot');
console.log('=============================\n');

// Basic environment check
const vars = ['BOT_TOKEN', 'ENCRYPTION_KEY', 'DATABASE_URL'];
let ok = true;

vars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`❌ ${varName}: MISSING`);
    ok = false;
  } else {
    console.log(`✅ ${varName}: SET (${value.length} chars)`);
  }
});

if (!ok) {
  console.log('\n💡 Create a .env file with the missing variables');
  process.exit(1);
}

// Quick config test
try {
  require('./config/environment');
  console.log('\n✅ Configuration: OK');
} catch (error) {
  console.log('\n❌ Configuration failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 Quick test passed! Run "npm test" for full test suite.');