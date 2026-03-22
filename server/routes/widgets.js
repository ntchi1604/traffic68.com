const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { analyzeBehavior } = require('../lib/behavior');

const router = express.Router();

const HMAC_SECRET = process.env.CHALLENGE_KEY || crypto.randomBytes(32).toString('hex');
const BOT_UA = /curl|wget|python|httpie|postman|insomnia|axios|node-fetch|got\/|bot|crawler|spider|headlesschrome|phantomjs|selenium/i;

async function logSecurityEvent(reason, ip, ua, visitorId, extra) {
  try {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO security_logs (source, reason, ip_address, user_agent, visitor_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      ['widget', reason, ip || null, (ua || '').substring(0, 500), visitorId || null, JSON.stringify(extra || {}).substring(0, 10000)]
    );
  } catch (e) { }
}

const widgetRateLimit = {};
setInterval(() => { Object.keys(widgetRateLimit).forEach(k => delete widgetRateLimit[k]); }, 60000);

function checkWidgetRateLimit(ip, action, maxPerMin) {
  const key = `${ip}:${action}`;
  widgetRateLimit[key] = (widgetRateLimit[key] || 0) + 1;
  return widgetRateLimit[key] <= maxPerMin;
}

const widgetChallenges = {};
setInterval(() => {
  const now = Date.now();
  Object.keys(widgetChallenges).forEach(k => {
    if (now - widgetChallenges[k].createdAt > 600000) delete widgetChallenges[k];
  });
}, 30000);

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
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 1800) return false;
  const expected = crypto.createHmac('sha256', HMAC_SECRET).update(`${ip}|${ua}|${ts}`).digest('hex').substring(0, 16);
  return hmac === expected;
}

function signWidgetChallenge(challengeId, ip) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(`${challengeId}|${ip}`).digest('hex').substring(0, 24);
}

const DEPRECATED_FIELDS = ['code', 'icon'];

