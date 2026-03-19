const express = require('express');
const { getPool } = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Bot user-agent patterns
const BOT_UA = /bot|crawler|spider|curl|wget|python|httpie|postman|insomnia|axios|node-fetch|headlesschrome|phantomjs|selenium/i;

// IP rate limit: max 10 tasks/hour
const ipTaskCount = {};
setInterval(() => { Object.keys(ipTaskCount).forEach(k => delete ipTaskCount[k]); }, 60 * 60 * 1000);

// ── POST /api/vuot-link/task (PUBLIC) ──
router.post('/task', optionalAuth, async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (!ua || BOT_UA.test(ua)) return res.status(403).json({ error: 'Trình duyệt không hợp lệ' });

  // Rate limit by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  ipTaskCount[ip] = (ipTaskCount[ip] || 0) + 1;
  if (ipTaskCount[ip] > 10) return res.status(429).json({ error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' });

  // Validate proof from frontend
  const { proof } = req.body || {};
  if (proof) {
    if (proof.botScore >= 40) return res.status(403).json({ error: 'Trình duyệt không hợp lệ' });
    if (proof.sw === 0 || proof.sh === 0) return res.status(403).json({ error: 'Trình duyệt không hợp lệ' });
  }

  const pool = getPool();
  const [campaigns] = await pool.execute(
    `SELECT * FROM campaigns WHERE status = 'running' AND traffic_type = 'google_search' AND keyword != '' AND views_done < total_views ORDER BY RAND() LIMIT 1`
  );
  if (campaigns.length === 0) return res.status(404).json({ error: 'Hiện không có task vượt link nào' });
  const campaign = campaigns[0];

  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const session = require('crypto').randomBytes(16).toString('hex');

  const [result] = await pool.execute(
    `INSERT INTO vuot_link_tasks (campaign_id, worker_id, keyword, target_url, target_page, status, expires_at) VALUES (?, ?, ?, ?, ?, 'assigned', ?)`,
    [campaign.id, req.userId || null, campaign.keyword, campaign.url, campaign.target_page || '', expiresAt]
  );

  res.json({
    task: { id: result.insertId, keyword: campaign.keyword, session, startedAt, expiresAt },
  });
});

// ── PUT /api/vuot-link/task/:id/step ──
router.put('/task/:id/step', optionalAuth, async (req, res) => {
  const pool = getPool();
  const { step } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  const [tasks] = await pool.execute('SELECT * FROM vuot_link_tasks WHERE id = ?', [req.params.id]);
  if (tasks.length === 0) return res.status(404).json({ error: 'Task không tồn tại' });
  const task = tasks[0];

  if (task.expires_at && new Date(task.expires_at) < new Date()) {
    await pool.execute("UPDATE vuot_link_tasks SET status = 'expired' WHERE id = ?", [task.id]);
    return res.status(410).json({ error: 'Task đã hết hạn' });
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (step === 'step1') {
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step1', step1_at = ?, ip_address = ?, user_agent = ? WHERE id = ?", [now, ip, ua, task.id]);
  } else if (step === 'step2') {
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step2', step2_at = ? WHERE id = ?", [now, task.id]);
  } else if (step === 'step3') {
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step3', step3_at = ? WHERE id = ?", [now, task.id]);
  } else {
    return res.status(400).json({ error: 'Step không hợp lệ' });
  }

  res.json({ message: `Đã cập nhật ${step}`, status: step });
});

// ── POST /api/vuot-link/task/:id/complete ──
router.post('/task/:id/complete', optionalAuth, async (req, res) => {
  const pool = getPool();
  const { timeOnSite } = req.body;

  const [tasks] = await pool.execute('SELECT * FROM vuot_link_tasks WHERE id = ?', [req.params.id]);
  if (tasks.length === 0) return res.status(404).json({ error: 'Task không tồn tại' });
  const task = tasks[0];
  if (task.status === 'completed') return res.status(400).json({ error: 'Task đã hoàn thành rồi' });

  const [campaigns] = await pool.execute('SELECT cpc, user_id FROM campaigns WHERE id = ?', [task.campaign_id]);
  if (campaigns.length === 0) return res.status(404).json({ error: 'Campaign không tồn tại' });
  const campaign = campaigns[0];

  const earning = campaign.cpc;
  const code = 'CODE-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  await pool.execute(
    `UPDATE vuot_link_tasks SET status = 'completed', completed_at = ?, time_on_site = ?, earning = ?, code_given = ? WHERE id = ?`,
    [now, timeOnSite || 0, earning, code, task.id]
  );

  await pool.execute('UPDATE campaigns SET views_done = views_done + 1 WHERE id = ?', [task.campaign_id]);

  const today = new Date().toISOString().slice(0, 10);
  const [logs] = await pool.execute('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = ?', [task.campaign_id, today]);
  if (logs.length > 0) {
    await pool.execute('UPDATE traffic_logs SET views = views + 1, clicks = clicks + 1 WHERE id = ?', [logs[0].id]);
  } else {
    await pool.execute('INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source) VALUES (?, ?, 1, 1, 1, ?)', [task.campaign_id, today, campaign.traffic_type || 'google_search']);
  }

  if (task.worker_id) {
    await pool.execute("UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = 'commission'", [earning, task.worker_id]);
    const refCode = 'VL-' + Date.now();
    await pool.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, 'commission', 'commission', 'system', ?, 'completed', ?, ?)`,
      [task.worker_id, earning, refCode, `Vượt link task #${task.id}`]
    );
  }

  res.json({ message: 'Hoàn thành vượt link!', code, earning });
});

// ── Protected: stats ──
router.use(authMiddleware);

router.get('/stats', async (req, res) => {
  const pool = getPool();
  const [total] = await pool.execute(
    `SELECT COUNT(*) as total,
      SUM(CASE WHEN vt.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN vt.status IN ('pending','assigned') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN vt.status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN vt.status = 'completed' THEN vt.earning ELSE 0 END) as totalEarning
    FROM vuot_link_tasks vt JOIN campaigns c ON c.id = vt.campaign_id WHERE c.user_id = ?`,
    [req.userId]
  );

  const [recent] = await pool.execute(
    `SELECT vt.*, c.name as campaign_name FROM vuot_link_tasks vt JOIN campaigns c ON c.id = vt.campaign_id WHERE c.user_id = ? ORDER BY vt.created_at DESC LIMIT 20`,
    [req.userId]
  );

  res.json({ stats: total[0], recent });
});

module.exports = router;
