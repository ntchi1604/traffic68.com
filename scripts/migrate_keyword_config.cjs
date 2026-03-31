/**
 * Migration: Add keyword_config column to campaigns table
 * Run on VPS: node scripts/migrate_keyword_config.cjs
 */
const mysql = require('mysql2/promise');
const path  = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

async function migrate() {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST || 'localhost',
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'traffic68',
  });

  console.log('🔗 Connecting to database...');

  // 1. Add keyword_config column
  try {
    await pool.execute('ALTER TABLE campaigns ADD COLUMN keyword_config TEXT DEFAULT NULL AFTER keyword');
    console.log('✅ Added column: keyword_config');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Column keyword_config already exists — skipping');
    } else {
      console.error('❌ Error adding keyword_config:', e.message);
    }
  }

  // 2. Expand keyword column from VARCHAR(255) to TEXT
  try {
    await pool.execute('ALTER TABLE campaigns MODIFY COLUMN keyword TEXT DEFAULT NULL');
    console.log('✅ Expanded keyword column to TEXT');
  } catch (e) {
    console.error('❌ Error expanding keyword column:', e.message);
  }

  // 3. verify
  const [cols] = await pool.execute("SHOW COLUMNS FROM campaigns LIKE 'keyword%'");
  console.log('\n📋 Current keyword columns:');
  cols.forEach(c => console.log(`   ${c.Field}: ${c.Type}`));

  await pool.end();
  console.log('\n✅ Migration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
