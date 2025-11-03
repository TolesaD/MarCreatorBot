const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/db');
const { encrypt, decrypt, isEncryptionWorking } = require('../utils/encryption');

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
    beforeCreate: async (bot) => {
      // CRITICAL FIX: Test encryption before using it
      if (!isEncryptionWorking()) {
        console.error('💥 ENCRYPTION SYSTEM NOT WORKING - cannot create bot');
        throw new Error('Encryption system failure - cannot secure bot token');
      }
      
      // Always encrypt the token on creation
      if (bot.bot_token && !isEncrypted(bot.bot_token)) {
        console.log(`🔐 Encrypting token for new bot: ${bot.bot_name}`);
        try {
          const encrypted = encrypt(bot.bot_token);
          if (!encrypted) {
            throw new Error('Encryption returned null');
          }
          bot.bot_token = encrypted;
          console.log(`✅ Token encrypted successfully for: ${bot.bot_name}`);
        } catch (error) {
          console.error(`❌ Failed to encrypt token for ${bot.bot_name}:`, error.message);
          throw new Error('Token encryption failed: ' + error.message);
        }
      }
      bot.updated_at = new Date();
    },
    beforeUpdate: async (bot) => {
      bot.updated_at = new Date();
      // Encrypt token only if it's being changed and not already encrypted
      if (bot.changed('bot_token') && bot.bot_token && !isEncrypted(bot.bot_token)) {
        console.log(`🔐 Re-encrypting token for bot: ${bot.bot_name}`);
        try {
          const encrypted = encrypt(bot.bot_token);
          if (!encrypted) {
            throw new Error('Encryption returned null');
          }
          bot.bot_token = encrypted;
          console.log(`✅ Token re-encrypted successfully for: ${bot.bot_name}`);
        } catch (error) {
          console.error(`❌ Failed to re-encrypt token for ${bot.bot_name}:`, error.message);
          throw new Error('Token re-encryption failed: ' + error.message);
        }
      }
    }
  }
});

// Helper function to check if token is already encrypted
function isEncrypted(token) {
  if (!token || typeof token !== 'string') return false;
  
  // CRITICAL FIX: More robust encrypted format detection
  try {
    // Check if it matches our encryption format (iv:authTag:encrypted)
    const parts = token.split(':');
    const isValidFormat = parts.length === 3 && 
           parts[0].length === 32 && // iv hex (16 bytes = 32 hex chars)
           parts[1].length === 32;   // authTag hex (16 bytes = 32 hex chars)
    
    if (!isValidFormat) return false;
    
    // Additional validation: try to decrypt to verify (but don't throw on failure)
    try {
      const testDecrypt = decrypt(token);
      return !!testDecrypt; // If decrypt succeeds, it's properly encrypted
    } catch {
      return false; // If decrypt fails, it's not properly encrypted
    }
  } catch (error) {
    return false;
  }
}

// Instance method to get decrypted token
Bot.prototype.getDecryptedToken = function() {
  try {
    console.log(`🔓 Attempting to decrypt token for: ${this.bot_name} (ID: ${this.id}, DB ID: ${this.bot_id})`);
    
    if (!this.bot_token) {
      console.error('❌ No token found for bot:', this.bot_name);
      return null;
    }
    
    // Validate token format first
    if (typeof this.bot_token !== 'string') {
      console.error(`❌ Invalid token format for: ${this.bot_name}`);
      return null;
    }
    
    // CRITICAL FIX: Test encryption system first
    if (!isEncryptionWorking()) {
      console.error(`💥 ENCRYPTION SYSTEM FAILURE for bot: ${this.bot_name}`);
      return null;
    }
    
    if (isEncrypted(this.bot_token)) {
      console.log(`🔐 Token is encrypted, decrypting: ${this.bot_name}`);
      const decrypted = decrypt(this.bot_token);
      if (!decrypted) {
        console.error(`❌ Failed to decrypt token for: ${this.bot_name}`);
        return null;
      }
      
      // Validate decrypted token format
      if (!isValidTokenFormat(decrypted)) {
        console.error(`❌ Decrypted token has invalid format for: ${this.bot_name}`);
        console.error(`💡 Token: ${decrypted.substring(0, 20)}...`);
        return null;
      }
      
      console.log(`✅ Successfully decrypted token for: ${this.bot_name}`);
      return decrypted;
    } else {
      console.log(`ℹ️ Token appears to be plain text for: ${this.bot_name}`);
      
      // Validate plain text token format
      if (!isValidTokenFormat(this.bot_token)) {
        console.error(`❌ Plain text token has invalid format for: ${this.bot_name}`);
        console.error(`💡 Token: ${this.bot_token.substring(0, 20)}...`);
        return null;
      }
      
      // Token is already plain text (might be from old data)
      console.log(`✅ Using plain text token for: ${this.bot_name}`);
      return this.bot_token;
    }
  } catch (error) {
    console.error(`💥 Critical error decrypting token for ${this.bot_name}:`, error.message);
    return null;
  }
};

// Helper function to validate token format
function isValidTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;
  
  // Telegram bot tokens typically follow this pattern: numbers:letters
  const tokenPattern = /^\d+:[a-zA-Z0-9_-]+$/;
  const isValid = tokenPattern.test(token);
  
  if (!isValid) {
    console.error(`❌ Invalid token format: ${token.substring(0, 20)}...`);
  }
  
  return isValid;
}

