const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/notifications ──
router.get('/', async (req, res) => {
  const pool = getPool();
  const [notifications] = await pool.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.userId]);
  const [unread] = await pool.execute('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.userId]);
  res.json({ notifications, unreadCount: unread[0].count });
});

// ── PUT /api/notifications/:id/read ──
router.put('/:id/read', async (req, res) => {
  const pool = getPool();
  await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ message: 'Đã đánh dấu đã đọc' });
});

// ── PUT /api/notifications/read-all ──
router.put('/read-all', async (req, res) => {
  const pool = getPool();
  await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.userId]);
  res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
});

module.exports = router;
