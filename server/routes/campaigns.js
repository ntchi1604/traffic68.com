const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── Auto-migrate: đảm bảo cột pause_reason tồn tại ──────────────────────────
async function ensurePauseReasonCol(pool) {
  try {
    await pool.execute(`ALTER TABLE campaigns ADD COLUMN pause_reason VARCHAR(255) DEFAULT NULL AFTER note`);
  } catch (_) { /* already exists */ }
}

// ── Kiểm tra URL có bị redirect 301 sang domain mới không ──────────────────
// Trả về: null (ok) | string (domain mới nếu 301 đổi domain)
function checkRedirect(urlStr) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.request(
        { method: 'HEAD', hostname: parsed.hostname, path: parsed.pathname + parsed.search, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 },
        (res) => {
          if ([301, 302, 308].includes(res.statusCode) && res.headers.location) {
            try {
              const loc = new URL(res.headers.location, urlStr);
              const origHost = parsed.hostname.replace(/^www\./, '');
              const newHost = loc.hostname.replace(/^www\./, '');
              // Chỉ coi là "đổi domain" nếu hostname thực sự thay đổi
              if (origHost !== newHost) {
                return resolve({ changed: true, newDomain: loc.hostname, statusCode: res.statusCode });
              }
            } catch (_) { }
          }
          resolve(null);
        }
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    } catch (_) { resolve(null); }
  });
}

// ── Cache kết quả embed check — mỗi campaign check tối đa mỗi 30 phút ──
const _embedCheckCache = new Map(); // campId → { ts, result }
const EMBED_CHECK_TTL = 30 * 60 * 1000; // 30 phút

// ── Kiểm tra trang có gắn script widget không ─────────────────────────────
// tokens: mảng các token (VD: ['T68-ABCD12', 'T68-XY5678'])
// Trả về: 'ok' | 'not_found' | 'skip' (lỗi / CF / non-200)
function checkEmbedScript(urlStr, tokens) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === 'https:' ? https : http;
      let body = '';
      let settled = false;

      const req = mod.request(
        {
          method: 'GET',
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
          },
          timeout: 12000,
        },
        (res) => {
          // Chỉ phân tích khi status 200 và content là HTML
          const ct = (res.headers['content-type'] || '').toLowerCase();
          if (res.statusCode !== 200 || !ct.includes('html')) {
            res.resume();
            return resolve('skip'); // CF challenge / 403 / non-HTML → không hành động
          }

          // Đọc tối đa 500KB — script có thể ở cuối trang (trước </body>)
          let received = 0;
          res.on('data', (chunk) => {
            if (settled) return;
            body += chunk.toString('utf8', 0, Math.min(chunk.length, 500000 - received));
            received += chunk.length;
            if (received >= 500000) {
              settled = true;
              req.destroy();
              resolve(_hasToken(body, tokens));
            }
          });
          res.on('end', () => {
            if (!settled) {
              settled = true;
              resolve(_hasToken(body, tokens));
            }
          });
        }
      );

      req.on('error', () => { if (!settled) { settled = true; resolve('skip'); } });
      req.on('timeout', () => { if (!settled) { settled = true; req.destroy(); resolve('skip'); } });
      req.end();
    } catch (_) { resolve('skip'); }
  });
}

function _hasToken(html, tokens) {
  // Tìm bất kỳ token nào trong HTML (data-token="T68-...", token: 'T68-...', v.v.)
  // Cũng chấp nhận nếu trên trang có api_seo_traffic68 dùng token khác (user mới chưa xuất hiện)
  const lowerHtml = html.toLowerCase(); // ✅ Lowercase để search case-insensitive
  // Kiểm tra từng token cụ thể của user
  for (const tok of tokens) {
    if (lowerHtml.includes(tok.toLowerCase())) return 'ok';
  }
  // Nếu không thấy token cụ thể, kiểm tra xem có script traffic68 nào không
  // (user có thể đã gắn nhưng widget_url chưa khớp — không pause)
  if (lowerHtml.includes('api_seo_traffic68') || lowerHtml.includes('traffic68.com')) {
    return 'ok'; // Có script traffic68 trên trang, dù token không khớp → ok
  }
  return 'not_found';
}


