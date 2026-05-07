/**
 * db-cleanup.js — Dọn dẹp DB định kỳ, tối ưu cho data lớn (triệu rows+)
 *
 * Chạy qua PM2 hàng ngày lúc 00:00 VN (= 17:00 UTC ngày hôm trước):
 *   pm2 start server/db/db-cleanup.js --name db-cleanup --cron "0 17 * * *" --no-autorestart
 *
 * Chạy hàng ngày là tốt nhất: mỗi lần xóa ít → nhanh, không lock DB lâu.
 *
 * Hoặc chạy thủ công:
 *   node server/db/db-cleanup.js
 *
 * Chiến lược tối ưu data lớn:
 *   - Batch delete: 5.000 rows/lần, tránh lock bảng quá lâu
 *   - Ngủ 200ms giữa mỗi batch: giảm tải I/O disk
 *   - Sync views_done chỉ tăng counter, không hạ theo raw task đã cleanup
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
const RETENTION = {
  oneDay: 1,
  sevenDays: 7,
  fourteenDays: 14,
  thirtyDays: 30,
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Batch delete helper ──────────────────────────────────────────────────────
// Simple DELETE: thêm LIMIT trực tiếp vào cuối
async function batchDelete(conn, label, sql, params = []) {
  let total = 0;
  while (true) {
    const [r] = await conn.execute(`${sql} LIMIT ${BATCH_SIZE}`, params);
    const n = r.affectedRows || 0;
    total += n;
    if (n > 0) process.stdout.write(`\r  ⏳ ${label}: ${total} rows...`);
    if (n < BATCH_SIZE) break;
    await sleep(BATCH_SLEEP);
  }
  console.log(`\r  ✅ ${label}: ${total} rows xóa`);
  return total;
}

// DELETE với subquery (dùng khi cần JOIN) — MySQL không cho LIMIT trong multi-table DELETE
// Wraps vào tmp alias để tránh lỗi "can't specify target table"
async function batchDeleteSub(conn, label, idSql, deleteSql, params = []) {
  let total = 0;
  while (true) {
    // Lấy IDs cần xóa qua subquery
    const [r] = await conn.execute(
      `${deleteSql} IN (SELECT _id FROM (${idSql} LIMIT ${BATCH_SIZE}) AS _tmp)`,
      [...params, ...params]  // params dùng 2 lần: 1 cho subquery, 1 cho outer
    );
    const n = r.affectedRows || 0;
    total += n;
    if (n > 0) process.stdout.write(`\r  ⏳ ${label}: ${total} rows...`);
    if (n < BATCH_SIZE) break;
    await sleep(BATCH_SLEEP);
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
  console.log(`[DB Cleanup] Batch size: ${BATCH_SIZE} rows/batch`);
  console.log('[DB Cleanup] Retention tiers: 1 / 7 / 14 / 30 ngày\n');

  let totalDeleted = 0;

  // ════════════════════════════════════════════════════════════════════════════
  // 1. vuot_link_tasks — bảng lớn nhất, ưu tiên clean trước
  // ════════════════════════════════════════════════════════════════════════════

  // 1a. Rác nóng > 1 ngày
  totalDeleted += await batchDelete(conn,
    `Tasks expired/cancelled > ${RETENTION.oneDay} ngày`,
    `DELETE FROM vuot_link_tasks
     WHERE status IN ('expired','cancelled')
       AND created_at < DATE_SUB(NOW(), INTERVAL ${RETENTION.oneDay} DAY)`
  );

  totalDeleted += await batchDelete(conn,
    `Tasks pending bỏ dở > ${RETENTION.oneDay} ngày`,
    `DELETE FROM vuot_link_tasks
     WHERE status IN ('pending','step1','step2','step3')
       AND expires_at IS NOT NULL
       AND expires_at < DATE_SUB(NOW(), INTERVAL ${RETENTION.oneDay} DAY)`
  );

  // 1b. Rác bot/limit > 7 ngày
  totalDeleted += await batchDelete(conn,
    `Bot tasks > ${RETENTION.sevenDays} ngày`,
    `DELETE FROM vuot_link_tasks
     WHERE bot_detected = 1
       AND created_at < DATE_SUB(NOW(), INTERVAL ${RETENTION.sevenDays} DAY)`
  );

  totalDeleted += await batchDelete(conn,
    `Over-limit tasks > ${RETENTION.sevenDays} ngày`,
    `DELETE FROM vuot_link_tasks
     WHERE is_over_limit = 1
       AND created_at < DATE_SUB(NOW(), INTERVAL ${RETENTION.sevenDays} DAY)`
  );

  // 1f. Completed tasks hợp lệ — giữ dài hơn vì còn dùng đối soát/báo cáo
  totalDeleted += await batchDelete(conn,
    'Completed tasks hợp lệ > 180 ngày',
    `DELETE FROM vuot_link_tasks
     WHERE status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
       AND completed_at < DATE_SUB(NOW(), INTERVAL 180 DAY)`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 2. Normalize IPv4-mapped IPv6 IPs (::ffff:x.x.x.x → x.x.x.x)
  //    Fix data cũ trước khi deploy normalizeIp() — tránh count sai limit IP
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n  🌐 Normalize ::ffff: IPs trong vuot_link_tasks...');
  try {
    const [normRes] = await conn.execute(`
      UPDATE vuot_link_tasks
      SET ip_address = SUBSTRING(ip_address, 8)
      WHERE ip_address LIKE '::ffff:%'
    `);
    console.log(`  ✅ Normalize IPs: ${normRes.affectedRows} rows cập nhật`);
  } catch (e) {
    console.error(`  ❌ Normalize IPs vuot_link_tasks: ${e.message}`);
  }

  try {
    const [normSec] = await conn.execute(`
      UPDATE security_logs
      SET ip_address = SUBSTRING(ip_address, 8)
      WHERE ip_address LIKE '::ffff:%'
    `);
    if (normSec.affectedRows > 0)
      console.log(`  ✅ Normalize IPs security_logs: ${normSec.affectedRows} rows`);
  } catch (e) {
    console.error(`  ❌ Normalize IPs security_logs: ${e.message}`);
  }

  // ════════════════════════════════════════════════════════════════════════════

  console.log('\n  ⏭️  Bỏ qua cleanup worker_links để giữ lịch sử gateway/tasks');

  // ════════════════════════════════════════════════════════════════════════════
  // 4. traffic_logs — giữ dữ liệu báo cáo, chỉ xóa rất cũ
  // ════════════════════════════════════════════════════════════════════════════

  // traffic_logs lưu aggregated theo ngày (date, campaign_id) → giữ 12 tháng
  // Buyer cần nhìn lịch sử traffic → không xóa quá sớm
  totalDeleted += await batchDelete(conn,
    'Traffic logs > 12 tháng',
    `DELETE FROM traffic_logs
     WHERE date < DATE_SUB(CURDATE(), INTERVAL 365 DAY)`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 5. security_logs — chỉ cần cho phân tích bot gần đây
  // ════════════════════════════════════════════════════════════════════════════

  totalDeleted += await batchDelete(conn,
    `Security logs > ${RETENTION.fourteenDays} ngày`,
    `DELETE FROM security_logs
     WHERE created_at < DATE_SUB(NOW(), INTERVAL ${RETENTION.fourteenDays} DAY)`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 6. support_tickets — chỉ clear ticket đã đóng lâu
  // ════════════════════════════════════════════════════════════════════════════

  totalDeleted += await batchDelete(conn,
    `Support tickets đã đóng > ${RETENTION.thirtyDays} ngày`,
    `DELETE FROM support_tickets
     WHERE status IN ('closed','resolved')
       AND updated_at < DATE_SUB(NOW(), INTERVAL ${RETENTION.thirtyDays} DAY)`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 7. transactions — giữ lịch sử buyer/worker, chỉ clear deposit rác
  // ════════════════════════════════════════════════════════════════════════════

  totalDeleted += await batchDelete(conn,
    `Deposit cancelled/failed > ${RETENTION.oneDay} ngày`,
    `DELETE FROM transactions
     WHERE type = 'deposit'
       AND status IN ('cancelled','failed')
       AND created_at < DATE_SUB(NOW(), INTERVAL ${RETENTION.oneDay} DAY)`
  );

  totalDeleted += await batchDelete(conn,
    `Deposit pending quá hạn > ${RETENTION.oneDay} ngày`,
    `DELETE FROM transactions
     WHERE type = 'deposit' AND status = 'pending'
       AND created_at < DATE_SUB(NOW(), INTERVAL ${RETENTION.oneDay} DAY)`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 7. notifications — dọn theo trạng thái đọc
  // ════════════════════════════════════════════════════════════════════════════

  totalDeleted += await batchDelete(conn,
    `Notifications đã đọc > ${RETENTION.sevenDays} ngày`,
    `DELETE FROM notifications
     WHERE is_read = 1 AND created_at < DATE_SUB(NOW(), INTERVAL ${RETENTION.sevenDays} DAY)`
  );

  totalDeleted += await batchDelete(conn,
    `Notifications chưa đọc > ${RETENTION.thirtyDays} ngày`,
    `DELETE FROM notifications
     WHERE is_read = 0 AND created_at < DATE_SUB(NOW(), INTERVAL ${RETENTION.thirtyDays} DAY)`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 6. Sync views_done — chỉ được tăng counter, không được hạ sau cleanup raw tasks
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n  🔄 Sync views_done cho campaigns bị lệch tăng...');
  try {
    const [syncRes] = await conn.execute(`
      UPDATE campaigns c
      INNER JOIN (
        SELECT campaign_id, COUNT(*) as real_views
        FROM vuot_link_tasks
        WHERE status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
        GROUP BY campaign_id
      ) t ON t.campaign_id = c.id
      SET c.views_done = t.real_views
      WHERE c.views_done < t.real_views
    `);
    if (syncRes.affectedRows > 0) {
      console.log(`  ✅ Sync views_done tăng: ${syncRes.affectedRows} campaigns cập nhật`);
    } else {
      console.log(`  ✅ Sync views_done: không có campaign nào cần tăng`);
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
