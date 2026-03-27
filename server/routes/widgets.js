const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { analyzeDevice } = require('../lib/behavior');

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
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 600) return false; // 10 minutes
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
  borderRadius: 20, fontSize: 13, shadow: true,
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

  const [widgets] = await pool.execute(
    `SELECT w.* FROM widgets w JOIN users u ON u.id = w.user_id WHERE w.token = ? AND w.is_active = 1 AND u.status = 'active'`,
    [req.params.token]
  );
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại hoặc đã bị tắt' });

  let config = {};
  try { config = JSON.parse(widgets[0].config || '{}'); } catch { }

  const pageUrl = req.query.pageUrl || '';

  // Auto-save website_url from the page where embed script runs
  if (pageUrl && !widgets[0].website_url) {
    try {
      const origin = new URL(decodeURIComponent(pageUrl)).origin;
      pool.execute('UPDATE widgets SET website_url = ? WHERE id = ? AND (website_url IS NULL OR website_url = "")', [origin, widgets[0].id]).catch(() => { });
    } catch { }
  }
  let campaignInfo = null;

  if (pageUrl) {
    try {
      const normalize = (u) => decodeURIComponent(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();
      const normalPage = normalize(pageUrl);

      const [campaigns] = await pool.execute(
        `SELECT id, url, url2, time_on_site, keyword, version, target_page FROM campaigns 
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
          campaignInfo = { campaignId: camp.id, waitTime, version: camp.version || 0, targetPage: camp.target_page || '' };
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

  // Check captcha setting
  let captchaEnabled = true;
  try {
    const [settings] = await pool.execute("SELECT setting_value FROM site_settings WHERE setting_key = 'captcha_enabled'");
    if (settings.length > 0 && settings[0].setting_value === 'false') captchaEnabled = false;
  } catch (e) { }

  if (captchaEnabled) {
    try {
      const [ownerRows] = await pool.execute('SELECT role FROM users WHERE id = ?', [widgets[0].user_id]);
      if (ownerRows.length > 0 && ownerRows[0].role === 'admin') {
        captchaEnabled = false;
      }
    } catch (e) { }
  }

  const resp = { campaignFound: !!campaignInfo, captchaEnabled };
  if (Object.keys(overrides).length > 0) resp.config = overrides;
  if (campaignInfo && campaignInfo.version === 1) {
    resp.version = 1;
    resp.targetPage = campaignInfo.targetPage || '';
  }

  // V1: Even if no campaign matched this URL, check if there's an active V1 task
  // (user navigated to internal link during V1 flow)
  if (!resp.version) {
    try {
      const [v1Tasks] = await pool.execute(
        `SELECT c.version FROM vuot_link_tasks vt
         JOIN campaigns c ON c.id = vt.campaign_id
         WHERE (vt.ip_address = ? OR (vt.visitor_id IS NOT NULL AND vt.visitor_id != '' AND vt.visitor_id IN (
           SELECT vt2.visitor_id FROM vuot_link_tasks vt2 WHERE vt2.ip_address = ? AND vt2.visitor_id IS NOT NULL AND vt2.visitor_id != '' ORDER BY vt2.created_at DESC LIMIT 1
         )))
           AND c.version = 1
           AND vt.status IN ('pending', 'step1', 'step2', 'step3')
           AND vt.expires_at > NOW()
         ORDER BY vt.created_at DESC LIMIT 1`,
        [ip, ip]
      );
      if (v1Tasks.length > 0) {
        resp.version = 1;
        resp.campaignFound = true;
      }
    } catch (e) { }
  }

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
  const tokenValid = verifySessionToken(sToken, ip, ua);
  if (!tokenValid && sToken) {
    console.log(`[Widget] check-session token invalid (continuing) — IP: ${ip}, UA: ${ua.substring(0, 80)}`);
  }

  if (BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });

  const [widgets] = await pool.execute(
    `SELECT w.* FROM widgets w JOIN users u ON u.id = w.user_id WHERE w.token = ? AND w.is_active = 1 AND u.status = 'active'`,
    [req.params.token]
  );
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại' });

  const { visitorId, pageReferrer } = req.body || {};
  // Sanitize visitorId — 'unknown' is the default/fallback, treat as empty
  const cleanVisitorId = (visitorId && visitorId !== 'unknown') ? visitorId : '';
  const [tasks] = await pool.execute(
    `SELECT vt.id, vt.status as task_status, c.traffic_type FROM vuot_link_tasks vt
     JOIN campaigns c ON c.id = vt.campaign_id
     WHERE (vt.ip_address = ? OR (vt.visitor_id = ? AND vt.visitor_id IS NOT NULL AND vt.visitor_id != '' AND vt.visitor_id != 'unknown'))
       AND vt.status IN ('pending', 'step1', 'step2', 'step3')
       AND vt.expires_at > NOW()
     ORDER BY vt.created_at DESC LIMIT 1`,
    [ip, cleanVisitorId]
  );

  if (tasks.length === 0) {
    console.log(`[Widget] check-session NO TASK — IP: ${ip}, visitorId: ${(cleanVisitorId).substring(0, 20)}, referrer: ${(pageReferrer || '').substring(0, 60)}`);
    return res.status(404).json({ hasSession: false });
  }

  // ── Enforce Google referrer for search traffic campaigns (skip for V1 step2/step3) ──
  const task = tasks[0];
  if ((task.traffic_type || 'google_search') === 'google_search' && !['step2', 'step3'].includes(task.task_status)) {
    const GOOGLE_DOMAINS = /^https?:\/\/(www\.)?google\.(com|co\.[a-z]{2,3}|com\.[a-z]{2,3}|[a-z]{2,3})\//i;
    const clientRef = pageReferrer || '';
    if (!clientRef || !GOOGLE_DOMAINS.test(clientRef)) {
      console.log(`[Widget] check-session BLOCKED: Non-Google referrer — IP: ${ip}, task: #${task.id}, referrer: "${clientRef.substring(0, 120)}"`);
      return res.status(403).json({ error: 'Vui lòng truy cập trang từ kết quả tìm kiếm Google.', requireGoogle: true });
    }
  }

  // ── Reload = reset phiên làm việc (giữ task, tính lại thời gian) ──
  try {
    await pool.execute(
      `UPDATE vuot_link_tasks SET created_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 600 SECOND) WHERE id = ?`,
      [task.id]
    );
  } catch (e) { }

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
  widgetChallenges[challengeId] = { createdAt: Date.now(), used: false, ip };

  const _ck = signWidgetChallenge(challengeId, ip);

  res.json({ c: challengeId, _ck });
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

  const { challengeId, _ck, visitorId, deviceData, botDetection, hcaptchaToken, pageReferrer } = req.body || {};

  // ── Verify hCaptcha ──
  const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || '0x0000000000000000000000000000000000000000';
  if (hcaptchaToken && !['skip', 'error', 'render-error', 'disabled'].includes(hcaptchaToken)) {
    try {
      const hcRes = await fetch('https://api.hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `response=${encodeURIComponent(hcaptchaToken)}&secret=${encodeURIComponent(HCAPTCHA_SECRET)}`,
      });
      const hcData = await hcRes.json();
      if (!hcData.success) {
        console.log(`[Widget] hCaptcha failed — IP: ${ip}, errors: ${(hcData['error-codes'] || []).join(',')}`);
        return res.status(403).json({ error: 'Captcha verification failed' });
      }
    } catch (e) {
      console.error(`[Widget] hCaptcha verify error:`, e.message);
      // Allow on error (don't block if hCaptcha service is down)
    }
  }

  let botDetected = false;
  let detectionLog = [];

  if (!challengeId) return res.status(403).json(ERR);
  const ch = widgetChallenges[challengeId];
  if (!ch || ch.used) { delete widgetChallenges[challengeId]; return res.status(403).json(ERR); }
  if (Date.now() - ch.createdAt > 600000) { delete widgetChallenges[challengeId]; return res.status(403).json(ERR); }
  if (!_ck || _ck !== signWidgetChallenge(challengeId, ch.ip)) return res.status(403).json(ERR);

  const v1Phase = req.body?.v1Phase || 0;
  ch.used = true;

  // ── Bot detection: headless/webdriver + CreepJS bot flag ──
  if (deviceData) {
    const result = analyzeDevice(deviceData, ua);
    if (result.isFake) {
      botDetected = true;
      detectionLog.push('headless_or_webdriver');
    }
  }
  if (botDetection && botDetection.bot === true) {
    botDetected = true;
    detectionLog.push('creepjs_bot');
  }

  // ── Save security_detail (bot flags only) ──
  if (botDetected && detectionLog.length > 0) {
    try {
      const [activeTasks] = await pool.execute(
        `SELECT id FROM vuot_link_tasks WHERE (ip_address = ? OR (visitor_id = ? AND visitor_id IS NOT NULL AND visitor_id != '')) AND status IN ('pending','step1','step2','step3') AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
        [ip, visitorId || '']
      );
      if (activeTasks.length > 0) {
        await pool.execute(
          `UPDATE vuot_link_tasks SET security_detail = ? WHERE id = ?`,
          [JSON.stringify({ botDetected, detectionLog }).substring(0, 1000), activeTasks[0].id]
        );
      }
    } catch (e) { }
  }

  if (visitorId && visitorId !== 'unknown') {
    const [vCount] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE visitor_id = ? AND DATE(created_at) = CURDATE() AND status = 'completed'`,
      [visitorId]
    );
    if (vCount[0].cnt >= 5) {
      detectionLog.push('device_limit');
      console.log(`[Widget] Device limit: visitorId=${visitorId.substring(0, 8)}..., count=${vCount[0].cnt}`);
      return res.status(429).json({ error: 'Thiết bị đã đạt giới hạn 5 lượt/ngày. Thử lại sau.' });
    }
  }

  const [widgets] = await pool.execute(
    `SELECT w.* FROM widgets w JOIN users u ON u.id = w.user_id WHERE w.token = ? AND w.is_active = 1 AND u.status = 'active'`,
    [req.params.token]
  );
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại' });

  // Match by IP or visitorId
  const cleanVid = (visitorId && visitorId !== 'unknown') ? visitorId : '';
  const [tasks] = await pool.execute(
    `SELECT vt.*, c.url as campaign_url, c.time_on_site, c.version, c.target_page, c.traffic_type FROM vuot_link_tasks vt
     JOIN campaigns c ON c.id = vt.campaign_id
     WHERE (vt.ip_address = ? OR (vt.visitor_id = ? AND vt.visitor_id IS NOT NULL AND vt.visitor_id != '' AND vt.visitor_id != 'unknown'))
       AND vt.status IN ('pending', 'step1', 'step2', 'step3')
       AND vt.expires_at > NOW()
     ORDER BY vt.created_at DESC LIMIT 1`,
    [ip, cleanVid]
  );

  if (tasks.length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy session.' });
  }

  const task = tasks[0];
  const campVersion = task.version || 0;
  // v1Phase already declared above (line 328)

  // ── Enforce Google referrer for search traffic campaigns (skip for V1 phase 2) ──
  if ((task.traffic_type || 'google_search') === 'google_search' && v1Phase !== 2) {
    const GOOGLE_DOMAINS = /^https?:\/\/(www\.)?google\.(com|co\.[a-z]{2,3}|com\.[a-z]{2,3}|[a-z]{2,3})\//i;
    const clientRef = pageReferrer || '';
    if (!clientRef || !GOOGLE_DOMAINS.test(clientRef)) {
      console.log(`[Widget] BLOCKED: Non-Google referrer for search campaign — IP: ${ip}, task: #${task.id}, referrer: "${clientRef.substring(0, 120)}"`);
      logSecurityEvent('non_google_referrer', ip, ua, visitorId, { referrer: clientRef.substring(0, 500), taskId: task.id, campaignId: task.campaign_id });
      return res.status(403).json({ error: 'Vui lòng truy cập trang từ kết quả tìm kiếm Google.' });
    }
  }

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

  // ── V1: Multi-step flow ──
  if (campVersion === 1) {
    if (v1Phase !== 2) {
      // Phase 1 done → tell widget to show step 2 (visit internal link + wait)
      if (task.status !== 'step2') {
        await pool.execute("UPDATE vuot_link_tasks SET status = 'step2' WHERE id = ?", [task.id]);
      }
      const v1Wait = Math.floor(Math.random() * 16) + 20; // 20-35s
      console.log(`[Widget] V1 phase 1 done — IP: ${ip}, task: #${task.id}, next wait: ${v1Wait}s`);
      return res.json({
        v1_step2: true,
        targetPage: task.target_page || '',
        v1Wait,
      });
    }

    // Phase 2: Check extra wait time has passed (at least 20s after step2 was set)
    const v1ExtraRequired = requiredSeconds + 20; // minimum total elapsed
    if (elapsedSeconds < v1ExtraRequired) {
      const remaining = v1ExtraRequired - elapsedSeconds;
      console.log(`[Widget] V1 phase 2 TOO EARLY — IP: ${ip}, task: #${task.id}, elapsed: ${elapsedSeconds}s < required: ${v1ExtraRequired}s`);
      return res.status(403).json({ error: 'Vui lòng chờ thêm!', remaining });
    }
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
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step3' WHERE id = ?", [task.id]);
  }

  console.log(`[Widget] Code given — IP: ${ip}, task: #${task.id}, code: ${task.code_given}, elapsed: ${elapsedSeconds}s, botDetected=${botDetected}`);

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
