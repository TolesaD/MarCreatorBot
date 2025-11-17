// 📁 src/models/CustomCommand.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const CustomCommand = sequelize.define('CustomCommand', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bot_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  trigger: {
    type: DataTypes.STRING,
    allowNull: false
  },
  flow_data: {
    type: DataTypes.JSON,
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  usage_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
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
  tableName: 'custom_commands',
  timestamps: false
});

CustomCommand.associate = function(models) {
  CustomCommand.belongsTo(models.Bot, { foreignKey: 'bot_id' });
};

module.exports = CustomCommand;