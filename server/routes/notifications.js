const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/notifications?role=buyer|worker ──
router.get('/', async (req, res) => {
  const pool = getPool();
  const role = req.query.role || 'all'; // buyer, worker, or all
  const [notifications] = await pool.execute(
    `SELECT * FROM notifications WHERE user_id = ? AND (role = ? OR role = 'all') ORDER BY created_at DESC LIMIT 50`,
    [req.userId, role]
  );
  const [unread] = await pool.execute(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0 AND (role = ? OR role = 'all')`,
    [req.userId, role]
  );
  // Strip specific emojis correctly and cleanly
  const cleanObj = (obj) => {
    return {
      ...obj,
      title: obj.title?.replace(/[✅🎉]/g, '')?.replace(/\s+/g, ' ')?.trim(),
      message: obj.message?.replace(/[✅🎉]/g, '')?.replace(/\s+/g, ' ')?.trim()
    };
  };

  res.json({ 
    notifications: notifications.map(cleanObj), 
    unreadCount: unread[0].count 
  });
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
  const role = req.query.role || 'all';
  if (role === 'all') {
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.userId]);
  } else {
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND (role = ? OR role = \'all\')', [req.userId, role]);
  }
  res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
});

module.exports = router;
