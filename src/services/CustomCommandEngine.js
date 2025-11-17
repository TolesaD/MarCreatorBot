// 📁 src/services/CustomCommandEngine.js
const { CustomCommand, CommandVariable, CommandExecution } = require('../models');

class CustomCommandEngine {
  constructor(miniBotManager) {
    this.miniBotManager = miniBotManager;
    this.userSessions = new Map();
  }

  async executeCommand(botId, userId, trigger, inputData = {}) {
    try {
      const command = await CustomCommand.findOne({
        where: { 
          bot_id: botId, 
          trigger: trigger,
          is_active: true 
        },
        include: [CommandVariable]
      });

      if (!command) return null;

      const flowData = command.flow_data;
      const context = {
        userId,
        botId,
        input: inputData,
        variables: await this.loadVariables(command.CommandVariables || []),
        step: 0
      };

      // Execute flow steps
      const result = await this.executeFlow(flowData, context);
      
      // Log execution
      await CommandExecution.create({
        command_id: command.id,
        user_id: userId,
        input_data: inputData,
        output_data: result,
        execution_time: result.executionTime,
        status: result.success ? 'completed' : 'failed'
      });

      // Update usage count
      await command.increment('usage_count');

      return result;
    } catch (error) {
      console.error('Command execution error:', error);
      return { success: false, error: error.message };
    }
  }

  async executeFlow(flowData, context) {
    const startTime = Date.now();
    const steps = flowData.steps || [];
    let currentStep = 0;
    let output = {};

    while (currentStep < steps.length) {
      const step = steps[currentStep];
      const stepResult = await this.executeStep(step, context);
      
      if (stepResult.break) break;
      if (stepResult.nextStep !== undefined) {
        currentStep = stepResult.nextStep;
      } else {
        currentStep++;
      }

      output = { ...output, ...stepResult.output };
    }

    return {
      success: true,
      output,
      executionTime: Date.now() - startTime
    };
  }

  async executeStep(step, context) {
    switch (step.type) {
      case 'send_message':
        return await this.executeSendMessage(step, context);
      case 'ask_question':
        return await this.executeAskQuestion(step, context);
      case 'conditional':
        return await this.executeConditional(step, context);
      case 'set_variable':
        return await this.executeSetVariable(step, context);
      case 'randomizer':
        return await this.executeRandomizer(step, context);
      case 'wait':
        return await this.executeWait(step, context);
      default:
        return { output: {} };
    }
  }

  async executeSendMessage(step, context) {
    const botInstance = this.miniBotManager.getBotInstanceByDbId(context.botId);
    if (!botInstance) throw new Error('Bot not active');

    const message = this.interpolateVariables(step.content, context.variables);
    
    await botInstance.telegram.sendMessage(context.userId, message, {
      parse_mode: step.parse_mode || 'Markdown',
      ...(step.buttons && this.formatButtons(step.buttons))
    });

    return { output: { lastMessage: message } };
  }

  async executeAskQuestion(step, context) {
    // Store user session for expected input
    this.userSessions.set(context.userId, {
      commandId: step.commandId,
      expectedInput: step.input_type,
      nextStep: step.next_step,
      validation: step.validation
    });

    const botInstance = this.miniBotManager.getBotInstanceByDbId(context.botId);
    const question = this.interpolateVariables(step.question, context.variables);
    
    await botInstance.telegram.sendMessage(context.userId, question, {
      parse_mode: 'Markdown'
    });

    return { output: { askedQuestion: question } };
  }

  // ... other step execution methods

  interpolateVariables(text, variables) {
    return text.replace(/\{(\w+)\}/g, (match, variableName) => {
      return variables[variableName]?.value || match;
    });
  }

  formatButtons(buttons) {
    return Markup.inlineKeyboard(
      buttons.map(btn => 
        Markup.button.callback(btn.text, btn.action)
      )
    );
  }

  async loadVariables(commandVariables) {
    const variables = {};
    commandVariables.forEach(v => {
      variables[v.name] = {
        value: v.value,
        type: v.type
      };
    });
    return variables;
  }
}

module.exports = CustomCommandEngine;