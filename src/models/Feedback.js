const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');

const Feedback = sequelize.define('Feedback', {
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
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  message_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  message_type: {
    type: DataTypes.STRING,
    defaultValue: 'text'
  },
  is_replied: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  reply_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  replied_by: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  replied_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'feedback',
  timestamps: false,
  indexes: [
    {
      fields: ['bot_id', 'is_replied']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = Feedback;