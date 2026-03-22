const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/reports/overview ──
router.get('/overview', async (req, res) => {
  const pool = getPool();

  const [tc] = await pool.execute('SELECT COUNT(*) as count FROM campaigns WHERE user_id = ?', [req.userId]);
  const [rc] = await pool.execute("SELECT COUNT(*) as count FROM campaigns WHERE user_id = ? AND status = 'running'", [req.userId]);

  const [mw] = await pool.execute("SELECT balance FROM wallets WHERE user_id = ? AND type = 'main'", [req.userId]);
  const [cw] = await pool.execute("SELECT balance FROM wallets WHERE user_id = ? AND type = 'commission'", [req.userId]);

  const today = new Date().toISOString().slice(0, 10);
  const [todayTraffic] = await pool.execute(
    `SELECT COALESCE(SUM(views), 0) as views, COALESCE(SUM(clicks), 0) as clicks FROM traffic_logs tl JOIN campaigns c ON c.id = tl.campaign_id WHERE c.user_id = ? AND tl.date = ?`,
    [req.userId, today]
  );

  const [totalV] = await pool.execute(
    `SELECT COALESCE(SUM(views), 0) as total, COALESCE(SUM(clicks), 0) as totalClicks FROM traffic_logs tl JOIN campaigns c ON c.id = tl.campaign_id WHERE c.user_id = ?`,
    [req.userId]
  );

  const [totalS] = await pool.execute(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'withdraw' AND status = 'completed'`,
    [req.userId]
  );

  res.json({
    overview: {
      totalCampaigns: tc[0].count,
      runningCampaigns: rc[0].count,
      mainBalance: mw[0]?.balance || 0,
      commissionBalance: cw[0]?.balance || 0,
      todayViews: todayTraffic[0].views,
      todayClicks: todayTraffic[0].clicks,
      totalViews: totalV[0].total,
      totalClicks: totalV[0].totalClicks,
      totalSpent: totalS[0].total,
    },
  });
});

// ── GET /api/reports/traffic ──
router.get('/traffic', async (req, res) => {
  const pool = getPool();
  const { campaignId, from, to, period } = req.query;

  let fromDate, toDate;
  if (from && to) { fromDate = from; toDate = to; }
  else {
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    toDate = new Date().toISOString().slice(0, 10);
    const f = new Date(); f.setDate(f.getDate() - days);
    fromDate = f.toISOString().slice(0, 10);
  }

  let data;
  if (campaignId) {
    [data] = await pool.execute(
      `SELECT tl.date, tl.views, tl.clicks, tl.unique_ips, tl.source FROM traffic_logs tl JOIN campaigns c ON c.id = tl.campaign_id WHERE c.user_id = ? AND tl.campaign_id = ? AND tl.date BETWEEN ? AND ? ORDER BY tl.date ASC`,
      [req.userId, campaignId, fromDate, toDate]
    );
  } else {
    [data] = await pool.execute(
      `SELECT tl.date, SUM(tl.views) as views, SUM(tl.clicks) as clicks, SUM(tl.unique_ips) as unique_ips FROM traffic_logs tl JOIN campaigns c ON c.id = tl.campaign_id WHERE c.user_id = ? AND tl.date BETWEEN ? AND ? GROUP BY tl.date ORDER BY tl.date ASC`,
      [req.userId, fromDate, toDate]
    );
  }

  const sourceWhere = campaignId
    ? `c.user_id = ? AND tl.campaign_id = ? AND tl.date BETWEEN ? AND ?`
    : `c.user_id = ? AND tl.date BETWEEN ? AND ?`;
  const sourceParams = campaignId
    ? [req.userId, campaignId, fromDate, toDate]
    : [req.userId, fromDate, toDate];

  const [bySource] = await pool.execute(
    `SELECT tl.source, SUM(tl.views) as views, SUM(tl.clicks) as clicks FROM traffic_logs tl JOIN campaigns c ON c.id = tl.campaign_id WHERE ${sourceWhere} GROUP BY tl.source`,
    sourceParams
  );

  const [deviceRows] = await pool.execute(
    `SELECT SUM(tl.mobile_views) as mobile, SUM(tl.desktop_views) as desktop, SUM(tl.tablet_views) as tablet FROM traffic_logs tl JOIN campaigns c ON c.id = tl.campaign_id WHERE ${sourceWhere}`,
    sourceParams
  );
  const d = deviceRows[0] || {};
  const byDevice = [
    { name: 'Mobile',  value: Number(d.mobile  || 0), color: '#3B82F6' },
    { name: 'Desktop', value: Number(d.desktop || 0), color: '#F97316' },
    { name: 'Tablet',  value: Number(d.tablet  || 0), color: '#FACC15' },
  ].filter(x => x.value > 0);

  res.json({ traffic: data, bySource, byDevice, period: { from: fromDate, to: toDate } });
});

// ── GET /api/reports/tasks  (completed tasks for a campaign, for detail modal) ──
router.get('/tasks', async (req, res) => {
  try {
    const pool = getPool();
    const { campaignId, period } = req.query;
    if (!campaignId) return res.status(400).json({ error: 'campaignId required' });

    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const from = new Date(); from.setDate(from.getDate() - days);
    const fromDate = from.toISOString().slice(0, 10);

    const [check] = await pool.execute(
      'SELECT id FROM campaigns WHERE id = ? AND user_id = ?',
      [campaignId, req.userId]
    );
    if (!check.length) return res.status(403).json({ error: 'Forbidden' });

    let tasks;
    try {
      // Try with ip_country column (if migration has been run)
      [tasks] = await pool.execute(
        `SELECT vlt.completed_at, vlt.ip_address, vlt.user_agent, vlt.ip_country, vlt.time_on_site
         FROM vuot_link_tasks vlt
         WHERE vlt.campaign_id = ? AND vlt.status = 'completed' AND DATE(vlt.completed_at) >= ?
         ORDER BY vlt.completed_at DESC LIMIT 500`,
        [campaignId, fromDate]
      );
    } catch (colErr) {
      // Fallback: ip_country column doesn't exist yet
      [tasks] = await pool.execute(
        `SELECT vlt.completed_at, vlt.ip_address, vlt.user_agent, NULL as ip_country, vlt.time_on_site
         FROM vuot_link_tasks vlt
         WHERE vlt.campaign_id = ? AND vlt.status = 'completed' AND DATE(vlt.completed_at) >= ?
         ORDER BY vlt.completed_at DESC LIMIT 500`,
        [campaignId, fromDate]
      );
    }

    res.json({ tasks });
  } catch (err) {
    console.error('reports/tasks error:', err.message);
    res.status(500).json({ error: 'Internal server error', tasks: [] });
  }
});


module.exports = router;
