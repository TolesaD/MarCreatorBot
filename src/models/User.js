const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telegram_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_main_bot_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_platform_creator: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  language_code: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  last_active: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'users',
  timestamps: false,
  indexes: [
    {
      fields: ['telegram_id']
    },
    {
      fields: ['username']
    }
  ]
});

// Add method to check if user is platform creator
User.isPlatformCreator = async function(telegramId) {
  const user = await this.findOne({ where: { telegram_id: telegramId } });
  return user ? user.is_platform_creator : false;
};

// Add method to check if user has bot access (owns bots or is admin)
User.hasBotAccess = async function(telegramId) {
  const user = await this.findOne({ where: { telegram_id: telegramId } });
  if (!user) return false;
  
  // Platform creator has access to everything
  if (user.is_platform_creator) return true;
  
  // Check if user owns any bots
  const Bot = require('./Bot');
  const ownedBots = await Bot.count({ where: { owner_id: telegramId } });
  if (ownedBots > 0) return true;
  
  // Check if user is admin of any bots
  const Admin = require('./Admin');
  const adminBots = await Admin.count({ where: { admin_user_id: telegramId } });
  
  return adminBots > 0;
};

module.exports = User;