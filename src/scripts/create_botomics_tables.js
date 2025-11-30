// src/scripts/create_botomics_tables.js
const { sequelize } = require('../../database/db');
const { QueryTypes } = require('sequelize');

async function createBotomicsTables() {
  try {
    console.log('🔄 Creating Botomics enhancement tables...');
    
    // 1. Wallet System
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
    
    // 2. Transactions
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
        related_entity_type VARCHAR(50) NULL, -- 'bot', 'ad_campaign', 'user', etc.
        related_entity_id INTEGER NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    // 3. Subscription Tiers
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
    
    // 4. Advertising Ecosystem
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS bot_niches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    // 5. Bot Advertising Settings
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
    
    // 6. Ad Campaigns
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
    
    // 7. Ad Impressions & Clicks
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ad_events (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL,
        bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('impression', 'click', 'reward')),
        revenue DECIMAL(10, 4) NOT NULL, -- Revenue share for this event
        platform_share DECIMAL(10, 4) NOT NULL,
        bot_owner_share DECIMAL(10, 4) NOT NULL,
        user_share DECIMAL(10, 4) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    // 8. Platform Settings
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    console.log('✅ Creating indexes...');
    
    // Create indexes
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
    
    // Insert initial data
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
    
    console.log('🎉 Botomics enhancement tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating Botomics tables:', error);
    throw error;
  }
}

module.exports = createBotomicsTables;