const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/campaigns ──
router.get('/', (req, res) => {
  const db = getDb();
  const { status, search } = req.query;

  let sql = 'SELECT * FROM campaigns WHERE user_id = ?';
  const params = [req.userId];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR url LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY created_at DESC';

  const campaigns = db.prepare(sql).all(...params);
  res.json({ campaigns });
});

// ── POST /api/campaigns ──
router.post('/', (req, res) => {
  const db = getDb();
  const {
    name, url, budget, cpc, keyword, note,
    trafficType, traffic_type,
    dailyViews, daily_views,
    totalViews, total_views,
    viewByHour, view_by_hour,
    version, targetPage, target_page, timeOnSite, time_on_site,
    duration, device, country,
  } = req.body;

  const _trafficType = trafficType || traffic_type || 'google_search';
  const _dailyViews = dailyViews || daily_views || 500;
  const _totalViews = totalViews || total_views || 1000;
  const _viewByHour = viewByHour || view_by_hour || 0;
  const _targetPage = targetPage || target_page || '';
  const _timeOnSite = timeOnSite || time_on_site || '60-120';

  if (!name || !url) {
    return res.status(400).json({ error: 'Tên và URL chiến dịch là bắt buộc' });
  }

  // Check wallet balance
  const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ? AND type = ?').get(req.userId, 'main');
  if (!wallet || wallet.balance < (budget || 0)) {
    return res.status(400).json({ error: 'Số dư ví không đủ để tạo chiến dịch' });
  }

  const result = db.prepare(`
    INSERT INTO campaigns (user_id, name, url, traffic_type, version, budget, cpc, daily_views, total_views, view_by_hour, keyword, target_page, time_on_site)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.userId, name, url,
    _trafficType,
    version || 1,
    budget || 0, cpc || 0,
    _dailyViews, _totalViews,
    _viewByHour,
    keyword || '', _targetPage, _timeOnSite,
  );

  // Deduct budget from wallet
  if (budget > 0) {
    db.prepare('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = ?').run(budget, req.userId, 'main');

    // Record transaction
    const refCode = 'CMP-' + Date.now();
    db.prepare(`
      INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, 'main', 'withdraw', 'system', budget, 'completed', refCode, `Tạo chiến dịch: ${name}`);
  }

  // Notification
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (?, ?, ?, ?)
  `).run(req.userId, 'Chiến dịch mới được tạo', `Chiến dịch "${name}" đã được tạo thành công.`, 'success');

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: 'Tạo chiến dịch thành công', campaign });
});

// ── GET /api/campaigns/:id ──
router.get('/:id', (req, res) => {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);

  if (!campaign) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  res.json({ campaign });
});

// ── PUT /api/campaigns/:id ──
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);

  if (!existing) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });

  const {
    name, url, trafficType, version, budget, cpc,
    dailyViews, totalViews, viewByHour, keyword, targetPage, timeOnSite, status,
  } = req.body;

  db.prepare(`
    UPDATE campaigns SET
      name = COALESCE(?, name),
      url = COALESCE(?, url),
      traffic_type = COALESCE(?, traffic_type),
      version = COALESCE(?, version),
      budget = COALESCE(?, budget),
      cpc = COALESCE(?, cpc),
      daily_views = COALESCE(?, daily_views),
      total_views = COALESCE(?, total_views),
      view_by_hour = COALESCE(?, view_by_hour),
      keyword = COALESCE(?, keyword),
      target_page = COALESCE(?, target_page),
      time_on_site = COALESCE(?, time_on_site),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    name, url, trafficType, version, budget, cpc,
    dailyViews, totalViews, viewByHour, keyword, targetPage, timeOnSite, status,
    req.params.id, req.userId,
  );

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  res.json({ message: 'Cập nhật thành công', campaign });
});

// ── PUT /api/campaigns/:id/status ──
router.put('/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body; // running | paused

  if (!['running', 'paused', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }

  const result = db.prepare('UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
    .run(status, req.params.id, req.userId);

  if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  res.json({ message: 'Đã cập nhật trạng thái' });
});

// ── DELETE /api/campaigns/:id ──
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);

  if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  res.json({ message: 'Đã xoá chiến dịch' });
});

module.exports = router;
