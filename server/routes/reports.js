const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const geoip = require('geoip-lite');

const localDateStr = (d = new Date()) =>
  d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

const router = express.Router();
router.use(authMiddleware);

router.get('/overview', async (req, res) => {
  const pool = getPool();

  const [tc] = await pool.execute('SELECT COUNT(*) as count FROM campaigns WHERE user_id = ?', [req.userId]);
  const [rc] = await pool.execute("SELECT COUNT(*) as count FROM campaigns WHERE user_id = ? AND status = 'running'", [req.userId]);

  const [mw] = await pool.execute("SELECT balance FROM wallets WHERE user_id = ? AND type = 'main'", [req.userId]);
  const [cw] = await pool.execute("SELECT balance FROM wallets WHERE user_id = ? AND type = 'commission'", [req.userId]);

  const today = localDateStr();
  const [todayTraffic] = await pool.execute(
    `SELECT COALESCE(SUM(views), 0) as views, COALESCE(SUM(clicks), 0) as clicks
     FROM traffic_logs tl
     JOIN campaigns c ON c.id = tl.campaign_id
     WHERE c.user_id = ? AND tl.date = ?`,
    [req.userId, today]
  );

  const [totalV] = await pool.execute(
    `SELECT COALESCE(SUM(views), 0) as total, COALESCE(SUM(clicks), 0) as totalClicks
     FROM traffic_logs tl
     JOIN campaigns c ON c.id = tl.campaign_id
     WHERE c.user_id = ?`,
    [req.userId]
  );

  // Tổng chi phí chiến dịch (đã trừ từ ví)
  const [totalS] = await pool.execute(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE user_id = ? AND wallet_type = 'main' AND type = 'campaign' AND status = 'completed'`,
    [req.userId]
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fromDate = localDateStr(sevenDaysAgo);

  const [viewRows] = await pool.execute(
    `SELECT DATE(completed_at) as day, COUNT(*) as views
     FROM vuot_link_tasks vlt
     JOIN campaigns c ON c.id = vlt.campaign_id
     WHERE c.user_id = ?
       AND vlt.status = 'completed'
       AND vlt.bot_detected = 0
       AND completed_at >= ?
     GROUP BY 1
     ORDER BY 1 ASC`,
    [req.userId, fromDate + ' 00:00:00']
  );

  const [spentRows] = await pool.execute(
    `SELECT DATE(created_at) as day, COALESCE(SUM(amount), 0) as spent
     FROM transactions
     WHERE user_id = ?
       AND wallet_type = 'main'
       AND type = 'campaign'
       AND status = 'completed'
       AND created_at >= ?
     GROUP BY 1
     ORDER BY 1 ASC`,
    [req.userId, fromDate + ' 00:00:00']
  );

  console.log(`[Overview Chart] user=${req.userId}, fromDate=${fromDate}`);
  console.log(`[Overview Chart] viewRows:`, viewRows.slice(0, 10));
  console.log(`[Overview Chart] spentRows:`, spentRows.slice(0, 10));

  const viewMap = {};
  const spentMap = {};
  viewRows.forEach(r => {
    const k = r.day instanceof Date ? localDateStr(r.day) : String(r.day).slice(0, 10);
    viewMap[k] = Number(r.views || 0);
  });
  spentRows.forEach(r => {
    const k = r.day instanceof Date ? localDateStr(r.day) : String(r.day).slice(0, 10);
    spentMap[k] = Number(r.spent || 0);
  });

  const chart = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    chart.push({
      day: key,
      views: viewMap[key] || 0,
      spent: spentMap[key] || 0,
    });
  }
  console.log(`[Overview Chart] final chart:`, chart);


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
      chart,
    },
  });
});

router.get('/traffic', async (req, res) => {
  const pool = getPool();
  const { campaignId, from, to, period } = req.query;

  let fromDate, toDate;
  if (from && to) { fromDate = from; toDate = to; }
  else {
    const days = period === 'all' ? 3650 : period === '30d' ? 30 : period === '90d' ? 90 : 7;
    toDate = localDateStr();
    const f = new Date(); f.setDate(f.getDate() - days);
    fromDate = localDateStr(f);
  }

  let data;
  if (campaignId) {
    [data] = await pool.execute(
      `SELECT tl.date, tl.views, tl.clicks, tl.unique_ips, tl.source,
              COALESCE(tl.clicks * c.cpc, 0) as cost
       FROM traffic_logs tl JOIN campaigns c ON c.id = tl.campaign_id
       WHERE c.user_id = ? AND tl.campaign_id = ? AND tl.date BETWEEN ? AND ?
       ORDER BY tl.date ASC`,
      [req.userId, campaignId, fromDate, toDate]
    );
  } else {
    [data] = await pool.execute(
      `SELECT tl.date,
              SUM(tl.views) as views,
              SUM(tl.clicks) as clicks,
              SUM(tl.unique_ips) as unique_ips,
              COALESCE(SUM(tl.clicks * c.cpc), 0) as cost
       FROM traffic_logs tl JOIN campaigns c ON c.id = tl.campaign_id
       WHERE c.user_id = ? AND tl.date BETWEEN ? AND ?
       GROUP BY tl.date ORDER BY tl.date ASC`,
      [req.userId, fromDate, toDate]
    );
  }

  const totalCost = data.reduce((s, r) => s + Number(r.cost || 0), 0);

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
    { name: 'Mobile', value: Number(d.mobile || 0), color: '#3B82F6' },
    { name: 'Desktop', value: Number(d.desktop || 0), color: '#F97316' },
    { name: 'Tablet', value: Number(d.tablet || 0), color: '#FACC15' },
  ].filter(x => x.value > 0);

  res.json({ traffic: data, bySource, byDevice, totalCost, period: { from: fromDate, to: toDate } });
});

router.get('/tasks', async (req, res) => {
  try {
    const pool = getPool();
    const { campaignId, period } = req.query;
    if (!campaignId) return res.status(400).json({ error: 'campaignId required' });

    const days = period === 'all' ? 3650 : period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const from = new Date(); from.setDate(from.getDate() - days);
    const fromDate = localDateStr(from);

    const [check] = await pool.execute(
      'SELECT id FROM campaigns WHERE id = ? AND user_id = ?',
      [campaignId, req.userId]
    );
    if (!check.length) return res.status(403).json({ error: 'Forbidden' });

    let tasks;
    try {

      [tasks] = await pool.execute(
        `SELECT vlt.completed_at, vlt.ip_address, vlt.user_agent, vlt.ip_country, vlt.time_on_site, vlt.keyword
         FROM vuot_link_tasks vlt
         WHERE vlt.campaign_id = ? AND vlt.status = 'completed' AND DATE(vlt.completed_at) >= ?
         ORDER BY vlt.completed_at DESC LIMIT 500`,
        [campaignId, fromDate]
      );
    } catch (colErr) {

      [tasks] = await pool.execute(
        `SELECT vlt.completed_at, vlt.ip_address, vlt.user_agent, NULL as ip_country, vlt.time_on_site, vlt.keyword
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

// ── Export buyer tasks (all statuses, with city + device + step info) ──
router.get('/tasks/export', async (req, res) => {
  try {
    const pool = getPool();
    const { campaignId, period } = req.query;
    if (!campaignId) return res.status(400).json({ error: 'campaignId required' });

    const days = period === 'all' ? 3650 : period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const from = new Date(); from.setDate(from.getDate() - days);
    const fromDate = localDateStr(from);

    // Verify ownership
    const [check] = await pool.execute(
      'SELECT id, version, cpc FROM campaigns WHERE id = ? AND user_id = ?',
      [campaignId, req.userId]
    );
    if (!check.length) return res.status(403).json({ error: 'Forbidden' });

    const campaign = check[0];
    // Total steps: version=1 → 2 steps, version=0 → 1 step
    const totalSteps = Number(campaign.version) === 1 ? 2 : 1;
    const cpc = Number(campaign.cpc) || 0;

    const [rows] = await pool.execute(
      `SELECT vlt.id, vlt.keyword, vlt.ip_address, vlt.ip_country,
              vlt.user_agent, vlt.status, vlt.earning, vlt.created_at, vlt.completed_at
       FROM vuot_link_tasks vlt
       WHERE vlt.campaign_id = ? AND DATE(vlt.created_at) >= ?
       ORDER BY vlt.created_at DESC
       LIMIT 5000`,
      [campaignId, fromDate]
    );

    // Helper: map status to step number
    const statusToStep = (s) => {
      if (s === 'completed') return totalSteps;
      if (s === 'step3') return 3;
      if (s === 'step2') return 2;
      if (s === 'step1') return 1;
      return 0; // pending
    };

    // Helper: detect device from user agent
    const detectDevice = (ua) => {
      if (!ua) return 'Unknown';
      if (/mobile|android|iphone|ipad/i.test(ua)) return 'Mobile';
      if (/tablet/i.test(ua)) return 'Tablet';
      return 'Desktop';
    };

    const tasks = rows.map((r, i) => {
      const geo = r.ip_address ? geoip.lookup(r.ip_address) : null;
      const country = r.ip_country || (geo ? geo.country : '');
      const city = geo ? (geo.city || '') : '';
      const device = detectDevice(r.user_agent);
      const currentStep = statusToStep(r.status);

      // Status label
      const statusLabel = {
        completed: 'Hoàn thành',
        expired: 'Hết hạn',
        pending: 'Đang chờ',
        step1: 'Bước 1',
        step2: 'Bước 2',
        step3: 'Bước 3',
      }[r.status] || r.status;

      // Spending: use earning if available, else cpc * (completed)
      const spending = Number(r.earning) || (r.status === 'completed' ? cpc : 0);

      return {
        stt: i + 1,
        id: r.id,
        keyword: r.keyword || '',
        ip: r.ip_address || '',
        country,
        city,
        device,
        currentStep,
        totalSteps,
        status: statusLabel,
        spending,
        createdAt: r.created_at,
        completedAt: r.completed_at || null,
      };
    });

    res.json({ tasks, campaignId });
  } catch (err) {
    console.error('reports/tasks/export error:', err.message);
    res.status(500).json({ error: 'Internal server error', tasks: [] });
  }
});

router.get('/detailed', async (req, res) => {

  try {
    const pool = getPool();
    const { campaignId, period } = req.query;
    const days = period === 'all' ? 3650 : period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const from = new Date(); from.setDate(from.getDate() - days);
    const fromDate = localDateStr(from);

    let data;
    if (campaignId) {
      [data] = await pool.execute(
        `SELECT DATE(vlt.created_at) as date, vlt.keyword, c.daily_views,
                COUNT(*) as total,
                SUM(CASE WHEN vlt.status = 'completed' AND vlt.bot_detected = 0 THEN 1 ELSE 0 END) as completed,
                COALESCE(SUM(vlt.earning), 0) as cost
         FROM vuot_link_tasks vlt
         JOIN campaigns c ON c.id = vlt.campaign_id
         WHERE c.user_id = ? AND vlt.campaign_id = ? AND DATE(vlt.created_at) >= ?
         GROUP BY date, c.daily_views, vlt.keyword
         ORDER BY date DESC, completed DESC`,
        [req.userId, campaignId, fromDate]
      );
    } else {
      [data] = await pool.execute(
        `SELECT DATE(vlt.created_at) as date, c.name as campaign_name, c.daily_views, vlt.keyword,
                COUNT(*) as total,
                SUM(CASE WHEN vlt.status = 'completed' AND vlt.bot_detected = 0 THEN 1 ELSE 0 END) as completed,
                COALESCE(SUM(vlt.earning), 0) as cost
         FROM vuot_link_tasks vlt
         JOIN campaigns c ON c.id = vlt.campaign_id
         WHERE c.user_id = ? AND DATE(vlt.created_at) >= ?
         GROUP BY date, c.id, c.daily_views, vlt.keyword
         ORDER BY date DESC, completed DESC LIMIT 1000`,
        [req.userId, fromDate]
      );
    }
    const safeData = data.map(r => ({
      ...r, date: localDateStr(new Date(r.date))
    }));
    res.json({ detailed: safeData });
  } catch (err) {
    console.error('reports/detailed error:', err.message);
    res.status(500).json({ error: 'Internal server error', detailed: [] });
  }
});

module.exports = router;
