const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// AES-256-GCM encryption (same key as vuotlink.js)
let ENC_KEY = Buffer.from(process.env.CHALLENGE_KEY || 't68vLsecur3Chall3ng3Key2026xZqWx', 'utf8');
if (ENC_KEY.length < 32) ENC_KEY = Buffer.concat([ENC_KEY, Buffer.alloc(32 - ENC_KEY.length, 0)]);
else if (ENC_KEY.length > 32) ENC_KEY = ENC_KEY.slice(0, 32);

function encryptResponse(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');
  return iv.toString('base64') + '.' + encrypted + '.' + tag;
}

// Fields no longer used by embed script v3
const DEPRECATED_FIELDS = ['code', 'icon'];

// Defaults matching api_seo_traffic68.js — used to strip unchanged values from response
const JS_DEFAULTS = {
  insertTarget: '.footer', insertMode: 'after', insertId: 'API_SEO_TRAFFIC68',
  insertStyle: '', align: 'center', padX: 0, padY: 12,
  buttonText: 'Lấy Mã', buttonColor: '#f97316', textColor: '#ffffff',
  borderRadius: 50, fontSize: 15, shadow: true,
  iconUrl: '', iconBg: 'rgba(255,255,255,0.92)', iconSize: 22,
  theme: 'default', waitTime: 30,
  title: 'Mã của bạn! 🎉', message: 'Sao chép mã bên dưới để sử dụng.',
  countdownText: 'Vui lòng chờ {s} giây...', successText: 'Nhấn để sao chép!',
  brandName: 'Traffic68', brandUrl: 'https://traffic68.com', brandLogo: '',
  customCSS: '', overlapFix: 'auto',
};

function stripDefaults(config) {
  const out = {};
  for (const [k, v] of Object.entries(config)) {
    if (DEPRECATED_FIELDS.includes(k)) continue; // skip deprecated
    if (JS_DEFAULTS[k] !== undefined && JSON.stringify(JS_DEFAULTS[k]) === JSON.stringify(v)) continue; // skip default
    out[k] = v;
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC endpoints — called by api_seo_traffic68.js
   All responses encrypted with AES-256-GCM → { d: "iv.ciphertext.tag" }
═══════════════════════════════════════════════════════════ */

// ── GET /api/widgets/public/:token ──
router.get('/public/:token', async (req, res) => {
  const pool = getPool();
  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ d: encryptResponse({ error: 'Widget không tồn tại hoặc đã bị tắt' }) });

  let config = {};
  try { config = JSON.parse(widgets[0].config || '{}'); } catch { }

  // Check if the page URL matches a running campaign
  const pageUrl = req.query.pageUrl || '';
  let campaignInfo = null;

  if (pageUrl) {
    try {
      const decodedUrl = decodeURIComponent(pageUrl);
      const [campaigns] = await pool.execute(
        `SELECT c.id, c.url, c.duration, c.time_on_site FROM campaigns c
         WHERE c.status = 'running' AND c.user_id = ?
         ORDER BY c.created_at DESC`,
        [widgets[0].user_id]
      );
      for (const camp of campaigns) {
        try {
          const campHost = new URL(camp.url).hostname.replace(/^www\./, '');
          const pageHost = new URL(decodedUrl).hostname.replace(/^www\./, '');
          if (campHost === pageHost) {
            const tos = camp.time_on_site || String(camp.duration || 60);
            let waitSec = 60;
            if (tos.includes('-')) waitSec = parseInt(tos.split('-')[0]) || 60;
            else waitSec = parseInt(tos) || 60;
            campaignInfo = { campaignId: camp.id, waitTime: waitSec };
            break;
          }
        } catch {}
      }
    } catch {}
  }

  // Only send values that differ from JS defaults
  const overrides = stripDefaults(config);
  if (campaignInfo) {
    overrides.waitTime = campaignInfo.waitTime;
  }

  // Build minimal response
  const resp = { campaignFound: !!campaignInfo };
  if (Object.keys(overrides).length > 0) resp.config = overrides;
  res.json({ d: encryptResponse(resp) });
});

