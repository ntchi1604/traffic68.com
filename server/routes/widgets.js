const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Anti-bypass: HMAC session token
const HMAC_SECRET = process.env.CHALLENGE_KEY || crypto.randomBytes(32).toString('hex');
const BOT_UA = /curl|wget|python|httpie|postman|insomnia|axios|node-fetch|got\/|bot|crawler|spider|headlesschrome|phantomjs|selenium/i;

/* ═══════════════════════════════════════════════════════════
   ANTI-CHEAT: Rate limiter (same approach as vuotlink.js)
═══════════════════════════════════════════════════════════ */
const widgetRateLimit = {};
setInterval(() => { Object.keys(widgetRateLimit).forEach(k => delete widgetRateLimit[k]); }, 60000);

function checkWidgetRateLimit(ip, action, maxPerMin) {
  const key = `${ip}:${action}`;
  widgetRateLimit[key] = (widgetRateLimit[key] || 0) + 1;
  return widgetRateLimit[key] <= maxPerMin;
}

/* ═══════════════════════════════════════════════════════════
   ANTI-CHEAT: Challenge store (anti-replay, same as vuotlink.js)
═══════════════════════════════════════════════════════════ */
const widgetChallenges = {};
setInterval(() => {
  const now = Date.now();
  Object.keys(widgetChallenges).forEach(k => {
    if (now - widgetChallenges[k].createdAt > 600000) delete widgetChallenges[k];
  });
}, 30000);

/* ═══════════════════════════════════════════════════════════
   MOUSE TRAJECTORY ANALYSIS (same as vuotlink.js)
   Analyzes raw mouse data to detect bot patterns
═══════════════════════════════════════════════════════════ */
function analyzeMouseTrail(trail) {
  if (!trail || !Array.isArray(trail) || trail.length < 5) return { score: 0, reasons: [] };
  
  let score = 0;
  const reasons = [];

  // 1. Check for perfectly linear movement
  let linearCount = 0;
  for (let i = 2; i < trail.length; i++) {
    const dx1 = trail[i].x - trail[i-1].x;
    const dy1 = trail[i].y - trail[i-1].y;
    const dx0 = trail[i-1].x - trail[i-2].x;
    const dy0 = trail[i-1].y - trail[i-2].y;
    if (Math.abs(dx1 * dy0 - dy1 * dx0) < 2) linearCount++;
  }
  if (linearCount / (trail.length - 2) > 0.8) {
    score += 30;
    reasons.push('linear_mouse');
  }

  // 2. Check for constant velocity
  let constantV = 0;
  for (let i = 2; i < trail.length; i++) {
    const s1 = Math.sqrt((trail[i].x-trail[i-1].x)**2 + (trail[i].y-trail[i-1].y)**2);
    const s0 = Math.sqrt((trail[i-1].x-trail[i-2].x)**2 + (trail[i-1].y-trail[i-2].y)**2);
    if (s0 > 0 && Math.abs(s1 - s0) < 1) constantV++;
  }
  if (constantV / (trail.length - 2) > 0.7) {
    score += 25;
    reasons.push('constant_velocity');
  }

  // 3. Fake timestamps (all same or only 1-2 unique)
  const uniqueTimes = new Set(trail.map(p => p.t)).size;
  if (uniqueTimes <= 2 && trail.length > 5) {
    score += 35;
    reasons.push('fake_timestamps');
  }

  // 4. Out of bounds coordinates
  const oob = trail.filter(p => p.x < 0 || p.y < 0 || p.x > 4000 || p.y > 3000).length;
  if (oob > trail.length * 0.3) {
    score += 20;
    reasons.push('out_of_bounds');
  }

  return { score, reasons };
}

/* ═══════════════════════════════════════════════════════════ */

function generateSessionToken(ip, ua) {
  const ts = Math.floor(Date.now() / 1000);
  const data = `${ip}|${ua}|${ts}`;
  const hmac = crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex').substring(0, 16);
  return `${ts}.${hmac}`;
}

function verifySessionToken(token, ip, ua) {
  if (!token || !token.includes('.')) return false;
  const [tsStr, hmac] = token.split('.');
  const ts = parseInt(tsStr);
  if (isNaN(ts)) return false;
  // Token valid for 30 minutes
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 1800) return false;
  const expected = crypto.createHmac('sha256', HMAC_SECRET).update(`${ip}|${ua}|${ts}`).digest('hex').substring(0, 16);
  return hmac === expected;
}

// HMAC token for binding challenge to IP (same as vuotlink signTask)
function signWidgetChallenge(challengeId, ip) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(`${challengeId}|${ip}`).digest('hex').substring(0, 24);
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
    if (DEPRECATED_FIELDS.includes(k)) continue;
    if (JS_DEFAULTS[k] !== undefined && JSON.stringify(JS_DEFAULTS[k]) === JSON.stringify(v)) continue;
    out[k] = v;
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC endpoints — called by api_seo_traffic68.js
═══════════════════════════════════════════════════════════ */

