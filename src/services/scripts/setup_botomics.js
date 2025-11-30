const { sequelize } = require('../../database/db');
const { QueryTypes } = require('sequelize');

async function setupBotomics() {
  try {
    console.log('🚀 Setting up Botomics enhancement features...');
    
    // 1. Create Wallet System Tables
    console.log('💰 Creating wallet system tables...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE,
        balance DECIMAL(15, 2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'BOM',
        is_frozen BOOLEAN DEFAULT false,
        freeze_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'subscription', 'donation', 'ad_revenue', 'reward')),
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BOM',
        description TEXT NOT NULL,
        metadata JSON NULL,
        status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
        related_entity_type VARCHAR(50) NULL,
        related_entity_id INTEGER NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    // 2. Create Subscription Tables
    console.log('🎫 Creating subscription system tables...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        tier VARCHAR(20) NOT NULL CHECK (tier IN ('freemium', 'premium')),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
        monthly_price DECIMAL(10, 2) DEFAULT 5.00,
        currency VARCHAR(10) DEFAULT 'BOM',
        current_period_start TIMESTAMP NOT NULL,
        current_period_end TIMESTAMP NOT NULL,
        auto_renew BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    // 3. Create Advertising System Tables
    console.log('📢 Creating advertising system tables...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS bot_niches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS bot_ad_settings (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER NOT NULL UNIQUE REFERENCES bots(id) ON DELETE CASCADE,
        niche_id INTEGER REFERENCES bot_niches(id),
        ad_price DECIMAL(10, 2) DEFAULT 0.10,
        is_ad_enabled BOOLEAN DEFAULT false,
        min_users_required INTEGER DEFAULT 100,
        last_price_change TIMESTAMP NULL,
        is_approved BOOLEAN DEFAULT false,
        total_ad_revenue DECIMAL(15, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ad_campaigns (
        id SERIAL PRIMARY KEY,
        advertiser_id BIGINT NOT NULL,
        bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        budget DECIMAL(10, 2) NOT NULL,
        spent DECIMAL(10, 2) DEFAULT 0.00,
        target_clicks INTEGER NULL,
        target_impressions INTEGER NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
        start_date TIMESTAMP NULL,
        end_date TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ad_events (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL,
        bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('impression', 'click', 'reward')),
        revenue DECIMAL(10, 4) NOT NULL,
        platform_share DECIMAL(10, 4) NOT NULL,
        bot_owner_share DECIMAL(10, 4) NOT NULL,
        user_share DECIMAL(10, 4) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    // 4. Create Platform Settings Table
    console.log('⚙️ Creating platform settings table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    // 5. Create Indexes
    console.log('📊 Creating indexes...');
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallets_is_frozen ON wallets(is_frozen);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON wallet_transactions(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON wallet_transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON wallet_transactions(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON user_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON user_subscriptions(status);
      
      CREATE INDEX IF NOT EXISTS idx_ad_settings_bot_id ON bot_ad_settings(bot_id);
      CREATE INDEX IF NOT EXISTS idx_ad_settings_niche_id ON bot_ad_settings(niche_id);
      CREATE INDEX IF NOT EXISTS idx_ad_settings_is_approved ON bot_ad_settings(is_approved);
      
      CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser_id ON ad_campaigns(advertiser_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_bot_id ON ad_campaigns(bot_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON ad_campaigns(status);
      
      CREATE INDEX IF NOT EXISTS idx_ad_events_campaign_id ON ad_events(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_ad_events_user_id ON ad_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_ad_events_bot_id ON ad_events(bot_id);
      CREATE INDEX IF NOT EXISTS idx_ad_events_event_type ON ad_events(event_type);
    `, { type: QueryTypes.RAW });
    
    // 6. Insert Initial Data
    console.log('📝 Inserting initial data...');
    
    // Insert default niches
    await sequelize.query(`
      INSERT INTO bot_niches (name, description) VALUES 
      ('Technology', 'Tech-related bots, programming, AI, software'),
      ('Business', 'Business tools, entrepreneurship, finance'),
      ('Education', 'Learning, courses, tutorials, knowledge'),
      ('Entertainment', 'Games, fun, entertainment, media'),
      ('Health & Fitness', 'Health tips, fitness, wellness'),
      ('Lifestyle', 'Daily life, productivity, personal growth'),
      ('News & Politics', 'News updates, political discussions'),
      ('Social', 'Community, social networking, chats'),
      ('Other', 'Other categories not listed')
      ON CONFLICT (name) DO NOTHING
    `, { type: QueryTypes.RAW });
    
    // Insert platform settings
    await sequelize.query(`
      INSERT INTO platform_settings (key, value, description) VALUES 
      ('premium_monthly_price', '5', 'Monthly premium subscription price in BOM'),
      ('min_withdrawal_amount', '20', 'Minimum withdrawal amount in BOM'),
      ('ad_revenue_platform_share', '0.2', 'Platform share of ad revenue (20%)'),
      ('ad_revenue_bot_owner_share', '0.6', 'Bot owner share of ad revenue (60%)'),
      ('ad_revenue_user_share', '0.2', 'User share of ad revenue (20%)'),
      ('freemium_bot_limit', '5', 'Maximum bots for freemium users'),
      ('freemium_broadcast_limit', '3', 'Weekly broadcasts for freemium users'),
      ('freemium_coadmin_limit', '1', 'Maximum co-admins for freemium users'),
      ('freemium_channel_limit', '1', 'Maximum force join channels for freemium users')
      ON CONFLICT (key) DO NOTHING
    `, { type: QueryTypes.RAW });
    
    // 7. Update Existing Tables
    console.log('🔄 Updating existing tables...');
    
    // Add new columns to users table
    try {
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS premium_status VARCHAR(20) DEFAULT 'freemium',
        ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS total_ad_earnings DECIMAL(15,2) DEFAULT 0.00
      `, { type: QueryTypes.RAW });
      console.log('✅ Updated users table');
    } catch (error) {
      console.log('⚠️ Users table already updated');
    }
    
    // Add new columns to bots table
    try {
      await sequelize.query(`
        ALTER TABLE bots 
        ADD COLUMN IF NOT EXISTS niche_id INTEGER NULL,
        ADD COLUMN IF NOT EXISTS is_ad_approved BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS ad_price DECIMAL(10,2) DEFAULT 0.10,
        ADD COLUMN IF NOT EXISTS last_price_change TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS total_ad_revenue DECIMAL(15,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS user_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS has_donation_enabled BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS pinned_start_message TEXT NULL,
        ADD COLUMN IF NOT EXISTS original_creator_id BIGINT NULL,
        ADD COLUMN IF NOT EXISTS ownership_transferred BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS ownership_history JSON DEFAULT '[]'
      `, { type: QueryTypes.RAW });
      console.log('✅ Updated bots table');
    } catch (error) {
      console.log('⚠️ Bots table already updated');
    }
    
    console.log('🎉 Botomics setup completed successfully!');
    console.log('\n✨ New Features Available:');
    console.log('   💰 Digital Wallet System');
    console.log('   🎫 Premium Subscriptions');
    console.log('   📢 Advertising Ecosystem');
    console.log('   👑 Enhanced User Management');
    console.log('   ☕ Donation System');
    console.log('   📌 Pin Start Messages');
    console.log('   ✏️ Edit Messages');
    console.log('   🔄 Transfer Ownership');
    
  } catch (error) {
    console.error('❌ Botomics setup failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  setupBotomics()
    .then(() => {
      console.log('✅ Botomics setup completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupBotomics;