/**
 * Migration: Đồng bộ lại budget = total_views * cpc cho các campaign bị lệch
 * Chạy 1 lần: node server/scripts/sync-budget.js
 */
const mysql = require('mysql2/promise');

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'traffic68',
    waitForConnections: true,
  });

  // Xem các campaign bị lệch trước khi update
  const [rows] = await pool.execute(
    `SELECT id, name, total_views, cpc, budget,
            ROUND(total_views * cpc) as expected_budget,
            budget - ROUND(total_views * cpc) as diff
     FROM campaigns
     WHERE cpc > 0 AND budget != ROUND(total_views * cpc)`
  );

  if (rows.length === 0) {
    console.log('✅ Không có campaign nào bị lệch budget.');
    await pool.end();
    return;
  }

  console.log(`\n⚠️  Tìm thấy ${rows.length} campaign bị lệch budget:\n`);
  console.table(rows.map(r => ({
    id: r.id,
    name: r.name?.slice(0, 30),
    total_views: r.total_views,
    cpc: r.cpc,
    budget_old: r.budget,
    budget_expected: r.expected_budget,
    diff: r.diff,
  })));

  // Update
  const [result] = await pool.execute(
    `UPDATE campaigns SET budget = ROUND(total_views * cpc) WHERE cpc > 0 AND budget != ROUND(total_views * cpc)`
  );

  console.log(`\n✅ Đã cập nhật budget cho ${result.affectedRows} campaign.`);

  await pool.end();
}

main().catch(err => { console.error('❌ Lỗi:', err.message); process.exit(1); });
