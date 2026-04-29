/**
 * Debug script: Kiểm tra tại sao campaign priority cao không được phân phối
 * Usage: node debug-campaign-distribution.js
 */

const { getPool } = require('./db/index');

async function debugCampaignDistribution() {
  const pool = getPool();

  console.log('\n=== DEBUG CAMPAIGN DISTRIBUTION ===\n');

  // 1. Kiểm tra campaigns đang running với priority cao
  console.log('1️⃣  Campaigns đang running với priority = 5 (x32):');
  const [highPriority] = await pool.execute(`
    SELECT id, name, status, priority, views_done, total_views, daily_views,
           view_by_hour, device, traffic_type, keyword, url
    FROM campaigns
    WHERE status = 'running' AND priority = 5
    ORDER BY created_at DESC
    LIMIT 5
  `);

  if (highPriority.length === 0) {
    console.log('   ❌ Không có campaign nào với priority = 5');
  } else {
    highPriority.forEach(c => {
      console.log(`   ✓ Campaign #${c.id}: "${c.name}"`);
      console.log(`     - Priority: ${c.priority} (x32)`);
      console.log(`     - Views: ${c.views_done}/${c.total_views}`);
      console.log(`     - Daily limit: ${c.daily_views || 0} (0 = không giới hạn)`);
      console.log(`     - Hourly cap: ${c.view_by_hour ? 'BẬT' : 'TẮT'}`);
      console.log(`     - Device: ${c.device || 'desktop,mobile'}`);
      console.log(`     - Traffic type: ${c.traffic_type}`);
      console.log(`     - Keyword: ${c.keyword ? 'Có' : 'Không'}`);
      console.log(`     - URL: ${c.url}`);
    });
  }

  // 2. Kiểm tra điều kiện WHERE trong query phân phối
  console.log('\n2️⃣  Kiểm tra điều kiện phân phối:');

  const tz = 'Asia/Ho_Chi_Minh';
  const vnToday = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const vnDayStart = vnToday + ' 00:00:00';
  const vnDayEnd = vnToday + ' 23:59:59';

  const [eligible] = await pool.execute(`
    SELECT c.id, c.name, c.priority, c.views_done, c.total_views, c.daily_views,
           COALESCE(td.today_done, 0) as today_done
    FROM campaigns c
    LEFT JOIN (
      SELECT campaign_id, COUNT(*) as today_done
      FROM vuot_link_tasks
      WHERE status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
        AND completed_at >= ? AND completed_at <= ?
      GROUP BY campaign_id
    ) td ON td.campaign_id = c.id
    WHERE c.status = 'running'
      AND (
        (c.traffic_type = 'google_search' AND c.keyword != '')
        OR c.traffic_type = 'direct'
        OR (c.traffic_type = 'social' AND c.keyword != '')
      )
      AND c.views_done < c.total_views
      AND (
        c.daily_views <= 0
        OR COALESCE(td.today_done, 0) < c.daily_views
      )
      AND c.priority = 5
  `, [vnDayStart, vnDayEnd]);

  if (eligible.length === 0) {
    console.log('   ❌ Không có campaign priority=5 nào đủ điều kiện phân phối');
    console.log('   Kiểm tra lại:');
    console.log('   - Campaign có status = "running"?');
    console.log('   - Campaign có keyword (nếu traffic_type = google_search/social)?');
    console.log('   - views_done < total_views?');
    console.log('   - Nếu có daily_views > 0: today_done < daily_views?');
  } else {
    console.log(`   ✓ Có ${eligible.length} campaign priority=5 đủ điều kiện:`);
    eligible.forEach(c => {
      const remaining = c.total_views - c.views_done;
      const dailyRemaining = c.daily_views > 0
        ? Math.max(0, c.daily_views - c.today_done)
        : remaining;
      console.log(`   - Campaign #${c.id}: "${c.name}"`);
      console.log(`     Còn lại: ${remaining} views (tổng), ${dailyRemaining} views (hôm nay)`);
    });
  }

  // 3. Kiểm tra có campaign nào đang active không
  console.log('\n3️⃣  Tổng quan campaigns đang running:');
  const [summary] = await pool.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN priority = 5 THEN 1 ELSE 0 END) as priority_5,
      SUM(CASE WHEN views_done >= total_views THEN 1 ELSE 0 END) as completed_but_running,
      SUM(CASE WHEN keyword = '' OR keyword IS NULL THEN 1 ELSE 0 END) as no_keyword
    FROM campaigns
    WHERE status = 'running'
  `);

  console.log(`   - Tổng campaigns running: ${summary[0].total}`);
  console.log(`   - Campaigns priority=5: ${summary[0].priority_5}`);
  console.log(`   - Campaigns đã hoàn thành nhưng vẫn running: ${summary[0].completed_but_running}`);
  console.log(`   - Campaigns không có keyword: ${summary[0].no_keyword}`);

  console.log('\n=== KẾT THÚC DEBUG ===\n');

  await pool.end();
}

debugCampaignDistribution().catch(err => {
  console.error('Debug error:', err);
  process.exit(1);
});
