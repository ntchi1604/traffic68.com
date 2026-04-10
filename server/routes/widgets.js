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
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 600) return false;
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


  if (pageUrl && !widgets[0].website_url) {
    try {
      const origin = new URL(decodeURIComponent(pageUrl)).origin;
      pool.execute('UPDATE widgets SET website_url = ? WHERE id = ? AND (website_url IS NULL OR website_url = "")', [origin, widgets[0].id]).catch(() => { });
    } catch { }
  }
  let campaignInfo = null;
  let dailyFull = false;

  if (pageUrl) {
    try {
      const normalize = (u) => decodeURIComponent(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();
      const normalPage = normalize(pageUrl);

      // Check 1: campaign still has total quota
      const [campaigns] = await pool.execute(
        `SELECT id, url, url2, time_on_site, keyword, version, target_page, traffic_type, daily_views FROM campaigns 
         WHERE user_id = ? AND status = 'running' AND views_done < total_views 
         ORDER BY created_at DESC`,
        [widgets[0].user_id]
      );

      // Build today's done count per campaign (using correct VN→UTC timezone)
      const campIds = campaigns.map(c => c.id);
      let todayDoneMap = {};
      if (campIds.length > 0) {
        const ph = campIds.map(() => '?').join(',');
        const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const vnDayStart = new Date(vnNow); vnDayStart.setHours(0, 0, 0, 0);
        const vnDayEnd = new Date(vnNow); vnDayEnd.setHours(23, 59, 59, 999);
        const UTC_OFFSET_MS = 7 * 3600 * 1000;
        const utcStartMs = vnDayStart.getTime() - UTC_OFFSET_MS;
        const utcEndMs = vnDayEnd.getTime() - UTC_OFFSET_MS;
        const fmtUTC = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')}`; };
        const utcStartStr = fmtUTC(utcStartMs);
        const utcEndStr = fmtUTC(utcEndMs);
        const [tdRows] = await pool.execute(
          `SELECT campaign_id, COUNT(*) as done FROM vuot_link_tasks
           WHERE campaign_id IN (${ph}) AND status = 'completed'
             AND completed_at >= '${utcStartStr}' AND completed_at <= '${utcEndStr}'
           GROUP BY campaign_id`,
          campIds
        );
        tdRows.forEach(r => { todayDoneMap[r.campaign_id] = Number(r.done); });
      }

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
          // Check daily quota
          const dailyViews = Number(camp.daily_views) || 0;
          const todayDone = todayDoneMap[camp.id] || 0;
          if (dailyViews > 0 && todayDone >= dailyViews) {
            dailyFull = true; // daily done, but campaign still has total quota
            continue; // try next campaign instead of stopping
          }
          campaignInfo = { campaignId: camp.id, waitTime, version: camp.version || 0, targetPage: camp.target_page || '', trafficType: camp.traffic_type || 'google_search' };
          break;
        }
      }
      // Fallback: If URL match failed, use the worker's active task to find the campaign
      if (!campaignInfo) {
        try {
          const cleanVidFb = req.query.v || '';
          const [fbTasks] = await pool.execute(
            `SELECT c.id, c.time_on_site, c.version, c.target_page, c.traffic_type
             FROM vuot_link_tasks vt
             JOIN campaigns c ON c.id = vt.campaign_id
             WHERE (vt.ip_address = ? OR (? != '' AND vt.visitor_id = ?))
               AND vt.status IN ('pending', 'step1', 'step2', 'step3')
               AND vt.expires_at > NOW()
             ORDER BY vt.created_at DESC LIMIT 1`,
            [ip, cleanVidFb, cleanVidFb]
          );
          if (fbTasks.length > 0) {
            const at = fbTasks[0];
            const tos2 = at.time_on_site || '';
            let wt2 = 30;
            if (tos2.includes('-')) { wt2 = parseInt(tos2.split('-')[0]) || 30; }
            else { wt2 = parseInt(tos2) || 30; }
            campaignInfo = { campaignId: at.id, waitTime: wt2, version: at.version || 0, targetPage: at.target_page || '', trafficType: at.traffic_type || 'google_search' };
            console.log(`[Widget] IP fallback — IP: ${ip}, campaign: ${at.id}, waitTime: ${wt2}s`);
          }
        } catch (e) { }
      }
      console.log(`[Widget] Lookup — IP: ${ip}, page: "${normalPage.substring(0, 60)}", camps: ${campaigns.length}, matched: ${!!campaignInfo}, dailyFull: ${dailyFull}`);
    } catch (err) {
      console.error('Campaign lookup error:', err.message);
    }
  }

  const overrides = stripDefaults(config);
  if (campaignInfo) {
    overrides.waitTime = campaignInfo.waitTime;
  }


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

    if (captchaEnabled) {
      try {
        const visitorId = req.query.v || req.query.visitorId || '';
        const cleanVid = (visitorId && visitorId !== 'unknown') ? visitorId : '';
        const [tasks] = await pool.execute(
          `SELECT ref_worker_id, worker_id FROM vuot_link_tasks 
           WHERE (ip_address = ? OR (visitor_id = ? AND visitor_id != '')) 
             AND status IN ('pending', 'step1', 'step2', 'step3') 
             AND expires_at > NOW() 
           ORDER BY created_at DESC LIMIT 1`,
          [ip, cleanVid]
        );
        if (tasks.length > 0) {
          const targetCheckId = tasks[0].ref_worker_id || tasks[0].worker_id;
          if (targetCheckId) {
            const [tRows] = await pool.execute('SELECT trusted FROM users WHERE id = ?', [targetCheckId]);
            if (tRows.length > 0 && tRows[0].trusted === 1) {
              captchaEnabled = false;
            }
          }
        }
      } catch (e) { }
    }
  }

  const resp = { campaignFound: !!campaignInfo, captchaEnabled };
  if (dailyFull && !campaignInfo) resp.dailyFull = true; // hôm nay đã đủ, nhưng campaign vẫn còn quota tổng
  if (campaignInfo && campaignInfo.trafficType) resp.trafficType = campaignInfo.trafficType;
  if (campaignInfo && campaignInfo.trafficType === 'direct') resp.isDirect = true;
  if (Object.keys(overrides).length > 0) resp.config = overrides;
  if (campaignInfo && campaignInfo.version === 1) {
    resp.version = 1;
    resp.targetPage = campaignInfo.targetPage || '';
  }



  if (!resp.version) {
    try {
      const [v1Tasks] = await pool.execute(
        `SELECT c.version, c.time_on_site FROM vuot_link_tasks vt
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
        // Also send waitTime from this campaign if URL match didn't already set it
        if (!overrides.waitTime || overrides.waitTime === JS_DEFAULTS.waitTime) {
          const tos2 = v1Tasks[0].time_on_site || '';
          let wt2 = 30;
          if (tos2.includes('-')) { wt2 = parseInt(tos2.split('-')[0]) || 30; }
          else { wt2 = parseInt(tos2) || 30; }
          if (wt2 !== JS_DEFAULTS.waitTime) {
            overrides.waitTime = wt2;
            resp.config = Object.keys(overrides).length > 0 ? overrides : undefined;
          }
        }
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

  const cleanVisitorId = (visitorId && visitorId !== 'unknown') ? visitorId : '';
  const [tasks] = await pool.execute(
    `SELECT vt.id, vt.ref_worker_id, vt.worker_id, vt.status as task_status, c.traffic_type FROM vuot_link_tasks vt
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


  const task = tasks[0];
  if (task.traffic_type === 'google_search' && !['step2', 'step3'].includes(task.task_status)) {
    const GOOGLE_DOMAINS = /^https?:\/\/(www\.)?google\.(com|co\.[a-z]{2,3}|com\.[a-z]{2,3}|[a-z]{2,3})\//i;
    const clientRef = pageReferrer || '';
    // Chỉ block khi referrer CÓ GIÁ TRỊ nhưng không phải Google.
    // Referrer rỗng được cho qua vì nhiều website/browser strip referrer
    // do Referrer-Policy header (no-referrer, strict-origin-when-cross-origin, same-origin...)
    // dù worker thực sự đến từ Google. Các lớp bảo vệ khác (task/IP binding) vẫn giữ nguyên.
    if (clientRef && !GOOGLE_DOMAINS.test(clientRef)) {
      console.log(`[Widget] check-session BLOCKED: Non-Google referrer — IP: ${ip}, task: #${task.id}, type: ${task.traffic_type}, referrer: "${clientRef.substring(0, 120)}"`);
      return res.status(403).json({ error: 'Vui lòng truy cập trang từ kết quả tìm kiếm Google.', requireGoogle: true });
    }
    if (!clientRef) {
      console.log(`[Widget] check-session: empty referrer allowed (Referrer-Policy stripped) — IP: ${ip}, task: #${task.id}`);
    }
  }


  try {
    // Only refresh expires_at — do NOT reset created_at or elapsed-time validation will break
    await pool.execute(
      `UPDATE vuot_link_tasks SET expires_at = DATE_ADD(NOW(), INTERVAL 1200 SECOND) WHERE id = ?`,
      [task.id]
    );
  } catch (e) { }

  let isTrustedWorker = false;
  const targetCheckId = task.ref_worker_id || task.worker_id;
  if (targetCheckId) {
    try {
      const [tRows] = await pool.execute('SELECT trusted FROM users WHERE id = ?', [targetCheckId]);
      if (tRows.length > 0 && tRows[0].trusted === 1) isTrustedWorker = true;
    } catch (e) { }
  }

  res.json({ hasSession: true, trusted: isTrustedWorker });
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

  const { challengeId, _ck, visitorId, deviceData, botDetection, hcaptchaToken, pageReferrer } = req.body || {};

  if (BOT_UA.test(ua)) {
    logSecurityEvent('Bot UA (widget)', ip, ua, visitorId || null, {});
    return res.status(403).json({ error: 'Blocked' });
  }

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

  let isTrustedWorker = false;
  const targetCheckId = task.ref_worker_id || task.worker_id || req.userId;
  if (targetCheckId) {
    try {
      const [tRows] = await pool.execute('SELECT trusted FROM users WHERE id = ?', [targetCheckId]);
      isTrustedWorker = tRows[0]?.trusted === 1;
    } catch (_) { }
  }
  const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || '0x0000000000000000000000000000000000000000';
  if (!isTrustedWorker && hcaptchaToken && !['skip', 'error', 'render-error', 'disabled'].includes(hcaptchaToken)) {
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


  if (deviceData) {
    if (req.body?.behavioral?.probes?.eventTampered === true) {
      deviceData.automation = deviceData.automation || {};
      deviceData.automation.eventTampered = true;
    }
    const result = analyzeDevice(deviceData, ua, botDetection || {});
    if (result.isFake) {
      botDetected = true;
      detectionLog.push(...(result.detectionLog || ['headless_or_webdriver']));
    }
  }
  if (botDetection && botDetection.bot === true && !botDetected) {
    botDetected = true;
    detectionLog.push('creepjs_bot');
  }


  if (botDetected && detectionLog.length > 0) {

    logSecurityEvent('Phát hiện Bot (widget)', ip, ua, visitorId || null, {
      detectionLog,
      canvasHash: botDetection?.canvasHash || null,
      audioHash: botDetection?.audioHash || null,
      webglRenderer: botDetection?.webglRenderer || null,
      totalLies: botDetection?.totalLies || 0,
      lieNames: (botDetection?.lieNames || []).slice(0, 5),
    });

    try {
      const [activeTasks] = await pool.execute(
        `SELECT id FROM vuot_link_tasks WHERE (ip_address = ? OR (visitor_id = ? AND visitor_id IS NOT NULL AND visitor_id != '')) AND status IN ('pending','step1','step2','step3') AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
        [ip, visitorId || '']
      );
      if (activeTasks.length > 0) {
        await pool.execute(
          `UPDATE vuot_link_tasks SET bot_detected = 1, security_detail = JSON_SET(COALESCE(security_detail,'{}'), '$.widget_bot', true, '$.widget_detection_log', CAST(? AS JSON)) WHERE id = ?`,
          [JSON.stringify(detectionLog), activeTasks[0].id]
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


  const campVersion = task.version || 0;



  if (task.traffic_type === 'google_search' && v1Phase !== 2) {
    const GOOGLE_DOMAINS = /^https?:\/\/(www\.)?google\.(com|co\.[a-z]{2,3}|com\.[a-z]{2,3}|[a-z]{2,3})\//i;
    const clientRef = pageReferrer || '';
    // Chỉ block khi referrer CÓ GIÁ TRỊ nhưng không phải Google.
    // Referrer rỗng được cho qua — nhiều website set Referrer-Policy: no-referrer
    // hoặc strict-origin-when-cross-origin khiến document.referrer luôn rỗng
    // dù worker đã click từ Google thật.
    if (clientRef && !GOOGLE_DOMAINS.test(clientRef)) {
      console.log(`[Widget] BLOCKED: Non-Google referrer for search campaign — IP: ${ip}, task: #${task.id}, type: ${task.traffic_type}, referrer: "${clientRef.substring(0, 120)}"`);
      await pool.execute(
        `UPDATE vuot_link_tasks SET security_detail = JSON_SET(COALESCE(security_detail,'{}'), '$.non_google_referrer', true, '$.bad_referrer', ?) WHERE id = ?`,
        [clientRef.substring(0, 500), task.id]
      ).catch(() => { });
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


  if (campVersion === 1) {
    if (v1Phase !== 2) {

      if (task.status !== 'step2') {
        await pool.execute("UPDATE vuot_link_tasks SET status = 'step2' WHERE id = ?", [task.id]);
      }
      const v1Wait = Math.floor(Math.random() * 16) + 20;
      console.log(`[Widget] V1 phase 1 done — IP: ${ip}, task: #${task.id}, next wait: ${v1Wait}s`);
      return res.json({
        v1_step2: true,
        targetPage: task.target_page || '',
        v1Wait,
      });
    }


    const v1ExtraRequired = requiredSeconds + 20;
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

router.post('/', async (req, res) => {
  const pool = getPool();
  const { name, config, website_url } = req.body;


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

router.delete('/:id', async (req, res) => {
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM widgets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Widget không tồn tại' });
  res.json({ message: 'Đã xoá widget' });
});

module.exports = router;
