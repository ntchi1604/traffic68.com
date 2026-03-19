const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/wallets ──
router.get('/', async (req, res) => {
  const pool = getPool();
  const [wallets] = await pool.execute('SELECT * FROM wallets WHERE user_id = ?', [req.userId]);

  const result = {};
  wallets.forEach((w) => { result[w.type] = { id: w.id, balance: w.balance }; });
  res.json({ wallets: result });
});

// ── POST /api/deposits ──
router.post('/deposits', async (req, res) => {
  const pool = getPool();
  const { amount, method } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Số tiền nạp phải lớn hơn 0' });
  }

  const validMethods = ['bank_transfer', 'credit_card', 'momo', 'zalopay'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ error: 'Phương thức thanh toán không hợp lệ' });
  }

  const prefix = method === 'credit_card' ? 'TCB' : method === 'bank_transfer' ? 'VCB' : method.toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  const refCode = `${prefix}-${date}-${seq}`;

  await pool.execute(
    `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, 'main', 'deposit', method, amount, 'pending', refCode]
  );

  const fmt = new Intl.NumberFormat('vi-VN').format(amount);
  await pool.execute(
    `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
    [req.userId, 'Đơn nạp tiền đang chờ duyệt', `Đơn nạp ${fmt} VND (Mã: ${refCode}) đang chờ admin xác minh.`, 'info']
  );

  res.status(201).json({ message: 'Đơn nạp tiền đã gửi, đang chờ admin xác minh', refCode, status: 'pending' });
});

// ── GET /api/transactions ──
router.get('/transactions', async (req, res) => {
  const pool = getPool();
  const { type, period } = req.query;

  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [req.userId];

  if (type && type !== 'all') { sql += ' AND type = ?'; params.push(type); }

  if (period && period !== 'all') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 0;
    if (days > 0) { sql += ` AND created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`; }
  }

  sql += ' ORDER BY created_at DESC LIMIT 100';
  const [transactions] = await pool.execute(sql, params);
  res.json({ transactions });
});

// ── POST /api/finance/transfer ── (Commission → Main)
router.post('/transfer', async (req, res) => {
  const pool = getPool();
  const { amount } = req.body;
  const num = Number(amount);

  if (!num || num <= 0) return res.status(400).json({ error: 'Số tiền phải lớn hơn 0' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check commission balance
    const [wallets] = await conn.execute('SELECT balance FROM wallets WHERE user_id = ? AND type = ? FOR UPDATE', [req.userId, 'commission']);
    if (!wallets[0] || wallets[0].balance < num) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Số dư ví hoa hồng không đủ' });
    }

    // Deduct from commission
    await conn.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = ?', [num, req.userId, 'commission']);
    // Add to main
    await conn.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?', [num, req.userId, 'main']);

    // Transaction records
    const ts = Date.now();
    await conn.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, 'commission', 'withdraw', 'transfer', num, 'completed', 'TRF-OUT-' + ts, 'Chuyển sang Ví Traffic']
    );
    await conn.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, 'main', 'deposit', 'transfer', num, 'completed', 'TRF-IN-' + ts, 'Nhận từ Ví Hoa Hồng']
    );

    // Notification
    const fmtAmount = new Intl.NumberFormat('vi-VN').format(num);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [req.userId, 'Chuyển ví thành công', `Đã chuyển ${fmtAmount} VND từ Ví Hoa Hồng sang Ví Traffic.`, 'success']
    );

    await conn.commit();
    conn.release();
    res.json({ message: `Đã chuyển ${fmtAmount} VND sang Ví Traffic`, refCode });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ error: 'Lỗi chuyển ví: ' + err.message });
  }
});

module.exports = router;
