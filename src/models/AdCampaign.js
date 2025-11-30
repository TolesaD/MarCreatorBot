const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const AdCampaign = sequelize.define('AdCampaign', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  advertiser_id: {
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
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  budget: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  spent: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  target_clicks: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  target_impressions: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
    validate: {
      isIn: [['draft', 'active', 'paused', 'completed', 'cancelled']]
    }
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ad_campaigns',
  timestamps: false,
  indexes: [
    {
      fields: ['advertiser_id']
    },
    {
      fields: ['bot_id']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = AdCampaign;