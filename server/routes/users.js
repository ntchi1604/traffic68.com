const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── Multer config for avatars ──
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${req.userId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp)'));
  },
});

// ── POST /api/users/avatar ──
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Chưa chọn file ảnh' });

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Delete old avatar file if exists
    const pool = getPool();
    const [users] = await pool.execute('SELECT avatar_url FROM users WHERE id = ?', [req.userId]);
    if (users[0]?.avatar_url && users[0].avatar_url.startsWith('/uploads/avatars/')) {
      const oldPath = path.join(__dirname, '..', '..', users[0].avatar_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await pool.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.userId]);
    res.json({ message: 'Cập nhật ảnh đại diện thành công', avatarUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// ── GET /api/users/referrals ──
router.get('/referrals', async (req, res) => {
  try {
    const pool = getPool();
    const [me] = await pool.execute('SELECT referral_code FROM users WHERE id = ?', [req.userId]);
    const [refs] = await pool.execute(
      `SELECT id, name, email, service_type, status, created_at FROM users WHERE referred_by = ? ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ referralCode: me[0]?.referral_code || '', referrals: refs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
