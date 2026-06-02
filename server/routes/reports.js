const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const geoip = require('geoip-lite');
const cache = require('../lib/cache');

const localDateStr = (d = new Date()) =>
  d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

const router = express.Router();
router.use(authMiddleware);

router.get('/overview', async (req, res) => {
  const uid = req.userId;
  try {
    const data = await cache.get(
      `reports:overview:${uid}`,
      async () => {
        const pool = getPool();
        const today = localDateStr();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fromDateTime = localDateStr(sevenDaysAgo) + ' 00:00:00';

        const [tcR, rcR, walletR, todayTR, totalVR, totalSR, viewR, spentR] = await Promise.all([
          pool.execute('SELECT COUNT(*) as count FROM campaigns WHERE user_id = ?', [uid]),
          pool.execute("SELECT COUNT(*) as count FROM campaigns WHERE user_id = ? AND status = 'running'", [uid]),
          pool.execute('SELECT type, balance FROM wallets WHERE user_id = ?', [uid]),
          pool.execute('SELECT COALESCE(SUM(views),0) as views, COALESCE(SUM(clicks),0) as clicks FROM traffic_logs tl JOIN campaigns c ON c.id = tl.campaign_id WHERE c.user_id = ? AND tl.date = ?', [uid, today]),
          pool.execute('SELECT COALESCE(SUM(views),0) as total, COALESCE(SUM(clicks),0) as totalClicks FROM traffic_logs tl JOIN campaigns c ON c.id = tl.campaign_id WHERE c.user_id = ?', [uid]),
          pool.execute("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND wallet_type = 'main' AND type = 'campaign' AND status = 'completed'", [uid]),
          pool.execute("SELECT DATE(completed_at) as day, COUNT(*) as views FROM vuot_link_tasks vlt JOIN campaigns c ON c.id = vlt.campaign_id WHERE c.user_id = ? AND vlt.status = 'completed' AND vlt.bot_detected = 0 AND completed_at >= ? GROUP BY 1 ORDER BY 1 ASC", [uid, fromDateTime]),
          pool.execute("SELECT DATE(created_at) as day, COALESCE(SUM(amount),0) as spent FROM transactions WHERE user_id = ? AND wallet_type = 'main' AND type = 'campaign' AND status = 'completed' AND created_at >= ? GROUP BY 1 ORDER BY 1 ASC", [uid, fromDateTime]),
        ]);

        const walletMap = {};
        walletR[0].forEach(w => { walletMap[w.type] = Number(w.balance); });

        const viewMap = {}, spentMap = {};
        viewR[0].forEach(r => { const k = r.day instanceof Date ? localDateStr(r.day) : String(r.day).slice(0,10); viewMap[k] = Number(r.views||0); });
        spentR[0].forEach(r => { const k = r.day instanceof Date ? localDateStr(r.day) : String(r.day).slice(0,10); spentMap[k] = Number(r.spent||0); });

        const chart = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const key = localDateStr(d);
          chart.push({ day: key, views: viewMap[key]||0, spent: spentMap[key]||0 });
        }

        return {
          overview: {
            totalCampaigns:    tcR[0][0].count,
            runningCampaigns:  rcR[0][0].count,
            mainBalance:       walletMap.main       || 0,
            commissionBalance: walletMap.commission || 0,
            todayViews:        todayTR[0][0].views,
            todayClicks:       todayTR[0][0].clicks,
            totalViews:        totalVR[0][0].total,
            totalClicks:       totalVR[0][0].totalClicks,
            totalSpent:        totalSR[0][0].total,
            chart,
          },
        };
      },
      30 * 1000,  // 30s TTL per user
      20 * 1000   // stale-while-revalidate
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// ── Export buyer tasks (completed only, with city + device info) ──
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
      'SELECT id, cpc FROM campaigns WHERE id = ? AND user_id = ?',
      [campaignId, req.userId]
    );
    if (!check.length) return res.status(403).json({ error: 'Forbidden' });

    const cpc = Number(check[0].cpc) || 0;

    const [rows] = await pool.execute(
      `SELECT vlt.id, vlt.keyword, vlt.ip_address, vlt.ip_country,
              vlt.user_agent, vlt.earning, vlt.created_at, vlt.completed_at
       FROM vuot_link_tasks vlt
       WHERE vlt.campaign_id = ? AND vlt.status = 'completed' AND vlt.bot_detected = 0
         AND DATE(vlt.created_at) >= ?
       ORDER BY vlt.completed_at DESC`,
      [campaignId, fromDate]
    );

    // ── Geo lookup: batch via ip-api.com (up to 100 per request) ──
    // Collect unique, valid public IPs
    const uniqueIps = [...new Set(
      rows.map(r => r.ip_address).filter(ip => {
        if (!ip) return false;
        // Skip private/loopback ranges
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1|fe80)/i.test(ip)) return false;
        return true;
      })
    )];

    const geoMap = {}; // ip -> { country, city }

    // Batch requests: 100 IPs per call, chạy song song tối đa 5 batch
    const BATCH = 100;
    const PARALLEL = 5;

    const callIpApi = (batch) => new Promise((resolve) => {
      const body = JSON.stringify(batch.map(ip => ({ query: ip, fields: 'query,country,city,status' })));
      const options = {
        hostname: 'ip-api.com',
        path: '/batch?fields=query,country,city,status',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      };
      const req2 = require('http').request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve([]); } });
      });
      req2.on('error', () => resolve([]));
      req2.setTimeout(5000, () => { req2.destroy(); resolve([]); });
      req2.write(body);
      req2.end();
    });

    const batches = [];
    for (let i = 0; i < uniqueIps.length; i += BATCH) batches.push(uniqueIps.slice(i, i + BATCH));
    for (let i = 0; i < batches.length; i += PARALLEL) {
      const group = batches.slice(i, i + PARALLEL);
      const results = await Promise.all(group.map(b => callIpApi(b).catch(() => [])));
      results.forEach(result => {
        if (Array.isArray(result)) {
          result.forEach(r => {
            if (r.status === 'success' && r.query) geoMap[r.query] = { country: r.country || '', city: r.city || '' };
          });
        }
      });
    }

    // Fallback: use geoip-lite for IPs not resolved by ip-api.com
    uniqueIps.forEach(ip => {
      if (!geoMap[ip]) {
        const geo = geoip.lookup(ip);
        if (geo) geoMap[ip] = { country: geo.country || '', city: geo.city || '' };
      }
    });

    // Helper: detect device from user agent
    const detectDevice = (ua) => {
      if (!ua) return 'Unknown';
      if (/mobile|android|iphone|ipad/i.test(ua)) return 'Mobile';
      if (/tablet/i.test(ua)) return 'Tablet';
      return 'Desktop';
    };

    const tasks = rows.map((r, i) => {
      const geo = geoMap[r.ip_address] || {};
      const country = r.ip_country || geo.country || '';
      const city = geo.city || '';
      const device = detectDevice(r.user_agent);
      const spending = cpc; // Chi tiêu của buyer = CPC campaign (giá sau discount, không phải earning của worker)

      return {
        stt: i + 1,
        id: r.id,
        keyword: r.keyword || '',
        ip: r.ip_address || '',
        country,
        city,
        device,
        userAgent: r.user_agent || '',
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
        `SELECT DATE(vlt.created_at) as date, vlt.keyword, c.daily_views as campaign_daily_views,
                c.keyword_config,
                COUNT(*) as total,
                SUM(CASE WHEN vlt.status = 'completed' AND vlt.bot_detected = 0 THEN 1 ELSE 0 END) as completed,
                COALESCE(SUM(vlt.earning), 0) as cost
         FROM vuot_link_tasks vlt
         JOIN campaigns c ON c.id = vlt.campaign_id
         WHERE c.user_id = ? AND vlt.campaign_id = ? AND DATE(vlt.created_at) >= ?
         GROUP BY date, c.daily_views, c.keyword_config, vlt.keyword
         ORDER BY date DESC, completed DESC`,
        [req.userId, campaignId, fromDate]
      );
    } else {
      [data] = await pool.execute(
        `SELECT DATE(vlt.created_at) as date, c.name as campaign_name, c.daily_views as campaign_daily_views,
                c.keyword_config, vlt.keyword,
                COUNT(*) as total,
                SUM(CASE WHEN vlt.status = 'completed' AND vlt.bot_detected = 0 THEN 1 ELSE 0 END) as completed,
                COALESCE(SUM(vlt.earning), 0) as cost
         FROM vuot_link_tasks vlt
         JOIN campaigns c ON c.id = vlt.campaign_id
         WHERE c.user_id = ? AND DATE(vlt.created_at) >= ?
         GROUP BY date, c.id, c.daily_views, c.keyword_config, vlt.keyword
         ORDER BY date DESC, completed DESC LIMIT 1000`,
        [req.userId, fromDate]
      );
    }

    // — Tính per-keyword daily_views và keyword_views (tổng view target) từ keyword_config —
    const safeData = data.map(r => {
      let kwDailyViews = Number(r.campaign_daily_views) || 0;
      let kwTotalViews = 0; // tổng view target của keyword này
      try {
        const cfg = r.keyword_config ? JSON.parse(r.keyword_config) : null;
        if (Array.isArray(cfg) && cfg.length > 0) {
          const kwEntry = cfg.find(k => k.keyword === r.keyword);
          if (kwEntry) {
            // Tổng view target của keyword
            kwTotalViews = Number(kwEntry.views) || 0;

            if (Number(kwEntry.daily_views) > 0) {
              // Keyword có daily_views riêng → dùng cái đó
              kwDailyViews = Number(kwEntry.daily_views);
            } else {
              // Keyword không set riêng → tính phần còn lại chia đều
              const explicit = cfg.filter(k => Number(k.daily_views) > 0);
              const totalExplicit = explicit.reduce((s, k) => s + Number(k.daily_views), 0);
              const unsetCount = cfg.filter(k => !(Number(k.daily_views) > 0)).length;
              const remaining = Math.max(0, Number(r.campaign_daily_views) - totalExplicit);
              kwDailyViews = unsetCount > 0 && Number(r.campaign_daily_views) > 0
                ? Math.floor(remaining / unsetCount)
                : 0;
            }
          }
        }
      } catch (_) { /* fallback to campaign_daily_views */ }

      const { keyword_config, campaign_daily_views, ...rest } = r;
      return {
        ...rest,
        date: localDateStr(new Date(r.date)),
        daily_views: kwDailyViews,
        keyword_views: kwTotalViews, // tổng view target của keyword (dùng cho tiến độ)
      };
    });
    res.json({ detailed: safeData });
  } catch (err) {
    console.error('reports/detailed error:', err.message);
    res.status(500).json({ error: 'Internal server error', detailed: [] });
  }
});

module.exports = router;
