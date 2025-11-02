const { Bot } = require('../models');
const { decrypt } = require('./encryption');
const axios = require('axios');

/**
 * Validate bot name
 */
function validateBotName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Bot name is required' };
  }
  
  if (name.length < 2) {
    return { valid: false, error: 'Bot name must be at least 2 characters long' };
  }
  
  if (name.length > 50) {
    return { valid: false, error: 'Bot name must be less than 50 characters' };
  }
  
  // Check for invalid characters
  const invalidChars = /[<>{}[\]\\]/;
  if (invalidChars.test(name)) {
    return { valid: false, error: 'Bot name contains invalid characters' };
  }
  
  return { valid: true };
}

/**
 * Validate bot token format
 */
function validateTokenFormat(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Bot token is required' };
  }

  // Telegram bot token format: 1234567890:ABCdefGHIjklMNopQRSTuvwXYZ123456
  const tokenRegex = /^\d{9,11}:[A-Za-z0-9_-]{35}$/;
  if (!tokenRegex.test(token)) {
    return {
      valid: false,
      error: 'Invalid token format. It should look like: 1234567890:ABCdefGHIjklMNopQRSTuvwXYZ123456'
    };
  }

  return { valid: true };
}

/**
 * Check if token is unique across all bots
 */
async function isTokenUnique(token, excludeBotId = null) {
  try {
    const allBots = await Bot.findAll();
    
    for (const bot of allBots) {
      // Skip the current bot if we're updating
      if (excludeBotId && bot.id === excludeBotId) continue;
      
      try {
        const existingToken = decrypt(bot.bot_token);
        if (existingToken === token) {
          return {
            unique: false,
            existingBot: bot.bot_name
          };
        }
      } catch (decryptError) {
        // If we can't decrypt, skip this bot
        console.log(`⚠️ Could not decrypt token for ${bot.bot_name}`);
        continue;
      }
    }
    
    return { unique: true };
  } catch (error) {
    console.error('Error checking token uniqueness:', error);
    return { unique: false, error: 'Database error' };
  }
}

/**
 * Validate token with Telegram API
 */
async function validateWithTelegram(token) {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`, {
      timeout: 10000
    });
    
    if (response.data.ok) {
      return {
        valid: true,
        botInfo: response.data.result
      };
    } else {
      return {
        valid: false,
        error: 'Telegram API returned an error'
      };
    }
  } catch (error) {
    let errorMessage = 'Failed to validate token with Telegram';
    
    if (error.response?.data?.description) {
      errorMessage = `Telegram: ${error.response.data.description}`;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Telegram API timeout - please try again';
    } else {
      errorMessage = error.message;
    }
    
    return {
      valid: false,
      error: errorMessage
    };
  }
}

/**
 * Comprehensive bot token validation
 */
async function validateBotToken(token, userId = null, excludeBotId = null) {
  const errors = [];
  const suggestions = [];
  let botInfo = null;

  // 1. Validate format
  const formatValidation = validateTokenFormat(token);
  if (!formatValidation.valid) {
    errors.push(formatValidation.error);
    suggestions.push('Get a valid token from @BotFather using /newbot command');
  }

  // 2. Check uniqueness (only if format is valid)
  if (formatValidation.valid) {
    const uniquenessCheck = await isTokenUnique(token, excludeBotId);
    if (!uniquenessCheck.unique) {
      if (uniquenessCheck.existingBot) {
        errors.push(`This token is already used by: ${uniquenessCheck.existingBot}`);
      } else {
        errors.push('This token is already used by another bot');
      }
      suggestions.push('Each bot must have a unique token');
    }

    // 3. Validate with Telegram API
    const telegramValidation = await validateWithTelegram(token);
    if (!telegramValidation.valid) {
      errors.push(telegramValidation.error);
      suggestions.push('Make sure the token is correct and the bot exists');
    } else {
      botInfo = telegramValidation.botInfo;
    }
  }

  // 4. Check user bot limit (if userId provided)
  if (userId && formatValidation.valid) {
    const userBotCount = await Bot.count({ where: { owner_id: userId } });
    const maxBots = parseInt(process.env.MAX_BOTS_PER_USER) || 10;
    
    if (userBotCount >= maxBots) {
      errors.push(`You have reached the maximum limit of ${maxBots} bots`);
      suggestions.push('Delete some bots to create new ones');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
    botInfo
  };
}

/**
 * Validate Telegram username
 */
function validateUsername(username) {
  if (!username) return { valid: true }; // Username is optional
  
  if (typeof username !== 'string') {
    return { valid: false, error: 'Username must be a string' };
  }
  
  if (username.length < 5) {
    return { valid: false, error: 'Username must be at least 5 characters long' };
  }
  
  if (!username.match(/^[a-zA-Z0-9_]+$/)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  
  return { valid: true };
}

/**
 * Validate user ID
 */
function validateUserId(userId) {
  if (!userId || typeof userId !== 'number') {
    return { valid: false, error: 'User ID must be a number' };
  }
  
  if (userId.toString().length < 5) {
    return { valid: false, error: 'Invalid user ID' };
  }
  
  return { valid: true };
}

/**
 * Sanitize broadcast message
 */
function sanitizeMessage(text) {
  if (typeof text !== 'string') return '';
  
  // Remove potentially dangerous characters but keep most formatting
  return text
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .trim();
}

/**
 * Quick token format check (without API calls)
 */
function quickTokenCheck(token) {
  return validateTokenFormat(token);
}

module.exports = {
  validateBotName,
  validateBotToken,
  validateTokenFormat,
  isTokenUnique,
  validateWithTelegram,
  validateUsername,
  validateUserId,
  sanitizeMessage,
  quickTokenCheck
};