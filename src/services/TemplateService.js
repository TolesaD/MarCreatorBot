// 📁 src/services/TemplateService.js
class TemplateService {
  constructor() {
    this.templates = this.initializeTemplates();
  }

  initializeTemplates() {
    return {
      // Educational & Academic Templates
      'student_registration': {
        id: 'student_registration',
        name: 'Student Registration',
        category: 'educational',
        description: 'Collect student information and documents for enrollment',
        difficulty: 'beginner',
        icon: '👨‍🎓',
        flow: {
          steps: [
            {
              type: 'send_message',
              content: '👋 Welcome to Student Registration!\n\nPlease provide your full name:'
            },
            {
              type: 'ask_question',
              question: 'Full Name:',
              input_type: 'text',
              variable_name: 'student_name',
              next_step: 2
            },
            {
              type: 'ask_question',
              question: '📧 Email address:',
              input_type: 'email',
              variable_name: 'student_email',
              next_step: 3
            },
            {
              type: 'ask_question',
              question: '📞 Phone number:',
              input_type: 'phone',
              variable_name: 'student_phone',
              next_step: 4
            },
            {
              type: 'send_message',
              content: '✅ Registration complete! Welcome {student_name}. You will receive confirmation at {student_email}.'
            }
          ]
        }
      },
      'quiz_bot': {
        id: 'quiz_bot',
        name: 'Quiz Bot with Scoring',
        category: 'educational',
        description: 'Multi-question quiz with automatic scoring system',
        difficulty: 'intermediate',
        icon: '🎯',
        flow: {
          steps: [
            {
              type: 'set_variable',
              variable_name: 'score',
              value: 0
            },
            {
              type: 'send_message',
              content: '🎯 Welcome to the Quiz! You will be asked multiple questions. Let\'s begin!'
            },
            // Question 1
            {
              type: 'ask_question',
              question: 'Question 1: What is 2 + 2?\n\nA) 3\nB) 4\nC) 5',
              input_type: 'text',
              variable_name: 'answer1',
              validation: { allowed_values: ['A', 'B', 'C', 'a', 'b', 'c'] }
            },
            {
              type: 'conditional',
              condition: '{answer1} == "B" || {answer1} == "b"',
              then_branch: [
                {
                  type: 'set_variable',
                  variable_name: 'score',
                  value: '{score} + 1'
                },
                {
                  type: 'send_message',
                  content: '✅ Correct! +1 point'
                }
              ],
              else_branch: [
                {
                  type: 'send_message',
                  content: '❌ Incorrect. The answer was B) 4'
                }
              ]
            },
            {
              type: 'send_message',
              content: '🏁 Quiz complete! Your final score: {score} points'
            }
          ]
        }
      },
      'tutoring_request': {
        id: 'tutoring_request',
        name: 'Tutoring Session Request',
        category: 'educational',
        description: 'Collect tutoring request details and schedule sessions',
        difficulty: 'beginner',
        icon: '📚',
        flow: {
          steps: [
            {
              type: 'send_message',
              content: '📚 Tutoring Session Request\n\nPlease select subject:'
            },
            {
              type: 'ask_question',
              question: 'Subject:\n\n- Math\n- Science\n- English\n- History\n- Other',
              input_type: 'text',
              variable_name: 'subject'
            },
            {
              type: 'ask_question',
              question: 'Please describe what you need help with:',
              input_type: 'text',
              variable_name: 'problem_description'
            },
            {
              type: 'send_message',
              content: '✅ Request submitted!\n\nSubject: {subject}\nDescription: {problem_description}\n\nWe will contact you soon!'
            }
          ]
        }
      },
      'course_feedback': {
        id: 'course_feedback',
        name: 'Course Feedback Survey',
        category: 'educational',
        description: 'Collect structured feedback about courses or workshops',
        difficulty: 'beginner',
        icon: '📝',
        flow: {
          steps: [
            {
              type: 'send_message',
              content: '📝 Course Feedback Survey\n\nThank you for participating! Please rate your experience.'
            },
            {
              type: 'ask_question',
              question: 'Overall rating (1-5 stars):\n⭐️⭐️⭐️⭐️⭐️',
              input_type: 'text',
              variable_name: 'rating',
              validation: { allowed_values: ['1', '2', '3', '4', '5'] }
            },
            {
              type: 'ask_question',
              question: 'What did you like most about the course?',
              input_type: 'text',
              variable_name: 'likes'
            },
            {
              type: 'ask_question',
              question: 'Any suggestions for improvement?',
              input_type: 'text',
              variable_name: 'suggestions'
            },
            {
              type: 'send_message',
              content: '✅ Thank you for your valuable feedback!'
            }
          ]
        }
      },

      // General Engagement Templates
      'interactive_poll': {
        id: 'interactive_poll',
        name: 'Interactive Poll',
        category: 'engagement',
        description: 'Create polls with multiple options and track responses',
        difficulty: 'beginner',
        icon: '📊',
        flow: {
          steps: [
            {
              type: 'send_message',
              content: '📊 Interactive Poll\n\nWhat\'s your favorite programming language?'
            },
            {
              type: 'ask_question',
              question: 'Choose one:\n\nA) JavaScript\nB) Python\nC) Java\nD) Other',
              input_type: 'text',
              variable_name: 'poll_answer',
              validation: { allowed_values: ['A', 'B', 'C', 'D', 'a', 'b', 'c', 'd'] }
            },
            {
              type: 'send_message',
              content: '✅ Thank you for voting! Your choice: {poll_answer}'
            }
          ]
        }
      },
      'feedback_collector': {
        id: 'feedback_collector',
        name: 'Feedback Collector',
        category: 'engagement',
        description: 'Collect structured feedback with multiple question types',
        difficulty: 'beginner',
        icon: '💬',
        flow: {
          steps: [
            {
              type: 'send_message',
              content: '💬 Feedback Collector\n\nWe value your opinion! Please share your feedback.'
            },
            {
              type: 'ask_question',
              question: 'How satisfied are you with our service? (1-5)',
              input_type: 'number',
              variable_name: 'satisfaction',
              validation: { min: 1, max: 5 }
            },
            {
              type: 'ask_question',
              question: 'Any additional comments?',
              input_type: 'text',
              variable_name: 'comments'
            },
            {
              type: 'send_message',
              content: '✅ Thank you for your feedback! We appreciate your input.'
            }
          ]
        }
      },
      'event_registration': {
        id: 'event_registration',
        name: 'Event Registration',
        category: 'engagement',
        description: 'Register users for events and collect attendee information',
        difficulty: 'beginner',
        icon: '🎫',
        flow: {
          steps: [
            {
              type: 'send_message',
              content: '🎫 Event Registration\n\nPlease register for our upcoming event!'
            },
            {
              type: 'ask_question',
              question: 'Full Name:',
              input_type: 'text',
              variable_name: 'attendee_name'
            },
            {
              type: 'ask_question',
              question: 'Email for confirmation:',
              input_type: 'email',
              variable_name: 'attendee_email'
            },
            {
              type: 'send_message',
              content: '✅ Registration confirmed! See you at the event, {attendee_name}!'
            }
          ]
        }
      },
      'welcome_series': {
        id: 'welcome_series',
        name: 'Welcome Series',
        category: 'engagement',
        description: 'Multi-step welcome sequence for new users',
        difficulty: 'intermediate',
        icon: '👋',
        flow: {
          steps: [
            {
              type: 'send_message',
              content: '👋 Welcome! Thanks for joining us.'
            },
            {
              type: 'wait',
              duration: 1,
              unit: 'hours'
            },
            {
              type: 'send_message',
              content: '📚 Here are some resources to get you started...'
            },
            {
              type: 'wait',
              duration: 24,
              unit: 'hours'
            },
            {
              type: 'send_message',
              content: '💡 Ready to explore more features?'
            }
          ]
        }
      }
    };
  }

