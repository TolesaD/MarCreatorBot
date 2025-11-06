const { Sequelize } = require('sequelize');
const config = require('../config/environment'); // Use config instead of direct process.env

console.log('🗄️ Database configuration:');
console.log('   Using DATABASE_URL from config');

if (!config.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not configured');
  process.exit(1);
}

// Create Sequelize instance using config
const sequelize = new Sequelize(config.DATABASE_URL, {
  dialect: config.DATABASE_DIALECT,
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
  }
});

console.log('✅ Database configured successfully');

// Database connection function (required by src/app.js)
async function connectDB() {
  try {
    console.log('🗄️ Establishing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    
    // Sync all models WITHOUT importing them (avoid circular dependency)
    await sequelize.sync({ alter: true });
    console.log('✅ All database models synchronized');
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Health check function (required by src/app.js)
async function healthCheck() {
  try {
    await sequelize.authenticate();
    
    // Import models dynamically to avoid circular dependency
    const { Bot } = require('../src/models');
    
    // Check if we can query the database
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