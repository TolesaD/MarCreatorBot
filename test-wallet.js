// test-wallet.js - Fixed version
const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Wallet Setup\n');

// Test 1: Check wallet files exist
console.log('1. Checking wallet files...');
const walletDir = './wallet';
if (!fs.existsSync(walletDir)) {
  console.log('❌ Wallet directory not found!');
  process.exit(1);
}

const requiredFiles = ['index.html', 'app.js', 'style.css', 'manifest.json'];
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(walletDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file}`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some wallet files are missing!');
  process.exit(1);
}

console.log('\n✅ All wallet files found!');

// Test 2: Check if we can serve files
console.log('\n2. Testing file serving...');

// Create a simple HTTP server without Express
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    const indexPath = path.join(walletDir, 'index.html');
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/app.js') {
    const jsPath = path.join(walletDir, 'app.js');
    fs.readFile(jsPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading app.js');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(0, () => {
  const port = server.address().port;
  console.log(`   ✅ Test server started on port ${port}`);
  
  // Test 3: Make HTTP request
  console.log('\n3. Testing HTTP access...');
  
  http.get(`http://localhost:${port}/`, (res) => {
    if (res.statusCode === 200) {
      console.log(`   ✅ HTTP 200 OK`);
      console.log('\n🎉 Wallet files are accessible!');
      console.log('\n📱 Production setup:');
      console.log('   Wallet URL: https://testweb.maroset.com/wallet');
      console.log('   Bot: @BotomicsSupport');
      console.log('\n✅ Test completed successfully!');
      
      server.close(() => {
        process.exit(0);
      });
    } else {
      console.log(`   ❌ HTTP ${res.statusCode}`);
      server.close(() => process.exit(1));
    }
  }).on('error', (err) => {
    console.log(`   ❌ Connection error: ${err.message}`);
    server.close(() => process.exit(1));
  });
});