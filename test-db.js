// test-db.js - Database connection test
console.log('🧪 Testing database connection...');

const config = require('./config/environment');
console.log('Environment:', config.NODE_ENV);
console.log('Database URL length:', config.DATABASE_URL ? config.DATABASE_URL.length : 'NOT SET');
console.log('Expected dialect:', config.DATABASE_DIALECT);

// Test the connection directly
const { Sequelize } = require('sequelize');

async function testConnection() {
  try {
    console.log('\n🔌 Testing direct database connection...');
    
    const sequelize = new Sequelize(config.DATABASE_URL, {
      dialect: 'postgres',
      logging: console.log,
      dialectOptions: {
        ssl: config.NODE_ENV === 'production' ? {
          require: true,
          rejectUnauthorized: false
        } : false
      },
      retry: {
        max: 2,
        timeout: 10000
      }
    });

    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const [result] = await sequelize.query('SELECT version() as version');
    console.log('✅ Database version:', result[0].version);
    
    await sequelize.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

testConnection();