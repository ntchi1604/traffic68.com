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
      connectionLimit: 30,      // tăng từ 20 → 30
      queueLimit: 200,          // tăng từ 50 → 200 để tránh Queue limit reached
      charset: 'utf8mb4',
      multipleStatements: true,
      timezone: '+07:00',
    });

    // Force MySQL session timezone to VN for every connection
    // This ensures NOW(), CURDATE() always return Vietnam time
    const rawPool = pool.pool || pool;
    if (rawPool.on) {
      rawPool.on('connection', (conn) => {
        conn.query("SET time_zone = '+07:00'");
      });
    }
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
    await p2.execute("ALTER TABLE notifications ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'all' AFTER type").catch(() => { });
    await p2.execute("ALTER TABLE campaigns ADD COLUMN keyword_config TEXT DEFAULT NULL AFTER keyword").catch(() => { });
    await p2.execute("ALTER TABLE campaigns MODIFY COLUMN keyword TEXT DEFAULT NULL").catch(() => { });
    await p2.execute("ALTER TABLE campaigns ADD COLUMN priority TINYINT DEFAULT NULL AFTER discount_applied").catch(() => { });
    await p2.execute("ALTER TABLE campaigns ADD COLUMN bonus_mode TINYINT(1) NOT NULL DEFAULT 0 AFTER priority").catch(() => { });
    await p2.execute("ALTER TABLE users ADD COLUMN withdraw_wallet JSON DEFAULT NULL").catch(() => { });
    await p2.execute("ALTER TABLE users ADD COLUMN bonus_mode TINYINT(1) NOT NULL DEFAULT 1").catch(() => { });
    await p2.execute("ALTER TABLE users ADD COLUMN password_changed_at DATETIME NULL DEFAULT NULL").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD COLUMN is_over_limit TINYINT(1) NOT NULL DEFAULT 0").catch(() => { });

    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_completed_at (completed_at)").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_camp_completed_status (campaign_id, completed_at, status, bot_detected)").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_ip_completed_status (ip_address(50), completed_at, status, bot_detected)").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_vid_completed_status (visitor_id(50), completed_at, status, bot_detected)").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_kw_camp_completed (campaign_id, keyword, completed_at, status, bot_detected)").catch(() => { });
    // ── Index bổ sung cho queries worker_id, worker_link_id, created_at, is_over_limit ──
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_worker_completed (worker_id, completed_at, status, bot_detected, is_over_limit)").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_wlink_completed (worker_link_id, completed_at, status, bot_detected, is_over_limit)").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_created_at (created_at)").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_status_bot_limit (status, bot_detected, is_over_limit)").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_ip_created (ip_address(50), created_at)").catch(() => { });

    // ── Index cho campaigns (dùng trong mọi dashboard API) ──
    await p2.execute("ALTER TABLE campaigns ADD INDEX idx_user_status (user_id, status)").catch(() => { });
    await p2.execute("ALTER TABLE campaigns ADD INDEX idx_status (status)").catch(() => { });

    // ── Index cho traffic_logs ──
    await p2.execute("ALTER TABLE traffic_logs ADD INDEX idx_camp_date (campaign_id, date)").catch(() => { });
    await p2.execute("ALTER TABLE traffic_logs ADD INDEX idx_date (date)").catch(() => { });

    // ── Index cho transactions ──
    await p2.execute("ALTER TABLE transactions ADD INDEX idx_user_type_status (user_id, wallet_type, type, status)").catch(() => { });
    await p2.execute("ALTER TABLE transactions ADD INDEX idx_user_created (user_id, created_at)").catch(() => { });
    await p2.execute("ALTER TABLE transactions ADD INDEX idx_created_at (created_at)").catch(() => { });

    // ── Index cho notifications ──
    await p2.execute("ALTER TABLE notifications ADD INDEX idx_user_read (user_id, is_read)").catch(() => { });
    await p2.execute("ALTER TABLE notifications ADD INDEX idx_created_at (created_at)").catch(() => { });

    // ── Index cho security_logs ──
    await p2.execute("ALTER TABLE security_logs ADD INDEX idx_ip_created (ip_address, created_at)").catch(() => { });
    await p2.execute("ALTER TABLE security_logs ADD INDEX idx_created_at (created_at)").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_worker_security_page (worker_id, created_at, bot_detected, ip_address(45), visitor_id(100))").catch(() => { });
    await p2.execute("ALTER TABLE vuot_link_tasks ADD INDEX idx_wlink_security_page (worker_link_id, created_at, bot_detected, ip_address(45), visitor_id(100))").catch(() => { });
    await p2.execute("ALTER TABLE security_logs ADD INDEX idx_security_pair_date_reason (ip_address, visitor_id, created_at, reason)").catch(() => { });
  } catch (_) { };
}


module.exports = { getPool, initDb };
