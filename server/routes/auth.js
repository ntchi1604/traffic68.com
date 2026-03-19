const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/register ──
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, username, phone, referralCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải ít nhất 6 ký tự' });
    }

    const pool = getPool();

    // Check existing email
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email đã được đăng ký' });
    }

    // Check existing username
    if (username) {
      const [existingUser] = await pool.execute("SELECT id FROM users WHERE username = ?", [username]);
      if (existingUser.length > 0) {
        return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
      }
    }

    // Handle referral
    let referredBy = null;
    if (referralCode) {
      const [referrer] = await pool.execute('SELECT id FROM users WHERE referral_code = ?', [referralCode]);
      if (referrer.length > 0) referredBy = referrer[0].id;
    }

    const hash = bcrypt.hashSync(password, 10);
    const myRefCode = 'REF-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const [result] = await pool.execute(
      `INSERT INTO users (email, password_hash, name, username, phone, referral_code, referred_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hash, name || '', username || '', phone || '', myRefCode, referredBy]
    );

    const userId = result.insertId;

    // Create wallets
    await pool.execute('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)', [userId, 'main', 0]);
    await pool.execute('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)', [userId, 'commission', 0]);

    // Welcome notification
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [userId, 'Chào mừng bạn!', 'Tài khoản của bạn đã được tạo thành công. Hãy bắt đầu tạo chiến dịch đầu tiên!', 'success']
    );

    // Generate token
    const token = jwt.sign({ userId, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      user: { id: userId, email, name: name || '', role: 'user' },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Lỗi đăng ký: ' + err.message });
  }
});

// ── POST /api/auth/login ──
router.post('/login', async (req, res) => {
  const { email, password, remember } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email/Username và mật khẩu là bắt buộc' });
  }

  const pool = getPool();
  let [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
  if (users.length === 0) {
    [users] = await pool.execute("SELECT * FROM users WHERE username = ? AND username != ''", [email]);
  }
  if (users.length === 0) {
    [users] = await pool.execute('SELECT * FROM users WHERE name = ?', [email]);
  }

  const user = users[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email/Username hoặc mật khẩu không đúng' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Tài khoản đã bị tạm ngưng' });
  }

  const expiresIn = remember ? '30d' : '7d';
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn });

  res.json({
    message: 'Đăng nhập thành công',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      referralCode: user.referral_code,
    },
  });
});

// ── GET /api/auth/me ──
router.get('/me', authMiddleware, async (req, res) => {
  const pool = getPool();
  const [users] = await pool.execute(
    'SELECT id, email, name, username, phone, avatar_url, role, referral_code, created_at FROM users WHERE id = ?',
    [req.userId]
  );

  if (users.length === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json({ user: users[0] });
});

// ── POST /api/auth/logout ──
router.post('/logout', authMiddleware, (req, res) => {
  res.json({ message: 'Đăng xuất thành công' });
});

module.exports = router;
