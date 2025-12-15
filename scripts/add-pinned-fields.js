// scripts/add-pinned-fields.js
const { sequelize } = require('../database/db');

async function migrate() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Check if columns already exist
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bots';
    `);
    
    const existingColumns = columns.map(col => col.column_name);
    console.log(`📊 Existing columns: ${existingColumns.join(', ')}`);
    
    // Columns to add
    const newColumns = [
      'pinned_message_id BIGINT',
      'pinned_chat_id BIGINT',
      'pinned_message_content TEXT',
      'pinned_message_type VARCHAR(50) DEFAULT \'text\'',
      'pinned_file_id VARCHAR(255)',
      'pinned_at TIMESTAMP',
      'pinned_by BIGINT',
      'original_creator_id BIGINT',
      'ownership_transferred BOOLEAN DEFAULT false',
      'ownership_history JSONB'
    ];
    
    // Add each column if it doesn't exist
    for (const columnDef of newColumns) {
      const columnName = columnDef.split(' ')[0];
      
      if (!existingColumns.includes(columnName)) {
        console.log(`➕ Adding column: ${columnName}`);
        await sequelize.query(`ALTER TABLE bots ADD COLUMN ${columnDef};`);
      } else {
        console.log(`✓ Column already exists: ${columnName}`);
      }
    }
    
    // Migrate data from old pinned_start_message to new field
    console.log('🔄 Migrating data from old pinned_start_message field...');
    const [migrated] = await sequelize.query(`
      UPDATE bots 
      SET pinned_message_content = pinned_start_message 
      WHERE pinned_start_message IS NOT NULL 
        AND pinned_message_content IS NULL
      RETURNING id, bot_name, pinned_start_message;
    `);
    
    console.log(`✅ Migrated ${migrated.length} pinned messages:`);
    migrated.forEach(bot => {
      console.log(`   - ${bot.bot_name}: "${bot.pinned_start_message?.substring(0, 50)}${bot.pinned_start_message?.length > 50 ? '...' : ''}"`);
    });
    
    // Show final status
    const [summary] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_bots,
        COUNT(pinned_start_message) as with_old_pinned,
        COUNT(pinned_message_content) as with_new_pinned
      FROM bots;
    `);
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Total bots: ${summary[0].total_bots}`);
    console.log(`   Bots with old pinned messages: ${summary[0].with_old_pinned}`);
    console.log(`   Bots with new pinned messages: ${summary[0].with_new_pinned}`);
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Handle command line arguments
if (require.main === module) {
  migrate().then(() => process.exit(0));
}

module.exports = { migrate };