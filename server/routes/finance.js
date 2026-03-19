const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/wallets ──
router.get('/', (req, res) => {
  const db = getDb();
  const wallets = db.prepare('SELECT * FROM wallets WHERE user_id = ?').all(req.userId);

  const result = {};
  wallets.forEach((w) => {
    result[w.type] = { id: w.id, balance: w.balance };
  });

  res.json({ wallets: result });
});

// ── POST /api/deposits ──
router.post('/deposits', (req, res) => {
  const db = getDb();
  const { amount, method } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Số tiền nạp phải lớn hơn 0' });
  }

  const validMethods = ['bank_transfer', 'credit_card', 'momo', 'zalopay'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ error: 'Phương thức thanh toán không hợp lệ' });
  }

  // Generate ref code
  const prefix = method === 'credit_card' ? 'TCB' : method === 'bank_transfer' ? 'VCB' : method.toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  const refCode = `${prefix}-${date}-${seq}`;

  // Create PENDING transaction — admin must approve
  db.prepare(`
    INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.userId, 'main', 'deposit', method, amount, 'pending', refCode);

  // Notification to user
  const fmt = new Intl.NumberFormat('vi-VN').format(amount);
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (?, ?, ?, ?)
  `).run(req.userId, 'Đơn nạp tiền đang chờ duyệt', `Đơn nạp ${fmt} VND (Mã: ${refCode}) đang chờ admin xác minh.`, 'info');

  res.status(201).json({
    message: 'Đơn nạp tiền đã gửi, đang chờ admin xác minh',
    refCode,
    status: 'pending',
  });
});

// ── GET /api/transactions ──
router.get('/transactions', (req, res) => {
  const db = getDb();
  const { type, period } = req.query;

  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [req.userId];

  if (type && type !== 'all') {
    sql += ' AND type = ?';
    params.push(type);
  }

  if (period && period !== 'all') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 0;
    if (days > 0) {
      sql += ` AND created_at >= datetime('now', '-${days} days')`;
    }
  }

  sql += ' ORDER BY created_at DESC LIMIT 100';

  const transactions = db.prepare(sql).all(...params);
  res.json({ transactions });
});

module.exports = router;
