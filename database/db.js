const { Sequelize } = require('sequelize');

// Direct environment variable access for database connection
const DATABASE_URL = process.env.DATABASE_URL;

console.log('🗄️ Database configuration:');
console.log('   DATABASE_URL from process.env:', !!DATABASE_URL);
console.log('   DATABASE_URL length:', DATABASE_URL ? DATABASE_URL.length : 0);

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined in environment variables');
  console.error('💡 Please check your Railway environment variables');
  process.exit(1);
}

// Parse and log database info safely
let dbLogInfo = 'Could not parse DATABASE_URL';
try {
  const dbUrl = new URL(DATABASE_URL);
  dbLogInfo = `${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}`;
} catch (e) {
  dbLogInfo = DATABASE_URL.substring(0, 50) + '...';
}

console.log('   Connecting to:', dbLogInfo);

// Create Sequelize instance
const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: parseInt(process.env.DATABASE_POOL_MAX) || 20,
    min: 0,
    acquire: parseInt(process.env.DATABASE_POOL_ACQUIRE) || 60000,
    idle: parseInt(process.env.DATABASE_POOL_IDLE) || 30000,
  },
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
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
    const { Bot } = require('../models');
    
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