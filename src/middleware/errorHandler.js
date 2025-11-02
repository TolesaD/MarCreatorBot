/**
 * Global error handler for the bot
 */
function errorHandler(bot) {
  bot.catch((err, ctx) => {
    console.error('Global bot error:', err);
    
    // Handle different types of errors
    if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') {
      console.error('Network error occurred, retrying might help...');
      return; // Don't send message for network errors
    }
    
    if (err.response && err.response.error_code === 400) {
      console.error('Telegram API error (400):', err.response.description);
      // Markdown parsing errors, etc.
    }
    
    // Try to send error message to user (but not for network errors)
    if (!err.code) { // Only for non-network errors
      try {
        ctx.reply('❌ An unexpected error occurred. Please try again later.');
      } catch (e) {
        console.error('Failed to send error message:', e);
      }
    }
  });
  
  // Process error handling
  process.on('unhandledRejection', (reason, promise) => {
    if (reason.code === 'ECONNRESET' || reason.code === 'ENOTFOUND') {
      console.log('Network error (unhandled rejection):', reason.code);
      return; // Ignore network errors
    }
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
  
  process.on('uncaughtException', (error) => {
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      console.log('Network error (uncaught exception):', error.code);
      return; // Ignore network errors
    }
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

module.exports = errorHandler;