const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'campaigns');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const origName = file.originalname || '';
    let ext = path.extname(origName).toLowerCase();
    if (!ext) {
      if (file.mimetype === 'image/jpeg') ext = '.jpg';
      else if (file.mimetype === 'image/png') ext = '.png';
      else if (file.mimetype === 'image/gif') ext = '.gif';
      else if (file.mimetype === 'image/webp') ext = '.webp';
      else ext = '.png'; // default fallback
    }
    cb(null, `campaign-${req.userId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const origName = file.originalname || '';
    const ext = path.extname(origName).toLowerCase();
    if (allowed.includes(ext) || allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp)'));
    }
  },
});


router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Chưa chọn file ảnh' });
    const imageUrl = `/uploads/campaigns/${req.file.filename}`;
    res.json({ message: 'Upload ảnh thành công', imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const { status, search } = req.query;

    const tz = 'Asia/Ho_Chi_Minh';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const dYes = new Date(); dYes.setDate(dYes.getDate() - 1);
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(dYes);

    // Ensure columns exist
    await ensurePauseReasonCol(pool);

    // ── Dùng LEFT JOIN thay correlated subqueries — giảm từ O(2N) xuống O(1) ──
    let sql = `SELECT c.*,
      COALESCE(tl_today.clicks, 0) as views_today,
      COALESCE(tl_yes.clicks, 0) as views_yesterday
      FROM campaigns c
      LEFT JOIN traffic_logs tl_today ON tl_today.campaign_id = c.id AND tl_today.date = ?
      LEFT JOIN traffic_logs tl_yes   ON tl_yes.campaign_id   = c.id AND tl_yes.date   = ?
      WHERE c.user_id = ?`;
    const params = [today, yesterday, req.userId];

    if (status && status !== 'all') { sql += ' AND c.status = ?'; params.push(status); }
    if (search) { sql += ' AND (c.name LIKE ? OR c.url LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY c.created_at DESC';

    const [campaigns] = await pool.execute(sql, params);

    // ── Auto-sync views_done (chỉ refetch khi có row bị thay đổi thực sự) ──
    try {
      const ids = campaigns.map(c => c.id);
      if (ids.length > 0) {
        const ph = ids.map(() => '?').join(',');

        // Đảm bảo cột manually_completed tồn tại trước khi dùng
        try { await pool.execute(`ALTER TABLE campaigns ADD COLUMN manually_completed TINYINT(1) NOT NULL DEFAULT 0`); } catch (_) { }

        const [syncResult] = await pool.execute(
          `UPDATE campaigns c SET views_done = (
            SELECT COUNT(*) FROM vuot_link_tasks WHERE campaign_id = c.id AND status = 'completed' AND bot_detected = 0
          ) WHERE c.id IN (${ph}) AND c.views_done != (
            SELECT COUNT(*) FROM vuot_link_tasks WHERE campaign_id = c.id AND status = 'completed' AND bot_detected = 0
          )`, ids
        );
        // Chỉ auto-revert nếu campaign KHÔNG được đánh dấu hoàn thành thủ công
        try {
          await pool.execute(
            `UPDATE campaigns SET status = 'running' WHERE id IN (${ph}) AND status = 'completed' AND views_done < total_views AND COALESCE(manually_completed, 0) = 0`, ids
          );
        } catch (_) { }
        if (syncResult.affectedRows > 0) {
          const [updated] = await pool.execute(sql, params);
          return res.json({ campaigns: updated });
        }
      }
    } catch (_) { }

    // ── Background checks: redirect 301 (BỎ check embed script) ──
    setImmediate(async () => {
      try {
        const running = campaigns.filter(c => c.status === 'running' && c.url);
        // Chỉ check tối đa 3 campaign mỗi lần để tránh quá tải
        const toCheck = running.slice(0, 3);

        for (const camp of toCheck) {
          // Kiểm tra 301 redirect
          const redirectResult = await checkRedirect(camp.url);
          if (redirectResult && redirectResult.changed) {
            const reason = `Đổi domain → ${redirectResult.newDomain}`;
            await pool.execute(
              `UPDATE campaigns SET status = 'paused', pause_reason = ? WHERE id = ? AND status = 'running'`,
              [reason, camp.id]
            );
            console.log(`[Campaign] Auto-paused #${camp.id} "${camp.name}": 301 → ${redirectResult.newDomain}`);
            await pool.execute(
              `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
              [camp.user_id, 'Chiến dịch tạm dừng tự động',
              `Chiến dịch "${camp.name}" đã bị tạm dừng do website đích đổi domain sang ${redirectResult.newDomain}.`,
                'warning', 'buyer']
            );
          }
        }
      } catch (e) { console.error('[Campaign] Background check error:', e.message); }
    });

    res.json({ campaigns });
  } catch (err) {
    console.error('get campaigns error:', err);
    res.status(500).json({ error: err.message, campaigns: [] });
  }
});


router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { name, url, url2, budget, cpc, keyword, note, trafficType, traffic_type, dailyViews, daily_views, totalViews, total_views, viewByHour, view_by_hour, version, targetPage, target_page, timeOnSite, time_on_site, duration, discount_applied, discount_code, image1_url, image2_url, device } = req.body;
    const _device = (device && typeof device === 'string' && device.trim()) ? device.trim() : 'desktop,mobile';

    const _trafficType = trafficType || traffic_type || 'google_search';
    // ⚠️ Dùng ?? thay vì || để tránh 0 bị coi là falsy (0 = không giới hạn, khác với undefined)
    const _dailyViews = (dailyViews !== undefined && dailyViews !== null) ? Number(dailyViews)
      : (daily_views !== undefined && daily_views !== null) ? Number(daily_views)
        : 0; // 0 = không giới hạn (mặc định)
    const _totalViews = totalViews || total_views || 1000;
    const _viewByHour = (viewByHour !== undefined && viewByHour !== null) ? (viewByHour ? 1 : 0)
      : (view_by_hour !== undefined && view_by_hour !== null) ? (view_by_hour ? 1 : 0)
        : 0;
    const _targetPage = targetPage || target_page || '';
    const _timeOnSite = timeOnSite || time_on_site || (duration ? String(duration) : '60');
    const _version = version || 'v1';
    const _versionInt = _version === 'v2' ? 2 : 1;

    if (!name || !url) return res.status(400).json({ error: 'Tên và URL chiến dịch là bắt buộc' });


    let realBudget = budget || 0;
    let useDiscount = false;
    try {
      const durSec = duration ? duration + 's' : '';
      const [tiers] = await pool.execute(
        'SELECT * FROM pricing_tiers WHERE traffic_type = ? AND duration = ?',
        [_trafficType, durSec]
      );
      if (tiers.length > 0) {
        const tier = tiers[0];
        useDiscount = false;
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


    const calculatedCpc = _totalViews > 0 ? Math.round(realBudget / _totalViews) : (cpc || 0);
    const _keywordConfig = req.body.keyword_config || null;

    let result;
    try {
      [result] = await pool.execute(
        `INSERT INTO campaigns (user_id, name, url, url2, traffic_type, version, budget, cpc, daily_views, total_views, view_by_hour, keyword, keyword_config, target_page, time_on_site, image1_url, image2_url, discount_applied, device, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.userId, name, url, url2 || null, _trafficType, _versionInt, realBudget, calculatedCpc, _dailyViews, _totalViews, _viewByHour, keyword || '', _keywordConfig, _targetPage, _timeOnSite, image1_url || null, image2_url || null, useDiscount ? 1 : 0, _device, note || null]
      );
    } catch (colErr) {
      // Fallback: nếu cột device/note chưa tồn tại → auto-migrate rồi retry không có 2 cột đó
      if (colErr.message && (colErr.message.includes('device') || colErr.message.includes('note') || colErr.message.includes('keyword_config'))) {
        // Auto-add missing columns (chạy song song, bỏ qua lỗi duplicate)
        await Promise.allSettled([
          pool.execute("ALTER TABLE campaigns ADD COLUMN keyword_config TEXT DEFAULT NULL AFTER keyword"),
          pool.execute("ALTER TABLE campaigns MODIFY COLUMN keyword TEXT DEFAULT NULL"),
          pool.execute("ALTER TABLE campaigns ADD COLUMN device VARCHAR(50) NOT NULL DEFAULT 'desktop,mobile' AFTER priority"),
          pool.execute("ALTER TABLE campaigns ADD COLUMN note TEXT DEFAULT NULL AFTER device"),
        ]);
        // Retry với đầy đủ cột
        [result] = await pool.execute(
          `INSERT INTO campaigns (user_id, name, url, url2, traffic_type, version, budget, cpc, daily_views, total_views, view_by_hour, keyword, keyword_config, target_page, time_on_site, image1_url, image2_url, discount_applied, device, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.userId, name, url, url2 || null, _trafficType, _versionInt, realBudget, calculatedCpc, _dailyViews, _totalViews, _viewByHour, keyword || '', _keywordConfig, _targetPage, _timeOnSite, image1_url || null, image2_url || null, useDiscount ? 1 : 0, _device, note || null]
        );
      } else {
        throw colErr;
      }
    }



    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [req.userId, 'Chiến dịch mới được tạo', `Chiến dịch "${name}" đã được tạo thành công. Ngân sách ${realBudget.toLocaleString('vi-VN')} đ sẽ trừ dần theo lượt xem.`, 'success', 'buyer']
    );

    const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Tạo chiến dịch thành công', campaign: campaigns[0] });
  } catch (err) {
    console.error('Campaign create error:', err);
    res.status(500).json({ error: 'Lỗi tạo chiến dịch: ' + err.message });
  }
});


router.get('/:id', async (req, res) => {
  const pool = getPool();
  const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (campaigns.length === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  res.json({ campaign: campaigns[0] });
});


router.get('/:id/keyword-stats', async (req, res) => {
  try {
    const pool = getPool();
    const [camp] = await pool.execute('SELECT id FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!camp.length) return res.status(404).json({ error: 'Không tìm thấy' });

    const [rows] = await pool.execute(
      `SELECT
         keyword,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' AND bot_detected = 0 THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status IN ('pending','step1','step2','step3') THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
         SUM(CASE WHEN bot_detected = 1 THEN 1 ELSE 0 END) as blocked,
         COALESCE(SUM(earning), 0) as cost
       FROM vuot_link_tasks
       WHERE campaign_id = ?
       GROUP BY keyword
       ORDER BY completed DESC`,
      [req.params.id]
    );
    res.json({ keywords: rows });

    const realViews = rows.reduce((s, r) => s + Number(r.completed), 0);
    pool.execute('SELECT views_done, total_views, status FROM campaigns WHERE id = ?', [req.params.id]).then(([c]) => {
      if (c[0]) {
        if (Number(c[0].views_done) !== realViews) {
          pool.execute('UPDATE campaigns SET views_done = ? WHERE id = ?', [realViews, req.params.id]).catch(() => { });
        }
        // Chỉ auto-revert nếu campaign không được đánh dấu hoàn thành thủ công
        if (c[0].status === 'completed' && realViews < Number(c[0].total_views) && !c[0].manually_completed) {
          pool.execute("UPDATE campaigns SET status = 'running' WHERE id = ?", [req.params.id]).catch(() => { });
        }
      }
    }).catch(() => { });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




router.put('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const [existing] = await pool.execute('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });

    const { name, url, url2, trafficType, version, budget, cpc, dailyViews, totalViews, viewByHour, keyword, keyword_config, targetPage, timeOnSite, status, image1_url, image2_url, device, note } = req.body;
    const n = (v) => v === undefined ? null : v;

    // No longer safely unlinking images here because they are JSON arrays and might be shared across campaigns/keywords.

    // ── Handle totalViews change: chỉ cập nhật budget trong campaigns, KHÔNG trừ/hoàn ví ──
    // Lý do: tiền được trừ dần theo từng lượt xem thực tế trong vuotlink.js (per-view billing).
    // Nếu trừ thêm diff ở đây, buyer sẽ bị tính tiền 2 lần (double-charge).
    const oldCampaign = existing[0];
    let newBudget = n(budget);
    if (totalViews !== undefined && Number(totalViews) !== Number(oldCampaign.total_views)) {
      const newTotal = Number(totalViews) || 0;
      const cpcValue = Number(oldCampaign.cpc) || 0;
      if (cpcValue > 0) {
        newBudget = Math.round(newTotal * cpcValue);
      }
    }

    try {
      // Try with all columns including device, note
      await pool.execute(
        `UPDATE campaigns SET name=COALESCE(?,name), url=COALESCE(?,url), url2=COALESCE(?,url2), traffic_type=COALESCE(?,traffic_type), version=COALESCE(?,version), budget=COALESCE(?,budget), cpc=COALESCE(?,cpc), daily_views=COALESCE(?,daily_views), total_views=COALESCE(?,total_views), view_by_hour=COALESCE(?,view_by_hour), keyword=COALESCE(?,keyword), keyword_config=COALESCE(?,keyword_config), target_page=COALESCE(?,target_page), time_on_site=COALESCE(?,time_on_site), status=COALESCE(?,status), image1_url=COALESCE(?,image1_url), image2_url=COALESCE(?,image2_url), device=COALESCE(?,device), note=COALESCE(?,note) WHERE id = ? AND user_id = ?`,
        [n(name), n(url), n(url2), n(trafficType), n(version), newBudget, n(cpc), n(dailyViews), n(totalViews), n(viewByHour), n(keyword), n(keyword_config), n(targetPage), n(timeOnSite), n(status), n(image1_url), n(image2_url), n(device), n(note), req.params.id, req.userId]
      );
    } catch (colErr) {
      if (colErr.message && (colErr.message.includes('device') || colErr.message.includes('note') || colErr.message.includes('keyword_config'))) {
        // Auto-add missing columns rồi retry
        await Promise.allSettled([
          pool.execute("ALTER TABLE campaigns ADD COLUMN keyword_config TEXT DEFAULT NULL AFTER keyword"),
          pool.execute("ALTER TABLE campaigns MODIFY COLUMN keyword TEXT DEFAULT NULL"),
          pool.execute("ALTER TABLE campaigns ADD COLUMN device VARCHAR(50) NOT NULL DEFAULT 'desktop,mobile' AFTER priority"),
          pool.execute("ALTER TABLE campaigns ADD COLUMN note TEXT DEFAULT NULL AFTER device"),
        ]);
        await pool.execute(
          `UPDATE campaigns SET name=COALESCE(?,name), url=COALESCE(?,url), url2=COALESCE(?,url2), traffic_type=COALESCE(?,traffic_type), version=COALESCE(?,version), budget=COALESCE(?,budget), cpc=COALESCE(?,cpc), daily_views=COALESCE(?,daily_views), total_views=COALESCE(?,total_views), view_by_hour=COALESCE(?,view_by_hour), keyword=COALESCE(?,keyword), keyword_config=COALESCE(?,keyword_config), target_page=COALESCE(?,target_page), time_on_site=COALESCE(?,time_on_site), status=COALESCE(?,status), image1_url=COALESCE(?,image1_url), image2_url=COALESCE(?,image2_url), device=COALESCE(?,device), note=COALESCE(?,note) WHERE id = ? AND user_id = ?`,
          [n(name), n(url), n(url2), n(trafficType), n(version), newBudget, n(cpc), n(dailyViews), n(totalViews), n(viewByHour), n(keyword), n(keyword_config), n(targetPage), n(timeOnSite), n(status), n(image1_url), n(image2_url), n(device), n(note), req.params.id, req.userId]
        );
      } else {
        throw colErr;
      }
    }

    const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cập nhật thành công', campaign: campaigns[0] });
  } catch (err) {
    console.error('Campaign update error:', err);
    res.status(500).json({ error: 'Lỗi cập nhật: ' + err.message });
  }
});


router.put('/:id/status', async (req, res) => {
  const pool = getPool();
  const { status } = req.body;
  if (!['running', 'paused', 'completed'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  // Đánh dấu manually_completed để ngăn auto-revert
  const manuallyCompleted = status === 'completed' ? 1 : 0;

  if (status === 'completed') {
    const [rows] = await pool.execute('SELECT image1_url FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (rows[0]?.image1_url) {
      await pool.execute('UPDATE campaigns SET image1_url = NULL WHERE id = ?', [req.params.id]);
    }
  }

  // Auto-add columns nếu chưa tồn tại
  try { await pool.execute(`ALTER TABLE campaigns ADD COLUMN manually_completed TINYINT(1) NOT NULL DEFAULT 0`); } catch (_) { }
  await ensurePauseReasonCol(pool);

  // Khi user tự tay resume (running) → xóa pause_reason
  const clearReason = status === 'running' ? null : undefined;

  const [result] = await pool.execute(
    clearReason === null
      ? 'UPDATE campaigns SET status = ?, manually_completed = ?, pause_reason = NULL WHERE id = ? AND user_id = ?'
      : 'UPDATE campaigns SET status = ?, manually_completed = ? WHERE id = ? AND user_id = ?',
    clearReason === null
      ? [status, manuallyCompleted, req.params.id, req.userId]
      : [status, manuallyCompleted, req.params.id, req.userId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  res.json({ message: 'Đã cập nhật trạng thái' });
});


// ── Gia hạn chiến dịch đã hoàn thành ──────────────────────────────────────────
router.post('/:id/renew', async (req, res) => {
  try {
    const pool = getPool();
    const { extraViews } = req.body;
    const addViews = parseInt(extraViews, 10);
    if (!addViews || addViews <= 0) return res.status(400).json({ error: 'Số view gia hạn phải lớn hơn 0' });

    const [existing] = await pool.execute(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });

    const camp = existing[0];
    const cpcValue = Number(camp.cpc) || 0;
    if (cpcValue <= 0) return res.status(400).json({ error: 'Không xác định được đơn giá CPC của chiến dịch' });

    const cost = Math.round(addViews * cpcValue);

    try { await pool.execute(`ALTER TABLE campaigns ADD COLUMN manually_completed TINYINT(1) NOT NULL DEFAULT 0`); } catch (_) { }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [deductResult] = await conn.execute(
        "UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = 'main' AND balance >= ?",
        [cost, req.userId, cost]
      );
      if (deductResult.affectedRows === 0) {
        await conn.rollback();
        conn.release();
        const [wCheck] = await pool.execute("SELECT balance FROM wallets WHERE user_id = ? AND type = 'main'", [req.userId]);
        const currentBal = Number(wCheck[0]?.balance || 0);
        return res.status(400).json({
          error: `Số dư ví không đủ. Cần ${cost.toLocaleString('vi-VN')} đ, hiện có ${currentBal.toLocaleString('vi-VN')} đ`
        });
      }

      const renewRef = 'RNW-' + Date.now();
      await conn.execute(
        `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
         VALUES (?, 'main', 'campaign', 'system', ?, 'completed', ?, ?)`,
        [req.userId, cost, renewRef, `Gia hạn chiến dịch "${camp.name}" (+${addViews.toLocaleString()} view)`]
      );

      const newTotal = Number(camp.total_views) + addViews;
      const newBudget = Math.round(newTotal * cpcValue);
      await conn.execute(
        `UPDATE campaigns SET total_views = ?, budget = ?, status = 'running', manually_completed = 0 WHERE id = ?`,
        [newTotal, newBudget, camp.id]
      );

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      conn.release();
      console.error('[Campaign] Renew transaction ROLLED BACK (ví chưa bị trừ):', txErr.message);
      return res.status(500).json({ error: 'Lỗi gia hạn (tiền chưa bị trừ): ' + txErr.message });
    }
    conn.release();

    pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [req.userId, 'Gia hạn chiến dịch thành công',
      `Chiến dịch "${camp.name}" đã được gia hạn thêm ${addViews.toLocaleString()} view. Đã trừ ${cost.toLocaleString('vi-VN')} đ.`,
        'success', 'buyer']
    ).catch(() => { });

    const [updated] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [camp.id]);
    res.json({ message: 'Gia hạn thành công', campaign: updated[0] });
  } catch (err) {
    console.error('Campaign renew error:', err);
    res.status(500).json({ error: 'Lỗi gia hạn: ' + err.message });
  }
});


router.delete('/:id', async (req, res) => {
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  res.json({ message: 'Đã xoá chiến dịch' });
});

module.exports = router;
