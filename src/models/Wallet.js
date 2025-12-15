const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  wallet_address: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'BOM'
  },
  is_frozen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  freeze_reason: {
    type: DataTypes.TEXT,
    allowNull: true
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
  tableName: 'wallets',
  timestamps: false,
  hooks: {
    beforeCreate: (wallet) => {
      // Generate wallet address if not provided
      if (!wallet.wallet_address) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        wallet.wallet_address = `BOTOMICS_${wallet.user_id}_${timestamp}_${random}`;
      }
    },
    beforeUpdate: (wallet) => {
      wallet.updated_at = new Date();
    }
  },
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['wallet_address']
    },
    {
      fields: ['is_frozen']
    }
  ]
});

module.exports = Wallet;
