// test-wallet-db.js
const { sequelize } = require('./database/db');

async function testWalletTables() {
  try {
    console.log('🧪 Testing Botomics Wallet Database...\n');
    
    // Test wallets table
    const wallets = await sequelize.query('SELECT COUNT(*) as count FROM wallets', {
      type: sequelize.QueryTypes.SELECT
    });
    console.log(`✅ Wallets table: ${wallets[0].count} records`);
    
    // Test wallet_transactions table
    const transactions = await sequelize.query('SELECT COUNT(*) as count FROM wallet_transactions', {
      type: sequelize.QueryTypes.SELECT
    });
    console.log(`✅ Wallet transactions table: ${transactions[0].count} records`);
    
    // Test withdrawals table
    const withdrawals = await sequelize.query('SELECT COUNT(*) as count FROM withdrawals', {
      type: sequelize.QueryTypes.SELECT
    });
    console.log(`✅ Withdrawals table: ${withdrawals[0].count} records`);
    
    // Check admin wallet
    const adminWallet = await sequelize.query(
      'SELECT balance FROM wallets WHERE user_id = 1827785384', 
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (adminWallet.length > 0) {
      console.log(`✅ Admin wallet balance: ${adminWallet[0].balance} BOM`);
    } else {
      console.log('❌ Admin wallet not found');
    }
    
    console.log('\n🎉 Botomics Wallet database is ready!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

testWalletTables();