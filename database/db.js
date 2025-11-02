const { Sequelize } = require('sequelize');
const config = require('../config/environment');
const fs = require('fs');
const path = require('path');

let sequelize;

console.log(`🗄️ Database configuration: ${config.DATABASE_DIALECT}`);

if (config.DATABASE_DIALECT === 'postgres' && config.DATABASE_URL) {
  // PostgreSQL configuration for production
  console.log('🔄 Configuring PostgreSQL database...');
  
  sequelize = new Sequelize(config.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: config.NODE_ENV === 'production' ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
    logging: config.LOG_LEVEL === 'debug' ? console.log : false,
    pool: {
      max: config.DATABASE_POOL_MAX || 20,
      min: 0,
      acquire: config.DATABASE_POOL_ACQUIRE || 30000,
      idle: config.DATABASE_POOL_IDLE || 10000
    },
    retry: {
      max: 3
    }
  });
} else {
  // SQLite configuration for development (with PostgreSQL compatibility)
  console.log('🔄 Configuring SQLite database (PostgreSQL compatible)...');
  
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
    // SQLite settings for better PostgreSQL compatibility
    dialectOptions: {
      // Enable foreign keys and other PostgreSQL-like features
    },
    // Use PostgreSQL-compatible settings
    define: {
      timestamps: true, // Use createdAt, updatedAt (PostgreSQL style)
      underscored: false, // Use camelCase (PostgreSQL style)
    },
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
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Enable PostgreSQL-compatible features for SQLite
    if (config.DATABASE_DIALECT === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON');
      await sequelize.query('PRAGMA journal_mode = WAL');
      console.log('✅ SQLite optimized for PostgreSQL compatibility');
    }
    
    // Sync all models with safe approach
    const syncOptions = config.NODE_ENV === 'production' 
      ? { alter: false, force: false }  // Safe for production
      : { alter: true, force: false };  // Development with schema updates
    
    await sequelize.sync(syncOptions);
    console.log('✅ Database synchronized');
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // Provide helpful error messages
    if (error.original) {
      console.error('💡 Database error details:', error.original.message);
    }
    
    if (config.DATABASE_DIALECT === 'postgres') {
      console.error('💡 PostgreSQL connection tips:');
      console.error('   - Check if DATABASE_URL is correct');
      console.error('   - Verify database server is running');
      console.error('   - Check firewall settings');
      console.error('   - Ensure database exists and user has permissions');
    } else {
      console.error('💡 SQLite connection tips:');
      console.error('   - Check file permissions for database file');
      console.error('   - Ensure sufficient disk space');
      console.error('   - Verify the path is accessible');
    }
    
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };