const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const BroadcastHistory = sequelize.define('BroadcastHistory', {
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
  sent_by: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  total_users: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  successful_sends: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  failed_sends: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  sent_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'broadcast_history',
  timestamps: false
});

module.exports = BroadcastHistory;