  getTemplatesByCategory(category = null) {
    let templates = Object.values(this.templates);
    
    if (category) {
      templates = templates.filter(template => template.category === category);
    }
    
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  getTemplate(id) {
    return this.templates[id];
  }

  getCategories() {
    const categories = new Set();
    Object.values(this.templates).forEach(template => {
      categories.add(template.category);
    });
    return Array.from(categories);
  }

  getTemplatesForDisplay() {
    const categories = this.getCategories();
    const result = {};
    
    categories.forEach(category => {
      result[category] = this.getTemplatesByCategory(category).map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        difficulty: template.difficulty,
        icon: template.icon,
        stepCount: template.flow.steps.length
      }));
    });
    
    return result;
  }

  loadTemplateToFlow(templateId) {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    // Return a deep clone of the flow to prevent mutation
    return JSON.parse(JSON.stringify(template.flow));
  }

  validateTemplateFlow(flow) {
    const errors = [];
    
    if (!flow || !Array.isArray(flow.steps)) {
      errors.push('Flow must have a steps array');
      return errors;
    }
    
    if (flow.steps.length === 0) {
      errors.push('Flow must have at least one step');
    }
    
    // Basic validation for each step
    flow.steps.forEach((step, index) => {
      if (!step.type) {
        errors.push(`Step ${index + 1}: Missing type`);
      }
      
      if (step.type === 'send_message' && !step.content) {
        errors.push(`Step ${index + 1}: Send message step requires content`);
      }
      
      if (step.type === 'ask_question' && !step.question) {
        errors.push(`Step ${index + 1}: Ask question step requires question`);
      }
    });
    
    return errors;
  }

  getTemplateStats() {
    const templates = Object.values(this.templates);
    return {
      total: templates.length,
      byCategory: this.getCategories().reduce((acc, category) => {
        acc[category] = templates.filter(t => t.category === category).length;
        return acc;
      }, {}),
      byDifficulty: templates.reduce((acc, template) => {
        acc[template.difficulty] = (acc[template.difficulty] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

module.exports = TemplateService;