const JS_DEFAULTS = {
  insertTarget: '', insertMode: 'after', insertId: 'API_SEO_TRAFFIC68',
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

router.get('/public/:token', async (req, res) => {
  const pool = getPool();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  if (BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });

  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE token = ? AND is_active = 1', [req.params.token]);
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại hoặc đã bị tắt' });

  let config = {};
  try { config = JSON.parse(widgets[0].config || '{}'); } catch { }

  const pageUrl = req.query.pageUrl || '';

  // Auto-save website_url from the page where embed script runs
  if (pageUrl && !widgets[0].website_url) {
    try {
      const origin = new URL(decodeURIComponent(pageUrl)).origin;
      pool.execute('UPDATE widgets SET website_url = ? WHERE id = ? AND (website_url IS NULL OR website_url = "")', [origin, widgets[0].id]).catch(() => {});
    } catch { }
  }
  let campaignInfo = null;

  if (pageUrl) {
    try {
      const normalize = (u) => decodeURIComponent(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();
      const normalPage = normalize(pageUrl);

      const [campaigns] = await pool.execute(
        `SELECT id, url, url2, time_on_site, keyword FROM campaigns 
         WHERE user_id = ? AND status = 'running' AND views_done < total_views 
         ORDER BY created_at DESC`,
        [widgets[0].user_id]
      );

      for (const camp of campaigns) {
        const normalUrl1 = normalize(camp.url || '');
        const normalUrl2 = normalize(camp.url2 || '');
        const matchUrl1 = normalUrl1 && (normalPage === normalUrl1 || normalPage.startsWith(normalUrl1 + '/') || normalUrl1.startsWith(normalPage));
        const matchUrl2 = normalUrl2 && (normalPage === normalUrl2 || normalPage.startsWith(normalUrl2 + '/') || normalUrl2.startsWith(normalPage));

        if (matchUrl1 || matchUrl2) {
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

  const resp = { campaignFound: !!campaignInfo };
  if (Object.keys(overrides).length > 0) resp.config = overrides;
  resp._t = generateSessionToken(ip, ua);
  res.json(resp);
});

router.post('/public/:token/check-session', async (req, res) => {
  const pool = getPool();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  if (!checkWidgetRateLimit(ip, 'check-session', 10)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

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

router.get('/public/:token/challenge', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (!ua || BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  if (!checkWidgetRateLimit(ip, 'challenge', 10)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const sToken = req.headers['x-session-token'] || '';
  if (!verifySessionToken(sToken, ip, ua)) {
    return res.status(403).json({ error: 'Invalid session' });
  }

  const challengeId = crypto.randomBytes(16).toString('hex');
  const domText = crypto.randomBytes(6).toString('hex');
  const domFontSize = 14 + Math.floor(Math.random() * 10);
  const glColor = [Math.random(), Math.random(), Math.random()].map(v => Math.round(v * 100) / 100);
  widgetChallenges[challengeId] = { createdAt: Date.now(), used: false, ip, domText, domFontSize, glColor };

  const _ck = signWidgetChallenge(challengeId, ip);

  res.json({ c: challengeId, _ck, dt: domText, df: domFontSize, gc: glColor });
});

router.post('/public/:token/get-code', async (req, res) => {
  const ERR = { error: 'Yêu cầu không hợp lệ' };
  const pool = getPool();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  if (!checkWidgetRateLimit(ip, 'get-code', 5)) {
    console.log(`[Widget] Rate limited — IP: ${ip}`);
    return res.status(429).json({ error: 'Quá nhiều yêu cầu' });
  }

  const sToken = req.headers['x-session-token'] || '';
  if (!verifySessionToken(sToken, ip, ua)) {
    return res.status(403).json({ error: 'Invalid session' });
  }

  if (BOT_UA.test(ua)) {
    logSecurityEvent('bot_ua', ip, ua, null, {});
    return res.status(403).json({ error: 'Blocked' });
  }

  const { challengeId, _ck, domWidth, glRenderer, glPixel, visitorId, botDetection, behavioral } = req.body || {};

  let botDetected = false;
  let mouseScore = 0;
  let mouseReasons = '';
  let detectionLog = [];

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

  if (!_ck || _ck !== signWidgetChallenge(challengeId, ip)) {
    console.log(`[Widget] Invalid challenge signature — IP: ${ip}`);
    return res.status(403).json(ERR);
  }

  if (!domWidth || typeof domWidth !== 'number' || domWidth <= 0) {
    return res.status(403).json(ERR);
  }
  const expectedWidth = ch.domText.length * ch.domFontSize * 0.6;
  if (domWidth < expectedWidth * 0.3 || domWidth > expectedWidth * 2.0) {
    return res.status(403).json(ERR);
  }

  if (!glRenderer || typeof glRenderer !== 'string' || glRenderer.length < 3) {
    return res.status(403).json(ERR);
  }
  if (glPixel && Array.isArray(glPixel) && glPixel.length >= 3) {
    const tol = 15;
    const [er, eg, eb] = ch.glColor.map(v => Math.round(v * 255));
    if (Math.abs(glPixel[0] - er) > tol || Math.abs(glPixel[1] - eg) > tol || Math.abs(glPixel[2] - eb) > tol) {
      return res.status(403).json(ERR);
    }
  }

  ch.used = true;

  const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  if (botDetection && botDetection.bot === true) {
    console.log(`[Widget] 🚫 CreepJS BOT: IP=${ip}`);
    logSecurityEvent('creep_detected', ip, ua, visitorId, botDetection);
    botDetected = true;
    detectionLog.push('creep_detected');
    return res.status(403).json(ERR);
  }
  if (botDetection && botDetection.totalLied > 0) {
    const mobileSafe = ['clientRects', 'maths', 'css', 'domRect'];
    const lied = botDetection.liedSections || [];
    const realLies = isMobileDevice ? lied.filter(s => !mobileSafe.some(safe => s === safe || s.startsWith(safe + ':'))) : lied;
    if (realLies.length > 0 || (!isMobileDevice && botDetection.totalLied > 0)) {
      console.log(`[Widget] 🚫 CreepJS BLOCKED: IP=${ip}, totalLied=${botDetection.totalLied}, realLies=${realLies.join(',')}, mobile=${isMobileDevice}`);
      logSecurityEvent('creep_detected', ip, ua, visitorId, botDetection);
      botDetected = true;
      detectionLog.push('creep_detected');
      return res.status(403).json(ERR);
    } else {
      console.log(`[Widget] ⚠️ CreepJS mobile tolerance: IP=${ip}, ignored: ${lied.join(',')}`);
    }
  }

  const probes = behavioral?.probes || {};
  if (probes.webdriver === true || probes.cdc === true || probes.selenium === true) {
    console.log(`[Widget] 🤖 Automation probe hit: IP=${ip}`);
    logSecurityEvent('automation_probes', ip, ua, visitorId, probes);
    return res.status(403).json(ERR);
  }
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const probeWarnings = [];
  // Mobile browsers naturally have 0 plugins — skip this check on mobile
  if (probes.pluginCount === 0 && !isMobileUA) probeWarnings.push('zero_plugins');
  if (probes.rtt === 0) probeWarnings.push('zero_rtt');
  if (probes.langCount === 0) probeWarnings.push('zero_languages');
  if (probeWarnings.length > 0) {
    logSecurityEvent('probe_warning', ip, ua, visitorId, { ...probes, probeWarnings });
  }

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

  if (behavioral) {
    const result = analyzeBehavior(behavioral, ua);
    mouseScore = result.score;
    mouseReasons = result.reasons.join(',');

    const fullDetail = {
      behaviorScore: result.score,
      assessments: result.assessments,
      botDetection: botDetection || null,
      probes: behavioral.probes || {},
      screen: behavioral.screen || null,
      countdownTime: behavioral.countdownTime || 0,
    };

    if (result.score >= 70) {
      console.log(`[Widget] 🤖 Behavior bot: score=${result.score}, reasons=${mouseReasons}, IP=${ip}`);
      return res.status(403).json(ERR);
    }

    // Store assessment in task — will be logged to security when task completes
    try {
      const [activeTasks] = await pool.execute(
        `SELECT id FROM vuot_link_tasks WHERE ip_address = ? AND user_agent = ? AND status IN ('pending','step1','step2','step3') AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
        [ip, ua]
      );
      if (activeTasks.length > 0) {
        await pool.execute(
          `UPDATE vuot_link_tasks SET security_detail = ? WHERE id = ?`,
          [JSON.stringify(fullDetail).substring(0, 10000), activeTasks[0].id]
        );
      }
    } catch (e) { }
  }

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

  const referer = req.headers['referer'] || req.headers['origin'] || '';
  if (referer && task.campaign_url) {
    try {
      const refDomain = new URL(referer).hostname.replace(/^www\./, '').toLowerCase();
      const campDomain = new URL(task.campaign_url).hostname.replace(/^www\./, '').toLowerCase();
      if (refDomain !== campDomain) {
        console.log(`[Widget] Referer mismatch — IP: ${ip}, referer: ${refDomain}, campaign: ${campDomain}`);
      }
    } catch (e) { }
  }

  if (task.status !== 'step3') {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step3' WHERE id = ?", [task.id]);
  }

  console.log(`[Widget] ✅ Code given — IP: ${ip}, task: #${task.id}, code: ${task.code_given}, elapsed: ${elapsedSeconds}s, behaviorScore=${mouseScore}`);

  res.json({ success: true, code: task.code_given });
});

router.use(authMiddleware);

const MAX_WIDGETS_PER_USER = 10;

/* GET / — list all widgets for user */
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

/* POST / — create a new widget */
router.post('/', async (req, res) => {
  const pool = getPool();
  const { name, config, website_url } = req.body;

  // Check limit
  const [existing] = await pool.execute('SELECT COUNT(*) as cnt FROM widgets WHERE user_id = ?', [req.userId]);
  if (existing[0].cnt >= MAX_WIDGETS_PER_USER) {
    return res.status(400).json({ error: `Tối đa ${MAX_WIDGETS_PER_USER} widget. Xoá widget cũ trước khi tạo mới.` });
  }

  const cleanConfig = stripDefaults(typeof config === 'string' ? JSON.parse(config) : (config || {}));
  const configStr = JSON.stringify(cleanConfig);
  const token = 'T68-' + crypto.randomBytes(6).toString('hex').toUpperCase();

  const [result] = await pool.execute(
    `INSERT INTO widgets (user_id, token, name, website_url, config) VALUES (?, ?, ?, ?, ?)`,
    [req.userId, token, name || 'Nút mặc định', website_url.trim(), configStr]
  );

  const [widgets] = await pool.execute('SELECT * FROM widgets WHERE id = ?', [result.insertId]);
  const w = widgets[0];
  let parsed = {};
  try { parsed = { ...JS_DEFAULTS, ...JSON.parse(w.config || '{}') }; } catch { }
  res.status(201).json({
    message: 'Tạo widget thành công',
    widget: { ...w, config: parsed },
  });
});

/* GET /my — list ALL widgets for this user (returns array) */
router.get('/my', async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM widgets WHERE user_id = ? ORDER BY created_at ASC', [req.userId]);

  const widgets = rows.map(w => {
    let config = {};
    try { config = { ...JS_DEFAULTS, ...JSON.parse(w.config || '{}') }; } catch { }
    return { id: w.id, token: w.token, name: w.name, website_url: w.website_url || '', config, is_active: w.is_active, created_at: w.created_at };
  });

  res.json({ widgets });
});

/* PUT /:id — update a specific widget by ID */
router.put('/:id', async (req, res) => {
  const pool = getPool();
  const [existing] = await pool.execute('SELECT * FROM widgets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (existing.length === 0) return res.status(404).json({ error: 'Widget không tồn tại' });

  const { name, config, is_active, website_url } = req.body;
  let configStr = null;
  if (config) {
    const cleanConfig = stripDefaults(typeof config === 'string' ? JSON.parse(config) : config);
    configStr = JSON.stringify(cleanConfig);
  }
  await pool.execute(
    `UPDATE widgets SET name=COALESCE(?,name), config=COALESCE(?,config), is_active=COALESCE(?,is_active), website_url=COALESCE(?,website_url), updated_at=NOW() WHERE id = ? AND user_id = ?`,
    [name || null, configStr, is_active ?? null, website_url !== undefined ? website_url : null, req.params.id, req.userId]
  );

  const [updated] = await pool.execute('SELECT * FROM widgets WHERE id = ?', [req.params.id]);
  let mergedConfig = {};
  try { mergedConfig = { ...JS_DEFAULTS, ...JSON.parse(updated[0].config || '{}') }; } catch { }
  res.json({
    message: 'Cập nhật thành công',
    widget: { ...updated[0], config: mergedConfig },
  });
});

/* DELETE /:id — remove a widget */
router.delete('/:id', async (req, res) => {
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM widgets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Widget không tồn tại' });
  res.json({ message: 'Đã xoá widget' });
});

module.exports = router;
