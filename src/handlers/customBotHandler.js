// src/handlers/customBotHandler.js
const { CustomCommand, BotTemplate } = require('../models');
const VisualFlowBuilder = require('../services/VisualFlowBuilder');

class CustomBotHandler {
  constructor() {
    this.flowBuilder = new VisualFlowBuilder();
  }
  
  async showBotCreationPathways(ctx) {
    const message = `🤖 *Choose Your Bot Creation Method*\n\n` +
      `*1. Standard Bot* (Recommended for beginners)\n` +
      `• Simple message forwarding\n` +
      `• Admin team management\n` +
      `• Broadcast messages\n` +
      `• Perfect for customer support\n\n` +
      `*2. Custom Command Bot* (Advanced)\n` +
      `• Visual drag-and-drop builder\n` +
      `• Create interactive flows\n` +
      `• Educational bots, quizzes, forms\n` +
      `• No coding required`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { 
            text: 'ℹ️ About Standard Bot', 
            callback_data: 'pathway_info_standard' 
          },
          { 
            text: 'ℹ️ About Custom Bot', 
            callback_data: 'pathway_info_custom' 
          }
        ],
        [
          { 
            text: '🚀 Create Standard Bot', 
            callback_data: 'create_standard_bot' 
          },
          { 
            text: '🎨 Create Custom Bot', 
            callback_data: 'create_custom_bot' 
          }
        ]
      ]
    };
    
    await ctx.replyWithMarkdown(message, { reply_markup: keyboard });
  }
  
  async handlePathwayInfo(ctx, pathwayType) {
    let message = '';
    
    if (pathwayType === 'standard') {
      message = `📋 *Standard Bot - Perfect for Communication*\n\n` +
        `*Ideal for:*\n` +
        `• Customer support teams\n` +
        `• Community managers\n` +
        `• Small businesses\n` +
        `• Basic announcement bots\n\n` +
        `*Features:*\n` +
        `✅ Real-time message forwarding\n` +
        `✅ Multiple admin support\n` +
        `✅ Broadcast to all users\n` +
        `✅ Media sharing (images, videos, files)\n` +
        `✅ User statistics and analytics\n\n` +
        `*Quick Setup:* Just provide your bot token and you're ready!`;
    } else {
      message = `🎨 *Custom Command Bot - Build Anything*\n\n` +
        `*Ideal for:*\n` +
        `• Educators and teachers\n` +
        `• Quiz and survey creators\n` +
        `• Interactive content makers\n` +
        `• Automated workflows\n\n` +
        `*Features:*\n` +
        `🧩 Visual drag-and-drop builder\n` +
        `📚 Pre-built templates\n` +
        `🔀 Conditional logic (IF/THEN)\n` +
        `💾 User data collection\n` +
        `🎯 Interactive buttons and menus\n` +
        `📊 Form and survey builder\n\n` +
        `*Examples:* Student registration, interactive quizzes, feedback forms, and more!`;
    }
    
    const keyboard = {
      inline_keyboard: [[
        { 
          text: `🎯 Create ${pathwayType === 'standard' ? 'Standard' : 'Custom'} Bot`, 
          callback_data: `create_${pathway_type}_bot` 
        },
        { 
          text: '🔙 Back to Choices', 
          callback_data: 'back_to_pathways' 
        }
      ]]
    };
    
    await ctx.editMessageText(message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
  }
  
  async startCustomBotCreation(ctx) {
    // Show template selection or blank canvas
    await this.showTemplateSelection(ctx);
  }
  
  async showTemplateSelection(ctx) {
    const templates = await BotTemplate.findAll({
      where: { is_premium: false },
      limit: 6
    });
    
    let message = `📚 *Choose a Starting Point*\n\n` +
      `Select a template or start from scratch:\n\n` +
      `*Categories:*\n` +
      `🎓 Education • 🎯 Engagement • 📊 Forms • 🎮 Fun`;
    
    const keyboardButtons = [];
    
    // Add template buttons (2 per row)
    templates.forEach((template, index) => {
      if (index % 2 === 0) {
        keyboardButtons.push([]);
      }
      keyboardButtons[keyboardButtons.length - 1].push({
        text: template.name,
        callback_data: `use_template_${template.id}`
      });
    });
    
    // Add action buttons
    keyboardButtons.push([
      { text: '🆕 Start from Scratch', callback_data: 'start_blank_flow' },
      { text: '🔙 Back', callback_data: 'back_to_pathways' }
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboardButtons }
    });
  }
}