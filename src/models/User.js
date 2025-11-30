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
  is_banned: { // NEW FIELD
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ban_reason: { // NEW FIELD
    type: DataTypes.TEXT,
    allowNull: true
  },
  banned_at: { // NEW FIELD
    type: DataTypes.DATE,
    allowNull: true
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
  },
  // Add to User model after existing fields
  premium_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'freemium',
    validate: {
      isIn: [['freemium', 'premium']]
    }
  },
  premium_expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  total_ad_earnings: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  // Add to Bot model after existing fields
  niche_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_ad_approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ad_price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.10
  },
  last_price_change: {
    type: DataTypes.DATE,
    allowNull: true
  },
  total_ad_revenue: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  user_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  has_donation_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  pinned_start_message: {
    type: DataTypes.TEXT,
    allowNull: true
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
    },
    {
      fields: ['is_banned'] // NEW INDEX
    }
  ]
});

module.exports = User;