// config/railway-env.js - Railway Environment Variable Loader
const fs = require('fs');
const path = require('path');

class RailwayEnvLoader {
  constructor() {
    this.loaded = false;
    this.variables = {};
  }

  load() {
    if (this.loaded) return this.variables;

    console.log('🔧 Loading Railway environment variables...');
    
    // Method 1: Direct process.env (Railway runtime variables)
    this.loadFromProcessEnv();
    
    // Method 2: Check for Railway static build variables
    this.loadFromBuildEnv();
    
    // Method 3: Check for common Railway variable patterns
    this.loadFromCommonPatterns();
    
    // Method 4: Final validation
    this.validateRequiredVariables();
    
    this.loaded = true;
    return this.variables;
  }

  loadFromProcessEnv() {
    const required = ['BOT_TOKEN', 'ENCRYPTION_KEY', 'DATABASE_URL'];
    
    required.forEach(key => {
      if (process.env[key]) {
        this.variables[key] = process.env[key];
        console.log(`   ✅ ${key}: Loaded from process.env (${process.env[key].length} chars)`);
      } else {
        console.log(`   ❌ ${key}: Missing from process.env`);
      }
    });
  }

  loadFromBuildEnv() {
    // Railway sometimes injects variables during build phase
    const buildVars = [
      'RAILWAY_BOT_TOKEN',
      'RAILWAY_ENCRYPTION_KEY', 
      'RAILWAY_DATABASE_URL',
      'VITE_BOT_TOKEN',
      'NEXT_PUBLIC_BOT_TOKEN'
    ];

    buildVars.forEach(buildVar => {
      if (process.env[buildVar]) {
        const standardKey = buildVar.replace(/^(RAILWAY_|VITE_|NEXT_PUBLIC_)/, '');
        this.variables[standardKey] = process.env[buildVar];
        console.log(`   🔄 ${standardKey}: Loaded from ${buildVar}`);
      }
    });
  }

  loadFromCommonPatterns() {
    // Check for case variations and common naming patterns
    const patterns = {
      'BOT_TOKEN': ['BOT_TOKEN', 'bot_token', 'BOT_TOKEN', 'TELEGRAM_BOT_TOKEN'],
      'ENCRYPTION_KEY': ['ENCRYPTION_KEY', 'encryption_key', 'ENCRYPTION_KEY', 'SECRET_KEY'],
      'DATABASE_URL': ['DATABASE_URL', 'database_url', 'DATABASE_URL', 'DB_URL']
    };

    Object.entries(patterns).forEach(([standardKey, variations]) => {
      variations.forEach(variation => {
        if (process.env[variation] && !this.variables[standardKey]) {
          this.variables[standardKey] = process.env[variation];
          console.log(`   🔄 ${standardKey}: Loaded from ${variation}`);
        }
      });
    });
  }

  validateRequiredVariables() {
    const required = ['BOT_TOKEN', 'ENCRYPTION_KEY', 'DATABASE_URL'];
    const missing = required.filter(key => !this.variables[key]);

    if (missing.length > 0) {
      console.error('❌ MISSING REQUIRED VARIABLES:', missing.join(', '));
      console.error('💡 Railway Configuration Issue:');
      console.error('   1. Go to Railway → your project → Variables');
      console.error('   2. Add these variables: BOT_TOKEN, ENCRYPTION_KEY');
      console.error('   3. DATABASE_URL should be auto-provided by PostgreSQL');
      console.error('   4. Make sure they are in the correct service (web service)');
      console.error('   5. Make sure they are in production environment');
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    console.log('✅ All required environment variables loaded successfully');
  }

  get(key) {
    return this.variables[key];
  }

  getAll() {
    return { ...this.variables };
  }
}

module.exports = new RailwayEnvLoader();