const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');
const { encrypt, decrypt } = require('../utils/encryption');

const Bot = sequelize.define('Bot', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bot_id: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  owner_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  bot_token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  bot_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  bot_username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  welcome_message: {
    type: DataTypes.TEXT,
    defaultValue: "👋 Hello! I'm here to help you get in touch with the admin. Just send me a message!"
  },
  is_active: {
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
  tableName: 'bots',
  timestamps: false,
  hooks: {
    beforeCreate: (bot) => {
      // Always encrypt the token on creation
      if (bot.bot_token && !isEncrypted(bot.bot_token)) {
        console.log(`🔐 Encrypting token for new bot: ${bot.bot_name}`);
        bot.bot_token = encrypt(bot.bot_token);
      }
      bot.updated_at = new Date();
    },
    beforeUpdate: (bot) => {
      bot.updated_at = new Date();
      // Encrypt token only if it's being changed and not already encrypted
      if (bot.changed('bot_token') && bot.bot_token && !isEncrypted(bot.bot_token)) {
        console.log(`🔐 Re-encrypting token for bot: ${bot.bot_name}`);
        bot.bot_token = encrypt(bot.bot_token);
      }
    }
  }
});

// Helper function to check if token is already encrypted
function isEncrypted(token) {
  if (!token) return false;
  // Check if it matches our encryption format (iv:authTag:encrypted)
  const parts = token.split(':');
  return parts.length === 3 && 
         parts[0].length === 32 && // iv hex (16 bytes = 32 hex chars)
         parts[1].length === 32;   // authTag hex (16 bytes = 32 hex chars)
}

// Instance method to get decrypted token
Bot.prototype.getDecryptedToken = function() {
  try {
    console.log(`🔓 Attempting to decrypt token for: ${this.bot_name}`);
    
    if (!this.bot_token) {
      console.error('❌ No token found for bot:', this.bot_name);
      return null;
    }
    
    if (isEncrypted(this.bot_token)) {
      console.log(`🔐 Token is encrypted, decrypting: ${this.bot_name}`);
      const decrypted = decrypt(this.bot_token);
      if (!decrypted) {
        console.error(`❌ Failed to decrypt token for: ${this.bot_name}`);
        return null;
      }
      console.log(`✅ Successfully decrypted token for: ${this.bot_name}`);
      return decrypted;
    } else {
      console.log(`ℹ️ Token is already plain text for: ${this.bot_name}`);
      // Token is already plain text (might be from old data)
      return this.bot_token;
    }
  } catch (error) {
    console.error(`💥 Error decrypting token for ${this.bot_name}:`, error.message);
    return null;
  }
};

// Static method to find by bot_id
Bot.findByBotId = async function(botId) {
  return await this.findOne({ where: { bot_id: botId } });
};

// Static method to get user stats
Bot.getUserStats = async function(botId) {
  const UserLog = require('./UserLog');
  const Feedback = require('./Feedback');
  
  try {
    const userCount = await UserLog.count({ where: { bot_id: botId } });
    const messageCount = await Feedback.count({ where: { bot_id: botId } });
    const pendingCount = await Feedback.count({ where: { bot_id: botId, is_replied: false } });
    
    return {
      totalUsers: userCount,
      totalMessages: messageCount,
      pendingFeedback: pendingCount
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return { totalUsers: 0, totalMessages: 0, pendingFeedback: 0 };
  }
};

// Static method to get bots by owner
Bot.findByOwner = async function(ownerId) {
  return await this.findAll({ where: { owner_id: ownerId } });
};

// Instance method to JSON
Bot.prototype.toJSON = function() {
  const values = { ...this.get() };
  // Don't include encrypted token in JSON output
  delete values.bot_token;
  return values;
};

module.exports = Bot;