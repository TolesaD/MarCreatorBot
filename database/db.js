// database/db.js - PRODUCTION WORKING VERSION
const { Sequelize } = require('sequelize');
const config = require('../config/environment');

console.log('🗄️ Database configuration:');

if (!config.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not configured');
  console.error('💡 Check Railway environment variables - DATABASE_URL should be auto-provided');
  process.exit(1);
}

// Enhanced database URL parsing
let dbHost = 'unknown';
try {
  const dbUrl = new URL(config.DATABASE_URL);
  dbHost = `${dbUrl.hostname}:${dbUrl.port || 5432}`;
} catch (error) {
  // If URL parsing fails, try to extract host info manually
  const match = config.DATABASE_URL.match(/@([^:]+):(\d+)\//);
  if (match) {
    dbHost = `${match[1]}:${match[2]}`;
  }
}

console.log('   Connecting to:', dbHost);
console.log('   Database URL length:', config.DATABASE_URL.length);

// Create Sequelize instance with production optimizations
const sequelize = new Sequelize(config.DATABASE_URL, {
  dialect: 'postgres',
  logging: config.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: config.DATABASE_POOL_MAX,
    min: 0,
    acquire: config.DATABASE_POOL_ACQUIRE,
    idle: config.DATABASE_POOL_IDLE,
  },
  dialectOptions: {
    ssl: config.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  },
  retry: {
    max: 3,
    timeout: 30000
  }
});

console.log('✅ Database configured successfully');

// Database connection function
async function connectDB() {
  try {
    console.log('🗄️ Establishing database connection...');
    
    // Test connection with timeout
    const connectionPromise = sequelize.authenticate();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 30000);
    });
    
    await Promise.race([connectionPromise, timeoutPromise]);
    console.log('✅ Database connection established successfully');
    
    // Sync all models
    await sequelize.sync({ alter: true });
    console.log('✅ All database models synchronized');
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    if (config.NODE_ENV === 'production') {
      console.error('💥 Cannot continue without database in production');
      process.exit(1);
    }
    
    return false;
  }
}

// Health check function
async function healthCheck() {
  try {
    await sequelize.authenticate();
    
    // Import models dynamically to avoid circular dependency
    const { Bot } = require('../src/models');
    
    const totalBots = await Bot.count();
    const activeBots = await Bot.count({ where: { is_active: true } });
    
    return {
      healthy: true,
      bots: {
        total: totalBots,
        active: activeBots
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Disconnect function
async function disconnectDB() {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
}

module.exports = {
  sequelize,
  connectDB,
  healthCheck,
  disconnectDB
};