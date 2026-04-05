const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || '0x0000000000000000000000000000000000000000';

async function verifyHCaptcha(token) {
  if (!token) return false;
  try {
    const params = new URLSearchParams();
    params.append('response', token);
    params.append('secret', HCAPTCHA_SECRET);
    const res = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('hCaptcha verify error:', err.message);
    return false;
  }
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, username, phone, referralCode, captchaToken, service } = req.body;

    
    const captchaValid = await verifyHCaptcha(captchaToken);
    if (!captchaValid) {
      return res.status(400).json({ error: 'Xác nhận captcha không hợp lệ. Vui lòng thử lại.' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải ít nhất 6 ký tự' });
    }

    const pool = getPool();

    
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email đã được đăng ký' });
    }

    
    if (username) {
      const [existingUser] = await pool.execute("SELECT id FROM users WHERE username = ?", [username]);
      if (existingUser.length > 0) {
        return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
      }
    }

    
    let referredBy = null;
    if (referralCode) {
      const [referrer] = await pool.execute('SELECT id FROM users WHERE referral_code = ?', [referralCode]);
      if (referrer.length > 0) referredBy = referrer[0].id;
    }

    const hash = bcrypt.hashSync(password, 10);
    const myRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const serviceType = service === 'shortlink' ? 'shortlink' : 'traffic';
    const initSourceStatus = serviceType === 'shortlink' ? 'pending' : null;

    const [result] = await pool.execute(
      `INSERT INTO users (email, password_hash, name, username, phone, referral_code, referred_by, service_type, source_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hash, name || '', username || '', phone || '', myRefCode, referredBy, serviceType, initSourceStatus]
    );

    const userId = result.insertId;

    
    await pool.execute('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)', [userId, 'main', 0]);
    await pool.execute('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)', [userId, 'commission', 0]);
    await pool.execute('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)', [userId, 'earning', 0]);

    
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [userId, 'Chào mừng bạn!', 'Tài khoản của bạn đã được tạo thành công. Hãy bắt đầu tạo chiến dịch đầu tiên!', 'success', 'all']
    );

    // ── Gán vào nhóm giá mặc định (nhóm đầu tiên trong DB) ──
    try {
      const [defGroups] = await pool.execute(
        `SELECT id FROM worker_pricing_groups ORDER BY id ASC LIMIT 1`
      );
      if (defGroups.length > 0) {
        await pool.execute('UPDATE users SET pricing_group_id = ? WHERE id = ?', [defGroups[0].id, userId]);
      }
    } catch (_) { /* bảng chưa tồn tại thì bỏ qua */ }

    
    const token = jwt.sign({ userId, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      user: { id: userId, email, name: name || '', role: 'user', service_type: serviceType },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Lỗi đăng ký: ' + err.message });
  }
});

router.get('/referrer/:code', async (req, res) => {
  try {
    const pool = getPool();
    const [users] = await pool.execute('SELECT service_type FROM users WHERE referral_code = ? LIMIT 1', [req.params.code]);
    if (users.length > 0) {
      return res.json({ service_type: users[0].service_type || 'traffic' });
    }
    res.status(404).json({ error: 'Không tìm thấy người giới thiệu' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password, remember, captchaToken } = req.body;

  
  const captchaValid = await verifyHCaptcha(captchaToken);
  if (!captchaValid) {
    return res.status(400).json({ error: 'Xác nhận captcha không hợp lệ. Vui lòng thử lại.' });
  }

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
      service_type: user.service_type || 'traffic',
      referralCode: user.referral_code,
    },
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  const pool = getPool();
  const [users] = await pool.execute(
    'SELECT id, email, name, username, phone, avatar_url, role, service_type, referral_code, created_at FROM users WHERE id = ?',
    [req.userId]
  );

  if (users.length === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json({ user: users[0] });
});

router.post('/logout', authMiddleware, (req, res) => {
  res.json({ message: 'Đăng xuất thành công' });
});

module.exports = router;
