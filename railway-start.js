// Railway Startup Script - Debug Version
console.log('🚀 MarCreatorBot - Railway Startup');
console.log('===================================');

// Debug: List files to see project structure
const fs = require('fs');
console.log('📁 Current directory files:');
try {
    const files = fs.readdirSync('.');
    console.log('Root:', files);
} catch (e) {
    console.log('Error reading root:', e.message);
}

console.log('📁 src directory files:');
try {
    const srcFiles = fs.readdirSync('./src');
    console.log('Src:', srcFiles);
} catch (e) {
    console.log('Error reading src:', e.message);
}

// Check if app.js exists in different locations
console.log('🔍 Checking for app.js:');
console.log('./app.js exists:', fs.existsSync('./app.js'));
console.log('./src/app.js exists:', fs.existsSync('./src/app.js'));

// Process environment variables
function stripQuotes(value) {
  if (typeof value === 'string') {
    return value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
  return value;
}

process.env.BOT_TOKEN = stripQuotes(process.env.BOT_TOKEN);
process.env.ENCRYPTION_KEY = stripQuotes(process.env.ENCRYPTION_KEY);
process.env.DATABASE_URL = stripQuotes(process.env.DATABASE_URL);

console.log('✅ Environment variables processed');

// Try to require the app
console.log('🏃 Attempting to start application...');
try {
    require('./src/app.js');
    console.log('✅ Application started successfully from src/app.js');
} catch (error) {
    console.error('❌ Failed to start from src/app.js:', error.message);
    
    // Try alternative locations
    console.log('🔄 Trying alternative locations...');
    try {
        require('./app.js');
        console.log('✅ Application started successfully from app.js');
    } catch (error2) {
        console.error('❌ Failed to start from app.js:', error2.message);
        process.exit(1);
    }
}