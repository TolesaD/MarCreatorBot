const { sequelize } = require('../../database/db');
const { QueryTypes } = require('sequelize');

async function addNewColumns() {
  try {
    console.log('🔄 Starting database migration: Adding missing columns to users and bots tables...');
    
    // Check if users table exists
    const usersTableExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `, { type: QueryTypes.SELECT });
    
    if (!usersTableExists[0].exists) {
      console.log('❌ Users table does not exist. Please run basic migrations first.');
      return;
    }
    
    // Check if bots table exists
    const botsTableExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bots'
      );
    `, { type: QueryTypes.SELECT });
    
    if (!botsTableExists[0].exists) {
      console.log('❌ Bots table does not exist. Please run basic migrations first.');
      return;
    }

    // Add columns to users table
    console.log('📝 Adding new columns to users table...');
    
    const userColumns = [
      'ADD COLUMN IF NOT EXISTS premium_status VARCHAR(20) DEFAULT \'freemium\'',
      'ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP',
      'ADD COLUMN IF NOT EXISTS total_ad_earnings DECIMAL(15,2) DEFAULT 0.00',
      'ADD COLUMN IF NOT EXISTS niche_id INTEGER',
      'ADD COLUMN IF NOT EXISTS is_ad_approved BOOLEAN DEFAULT false',
      'ADD COLUMN IF NOT EXISTS ad_price DECIMAL(10,2) DEFAULT 0.10',
      'ADD COLUMN IF NOT EXISTS last_price_change TIMESTAMP',
      'ADD COLUMN IF NOT EXISTS total_ad_revenue DECIMAL(15,2) DEFAULT 0.00',
      'ADD COLUMN IF NOT EXISTS user_count INTEGER DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS has_donation_enabled BOOLEAN DEFAULT false',
      'ADD COLUMN IF NOT EXISTS pinned_start_message TEXT'
    ];

    for (const column of userColumns) {
      try {
        await sequelize.query(`ALTER TABLE users ${column}`);
        console.log(`✅ Added column: ${column.split(' ')[4]}`);
      } catch (error) {
        console.log(`ℹ️ Column already exists or error: ${column.split(' ')[4]}`);
      }
    }

    // Add columns to bots table
    console.log('📝 Adding new columns to bots table...');
    
    const botColumns = [
      'ADD COLUMN IF NOT EXISTS niche_id INTEGER',
      'ADD COLUMN IF NOT EXISTS is_ad_approved BOOLEAN DEFAULT false',
      'ADD COLUMN IF NOT EXISTS ad_price DECIMAL(10,2) DEFAULT 0.10',
      'ADD COLUMN IF NOT EXISTS last_price_change TIMESTAMP',
      'ADD COLUMN IF NOT EXISTS total_ad_revenue DECIMAL(15,2) DEFAULT 0.00',
      'ADD COLUMN IF NOT EXISTS user_count INTEGER DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS has_donation_enabled BOOLEAN DEFAULT false',
      'ADD COLUMN IF NOT EXISTS pinned_start_message TEXT'
    ];

    for (const column of botColumns) {
      try {
        await sequelize.query(`ALTER TABLE bots ${column}`);
        console.log(`✅ Added column: ${column.split(' ')[4]}`);
      } catch (error) {
        console.log(`ℹ️ Column already exists or error: ${column.split(' ')[4]}`);
      }
    }

    // Add constraints
    console.log('📝 Adding constraints...');
    
    try {
      await sequelize.query(`
        ALTER TABLE users 
        ADD CONSTRAINT IF NOT EXISTS check_premium_status 
        CHECK (premium_status IN ('freemium', 'premium'))
      `);
      console.log('✅ Premium status constraint added');
    } catch (error) {
      console.log('ℹ️ Constraint already exists or error adding constraint');
    }

    console.log('🎉 Database migration completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  addNewColumns()
    .then(() => {
      console.log('🚀 Migration script finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { addNewColumns };