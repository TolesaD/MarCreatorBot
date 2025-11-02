const { Sequelize } = require('sequelize');
const config = require('../config/environment');
const fs = require('fs');
const path = require('path');

let sequelize;

console.log(`🗄️ Database configuration: ${config.DATABASE_DIALECT}`);
console.log(`🌐 Environment: ${config.NODE_ENV}`);

// CRITICAL FIX: Proper database configuration for Railway
if (config.DATABASE_DIALECT === 'postgres' && config.DATABASE_URL) {
  console.log('🔄 Configuring PostgreSQL database for Railway...');
  
  // Parse DATABASE_URL for better configuration
  const dbUrl = new URL(config.DATABASE_URL);
  
  sequelize = new Sequelize(config.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: config.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    logging: config.LOG_LEVEL === 'debug' ? console.log : false,
    pool: {
      max: config.DATABASE_POOL_MAX || 20,
      min: 0,
      acquire: config.DATABASE_POOL_ACQUIRE || 30000,
      idle: config.DATABASE_POOL_IDLE || 10000
    },
    retry: {
      max: 5,
      timeout: 30000
    },
    // Add connection timeout
    connectTimeout: 60000,
    // Better reconnection settings
    reconnect: {
      max_retries: 5,
      onRetry: function(count) {
        console.log(`🔄 Database reconnection attempt ${count}`);
      }
    }
  });
} else {
  // SQLite configuration for development
  console.log('🔄 Configuring SQLite database...');
  
  let dbPath = config.DATABASE_URL || './metabot_creator.db';
  if (dbPath.startsWith('./')) {
    dbPath = path.join(process.cwd(), dbPath);
  }
  
  // Ensure the directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  console.log(`📁 SQLite database path: ${dbPath}`);
  
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: config.LOG_LEVEL === 'debug' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      max: 3
    }
  });
}

const connectDB = async () => {
  let retries = 5;
  
  while (retries > 0) {
    try {
      console.log('🔄 Connecting to database...');
      await sequelize.authenticate();
      console.log('✅ Database connected successfully');
      
      // Enable PostgreSQL-compatible features for SQLite
      if (config.DATABASE_DIALECT === 'sqlite') {
        await sequelize.query('PRAGMA foreign_keys = ON');
        await sequelize.query('PRAGMA journal_mode = WAL');
        console.log('✅ SQLite optimized');
      }
      
      // Sync all models with safe approach
      const syncOptions = config.NODE_ENV === 'production' 
        ? { alter: true, force: false }  // Use alter in production to preserve data
        : { alter: true, force: false };
      
      console.log('🔄 Synchronizing database models...');
      await sequelize.sync(syncOptions);
      console.log('✅ Database synchronized successfully');
      
      // Verify we can query the database
      const { Bot } = require('../models');
      const botCount = await Bot.count();
      console.log(`📊 Verified database: ${botCount} bots found`);
      
      return true;
    } catch (error) {
      console.error(`❌ Database connection failed (${retries} retries left):`, error.message);
      
      retries -= 1;
      if (retries === 0) {
        console.error('💥 All database connection attempts failed');
        
        // Provide helpful error messages
        if (config.DATABASE_DIALECT === 'postgres') {
          console.error('💡 PostgreSQL connection tips:');
          console.error('   - Check if DATABASE_URL is correct in Railway');
          console.error('   - Verify PostgreSQL addon is provisioned');
          console.error('   - Check Railway project variables');
        } else {
          console.error('💡 SQLite connection tips:');
          console.error('   - Check file permissions for database file');
          console.error('   - Ensure sufficient disk space');
        }
        
        // Don't exit in production, try to continue
        if (config.NODE_ENV === 'production') {
          console.log('⚠️  Continuing without database connection...');
          return false;
        } else {
          process.exit(1);
        }
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// Add health check method
const healthCheck = async () => {
  try {
    await sequelize.authenticate();
    const { Bot } = require('../models');
    const botCount = await Bot.count();
    return {
      healthy: true,
      bots: botCount,
      dialect: config.DATABASE_DIALECT
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      dialect: config.DATABASE_DIALECT
    };
  }
};

module.exports = { sequelize, connectDB, healthCheck };