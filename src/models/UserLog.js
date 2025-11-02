const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const UserLog = sequelize.define('UserLog', {
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
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  user_username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  user_first_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  interaction_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  last_interaction: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  first_interaction: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user_log',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['bot_id', 'user_id']
    },
    {
      fields: ['last_interaction']
    }
  ]
});

module.exports = UserLog;