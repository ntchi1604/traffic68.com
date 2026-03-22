const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'traffic68',
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
      multipleStatements: true,
    });
  }
  return pool;
}

async function initDb() {
  const p = getPool();

  // Disable FK checks, run full schema, re-enable FK checks
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const fullSql = `SET FOREIGN_KEY_CHECKS = 0;\n${schema}\nSET FOREIGN_KEY_CHECKS = 1;`;

  try {
    const conn = await p.getConnection();
    await conn.query(fullSql);
    conn.release();
    console.log('✅ MySQL database initialized (bulk)');
  } catch (err) {
    // If bulk fails, try one by one
    console.log('⚠️ Bulk schema failed, trying individual statements...');
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    const conn = await p.getConnection();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
        const m = stmt.match(/CREATE TABLE IF NOT EXISTS\s+`?(\w+)`?/i);
        if (m) console.log(`  ✅ Table ready: ${m[1]}`);
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.error(`  ❌ Schema error [${stmt.substring(0, 60).trim()}...]: ${e.message}`);
        }
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    conn.release();
    console.log('✅ MySQL database initialized (individual)');
  }

  // Auto-migrations for existing databases
  try {
    const p2 = getPool();
    await p2.execute("ALTER TABLE notifications ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'all' AFTER type").catch(() => {});
  } catch (_) {}
}


module.exports = { getPool, initDb };
