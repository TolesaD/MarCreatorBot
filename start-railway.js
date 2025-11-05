// start-railway.js  ← RAILWAY’S FAVORITE FILE
console.log('MarCreatorBot — RAILWAY STARTUP');
console.log('=====================================');

// 1. FORCE LOAD ENV VARS
require('dotenv').config();

// 2. DEBUG: SHOW WHAT RAILWAY GAVE US
const debug = (key) => {
  const val = process.env[key];
  console.log(`   ${key}: ${val ? 'SET (' + val.length + ' chars)' : 'MISSING'}`);
};
debug('BOT_TOKEN');
debug('DATABASE_URL');
debug('ENCRYPTION_KEY');
debug('RAILWAY_ENVIRONMENT');

// 3. REQUIRED IN PRODUCTION
if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN IS MISSING');
  console.log('Go to Variables → + New Variable');
  console.log('Key: BOT_TOKEN');
  console.log('Value: 123456789:AAH... (your real token)');
  console.log('Network: Private');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL IS MISSING');
  console.log('Click + Reference → Pick your Postgres → DATABASE_URL');
  process.exit(1);
}

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  console.error('ENCRYPTION_KEY too short');
  console.log('Use 32+ random chars');
  process.exit(1);
}

// 4. ALL GOOD → START REAL APP
console.log('ALL VARIABLES OK → STARTING BOT');
require('./src/app.js');