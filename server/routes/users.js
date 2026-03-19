const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/users/profile ──
router.get('/profile', async (req, res) => {
  const pool = getPool();
  const [users] = await pool.execute(
    `SELECT id, email, name, phone, avatar_url, role, referral_code, created_at FROM users WHERE id = ?`,
    [req.userId]
  );

  if (users.length === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  const [refCount] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE referred_by = ?', [req.userId]);
  res.json({ user: { ...users[0], referralCount: refCount[0].count } });
});

// ── PUT /api/users/profile ──
router.put('/profile', async (req, res) => {
  const pool = getPool();
  const { name, phone, avatarUrl } = req.body;

  await pool.execute(
    `UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), avatar_url = COALESCE(?, avatar_url) WHERE id = ?`,
    [name || null, phone || null, avatarUrl || null, req.userId]
  );

  const [users] = await pool.execute('SELECT id, email, name, phone, avatar_url, role, referral_code FROM users WHERE id = ?', [req.userId]);
  res.json({ message: 'Cập nhật thành công', user: users[0] });
});

// ── PUT /api/users/password ──
router.put('/password', async (req, res) => {
  const pool = getPool();
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mật khẩu cũ và mới là bắt buộc' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });
  }

  const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.userId]);
  if (!bcrypt.compareSync(currentPassword, users[0].password_hash)) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.userId]);
  res.json({ message: 'Đổi mật khẩu thành công' });
});

module.exports = router;
