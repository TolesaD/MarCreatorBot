const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const AdEvent = sequelize.define('AdEvent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  campaign_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'ad_campaigns',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  bot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'bots',
      key: 'id'
    }
  },
  event_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['impression', 'click', 'reward']]
    }
  },
  revenue: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  platform_share: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  bot_owner_share: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  user_share: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ad_events',
  timestamps: false,
  indexes: [
    {
      fields: ['campaign_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['bot_id']
    },
    {
      fields: ['event_type']
    }
  ]
});

module.exports = AdEvent;