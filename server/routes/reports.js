const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/reports/overview ──
router.get('/overview', (req, res) => {
  const db = getDb();

  // Total campaigns
  const totalCampaigns = db.prepare('SELECT COUNT(*) as count FROM campaigns WHERE user_id = ?').get(req.userId).count;
  const runningCampaigns = db.prepare("SELECT COUNT(*) as count FROM campaigns WHERE user_id = ? AND status = 'running'").get(req.userId).count;

  // Wallets
  const mainWallet = db.prepare("SELECT balance FROM wallets WHERE user_id = ? AND type = 'main'").get(req.userId);
  const commWallet = db.prepare("SELECT balance FROM wallets WHERE user_id = ? AND type = 'commission'").get(req.userId);

  // Today traffic
  const today = new Date().toISOString().slice(0, 10);
  const todayTraffic = db.prepare(`
    SELECT COALESCE(SUM(views), 0) as views, COALESCE(SUM(clicks), 0) as clicks
    FROM traffic_logs tl
    JOIN campaigns c ON c.id = tl.campaign_id
    WHERE c.user_id = ? AND tl.date = ?
  `).get(req.userId, today);

  // Total views all time
  const totalViews = db.prepare(`
    SELECT COALESCE(SUM(views), 0) as total
    FROM traffic_logs tl
    JOIN campaigns c ON c.id = tl.campaign_id
    WHERE c.user_id = ?
  `).get(req.userId).total;

  // Total spent
  const totalSpent = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE user_id = ? AND type = 'withdraw' AND status = 'completed'
  `).get(req.userId).total;

  res.json({
    overview: {
      totalCampaigns,
      runningCampaigns,
      mainBalance: mainWallet?.balance || 0,
      commissionBalance: commWallet?.balance || 0,
      todayViews: todayTraffic.views,
      todayClicks: todayTraffic.clicks,
      totalViews,
      totalSpent,
    },
  });
});

// ── GET /api/reports/traffic ──
router.get('/traffic', (req, res) => {
  const db = getDb();
  const { campaignId, from, to, period } = req.query;

  // Default: last 7 days
  let fromDate, toDate;
  if (from && to) {
    fromDate = from;
    toDate = to;
  } else {
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    toDate = new Date().toISOString().slice(0, 10);
    const f = new Date();
    f.setDate(f.getDate() - days);
    fromDate = f.toISOString().slice(0, 10);
  }

  let sql, params;

  if (campaignId) {
    // Specific campaign
    sql = `
      SELECT tl.date, tl.views, tl.clicks, tl.unique_ips, tl.source
      FROM traffic_logs tl
      JOIN campaigns c ON c.id = tl.campaign_id
      WHERE c.user_id = ? AND tl.campaign_id = ? AND tl.date BETWEEN ? AND ?
      ORDER BY tl.date ASC
    `;
    params = [req.userId, campaignId, fromDate, toDate];
  } else {
    // All campaigns aggregated by day
    sql = `
      SELECT tl.date, SUM(tl.views) as views, SUM(tl.clicks) as clicks, SUM(tl.unique_ips) as unique_ips
      FROM traffic_logs tl
      JOIN campaigns c ON c.id = tl.campaign_id
      WHERE c.user_id = ? AND tl.date BETWEEN ? AND ?
      GROUP BY tl.date
      ORDER BY tl.date ASC
    `;
    params = [req.userId, fromDate, toDate];
  }

  const data = db.prepare(sql).all(...params);

  // By-source breakdown
  const sourceSql = `
    SELECT tl.source, SUM(tl.views) as views, SUM(tl.clicks) as clicks
    FROM traffic_logs tl
    JOIN campaigns c ON c.id = tl.campaign_id
    WHERE c.user_id = ? AND tl.date BETWEEN ? AND ?
    GROUP BY tl.source
  `;
  const bySource = db.prepare(sourceSql).all(req.userId, fromDate, toDate);

  res.json({ traffic: data, bySource, period: { from: fromDate, to: toDate } });
});

module.exports = router;
