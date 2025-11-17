// 📁 src/handlers/messageEditHandler.js
const { MessageEditLog, BroadcastHistory, Feedback } = require('../models');

class MessageEditHandler {
  constructor(miniBotManager) {
    this.miniBotManager = miniBotManager;
  }

  async editMessage(ctx, messageType, messageId, newContent, reason = '') {
    try {
      let originalMessage, updateResult;

      switch (messageType) {
        case 'broadcast':
          originalMessage = await BroadcastHistory.findByPk(messageId);
          if (!originalMessage) throw new Error('Broadcast message not found');
          
          updateResult = await originalMessage.update({ 
            message: newContent 
          });
          break;

        case 'welcome':
          const bot = await Bot.findByPk(messageId);
          if (!bot) throw new Error('Bot not found');
          
          const originalWelcome = bot.welcome_message;
          updateResult = await bot.update({ 
            welcome_message: newContent 
          });
          originalMessage = { message: originalWelcome };
          break;

        case 'custom_command':
          const command = await CustomCommand.findByPk(messageId);
          if (!command) throw new Error('Custom command not found');
          
          // For custom commands, we might edit specific steps
          const flowData = command.flow_data;
          // Logic to find and update specific message in flow
          break;

        default:
          throw new Error('Unsupported message type');
      }

      // Log the edit
      await MessageEditLog.create({
        bot_id: ctx.botId,
        original_message_id: messageId,
        original_content: originalMessage.message,
        new_content: newContent,
        edited_by: ctx.from.id,
        edit_reason: reason
      });

      return { success: true, message: 'Message updated successfully' };
    } catch (error) {
      console.error('Message edit error:', error);
      return { success: false, error: error.message };
    }
  }

  async getMessageEditHistory(botId, messageType, messageId) {
    return await MessageEditLog.findAll({
      where: { 
        bot_id: botId,
        original_message_id: messageId
      },
      order: [['createdAt', 'DESC']],
      limit: 10
    });
  }
}

module.exports = MessageEditHandler;