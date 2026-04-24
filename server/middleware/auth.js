const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const { getPool } = require('../db');

// ── In-memory cache: tránh query DB cho mỗi authenticated request ──
// Key: userId, Value: { status, passwordChangedAt, expiry }
const userStatusCache = new Map();
const USER_CACHE_TTL = 10 * 1000; // 10 giây — đủ giảm DB queries mà vẫn gần real-time

function getCachedEntry(userId) {
  const entry = userStatusCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    userStatusCache.delete(userId);
    return null;
  }
  return entry;
}

function setCachedEntry(userId, status, passwordChangedAt) {
  userStatusCache.set(userId, { status, passwordChangedAt, expiry: Date.now() + USER_CACHE_TTL });
}

// Dọn cache tự động mỗi 5 phút để tránh memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of userStatusCache.entries()) {
    if (now > val.expiry) userStatusCache.delete(key);
  }
}, 5 * 60 * 1000);

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

    // Check cache trước, nếu hit thì không cần query DB
    let cached = getCachedEntry(payload.userId);
    if (!cached) {
      const pool = getPool();
      const [rows] = await pool.execute('SELECT status, password_changed_at FROM users WHERE id = ?', [payload.userId]);
      if (rows[0]?.status) setCachedEntry(payload.userId, rows[0].status, rows[0].password_changed_at || null);
      cached = getCachedEntry(payload.userId);
    }

    if (!cached || cached.status !== 'active') {
      // Xóa cache ngay nếu không active (bị ban)
      userStatusCache.delete(payload.userId);
      return res.status(403).json({ error: 'Tài khoản đã bị tạm ngưng hoặc không tồn tại' });
    }

    // ── Kiểm tra token cũ (đổi mật khẩu từ thiết bị khác) ──
    if (cached.passwordChangedAt) {
      const changedAtMs = new Date(cached.passwordChangedAt).getTime();
      const tokenIssuedMs = payload.iat * 1000; // JWT iat là seconds
      if (tokenIssuedMs < changedAtMs) {
        return res.status(401).json({ error: 'Mật khẩu đã được thay đổi, vui lòng đăng nhập lại' });
      }
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

/** Gọi khi admin thay đổi status user — xóa cache để reflect ngay lập tức */
/** Cũng gọi khi user đổi mật khẩu để force re-check từ DB */
function invalidateUserCache(userId) {
  userStatusCache.delete(userId);
}

module.exports = { authMiddleware, optionalAuth, JWT_SECRET, invalidateUserCache };
