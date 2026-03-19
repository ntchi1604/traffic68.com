const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/register ──
router.post('/register', (req, res) => {
  try {
    const { email, password, name, username, phone, referralCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải ít nhất 6 ký tự' });
    }

    const db = getDb();

    // Check existing email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email đã được đăng ký' });
    }

    // Check existing username
    if (username) {
      const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
      if (existingUser) {
        return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
      }
    }

    // Handle referral
    let referredBy = null;
    if (referralCode) {
      const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode);
      if (referrer) referredBy = referrer.id;
    }

    const hash = bcrypt.hashSync(password, 10);
    const myRefCode = 'REF-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const result = db.prepare(`
      INSERT INTO users (email, password_hash, name, username, phone, referral_code, referred_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(email, hash, name || '', username || '', phone || '', myRefCode, referredBy);

    const userId = result.lastInsertRowid;

    // Create wallets
    db.prepare('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)').run(userId, 'main', 0);
    db.prepare('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)').run(userId, 'commission', 0);

    // Welcome notification
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `).run(userId, 'Chào mừng bạn!', 'Tài khoản của bạn đã được tạo thành công. Hãy bắt đầu tạo chiến dịch đầu tiên!', 'success');

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
router.post('/login', (req, res) => {
  const { email, password, remember } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email/Username và mật khẩu là bắt buộc' });
  }

  const db = getDb();
  // Support login by email OR username OR name
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    user = db.prepare("SELECT * FROM users WHERE username = ? AND username != ''").get(email);
  }
  if (!user) {
    user = db.prepare('SELECT * FROM users WHERE name = ?').get(email);
  }

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
router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, name, username, phone, avatar_url, role, referral_code, created_at FROM users WHERE id = ?').get(req.userId);

  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  res.json({ user });
});

// ── POST /api/auth/logout ──
router.post('/logout', authMiddleware, (req, res) => {
  // JWT is stateless — client just discards the token
  res.json({ message: 'Đăng xuất thành công' });
});

module.exports = router;
