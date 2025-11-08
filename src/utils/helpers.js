const { Telegraf } = require('telegraf');
const { Bot, Admin, UserLog, Feedback, BroadcastHistory } = require('../models');

/**
 * Check if user owns any mini-bots
 */
async function userOwnsBots(userId) {
  try {
    const userBots = await Bot.count({
      where: { owner_id: userId }
    });
    return userBots > 0;
  } catch (error) {
    console.error('Error checking user bots:', error);
    return false;
  }
}

/**
 * Check if user is bot owner or platform creator
 */
async function isBotOwnerOrCreator(userId) {
  // Platform creator (you)
  if (userId === 1827785384) {
    return true;
  }
  
  // Check if user owns any bots
  return await userOwnsBots(userId);
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Escape MarkdownV2 special characters
 */
function escapeMarkdown(text) {
  if (typeof text !== 'string') return text;
  
  // First, escape all special characters for Markdown
  const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  let escapedText = text;
  
  specialChars.forEach(char => {
    escapedText = escapedText.split(char).join(`\\${char}`);
  });
  
  return escapedText;
}

/**
 * Quick bot token format validation (basic check only)
 * Note: Use validateBotToken from validators.js for comprehensive validation
 */
function isValidToken(token) {
  return token && token.match(/^\d+:[A-Za-z0-9_-]+$/);
}

/**
 * Generate unique bot ID
 */
function generateBotId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(4);
}

/**
 * Check if user has admin access to bot
 */
async function checkAdminAccess(userId, botId) {
  const bot = await Bot.findOne({ where: { bot_id: botId } });
  if (!bot) return { hasAccess: false, isOwner: false };
  
  if (bot.owner_id === userId) {
    return { hasAccess: true, isOwner: true, bot: bot };
  }
  
  const admin = await Admin.findOne({ 
    where: { 
      bot_id: bot.id, 
      admin_user_id: userId 
    } 
  });
  
  return { 
    hasAccess: !!admin, 
    isOwner: false, 
    bot: bot,
    permissions: admin ? admin.permissions : null 
  };
}

/**
 * Get bot statistics
 */
async function getBotStats(botId) {
  const userCount = await UserLog.count({ where: { bot_id: botId } });
  const feedbackCount = await Feedback.count({ where: { bot_id: botId } });
  const pendingFeedback = await Feedback.count({ 
    where: { 
      bot_id: botId, 
      is_replied: false 
    } 
  });
  
  const broadcastStats = await BroadcastHistory.findOne({
    where: { bot_id: botId },
    attributes: [
      [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total_broadcasts'],
      [require('sequelize').fn('SUM', require('sequelize').col('total_users')), 'total_recipients']
    ],
    raw: true
  });
  
  return {
    userCount,
    feedbackCount,
    pendingFeedback,
    totalBroadcasts: parseInt(broadcastStats?.total_broadcasts || 0),
    totalRecipients: parseInt(broadcastStats?.total_recipients || 0)
  };
}

/**
 * Format bot information for display
 */
function formatBotInfo(bot, stats = null) {
  const info = `🤖 *${bot.bot_name}*\n` +
    `🔗 @${bot.bot_username}\n` +
    `🆔 \`${bot.bot_id}\`\n` +
    `📊 Status: ${bot.is_active ? '🟢 Active' : '🔴 Inactive'}\n` +
    `📅 Created: ${new Date(bot.created_at).toLocaleDateString()}`;
  
  if (stats) {
    return info + `\n\n📈 *Statistics:*\n` +
      `👥 Users: ${formatNumber(stats.userCount)}\n` +
      `💬 Feedback: ${formatNumber(stats.feedbackCount)}\n` +
      `⏳ Pending: ${formatNumber(stats.pendingFeedback)}\n` +
      `📢 Broadcasts: ${formatNumber(stats.totalBroadcasts)}\n` +
      `📨 Recipients: ${formatNumber(stats.totalRecipients)}`;
  }
  
  return info;
}

/**
 * Check if user can perform admin action
 */
function canPerformAction(permissions, action) {
  if (!permissions) return false;
  
  const permissionMap = {
    'reply': 'can_reply',
    'broadcast': 'can_broadcast',
    'manage_admins': 'can_manage_admins',
    'view_stats': 'can_view_stats',
    'deactivate': 'can_deactivate',
    'edit_bot': 'can_edit_bot'
  };
  
  const permissionKey = permissionMap[action];
  return permissionKey ? permissions[permissionKey] : false;
}

/**
 * Validate user input for bot names and other fields
 */
function sanitizeInput(input, maxLength = 100) {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>{}[\]]/g, ''); // Remove potentially dangerous characters
}

/**
 * Create admin permissions object
 */
function createAdminPermissions(canReply = false, canBroadcast = false, canViewStats = false) {
  return {
    can_reply: canReply,
    can_broadcast: canBroadcast,
    can_manage_admins: false, // Only owners can manage admins
    can_view_stats: canViewStats,
    can_deactivate: false, // Only owners can deactivate
    can_edit_bot: false // Only owners can edit bot settings
  };
}

/**
 * Create owner permissions (full access)
 */
function createOwnerPermissions() {
  return {
    can_reply: true,
    can_broadcast: true,
    can_manage_admins: true,
    can_view_stats: true,
    can_deactivate: true,
    can_edit_bot: true
  };
}

module.exports = {
  userOwnsBots,
  isBotOwnerOrCreator,
  formatNumber,
  escapeMarkdown,
  isValidToken, // Keep for basic format checks only
  generateBotId,
  checkAdminAccess,
  getBotStats,
  formatBotInfo,
  canPerformAction,
  sanitizeInput,
  createAdminPermissions,
  createOwnerPermissions
};