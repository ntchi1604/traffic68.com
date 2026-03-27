/**
 * Buyer Public API — /api/buyer/v1
 * Xác thực: Authorization: Bearer tf68_xxx (API key, cùng bảng api_keys với worker)
 *
 * Endpoints:
 *  GET  /v1/me               — Thông tin tài khoản + số dư
 *  GET  /v1/pricing          — Bảng giá
 *  GET  /v1/campaigns        — Danh sách chiến dịch
 *  POST /v1/campaigns        — Tạo chiến dịch mới
 *  GET  /v1/campaigns/:id    — Chi tiết chiến dịch
 *  PUT  /v1/campaigns/:id/status — Dừng / tiếp tục chiến dịch
 *  GET  /v1/campaigns/:id/stats  — Thống kê lượt xem theo ngày
 */

const express = require('express');
const { getPool } = require('../db');

const router = express.Router();

/* ── API-key auth middleware ─────────────────────── */
async function apiKeyAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  if (!token) {
    return res.status(401).json({
      error: 'API key required',
      hint: 'Add header: Authorization: Bearer YOUR_API_KEY',
    });
  }
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT ak.id, ak.user_id, u.name, u.email, u.status
       FROM api_keys ak JOIN users u ON u.id = ak.user_id
       WHERE ak.api_key = ? AND ak.active = 1`,
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid or revoked API key' });
    if (rows[0].status !== 'active') return res.status(403).json({ error: 'Account suspended' });

    pool.execute(
      'UPDATE api_keys SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = ?',
      [rows[0].id]
    );
    req.userId   = rows[0].user_id;
    req.userName = rows[0].name;
    req.userEmail = rows[0].email;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.use('/v1', apiKeyAuth);

/* ─────────────────────────────────────────────────
   GET /v1/me — Tài khoản + số dư
   ───────────────────────────────────────────────── */
router.get('/v1/me', async (req, res) => {
  try {
    const pool = getPool();
    const [wallets] = await pool.execute(
      `SELECT type, balance FROM wallets WHERE user_id = ? AND type IN ('main','earning')`,
      [req.userId]
    );
    const w = {};
    wallets.forEach(r => { w[r.type] = Number(r.balance); });

    const [campStats] = await pool.execute(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
         SUM(CASE WHEN status = 'paused'  THEN 1 ELSE 0 END) as paused,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         COALESCE(SUM(budget),0) as total_budget_allocated
       FROM campaigns WHERE user_id = ?`,
      [req.userId]
    );

    res.json({
      user: { id: req.userId, name: req.userName, email: req.userEmail },
      wallet: {
        main_balance: w.main || 0,
        earning_balance: w.earning || 0,
      },
      campaigns: campStats[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────
   GET /v1/pricing — Bảng giá hiện tại
   ───────────────────────────────────────────────── */
router.get('/v1/pricing', async (req, res) => {
  try {
    const pool = getPool();
    const [tiers] = await pool.execute(
      `SELECT traffic_type, duration, v1_price, v2_price FROM pricing_tiers ORDER BY traffic_type, CAST(REPLACE(duration,'s','') AS UNSIGNED)`
    );
    // Group by traffic_type
    const grouped = {};
    tiers.forEach(t => {
      if (!grouped[t.traffic_type]) grouped[t.traffic_type] = [];
      grouped[t.traffic_type].push({
        duration_seconds: parseInt(t.duration),
        price_v1_per_view: t.v1_price,
        price_v2_per_view: t.v2_price,
      });
    });
    res.json({ pricing: grouped, currency: 'VND' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────
   GET /v1/campaigns — Danh sách chiến dịch
   Query: ?status=running|paused|completed&page=1&limit=20
   ───────────────────────────────────────────────── */
router.get('/v1/campaigns', async (req, res) => {
  try {
    const pool = getPool();
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let sql = `SELECT id, name, url, url2, traffic_type, version, status, budget, cpc,
                      daily_views, total_views, keyword, time_on_site, created_at, updated_at
               FROM campaigns WHERE user_id = ?`;
    const params = [req.userId];
    if (status && ['running', 'paused', 'completed'].includes(status)) {
      sql += ' AND status = ?'; params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [campaigns] = await pool.execute(sql, params);
    const [countRow] = await pool.execute(
      `SELECT COUNT(*) as c FROM campaigns WHERE user_id = ?${status ? ' AND status = ?' : ''}`,
      status ? [req.userId, status] : [req.userId]
    );

    // Attach live stats (completed views + cost spent)
    const ids = campaigns.map(c => c.id);
    let statsMap = {};
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      const [stats] = await pool.execute(
        `SELECT campaign_id,
                COUNT(*) as total_tasks,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_views,
                COALESCE(SUM(earning), 0) as cost_spent
         FROM vuot_link_tasks WHERE campaign_id IN (${ph}) GROUP BY campaign_id`,
        ids
      );
      stats.forEach(s => { statsMap[s.campaign_id] = s; });
    }

    res.json({
      campaigns: campaigns.map(c => ({
        ...c,
        version: c.version === 2 ? 'v2' : 'v1',
        completed_views: Number(statsMap[c.id]?.completed_views || 0),
        cost_spent:      Number(statsMap[c.id]?.cost_spent || 0),
        budget:          Number(c.budget),
        cpc:             Number(c.cpc),
      })),
      pagination: { page, limit, total: countRow[0].c, pages: Math.ceil(countRow[0].c / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────
   POST /v1/campaigns — Tạo chiến dịch mới
   Body: { name, url, traffic_type, total_views, duration, version, keyword, daily_views, url2, view_by_hour }
   ───────────────────────────────────────────────── */
router.post('/v1/campaigns', async (req, res) => {
  try {
    const pool = getPool();
    const {
      name, url, url2,
      traffic_type = 'google_search',
      total_views  = 1000,
      daily_views  = 500,
      view_by_hour = 0,
      duration,       // seconds, e.g. 60
      version  = 'v1',
      keyword  = '',
    } = req.body;

    if (!name || !url) return res.status(400).json({ error: 'name and url are required' });

    // Validate URL
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid url' }); }
    if (url2) { try { new URL(url2); } catch { return res.status(400).json({ error: 'Invalid url2' }); } }

    const validTraffic = ['google_search', 'direct', 'social'];
    if (!validTraffic.includes(traffic_type)) {
      return res.status(400).json({ error: `traffic_type must be one of: ${validTraffic.join(', ')}` });
    }
    if (!['v1', 'v2'].includes(version)) {
      return res.status(400).json({ error: 'version must be v1 or v2' });
    }
    if (total_views < 100) return res.status(400).json({ error: 'total_views minimum is 100' });

    // Calculate budget from pricing
    const durSec = duration ? duration + 's' : '60s';
    const [tiers] = await pool.execute(
      'SELECT * FROM pricing_tiers WHERE traffic_type = ? AND duration = ?',
      [traffic_type, durSec]
    );
    if (!tiers.length) {
      return res.status(400).json({ error: `No pricing found for traffic_type=${traffic_type} duration=${durSec}. Check GET /v1/pricing` });
    }
    const tier = tiers[0];
    const pricePerView = version === 'v2' ? tier.v2_price : tier.v1_price;
    const budget = Math.round(total_views * pricePerView);
    const cpc    = pricePerView;

    // Check wallet balance
    const [wallets] = await pool.execute(
      'SELECT balance FROM wallets WHERE user_id = ? AND type = ?',
      [req.userId, 'main']
    );
    const balance = Number(wallets[0]?.balance || 0);
    if (balance < budget) {
      return res.status(402).json({
        error: 'Insufficient balance',
        required: budget,
        available: balance,
        currency: 'VND',
      });
    }

    const versionInt = version === 'v2' ? 2 : 1;
    const timeOnSite = duration ? String(duration) : '60';

    const [result] = await pool.execute(
      `INSERT INTO campaigns (user_id, name, url, url2, traffic_type, version, budget, cpc, daily_views, total_views, view_by_hour, keyword, time_on_site)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, name, url, url2 || null, traffic_type, versionInt, budget, cpc, daily_views, total_views, view_by_hour, keyword, timeOnSite]
    );

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign: {
        id: result.insertId,
        name, url, url2: url2 || null,
        traffic_type, version,
        status: 'running',
        total_views, daily_views, duration_seconds: parseInt(duration) || 60, keyword,
        budget, cpc, currency: 'VND',
        note: 'Budget is deducted as views are completed, not upfront.',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────
   GET /v1/campaigns/:id — Chi tiết chiến dịch
   ───────────────────────────────────────────────── */
router.get('/v1/campaigns/:id', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, name, url, url2, traffic_type, version, status, budget, cpc,
              daily_views, total_views, view_by_hour, keyword, time_on_site, created_at, updated_at
       FROM campaigns WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found' });

    const c = rows[0];
    const [stats] = await pool.execute(
      `SELECT
         COUNT(*) as total_tasks,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_views,
         SUM(CASE WHEN status = 'expired'   THEN 1 ELSE 0 END) as expired,
         SUM(CASE WHEN bot_detected = 1     THEN 1 ELSE 0 END) as bot_blocked,
         COALESCE(SUM(earning), 0) as cost_spent
       FROM vuot_link_tasks WHERE campaign_id = ?`,
      [c.id]
    );
    const s = stats[0];

    res.json({
      ...c,
      version: c.version === 2 ? 'v2' : 'v1',
      budget: Number(c.budget),
      cpc: Number(c.cpc),
      stats: {
        completed_views: Number(s.completed_views || 0),
        expired:         Number(s.expired || 0),
        bot_blocked:     Number(s.bot_blocked || 0),
        cost_spent:      Number(s.cost_spent || 0),
        remaining_budget: Math.max(0, Number(c.budget) - Number(s.cost_spent || 0)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────
   PUT /v1/campaigns/:id/status — Dừng / tiếp tục
   Body: { status: "running" | "paused" }
   ───────────────────────────────────────────────── */
router.put('/v1/campaigns/:id/status', async (req, res) => {
  try {
    const pool = getPool();
    const { status } = req.body;
    if (!['running', 'paused'].includes(status)) {
      return res.status(400).json({ error: 'status must be "running" or "paused"' });
    }
    const [result] = await pool.execute(
      'UPDATE campaigns SET status = ? WHERE id = ? AND user_id = ?',
      [status, req.params.id, req.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ message: `Campaign ${status === 'running' ? 'resumed' : 'paused'}`, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────
   GET /v1/campaigns/:id/stats — Thống kê theo ngày
   Query: ?days=7 (default 7, max 30)
   ───────────────────────────────────────────────── */
router.get('/v1/campaigns/:id/stats', async (req, res) => {
  try {
    const pool = getPool();
    const [camp] = await pool.execute(
      'SELECT id FROM campaigns WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (!camp.length) return res.status(404).json({ error: 'Campaign not found' });

    const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));

    const [daily] = await pool.execute(
      `SELECT
         DATE(created_at) as date,
         COUNT(*) as total,
         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status='expired'   THEN 1 ELSE 0 END) as expired,
         SUM(CASE WHEN bot_detected=1     THEN 1 ELSE 0 END) as bot_blocked,
         COALESCE(SUM(earning), 0) as cost
       FROM vuot_link_tasks
       WHERE campaign_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [req.params.id, days]
    );

    res.json({
      campaign_id: parseInt(req.params.id),
      days,
      daily: daily.map(d => ({
        date: d.date,
        completed_views: Number(d.completed),
        expired: Number(d.expired),
        bot_blocked: Number(d.bot_blocked),
        cost: Number(d.cost),
      })),
      totals: {
        completed_views: daily.reduce((s, d) => s + Number(d.completed), 0),
        cost: daily.reduce((s, d) => s + Number(d.cost), 0),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
