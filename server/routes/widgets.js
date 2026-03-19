const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/* ═══════════════════════════════════════════════════════════
   PUBLIC endpoints — called by api_seo_traffic68.js
═══════════════════════════════════════════════════════════ */

// ── GET /api/widgets/public/:token ──
router.get('/public/:token', async (req, res) => {
  const pool = getPool();
  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại hoặc đã bị tắt' });

  let config = {};
  try { config = JSON.parse(widgets[0].config || '{}'); } catch {}
  res.json({ token: widgets[0].token, name: widgets[0].name, config });
});

// ── POST /api/widgets/public/:token/get-code ──
router.post('/public/:token/get-code', async (req, res) => {
  const pool = getPool();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại' });
  const widget = widgets[0];

  const [campaigns] = await pool.execute(
    `SELECT * FROM campaigns WHERE user_id = ? AND status = 'running' AND views_done < total_views ORDER BY RAND() LIMIT 1`,
    [widget.user_id]
  );

  const randomCode = 'T68-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const campaign = campaigns[0];

  if (campaign) {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute(
      `INSERT INTO vuot_link_tasks (campaign_id, keyword, target_url, target_page, status, ip_address, user_agent, code_given, completed_at, expires_at) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
      [campaign.id, campaign.keyword || '', campaign.url, campaign.target_page || '', ip, ua, randomCode, now, expiresAt]
    );

    await pool.execute('UPDATE campaigns SET views_done = views_done + 1 WHERE id = ?', [campaign.id]);

    const today = new Date().toISOString().slice(0, 10);
    const [logs] = await pool.execute('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = ?', [campaign.id, today]);
    if (logs.length > 0) {
      await pool.execute('UPDATE traffic_logs SET views = views + 1, clicks = clicks + 1 WHERE id = ?', [logs[0].id]);
    } else {
      await pool.execute('INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source) VALUES (?, ?, 1, 1, 1, ?)', [campaign.id, today, campaign.traffic_type || 'google_search']);
    }
  }

  res.json({ success: true, code: randomCode, message: 'Lấy mã thành công!' });
});

/* ═══════════════════════════════════════════════════════════
   PROTECTED endpoints
═══════════════════════════════════════════════════════════ */
router.use(authMiddleware);

// ── GET /api/widgets ──
router.get('/', async (req, res) => {
  const pool = getPool();
  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
  res.json({
    widgets: widgets.map(w => {
      let config = {};
      try { config = JSON.parse(w.config || '{}'); } catch {}
      return { ...w, config };
    }),
  });
});

// ── POST /api/widgets ──
router.post('/', async (req, res) => {
  const pool = getPool();
  const { name, config } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên widget là bắt buộc' });

  const token = 'T68-' + crypto.randomBytes(6).toString('hex').toUpperCase();
  const configStr = typeof config === 'string' ? config : JSON.stringify(config || {});

  const [result] = await pool.execute(`INSERT INTO widgets (user_id, token, name, config) VALUES (?, ?, ?, ?)`, [req.userId, token, name, configStr]);
  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE id = ?', [result.insertId]);
  res.status(201).json({
    message: 'Tạo widget thành công', token: widgets[0].token,
    widget: { ...widgets[0], config: JSON.parse(widgets[0].config || '{}') },
  });
});

// ── PUT /api/widgets/:id ──
router.put('/:id', async (req, res) => {
  const pool = getPool();
  const [existing] = await pool.execute('SELECT * FROM widgets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (existing.length === 0) return res.status(404).json({ error: 'Widget không tồn tại' });

  const { name, config, is_active } = req.body;
  const configStr = config ? (typeof config === 'string' ? config : JSON.stringify(config)) : null;
  await pool.execute(
    `UPDATE widgets SET name=COALESCE(?,name), config=COALESCE(?,config), is_active=COALESCE(?,is_active) WHERE id = ? AND user_id = ?`,
    [name, configStr, is_active, req.params.id, req.userId]
  );

  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE id = ?', [req.params.id]);
  res.json({ message: 'Cập nhật thành công', widget: { ...widgets[0], config: JSON.parse(widgets[0].config || '{}') } });
});

// ── DELETE /api/widgets/:id ──
router.delete('/:id', async (req, res) => {
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM widgets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Widget không tồn tại' });
  res.json({ message: 'Đã xoá widget' });
});

module.exports = router;
