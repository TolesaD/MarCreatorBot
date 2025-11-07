// debug-ownership.js
require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log
});

async function debugOwnership() {
  try {
    console.log('🔍 Debugging bot ownership mismatch...');
    
    await sequelize.authenticate();
    
    // Check the specific bot
    const bots = await sequelize.query('SELECT id, bot_name, owner_id, is_active FROM bots WHERE id = 1', {
      type: Sequelize.QueryTypes.SELECT
    });
    
    console.log('📊 Bot ID 1 data:');
    bots.forEach(bot => {
      console.log(`   ID: ${bot.id}, Name: ${bot.bot_name}, Owner ID: ${bot.owner_id}, Type: ${typeof bot.owner_id}, Active: ${bot.is_active}`);
    });
    
    console.log(`👤 Your user ID: 1827785384`);
    console.log(`🔍 Comparison: ${bots[0]?.owner_id} === 1827785384 = ${bots[0]?.owner_id == 1827785384}`);
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await sequelize.close();
  }
}

debugOwnership();