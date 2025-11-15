// test-models.js - Test models with PostgreSQL
console.log('🧪 Testing database models...');

const config = require('./config/environment');
const { Sequelize, DataTypes } = require('sequelize');

async function testModels() {
  try {
    console.log('🔌 Connecting to database...');
    
    const sequelize = new Sequelize(config.DATABASE_URL, {
      dialect: 'postgres',
      logging: console.log,
      dialectOptions: {
        ssl: config.NODE_ENV === 'production' ? {
          require: true,
          rejectUnauthorized: false
        } : false
      }
    });

    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Test creating a simple table
    const TestModel = sequelize.define('TestModel', {
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      value: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      }
    });

    console.log('🔄 Syncing test model...');
    await TestModel.sync({ force: false });
    console.log('✅ Test model synced');

    // Test CRUD operations
    console.log('🧪 Testing CRUD operations...');
    const testRecord = await TestModel.create({
      name: 'test',
      value: 42
    });
    console.log('✅ Record created:', testRecord.id);

    const foundRecord = await TestModel.findByPk(testRecord.id);
    console.log('✅ Record found:', foundRecord ? 'YES' : 'NO');

    await TestModel.destroy({ where: { id: testRecord.id } });
    console.log('✅ Record deleted');

    await sequelize.close();
    console.log('🎉 All model tests passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Model test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testModels();