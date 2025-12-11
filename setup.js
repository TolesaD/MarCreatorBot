// setup.js - Production Setup Script
console.log('🔧 Setting up Botomics Production Environment...');

const fs = require('fs');
const path = require('path');

// Create required directories
const directories = [
  'uploads',
  'logs',
  'backups',
  'wallet',
  'src/routes',
  'src/middleware'
];

directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Check for .env file
const envExample = `# Botomics Production Configuration
# Copy this file to .env and fill in your values

# Server Configuration
PORT=3000
NODE_ENV=production
USE_HTTPS=false
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem

# Bot Configuration
BOT_TOKEN=your_bot_token_here

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=metabot_creator
DB_DIALECT=sqlite
DB_STORAGE=./metabot_creator.db

# Web App URL
APP_URL=${RAILWAY_STATIC_URL}

# Platform Admin
PLATFORM_CREATOR_ID=1827785384

# Security
JWT_SECRET=your_jwt_secret_here_change_this_in_production
SESSION_SECRET=your_session_secret_here_change_this_in_production

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Upload Configuration
MAX_UPLOAD_SIZE=5242880 # 5MB
UPLOAD_DIR=./uploads

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/botomics.log

# Cron Jobs
CRON_SUBSCRIPTIONS="0 0 * * *" # Daily at midnight
CRON_BACKUP="0 2 * * *" # Daily at 2 AM

# Features
ENABLE_WALLET=true
ENABLE_PREMIUM=true
ENABLE_ADS=true
ENABLE_DONATIONS=true

# Support
SUPPORT_CHAT_ID=-1001234567890
SUPPORT_USERNAME=@BotomicsSupport
`;

if (!fs.existsSync('.env')) {
  fs.writeFileSync('.env', envExample);
  console.log('📄 Created .env.example file');
  console.log('⚠️  Please edit .env file with your actual values');
} else {
  console.log('✅ .env file already exists');
}

// Check for required files
const requiredFiles = [
  'server.js',
  'src/app.js',
  'wallet/app.js',
  'wallet/index.html',
  'wallet/style.css'
];

const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(__dirname, file)));

if (missingFiles.length > 0) {
  console.warn('⚠️  Missing required files:', missingFiles);
  console.log('💡 Please ensure all required files are present');
} else {
  console.log('✅ All required files present');
}

// Run database migrations
console.log('🔄 Running database migrations...');
try {
  require('./scripts/ensureDatabase.js');
  console.log('✅ Database setup completed');
} catch (error) {
  console.error('❌ Database setup failed:', error.message);
}

// Setup Botomics tables
console.log('🔄 Setting up Botomics wallet system...');
try {
  require('./src/scripts/setup_botomics.js');
  console.log('✅ Botomics setup completed');
} catch (error) {
  console.error('❌ Botomics setup failed:', error.message);
}

// Set bot commands
console.log('🔄 Setting up bot commands...');
try {
  require('./scripts/setCommands.js');
  console.log('✅ Bot commands set');
} catch (error) {
  console.error('❌ Failed to set bot commands:', error.message);
}

console.log('\n🎉 Botomics Setup Complete!');
console.log('===========================');
console.log('\n📋 Next Steps:');
console.log('1. Edit .env file with your actual values');
console.log('2. Run database migrations: npm run migrate');
console.log('3. Start the server: npm start');
console.log('4. Test the wallet: npm run wallet:test');
console.log('\n📁 Directory Structure:');
console.log('   /uploads      - Uploaded files (proof images)');
console.log('   /logs         - Application logs');
console.log('   /backups      - Database backups');
console.log('   /wallet       - Wallet web app files');
console.log('   /src          - Source code');
console.log('\n🚀 To start in production:');
console.log('   npm run start:prod');
console.log('\n🔧 To start in development:');
console.log('   npm run dev');
console.log('\n📱 Wallet URL:');
console.log('   http://localhost:3000/wallet');
console.log('\n✅ Setup complete!');