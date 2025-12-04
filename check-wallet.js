// check-wallet.js
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking wallet files...\n');

const walletDir = './wallet';
const requiredFiles = [
  'index.html',
  'app.js',
  'style.css',
  'manifest.json'
];

// Check directory
if (!fs.existsSync(walletDir)) {
  console.error('❌ Wallet directory not found!');
  console.log('💡 Create it with: mkdir wallet');
  process.exit(1);
}

console.log(`📁 Wallet directory: ${path.resolve(walletDir)}`);

// Check files
let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(walletDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}: FOUND`);
  } else {
    console.log(`❌ ${file}: MISSING`);
    allFilesExist = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allFilesExist) {
  console.log('✅ All wallet files are present!');
  console.log('\n🌐 To test locally:');
  console.log('   1. Install express: npm install express');
  console.log('   2. Run: node cpanel-wallet.js');
  console.log('   3. Visit: http://localhost:3000/wallet');
} else {
  console.log('❌ Some wallet files are missing!');
  console.log('\n💡 Make sure you have all these files in /wallet directory:');
  console.log('   - index.html');
  console.log('   - app.js');
  console.log('   - style.css');
  console.log('   - manifest.json');
}