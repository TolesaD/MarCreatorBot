// config/environment.js - RAILWAY DEPLOYMENT VERSION

// config/environment.js - FIXED VERSION

// Helper function to ensure HTTPS (except for localhost)
const ensureHttps = (url) => {
  if (!url) return url;
  
  // Remove any existing protocol
  let cleanUrl = url.trim().replace(/\/$/, '');
  
  // Remove any existing http:// or https://
  cleanUrl = cleanUrl.replace(/^https?:\/\//i, '');
  
  // Don't modify localhost URLs (development)
  if (cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1')) {
    return `http://${cleanUrl}`;
  }
  
  // Add https:// for all other URLs
  return `https://${cleanUrl}`;
};

function createConfig() {
  const env = process.env.NODE_ENV || 'production';
  const isDevelopment = env === 'development';
  const isProduction = env === 'production';
  
  // Better Railway detection
  const isRailway = process.env.RAILWAY_ENVIRONMENT || 
                   process.env.RAILWAY_STATIC_URL || 
                   process.env.RAILWAY_SERVICE_NAME;
  
  const isCpanel = false;

  // Handle database URL (fix duplicate check)
  const databaseUrl = process.env.DATABASE_URL;
  
  // Handle URLs correctly for both development and production
  let walletUrl = process.env.WALLET_URL;
  let appUrl = process.env.APP_URL;
  let publicUrl = process.env.PUBLIC_URL;
  
  // Log URL sources for debugging
  console.log('🔧 Config: Detecting URLs...');
  console.log('   isRailway:', isRailway);
  console.log('   RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL);
  console.log('   PUBLIC_URL:', process.env.PUBLIC_URL);
  console.log('   WALLET_URL:', process.env.WALLET_URL);
  
  if (isRailway) {
    // Railway production - prioritize RAILWAY_STATIC_URL
    if (process.env.RAILWAY_STATIC_URL) {
      const baseUrl = ensureHttps(process.env.RAILWAY_STATIC_URL);
      appUrl = baseUrl;
      publicUrl = baseUrl;
      
      if (!walletUrl) {
        walletUrl = `${baseUrl}/wallet`;
      }
      
      console.log(`🚂 Railway: Using RAILWAY_STATIC_URL: ${baseUrl}`);
    } 
    // Fallback to RAILWAY_PUBLIC_URL
    else if (process.env.RAILWAY_PUBLIC_URL) {
      const baseUrl = ensureHttps(process.env.RAILWAY_PUBLIC_URL);
      appUrl = baseUrl;
      publicUrl = baseUrl;
      
      if (!walletUrl) {
        walletUrl = `${baseUrl}/wallet`;
      }
      
      console.log(`🚂 Railway: Using RAILWAY_PUBLIC_URL: ${baseUrl}`);
    }
  } else if (isDevelopment) {
    // Local development - use PUBLIC_URL from .env
    if (process.env.PUBLIC_URL) {
      const baseUrl = process.env.PUBLIC_URL.trim().replace(/\/$/, '');
      appUrl = baseUrl;
      publicUrl = baseUrl;
      
      if (!walletUrl) {
        walletUrl = `${baseUrl}/wallet`;
      }
      
      console.log(`🔧 Development: Using PUBLIC_URL from .env: ${baseUrl}`);
    } else {
      // Default local development
      appUrl = 'http://localhost:3000';
      publicUrl = 'http://localhost:3000';
      walletUrl = 'http://localhost:3000/wallet';
      console.log('🔧 Development: Using default localhost:3000');
    }
  }
  
  // Ensure HTTPS for all production URLs (even if manually set)
  if (isProduction) {
    appUrl = ensureHttps(appUrl);
    publicUrl = ensureHttps(publicUrl);
    walletUrl = ensureHttps(walletUrl);
  }

  // Fallback for any undefined URLs
  if (!appUrl && isProduction) {
    appUrl = 'https://botomics.up.railway.app';
    publicUrl = appUrl;
    walletUrl = `${appUrl}/wallet`;
    console.log(`⚠️  No URL detected, using fallback: ${appUrl}`);
  }

  return {
    // ==================== ENVIRONMENT ====================
    NODE_ENV: env,
    IS_DEVELOPMENT: isDevelopment,
    IS_PRODUCTION: isProduction,
    IS_RAILWAY: !!isRailway,
    IS_CPANEL: isCpanel,
    
    // ==================== BOT CONFIGURATION ====================
    BOT_TOKEN: process.env.BOT_TOKEN,
    MAIN_BOT_USERNAME: process.env.MAIN_BOT_USERNAME || '@BotomicsBot',
    MAIN_BOT_NAME: 'BotomicsBot',
    
    // Railway provides the public URL
    WEBHOOK_URL: ensureHttps(process.env.RAILWAY_STATIC_URL || process.env.WEBHOOK_URL),
    
    // ==================== DATABASE CONFIGURATION ====================
    DATABASE_URL: databaseUrl,
    DATABASE_DIALECT: 'postgres',
    
    // Connection pool settings
    DATABASE_POOL_MAX: parseInt(process.env.DATABASE_POOL_MAX) || 10,
    DATABASE_POOL_IDLE: parseInt(process.env.DATABASE_POOL_IDLE) || 30000,
    DATABASE_POOL_ACQUIRE: parseInt(process.env.DATABASE_POOL_ACQUIRE) || 60000,
    
    // ==================== ENCRYPTION ====================
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    
    // ==================== SERVER CONFIGURATION ====================
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || '0.0.0.0',
    
    // ==================== URL CONFIGURATION ====================
    WALLET_URL: walletUrl,
    APP_URL: appUrl,
    PUBLIC_URL: publicUrl,
    
    // ==================== SECURITY & LIMITS ====================
    MAX_BOTS_PER_USER: parseInt(process.env.MAX_BOTS_PER_USER) || 10,
    MAX_ADMINS_PER_BOT: parseInt(process.env.MAX_ADMINS_PER_BOT) || 10,
    MAX_BROADCAST_LENGTH: parseInt(process.env.MAX_BROADCAST_LENGTH) || 4000,
    
    // Rate limiting
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000,
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    
    // ==================== PLATFORM ADMIN ====================
    PLATFORM_CREATOR_ID: process.env.PLATFORM_CREATOR_ID || '1827785384',
    
    // ==================== WALLET & PREMIUM SETTINGS ====================
    ENABLE_WALLET_SYSTEM: process.env.ENABLE_WALLET_SYSTEM !== 'false',
    ENABLE_PREMIUM_SUBSCRIPTIONS: process.env.ENABLE_PREMIUM_SUBSCRIPTIONS !== 'false',
    BOTOMICS_PREMIUM_PRICE: parseFloat(process.env.BOTOMICS_PREMIUM_PRICE) || 5,
    BOTOMICS_MIN_WITHDRAWAL: parseFloat(process.env.BOTOMICS_MIN_WITHDRAWAL) || 20,
    
    // ==================== FEATURE FLAGS ====================
    ENABLE_ADVERTISING_ECOSYSTEM: process.env.ENABLE_ADVERTISING_ECOSYSTEM !== 'false',
    ENABLE_MINI_BOT_DASHBOARD: process.env.ENABLE_MINI_BOT_DASHBOARD !== 'false',
    ENABLE_DIRECT_MANAGEMENT: process.env.ENABLE_DIRECT_MANAGEMENT !== 'false',
    REAL_TIME_NOTIFICATIONS: process.env.REAL_TIME_NOTIFICATIONS !== 'false',
    AUTO_RESTART_BOTS: process.env.AUTO_RESTART_BOTS !== 'false',
    MINI_BOT_COMMANDS_ENABLED: process.env.MINI_BOT_COMMANDS_ENABLED !== 'false',
    
    // ==================== PERFORMANCE ====================
    MINI_BOT_TIMEOUT: parseInt(process.env.MINI_BOT_TIMEOUT) || 90000,
    BROADCAST_RATE_LIMIT: parseInt(process.env.BROADCAST_RATE_LIMIT) || 20,
    
    // ==================== BOT PERSISTENCE ====================
    PERSIST_BOT_SESSIONS: process.env.PERSIST_BOT_SESSIONS !== 'false',
    AUTO_RECONNECT_BOTS: process.env.AUTO_RECONNECT_BOTS !== 'false',
    
    // ==================== LOGGING ====================
    LOG_LEVEL: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    
    // ==================== NEW FEATURES ====================
    ENABLE_OWNERSHIP_TRANSFER: process.env.ENABLE_OWNERSHIP_TRANSFER !== 'false',
    ENABLE_PINNED_MESSAGES: process.env.ENABLE_PINNED_MESSAGES !== 'false',
    
    // ==================== ADVERTISING SHARES ====================
    BOTOMICS_AD_PLATFORM_SHARE: parseFloat(process.env.BOTOMICS_AD_PLATFORM_SHARE) || 0.2,
    BOTOMICS_AD_BOT_OWNER_SHARE: parseFloat(process.env.BOTOMICS_AD_BOT_OWNER_SHARE) || 0.6,
    BOTOMICS_AD_USER_SHARE: parseFloat(process.env.BOTOMICS_AD_USER_SHARE) || 0.2
  };
}

// Export the factory function
module.exports = createConfig;