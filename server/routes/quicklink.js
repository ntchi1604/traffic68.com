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

/* ── API-key auth middleware ───────────────────── */
async function apiKeyAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!token) return res.status(401).json({ error: 'API key required. Add header: Authorization: Bearer YOUR_API_KEY' });

  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT ak.id, ak.user_id, u.username FROM api_keys ak JOIN users u ON u.id = ak.user_id WHERE ak.api_key = ? AND ak.active = 1',
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid or revoked API key' });

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
   API KEY MANAGEMENT (session-auth: worker dashboard)
   ════════════════════════════════════════════════ */

// ── GET /api/quicklink/keys — list my API keys ──
router.get('/keys', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [keys] = await pool.execute(
      `SELECT id, api_key, label, active, request_count, last_used_at, created_at
       FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ keys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/quicklink/keys — create new API key ──
router.post('/keys', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const { label } = req.body;

    // Max 5 keys per user
    const [count] = await pool.execute('SELECT COUNT(*) as c FROM api_keys WHERE user_id = ?', [req.userId]);
    if (count[0].c >= 5) return res.status(400).json({ error: 'Tối đa 5 API key' });

    const apiKey = genApiKey();
    const [result] = await pool.execute(
      'INSERT INTO api_keys (user_id, api_key, label) VALUES (?, ?, ?)',
      [req.userId, apiKey, label || 'Default']
    );

    res.json({ id: result.insertId, api_key: apiKey, label: label || 'Default' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/quicklink/keys/:id — revoke key ──
router.delete('/keys/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    await pool.execute('DELETE FROM api_keys WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ message: 'Đã xóa API key' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ════════════════════════════════════════════════
   QUICKLINK PUBLIC API (API-key auth)
   ════════════════════════════════════════════════ */

// ── POST /api/quicklink/v1/shorten — create short link ──
// Body: { url: "https://...", title: "optional" }
// Returns: { short_url, slug, destination_url }
router.post('/v1/shorten', apiKeyAuth, async (req, res) => {
  try {
    const pool = getPool();
    const { url, title } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing "url" field' });

    // Validate URL
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

    // Generate unique slug
    let slug;
    for (let i = 0; i < 10; i++) {
      const s = genSlug(7);
      const [dup] = await pool.execute('SELECT id FROM worker_links WHERE slug = ?', [s]);
      if (!dup.length) { slug = s; break; }
    }
    if (!slug) return res.status(500).json({ error: 'Could not generate slug' });

    const [result] = await pool.execute(
      'INSERT INTO worker_links (worker_id, slug, title, destination_url) VALUES (?, ?, ?, ?)',
      [req.userId, slug, title || null, url]
    );

    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'traffic68.com';
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${proto}://${host}`;

    res.json({
      id: result.insertId,
      slug,
      short_url: `${baseUrl}/vuot-link/${slug}`,
      destination_url: url,
      title: title || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// ── DELETE /api/quicklink/v1/links/:id — delete link ──
router.delete('/v1/links/:id', apiKeyAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [result] = await pool.execute(
      'DELETE FROM worker_links WHERE id = ? AND worker_id = ?',
      [req.params.id, req.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Link not found' });
    res.json({ message: 'Link deleted' });
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
