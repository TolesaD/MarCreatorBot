const { connectDB } = require('./src/database/db');
const Bot = require('../src/models/Bot');
const User = require('../src/models/User');
const Admin = require('../src/models/Admin');
const Feedback = require('../src/models/Feedback');
const UserLog = require('../src/models/UserLog');
const BroadcastHistory = require('../src/models/BroadcastHistory');

async function setupDatabase() {
  try {
    console.log('🔄 Setting up database...');
    
    // Connect to database (this will sync all models)
    await connectDB();
    
    console.log('✅ Database setup completed successfully');
    
    // Create a main bot admin if needed
    const mainAdminUserId = process.env.MAIN_BOT_ADMIN_ID;
    if (mainAdminUserId) {
      await User.upsert({
        telegram_id: parseInt(mainAdminUserId),
        username: 'admin',
        first_name: 'Main Bot',
        last_name: 'Admin',
        is_main_bot_admin: true
      });
      console.log(`✅ Main bot admin set: ${mainAdminUserId}`);
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;