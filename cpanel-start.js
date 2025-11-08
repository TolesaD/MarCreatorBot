// cpanel-start.js - cPanel Specific Startup
console.log('🚀 Starting from cPanel Node.js...');

// Set production environment
process.env.NODE_ENV = 'production';

// Load environment variables manually for cPanel
const fs = require('fs');
const path = require('path');

// Try to load .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
      process.env[key] = value.join('=').trim();
    }
  });
  console.log('✅ Loaded environment variables from .env');
} else {
  console.log('⚠️ No .env file found, using cPanel environment variables');
}

// Import and start the main app
const app = require('./src/app.js');
console.log('✅ Application started successfully via cPanel');