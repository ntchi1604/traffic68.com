const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ── Generate random slug ──
function genSlug(len = 7) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

// ── GET /api/shortlink/campaigns — available campaigns for workers ──
router.get('/campaigns', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const { search = '' } = req.query;
    let sql = `
      SELECT c.id, c.name, c.url, c.traffic_type, c.keyword, c.cpc, c.time_on_site,
             c.views_done, c.total_views, c.status,
             (SELECT COUNT(*) FROM worker_links wl WHERE wl.campaign_id = c.id AND wl.worker_id = ?) as my_links
      FROM campaigns c
      WHERE c.status = 'running' AND c.views_done < c.total_views
    `;
    const params = [req.userId];
    if (search) { sql += ' AND (c.name LIKE ? OR c.keyword LIKE ? OR c.url LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    sql += ' ORDER BY c.cpc DESC LIMIT 50';
    const [campaigns] = await pool.execute(sql, params);
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/shortlink/create — worker creates a short link ──
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const { campaign_id } = req.body;
    if (!campaign_id) return res.status(400).json({ error: 'campaign_id is required' });

    // Verify campaign is running
    const [camps] = await pool.execute(
      `SELECT id, name, url, cpc, status, views_done, total_views FROM campaigns WHERE id = ? AND status = 'running' AND views_done < total_views`,
      [campaign_id]
    );
    if (!camps.length) return res.status(404).json({ error: 'Campaign không tồn tại hoặc đã kết thúc' });

    // Check if worker already has a link for this campaign
    const [existing] = await pool.execute(
      'SELECT id, slug FROM worker_links WHERE worker_id = ? AND campaign_id = ?',
      [req.userId, campaign_id]
    );
    if (existing.length > 0) {
      return res.json({ slug: existing[0].slug, existing: true });
    }

    // Generate unique slug
    let slug, tries = 0;
    do {
      slug = genSlug(7);
      const [dup] = await pool.execute('SELECT id FROM worker_links WHERE slug = ?', [slug]);
      if (!dup.length) break;
    } while (++tries < 10);

    await pool.execute(
      'INSERT INTO worker_links (worker_id, campaign_id, slug) VALUES (?, ?, ?)',
      [req.userId, campaign_id, slug]
    );

    res.json({ slug, existing: false, campaign: camps[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/shortlink/links — worker's own links ──
router.get('/links', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [links] = await pool.execute(
      `SELECT wl.id, wl.slug, wl.click_count, wl.earning, wl.created_at,
              c.id as campaign_id, c.name as campaign_name, c.url as campaign_url,
              c.cpc, c.traffic_type, c.status as campaign_status
       FROM worker_links wl
       JOIN campaigns c ON c.id = wl.campaign_id
       WHERE wl.worker_id = ?
       ORDER BY wl.created_at DESC`,
      [req.userId]
    );
    res.json({ links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/shortlink/stats — summary stats ──
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [summary] = await pool.execute(
      `SELECT COUNT(*) as total_links, COALESCE(SUM(click_count),0) as total_clicks,
              COALESCE(SUM(earning),0) as total_earning
       FROM worker_links WHERE worker_id = ?`,
      [req.userId]
    );
    const [today] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) as earn FROM transactions
       WHERE user_id = ? AND type = 'earning' AND wallet_type = 'earning'
       AND DATE(created_at) = CURDATE() AND method = 'shortlink'`,
      [req.userId]
    );
    res.json({ ...summary[0], today_earning: Number(today[0].earn) });
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
