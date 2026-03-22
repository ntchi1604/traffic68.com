const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const { getPool } = require('../db');

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.userRole = payload.role;

    // Check user is still active in DB
    const pool = getPool();
    const [rows] = await pool.execute('SELECT status FROM users WHERE id = ?', [payload.userId]);
    if (!rows[0] || rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Tài khoản đã bị tạm ngưng hoặc không tồn tại' });
    }

    next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// Optional auth — doesn't block if no token
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const token = header.split(' ')[1];
      const payload = jwt.verify(token, JWT_SECRET);
      req.userId = payload.userId;
      req.userRole = payload.role;
    } catch { /* ignore */ }
  }
  next();
}

module.exports = { authMiddleware, optionalAuth, JWT_SECRET };
