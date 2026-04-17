/**
 * db-cleanup.js — Chạy dọn dẹp DB định kỳ
 * PM2 ecosystem: pm2 start server/db/db-cleanup.js --name db-cleanup --cron "0 3 * * 0"
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const pool = await mysql.createConnection({
    host:     process.env.DB_HOST || '127.0.0.1',
    user:     process.env.DB_USER || 'traffic68',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'traffic68',
    multipleStatements: true,
  });

  const startAt = new Date().toISOString();
  console.log(`[DB Cleanup] Bắt đầu: ${startAt}`);

  const steps = [
    // 0. Expired tasks (visitor lấy task nhưng không làm)
    {
      label: 'Xóa tasks expired',
      sql: `DELETE FROM vuot_link_tasks WHERE status = 'expired'`,
    },
    // 0b. Cancelled tasks
    {
      label: 'Xóa tasks cancelled',
      sql: `DELETE FROM vuot_link_tasks WHERE status = 'cancelled'`,
    },
    // 1. Tasks pending/expired cũ > 3 ngày
    {
      label: 'Xóa tasks pending quá hạn > 3 ngày',
      sql: `DELETE FROM vuot_link_tasks
            WHERE status IN ('pending','step1','step2','step3')
              AND expires_at < DATE_SUB(NOW(), INTERVAL 3 DAY)`,
    },
    // 2. Bot tasks > 30 ngày
    {
      label: 'Xóa bot tasks > 30 ngày',
      sql: `DELETE FROM vuot_link_tasks
            WHERE status = 'completed' AND bot_detected = 1
              AND completed_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    },
    // 3. Tasks completed > 180 ngày
    {
      label: 'Xóa completed tasks > 6 tháng',
      sql: `DELETE FROM vuot_link_tasks
            WHERE status = 'completed' AND bot_detected = 0
              AND completed_at < DATE_SUB(NOW(), INTERVAL 180 DAY)`,
    },
    // 4. Security logs > 60 ngày
    {
      label: 'Xóa security_logs > 60 ngày',
      sql: `DELETE FROM security_logs
            WHERE created_at < DATE_SUB(NOW(), INTERVAL 60 DAY)`,
    },
    // 5. Notifications đã đọc > 30 ngày
    {
      label: 'Xóa notifications đã đọc > 30 ngày',
      sql: `DELETE FROM notifications
            WHERE is_read = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    },
    // 6. Notifications chưa đọc > 90 ngày
    {
      label: 'Xóa notifications cũ > 90 ngày',
      sql: `DELETE FROM notifications
            WHERE is_read = 0 AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)`,
    },
    // 7. Tasks của worker_links cũ > 30 ngày (xóa trước để tránh FK)
    {
      label: 'Xóa tasks của worker_links > 30 ngày',
      sql: `DELETE vt FROM vuot_link_tasks vt
            JOIN worker_links wl ON wl.id = vt.worker_link_id
            WHERE wl.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    },
    // 8. Worker links (liên kết rút gọn) tạo > 30 ngày
    {
      label: 'Xóa worker_links > 30 ngày',
      sql: `DELETE FROM worker_links
            WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    },
  ];

  let totalDeleted = 0;
  for (const step of steps) {
    try {
      const [result] = await pool.execute(step.sql);
      const n = result.affectedRows || 0;
      totalDeleted += n;
      console.log(`  ✅ ${step.label}: ${n} rows`);
    } catch (err) {
      console.error(`  ❌ ${step.label}: ${err.message}`);
    }
  }

  // OPTIMIZE chỉ khi xóa được nhiều (tránh lock bảng không cần thiết)
  if (totalDeleted > 1000) {
    console.log(`  🔧 OPTIMIZE TABLE (xóa ${totalDeleted} rows)...`);
    for (const tbl of ['vuot_link_tasks', 'security_logs', 'notifications', 'worker_links']) {
      try {
        await pool.query(`OPTIMIZE TABLE ${tbl}`);
        console.log(`  ✅ OPTIMIZE ${tbl} done`);
      } catch (e) {
        console.error(`  ❌ OPTIMIZE ${tbl}: ${e.message}`);
      }
    }
  }

  await pool.end();
  console.log(`[DB Cleanup] Hoàn thành. Tổng: ${totalDeleted} rows xóa.`);
  process.exit(0);
}

run().catch(err => {
  console.error('[DB Cleanup] FATAL:', err.message);
  process.exit(1);
});
