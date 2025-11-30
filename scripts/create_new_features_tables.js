const { sequelize } = require('../database/db');
const { QueryTypes } = require('sequelize');

async function createNewFeaturesTables() {
  try {
    console.log('🔄 Creating NEW advanced feature tables...');
    
    // 1. Bot Ownership Transfers Table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS bot_ownership_transfers (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        current_owner_id BIGINT NOT NULL,
        new_owner_id BIGINT NOT NULL,
        new_owner_username VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed')),
        transfer_token VARCHAR(255) UNIQUE NOT NULL,
        current_owner_confirmed BOOLEAN DEFAULT false,
        new_owner_confirmed BOOLEAN DEFAULT false,
        admin_approved BOOLEAN DEFAULT false,
        transfer_reason TEXT,
        completed_at TIMESTAMP NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    console.log('✅ Created bot_ownership_transfers table');
    
    // 2. Pinned Messages Table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS pinned_messages (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'document')),
        media_file_id VARCHAR(255),
        priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),
        is_active BOOLEAN DEFAULT true,
        show_on_start BOOLEAN DEFAULT true,
        expires_at TIMESTAMP NULL,
        created_by BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, { type: QueryTypes.RAW });
    
    console.log('✅ Created pinned_messages table');
    
    // Create indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_ownership_transfers_bot_id ON bot_ownership_transfers(bot_id);
      CREATE INDEX IF NOT EXISTS idx_ownership_transfers_token ON bot_ownership_transfers(transfer_token);
      CREATE INDEX IF NOT EXISTS idx_ownership_transfers_status ON bot_ownership_transfers(status);
      CREATE INDEX IF NOT EXISTS idx_ownership_transfers_expires ON bot_ownership_transfers(expires_at);
      
      CREATE INDEX IF NOT EXISTS idx_pinned_messages_bot_id ON pinned_messages(bot_id);
      CREATE INDEX IF NOT EXISTS idx_pinned_messages_active ON pinned_messages(is_active);
      CREATE INDEX IF NOT EXISTS idx_pinned_messages_priority ON pinned_messages(priority);
      CREATE INDEX IF NOT EXISTS idx_pinned_messages_expires ON pinned_messages(expires_at);
    `, { type: QueryTypes.RAW });
    
    console.log('✅ Created indexes for new features');
    console.log('🎉 All NEW advanced feature tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating new feature tables:', error);
    throw error;
  }
}

if (require.main === module) {
  createNewFeaturesTables()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createNewFeaturesTables;