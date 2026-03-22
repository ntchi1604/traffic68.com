const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── Multer config for campaign images ──
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'campaigns');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `campaign-${req.userId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp)'));
  },
});

// ── POST /api/campaigns/upload-image ──
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Chưa chọn file ảnh' });
    const imageUrl = `/uploads/campaigns/${req.file.filename}`;
    res.json({ message: 'Upload ảnh thành công', imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
  try {
    const pool = getPool();
    const { name, url, url2, budget, cpc, keyword, note, trafficType, traffic_type, dailyViews, daily_views, totalViews, total_views, viewByHour, view_by_hour, version, targetPage, target_page, timeOnSite, time_on_site, duration, discount_applied, discount_code, image1_url, image2_url } = req.body;

    const _trafficType = trafficType || traffic_type || 'google_search';
    const _dailyViews = dailyViews || daily_views || 500;
    const _totalViews = totalViews || total_views || 1000;
    const _viewByHour = viewByHour || view_by_hour || 0;
    const _targetPage = targetPage || target_page || '';
    const _timeOnSite = timeOnSite || time_on_site || (duration ? String(duration) : '60');
    const _version = version || 'v1';
    const _versionInt = _version === 'v2' ? 2 : 1;

    if (!name || !url) return res.status(400).json({ error: 'Tên và URL chiến dịch là bắt buộc' });

    // ── Calculate real budget from DB pricing ──
    let realBudget = budget || 0;
    try {
      const durSec = duration ? duration + 's' : '';
      const [tiers] = await pool.execute(
        'SELECT * FROM pricing_tiers WHERE traffic_type = ? AND duration = ?',
        [_trafficType, durSec]
      );
      if (tiers.length > 0) {
        const tier = tiers[0];
        let useDiscount = false;
        if (discount_applied && discount_code) {
          const [dcSettings] = await pool.execute("SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ('discount_enabled','discount_code')");
          const cfg = {};
          dcSettings.forEach(s => { cfg[s.setting_key] = s.setting_value; });
          useDiscount = cfg.discount_enabled === 'true' && cfg.discount_code && cfg.discount_code.toUpperCase() === discount_code.trim().toUpperCase();
        }
        const price = _version === 'v1'
          ? (useDiscount ? tier.v1_discount : tier.v1_price)
          : (useDiscount ? tier.v2_discount : tier.v2_price);
        realBudget = Math.round(_totalViews * price);
      }
    } catch (e) {
      console.log('Pricing lookup failed, using submitted budget:', e.message);
    }

    const [wallets] = await pool.execute('SELECT balance FROM wallets WHERE user_id = ? AND type = ?', [req.userId, 'main']);
    if (!wallets[0] || wallets[0].balance < realBudget) {
      return res.status(400).json({ error: `Số dư ví không đủ. Cần ${realBudget} VNĐ, hiện có ${wallets[0]?.balance || 0} VNĐ` });
    }

    const [result] = await pool.execute(
      `INSERT INTO campaigns (user_id, name, url, url2, traffic_type, version, budget, cpc, daily_views, total_views, view_by_hour, keyword, target_page, time_on_site, image1_url, image2_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, name, url, url2 || null, _trafficType, _versionInt, realBudget, cpc || 0, _dailyViews, _totalViews, _viewByHour, keyword || '', _targetPage, _timeOnSite, image1_url || null, image2_url || null]
    );

    if (realBudget > 0) {
      await pool.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = ?', [realBudget, req.userId, 'main']);
      const refCode = 'CMP-' + Date.now();
      await pool.execute(
        `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.userId, 'main', 'campaign', 'system', realBudget, 'completed', refCode, `Tạo chiến dịch: ${name}`]
      );
    }

    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [req.userId, 'Chiến dịch mới được tạo', `Chiến dịch "${name}" đã được tạo thành công.`, 'success']
    );

    const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Tạo chiến dịch thành công', campaign: campaigns[0] });
  } catch (err) {
    console.error('Campaign create error:', err);
    res.status(500).json({ error: 'Lỗi tạo chiến dịch: ' + err.message });
  }
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
  try {
    const pool = getPool();
    const [existing] = await pool.execute('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });

    const { name, url, url2, trafficType, version, budget, cpc, dailyViews, totalViews, viewByHour, keyword, targetPage, timeOnSite, status, image1_url, image2_url } = req.body;
    const n = (v) => v === undefined ? null : v;

    // Delete old images if new ones provided
    const oldImage1 = existing[0].image1_url;
    const oldImage2 = existing[0].image2_url;
    if (image1_url !== undefined && oldImage1 && oldImage1 !== image1_url) {
      const p = path.join(__dirname, '..', '..', oldImage1);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (image2_url !== undefined && oldImage2 && oldImage2 !== image2_url) {
      const p = path.join(__dirname, '..', '..', oldImage2);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    await pool.execute(
      `UPDATE campaigns SET name=COALESCE(?,name), url=COALESCE(?,url), url2=COALESCE(?,url2), traffic_type=COALESCE(?,traffic_type), version=COALESCE(?,version), budget=COALESCE(?,budget), cpc=COALESCE(?,cpc), daily_views=COALESCE(?,daily_views), total_views=COALESCE(?,total_views), view_by_hour=COALESCE(?,view_by_hour), keyword=COALESCE(?,keyword), target_page=COALESCE(?,target_page), time_on_site=COALESCE(?,time_on_site), status=COALESCE(?,status), image1_url=COALESCE(?,image1_url), image2_url=COALESCE(?,image2_url) WHERE id = ? AND user_id = ?`,
      [n(name), n(url), n(url2), n(trafficType), n(version), n(budget), n(cpc), n(dailyViews), n(totalViews), n(viewByHour), n(keyword), n(targetPage), n(timeOnSite), n(status), n(image1_url), n(image2_url), req.params.id, req.userId]
    );

    const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cập nhật thành công', campaign: campaigns[0] });
  } catch (err) {
    console.error('Campaign update error:', err);
    res.status(500).json({ error: 'Lỗi cập nhật: ' + err.message });
  }
});

// ── PUT /api/campaigns/:id/status ──
router.put('/:id/status', async (req, res) => {
  const pool = getPool();
  const { status } = req.body;
  if (!['running', 'paused', 'completed'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  // Auto-delete image when campaign is completed
  if (status === 'completed') {
    const [rows] = await pool.execute('SELECT image1_url FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (rows[0]?.image1_url) {
      const imgPath = path.join(__dirname, '..', '..', rows[0].image1_url);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      await pool.execute('UPDATE campaigns SET image1_url = NULL WHERE id = ?', [req.params.id]);
    }
  }

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
