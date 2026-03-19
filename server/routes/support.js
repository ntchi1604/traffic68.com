const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── POST /api/support/tickets ──
router.post('/tickets', async (req, res) => {
  const { subject, description, priority } = req.body;
  if (!subject) return res.status(400).json({ error: 'Chủ đề là bắt buộc' });

  const pool = getPool();
  const validPriority = ['low', 'medium', 'high', 'urgent'];
  const prio = validPriority.includes(priority) ? priority : 'medium';

  const [result] = await pool.execute(
    `INSERT INTO support_tickets (user_id, subject, description, priority) VALUES (?, ?, ?, ?)`,
    [req.userId, subject, description || '', prio]
  );

  await pool.execute(
    `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
    [req.userId, 'Yêu cầu hỗ trợ đã gửi', `Ticket #${result.insertId}: "${subject}" đã được tạo. Chúng tôi sẽ phản hồi sớm nhất.`, 'info']
  );

  res.status(201).json({ message: 'Gửi yêu cầu hỗ trợ thành công', ticketId: result.insertId });
});

// ── GET /api/support/tickets ──
router.get('/tickets', async (req, res) => {
  const pool = getPool();
  const [tickets] = await pool.execute('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
  res.json({ tickets });
});

module.exports = router;
