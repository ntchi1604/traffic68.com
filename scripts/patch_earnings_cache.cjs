const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../server/routes/vuotlink.js');
let content = fs.readFileSync(file, 'utf8');

// Replace worker/earnings with cached version
const oldEarnings = `// GET /api/vuot-link/worker/earnings?days=30
router.get('/worker/earnings', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const uid = req.userId;
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 7));

    const [wLinks] = await pool.execute('SELECT id FROM worker_links WHERE worker_id = ?', [uid]);
    const wlIds = wLinks.map(w => w.id);
    const wlCondition = wlIds.length > 0
      ? \`(worker_id = ? OR worker_link_id IN (\${wlIds.map(() => '?').join(',')}))\`
      : \`worker_id = ?\`;
    const wlParams = wlIds.length > 0 ? [uid, ...wlIds] : [uid];

    // Dùng date range thay vì DATE() — giúp MySQL dùng index trên completed_at
    const vnNow = new Date();
    const vnToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(vnNow);
    const startD = new Date(vnNow);
    startD.setDate(startD.getDate() - days);
    const startStr  = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(startD) + ' 00:00:00';
    const todayStart = vnToday + ' 00:00:00';
    const todayEnd   = vnToday + ' 23:59:59';

    // Chạy 2 query SONG SONG — daily bao gồm cả today, tính summary từ JS (không cần query riêng)
    const [[dailyRows], [todayR]] = await Promise.all([
      pool.execute(
        \`SELECT DATE(completed_at) as date,
                COUNT(*) as tasks,
                COALESCE(SUM(earning), 0) as earnings
         FROM vuot_link_tasks
         WHERE \${wlCondition} AND status = 'completed'
           AND bot_detected = 0 AND is_over_limit = 0
           AND completed_at >= ?
         GROUP BY DATE(completed_at)
         ORDER BY date DESC\`,
        [...wlParams, startStr]
      ),
      pool.execute(
        \`SELECT COALESCE(SUM(earning), 0) as earn, COUNT(*) as tasks
         FROM vuot_link_tasks
         WHERE \${wlCondition} AND status = 'completed'
           AND bot_detected = 0 AND is_over_limit = 0
           AND completed_at >= ? AND completed_at <= ?\`,
        [...wlParams, todayStart, todayEnd]
      ),
    ]);

    // Tính summary từ daily rows — không cần query riêng lần 3
    const totalEarnings = dailyRows.reduce((s, d) => s + Number(d.earnings), 0);
    const totalTasks    = dailyRows.reduce((s, d) => s + Number(d.tasks), 0);

    res.json({
      daily: dailyRows,
      summary: {
        total:    totalEarnings,
        tasks:    totalTasks,
        avgDaily: dailyRows.length > 0 ? Math.round(totalEarnings / dailyRows.length) : 0,
      },
      today:      Number(todayR[0].earn),
      todayTasks: Number(todayR[0].tasks),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

const newEarnings = `// GET /api/vuot-link/worker/earnings?days=30
router.get('/worker/earnings', authMiddleware, async (req, res) => {
  try {
    const uid = req.userId;
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 7));
    const data = await cache.get(
      \`worker:earnings:\${uid}:\${days}\`,
      async () => {
        const pool = getPool();
        const [wLinks] = await pool.execute('SELECT id FROM worker_links WHERE worker_id = ?', [uid]);
        const wlIds = wLinks.map(w => w.id);
        const wlCondition = wlIds.length > 0
          ? \`(worker_id = ? OR worker_link_id IN (\${wlIds.map(() => '?').join(',')}))\`
          : \`worker_id = ?\`;
        const wlParams = wlIds.length > 0 ? [uid, ...wlIds] : [uid];

        const vnNow = new Date();
        const vnToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(vnNow);
        const startD = new Date(vnNow); startD.setDate(startD.getDate() - days);
        const startStr  = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(startD) + ' 00:00:00';
        const todayStart = vnToday + ' 00:00:00';
        const todayEnd   = vnToday + ' 23:59:59';

        const [[dailyRows], [todayR]] = await Promise.all([
          pool.execute(
            \`SELECT DATE(completed_at) as date, COUNT(*) as tasks, COALESCE(SUM(earning), 0) as earnings
             FROM vuot_link_tasks WHERE \${wlCondition} AND status = 'completed'
               AND bot_detected = 0 AND is_over_limit = 0 AND completed_at >= ?
             GROUP BY DATE(completed_at) ORDER BY date DESC\`,
            [...wlParams, startStr]
          ),
          pool.execute(
            \`SELECT COALESCE(SUM(earning), 0) as earn, COUNT(*) as tasks FROM vuot_link_tasks
             WHERE \${wlCondition} AND status = 'completed'
               AND bot_detected = 0 AND is_over_limit = 0
               AND completed_at >= ? AND completed_at <= ?\`,
            [...wlParams, todayStart, todayEnd]
          ),
        ]);

        const totalEarnings = dailyRows.reduce((s, d) => s + Number(d.earnings), 0);
        const totalTasks    = dailyRows.reduce((s, d) => s + Number(d.tasks), 0);
        return {
          daily: dailyRows,
          summary: {
            total:    totalEarnings,
            tasks:    totalTasks,
            avgDaily: dailyRows.length > 0 ? Math.round(totalEarnings / dailyRows.length) : 0,
          },
          today:      Number(todayR[0].earn),
          todayTasks: Number(todayR[0].tasks),
        };
      },
      60 * 1000,  // 60s TTL cho biểu đồ lịch sử
      45 * 1000   // stale-while-revalidate sau 45s
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

// Normalize CRLF in the file content to LF for matching, then replace
const contentLF = content.replace(/\r\n/g, '\n');
const oldLF = oldEarnings.replace(/\r\n/g, '\n');
const newLF = newEarnings.replace(/\r\n/g, '\n');

if (contentLF.includes(oldLF)) {
  const updated = contentLF.replace(oldLF, newLF);
  // Write back with CRLF (since original had CRLF)
  fs.writeFileSync(file, updated.replace(/\n/g, '\r\n'), 'utf8');
  console.log('✅ worker/earnings cached successfully');
} else {
  console.log('❌ Pattern not found. Checking first 200 chars of function:');
  const idx = contentLF.indexOf("// GET /api/vuot-link/worker/earnings");
  if (idx > -1) console.log(JSON.stringify(contentLF.substring(idx, idx+300)));
}
