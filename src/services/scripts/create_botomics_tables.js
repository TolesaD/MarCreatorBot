// Botomics Wallet - PostgreSQL Table Creation Script
const { Pool } = require('pg');
require('dotenv').config({ path: '/home/maroseff/.env' });

console.log('🚀 Creating Botomics wallet tables for PostgreSQL on Railway...');

async function createTables() {
  let pool;
  
  try {
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL is not set in environment variables');
      console.log('Checking .env file...');
      process.exit(1);
    }
    
    console.log('🔗 Connecting to PostgreSQL database...');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // ==================== CREATE WALLETS TABLE ====================
    console.log('💰 Creating wallets table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE,
        balance DECIMAL(15, 2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'BOM',
        is_frozen BOOLEAN DEFAULT false,
        freeze_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_wallet UNIQUE(user_id)
      )
    `);
    console.log('✅ Created wallets table');
    
    // ==================== CREATE WALLET TRANSACTIONS TABLE ====================
    console.log('💸 Creating wallet_transactions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        wallet_id INTEGER NOT NULL,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BOM',
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        proof_image_url TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
      )
    `);
    
    // Add constraints separately
    await client.query(`
      ALTER TABLE wallet_transactions 
      ADD CONSTRAINT check_transaction_type 
      CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'subscription', 'donation', 'ad_revenue', 'reward', 'admin_adjustment'))
    `);
    
    await client.query(`
      ALTER TABLE wallet_transactions 
      ADD CONSTRAINT check_transaction_status 
      CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'))
    `);
    
    console.log('✅ Created wallet_transactions table with constraints');
    
    // ==================== CREATE WITHDRAWALS TABLE ====================
    console.log('📤 Creating withdrawals table...');
    await client.query(`
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
        processed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      ALTER TABLE withdrawals 
      ADD CONSTRAINT check_withdrawal_method 
      CHECK (method IN ('paypal', 'bank_transfer', 'crypto', 'other'))
    `);
    
    await client.query(`
      ALTER TABLE withdrawals 
      ADD CONSTRAINT check_withdrawal_status 
      CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled'))
    `);
    
    console.log('✅ Created withdrawals table');
    
    // ==================== CREATE USER_SUBSCRIPTIONS TABLE ====================
    console.log('🎫 Creating user_subscriptions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        tier VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        monthly_price DECIMAL(10, 2) DEFAULT 5.00,
        currency VARCHAR(10) DEFAULT 'BOM',
        current_period_start TIMESTAMP WITH TIME ZONE,
        current_period_end TIMESTAMP WITH TIME ZONE,
        auto_renew BOOLEAN DEFAULT true,
        cancelled_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      ALTER TABLE user_subscriptions 
      ADD CONSTRAINT check_subscription_tier 
      CHECK (tier IN ('freemium', 'premium'))
    `);
    
    await client.query(`
      ALTER TABLE user_subscriptions 
      ADD CONSTRAINT check_subscription_status 
      CHECK (status IN ('active', 'cancelled', 'expired'))
    `);
    
    console.log('✅ Created user_subscriptions table');
    
    // ==================== CREATE INDEXES ====================
    console.log('📊 Creating indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_is_frozen ON wallets(is_frozen)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status)
    `);
    
    console.log('✅ All indexes created');
    
    // ==================== CREATE TRIGGERS ====================
    console.log('⚡ Creating triggers...');
    
    // Update timestamp trigger for wallets
    await client.query(`
      CREATE OR REPLACE FUNCTION update_wallets_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_wallets_timestamp ON wallets
    `);
    
    await client.query(`
      CREATE TRIGGER update_wallets_timestamp
      BEFORE UPDATE ON wallets
      FOR EACH ROW
      EXECUTE FUNCTION update_wallets_updated_at()
    `);
    
    // Update timestamp trigger for withdrawals
    await client.query(`
      CREATE OR REPLACE FUNCTION update_withdrawals_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_withdrawals_timestamp ON withdrawals
    `);
    
    await client.query(`
      CREATE TRIGGER update_withdrawals_timestamp
      BEFORE UPDATE ON withdrawals
      FOR EACH ROW
      EXECUTE FUNCTION update_withdrawals_updated_at()
    `);
    
    // Update timestamp trigger for user_subscriptions
    await client.query(`
      CREATE OR REPLACE FUNCTION update_user_subscriptions_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_user_subscriptions_timestamp ON user_subscriptions
    `);
    
    await client.query(`
      CREATE TRIGGER update_user_subscriptions_timestamp
      BEFORE UPDATE ON user_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_user_subscriptions_updated_at()
    `);
    
    console.log('✅ All triggers created');
    
    // ==================== INSERT SAMPLE DATA ====================
    console.log('📝 Inserting sample data...');
    
    // Insert platform creator as admin user
    const adminUserId = 1827785384;
    
    // Insert admin wallet with 1000 BOM
    await client.query(`
      INSERT INTO wallets (user_id, balance, currency) 
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
      balance = EXCLUDED.balance,
      updated_at = CURRENT_TIMESTAMP
    `, [adminUserId, 1000.00, 'BOM']);
    
    console.log('✅ Inserted admin wallet with 1000 BOM');
    
    // Insert sample transaction
    await client.query(`
      INSERT INTO wallet_transactions (
        wallet_id, type, amount, currency, description, status
      ) VALUES (
        (SELECT id FROM wallets WHERE user_id = $1),
        'admin_adjustment',
        1000.00,
        'BOM',
        'Initial platform setup bonus',
        'completed'
      )
    `, [adminUserId]);
    
    console.log('✅ Inserted sample transaction');
    
    // Create sample premium subscription for admin
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    
    await client.query(`
      INSERT INTO user_subscriptions (
        user_id, tier, status, monthly_price, currency,
        current_period_start, current_period_end, auto_renew
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO NOTHING
    `, [
      adminUserId,
      'premium',
      'active',
      5.00,
      'BOM',
      now.toISOString(),
      periodEnd.toISOString(),
      true
    ]);
    
    console.log('✅ Created premium subscription for admin');
    
    client.release();
    
    // ==================== VERIFICATION ====================
    console.log('\n✅ Botomics wallet tables created successfully!');
    console.log('===============================================');
    console.log('📊 Tables created:');
    console.log('   • wallets');
    console.log('   • wallet_transactions');
    console.log('   • withdrawals');
    console.log('   • user_subscriptions');
    console.log('\n📈 Indexes & triggers created');
    console.log('\n👑 Admin user (ID: 1827785384) has:');
    console.log('   • 1000 BOM in wallet');
    console.log('   • Active premium subscription');
    console.log('\n🚀 Ready to use Botomics wallet system!');
    console.log('\n💡 Next steps:');
    console.log('   1. Start wallet server: node wallet/server.js');
    console.log('   2. Start main bot: node src/app.js');
    console.log('   3. Open @BotomicsBot and use /wallet command');
    console.log('   4. Buy BOM from @BotomicsSupportBot');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
      console.log('🔗 Database connection closed');
    }
  }
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  console.log('Please set DATABASE_URL in your .env file or environment variables');
  console.log('Example: DATABASE_URL=postgresql://user:password@host:port/database');
  process.exit(1);
}

// Run migration
createTables();
EOF