const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const BotAdSettings = sequelize.define('BotAdSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'bots',
      key: 'id'
    }
  },
  niche_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bot_niches',
      key: 'id'
    }
  },
  ad_price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.10
  },
  is_ad_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  min_users_required: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  last_price_change: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  total_ad_revenue: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
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
  tableName: 'bot_ad_settings',
  timestamps: false,
  hooks: {
    beforeUpdate: (settings) => {
      settings.updated_at = new Date();
    }
  },
  indexes: [
    {
      fields: ['bot_id']
    },
    {
      fields: ['niche_id']
    },
    {
      fields: ['is_approved']
    }
  ]
});

module.exports = BotAdSettings;