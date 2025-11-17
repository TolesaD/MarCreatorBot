// 📁 src/models/CommandVariable.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const CommandVariable = sequelize.define('CommandVariable', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  command_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'string'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'command_variables',
  timestamps: false
});

module.exports = CommandVariable;