const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../../database/db');

const PinnedMessage = sequelize.define('PinnedMessage', {
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
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  message_type: {
    type: DataTypes.ENUM('text', 'image', 'video', 'document'),
    defaultValue: 'text'
  },
  media_file_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 10
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  show_on_start: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
   tableName: 'pinned_messages',
  timestamps: false,
  indexes: [
    {
      fields: ['bot_id']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['expires_at']
    }
  ]
});

// Static method to get active pinned messages for bot
PinnedMessage.getActivePinnedMessages = async function(botId) {
  return await this.findAll({
    where: { 
      bot_id: botId,
      is_active: true,
      [Op.or]: [
        { expires_at: null },
        { expires_at: { [Op.gt]: new Date() } }
      ]
    },
    order: [
      ['priority', 'DESC'],
      ['created_at', 'ASC']
    ]
  });
};

// Static method to get pinned messages for start command
PinnedMessage.getStartPinnedMessages = async function(botId) {
  return await this.findAll({
    where: { 
      bot_id: botId,
      is_active: true,
      show_on_start: true,
      [Op.or]: [
        { expires_at: null },
        { expires_at: { [Op.gt]: new Date() } }
      ]
    },
    order: [
      ['priority', 'DESC'],
      ['created_at', 'ASC']
    ]
  });
};

// Check if message is expired
PinnedMessage.prototype.isExpired = function() {
  return this.expires_at && new Date() > this.expires_at;
};

module.exports = PinnedMessage;