// ── POST /api/widgets/public/:token/check-session ──
// Called by embed script when button is clicked — checks if IP has a pending task
// Does NOT return the code — only confirms session exists
router.post('/public/:token/check-session', async (req, res) => {
  const pool = getPool();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  const ua = req.headers['user-agent'] || '';

  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ d: encryptResponse({ error: 'Widget không tồn tại' }) });

  const [tasks] = await pool.execute(
    `SELECT vt.id FROM vuot_link_tasks vt
     JOIN campaigns c ON c.id = vt.campaign_id
     WHERE vt.ip_address = ? 
       AND vt.user_agent = ?
       AND vt.status IN ('pending', 'step1', 'step2', 'step3')
       AND vt.expires_at > NOW()
     ORDER BY vt.created_at DESC LIMIT 1`,
    [ip, ua]
  );

  if (tasks.length === 0) {
    return res.status(404).json({ d: encryptResponse({ hasSession: false }) });
  }

  res.json({ d: encryptResponse({ hasSession: true }) });
});

// ── POST /api/widgets/public/:token/get-code ──
// Called by embed script on target website after countdown finishes
// Finds pending vuot_link_task matching visitor's IP → returns the code
// Server-side time check: elapsed since task creation must >= time_on_site
router.post('/public/:token/get-code', async (req, res) => {
  const pool = getPool();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  const ua = req.headers['user-agent'] || '';

  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ d: encryptResponse({ error: 'Widget không tồn tại' }) });

  // Find pending/active vuot_link_task matching this IP + UA
  const [tasks] = await pool.execute(
    `SELECT vt.*, c.url as campaign_url, c.time_on_site FROM vuot_link_tasks vt
     JOIN campaigns c ON c.id = vt.campaign_id
     WHERE vt.ip_address = ? 
       AND vt.user_agent = ?
       AND vt.status IN ('pending', 'step1', 'step2', 'step3')
       AND vt.expires_at > NOW()
     ORDER BY vt.created_at DESC LIMIT 1`,
    [ip, ua]
  );

  if (tasks.length === 0) {
    return res.status(404).json({ d: encryptResponse({ error: 'Không tìm thấy session.' }) });
  }

  const task = tasks[0];

  // Server-side time check: elapsed time must >= campaign time_on_site
  const tos = task.time_on_site || '60';
  let requiredSeconds = 30;
  if (tos.includes('-')) {
    requiredSeconds = parseInt(tos.split('-')[0]) || 30;
  } else {
    requiredSeconds = parseInt(tos) || 30;
  }

  const elapsedMs = Date.now() - new Date(task.created_at).getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  if (elapsedSeconds < requiredSeconds) {
    const remaining = requiredSeconds - elapsedSeconds;
    console.log(`[Widget] Code request TOO EARLY — IP: ${ip}, task: #${task.id}, elapsed: ${elapsedSeconds}s < required: ${requiredSeconds}s`);
    return res.status(403).json({ d: encryptResponse({ error: 'Phát hiện gian lận!', remaining }) });
  }

  // Update task status to step3 (reached target website) if not already
  if (task.status !== 'step3') {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step3', step3_at = ? WHERE id = ?", [now, task.id]);
  }

  console.log(`[Widget] Code given — IP: ${ip}, task: #${task.id}, code: ${task.code_given}, elapsed: ${elapsedSeconds}s`);

  res.json({ d: encryptResponse({ success: true, code: task.code_given }) });
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
      try { config = JSON.parse(w.config || '{}'); } catch { }
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
  const cleanConfig = stripDefaults(typeof config === 'string' ? JSON.parse(config) : (config || {}));
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
    const cleanConfig = stripDefaults(typeof config === 'string' ? JSON.parse(config) : config);
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
