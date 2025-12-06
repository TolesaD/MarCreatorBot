// scripts/add_wallet_address.js
const { sequelize } = require('../database/db');

async function addWalletAddressField() {
  try {
    console.log('🔄 Adding wallet address field to wallets table...');
    
    // Add new columns if they don't exist
    await sequelize.query(`
      ALTER TABLE wallets 
      ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(50) UNIQUE,
      ADD COLUMN IF NOT EXISTS daily_limit DECIMAL(10,2) DEFAULT 1000.00,
      ADD COLUMN IF NOT EXISTS withdrawal_minimum DECIMAL(10,2) DEFAULT 20.00,
      ADD COLUMN IF NOT EXISTS wallet_identifier VARCHAR(20) GENERATED ALWAYS AS (
        'BOTOMICS_' || user_id::TEXT
      ) STORED
    `);
    
    // Generate wallet addresses for existing wallets (BOM_XXXXXXXXXX format)
    console.log('🔧 Generating wallet addresses for existing users...');
    const wallets = await sequelize.query(`SELECT id, user_id FROM wallets WHERE wallet_address IS NULL`);
    
    for (const wallet of wallets[0]) {
      // Format: BOM_0000001234 (10 digits)
      const paddedId = wallet.user_id.toString().padStart(10, '0');
      const address = `BOM_${paddedId}`;
      await sequelize.query(
        `UPDATE wallets SET wallet_address = $1 WHERE id = $2`,
        { bind: [address, wallet.id] }
      );
      console.log(`   Generated address for user ${wallet.user_id}: ${address}`);
    }
    
    // Also add indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_wallet_address ON wallets(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_wallets_identifier ON wallets(wallet_identifier);
    `);
    
    console.log('✅ Wallet table updated successfully!');
    console.log('📊 Run this to test: SELECT user_id, wallet_address, wallet_identifier FROM wallets LIMIT 5;');
    
  } catch (error) {
    console.error('❌ Error updating wallet table:', error);
    if (error.message.includes('column')) {
      console.log('⚠️  Some columns may already exist. Continuing...');
    } else {
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config();
  const { connectDB } = require('../database/db');
  
  async function run() {
    try {
      await connectDB();
      await addWalletAddressField();
      process.exit(0);
    } catch (error) {
      console.error('❌ Script failed:', error);
      process.exit(1);
    }
  }
  
  run();
}

module.exports = { addWalletAddressField };