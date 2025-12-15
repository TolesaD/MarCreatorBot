// scripts/simple-backup.js
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../database/db');

async function simpleBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'backups');
    const backupFile = path.join(backupDir, `simple-backup-${timestamp}.json`);
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    console.log('💾 Creating simple database backup...');
    console.log(`📁 Backup file: ${backupFile}`);
    
    // Backup only the bots table (most important)
    const [bots] = await sequelize.query('SELECT * FROM bots ORDER BY id');
    
    // Also backup user_logs and feedback for safety
    const [userLogs] = await sequelize.query('SELECT * FROM user_logs ORDER BY id LIMIT 1000');
    const [feedback] = await sequelize.query('SELECT * FROM feedback ORDER BY id LIMIT 1000');
    
    const backupData = {
      timestamp: new Date().toISOString(),
      tables: {
        bots: {
          count: bots.length,
          data: bots
        },
        user_logs: {
          count: userLogs.length,
          data: userLogs
        },
        feedback: {
          count: feedback.length,
          data: feedback
        }
      }
    };
    
    // Write backup to file
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    console.log('✅ Backup completed successfully!');
    console.log(`📊 Backup stats:`);
    console.log(`   - Bots: ${bots.length} records`);
    console.log(`   - User Logs: ${userLogs.length} records`);
    console.log(`   - Feedback: ${feedback.length} records`);
    
    return backupFile;
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  simpleBackup()
    .then(backupFile => {
      console.log(`📦 Backup saved to: ${backupFile}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Backup failed:', error);
      process.exit(1);
    });
}

module.exports = { simpleBackup };