const { sequelize } = require('../../database/db');
const User = require('./User');
const Bot = require('./Bot');
const Admin = require('./Admin');
const Feedback = require('./Feedback');
const UserLog = require('./UserLog');
const BroadcastHistory = require('./BroadcastHistory');

// Define associations

// Bot belongs to User (owner)
Bot.belongsTo(User, { 
  foreignKey: 'owner_id', 
  targetKey: 'telegram_id', 
  as: 'Owner' 
});

// User has many Bots (as owner)
User.hasMany(Bot, { 
  foreignKey: 'owner_id', 
  sourceKey: 'telegram_id', 
  as: 'OwnedBots' 
});

// Admin associations
Admin.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'Bot' 
});

Admin.belongsTo(User, { 
  foreignKey: 'admin_user_id', 
  targetKey: 'telegram_id', 
  as: 'User' 
});

Bot.hasMany(Admin, { 
  foreignKey: 'bot_id', 
  as: 'Admins' 
});

User.hasMany(Admin, { 
  foreignKey: 'admin_user_id', 
  sourceKey: 'telegram_id', 
  as: 'AdminRoles' 
});

// Feedback associations
Feedback.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'Bot' 
});

Bot.hasMany(Feedback, { 
  foreignKey: 'bot_id', 
  as: 'Feedbacks' 
});

Feedback.belongsTo(User, {
  foreignKey: 'replied_by',
  targetKey: 'telegram_id',
  as: 'Replier'
});

// UserLog associations
UserLog.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'Bot' 
});

Bot.hasMany(UserLog, { 
  foreignKey: 'bot_id', 
  as: 'UserLogs' 
});

// BroadcastHistory associations
BroadcastHistory.belongsTo(Bot, { 
  foreignKey: 'bot_id', 
  as: 'Bot' 
});

Bot.hasMany(BroadcastHistory, { 
  foreignKey: 'bot_id', 
  as: 'BroadcastHistories' 
});

BroadcastHistory.belongsTo(User, {
  foreignKey: 'sent_by',
  targetKey: 'telegram_id',
  as: 'Sender'
});

module.exports = {
  sequelize,
  User,
  Bot,
  Admin,
  Feedback,
  UserLog,
  BroadcastHistory
};