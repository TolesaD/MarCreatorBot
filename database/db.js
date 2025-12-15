// database/db.js - RAILWAY.COM
const { Sequelize } = require('sequelize');
const createConfig = require('../config/environment');
const config = createConfig();

console.log('🗄️ Database configuration:');
console.log('   Environment:', config.NODE_ENV);

// Enhanced database URL parsing
let dbHost = 'unknown';
let dbName = 'unknown';
try {
  const dbUrl = new URL(config.DATABASE_URL);
  dbHost = `${dbUrl.hostname}:${dbUrl.port || 5432}`;
  dbName = dbUrl.pathname.replace('/', '') || 'unknown';
} catch (error) {
  // If URL parsing fails, try to extract host info manually
  const match = config.DATABASE_URL.match(/@([^:]+):(\d+)\/([^?]+)/);
  if (match) {
    dbHost = `${match[1]}:${match[2]}`;
    dbName = match[3];
  }
}

console.log('   Database Host:', dbHost);
console.log('   Database Name:', dbName);
console.log('   Connection URL Length:', config.DATABASE_URL.length);

// Create Sequelize instance with cPanel optimizations
const sequelize = new Sequelize(config.DATABASE_URL, {
  dialect: 'postgres',
  logging: config.NODE_ENV === 'development' ? (msg) => {
    // Filter out noisy logs in development
    if (!msg.includes('SELECT table_name') && 
        !msg.includes('information_schema') &&
        !msg.includes('pg_catalog')) {
      console.log('   🗄️', msg);
    }
  } : false,
  
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
    } : false,
    connectTimeout: 30000,
    keepAlive: true,
  },
  
  retry: {
    max: 3,
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
    ],
  },
  
  // Connection timeout
  connectTimeout: 30000,
});

console.log('✅ Database configured successfully');

// Enhanced database connection function - FIXED FOR PRODUCTION
async function connectDB() {
  try {
    console.log('🗄️ Establishing database connection...');
    
    // Test connection with timeout
    const connectionPromise = sequelize.authenticate();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout after 30s')), 30000);
    });
    
    await Promise.race([connectionPromise, timeoutPromise]);
    console.log('✅ Database connection established successfully');
    
    // IMPORTANT: DO NOT SYNC IN PRODUCTION
    if (config.NODE_ENV === 'development') {
      console.log('🔄 Development mode: Synchronizing database models...');
      await sequelize.sync({ 
        alter: true,
        force: false,
        logging: console.log
      });
      console.log('✅ All database models synchronized');
    } else {
      // In production, just verify the connection and check if tables exist
      console.log('🚨 PRODUCTION MODE: Skipping database sync (using migrations only)');
      
      // Verify tables exist without modifying them
      try {
        const [results] = await sequelize.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name IN ('users', 'wallets', 'bots')
          LIMIT 3
        `);
        
        const foundTables = results.map(r => r.table_name);
        console.log(`✅ Found ${foundTables.length} core tables: ${foundTables.join(', ')}`);
        
        if (foundTables.length === 0) {
          console.warn('⚠️  No tables found! If this is a new deployment, run migrations manually.');
        }
      } catch (checkError) {
        console.log('⚠️  Table check failed (non-critical):', checkError.message);
      }
    }
    
    // Test basic operations
    try {
      const [results] = await sequelize.query('SELECT NOW() as current_time');
      console.log('✅ Database time check:', results[0].current_time);
    } catch (testError) {
      console.log('⚠️  Database time check failed (non-critical):', testError.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('   Error:', error.message);
    
    if (error.message.includes('timeout')) {
      console.error('💡 Connection timeout - check your database host and credentials');
    } else if (error.message.includes('authentication')) {
      console.error('💡 Authentication failed - check database username and password');
    } else if (error.message.includes('getaddrinfo')) {
      console.error('💡 Host not found - check database hostname in DATABASE_URL');
    } else if (error.message.includes('SSL')) {
      console.error('💡 SSL connection issue - check SSL configuration');
    } else if (error.message.includes('database')) {
      console.error('💡 Database not found - verify database name exists');
    } else if (error.message.includes('foreign key constraint')) {
      console.error('💡 Foreign key constraint violation - check existing data integrity');
      console.error('💡 Run this SQL to find invalid references:');
      console.error(`
        SELECT w.user_id 
        FROM wallets w 
        LEFT JOIN users u ON w.user_id = u.telegram_id 
        WHERE u.telegram_id IS NULL;
      `);
    }
    
    if (config.NODE_ENV === 'production') {
      console.error('💥 Cannot continue without database in production');
      process.exit(1);
    }
    
    console.error('⚠️  Development mode: Continuing without database');
    return false;
  }
}

// Enhanced health check function
async function healthCheck() {
  try {
    // Test basic connection
    await sequelize.authenticate();
    
    // Import models dynamically to avoid circular dependency
    const { Bot, User, Feedback } = require('../src/models');
    
    // Check if we can query the database
    const [dbTime] = await sequelize.query('SELECT NOW() as current_time');
    const totalBots = await Bot.count();
    const activeBots = await Bot.count({ where: { is_active: true } });
    const totalUsers = await User.count();
    const pendingMessages = await Feedback.count({ where: { is_replied: false } });
    
    return {
      healthy: true,
      database: {
        time: dbTime[0].current_time,
        connection: 'OK',
        host: sequelize.config.host
      },
      stats: {
        totalBots: totalBots,
        activeBots: activeBots,
        totalUsers: totalUsers,
        pendingMessages: pendingMessages
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return {
      healthy: false,
      error: error.message,
      database: {
        connection: 'FAILED',
        error: error.message
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Quick health check (lightweight version)
async function quickHealthCheck() {
  try {
    await sequelize.authenticate();
    return { 
      healthy: true, 
      timestamp: new Date().toISOString(),
      database: 'OK'
    };
  } catch (error) {
    return { 
      healthy: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Disconnect function with better cleanup
async function disconnectDB() {
  try {
    console.log('🛑 Closing database connection...');
    await sequelize.close();
    console.log('✅ Database connection closed gracefully');
  } catch (error) {
    console.error('❌ Error closing database connection:', error.message);
  }
}

// Test connection on startup in development ONLY
if (config.NODE_ENV === 'development') {
  console.log('🔧 Development mode: Testing database connection...');
  connectDB().then(success => {
    if (success) {
      console.log('✅ Development database: READY');
    } else {
      console.log('⚠️  Development database: LIMITED FUNCTIONALITY');
    }
  }).catch(error => {
    console.log('⚠️  Development database test failed:', error.message);
  });
} else {
  console.log('🚀 Production mode: Database will connect when app starts');
}

module.exports = {
  sequelize,
  connectDB,
  healthCheck,
  quickHealthCheck,
  disconnectDB
};