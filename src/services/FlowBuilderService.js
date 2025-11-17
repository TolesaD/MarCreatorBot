// 📁 src/services/FlowBuilderService.js
class FlowBuilderService {
  constructor() {
    this.logicBlocks = this.initializeLogicBlocks();
  }

  initializeLogicBlocks() {
    return {
      // Core Interaction Blocks
      'send_message': {
        type: 'send_message',
        name: 'Send Message',
        category: 'core',
        inputs: [
          { name: 'content', type: 'text', required: true },
          { name: 'parse_mode', type: 'select', options: ['Markdown', 'HTML', 'Plain'] },
          { name: 'buttons', type: 'array', itemType: 'button' }
        ],
        outputs: ['success']
      },
      'ask_question': {
        type: 'ask_question',
        name: 'Ask Question',
        category: 'core',
        inputs: [
          { name: 'question', type: 'text', required: true },
          { name: 'input_type', type: 'select', options: ['text', 'number', 'email', 'phone', 'date'] },
          { name: 'validation', type: 'object' }
        ],
        outputs: ['user_input']
      },
      'conditional': {
        type: 'conditional',
        name: 'If/Then/Else',
        category: 'logic',
        inputs: [
          { name: 'condition', type: 'expression', required: true },
          { name: 'then_branch', type: 'flow' },
          { name: 'else_branch', type: 'flow' }
        ],
        outputs: ['then', 'else']
      },
      // Data Management Blocks
      'set_variable': {
        type: 'set_variable',
        name: 'Set Variable',
        category: 'data',
        inputs: [
          { name: 'variable_name', type: 'text', required: true },
          { name: 'value', type: 'any', required: true }
        ],
        outputs: ['success']
      },
      // Utility Blocks
      'randomizer': {
        type: 'randomizer',
        name: 'Random Choice',
        category: 'utility',
        inputs: [
          { name: 'options', type: 'array', required: true }
        ],
        outputs: ['selected_option']
      },
      'wait': {
        type: 'wait',
        name: 'Wait/Delay',
        category: 'utility',
        inputs: [
          { name: 'duration', type: 'number', required: true },
          { name: 'unit', type: 'select', options: ['seconds', 'minutes', 'hours'] }
        ],
        outputs: ['completed']
      }
    };
  }

  validateFlow(flowData) {
    const errors = [];
    
    if (!flowData.steps || !Array.isArray(flowData.steps)) {
      errors.push('Flow must have steps array');
      return errors;
    }

    flowData.steps.forEach((step, index) => {
      const blockConfig = this.logicBlocks[step.type];
      if (!blockConfig) {
        errors.push(`Step ${index + 1}: Unknown block type "${step.type}"`);
        return;
      }

      // Validate required inputs
      blockConfig.inputs.forEach(input => {
        if (input.required && !step[input.name]) {
          errors.push(`Step ${index + 1}: Missing required input "${input.name}"`);
        }
      });
    });

    return errors;
  }

  generateFlowPreview(flowData) {
    const preview = {
      stepCount: flowData.steps?.length || 0,
      estimatedTime: this.calculateEstimatedTime(flowData),
      variablesUsed: this.extractVariables(flowData),
      triggers: flowData.triggers || []
    };

    return preview;
  }

  calculateEstimatedTime(flowData) {
    let totalSeconds = 0;
    flowData.steps?.forEach(step => {
      if (step.type === 'wait') {
        const duration = step.duration || 0;
        const unit = step.unit || 'seconds';
        const multiplier = { seconds: 1, minutes: 60, hours: 3600 }[unit];
        totalSeconds += duration * multiplier;
      }
    });
    return totalSeconds;
  }

  extractVariables(flowData) {
    const variables = new Set();
    const variableRegex = /\{(\w+)\}/g;
    
    flowData.steps?.forEach(step => {
      Object.values(step).forEach(value => {
        if (typeof value === 'string') {
          let match;
          while ((match = variableRegex.exec(value)) !== null) {
            variables.add(match[1]);
          }
        }
      });
    });

    return Array.from(variables);
  }
}

module.exports = FlowBuilderService;