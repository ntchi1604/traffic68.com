/**
 * db-cleanup.js — Dọn dẹp DB định kỳ, tối ưu cho data lớn (triệu rows+)
 *
 * Chạy qua PM2 mỗi Chủ nhật 3:00 sáng VN:
 *   pm2 start server/db/db-cleanup.js --name db-cleanup --cron "0 20 * * 6" --no-autorestart
 *   (UTC 20:00 Thứ 7 = 3:00 sáng VN Chủ nhật)
 *
 * Hoặc chạy thủ công:
 *   node server/db/db-cleanup.js
 *
 * Chiến lược tối ưu data lớn:
 *   - Batch delete: 5.000 rows/lần, tránh lock bảng quá lâu
 *   - Ngủ 200ms giữa mỗi batch: giảm tải I/O disk
 *   - Sync views_done theo batch: sửa drift giữa counter và thực tế
 *   - Archive traffic_logs > 12 tháng: giữ dữ liệu báo cáo dài hạn
 *   - ANALYZE TABLE: cập nhật stats cho query optimizer sau cleanup
 */

const mysql = require('mysql2/promise');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ── Config ──────────────────────────────────────────────────────────────────
const BATCH_SIZE   = 5000;   // rows mỗi lần DELETE — tránh lock quá lâu
const BATCH_SLEEP  = 200;    // ms ngủ giữa các batch
const OPTIMIZE_MIN = 500;    // tổng rows xóa tối thiểu để chạy OPTIMIZE

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Batch delete helper ──────────────────────────────────────────────────────
async function batchDelete(conn, label, sql, params = []) {
  let total = 0;
  while (true) {
    const [r] = await conn.execute(sql + ` LIMIT ${BATCH_SIZE}`, params);
    const n = r.affectedRows || 0;
    total += n;
    if (n > 0) process.stdout.write(`\r  ⏳ ${label}: ${total} rows...`);
    if (n < BATCH_SIZE) break;   // done
    await sleep(BATCH_SLEEP);    // yield I/O
  }
  console.log(`\r  ✅ ${label}: ${total} rows xóa`);
  return total;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || '127.0.0.1',
    user:     process.env.DB_USER || 'traffic68',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'traffic68',
  });

  const vnNow = new Date();
  const vnStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(vnNow);
  console.log(`\n[DB Cleanup] Bắt đầu: ${vnStr} (VN time)`);
  console.log(`[DB Cleanup] Batch size: ${BATCH_SIZE} rows/batch\n`);

  let totalDeleted = 0;

  // ════════════════════════════════════════════════════════════════════════════
  // 1. vuot_link_tasks — bảng lớn nhất, ưu tiên clean trước
  // ════════════════════════════════════════════════════════════════════════════

  // 1a. Tasks expired — lấy task nhưng không làm (không có earning)
  totalDeleted += await batchDelete(conn,
    'Tasks expired',
    `DELETE FROM vuot_link_tasks WHERE status = 'expired'`
  );

  // 1b. Tasks bị hủy
  totalDeleted += await batchDelete(conn,
    'Tasks cancelled',
    `DELETE FROM vuot_link_tasks WHERE status = 'cancelled'`
  );

  // 1c. Tasks pending/đang làm nhưng expires_at đã qua > 3 ngày
  //     (step1/step2/step3 = đang trong quy trình nhưng bị bỏ dở)
  totalDeleted += await batchDelete(conn,
    'Tasks pending quá hạn > 3 ngày',
    `DELETE FROM vuot_link_tasks
     WHERE status IN ('pending','step1','step2','step3')
       AND expires_at < DATE_SUB(NOW(), INTERVAL 3 DAY)`
  );

  // 1d. Bot tasks > 15 ngày (rút ngắn từ 30 → 15)
  //     Bot tasks chiếm nhiều dung lượng mà không có giá trị báo cáo dài hạn
  totalDeleted += await batchDelete(conn,
    'Bot tasks > 15 ngày',
    `DELETE FROM vuot_link_tasks
     WHERE bot_detected = 1
       AND created_at < DATE_SUB(NOW(), INTERVAL 15 DAY)`
  );

  // 1e. is_over_limit tasks > 30 ngày (vượt giới hạn IP/ngày, không có earning)
  totalDeleted += await batchDelete(conn,
    'Over-limit tasks > 30 ngày',
    `DELETE FROM vuot_link_tasks
     WHERE is_over_limit = 1
       AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
  );

  // 1f. Completed tasks > 6 tháng (hợp lệ) — xóa sau khi đã vào traffic_logs
  //     traffic_logs giữ aggregated data nên detail tasks không cần thiết lâu dài
  totalDeleted += await batchDelete(conn,
    'Completed tasks hợp lệ > 6 tháng',
    `DELETE FROM vuot_link_tasks
     WHERE status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
       AND completed_at < DATE_SUB(NOW(), INTERVAL 180 DAY)`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 2. worker_links — link rút gọn của worker (tạo nhiều, hết hạn nhanh)
  // ════════════════════════════════════════════════════════════════════════════

  // 2a. Tasks của worker_links > 30 ngày trước (FK constraint: xóa trước)
  totalDeleted += await batchDelete(conn,
    'Tasks qua worker_links > 30 ngày',
    `DELETE vt FROM vuot_link_tasks vt
     INNER JOIN worker_links wl ON wl.id = vt.worker_link_id
     WHERE wl.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
  );

  // 2b. Worker links > 30 ngày (chỉ xóa sau khi đã xóa tasks)
  totalDeleted += await batchDelete(conn,
    'Worker links (hidden) > 30 ngày đã xóa tasks',
    `DELETE FROM worker_links
     WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
       AND hidden = 1`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 3. traffic_logs — giữ dữ liệu báo cáo, chỉ xóa rất cũ
  // ════════════════════════════════════════════════════════════════════════════

  // traffic_logs lưu aggregated theo ngày (date, campaign_id) → giữ 12 tháng
  // Buyer cần nhìn lịch sử traffic → không xóa quá sớm
  totalDeleted += await batchDelete(conn,
    'Traffic logs > 12 tháng',
    `DELETE FROM traffic_logs
     WHERE date < DATE_SUB(CURDATE(), INTERVAL 365 DAY)`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 4. security_logs — chỉ cần cho phân tích bot gần đây
  // ════════════════════════════════════════════════════════════════════════════

  totalDeleted += await batchDelete(conn,
    'Security logs > 45 ngày',
    `DELETE FROM security_logs
     WHERE created_at < DATE_SUB(NOW(), INTERVAL 45 DAY)`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 5. notifications — dọn theo trạng thái đọc
  // ════════════════════════════════════════════════════════════════════════════

  totalDeleted += await batchDelete(conn,
    'Notifications đã đọc > 30 ngày',
    `DELETE FROM notifications
     WHERE is_read = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
  );

  totalDeleted += await batchDelete(conn,
    'Notifications chưa đọc > 90 ngày',
    `DELETE FROM notifications
     WHERE is_read = 0 AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 6. Sync views_done — sửa drift counter nếu có (chạy sau khi đã xóa tasks)
  //    Chỉ update những campaign thực sự bị lệch (affectedRows-based)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n  🔄 Sync views_done cho campaigns bị lệch...');
  try {
    // Dùng UPDATE...JOIN để tránh correlated subquery N+1
    const [syncRes] = await conn.execute(`
      UPDATE campaigns c
      INNER JOIN (
        SELECT campaign_id, COUNT(*) as real_views
        FROM vuot_link_tasks
        WHERE status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
        GROUP BY campaign_id
      ) t ON t.campaign_id = c.id
      SET c.views_done = t.real_views
      WHERE c.views_done != t.real_views
    `);
    if (syncRes.affectedRows > 0) {
      console.log(`  ✅ Sync views_done: ${syncRes.affectedRows} campaigns cập nhật`);
    } else {
      console.log(`  ✅ Sync views_done: không có campaign nào bị lệch`);
    }

    // Những campaign không có task nào hoàn thành → đặt về 0 nếu > 0
    const [zeroRes] = await conn.execute(`
      UPDATE campaigns
      SET views_done = 0
      WHERE views_done > 0
        AND id NOT IN (
          SELECT DISTINCT campaign_id FROM vuot_link_tasks
          WHERE status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
        )
    `);
    if (zeroRes.affectedRows > 0) {
      console.log(`  ✅ Reset views_done = 0: ${zeroRes.affectedRows} campaigns không có task hợp lệ`);
    }
  } catch (e) {
    console.error(`  ❌ Sync views_done: ${e.message}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. Tự động hoàn thành campaigns đã đạt total_views (status drift)
  // ════════════════════════════════════════════════════════════════════════════
  try {
    const [campDone] = await conn.execute(`
      UPDATE campaigns
      SET status = 'completed'
      WHERE status = 'running'
        AND total_views > 0
        AND views_done >= total_views
    `);
    if (campDone.affectedRows > 0) {
      console.log(`  ✅ Auto-complete campaigns: ${campDone.affectedRows} campaign chuyển → completed`);
    }
  } catch (e) {
    console.error(`  ❌ Auto-complete campaigns: ${e.message}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 8. ANALYZE TABLE — cập nhật index stats cho query optimizer
  //    (nhanh hơn OPTIMIZE; OPTIMIZE chỉ dùng khi xóa nhiều)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n  📊 ANALYZE TABLE (cập nhật index statistics)...');
  for (const tbl of ['vuot_link_tasks', 'traffic_logs', 'security_logs', 'campaigns', 'transactions', 'notifications']) {
    try {
      await conn.query(`ANALYZE TABLE ${tbl}`);
      console.log(`  ✅ ANALYZE ${tbl}`);
    } catch (e) {
      console.error(`  ❌ ANALYZE ${tbl}: ${e.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 9. OPTIMIZE TABLE — chỉ khi xóa được nhiều (tránh lock lâu)
  // ════════════════════════════════════════════════════════════════════════════
  if (totalDeleted >= OPTIMIZE_MIN) {
    console.log(`\n  🔧 OPTIMIZE TABLE (xóa ${totalDeleted} rows — defrag data files)...`);
    for (const tbl of ['vuot_link_tasks', 'security_logs', 'notifications']) {
      try {
        await conn.query(`OPTIMIZE TABLE ${tbl}`);
        console.log(`  ✅ OPTIMIZE ${tbl} done`);
      } catch (e) {
        console.error(`  ❌ OPTIMIZE ${tbl}: ${e.message}`);
      }
    }
  } else {
    console.log(`\n  ℹ️  OPTIMIZE bỏ qua (chỉ xóa ${totalDeleted} rows < ${OPTIMIZE_MIN})`);
  }

  await conn.end();

  const endStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date());
  console.log(`\n[DB Cleanup] ✅ Hoàn thành lúc ${endStr}. Tổng xóa: ${totalDeleted} rows.\n`);
  process.exit(0);
}

run().catch(err => {
  console.error('[DB Cleanup] FATAL:', err.message);
  process.exit(1);
});