// ── GET /api/widgets/public/:token ──
// Returns config + session token (for anti-bypass)
router.get('/public/:token', async (req, res) => {
  const pool = getPool();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  // Block bot UAs
  if (BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });

  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại hoặc đã bị tắt' });

  let config = {};
  try { config = JSON.parse(widgets[0].config || '{}'); } catch { }

  // Check if the page URL matches a running campaign
  const pageUrl = req.query.pageUrl || '';
  let campaignInfo = null;

  if (pageUrl) {
    try {
      const normalize = (u) => decodeURIComponent(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();
      const normalPage = normalize(pageUrl);

      const [campaigns] = await pool.execute(
        `SELECT id, url, time_on_site, keyword FROM campaigns 
         WHERE user_id = ? AND status = 'running' AND views_done < total_views 
         ORDER BY created_at DESC`,
        [widgets[0].user_id]
      );

      for (const camp of campaigns) {
        const normalCamp = normalize(camp.url || '');
        if (normalPage === normalCamp || normalPage.startsWith(normalCamp + '/') || normalCamp.startsWith(normalPage)) {
          let waitTime = 30;
          const tos = camp.time_on_site || '';
          if (tos.includes('-')) {
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

  const overrides = stripDefaults(config);
  if (campaignInfo) {
    overrides.waitTime = campaignInfo.waitTime;
  }

  // Build response with session token for anti-bypass
  const resp = { campaignFound: !!campaignInfo };
  if (Object.keys(overrides).length > 0) resp.config = overrides;
  resp._t = generateSessionToken(ip, ua); // session token
  res.json(resp);
});

// ── POST /api/widgets/public/:token/check-session ──
router.post('/public/:token/check-session', async (req, res) => {
  const pool = getPool();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  // Rate limit: 10 requests per minute per IP
  if (!checkWidgetRateLimit(ip, 'check-session', 10)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // Anti-bypass: verify session token + referer
  const sToken = req.headers['x-session-token'] || '';
  if (!verifySessionToken(sToken, ip, ua)) {
    return res.status(403).json({ error: 'Invalid session' });
  }

  if (BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });

  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại' });

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
    return res.status(404).json({ hasSession: false });
  }

  res.json({ hasSession: true });
});

/* ═══════════════════════════════════════════════════════════
   STEP 1: GET /challenge (anti-replay token — same as vuotlink.js)
═══════════════════════════════════════════════════════════ */
router.get('/public/:token/challenge', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (!ua || BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  // Rate limit
  if (!checkWidgetRateLimit(ip, 'challenge', 10)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // Verify session token
  const sToken = req.headers['x-session-token'] || '';
  if (!verifySessionToken(sToken, ip, ua)) {
    return res.status(403).json({ error: 'Invalid session' });
  }

  const challengeId = crypto.randomBytes(16).toString('hex');
  widgetChallenges[challengeId] = { createdAt: Date.now(), used: false, ip };

  // Sign the challenge to bind it to IP
  const _ck = signWidgetChallenge(challengeId, ip);

  res.json({ c: challengeId, _ck });
});

/* ═══════════════════════════════════════════════════════════
   STEP 2: POST /get-code — with behavioral analysis (same as vuotlink.js)
   - Requires challenge token (anti-replay)
   - Requires behavioral data (mouse, clicks, scrolls, screen)
   - Server analyzes mouse trajectory to detect bots
   - Verifies time elapsed
═══════════════════════════════════════════════════════════ */
router.post('/public/:token/get-code', async (req, res) => {
  const ERR = { error: 'Yêu cầu không hợp lệ' };
  const pool = getPool();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  // Rate limit: 5 requests per minute per IP
  if (!checkWidgetRateLimit(ip, 'get-code', 5)) {
    console.log(`[Widget] Rate limited — IP: ${ip}`);
    return res.status(429).json({ error: 'Quá nhiều yêu cầu' });
  }

  // Anti-bypass: verify session token
  const sToken = req.headers['x-session-token'] || '';
  if (!verifySessionToken(sToken, ip, ua)) {
    return res.status(403).json({ error: 'Invalid session' });
  }

  if (BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });

  const { challengeId, _ck, visitorId, botDetection, behavioral } = req.body || {};

  // ── Collect detection results ──
  let botDetected = false;
  let mouseScore = 0;
  let mouseReasons = '';
  let detectionLog = [];

  // ── 1. Challenge validation (anti-replay — same as vuotlink.js) ──
  if (!challengeId) {
    console.log(`[Widget] Missing challengeId — IP: ${ip}`);
    return res.status(403).json(ERR);
  }
  const ch = widgetChallenges[challengeId];
  if (!ch) {
    console.log(`[Widget] Invalid challengeId — IP: ${ip}`);
    return res.status(403).json(ERR);
  }
  if (ch.used) { delete widgetChallenges[challengeId]; return res.status(403).json(ERR); }
  if (Date.now() - ch.createdAt > 600000) { delete widgetChallenges[challengeId]; return res.status(403).json(ERR); }
  if (ch.ip && ch.ip !== ip) return res.status(403).json(ERR);

  // Verify challenge signature (binds to IP — same as vuotlink.js signTask)
  if (!_ck || _ck !== signWidgetChallenge(challengeId, ip)) {
    console.log(`[Widget] Invalid challenge signature — IP: ${ip}`);
    return res.status(403).json(ERR);
  }
  ch.used = true;

  // ── 2. BotD check (same as vuotlink.js) ──
  if (botDetection && botDetection.bot === true) {
    botDetected = true;
    detectionLog.push('botd_detected');
    console.log(`[Widget] 🤖 BotD detected: IP=${ip}`);
    return res.status(403).json(ERR);
  }

  // ── 3. VisitorId rate limit (5 code fetches / 24h per device — same as vuotlink.js) ──
  if (visitorId && visitorId !== 'unknown') {
    const [vCount] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE visitor_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) AND status = 'completed'`,
      [visitorId]
    );
    if (vCount[0].cnt >= 5) {
      detectionLog.push('device_limit');
      console.log(`[Widget] Device limit: visitorId=${visitorId.substring(0,8)}..., count=${vCount[0].cnt}`);
      return res.status(429).json({ error: 'Thiết bị đã đạt giới hạn 5 lượt/ngày. Thử lại sau.' });
    }
  }

  // ── 4. Behavioral analysis (server-side mouse trajectory — same as vuotlink.js) ──
  if (behavioral && behavioral.mouseTrail) {
    const mouseResult = analyzeMouseTrail(behavioral.mouseTrail);
    mouseScore = mouseResult.score;
    mouseReasons = mouseResult.reasons.join(',');
    if (mouseResult.score >= 50) {
      detectionLog.push('mouse_bot');
      console.log(`[Widget] 🤖 Mouse bot: score=${mouseResult.score}, reasons=${mouseReasons}, IP=${ip}`);
      return res.status(403).json(ERR);
    }
    if (mouseResult.score > 0) {
      console.log(`[Widget] ⚠️ Mouse warning: score=${mouseResult.score}, reasons=${mouseReasons}, IP=${ip}`);
    }
  }

  // ── 5. Zero screen = headless (same as vuotlink.js) ──
  if (behavioral && (!behavioral.screen?.w || !behavioral.screen?.h)) {
    detectionLog.push('zero_screen');
    console.log(`[Widget] 🤖 Zero screen: IP=${ip}`);
    return res.status(403).json(ERR);
  }

  // ── 6. Minimum behavioral thresholds ──
  const mousePoints = behavioral?.mousePoints || 0;
  const clicks = behavioral?.clicks || 0;
  const scrolls = behavioral?.scrolls || 0;
  const countdownTime = behavioral?.countdownTime || 0;

  // Must have SOME mouse movement during countdown (human always moves mouse)
  if (mousePoints < 3 && countdownTime > 10) {
    detectionLog.push('no_mouse');
    console.log(`[Widget] ⚠️ No mouse movement during ${countdownTime}s countdown: IP=${ip}`);
    // Don't block — just flag (some mobile users won't have mouse)
  }

  // ── 7. Validate widget + task ──
  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại' });

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
    return res.status(404).json({ error: 'Không tìm thấy session.' });
  }

  const task = tasks[0];

  // ── 6. Time validation (same as before) ──
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
    return res.status(403).json({ error: 'Phát hiện gian lận!', remaining });
  }

  // ── 7. Referer check (log only — some browsers strip referer) ──
  const referer = req.headers['referer'] || req.headers['origin'] || '';
  if (referer && task.campaign_url) {
    try {
      const refDomain = new URL(referer).hostname.replace(/^www\./, '').toLowerCase();
      const campDomain = new URL(task.campaign_url).hostname.replace(/^www\./, '').toLowerCase();
      if (refDomain !== campDomain) {
        console.log(`[Widget] Referer mismatch — IP: ${ip}, referer: ${refDomain}, campaign: ${campDomain}`);
      }
    } catch (e) { /* ignore URL parse errors */ }
  }

  // ── Update task status ──
  if (task.status !== 'step3') {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step3', step3_at = ? WHERE id = ?", [now, task.id]);
  }

  console.log(`[Widget] ✅ Code given — IP: ${ip}, task: #${task.id}, code: ${task.code_given}, elapsed: ${elapsedSeconds}s, mouse=${mousePoints}, clicks=${clicks}, mouseScore=${mouseScore}`);

  res.json({ success: true, code: task.code_given });
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
