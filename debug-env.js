// debug-env.js
console.log('🚀 DEBUG: Checking Railway Environment Variables');
console.log('===============================================');

// Check critical variables
const criticalVars = [
  'BOT_TOKEN',
  'ENCRYPTION_KEY', 
  'DATABASE_DIALECT',
  'NODE_ENV',
  'DATABASE_URL',
  'PORT'
];

console.log('\n🔍 Critical Environment Variables:');
criticalVars.forEach(key => {
  const value = process.env[key];
  console.log(`   ${key}: ${value ? '✅ SET' : '❌ NOT SET'}`);
  if (value) {
    if (key.includes('TOKEN') || key.includes('KEY')) {
      console.log(`      Value: ${value.substring(0, 10)}...${value.substring(value.length - 4)}`);
    } else {
      console.log(`      Value: ${value}`);
    }
  }
});

console.log('\n📋 All Environment Variables (filtered):');
Object.keys(process.env)
  .filter(key => key.includes('BOT') || key.includes('DATABASE') || key.includes('NODE') || key.includes('ENV'))
  .forEach(key => {
    const value = process.env[key];
    console.log(`   ${key}: ${value ? 'SET' : 'NOT SET'}`);
  });

console.log('\n===============================================');