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
    console.log('✅ MySQL database initialized');
  } catch (err) {
    // If multipleStatements fails, try one by one
    console.log('⚠️ Bulk schema failed, trying individual statements...');
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    await p.execute('SET FOREIGN_KEY_CHECKS = 0');
    for (const stmt of statements) {
      try {
        await p.execute(stmt);
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.error('Schema error:', e.message.substring(0, 100));
        }
      }
    }
    await p.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ MySQL database initialized');
  }
}

module.exports = { getPool, initDb };