// CRITICAL: Add method to test token decryption without initializing bot
Bot.prototype.testTokenDecryption = function() {
  try {
    const token = this.getDecryptedToken();
    return {
      success: !!token,
      token: token ? `${token.substring(0, 10)}...` : null,
      message: token ? 'Token decryption successful' : 'Token decryption failed'
    };
  } catch (error) {
    return {
      success: false,
      token: null,
      message: `Token decryption error: ${error.message}`
    };
  }
};

// Static method to find by bot_id
Bot.findByBotId = async function(botId) {
  try {
    return await this.findOne({ where: { bot_id: botId } });
  } catch (error) {
    console.error(`Error finding bot by ID ${botId}:`, error);
    return null;
  }
};

// Static method to get active bots by owner
Bot.findActiveByOwner = async function(ownerId) {
  try {
    return await this.findAll({ 
      where: { 
        owner_id: ownerId,
        is_active: true 
      },
      order: [['created_at', 'DESC']]
    });
  } catch (error) {
    console.error(`Error finding active bots for owner ${ownerId}:`, error);
    return [];
  }
};

// Static method to get all active bots
Bot.findAllActive = async function() {
  try {
    return await this.findAll({ 
      where: { is_active: true },
      order: [['created_at', 'DESC']]
    });
  } catch (error) {
    console.error('Error finding all active bots:', error);
    return [];
  }
};

// Static method to get user stats
Bot.getUserStats = async function(botId) {
  const UserLog = require('./UserLog');
  const Feedback = require('./Feedback');
  
  try {
    const [userCount, messageCount, pendingCount] = await Promise.all([
      UserLog.count({ where: { bot_id: botId } }),
      Feedback.count({ where: { bot_id: botId } }),
      Feedback.count({ where: { bot_id: botId, is_replied: false } })
    ]);
    
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
  try {
    return await this.findAll({ 
      where: { owner_id: ownerId },
      order: [['created_at', 'DESC']]
    });
  } catch (error) {
    console.error(`Error finding bots for owner ${ownerId}:`, error);
    return [];
  }
};

// Instance method to test bot token (verify it works with Telegram API)
Bot.prototype.testToken = async function() {
  try {
    const token = this.getDecryptedToken();
    if (!token) {
      return { success: false, error: 'Invalid or missing token' };
    }
    
    const { Telegraf } = require('telegraf');
    const testBot = new Telegraf(token);
    
    // Try to get bot info from Telegram API
    const botInfo = await testBot.telegram.getMe();
    
    return { 
      success: true, 
      botInfo: {
        id: botInfo.id,
        username: botInfo.username,
        first_name: botInfo.first_name,
        can_join_groups: botInfo.can_join_groups,
        can_read_all_group_messages: botInfo.can_read_all_group_messages,
        supports_inline_queries: botInfo.supports_inline_queries
      }
    };
  } catch (error) {
    console.error(`Error testing token for bot ${this.bot_name}:`, error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Instance method to safely activate bot
Bot.prototype.safeActivate = async function() {
  try {
    // Test token before activation
    const testResult = await this.testToken();
    if (!testResult.success) {
      throw new Error(`Token validation failed: ${testResult.error}`);
    }
    
    this.is_active = true;
    this.updated_at = new Date();
    await this.save();
    
    return { success: true, botInfo: testResult.botInfo };
  } catch (error) {
    console.error(`Error activating bot ${this.bot_name}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Instance method to JSON
Bot.prototype.toJSON = function() {
  const values = { ...this.get() };
  // Don't include encrypted token in JSON output for security
  delete values.bot_token;
  return values;
};

// Instance method to safe format (includes minimal info)
Bot.prototype.toSafeFormat = function() {
  return {
    id: this.id,
    bot_id: this.bot_id,
    bot_name: this.bot_name,
    bot_username: this.bot_username,
    welcome_message: this.welcome_message,
    is_active: this.is_active,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

// Add this static method to Bot model
Bot.diagnoseEncryption = async function() {
  const { diagnoseEncryptionKey, isEncryptionWorking } = require('../utils/encryption');
  
  console.log('🔍 Running encryption diagnostics...');
  
  // Test encryption key
  const keyDiagnosis = diagnoseEncryptionKey();
  console.log('🔑 Encryption Key Diagnosis:', keyDiagnosis);
  
  // Test encryption system
  const encryptionWorking = isEncryptionWorking();
  console.log('🔐 Encryption System Working:', encryptionWorking);
  
  // Test existing bot tokens
  const activeBots = await this.findAll({ where: { is_active: true } });
  console.log(`🤖 Testing ${activeBots.length} active bots...`);
  
  const results = [];
  for (const bot of activeBots) {
    const tokenTest = bot.testTokenDecryption();
    results.push({
      bot_name: bot.bot_name,
      bot_id: bot.bot_id,
      token_test: tokenTest
    });
    
    console.log(`   ${bot.bot_name}: ${tokenTest.success ? '✅' : '❌'} ${tokenTest.message}`);
  }
  
  return {
    key_diagnosis: keyDiagnosis,
    encryption_system: encryptionWorking,
    bot_tests: results
  };
};

module.exports = Bot;