// scripts/migrateCustomCommands.js
const { sequelize } = require('../src/models');

async function migrateCustomCommands() {
  try {
    console.log('🔄 Creating custom command tables...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "CustomCommands" (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER NOT NULL REFERENCES "Bots"(id),
        name VARCHAR(255) NOT NULL,
        trigger VARCHAR(255) NOT NULL,
        description TEXT,
        flow_data JSON NOT NULL,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_by BIGINT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "BotTemplates" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        flow_data JSON NOT NULL,
        is_premium BOOLEAN DEFAULT false,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('✅ Custom command tables created successfully');
    
    // Insert default templates
    await insertDefaultTemplates();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

async function insertDefaultTemplates() {
  const templates = [
    {
      name: "Student Registration",
      category: "education",
      description: "Collect student information for course enrollment",
      flow_data: TemplateLoader.getTemplates().student_registration,
      is_premium: false
    },
    {
      name: "Interactive Quiz", 
      category: "education",
      description: "Multiple-choice quiz with automatic scoring",
      flow_data: TemplateLoader.getTemplates().interactive_quiz,
      is_premium: false
    },
    {
      name: "Feedback Survey",
      category: "education", 
      description: "Collect detailed feedback with various question types",
      flow_data: TemplateLoader.getTemplates().feedback_survey,
      is_premium: false
    }
  ];
  
  for (const template of templates) {
    await sequelize.query(`
      INSERT INTO "BotTemplates" (name, category, description, flow_data, is_premium)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO NOTHING
    `, {
      bind: [template.name, template.category, template.description, template.flow_data, template.is_premium]
    });
  }
  
  console.log('✅ Default templates inserted');
}