const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const WalletTransaction = sequelize.define('WalletTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  wallet_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'wallets',
      key: 'id'
    }
  },
  // REMOVED user_id column since it doesn't exist in database
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['deposit', 'withdrawal', 'transfer', 'subscription', 'donation', 'ad_revenue', 'reward', 'admin_adjustment', 'admin_deduction', 'admin_action', 'fee', 'refund']]
    }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'BOM'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'completed',
    validate: {
      isIn: [['pending', 'completed', 'failed', 'cancelled']]
    }
  },
  related_entity_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  related_entity_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'wallet_transactions',
  timestamps: false,
  indexes: [
    {
      fields: ['wallet_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['status']
    }
  ]
});

// Add associations method - FIXED to not include user_id
WalletTransaction.associate = function(models) {
  WalletTransaction.belongsTo(models.Wallet, {
    foreignKey: 'wallet_id',
    as: 'wallet'  // Changed from 'Wallet' to 'wallet' for consistency
  });
  // NO association with User since we don't have user_id
};

module.exports = WalletTransaction;