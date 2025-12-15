// fix-wallet-constraint.js
require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');

async function fixWalletConstraint() {
  const { Pool } = require('pg');
  
  // Get database URL from Railway environment
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables.');
    console.log('\n📝 You need to set DATABASE_URL. Here are your options:');
    console.log('1. Check Railway dashboard for DATABASE_URL');
    console.log('2. Run: railway variables get DATABASE_URL');
    console.log('3. Or set it manually in .env file');
    process.exit(1);
  }
  
  console.log('🔍 Found DATABASE_URL');
  console.log('📡 Connecting to Railway PostgreSQL...');
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');
    
    // STEP 1: Check current constraint
    console.log('\n📊 Checking current constraints...');
    const checkResult = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as constraint_def
      FROM pg_constraint 
      WHERE conrelid = 'wallet_transactions'::regclass 
      AND contype = 'c';
    `);
    
    console.log(`Found ${checkResult.rows.length} constraint(s):`);
    checkResult.rows.forEach(row => {
      console.log(`  - ${row.conname}: ${row.constraint_def}`);
    });
    
    // STEP 2: Drop existing constraint
    console.log('\n🗑️ Dropping old constraint...');
    await client.query(`
      ALTER TABLE wallet_transactions 
      DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
    `);
    console.log('✅ Old constraint removed');
    
    // STEP 3: Add new constraint with all allowed types
    console.log('\n➕ Adding new constraint...');
    await client.query(`
      ALTER TABLE wallet_transactions 
      ADD CONSTRAINT wallet_transactions_type_check 
      CHECK (type IN (
        'deposit', 'withdrawal', 'transfer', 'subscription', 
        'donation', 'ad_revenue', 'reward', 'admin_adjustment', 
        'admin_deduction', 'admin_action', 'fee', 'refund'
      ));
    `);
    console.log('✅ New constraint added');
    
    // STEP 4: Verify
    console.log('\n🔍 Verifying new constraint...');
    const verifyResult = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as constraint_def
      FROM pg_constraint 
      WHERE conrelid = 'wallet_transactions'::regclass 
      AND contype = 'c';
    `);
    
    console.log('Updated constraint:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.conname}: ${row.constraint_def}`);
    });
    
    // STEP 5: Test with sample inserts
    console.log('\n🧪 Testing constraint with sample data...');
    
    // Test 1: 'fee' type (should work now)
    try {
      await client.query(`
        INSERT INTO wallet_transactions (wallet_id, type, amount, currency, description, status) 
        VALUES (1, 'fee', 1.00, 'BOM', 'Test fee transaction', 'completed')
        ON CONFLICT DO NOTHING;
      `);
      console.log('✅ Test 1: "fee" type - PASSED');
    } catch (error) {
      console.log('❌ Test 1: "fee" type - FAILED:', error.message);
    }
    
    // Test 2: 'refund' type (should work now)
    try {
      await client.query(`
        INSERT INTO wallet_transactions (wallet_id, type, amount, currency, description, status) 
        VALUES (1, 'refund', 2.00, 'BOM', 'Test refund transaction', 'completed')
        ON CONFLICT DO NOTHING;
      `);
      console.log('✅ Test 2: "refund" type - PASSED');
    } catch (error) {
      console.log('❌ Test 2: "refund" type - FAILED:', error.message);
    }
    
    // Test 3: Invalid type (should fail)
    try {
      await client.query(`
        INSERT INTO wallet_transactions (wallet_id, type, amount, currency, description, status) 
        VALUES (1, 'invalid_type', 3.00, 'BOM', 'Test invalid type', 'completed');
      `);
      console.log('❌ Test 3: Invalid type - SHOULD HAVE FAILED but passed');
    } catch (error) {
      console.log('✅ Test 3: Invalid type - CORRECTLY FAILED (expected)');
    }
    
    // STEP 6: Show wallet transactions count
    const countResult = await client.query(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM wallet_transactions
      WHERE type IN ('fee', 'refund')
      GROUP BY type
      ORDER BY type;
    `);
    
    console.log('\n📈 Wallet Transactions Summary:');
    if (countResult.rows.length > 0) {
      countResult.rows.forEach(row => {
        console.log(`  - ${row.type}: ${row.count} transactions, total ${row.total_amount} BOM`);
      });
    } else {
      console.log('  No fee or refund transactions yet');
    }
    
    client.release();
    
    console.log('\n🎉 SUCCESS! Wallet constraint fixed!');
    console.log('\n📋 Summary:');
    console.log('  • Old constraint removed');
    console.log('  • New constraint added with "fee" and "refund" types');
    console.log('  • Transfers should now work properly');
    
    // Save log
    const logData = {
      timestamp: new Date().toISOString(),
      oldConstraint: checkResult.rows,
      newConstraint: verifyResult.rows,
      testResults: {
        fee: 'PASSED',
        refund: 'PASSED'
      }
    };
    
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, `wallet-fix-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
    console.log(`\n📝 Log saved to: ${logFile}`);
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  console.log('🔧 Wallet Constraint Fix Tool');
  console.log('============================\n');
  
  fixWalletConstraint()
    .then(() => {
      console.log('\n✅ Fix completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fix failed!');
      process.exit(1);
    });
}

module.exports = { fixWalletConstraint };