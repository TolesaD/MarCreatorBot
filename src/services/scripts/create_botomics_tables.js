// create_botomics_tables.js - PostgreSQL Migration Script
const { Pool } = require('pg');
require('dotenv').config();

console.log('🔄 Creating Botomics wallet tables for PostgreSQL...');

async function createTables() {
  let pool;
  
  try {
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL is not set in environment variables');
      process.exit(1);
    }
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Create wallets table
    console.log('📊 Creating wallets table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE,
        balance DECIMAL(15,2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'BOM',
        is_frozen BOOLEAN DEFAULT false,
        freeze_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_wallet UNIQUE(user_id)
      )
    `);
    console.log('✅ Created wallets table');
    
    // Create wallet_transactions table
    console.log('📊 Creating wallet_transactions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN (
          'deposit', 'withdrawal', 'transfer', 'subscription', 
          'donation', 'ad_revenue', 'reward', 'refund', 'admin_adjustment'
        )),
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BOM',
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
          'pending', 'completed', 'failed', 'cancelled'
        )),
        proof_image_url TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wallet_transactions_wallet_id (wallet_id),
        INDEX idx_wallet_transactions_type (type),
        INDEX idx_wallet_transactions_status (status),
        INDEX idx_wallet_transactions_created_at (created_at)
      )
    `);
    console.log('✅ Created wallet_transactions table');
    
    // Create withdrawals table
    console.log('📊 Creating withdrawals table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        telegram_id BIGINT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BOM',
        usd_value DECIMAL(15,2) NOT NULL,
        method VARCHAR(20) NOT NULL CHECK (method IN (
          'paypal', 'bank_transfer', 'crypto', 'other'
        )),
        payout_details TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
          'pending', 'processing', 'completed', 'rejected', 'cancelled'
        )),
        rejection_reason TEXT,
        admin_notes TEXT,
        processed_by BIGINT,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_withdrawals_user_id (user_id),
        INDEX idx_withdrawals_status (status),
        INDEX idx_withdrawals_created_at (created_at)
      )
    `);
    console.log('✅ Created withdrawals table');
    
    // Create user_subscriptions table if not exists
    console.log('📊 Creating/checking user_subscriptions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        tier VARCHAR(20) NOT NULL CHECK (tier IN ('freemium', 'premium')),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
        monthly_price DECIMAL(10,2) DEFAULT 5.00,
        currency VARCHAR(10) DEFAULT 'BOM',
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        auto_renew BOOLEAN DEFAULT true,
        cancelled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_subscriptions_user_id (user_id),
        INDEX idx_user_subscriptions_status (status),
        CONSTRAINT unique_active_user_subscription UNIQUE(user_id) WHERE status = 'active'
      )
    `);
    console.log('✅ Created/verified user_subscriptions table');
    
    // Create users table if not exists
    console.log('📊 Creating/checking users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL UNIQUE,
        first_name VARCHAR(255),
        username VARCHAR(255),
        is_bot BOOLEAN DEFAULT false,
        premium_status VARCHAR(20) DEFAULT 'freemium',
        premium_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_users_telegram_id (telegram_id)
      )
    `);
    console.log('✅ Created/verified users table');
    
    // Add indexes
    console.log('📊 Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_wallets_is_frozen ON wallets(is_frozen)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_type ON wallet_transactions(wallet_id, type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_withdrawals_method_status ON withdrawals(method, status)');
    
    console.log('✅ All indexes created');
    
    // Test data insertion
    console.log('🧪 Testing with sample data...');
    const testUserId = 1827785384; // Platform creator
    
    // Insert test user if not exists
    await client.query(`
      INSERT INTO users (telegram_id, first_name, username, premium_status) 
      VALUES ($1, $2, $3, $4) 
      ON CONFLICT (telegram_id) DO NOTHING
    `, [testUserId, 'Platform Admin', '@admin', 'premium']);
    
    // Insert test wallet if not exists
    await client.query(`
      INSERT INTO wallets (user_id, balance, currency) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (user_id) DO NOTHING
    `, [testUserId, 1000.00, 'BOM']);
    
    console.log('✅ Sample data inserted');
    
    client.release();
    
    console.log('\n🎉 Botomics wallet tables created successfully!');
    console.log('===============================================');
    console.log('📊 Tables created:');
    console.log('   • wallets');
    console.log('   • wallet_transactions');
    console.log('   • withdrawals');
    console.log('   • user_subscriptions (updated)');
    console.log('   • users (updated)');
    console.log('\n🚀 Ready to use Botomics wallet system!');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run migration
createTables();