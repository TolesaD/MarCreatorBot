const { Sequelize } = require('sequelize');
const config = require('../config/environment');

let sequelize;

console.log(`🗄️ Database configuration: ${config.DATABASE_DIALECT}`);
console.log(`🌐 Environment: ${config.NODE_ENV}`);

// Validate DATABASE_URL
if (!config.DATABASE_URL) {
  console.error('❌ DATABASE_URL is required but not set');
  if (config.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('⚠️  Continuing without database connection in development');
    sequelize = new Sequelize('postgres://localhost:5432/temp');
  }
} else {
  console.log('🔄 Configuring PostgreSQL database...');
  
  // CRITICAL: Parse DATABASE_URL for better logging (without exposing credentials)
  try {
    const dbUrl = new URL(config.DATABASE_URL);
    console.log(`📊 PostgreSQL Host: ${dbUrl.hostname}`);
    console.log(`📊 PostgreSQL Database: ${dbUrl.pathname.substring(1)}`);
  } catch (error) {
    console.log('⚠️  Could not parse DATABASE_URL for logging');
  }
  
  sequelize = new Sequelize(config.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: config.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false,
      connectTimeout: 60000,
      keepAlive: true,
      statement_timeout: 60000,
      query_timeout: 60000,
    },
    logging: config.LOG_LEVEL === 'debug' ? console.log : false,
    pool: {
      max: config.DATABASE_POOL_MAX || 20,
      min: 0,
      acquire: config.DATABASE_POOL_ACQUIRE || 60000,
      idle: config.DATABASE_POOL_IDLE || 10000,
      evict: 10000,
      handleDisconnects: true,
    },
    retry: {
      max: 5,
      timeout: 30000,
      match: [
        /ConnectionError/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /TimeoutError/,
        /SequelizeDatabaseError/,
      ],
    },
    connectTimeout: 60000,
  });
}

const connectDB = async () => {
  // If no DATABASE_URL, skip connection in development
  if (!config.DATABASE_URL && config.NODE_ENV !== 'production') {
    console.warn('⚠️  No DATABASE_URL set, skipping database connection');
    return false;
  }

  let retries = 5;
  
  while (retries > 0) {
    try {
      console.log('🔄 Connecting to PostgreSQL database...');
      await sequelize.authenticate();
      console.log('✅ PostgreSQL database connected successfully');
      
      // CRITICAL: Use alter in production to ensure schema matches models
      const syncOptions = config.NODE_ENV === 'production' 
        ? { alter: true, force: false }
        : { alter: true, force: false };
      
      console.log('🔄 Synchronizing database models...');
      await sequelize.sync(syncOptions);
      console.log('✅ Database models synchronized successfully');
      
      // CRITICAL: Verify we can query the bots table specifically
      try {
        const { Bot } = require('../models');
        const botCount = await Bot.count();
        console.log(`📊 Database verified: ${botCount} bots found`);
        
        if (botCount > 0) {
          const activeBots = await Bot.findAll({ 
            where: { is_active: true },
            attributes: ['id', 'bot_name', 'bot_id', 'is_active']
          });
          console.log(`📊 Active bots ready for initialization: ${activeBots.length}`);
          
          // Log each active bot for debugging
          activeBots.forEach(bot => {
            console.log(`   🤖 ${bot.bot_name} (ID: ${bot.id}, Bot ID: ${bot.bot_id})`);
          });
        } else {
          console.log('ℹ️  No bots found in database - this is normal for new deployment');
        }
      } catch (queryError) {
        console.log('⚠️  Could not query bots table:', queryError.message);
        // This might happen on first run, continue anyway
      }
      
      return true;
    } catch (error) {
      console.error(`❌ PostgreSQL connection failed (${retries} retries left):`, error.message);
      
      retries -= 1;
      if (retries === 0) {
        console.error('💥 All PostgreSQL connection attempts failed');
        
        console.error('💡 PostgreSQL connection tips for Railway:');
        console.error('   - Check if DATABASE_URL is correct in Railway variables');
        console.error('   - Verify PostgreSQL addon is provisioned in your Railway project');
        console.error('   - Check if the PostgreSQL service is running');
        console.error('   - Ensure your Railway project has proper database permissions');
        
        if (config.NODE_ENV === 'production') {
          console.error('❌ Cannot continue without database in production');
          process.exit(1);
        } else {
          console.log('⚠️  Continuing without database connection in development...');
          return false;
        }
      }
      
      // Wait before retrying with exponential backoff
      const delay = Math.pow(2, 5 - retries) * 1000;
      console.log(`🔄 Retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Health check method
const healthCheck = async () => {
  try {
    await sequelize.authenticate();
    const { Bot } = require('../models');
    const botCount = await Bot.count();
    const activeBots = await Bot.count({ where: { is_active: true } });
    
    return {
      healthy: true,
      bots: {
        total: botCount,
        active: activeBots
      },
      dialect: 'postgres',
      status: 'CONNECTED'
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      dialect: 'postgres',
      status: 'DISCONNECTED'
    };
  }
};

// Get database info for debugging
const getDatabaseInfo = async () => {
  try {
    const [result] = await sequelize.query(`
      SELECT 
        current_database() as database,
        version() as version,
        current_user as user,
        inet_client_addr() as client_address
    `);
    return result[0];
  } catch (error) {
    return { error: error.message };
  }
};

// CRITICAL: Add method to check if bots table exists and is accessible
const checkBotsTable = async () => {
  try {
    const [result] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bots'
      );
    `);
    const tableExists = result[0].exists;
    
    if (tableExists) {
      const { Bot } = require('../models');
      const botCount = await Bot.count();
      return {
        exists: true,
        accessible: true,
        botCount: botCount
      };
    } else {
      return {
        exists: false,
        accessible: false,
        botCount: 0
      };
    }
  } catch (error) {
    return {
      exists: false,
      accessible: false,
      error: error.message
    };
  }
};

module.exports = { 
  sequelize, 
  connectDB, 
  healthCheck, 
  getDatabaseInfo,
  checkBotsTable  // NEW: Added for better debugging
};