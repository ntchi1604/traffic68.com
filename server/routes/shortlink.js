const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function genSlug(len = 7) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

// ── GET /api/shortlink/info/:slug — public, used by frontend task page ──
router.get('/info/:slug', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT wl.id, wl.slug, wl.title
       FROM worker_links wl
       WHERE wl.slug = ?`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Link không tồn tại' });
    // Count click
    await pool.execute('UPDATE worker_links SET click_count = click_count + 1 WHERE id = ?', [rows[0].id]);
    res.json({ link: { slug: rows[0].slug, title: rows[0].title } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/shortlink/create — worker creates a gateway link ──
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const { destination_url, title } = req.body;
    if (!destination_url) return res.status(400).json({ error: 'Vui lòng nhập URL đích' });

    // Basic URL validation
    try { new URL(destination_url); } catch { return res.status(400).json({ error: 'URL không hợp lệ' }); }

    // Generate unique slug
    let slug;
    for (let i = 0; i < 10; i++) {
      const s = genSlug(7);
      const [dup] = await pool.execute('SELECT id FROM worker_links WHERE slug = ?', [s]);
      if (!dup.length) { slug = s; break; }
    }
    if (!slug) return res.status(500).json({ error: 'Không thể tạo slug' });

    const [result] = await pool.execute(
      'INSERT INTO worker_links (worker_id, slug, title, destination_url) VALUES (?, ?, ?, ?)',
      [req.userId, slug, title || null, destination_url]
    );

    res.json({ id: result.insertId, slug, destination_url, title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/shortlink/links — worker's own links ──
router.get('/links', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [links] = await pool.execute(
      `SELECT id, slug, title, destination_url, click_count, completed_count, earning, created_at
       FROM worker_links WHERE worker_id = ? ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/shortlink/stats ──
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [s] = await pool.execute(
      `SELECT COUNT(*) as total_links,
              COALESCE(SUM(click_count),0) as total_clicks,
              COALESCE(SUM(completed_count),0) as total_completed,
              COALESCE(SUM(earning),0) as total_earning
       FROM worker_links WHERE worker_id = ?`,
      [req.userId]
    );
    const [today] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) as earn FROM transactions
       WHERE user_id = ? AND type = 'earning' AND method = 'gateway_link'
       AND DATE(created_at) = CURDATE()`,
      [req.userId]
    );
    res.json({ ...s[0], today_earning: Number(today[0].earn) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/shortlink/links/:id ──
router.delete('/links/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    await pool.execute('DELETE FROM worker_links WHERE id = ? AND worker_id = ?', [req.params.id, req.userId]);
    res.json({ message: 'Đã xóa link' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
