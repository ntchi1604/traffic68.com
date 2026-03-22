const express = require('express');
const crypto  = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/* ── helpers ─────────────────────────────────── */
function genSlug(len = 7) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

function genApiKey() {
  return 'tf68_' + crypto.randomBytes(24).toString('hex');
}

/* ════════════════════════════════════════════════
   QUICKLINK — GET /st?api=API_KEY&url=DEST_URL
   Tự tạo shortlink rồi redirect đến trang vượt link.
   Nếu URL đã có shortlink thì redirect luôn (không tạo mới).
   ════════════════════════════════════════════════ */
router.get('/st', async (req, res) => {
  try {
    const { api, url } = req.query;

    // 1. Validate params
    if (!api) return res.status(400).json({ error: 'Thiếu API key. Sử dụng: /st?api=YOUR_API_KEY&url=YOUR_URL' });
    if (!url) return res.status(400).json({ error: 'Thiếu URL đích. Sử dụng: /st?api=YOUR_API_KEY&url=YOUR_URL' });

    // Basic URL validation
    let destUrl = url;
    if (!/^https?:\/\//i.test(destUrl)) destUrl = 'https://' + destUrl;
    try { new URL(destUrl); } catch { return res.status(400).json({ error: 'URL không hợp lệ' }); }

    // 2. Validate API key + check user not banned
    const pool = getPool();
    const [keyRows] = await pool.execute(
      'SELECT ak.id, ak.user_id FROM api_keys ak JOIN users u ON u.id = ak.user_id WHERE ak.api_key = ? AND ak.active = 1 AND u.status = \'active\'',
      [api]
    );
    if (!keyRows.length) return res.status(401).json({ error: 'API key không hợp lệ, đã bị thu hồi, hoặc tài khoản đã bị khóa' });

    const userId = keyRows[0].user_id;
    const apiKeyId = keyRows[0].id;

    // Update usage stats
    pool.execute('UPDATE api_keys SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = ?', [apiKeyId]);

    // 3. Check if this user already has a shortlink for this URL
    const [existing] = await pool.execute(
      'SELECT slug FROM worker_links WHERE worker_id = ? AND destination_url = ? AND hidden = 0 LIMIT 1',
      [userId, destUrl]
    );

    let slug;
    if (existing.length) {
      // Reuse existing shortlink
      slug = existing[0].slug;
    } else {
      // Create new shortlink
      for (let i = 0; i < 10; i++) {
        const s = genSlug(7);
        const [dup] = await pool.execute('SELECT id FROM worker_links WHERE slug = ?', [s]);
        if (!dup.length) { slug = s; break; }
      }
      if (!slug) return res.status(500).json({ error: 'Không thể tạo link' });

      await pool.execute(
        'INSERT INTO worker_links (worker_id, slug, destination_url) VALUES (?, ?, ?)',
        [userId, slug, destUrl]
      );
    }

    // 4. Redirect to gateway page
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'traffic68.com';
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    res.redirect(302, `${proto}://${host}/vuot-link/${slug}`);
  } catch (err) {
    console.error('QuickLink /st error:', err.message);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

/* ── API-key auth middleware ───────────────────── */
async function apiKeyAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!token) return res.status(401).json({ error: 'API key required. Add header: Authorization: Bearer YOUR_API_KEY' });

  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT ak.id, ak.user_id, u.username FROM api_keys ak JOIN users u ON u.id = ak.user_id WHERE ak.api_key = ? AND ak.active = 1 AND u.status = \'active\'',
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid or revoked API key, or account suspended' });

    // Update last_used
    pool.execute('UPDATE api_keys SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = ?', [rows[0].id]);

    req.userId   = rows[0].user_id;
    req.username = rows[0].username;
    req.apiKeyId = rows[0].id;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/* ════════════════════════════════════════════════
   API KEY MANAGEMENT — 1 key per user, can regenerate
   ════════════════════════════════════════════════ */

// ── GET /api/quicklink/key — get my API key (single) ──
router.get('/key', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, api_key, request_count, last_used_at, created_at
       FROM api_keys WHERE user_id = ? AND active = 1 LIMIT 1`,
      [req.userId]
    );
    res.json({ key: rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/quicklink/key — create key (if none exists) ──
router.post('/key', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    // Check if already has one
    const [existing] = await pool.execute(
      'SELECT id FROM api_keys WHERE user_id = ? AND active = 1',
      [req.userId]
    );
    if (existing.length) return res.status(400).json({ error: 'Bạn đã có API key. Dùng nút Đổi key để tạo mới.' });

    const apiKey = genApiKey();
    const [result] = await pool.execute(
      'INSERT INTO api_keys (user_id, api_key) VALUES (?, ?)',
      [req.userId, apiKey]
    );

    res.json({ key: { id: result.insertId, api_key: apiKey, request_count: 0, last_used_at: null, created_at: new Date() } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/quicklink/key — regenerate key ──
router.put('/key', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    // Delete old key(s)
    await pool.execute('DELETE FROM api_keys WHERE user_id = ?', [req.userId]);
    // Create new
    const apiKey = genApiKey();
    const [result] = await pool.execute(
      'INSERT INTO api_keys (user_id, api_key) VALUES (?, ?)',
      [req.userId, apiKey]
    );

    res.json({ key: { id: result.insertId, api_key: apiKey, request_count: 0, last_used_at: null, created_at: new Date() } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ════════════════════════════════════════════════
   QUICKLINK PUBLIC API (API-key auth) — READ ONLY
   ════════════════════════════════════════════════ */

// ── GET /api/quicklink/v1/links — list my links ──
router.get('/v1/links', apiKeyAuth, async (req, res) => {
  try {
    const pool = getPool();
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [links] = await pool.execute(
      `SELECT id, slug, title, destination_url, click_count, completed_count, earning, created_at
       FROM worker_links WHERE worker_id = ? AND hidden = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [req.userId, limit, offset]
    );

    const [total] = await pool.execute(
      'SELECT COUNT(*) as c FROM worker_links WHERE worker_id = ? AND hidden = 0',
      [req.userId]
    );

    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'traffic68.com';
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${proto}://${host}`;

    res.json({
      links: links.map(l => ({
        ...l,
        short_url: `${baseUrl}/vuot-link/${l.slug}`,
        earning: Number(l.earning),
      })),
      pagination: { page, limit, total: total[0].c, pages: Math.ceil(total[0].c / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/quicklink/v1/links/:id — single link stats ──
router.get('/v1/links/:id', apiKeyAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, slug, title, destination_url, click_count, completed_count, earning, created_at
       FROM worker_links WHERE id = ? AND worker_id = ?`,
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Link not found' });

    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'traffic68.com';
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const l = rows[0];

    res.json({
      ...l,
      short_url: `${proto}://${host}/vuot-link/${l.slug}`,
      earning: Number(l.earning),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── GET /api/quicklink/v1/stats — overall stats ──
router.get('/v1/stats', apiKeyAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [s] = await pool.execute(
      `SELECT COUNT(*) as total_links,
              COALESCE(SUM(click_count),0) as total_clicks,
              COALESCE(SUM(completed_count),0) as total_completed,
              COALESCE(SUM(earning),0) as total_earning
       FROM worker_links WHERE worker_id = ? AND hidden = 0`,
      [req.userId]
    );
    res.json({ ...s[0], total_earning: Number(s[0].total_earning) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
