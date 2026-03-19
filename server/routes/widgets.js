const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/* ═══════════════════════════════════════════════════════════
   PUBLIC endpoints — called by api_seo_traffic68.js
   No authentication required
═══════════════════════════════════════════════════════════ */

// ── GET /api/widgets/public/:token ──
// Script nhúng gọi endpoint này để lấy config widget
router.get('/public/:token', (req, res) => {
  const db = getDb();
  const widget = db.prepare('SELECT * FROM widgets WHERE token = ? AND is_active = 1').get(req.params.token);

  if (!widget) {
    return res.status(404).json({ error: 'Widget không tồn tại hoặc đã bị tắt' });
  }

  let config = {};
  try { config = JSON.parse(widget.config || '{}'); } catch {}

  res.json({
    token: widget.token,
    name: widget.name,
    config,
  });
});

// ── POST /api/widgets/public/:token/get-code ──
// Worker nhấn nút "Lấy Mã" → hệ thống random code và trả về
router.post('/public/:token/get-code', (req, res) => {
  const db = getDb();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';
  const { taskId } = req.body; // optional: nếu worker đã có task

  // Verify widget
  const widget = db.prepare('SELECT * FROM widgets WHERE token = ? AND is_active = 1').get(req.params.token);
  if (!widget) {
    return res.status(404).json({ error: 'Widget không tồn tại' });
  }

  // Tìm campaign đang chạy có liên kết
  const campaign = db.prepare(`
    SELECT * FROM campaigns
    WHERE user_id = ?
      AND status = 'running'
      AND views_done < total_views
    ORDER BY RANDOM()
    LIMIT 1
  `).get(widget.user_id);

  // Generate random code
  const randomCode = 'T68-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const now = new Date().toISOString();

  if (campaign) {
    // Tạo vuot_link_task record
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 phút
    const taskResult = db.prepare(`
      INSERT INTO vuot_link_tasks (campaign_id, keyword, target_url, target_page, status, ip_address, user_agent, code_given, completed_at, expires_at)
      VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)
    `).run(
      campaign.id,
      campaign.keyword || '',
      campaign.url,
      campaign.target_page || '',
      ip, ua,
      randomCode,
      now,
      expiresAt,
    );

    // Cập nhật campaign views_done
    db.prepare('UPDATE campaigns SET views_done = views_done + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(campaign.id);

    // Cập nhật traffic_logs
    const today = new Date().toISOString().slice(0, 10);
    const existingLog = db.prepare('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = ?')
      .get(campaign.id, today);

    if (existingLog) {
      db.prepare('UPDATE traffic_logs SET views = views + 1, clicks = clicks + 1 WHERE id = ?')
        .run(existingLog.id);
    } else {
      db.prepare('INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source) VALUES (?, ?, 1, 1, 1, ?)')
        .run(campaign.id, today, campaign.traffic_type || 'google_search');
    }
  }

  res.json({
    success: true,
    code: randomCode,
    message: 'Lấy mã thành công!',
  });
});


/* ═══════════════════════════════════════════════════════════
   PROTECTED endpoints — require authentication
   User manages their widgets
═══════════════════════════════════════════════════════════ */
router.use(authMiddleware);

// ── GET /api/widgets ──
router.get('/', (req, res) => {
  const db = getDb();
  const widgets = db.prepare('SELECT * FROM widgets WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);

  res.json({
    widgets: widgets.map(w => {
      let config = {};
      try { config = JSON.parse(w.config || '{}'); } catch {}
      return { ...w, config };
    }),
  });
});

// ── POST /api/widgets ──
router.post('/', (req, res) => {
  const db = getDb();
  const { name, config } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Tên widget là bắt buộc' });
  }

  // Generate unique token
  const token = 'T68-' + crypto.randomBytes(6).toString('hex').toUpperCase();

  const configStr = typeof config === 'string' ? config : JSON.stringify(config || {});

  const result = db.prepare(`
    INSERT INTO widgets (user_id, token, name, config)
    VALUES (?, ?, ?, ?)
  `).run(req.userId, token, name, configStr);

  const widget = db.prepare('SELECT * FROM widgets WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({
    message: 'Tạo widget thành công',
    token: widget.token,
    widget: {
      ...widget,
      config: JSON.parse(widget.config || '{}'),
    },
  });
});

// ── PUT /api/widgets/:id ──
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM widgets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);

  if (!existing) return res.status(404).json({ error: 'Widget không tồn tại' });

  const { name, config, is_active } = req.body;
  const configStr = config ? (typeof config === 'string' ? config : JSON.stringify(config)) : null;

  db.prepare(`
    UPDATE widgets SET
      name = COALESCE(?, name),
      config = COALESCE(?, config),
      is_active = COALESCE(?, is_active),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(name, configStr, is_active, req.params.id, req.userId);

  const widget = db.prepare('SELECT * FROM widgets WHERE id = ?').get(req.params.id);
  res.json({
    message: 'Cập nhật thành công',
    widget: { ...widget, config: JSON.parse(widget.config || '{}') },
  });
});

// ── DELETE /api/widgets/:id ──
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM widgets WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);

  if (result.changes === 0) return res.status(404).json({ error: 'Widget không tồn tại' });
  res.json({ message: 'Đã xoá widget' });
});

module.exports = router;
