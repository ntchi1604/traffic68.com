const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/users/profile ──
router.get('/profile', (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT id, email, name, phone, avatar_url, role, referral_code, created_at
    FROM users WHERE id = ?
  `).get(req.userId);

  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  // Count referrals
  const referralCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by = ?').get(req.userId).count;

  res.json({ user: { ...user, referralCount } });
});

// ── PUT /api/users/profile ──
router.put('/profile', (req, res) => {
  const db = getDb();
  const { name, phone, avatarUrl } = req.body;

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      avatar_url = COALESCE(?, avatar_url),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name || null, phone || null, avatarUrl || null, req.userId);

  const user = db.prepare('SELECT id, email, name, phone, avatar_url, role, referral_code FROM users WHERE id = ?').get(req.userId);
  res.json({ message: 'Cập nhật thành công', user });
});

// ── PUT /api/users/password ──
router.put('/password', (req, res) => {
  const db = getDb();
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mật khẩu cũ và mới là bắt buộc' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, req.userId);

  res.json({ message: 'Đổi mật khẩu thành công' });
});

module.exports = router;
