const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Fields no longer used by embed script v3
const DEPRECATED_FIELDS = ['code', 'icon'];
function stripDeprecated(config) {
  const clean = { ...config };
  for (const f of DEPRECATED_FIELDS) delete clean[f];
  return clean;
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC endpoints — called by api_seo_traffic68.js
═══════════════════════════════════════════════════════════ */

// ── GET /api/widgets/public/:token ──
router.get('/public/:token', async (req, res) => {
  const pool = getPool();
  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại hoặc đã bị tắt' });

  let config = {};
  try { config = JSON.parse(widgets[0].config || '{}'); } catch {}

  // Check if the page URL matches a running campaign
  const pageUrl = req.query.pageUrl || '';
  let campaignInfo = null;

  if (pageUrl) {
    try {
      // Normalize: remove trailing slash, protocol, www for flexible matching
      const normalize = (u) => u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();
      const normalPage = normalize(pageUrl);

      const [campaigns] = await pool.execute(
        `SELECT id, url, time_on_site, keyword FROM campaigns 
         WHERE user_id = ? AND status = 'running' AND views_done < total_views 
         ORDER BY created_at DESC`,
        [widgets[0].user_id]
      );

      // Find campaign whose url matches the page URL (flexible match)
      for (const camp of campaigns) {
        const normalCamp = normalize(camp.url || '');
        // Match if page URL starts with or equals the campaign URL
        if (normalPage === normalCamp || normalPage.startsWith(normalCamp + '/') || normalCamp.startsWith(normalPage)) {
          // Parse time_on_site — could be "60-120" range or just "90"
          let waitTime = 30; // fallback
          const tos = camp.time_on_site || '';
          if (tos.includes('-')) {
            // Range: pick first number (min)
            waitTime = parseInt(tos.split('-')[0]) || 30;
          } else {
            waitTime = parseInt(tos) || 30;
          }
          campaignInfo = { campaignId: camp.id, waitTime };
          break;
        }
      }
    } catch (err) {
      console.error('Campaign lookup error:', err.message);
    }
  }

  // Strip deprecated fields & override waitTime from campaign
  config = stripDeprecated(config);
  if (campaignInfo) {
    config.waitTime = campaignInfo.waitTime;
  }

  res.json({
    config,
    campaignFound: !!campaignInfo,
    campaignId: campaignInfo?.campaignId || null,
  });
});

// ── POST /api/widgets/public/:token/get-code ──
// Called by embed script on target website after countdown finishes
// Finds pending vuot_link_task matching visitor's IP → returns the code
// Does NOT count as view — view is counted when user verifies code on VuotLink page
router.post('/public/:token/get-code', async (req, res) => {
  const pool = getPool();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại' });

  // Find pending/active vuot_link_task matching this IP
  // Tasks are created by VuotLink page with status pending/step1/step2/step3
  const [tasks] = await pool.execute(
    `SELECT vt.*, c.url as campaign_url FROM vuot_link_tasks vt
     JOIN campaigns c ON c.id = vt.campaign_id
     WHERE vt.ip_address = ? 
       AND vt.status IN ('pending', 'step1', 'step2', 'step3')
       AND vt.expires_at > NOW()
     ORDER BY vt.created_at DESC LIMIT 1`,
    [ip]
  );

  if (tasks.length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy session. Vui lòng bắt đầu từ trang vượt link.' });
  }

  const task = tasks[0];

  // Update task status to step3 (reached target website) if not already
  if (task.status !== 'step3') {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step3', step3_at = ? WHERE id = ?", [now, task.id]);
  }

  console.log(`[Widget] Code requested — IP: ${ip}, task: #${task.id}, code: ${task.code_given}`);

  res.json({ success: true, code: task.code_given, message: 'Mã của bạn! Hãy copy và nhập vào trang vượt link.' });
});

/* ═══════════════════════════════════════════════════════════
   PROTECTED endpoints
═══════════════════════════════════════════════════════════ */
router.use(authMiddleware);

// ── GET /api/widgets ──
router.get('/', async (req, res) => {
  const pool = getPool();
  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
  res.json({
    widgets: widgets.map(w => {
      let config = {};
      try { config = JSON.parse(w.config || '{}'); } catch {}
      return { ...w, config };
    }),
  });
});

// ── POST /api/widgets ──
router.post('/', async (req, res) => {
  const pool = getPool();
  const { name, config } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên widget là bắt buộc' });

  const token = 'T68-' + crypto.randomBytes(6).toString('hex').toUpperCase();
  const cleanConfig = stripDeprecated(typeof config === 'string' ? JSON.parse(config) : (config || {}));
  const configStr = JSON.stringify(cleanConfig);

  const [result] = await pool.execute(`INSERT INTO widgets (user_id, token, name, config) VALUES (?, ?, ?, ?)`, [req.userId, token, name, configStr]);
  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE id = ?', [result.insertId]);
  res.status(201).json({
    message: 'Tạo widget thành công', token: widgets[0].token,
    widget: { ...widgets[0], config: JSON.parse(widgets[0].config || '{}') },
  });
});

// ── PUT /api/widgets/:id ──
router.put('/:id', async (req, res) => {
  const pool = getPool();
  const [existing] = await pool.execute('SELECT * FROM widgets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (existing.length === 0) return res.status(404).json({ error: 'Widget không tồn tại' });

  const { name, config, is_active } = req.body;
  let configStr = null;
  if (config) {
    const cleanConfig = stripDeprecated(typeof config === 'string' ? JSON.parse(config) : config);
    configStr = JSON.stringify(cleanConfig);
  }
  await pool.execute(
    `UPDATE widgets SET name=COALESCE(?,name), config=COALESCE(?,config), is_active=COALESCE(?,is_active) WHERE id = ? AND user_id = ?`,
    [name, configStr, is_active, req.params.id, req.userId]
  );

  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE id = ?', [req.params.id]);
  res.json({ message: 'Cập nhật thành công', widget: { ...widgets[0], config: JSON.parse(widgets[0].config || '{}') } });
});

// ── DELETE /api/widgets/:id ──
router.delete('/:id', async (req, res) => {
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM widgets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Widget không tồn tại' });
  res.json({ message: 'Đã xoá widget' });
});

module.exports = router;
