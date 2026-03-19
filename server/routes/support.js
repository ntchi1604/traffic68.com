const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── POST /api/support/tickets ──
router.post('/tickets', (req, res) => {
  const { subject, description, priority } = req.body;

  if (!subject) return res.status(400).json({ error: 'Chủ đề là bắt buộc' });

  const db = getDb();

  const validPriority = ['low', 'medium', 'high', 'urgent'];
  const prio = validPriority.includes(priority) ? priority : 'medium';

  const result = db.prepare(`
    INSERT INTO support_tickets (user_id, subject, description, priority)
    VALUES (?, ?, ?, ?)
  `).run(req.userId, subject, description || '', prio);

  // Notification
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (?, ?, ?, ?)
  `).run(req.userId, 'Yêu cầu hỗ trợ đã gửi', `Ticket #${result.lastInsertRowid}: "${subject}" đã được tạo. Chúng tôi sẽ phản hồi sớm nhất.`, 'info');

  res.status(201).json({
    message: 'Gửi yêu cầu hỗ trợ thành công',
    ticketId: result.lastInsertRowid,
  });
});

// ── GET /api/support/tickets ──
router.get('/tickets', (req, res) => {
  const db = getDb();
  const tickets = db.prepare(
    'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.userId);

  res.json({ tickets });
});

module.exports = router;
