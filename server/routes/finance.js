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
    `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
    [req.userId, 'Đơn nạp tiền đang chờ duyệt', `Đơn nạp ${fmt} VND (Mã: ${refCode}) đang chờ admin xác minh.`, 'info', 'buyer']
  );

  res.status(201).json({ message: 'Đơn nạp tiền đã gửi, đang chờ admin xác minh', refCode, status: 'pending' });
});

// ── GET /api/transactions ──
router.get('/transactions', async (req, res) => {
  const pool = getPool();
  const { type, period, scope } = req.query;

  // Strict separation: buyer sees only 'main', worker sees only 'earning'
  const walletType = scope === 'worker' ? 'earning' : 'main';

  let sql = `SELECT * FROM transactions WHERE user_id = ? AND wallet_type = ?`;
  const params = [req.userId, walletType];

  if (type && type !== 'all') {
    if (type === 'commission') {
      // Special case: show commission wallet instead
      sql = `SELECT * FROM transactions WHERE user_id = ? AND wallet_type = 'commission'`;
      params.length = 0;
      params.push(req.userId);
    } else {
      sql += ' AND type = ?'; params.push(type);
    }
  }

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
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [req.userId, 'Chuyển ví thành công', `Đã chuyển ${fmtAmount} VND từ Ví Hoa Hồng sang Ví Traffic.`, 'success', 'buyer']
    );

    await conn.commit();
    conn.release();
    res.json({ message: `Đã chuyển ${fmtAmount} VND sang Ví Traffic` });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ error: 'Lỗi chuyển ví: ' + err.message });
  }
});

// ── POST /api/finance/withdraw ── (Worker earning → bank/crypto)
router.post('/withdraw', async (req, res) => {
  const pool = getPool();
  const { amount, method, bankName, accountNumber, accountName, cryptoNetwork, cryptoAddress, trafficSource } = req.body;
  const num = Number(amount);

  if (!num || num < 50000) return res.status(400).json({ error: 'Số tiền rút tối thiểu 50.000 đ' });
  if (!['bank', 'crypto'].includes(method)) return res.status(400).json({ error: 'Phương thức không hợp lệ' });
  if (!trafficSource || !trafficSource.trim()) return res.status(400).json({ error: 'Vui lòng nhập nguồn lưu lượng truy cập' });

  // Check admin toggle
  try {
    const [settings] = await pool.execute(
      "SELECT setting_value FROM site_settings WHERE setting_key = ?",
      [method === 'bank' ? 'withdraw_bank_enabled' : 'withdraw_crypto_enabled']
    );
    if (settings.length && settings[0].setting_value === 'false') {
      return res.status(400).json({ error: 'Phương thức rút tiền này đã bị tạm khóa' });
    }
  } catch (e) {}

  if (method === 'bank' && (!bankName || !accountNumber || !accountName)) return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin ngân hàng' });
  if (method === 'crypto' && (!cryptoNetwork || !cryptoAddress)) return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin ví crypto' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [wallets] = await conn.execute('SELECT balance FROM wallets WHERE user_id = ? AND type = ? FOR UPDATE', [req.userId, 'earning']);
    const balance = wallets[0] ? Number(wallets[0].balance) : 0;
    if (balance < num) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: `Số dư không đủ (hiện có ${balance.toLocaleString('vi-VN')} đ)` });
    }

    await conn.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = ?', [num, req.userId, 'earning']);

    const refCode = `WD-${Date.now()}-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;
    const note = method === 'bank'
      ? `🏦 ${bankName} - ${accountNumber} - ${accountName} | Nguồn: ${trafficSource.trim()}`
      : `🪙 ${cryptoNetwork} - ${cryptoAddress} | Nguồn: ${trafficSource.trim()}`;

    await conn.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, 'earning', 'withdraw', method, num, 'pending', refCode, note]
    );

    const fmtAmount = new Intl.NumberFormat('vi-VN').format(num);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [req.userId, 'Yêu cầu rút tiền', `Yêu cầu rút ${fmtAmount} đ (${refCode}) đang chờ xử lý.`, 'info', 'worker']
    );

    await conn.commit();
    conn.release();
    res.json({ message: `Yêu cầu rút ${fmtAmount} đ đã gửi`, refCode });
  } catch (err) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: 'Lỗi: ' + err.message });
  }
});

// ── GET /api/finance/withdrawals ──
router.get('/withdrawals', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM transactions WHERE user_id = ? AND type = 'withdraw' AND wallet_type = 'earning' ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json({ withdrawals: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
