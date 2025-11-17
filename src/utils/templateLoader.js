// src/utils/templateLoader.js
class TemplateLoader {
  static getTemplates() {
    return {
      // Educational Templates
      student_registration: {
        name: "Student Registration",
        category: "education",
        description: "Collect student information and course preferences",
        flow: {
          startNode: "welcome",
          nodes: {
            welcome: {
              type: "send_message",
              config: {
                text: "🎓 Welcome to Student Registration!\n\nPlease provide your information to get started.",
                buttons: [{ text: "Start Registration" }]
              },
              connections: { next: "ask_name" }
            },
            ask_name: {
              type: "ask_question", 
              config: {
                question: "What is your full name?",
                input_type: "text"
              },
              connections: { answer: "ask_email" }
            },
            ask_email: {
              type: "ask_question",
              config: {
                question: "What is your email address?",
                input_type: "email"
              },
              connections: { answer: "ask_course" }
            },
            ask_course: {
              type: "send_message",
              config: {
                text: "Which course are you interested in?",
                buttons: [
                  { text: "Mathematics" }, 
                  { text: "Science" },
                  { text: "Literature" }
                ]
              },
              connections: { next: "confirmation" }
            },
            confirmation: {
              type: "send_message", 
              config: {
                text: "✅ Registration Complete!\n\nThank you for registering. We'll contact you soon with course details."
              },
              connections: { next: "end" }
            }
          }
        }
      },
      
      interactive_quiz: {
        name: "Interactive Quiz",
        category: "education", 
        description: "Multiple-choice quiz with scoring",
        flow: { /* Quiz flow structure */ }
      },
      
      feedback_survey: {
        name: "Feedback Survey", 
        category: "education",
        description: "Collect detailed feedback with various question types",
        flow: { /* Survey flow structure */ }
      }
    };
  }
}