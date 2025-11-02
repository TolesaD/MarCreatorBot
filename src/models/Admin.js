const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'bots',
      key: 'id'
    }
  },
  admin_user_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  admin_username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  added_by: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  added_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  permissions: {
    type: DataTypes.JSON,
    defaultValue: {
      can_reply: true,
      can_broadcast: true,
      can_manage_admins: false,
      can_view_stats: true,
      can_deactivate: false,
      can_edit_bot: false
    }
  }
}, {
  tableName: 'admins',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['bot_id', 'admin_user_id']
    }
  ]
});

// Static method to check if user can manage bot
Admin.canManageBot = async function(botId, userId) {
  try {
    const Bot = require('./Bot');
    const bot = await Bot.findByPk(botId);
    
    if (!bot) return false;
    
    // Owner can always manage
    if (bot.owner_id === userId) return true;
    
    // Check if user is admin
    const admin = await this.findOne({
      where: { bot_id: botId, admin_user_id: userId }
    });
    
    return !!admin;
  } catch (error) {
    console.error('Error checking admin access:', error);
    return false;
  }
};

// Static method to get manageable bots for user
Admin.getManageableBots = async function(userId) {
  try {
    const Bot = require('./Bot');
    
    // Get owned bots
    const ownedBots = await Bot.findAll({ where: { owner_id: userId } });
    
    // Get admin bots
    const adminRecords = await this.findAll({ 
      where: { admin_user_id: userId },
      include: [{ model: Bot, as: 'Bot' }]
    });
    
    const adminBots = adminRecords.map(record => record.Bot).filter(bot => bot);
    
    // Combine and remove duplicates
    const allBots = [...ownedBots, ...adminBots];
    const uniqueBots = allBots.filter((bot, index, self) => 
      index === self.findIndex(b => b.id === bot.id)
    );
    
    return uniqueBots;
  } catch (error) {
    console.error('Error getting manageable bots:', error);
    return [];
  }
};

// Static method to find by bot
Admin.findByBot = async function(botId) {
  return await this.findAll({ 
    where: { bot_id: botId },
    include: [{ model: require('./User'), as: 'User' }]
  });
};

module.exports = Admin;