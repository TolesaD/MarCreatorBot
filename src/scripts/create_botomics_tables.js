// src/scripts/create_botomics_tables.js - FIXED VERSION
const { sequelize } = require('../../database/db');
const { QueryTypes, Op } = require('sequelize');

async function createBotomicsTables() {
  try {
    console.log('🔄 Creating Botomics wallet tables...');
    
    // First, check if foreign key constraint exists and remove it temporarily
    console.log('🔧 Checking for existing constraints...');
    
    // Create wallets table WITHOUT foreign key first
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE,
        balance DECIMAL(15, 2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'BOM',
        is_frozen BOOLEAN DEFAULT false,
        freeze_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    console.log('✅ Created wallets table');
    
    // Create wallet_transactions table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        wallet_id INTEGER NOT NULL,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BOM',
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        proof_image_url TEXT,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    console.log('✅ Created wallet_transactions table');
    
    // Create withdrawals table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BOM',
        usd_value DECIMAL(15, 2) NOT NULL,
        method VARCHAR(20) NOT NULL,
        payout_details TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        rejection_reason TEXT,
        admin_notes TEXT,
        processed_by BIGINT,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    console.log('✅ Created withdrawals table');
    
    // Update users table for wallet support
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(100),
      ADD COLUMN IF NOT EXISTS premium_status VARCHAR(20) DEFAULT 'freemium',
      ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS total_ad_earnings DECIMAL(15,2) DEFAULT 0.00
    `, { type: QueryTypes.RAW });
    
    console.log('✅ Updated users table');
    
    // Create admin user if not exists
    const adminExists = await sequelize.query(
      'SELECT id FROM users WHERE telegram_id = ?',
      { replacements: [1827785384], type: QueryTypes.SELECT }
    );
    
    if (adminExists.length === 0) {
      await sequelize.query(
        'INSERT INTO users (telegram_id, first_name, username, premium_status) VALUES (?, ?, ?, ?)',
        { 
          replacements: [1827785384, 'Platform Admin', '@admin', 'premium'], 
          type: QueryTypes.INSERT 
        }
      );
      console.log('✅ Created admin user');
    } else {
      console.log('✅ Admin user already exists');
    }
    
    // Create indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallets_is_frozen ON wallets(is_frozen);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at);
    `, { type: QueryTypes.RAW });
    
    console.log('✅ Created all indexes');
    
    // Generate wallet addresses for existing users
    const users = await sequelize.query(
      'SELECT telegram_id FROM users WHERE wallet_address IS NULL',
      { type: QueryTypes.SELECT }
    );
    
    for (const user of users) {
      const walletAddress = `BOTOMICS_USER_${user.telegram_id}`;
      await sequelize.query(
        'UPDATE users SET wallet_address = ? WHERE telegram_id = ?',
        { replacements: [walletAddress, user.telegram_id], type: QueryTypes.UPDATE }
      );
    }
    
    console.log(`✅ Generated wallet addresses for ${users.length} users`);
    
    // Create initial wallet for platform admin (with ON CONFLICT DO UPDATE)
    await sequelize.query(`
      INSERT INTO wallets (user_id, balance, currency) 
      VALUES (1827785384, 1000.00, 'BOM')
      ON CONFLICT (user_id) 
      DO UPDATE SET balance = 1000.00, updated_at = CURRENT_TIMESTAMP
      WHERE wallets.user_id = 1827785384
    `, { type: QueryTypes.INSERT });
    
    console.log('✅ Created/updated admin wallet with 1000 BOM');
    
    console.log('\n🎉 Botomics wallet tables created successfully!');
    console.log('==============================================');
    console.log('📊 Tables available:');
    console.log('   • wallets');
    console.log('   • wallet_transactions');
    console.log('   • withdrawals');
    console.log('   • users (updated)');
    console.log('\n💰 Botomics Wallet System is ready!');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createBotomicsTables()
    .then(() => {
      console.log('✅ Botomics setup completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    });
}

module.exports = createBotomicsTables;