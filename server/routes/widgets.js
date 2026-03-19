const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/widgets/:token (PUBLIC — no auth) ──
router.get('/:token', (req, res) => {
  const db = getDb();
  const widget = db.prepare('SELECT config, is_active FROM widgets WHERE token = ?').get(req.params.token);

  if (!widget) return res.status(404).json({ error: 'Widget không tồn tại' });
  if (!widget.is_active) return res.status(403).json({ error: 'Widget đã bị vô hiệu hóa' });

  try {
    const config = JSON.parse(widget.config);
    res.json(config);
  } catch {
    res.status(500).json({ error: 'Config lỗi' });
  }
});

// ── Protected routes ──
router.use(authMiddleware);

// ── GET /api/widgets ──
router.get('/', (req, res) => {
  const db = getDb();
  const widgets = db.prepare('SELECT * FROM widgets WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);

  // Parse config JSON
  const result = widgets.map((w) => ({
    ...w,
    config: JSON.parse(w.config || '{}'),
  }));

  res.json({ widgets: result });
});

// ── POST /api/widgets ──
router.post('/', (req, res) => {
  const db = getDb();
  const { name, config } = req.body;

  if (!config) return res.status(400).json({ error: 'Config là bắt buộc' });

  // Generate unique token
  const token = 'T68-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  db.prepare(`
    INSERT INTO widgets (user_id, token, name, config)
    VALUES (?, ?, ?, ?)
  `).run(req.userId, token, name || 'Nút mới', JSON.stringify(config));

  res.status(201).json({ message: 'Tạo widget thành công', token });
});

// ── PUT /api/widgets/:id ──
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, config, isActive } = req.body;

  const existing = db.prepare('SELECT * FROM widgets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy widget' });

  db.prepare(`
    UPDATE widgets SET
      name = COALESCE(?, name),
      config = COALESCE(?, config),
      is_active = COALESCE(?, is_active),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    name || null,
    config ? JSON.stringify(config) : null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    req.params.id, req.userId,
  );

  res.json({ message: 'Cập nhật thành công' });
});

// ── DELETE /api/widgets/:id ──
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM widgets WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy widget' });
  res.json({ message: 'Đã xoá widget' });
});

module.exports = router;
