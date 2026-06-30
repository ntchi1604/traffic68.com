/**
 * Migration: Thêm indexes cho performance
 * Chạy 1 lần: node server/scripts/add-indexes.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const INDEXES = [
  // ── transactions ──
  { table: 'transactions', name: 'idx_tx_type_status_created', sql: 'ALTER TABLE transactions ADD INDEX idx_tx_type_status_created (type, status, created_at)' },
  { table: 'transactions', name: 'idx_tx_created_at',         sql: 'ALTER TABLE transactions ADD INDEX idx_tx_created_at (created_at)' },
  { table: 'transactions', name: 'idx_tx_user_id',            sql: 'ALTER TABLE transactions ADD INDEX idx_tx_user_id (user_id)' },

  // ── vuot_link_tasks ──
  { table: 'vuot_link_tasks', name: 'idx_vlt_worker_completed',   sql: 'ALTER TABLE vuot_link_tasks ADD INDEX idx_vlt_worker_completed (worker_id, status, completed_at)' },
  { table: 'vuot_link_tasks', name: 'idx_vlt_wl_completed',       sql: 'ALTER TABLE vuot_link_tasks ADD INDEX idx_vlt_wl_completed (worker_link_id, status, completed_at)' },
  { table: 'vuot_link_tasks', name: 'idx_vlt_campaign_status',    sql: 'ALTER TABLE vuot_link_tasks ADD INDEX idx_vlt_campaign_status (campaign_id, status, bot_detected)' },
  { table: 'vuot_link_tasks', name: 'idx_vlt_completed_at',       sql: 'ALTER TABLE vuot_link_tasks ADD INDEX idx_vlt_completed_at (completed_at)' },
  { table: 'vuot_link_tasks', name: 'idx_vlt_created_at',         sql: 'ALTER TABLE vuot_link_tasks ADD INDEX idx_vlt_created_at (created_at)' },

  // ── campaigns ──
  { table: 'campaigns', name: 'idx_camp_user_id',      sql: 'ALTER TABLE campaigns ADD INDEX idx_camp_user_id (user_id)' },
  { table: 'campaigns', name: 'idx_camp_status',        sql: 'ALTER TABLE campaigns ADD INDEX idx_camp_status (status)' },
  { table: 'campaigns', name: 'idx_camp_created_at',    sql: 'ALTER TABLE campaigns ADD INDEX idx_camp_created_at (created_at)' },

  // ── users ──
  { table: 'users', name: 'idx_users_created_at', sql: 'ALTER TABLE users ADD INDEX idx_users_created_at (created_at)' },
  { table: 'users', name: 'idx_users_role',       sql: 'ALTER TABLE users ADD INDEX idx_users_role (role)' },

  // ── support_tickets ──
  { table: 'support_tickets', name: 'idx_tickets_status', sql: 'ALTER TABLE support_tickets ADD INDEX idx_tickets_status (status)' },

  // ── wallets ──
  // (đã có UNIQUE KEY user_id+type, đủ cho query theo user_id)
];

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'traffic68',
    waitForConnections: true,
  });

  console.log(`\n🔧 Thêm indexes cho ${INDEXES.length} columns...\n`);

  let added = 0, skipped = 0, failed = 0;

  for (const idx of INDEXES) {
    try {
      await pool.execute(idx.sql);
      console.log(`  ✅ ${idx.table}.${idx.name}`);
      added++;
    } catch (err) {
      if (err.message.includes('Duplicate key name') || err.message.includes('already exists')) {
        console.log(`  ⏭️  ${idx.table}.${idx.name} — đã tồn tại`);
        skipped++;
      } else {
        console.log(`  ❌ ${idx.table}.${idx.name} — ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n📊 Kết quả: ${added} thêm mới, ${skipped} đã có, ${failed} lỗi\n`);

  // Verify indexes
  const tables = [...new Set(INDEXES.map(i => i.table))];
  for (const t of tables) {
    const [rows] = await pool.execute(`SHOW INDEX FROM \`${t}\``);
    console.log(`── ${t}: ${rows.length} indexes ──`);
    const idxNames = [...new Set(rows.map(r => r.Key_name))];
    idxNames.forEach(n => console.log(`   ${n}`));
    console.log();
  }

  await pool.end();
}

main().catch(err => { console.error('❌ Lỗi:', err.message); process.exit(1); });
