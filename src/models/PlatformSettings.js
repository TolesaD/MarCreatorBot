const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const PlatformSettings = sequelize.define('PlatformSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'platform_settings',
  timestamps: false,
  hooks: {
    beforeUpdate: (settings) => {
      settings.updated_at = new Date();
    }
  }
});

module.exports = PlatformSettings;