const User = require('../models/User');

/**
 * Middleware to ensure user exists in database
 */
async function ensureUser(ctx, next) {
  try {
    const { id, username, first_name, last_name, language_code } = ctx.from;
    
    if (!id) {
      return await ctx.reply('❌ User identification failed.');
    }
    
    // Save/update user in database
    await User.upsert({
      telegram_id: id,
      username: username,
      first_name: first_name,
      last_name: last_name,
      language_code: language_code,
      last_active: new Date()
    });
    
    return next();
  } catch (error) {
    console.error('Ensure user middleware error:', error);
    return await ctx.reply('❌ Authentication error. Please try again.');
  }
}

/**
 * Middleware to check if user is main bot admin
 */
async function requireMainBotAdmin(ctx, next) {
  try {
    const userId = ctx.from.id;
    
    const user = await User.findOne({ where: { telegram_id: userId } });
    
    if (!user || !user.is_main_bot_admin) {
      await ctx.reply('❌ This command is only available for bot administrators.');
      return;
    }
    
    return next();
  } catch (error) {
    console.error('Main bot admin middleware error:', error);
    await ctx.reply('❌ Authorization error.');
  }
}

module.exports = { ensureUser, requireMainBotAdmin };