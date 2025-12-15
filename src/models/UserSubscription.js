const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const UserSubscription = sequelize.define('UserSubscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  tier: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['freemium', 'premium']]
    }
  },
  status: {
  type: DataTypes.STRING(20),
  defaultValue: 'active',
  validate: {
    isIn: [['active', 'cancelled', 'expired', 'revoked']]  // ADD 'revoked' here
  }
},
  monthly_price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 5.00
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'BOM'
  },
  current_period_start: {
    type: DataTypes.DATE,
    allowNull: false
  },
  current_period_end: {
    type: DataTypes.DATE,
    allowNull: false
  },
  auto_renew: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
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
  tableName: 'user_subscriptions',
  timestamps: false,
  hooks: {
    beforeUpdate: (subscription) => {
      subscription.updated_at = new Date();
    }
  },
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = UserSubscription;