const { getPool } = require('../db');

const agencyRoleCache = new Map();
const CACHE_TTL = 30 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of agencyRoleCache.entries()) {
    if (now > val.expiry) agencyRoleCache.delete(key);
  }
}, 5 * 60 * 1000);

function invalidateAgencyRoleCache(userId) {
  agencyRoleCache.delete(userId);
}

async function agencyAdminMiddleware(req, res, next) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' });

    const cached = agencyRoleCache.get(userId);
    if (cached && Date.now() < cached.expiry) {
      req.agencyId = cached.agencyId;
      req.agencyRole = cached.agencyRole;
      return next();
    }

    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT agency_id, agency_role FROM users WHERE id = ?',
      [userId]
    );

    if (!rows[0] || !rows[0].agency_role || !rows[0].agency_id) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập khu vực này' });
    }

    const { agency_id, agency_role } = rows[0];
    agencyRoleCache.set(userId, { agencyId: agency_id, agencyRole: agency_role, expiry: Date.now() + CACHE_TTL });

    req.agencyId = agency_id;
    req.agencyRole = agency_role;
    next();
  } catch (err) {
    console.error('agencyAdminMiddleware error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
}

function ownerOnly(req, res, next) {
  if (req.agencyRole !== 'owner') {
    return res.status(403).json({ error: 'Chỉ chủ đại lý mới có quyền này' });
  }
  next();
}

module.exports = { agencyAdminMiddleware, ownerOnly, invalidateAgencyRoleCache };
