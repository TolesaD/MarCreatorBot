// check-structure.js
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking project structure...\n');
console.log('Current directory:', __dirname);

// Check wallet directory
const walletPath = path.join(__dirname, 'wallet');
console.log('\n📁 Wallet directory:');
if (fs.existsSync(walletPath)) {
  console.log('✅ EXISTS:', walletPath);
  const files = fs.readdirSync(walletPath);
  console.log('   Files:', files.join(', '));
} else {
  console.log('❌ NOT FOUND');
}

// Check src/app.js
const appPath = path.join(__dirname, 'src', 'app.js');
console.log('\n📄 Main app file:');
if (fs.existsSync(appPath)) {
  console.log('✅ EXISTS:', appPath);
} else {
  console.log('❌ NOT FOUND');
}

// Check public directory
const publicPath = path.join(__dirname, 'public');
console.log('\n📁 Public directory:');
if (fs.existsSync(publicPath)) {
  console.log('✅ EXISTS:', publicPath);
} else {
  console.log('❌ NOT FOUND (will be created)');
}

console.log('\n' + '='.repeat(50));