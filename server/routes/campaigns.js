const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/campaigns ──
router.get('/', async (req, res) => {
  const pool = getPool();
  const { status, search } = req.query;
  let sql = 'SELECT * FROM campaigns WHERE user_id = ?';
  const params = [req.userId];

  if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
  if (search) { sql += ' AND (name LIKE ? OR url LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC';

  const [campaigns] = await pool.execute(sql, params);
  res.json({ campaigns });
});

// ── POST /api/campaigns ──
router.post('/', async (req, res) => {
  const pool = getPool();
  const { name, url, budget, cpc, keyword, note, trafficType, traffic_type, dailyViews, daily_views, totalViews, total_views, viewByHour, view_by_hour, version, targetPage, target_page, timeOnSite, time_on_site } = req.body;

  const _trafficType = trafficType || traffic_type || 'google_search';
  const _dailyViews = dailyViews || daily_views || 500;
  const _totalViews = totalViews || total_views || 1000;
  const _viewByHour = viewByHour || view_by_hour || 0;
  const _targetPage = targetPage || target_page || '';
  const _timeOnSite = timeOnSite || time_on_site || '60-120';

  if (!name || !url) return res.status(400).json({ error: 'Tên và URL chiến dịch là bắt buộc' });

  const [wallets] = await pool.execute('SELECT balance FROM wallets WHERE user_id = ? AND type = ?', [req.userId, 'main']);
  if (!wallets[0] || wallets[0].balance < (budget || 0)) {
    return res.status(400).json({ error: 'Số dư ví không đủ để tạo chiến dịch' });
  }

  const [result] = await pool.execute(
    `INSERT INTO campaigns (user_id, name, url, traffic_type, version, budget, cpc, daily_views, total_views, view_by_hour, keyword, target_page, time_on_site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, name, url, _trafficType, version || 1, budget || 0, cpc || 0, _dailyViews, _totalViews, _viewByHour, keyword || '', _targetPage, _timeOnSite]
  );

  if (budget > 0) {
    await pool.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = ?', [budget, req.userId, 'main']);
    const refCode = 'CMP-' + Date.now();
    await pool.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, 'main', 'withdraw', 'system', budget, 'completed', refCode, `Tạo chiến dịch: ${name}`]
    );
  }

  await pool.execute(
    `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
    [req.userId, 'Chiến dịch mới được tạo', `Chiến dịch "${name}" đã được tạo thành công.`, 'success']
  );

  const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Tạo chiến dịch thành công', campaign: campaigns[0] });
});

// ── GET /api/campaigns/:id ──
router.get('/:id', async (req, res) => {
  const pool = getPool();
  const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (campaigns.length === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  res.json({ campaign: campaigns[0] });
});

// ── PUT /api/campaigns/:id ──
router.put('/:id', async (req, res) => {
  const pool = getPool();
  const [existing] = await pool.execute('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (existing.length === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });

  const { name, url, trafficType, version, budget, cpc, dailyViews, totalViews, viewByHour, keyword, targetPage, timeOnSite, status } = req.body;

  await pool.execute(
    `UPDATE campaigns SET name=COALESCE(?,name), url=COALESCE(?,url), traffic_type=COALESCE(?,traffic_type), version=COALESCE(?,version), budget=COALESCE(?,budget), cpc=COALESCE(?,cpc), daily_views=COALESCE(?,daily_views), total_views=COALESCE(?,total_views), view_by_hour=COALESCE(?,view_by_hour), keyword=COALESCE(?,keyword), target_page=COALESCE(?,target_page), time_on_site=COALESCE(?,time_on_site), status=COALESCE(?,status) WHERE id = ? AND user_id = ?`,
    [name, url, trafficType, version, budget, cpc, dailyViews, totalViews, viewByHour, keyword, targetPage, timeOnSite, status, req.params.id, req.userId]
  );

  const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
  res.json({ message: 'Cập nhật thành công', campaign: campaigns[0] });
});

// ── PUT /api/campaigns/:id/status ──
router.put('/:id/status', async (req, res) => {
  const pool = getPool();
  const { status } = req.body;
  if (!['running', 'paused', 'completed'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  const [result] = await pool.execute('UPDATE campaigns SET status = ? WHERE id = ? AND user_id = ?', [status, req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  res.json({ message: 'Đã cập nhật trạng thái' });
});

// ── DELETE /api/campaigns/:id ──
router.delete('/:id', async (req, res) => {
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  res.json({ message: 'Đã xoá chiến dịch' });
});

module.exports = router;
