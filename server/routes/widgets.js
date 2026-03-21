const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Anti-bypass: HMAC session token
const HMAC_SECRET = process.env.CHALLENGE_KEY || crypto.randomBytes(32).toString('hex');
const BOT_UA = /curl|wget|python|httpie|postman|insomnia|axios|node-fetch|got\/|bot|crawler|spider|headlesschrome|phantomjs|selenium/i;

// Log security events to DB for admin visibility
async function logSecurityEvent(reason, ip, ua, visitorId, extra) {
  try {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO security_logs (source, reason, ip_address, user_agent, visitor_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      ['widget', reason, ip || null, (ua || '').substring(0, 500), visitorId || null, JSON.stringify(extra || {}).substring(0, 2000)]
    );
  } catch (e) { /* ignore DB errors to not break main flow */ }
}

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
   BEHAVIORAL ANALYSIS v2 — 5 categories
   Analyzes comprehensive behavioral data to detect bots
═══════════════════════════════════════════════════════════ */
function _cv(arr) {
  // Coefficient of Variation — lower = more uniform (bot-like)
  if (!arr || arr.length < 3) return 999;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  if (avg === 0) return 0;
  const variance = arr.reduce((a, b) => a + (b - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance) / avg;
}

function analyzeBehavior(b) {
  if (!b) return { score: 0, reasons: [], assessments: [] };
  let score = 0;
  const reasons = [];
  const assessments = []; // detailed evaluation per check
  const trail = b.mouseTrail || [];
  const n = trail.length;

  // ═══════════════════════════════════════
  // 1. MOUSE DYNAMICS
  // ═══════════════════════════════════════

  assessments.push({ cat: 'mouse', check: 'mousemove_count', value: n, note: n >= 10 ? 'Đủ dữ liệu phân tích' : 'Quá ít sự kiện mousemove' });

  if (n >= 10) {
    // 1a. Linearity
    let linearCount = 0;
    for (let i = 2; i < n; i++) {
      const dx1 = trail[i].x - trail[i-1].x, dy1 = trail[i].y - trail[i-1].y;
      const dx0 = trail[i-1].x - trail[i-2].x, dy0 = trail[i-1].y - trail[i-2].y;
      const cross = Math.abs(dx1 * dy0 - dy1 * dx0);
      const mag = Math.sqrt(dx1*dx1+dy1*dy1) * Math.sqrt(dx0*dx0+dy0*dy0);
      if (mag > 0 && cross / mag < 0.05) linearCount++;
    }
    const linearRatio = Math.round(linearCount / (n - 2) * 100);
    const linearFlag = linearRatio > 85 && n > 15;
    if (linearFlag) { score += 20; reasons.push('linear_movement'); }
    assessments.push({ cat: 'mouse', check: 'linearity', value: `${linearRatio}%`, threshold: '> 85%', flagged: linearFlag, note: linearFlag ? 'Di chuyển thẳng tắp — bot' : 'Có đường cong tự nhiên — người' });

    // 1b. Speed CV
    const speeds = [];
    for (let i = 1; i < n; i++) {
      const dx = trail[i].x - trail[i-1].x, dy = trail[i].y - trail[i-1].y;
      const dt = trail[i].t - trail[i-1].t;
      if (dt > 0) speeds.push(Math.sqrt(dx*dx + dy*dy) / dt);
    }
    const speedCV = _cv(speeds);
    const speedCVr = Math.round(speedCV * 100) / 100;
    const speedFlag = speeds.length > 8 && speedCV < 0.1;
    if (speedFlag) { score += 20; reasons.push('constant_velocity'); }
    assessments.push({ cat: 'mouse', check: 'speed_cv', value: speedCVr, threshold: '< 0.1', flagged: speedFlag, note: speedFlag ? 'Tốc độ đều — không có gia tốc/giảm tốc' : `Tốc độ biến thiên tự nhiên (CV=${speedCVr})` });

    // 1c. Micro-jitter
    let avgDeviation = -1;
    if (n > 10) {
      const sx = trail[0].x, sy = trail[0].y;
      const ex = trail[n-1].x, ey = trail[n-1].y;
      const lineLen = Math.sqrt((ex-sx)**2 + (ey-sy)**2);
      if (lineLen > 50) {
        let totalDeviation = 0;
        for (let i = 1; i < n - 1; i++) {
          const d = Math.abs((ey-sy)*(trail[i].x-sx) - (ex-sx)*(trail[i].y-sy)) / lineLen;
          totalDeviation += d;
        }
        avgDeviation = Math.round(totalDeviation / (n - 2) * 100) / 100;
        const jitterFlag = avgDeviation < 0.5;
        if (jitterFlag) { score += 15; reasons.push('no_micro_jitter'); }
        assessments.push({ cat: 'mouse', check: 'micro_jitter', value: `${avgDeviation}px`, threshold: '< 0.5px', flagged: jitterFlag, note: jitterFlag ? 'Không rung lắc tay — bot/bezier' : `Rung lắc tự nhiên ${avgDeviation}px — người` });
      }
    }

    // 1d. Fake timestamps
    const uniqueTimes = new Set(trail.map(p => p.t)).size;
    const fakeFlag = uniqueTimes <= 3 && n > 10;
    if (fakeFlag) { score += 30; reasons.push('fake_timestamps'); }
    assessments.push({ cat: 'mouse', check: 'timestamp_unique', value: uniqueTimes, threshold: '≤ 3', flagged: fakeFlag, note: fakeFlag ? `Chỉ ${uniqueTimes} timestamp khác nhau — giả mạo` : `${uniqueTimes} timestamp — bình thường` });

    // 1e. Interval regularity
    if (n > 15) {
      const ints = [];
      for (let i = 1; i < n; i++) ints.push(trail[i].t - trail[i-1].t);
      const intCV = _cv(ints);
      const intCVr = Math.round(intCV * 100) / 100;
      const intFlag = intCV < 0.12;
      if (intFlag) { score += 25; reasons.push('regular_intervals'); }
      assessments.push({ cat: 'mouse', check: 'interval_cv', value: intCVr, threshold: '< 0.12', flagged: intFlag, note: intFlag ? 'Khoảng cách thời gian đều máy — script' : `Khoảng cách thời gian biến thiên (CV=${intCVr}) — người` });
    }
  }

  // 1f. Hover before click
  const clickCount = (b.clickPositions || []).length;
  const hoverFlag = n < 5 && clickCount > 0;
  if (hoverFlag) { score += 15; reasons.push('no_hover_before_click'); }
  if (clickCount > 0) {
    assessments.push({ cat: 'mouse', check: 'hover_before_click', value: `${n} mousemove, ${clickCount} click`, flagged: hoverFlag, note: hoverFlag ? 'Click mà không rê chuột — bot' : 'Có di chuột trước khi click — người' });
  }

  // ═══════════════════════════════════════
  // 2. KEYSTROKE DYNAMICS
  // ═══════════════════════════════════════

  const dwellTimes = b.keyDwellTimes || [];
  const flightTimes = b.keyFlightTimes || [];

  if (dwellTimes.length >= 5) {
    const dwellCV = _cv(dwellTimes);
    const dwellCVr = Math.round(dwellCV * 100) / 100;
    const dwellFlag = dwellCV < 0.1;
    if (dwellFlag) { score += 20; reasons.push('constant_dwell_time'); }
    assessments.push({ cat: 'keyboard', check: 'dwell_time_cv', value: dwellCVr, threshold: '< 0.1', flagged: dwellFlag, note: dwellFlag ? 'Nhấn giữ phím đều nhau — bot' : `Thời gian giữ phím đa dạng (CV=${dwellCVr}) — người` });

    if (flightTimes.length >= 5) {
      const flightCV = _cv(flightTimes);
      const flightCVr = Math.round(flightCV * 100) / 100;
      const flightFlag = flightCV < 0.1;
      if (flightFlag) { score += 20; reasons.push('constant_flight_time'); }
      assessments.push({ cat: 'keyboard', check: 'flight_time_cv', value: flightCVr, threshold: '< 0.1', flagged: flightFlag, note: flightFlag ? 'Gõ phím nhịp điệu đều — bot' : `Nhịp gõ đa dạng (CV=${flightCVr}) — người` });
    }
  } else {
    assessments.push({ cat: 'keyboard', check: 'keystroke_data', value: dwellTimes.length, note: dwellTimes.length === 0 ? 'Không có dữ liệu bàn phím' : 'Quá ít phím để phân tích' });
  }

  if ((b.totalKeys || 0) > 20 && (b.backspaceCount || 0) === 0) {
    score += 5; reasons.push('no_typos');
    assessments.push({ cat: 'keyboard', check: 'backspace', value: `${b.totalKeys} phím, 0 Backspace`, flagged: true, note: 'Gõ nhiều nhưng không sửa lỗi — bot' });
  }

  // ═══════════════════════════════════════
  // 3. SCROLL PATTERNS
  // ═══════════════════════════════════════

  const scrollEvts = b.scrollEvents || [];
  if (scrollEvts.length >= 5) {
    const pauseFlag = (b.scrollPauses || 0) === 0 && scrollEvts.length > 10;
    if (pauseFlag) { score += 10; reasons.push('no_scroll_pauses'); }
    assessments.push({ cat: 'scroll', check: 'scroll_pauses', value: `${b.scrollPauses || 0} lần dừng / ${scrollEvts.length} sự kiện`, flagged: pauseFlag, note: pauseFlag ? 'Cuộn liên tục không dừng đọc — bot' : 'Có dừng đọc nội dung — người' });

    const scrollSpeeds = [];
    for (let i = 1; i < scrollEvts.length; i++) {
      const dy = Math.abs(scrollEvts[i].y - scrollEvts[i-1].y);
      const dt = scrollEvts[i].t - scrollEvts[i-1].t;
      if (dt > 0) scrollSpeeds.push(dy / dt);
    }
    const scrollCV = _cv(scrollSpeeds);
    const scrollCVr = Math.round(scrollCV * 100) / 100;
    const scrollFlag = scrollSpeeds.length > 5 && scrollCV < 0.1;
    if (scrollFlag) { score += 15; reasons.push('uniform_scroll_speed'); }
    assessments.push({ cat: 'scroll', check: 'scroll_speed_cv', value: scrollCVr, threshold: '< 0.1', flagged: scrollFlag, note: scrollFlag ? 'Tốc độ cuộn đều — bot' : `Tốc độ cuộn biến thiên (CV=${scrollCVr}) — người` });
  } else {
    assessments.push({ cat: 'scroll', check: 'scroll_data', value: scrollEvts.length, note: 'Ít/không có dữ liệu cuộn trang' });
  }

  // ═══════════════════════════════════════
  // 4. FOCUS & VISIBILITY
  // ═══════════════════════════════════════

  if (b.rafStable === false) {
    score += 15; reasons.push('raf_unstable');
    assessments.push({ cat: 'focus', check: 'raf_stable', value: false, flagged: true, note: 'Trình duyệt không render frame — headless' });
  } else {
    assessments.push({ cat: 'focus', check: 'raf_stable', value: true, flagged: false, note: 'Render frame ổn định — trình duyệt thật' });
  }

  if (!b.screen?.w || !b.screen?.h) {
    score += 20; reasons.push('zero_screen');
    assessments.push({ cat: 'focus', check: 'screen', value: '0x0', flagged: true, note: 'Không có màn hình — headless' });
  } else {
    const { w, h } = b.screen;
    const vmFlag = (w === 800 && h === 600) || (w === 1024 && h === 768 && b.screen.dpr === 1);
    if (vmFlag) { score += 5; reasons.push('vm_screen'); }
    assessments.push({ cat: 'focus', check: 'screen', value: `${w}x${h}@${b.screen.dpr || 1}x`, flagged: vmFlag, note: vmFlag ? 'Độ phân giải giống máy ảo' : 'Độ phân giải bình thường' });
  }

  assessments.push({ cat: 'focus', check: 'tab_blur', value: b.totalBlur || 0, note: `Chuyển tab ${b.totalBlur || 0} lần` });

  // ═══════════════════════════════════════
  // 5. CLICK POSITION ANALYSIS
  // ═══════════════════════════════════════

  const clicks = b.clickPositions || [];
  if (clicks.length >= 3) {
    let centerClicks = 0;
    for (const c of clicks) {
      if (c.elCenterX !== undefined) {
        const dx = Math.abs(c.x - c.elCenterX);
        const dy = Math.abs(c.y - c.elCenterY);
        if (dx <= 1 && dy <= 1) centerClicks++;
      }
    }
    const centerFlag = centerClicks === clicks.length;
    if (centerFlag) { score += 15; reasons.push('exact_center_clicks'); }
    assessments.push({ cat: 'click', check: 'center_accuracy', value: `${centerClicks}/${clicks.length} click vào tâm`, flagged: centerFlag, note: centerFlag ? 'Tất cả click chính xác vào tâm — element.click()' : 'Click lệch tâm tự nhiên — người' });
  } else {
    assessments.push({ cat: 'click', check: 'click_data', value: clicks.length, note: clicks.length === 0 ? 'Không có dữ liệu click' : `Chỉ ${clicks.length} click — chưa đủ phân tích` });
  }

  return { score, reasons, assessments };
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

  if (BOT_UA.test(ua)) {
    logSecurityEvent('bot_ua', ip, ua, null, {});
    return res.status(403).json({ error: 'Blocked' });
  }

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

  // ── 2. CreepJS check — any lie = block ──
  if (botDetection && (botDetection.bot === true || botDetection.totalLied > 0)) {
    console.log(`[Widget] 🚫 CreepJS BLOCKED: IP=${ip}, totalLied=${botDetection.totalLied}, sections=${JSON.stringify(botDetection.liedSections)}`);
    logSecurityEvent('creep_detected', ip, ua, visitorId, botDetection);
    botDetected = true;
    detectionLog.push('creep_detected');
    return res.status(403).json(ERR);
  }

  // ── 2b. Client-side automation probes ──
  const probes = behavioral?.probes || {};
  if (probes.webdriver === true || probes.cdc === true || probes.selenium === true) {
    console.log(`[Widget] 🤖 Automation probe hit: IP=${ip}`);
    logSecurityEvent('automation_probes', ip, ua, visitorId, probes);
    return res.status(403).json(ERR);
  }
  const probeWarnings = [];
  if (probes.pluginCount === 0) probeWarnings.push('zero_plugins');
  if (probes.rtt === 0) probeWarnings.push('zero_rtt');
  if (probes.langCount === 0) probeWarnings.push('zero_languages');
  if (probeWarnings.length > 0) {
    logSecurityEvent('probe_warning', ip, ua, visitorId, { ...probes, probeWarnings });
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

  // ── 4. Behavioral analysis v2 (5 categories: mouse, keyboard, scroll, focus, clicks) ──
  if (behavioral) {
    const result = analyzeBehavior(behavioral);
    mouseScore = result.score;
    mouseReasons = result.reasons.join(',');

    // Build full detail object (behavioral + core info)
    const fullDetail = {
      behaviorScore: result.score,
      assessments: result.assessments,
      // Core info
      botDetection: botDetection || null,
      probes: behavioral.probes || {},
      screen: behavioral.screen || null,
      countdownTime: behavioral.countdownTime || 0,
    };

    if (result.score >= 70) {
      detectionLog.push('behavior_bot');
      console.log(`[Widget] 🤖 Behavior bot: score=${result.score}, reasons=${mouseReasons}, IP=${ip}`);
      logSecurityEvent('mouse_bot', ip, ua, visitorId, fullDetail);
      return res.status(403).json(ERR);
    }

    if (result.score > 0) {
      console.log(`[Widget] ⚠️ Behavior warning: score=${result.score}, reasons=${mouseReasons}, IP=${ip}`);
      logSecurityEvent('suspicious', ip, ua, visitorId, fullDetail);
    }
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

  console.log(`[Widget] ✅ Code given — IP: ${ip}, task: #${task.id}, code: ${task.code_given}, elapsed: ${elapsedSeconds}s, behaviorScore=${mouseScore}`);

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
