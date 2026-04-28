const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { analyzeDevice } = require('../lib/behavior');

const router = express.Router();

const HMAC_SECRET = process.env.CHALLENGE_KEY || crypto.randomBytes(32).toString('hex');
const BOT_UA = /curl|wget|python|httpie|postman|insomnia|axios|node-fetch|got\/|bot|crawler|spider|headlesschrome|phantomjs|selenium/i;

// ── Cache captcha_enabled setting (tránh query DB mỗi visitor request) ──
let _captchaEnabledCache = null;
let _captchaEnabledExpiry = 0;
async function getCaptchaEnabled(pool) {
  if (_captchaEnabledCache !== null && Date.now() < _captchaEnabledExpiry) return _captchaEnabledCache;
  try {
    const [rows] = await pool.execute("SELECT setting_value FROM site_settings WHERE setting_key = 'captcha_enabled'");
    _captchaEnabledCache = !(rows.length > 0 && rows[0].setting_value === 'false');
  } catch { _captchaEnabledCache = true; }
  _captchaEnabledExpiry = Date.now() + 60 * 1000; // cache 60 giây
  return _captchaEnabledCache;
}

// ── Cache views_per_ip setting — đồng bộ với vuotlink.js ──
let _viewsPerIpCacheW = null;
let _viewsPerIpExpiryW = 0;
async function getViewsPerIp(pool) {
  if (_viewsPerIpCacheW !== null && Date.now() < _viewsPerIpExpiryW) return _viewsPerIpCacheW;
  const [rows] = await pool.execute("SELECT setting_value FROM site_settings WHERE setting_key = 'views_per_ip'");
  _viewsPerIpCacheW = rows.length > 0 ? (parseInt(rows[0].setting_value) || 5) : 5;
  _viewsPerIpExpiryW = Date.now() + 60 * 1000;
  return _viewsPerIpCacheW;
}

// ── Clear settings caches — gọi khi admin save settings ──
function clearSettingsCache() {
  _viewsPerIpCacheW = null;
  _viewsPerIpExpiryW = 0;
  _captchaEnabledCache = null;
  _captchaEnabledExpiry = 0;
  console.log('[Widget] Settings cache cleared');
}
module.exports.clearSettingsCache = clearSettingsCache;

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

const _trustedCache = new Map();
setInterval(() => _trustedCache.clear(), 5 * 60 * 1000);

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

// ── Normalize IPv4-mapped IPv6 to plain IPv4 ─────────────────────────
// e.g. '::ffff:1.2.3.4' → '1.2.3.4'  |  pure IPv6 stays unchanged
function normalizeIp(raw) {
  if (!raw) return raw;
  const s = String(raw).trim();
  if (s.startsWith('::ffff:') || s.startsWith('::FFFF:')) return s.slice(7);
  return s;
}

function generateSessionToken(ip, ua) {
  const ts = Math.floor(Date.now() / 1000);
  const normIp = normalizeIp(ip);
  const data = `${normIp}|${ua}|${ts}`;
  const hmac = crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex').substring(0, 16);
  return `${ts}.${hmac}`;
}

function verifySessionToken(token, ip, ua) {
  if (!token || !token.includes('.')) return false;
  const [tsStr, hmac] = token.split('.');
  const ts = parseInt(tsStr);
  if (isNaN(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 1800) return false;
  const normIp = normalizeIp(ip);
  const expected = crypto.createHmac('sha256', HMAC_SECRET).update(`${normIp}|${ua}|${ts}`).digest('hex').substring(0, 16);
  return hmac === expected;
}

function signWidgetChallenge(_ci, ip) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(`${_ci}|${ip}`).digest('hex').substring(0, 24);
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
  const normIp = normalizeIp(ip);
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
        // Dùng VN date string trực tiếp (nhất quán với vuotlink.js)
        const vnDateNow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
        const vnDayStart = `${vnDateNow} 00:00:00`;
        const vnDayEnd = `${vnDateNow} 23:59:59`;
        const [tdRows] = await pool.execute(
          `SELECT campaign_id, COUNT(*) as done FROM vuot_link_tasks
           WHERE campaign_id IN (${ph}) AND status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
             AND completed_at >= '${vnDayStart}' AND completed_at <= '${vnDayEnd}'
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


  const _ce = await getCaptchaEnabled(pool);

  const resp = { campaignFound: !!campaignInfo, _ce };
  if (dailyFull && !campaignInfo) resp.dailyFull = true;
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

  resp._t = generateSessionToken(normIp, ua);
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

  // ── Origin header verification ────────────────────────────────
  // Browser thật tự động gửi Origin header khi gọi cross-origin XHR/fetch.
  // Script Python/curl không gửi Origin header bằng định — phải cố ý set thủ công.
  // Nếu Origin có mặt và sai domain → block ngay. Nếu vắng → log warning.
  {
    const originHeader = (req.headers['origin'] || '').trim();
    const allowedDomain = widgets[0].allowed_domain || '';
    if (originHeader) {
      let originHost = '';
      try { originHost = new URL(originHeader).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { }
      let allowedHost = '';
      if (allowedDomain) {
        try {
          allowedHost = new URL(allowedDomain.startsWith('http') ? allowedDomain : 'https://' + allowedDomain)
            .hostname.replace(/^www\./, '').toLowerCase();
        } catch (_) { }
      }
      if (allowedHost && originHost && originHost !== allowedHost) {
        console.log('[Widget] BLOCKED Origin mismatch: origin=' + originHeader + ', expected=' + allowedDomain + ', IP=' + ip);
        return res.status(403).json({ error: 'Phát hiện gian lận!' });
      }
    } else {
      // Không có Origin: có thể là direct API call (script/curl) — log để monitor
      console.log('[Widget] WARN no Origin header — IP: ' + ip + ', UA: ' + ua.substring(0, 60));
    }
  }

  const { visitorId, _ref, _np, pageUrl } = req.body || {};

  const cleanVisitorId = (visitorId && visitorId !== 'unknown') ? visitorId : '';
  const normIp = normalizeIp(ip);
  const altIp = normIp.includes(':') ? normIp : `::ffff:${normIp}`; // also try other form
  const [tasks] = await pool.execute(
    `SELECT vt.id, vt.ref_worker_id, vt.worker_id, vt.status as task_status,
            vt.keyword as task_keyword,
            c.traffic_type, c.url as campaign_url FROM vuot_link_tasks vt
     JOIN campaigns c ON c.id = vt.campaign_id
     WHERE (vt.ip_address = ? OR vt.ip_address = ? OR (vt.visitor_id = ? AND vt.visitor_id IS NOT NULL AND vt.visitor_id != '' AND vt.visitor_id != 'unknown'))
       AND vt.status IN ('pending', 'step1', 'step2', 'step3')
       AND vt.expires_at > NOW()
     ORDER BY vt.created_at DESC LIMIT 1`,
    [normIp, altIp, cleanVisitorId]
  );

  if (tasks.length === 0) {
    console.log(`[Widget] check-session NO TASK — IP: ${normIp} (alt: ${altIp}), visitorId: ${(cleanVisitorId).substring(0, 20)}, referrer: ${(_ref || '').substring(0, 60)}`);
    return res.status(404).json({ _hs: false });
  }

  const task = tasks[0];
  if (task.traffic_type === 'google_search' && !['step2', 'step3'].includes(task.task_status)) {
    const GOOGLE_DOMAINS = /^https?:\/\/(www\.)?google\.(com|co\.[a-z]{2,3}|com\.[a-z]{2,3}|[a-z]{2,3})\//i;
    const clientRef = _ref || '';
    const CF_CHALLENGE = /[?&](__cf_chl_tk|__cf_chl_f_tk|cf_chl_prog|cf_chl_opt|cf_chl_seq)[=_]/i;
    const CF_PATH = /\/cdn-cgi\/challenge-platform\//i;
    const isCfChallenge = CF_CHALLENGE.test(clientRef) || CF_PATH.test(clientRef);

    // Cho phép điều hướng nội bộ: user vào từ Google → click link trong cùng trang web
    let isSelfReferrer = false;
    if (clientRef && task.campaign_url) {
      try {
        const refHost = new URL(clientRef).hostname.replace(/^www\./, '').toLowerCase();
        const campHost = new URL(task.campaign_url).hostname.replace(/^www\./, '').toLowerCase();
        isSelfReferrer = refHost === campHost;
      } catch (_) { }
    }

    const isGoogleRef = clientRef && GOOGLE_DOMAINS.test(clientRef);

    const np = _np || {};
    const navType = np.navType || null;
    const hasGoogleParams = !!np.hasGoogleParams;

    const hasCfClearance = !!np.hasCfClearance;
    let isDirectPaste = false;
    if (!clientRef && navType === 'navigate' && !hasGoogleParams && !isCfChallenge && !hasCfClearance) {
      isDirectPaste = true;
    }

    if (isDirectPaste) {
      console.log(`[Widget] check-session BLOCKED: Direct paste detected — IP: ${ip}, task: #${task.id}, navType: ${navType}, hasGoogleParams: ${hasGoogleParams}`);
      return res.status(403).json({ error: 'Vui lòng truy cập trang từ kết quả tìm kiếm Google.', requireGoogle: true });
    }

    if (!isCfChallenge && !isSelfReferrer && !isGoogleRef && clientRef !== '') {
      console.log(`[Widget] check-session BLOCKED: Non-Google referrer — IP: ${ip}, task: #${task.id}, type: ${task.traffic_type}, referrer: "${clientRef.substring(0, 120)}"`);
      return res.status(403).json({ error: 'Vui lòng truy cập trang từ kết quả tìm kiếm Google.', requireGoogle: true });
    }
    if (isCfChallenge) {
      console.log(`[Widget] check-session: Cloudflare challenge allowed — IP: ${ip}, task: #${task.id}, ref: "${clientRef.substring(0, 80)}"`);
    }
    if (isSelfReferrer) {
      console.log(`[Widget] check-session: Self-referrer allowed (internal nav) — IP: ${ip}, task: #${task.id}, ref: "${clientRef.substring(0, 80)}"`);
    }
    if (!clientRef && hasGoogleParams) {
      console.log(`[Widget] check-session: Empty referrer but Google params present — IP: ${ip}, task: #${task.id}, params: ${JSON.stringify(np.googleParams || {})}`);
    }
  }

  // ── Social traffic: referer phải đến từ domain social URL ──
  // Logic giống search: chỉ block khi referrer RÕ RÀNG sai domain; cho phép rỗng trừ khi direct-paste
  if (task.traffic_type === 'social' && !['step2', 'step3'].includes(task.task_status)) {
    const clientRef = _ref || '';
    const socialKeyword = task.task_keyword || '';
    let socialDomain = '';
    try { socialDomain = new URL(socialKeyword).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { }

    if (socialDomain) {
      // Self-referrer: user đã vào trang đích rồi navigate nội bộ → cho phép (giống search)
      let isSelfReferrer = false;
      if (clientRef && task.campaign_url) {
        try {
          const refHost = new URL(clientRef).hostname.replace(/^www\./, '').toLowerCase();
          const campHost = new URL(task.campaign_url).hostname.replace(/^www\./, '').toLowerCase();
          isSelfReferrer = refHost === campHost;
        } catch (_) { }
      }

      let isSocialRef = false;
      if (clientRef) {
        try {
          const refDomain = new URL(clientRef).hostname.replace(/^www\./, '').toLowerCase();
          isSocialRef = refDomain === socialDomain || refDomain.endsWith('.' + socialDomain);
        } catch (_) { }
      }

      const np = _np || {};
      const navType = np.navType || null;
      const hasCfClearance = !!np.hasCfClearance;
      const CF_CHALLENGE = /[?&](__cf_chl_tk|__cf_chl_f_tk|cf_chl_prog|cf_chl_opt|cf_chl_seq)[=_]/i;
      const isCfChallenge = CF_CHALLENGE.test(clientRef);
      if (!clientRef && navType === 'navigate' && !isCfChallenge && !hasCfClearance) {
        console.log(`[Widget] check-session social: empty referrer (new tab?) — IP: ${ip}, task: #${task.id}`);
      }

      if (!isCfChallenge && !isSelfReferrer && !isSocialRef && clientRef !== '') {
        console.log(`[Widget] check-session BLOCKED: Non-social referrer — IP: ${ip}, task: #${task.id}, expected: ${socialDomain}, got: "${clientRef.substring(0, 120)}"`);
        return res.status(403).json({ error: 'Vui lòng truy cập trang từ bài đăng social đã chỉ định.', requireSocial: true, socialDomain });
      }
    }
  }




  try {
    // Gia hạn expires_at thêm 1200 giây
    await pool.execute(
      `UPDATE vuot_link_tasks SET expires_at = DATE_ADD(NOW(), INTERVAL 1200 SECOND) WHERE id = ?`,
      [task.id]
    );
  } catch (e) { }

  // Ghi widget_started_at lần đầu tiên (để get-code tính elapsed chính xác
  // kể từ khi user thực sự bắt đầu ở trang đích, không phải từ created_at của task)
  try {
    const _wStartedAt = new Date().toISOString();
    await pool.execute(
      `UPDATE vuot_link_tasks
       SET security_detail = JSON_SET(
         COALESCE(security_detail, '{}'),
         '$.widget_started_at',
         COALESCE(JSON_UNQUOTE(JSON_EXTRACT(security_detail, '$.widget_started_at')), ?)
       )
       WHERE id = ? AND (security_detail IS NULL OR JSON_EXTRACT(security_detail, '$.widget_started_at') IS NULL)`,
      [_wStartedAt, task.id]
    );
  } catch (e) { /* ignore — fallback to created_at */ }

  // Ghi visitor_id vào task nếu chưa có (widget gửi lên, task tìm được qua IP)
  // Giúp get-code vẫn tìm được task khi IP thay đổi (4G/5G), dùng visitor_id làm fallback
  if (cleanVisitorId && (!task.visitor_id || task.visitor_id === 'unknown')) {
    try {
      await pool.execute(
        `UPDATE vuot_link_tasks SET visitor_id = ? WHERE id = ? AND (visitor_id IS NULL OR visitor_id = '' OR visitor_id = 'unknown')`,
        [cleanVisitorId, task.id]
      );
      console.log(`[Widget] check-session: saved visitor_id to task #${task.id} — IP: ${ip}`);
    } catch (e) { }
  }
  // Cập nhật ip_address nếu IP thay đổi (4G/5G đổi IP giữa trang gateway và trang embed)
  if (normIp && task.ip_address && normalizeIp(task.ip_address) !== normIp) {
    try {
      await pool.execute(
        `UPDATE vuot_link_tasks SET ip_address = ? WHERE id = ?`,
        [normIp, task.id]
      );
      console.log(`[Widget] check-session: IP changed — old: ${task.ip_address}, new: ${normIp}, task: #${task.id}`);
    } catch (e) { }
  }

  let isTrustedWorker = false;
  // Chỉ dùng worker_id (người thực sự làm task) — ref_worker_id là referrer, không ảnh hưởng captcha
  const targetCheckId = task.worker_id;
  if (targetCheckId) {
    try {
      const [tRows] = await pool.execute('SELECT trusted FROM users WHERE id = ?', [targetCheckId]);
      if (tRows.length > 0 && tRows[0].trusted === 1) {
        isTrustedWorker = true;
        const csVid = (cleanVisitorId && cleanVisitorId !== 'unknown') ? cleanVisitorId : '';
        if (csVid) _trustedCache.set(csVid, true);
        _trustedCache.set(ip, true);
      }
    } catch (e) { }
  }

  console.log(`[Widget] check-session trusted — IP: ${ip}, task: #${task.id}, ref_worker_id: ${task.ref_worker_id}, worker_id: ${task.worker_id}, trusted: ${isTrustedWorker}`);
  const initNonce = crypto.randomBytes(16).toString('hex');
  try {
    await pool.execute(
      `UPDATE vuot_link_tasks SET security_detail = JSON_SET(
         COALESCE(security_detail, '{}'), '$.hb_nonce', ?
       ) WHERE id = ?`,
      [initNonce, task.id]
    );
  } catch (e) { /* non-critical */ }

  res.json({ _hs: true, trusted: isTrustedWorker, _hbn: initNonce });
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

  const _ci = crypto.randomBytes(16).toString('hex');
  // Canvas Proof-of-Work seed: client phải render canvas với seed này và gửi SHA-256 hash
  // Server sign seed bằng HMAC → không ai giả mạo được expected hash mà không có HMAC_SECRET
  const canvasSeed = crypto.randomBytes(8).toString('hex');
  // SHA-256 thuần — khớp với SubtleCrypto trên client (browser thật)
  // expectedCanvasHash được lưu in-memory trong widgetChallenges, không expose ra ngoài
  const expectedCanvasHash = crypto.createHash('sha256')
    .update('canvas:' + canvasSeed + ':' + _ci).digest('hex').substring(0, 32);
  widgetChallenges[_ci] = { createdAt: Date.now(), used: false, ip, canvasSeed, expectedCanvasHash };

  const _ck = signWidgetChallenge(_ci, ip);

  res.json({ c: _ci, _ck, _cvs: canvasSeed });
});

const HB_INTERVAL_S = 10;
router.post('/public/:token/heartbeat', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';
  if (BOT_UA.test(ua)) return res.status(403).json({ ok: false });
  if (!checkWidgetRateLimit(ip, 'heartbeat', 30)) return res.status(429).json({ ok: false });
  const sToken = req.headers['x-session-token'] || '';
  if (!verifySessionToken(sToken, ip, ua)) return res.status(403).json({ ok: false });
  const { visitorId, nonce } = req.body || {};
  if (!nonce) return res.status(400).json({ ok: false, error: 'missing nonce' });
  const cleanVid = (visitorId && visitorId !== 'unknown') ? visitorId : '';
  const normIp = normalizeIp(ip);
  const altIp = normIp.includes(':') ? normIp : `::ffff:${normIp}`;
  try {
    const pool = getPool();
    const [tasks] = await pool.execute(
      `SELECT id, security_detail FROM vuot_link_tasks
       WHERE (ip_address = ? OR ip_address = ? OR (visitor_id = ? AND visitor_id IS NOT NULL AND visitor_id != '' AND visitor_id != 'unknown'))
         AND status IN ('pending','step1','step2','step3') AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [normIp, altIp, cleanVid]
    );
    if (tasks.length === 0) return res.status(404).json({ ok: false });
    const taskId = tasks[0].id;
    let secD = {};
    try { secD = JSON.parse(tasks[0].security_detail || '{}'); } catch { }
    const storedNonce = secD.hb_nonce || '';
    if (!storedNonce || nonce !== storedNonce) {
      console.log(`[Widget] HB nonce mismatch — task=#${taskId}, IP=${ip}`);
      return res.status(403).json({ ok: false, error: 'invalid nonce' });
    }
    // Per-task rate limit: chỉ cho 1 heartbeat mỗi (HB_INTERVAL_S-3)s
    // Ngăn attacker burst nhiều heartbeat liên tiếp để tăng nhanh hb_count
    const HB_MIN_GAP_MS = (HB_INTERVAL_S - 3) * 1000; // 7000ms
    if (secD.hb_last) {
      const lastMs = new Date(secD.hb_last).getTime();
      if (!isNaN(lastMs) && (Date.now() - lastMs) < HB_MIN_GAP_MS) {
        console.log(`[Widget] HB too fast (silent) — task=#${taskId}, gap=${Date.now() - lastMs}ms`);
        // Trả ok:true + nonce cũ — tránh break UI khi tab focus lại gọi HB ngay lập tức
        return res.json({ ok: true, _hbn: storedNonce });
      }
    }
    const nextNonce = crypto.randomBytes(16).toString('hex');
    const nowIso = new Date().toISOString();
    const newCount = (Number(secD.hb_count) || 0) + 1;
    await pool.execute(
      `UPDATE vuot_link_tasks SET security_detail = JSON_SET(
         COALESCE(security_detail,'{}'), '$.hb_nonce', ?, '$.hb_count', ?, '$.hb_last', ?
       ) WHERE id = ?`,
      [nextNonce, newCount, nowIso, taskId]
    );
    res.json({ ok: true, _hbn: nextNonce });
  } catch (e) {
    console.error('[Widget] heartbeat error:', e.message);
    res.status(500).json({ ok: false });
  }
});

router.post('/public/:token/get-code', async (req, res) => {
  const ERR = { error: 'Yêu cầu không hợp lệ' };
  const pool = getPool();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  if (!checkWidgetRateLimit(ip, 'get-code', 10)) {
    console.log(`[Widget] Rate limited — IP: ${ip}`);
    return res.status(429).json({ error: 'Quá nhiều yêu cầu' });
  }

  const sToken = req.headers['x-session-token'] || '';
  if (!verifySessionToken(sToken, ip, ua)) {
    return res.status(403).json({ error: 'Invalid session' });
  }

  const { _ci, _ck, visitorId, _dd, _bd, _hct, _ref, _np } = req.body || {};

  if (BOT_UA.test(ua)) {
    logSecurityEvent('Bot UA (widget)', ip, ua, visitorId || null, {});
    return res.status(403).json({ error: 'Blocked' });
  }

  const cleanVid = (visitorId && visitorId !== 'unknown') ? visitorId : '';
  const normIp = normalizeIp(ip);
  const altIp = normIp.includes(':') ? normIp : `::ffff:${normIp}`;
  const [tasks] = await pool.execute(
    `SELECT vt.*, c.url as campaign_url, c.time_on_site, c.version, c.target_page, c.traffic_type FROM vuot_link_tasks vt
     JOIN campaigns c ON c.id = vt.campaign_id
     WHERE (vt.ip_address = ? OR vt.ip_address = ? OR (vt.visitor_id = ? AND vt.visitor_id IS NOT NULL AND vt.visitor_id != '' AND vt.visitor_id != 'unknown'))
       AND vt.status IN ('pending', 'step1', 'step2', 'step3')
       AND vt.expires_at > NOW()
     ORDER BY vt.created_at DESC LIMIT 1`,
    [normIp, altIp, cleanVid]
  );

  if (tasks.length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy session.' });
  }
  const task = tasks[0];
  console.log(`[Widget] get-code task found — IP: ${ip}, task: #${task.id}, type: ${task.traffic_type}, status: ${task.status}, ref: "${(_ref || '').substring(0, 80)}"`);

  let isTrustedWorker = false;
  // Chỉ dùng worker_id (người thực sự làm task) — ref_worker_id là referrer, không ảnh hưởng captcha
  const targetCheckId = task.worker_id || req.userId;
  if (targetCheckId) {
    try {
      const [tRows] = await pool.execute('SELECT trusted FROM users WHERE id = ?', [targetCheckId]);
      isTrustedWorker = tRows[0]?.trusted === 1;
    } catch (_) { }
  }
  // Buoc 1: Check _ci _ck TRUOC khi verify hCaptcha (tranh consume token khi _cvh sai)
  let botDetected = false;
  let detectionLog = [];

  if (!_ci) return res.status(403).json(ERR);
  const ch = widgetChallenges[_ci];
  if (!ch || ch.used) { delete widgetChallenges[_ci]; return res.status(403).json(ERR); }
  if (Date.now() - ch.createdAt > 600000) { delete widgetChallenges[_ci]; return res.status(403).json(ERR); }
  if (!_ck || _ck !== signWidgetChallenge(_ci, ch.ip)) return res.status(403).json(ERR);

  // Buoc 2: _cvh check TRUOC hCaptcha - neu sai, token chua bi consume, client co the retry
  if (!isTrustedWorker && ch.expectedCanvasHash) {
    const submittedHash = req.body?._cvh || '';
    if (!submittedHash) {
      console.log('[Widget] _cvh missing — fail-open, task=#' + task.id);
    } else if (submittedHash !== ch.expectedCanvasHash) {
      console.log('[Widget] BLOCKED _cvh mismatch: task=#' + task.id + ', IP=' + ip + ', submitted=' + submittedHash + ', expected=' + ch.expectedCanvasHash);
      return res.status(403).json({ error: 'Phát hiọn gian lận! Vui lòng thực hiện trên trình duyệt.' });
    }
  }

  // Buoc 3: hCaptcha gate - chi verify khi _ci, _ck, _cvh da OK
  const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || '0x0000000000000000000000000000000000000000';
  if (!isTrustedWorker) {
    const captchaRequired = await getCaptchaEnabled(pool);
    if (captchaRequired) {
      const BLOCK_TOKENS = ['skip', 'disabled', 'render-error', 'error'];
      if (!_hct || BLOCK_TOKENS.includes(_hct)) {
        console.log('[Widget] BLOCKED: invalid _hct=' + (_hct || 'empty') + ' — IP: ' + ip + ', task: #' + task.id);
        return res.status(403).json({ error: 'Captcha bắt buộc. Vui lòng thực hiện trên trình duyệt.' });
      }
      try {
        const hcRes = await fetch('https://api.hcaptcha.com/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'response=' + encodeURIComponent(_hct) + '&secret=' + encodeURIComponent(HCAPTCHA_SECRET),
        });
        const hcData = await hcRes.json();
        if (!hcData.success) {
          console.log('[Widget] hCaptcha FAILED — IP: ' + ip + ', task: #' + task.id + ', errors: ' + (hcData['error-codes'] || []).join(','));
          return res.status(403).json({ error: 'Captcha không hợp lệ. Vui lòng giải lại.' });
        }
        console.log('[Widget] hCaptcha OK — IP: ' + ip + ', task: #' + task.id);
      } catch (e) {
        console.error('[Widget] hCaptcha siteverify error (fail-open):', e.message);
      }
    }
  }

  const v1Phase = req.body?.v1Phase || 0;
  ch.used = true;


  if (_dd) {
    if (req.body?._bv?.probes?.eventTampered === true) {
      _dd.automation = _dd.automation || {};
      _dd.automation.eventTampered = true;
    }
    const result = analyzeDevice(_dd, ua, _bd || {});
    if (result.isFake) {
      botDetected = true;
      detectionLog.push(...(result.detectionLog || ['headless_or_webdriver']));
    }
  }
  if (_bd && _bd.bot === true && !botDetected) {
    botDetected = true;
    detectionLog.push('creepjs_bot');
  }


  if (botDetected && detectionLog.length > 0) {

    logSecurityEvent('Phát hiện Bot (widget)', ip, ua, visitorId || null, {
      detectionLog,
      _cvh: botDetection?._cvh || null,
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
    const maxViewsPerIp = await getViewsPerIp(pool);
    const vnDateWidget = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const vnStartW = `${vnDateWidget} 00:00:00`;
    const vnEndW = `${vnDateWidget} 23:59:59`;
    const [vCount] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks
       WHERE visitor_id = ? AND completed_at IS NOT NULL
         AND completed_at >= ? AND completed_at <= ?
         AND status = 'completed' AND bot_detected = 0 AND is_over_limit = 0`,
      [visitorId, vnStartW, vnEndW]
    );
    if (vCount[0].cnt >= maxViewsPerIp) {
      detectionLog.push('device_limit');
      console.log(`[Widget] Device limit: visitorId=${visitorId.substring(0, 8)}..., count=${vCount[0].cnt}/${maxViewsPerIp}`);
      return res.status(429).json({ error: `Thiết bị đã đạt giới hạn ${maxViewsPerIp} lượt/ngày. Thử lại sau.` });
    }
  }

  const [widgets] = await pool.execute(
    `SELECT w.* FROM widgets w JOIN users u ON u.id = w.user_id WHERE w.token = ? AND w.is_active = 1 AND u.status = 'active'`,
    [req.params.token]
  );
  if (widgets.length === 0) return res.status(404).json({ error: 'Widget không tồn tại' });


  const campVersion = task.version || 0;



  if (task.traffic_type === 'google_search' && v1Phase !== 2 && !['step2', 'step3'].includes(task.status)) {
    const GOOGLE_DOMAINS = /^https?:\/\/(www\.)?google\.(com|co\.[a-z]{2,3}|com\.[a-z]{2,3}|[a-z]{2,3})\//i;
    const clientRef = _ref || '';
    const CF_CHALLENGE = /[?&](__cf_chl_tk|__cf_chl_f_tk|cf_chl_prog|cf_chl_opt|cf_chl_seq)[=_]/i;
    const CF_PATH = /\/cdn-cgi\/challenge-platform\//i;
    const isCfChallenge = CF_CHALLENGE.test(clientRef) || CF_PATH.test(clientRef);
    let isSelfReferrer = false;
    if (clientRef && task.campaign_url) {
      try {
        const refHost = new URL(clientRef).hostname.replace(/^www\./, '').toLowerCase();
        const campHost = new URL(task.campaign_url).hostname.replace(/^www\./, '').toLowerCase();
        isSelfReferrer = refHost === campHost;
      } catch (_) { }
    }

    const isGoogleRef = clientRef && GOOGLE_DOMAINS.test(clientRef);

    const np2 = _np || {};
    const navType2 = np2.navType || null;
    const hasGoogleParams2 = !!np2.hasGoogleParams;

    const hasCfClearance2 = !!np2.hasCfClearance;
    let isDirectPaste2 = false;
    if (!clientRef && navType2 === 'navigate' && !hasGoogleParams2 && !isCfChallenge && !hasCfClearance2) {
      isDirectPaste2 = true;
    }

    if (isDirectPaste2) {
      console.log(`[Widget] BLOCKED: Direct paste for search campaign — IP: ${ip}, task: #${task.id}, navType: ${navType2}`);
      await pool.execute(
        `UPDATE vuot_link_tasks SET security_detail = JSON_SET(COALESCE(security_detail,'{}'), '$.direct_paste', true, '$.nav_type', ?) WHERE id = ?`,
        [navType2 || 'unknown', task.id]
      ).catch(() => { });
      return res.status(403).json({ error: 'Vui lòng truy cập trang từ kết quả tìm kiếm Google.' });
    }

    // Chỉ block khi referrer RÕ RÀNG từ domain ngoài (không phải Google, không phải self, không trống)
    if (!isCfChallenge && !isSelfReferrer && !isGoogleRef && clientRef !== '') {
      console.log(`[Widget] BLOCKED: Non-Google referrer for search campaign — IP: ${ip}, task: #${task.id}, type: ${task.traffic_type}, referrer: "${clientRef.substring(0, 120)}"`);
      await pool.execute(
        `UPDATE vuot_link_tasks SET security_detail = JSON_SET(COALESCE(security_detail,'{}'), '$.non_google_referrer', true, '$.bad_referrer', ?) WHERE id = ?`,
        [clientRef.substring(0, 500), task.id]
      ).catch(() => { });
      return res.status(403).json({ error: 'Vui lòng truy cập trang từ kết quả tìm kiếm Google.' });
    }
  }

  // ── Social traffic: referer phải đến từ domain social URL ──
  // Logic giống search: chỉ block khi referrer RÕ RÀNG sai domain; cho phép rỗng trừ khi direct-paste
  // Bỏ qua khi task đã qua step2/step3 (referer check đã thực hiện ở bước trước)
  if (task.traffic_type === 'social' && !['step2', 'step3'].includes(task.status)) {
    const clientRef = _ref || '';
    const socialKeyword = task.keyword || '';
    let socialDomain = '';
    try { socialDomain = new URL(socialKeyword).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { }

    if (socialDomain) {
      // Self-referrer: user đã vào trang đích rồi navigate nội bộ → cho phép (giống search)
      let isSelfReferrer = false;
      if (clientRef && task.campaign_url) {
        try {
          const refHost = new URL(clientRef).hostname.replace(/^www\./, '').toLowerCase();
          const campHost = new URL(task.campaign_url).hostname.replace(/^www\./, '').toLowerCase();
          isSelfReferrer = refHost === campHost;
        } catch (_) { }
      }

      let isSocialRef = false;
      if (clientRef) {
        try {
          const refDomain = new URL(clientRef).hostname.replace(/^www\./, '').toLowerCase();
          // Cho phép subdomain: m.facebook.com, l.facebook.com, lm.facebook.com...
          isSocialRef = refDomain === socialDomain || refDomain.endsWith('.' + socialDomain);
        } catch (_) { }
      }

      // _np: detect direct-paste — chỉ log, không block
      // Lý do: click link mở tab mới trên social → referrer rỗng bình thường
      const np2 = _np || {};
      const navType2 = np2.navType || null;
      const hasCfClearance2 = !!np2.hasCfClearance;
      const CF_CHALLENGE = /[?&](__cf_chl_tk|__cf_chl_f_tk|cf_chl_prog|cf_chl_opt|cf_chl_seq)[=_]/i;
      const isCfChallenge = CF_CHALLENGE.test(clientRef);
      if (!clientRef && navType2 === 'navigate' && !isCfChallenge && !hasCfClearance2) {
        console.log(`[Widget] get-code social: empty referrer (new tab?) — IP: ${ip}, task: #${task.id}`);
      }

      // Chỉ block khi referrer RÕ RÀNG sai domain (non-empty, không phải social, không phải self)
      if (!isCfChallenge && !isSelfReferrer && !isSocialRef && clientRef !== '') {
        console.log(`[Widget] BLOCKED: Non-social referrer — IP: ${ip}, task: #${task.id}, expected: ${socialDomain}, got: "${clientRef.substring(0, 120)}"`);
        await pool.execute(
          `UPDATE vuot_link_tasks SET security_detail = JSON_SET(COALESCE(security_detail,'{}'), '$.non_social_referrer', true, '$.bad_referrer', ?) WHERE id = ?`,
          [clientRef.substring(0, 500), task.id]
        ).catch(() => { });
        return res.status(403).json({ error: 'Vui lòng truy cập trang từ bài đăng social đã chỉ định.', requireSocial: true, socialDomain });
      }
    }
  }

  const tos = task.time_on_site || '60';
  let requiredSeconds = 30;
  if (tos.includes('-')) {
    requiredSeconds = parseInt(tos.split('-')[0]) || 30;
  } else {
    requiredSeconds = parseInt(tos) || 30;
  }

  let refTime;
  try {
    const createdAtMs = new Date(task.created_at).getTime();
    let secDetail = {};
    try { secDetail = JSON.parse(task.security_detail || '{}'); } catch { }
    if (secDetail.widget_started_at) {
      const wMs = new Date(secDetail.widget_started_at).getTime();
      refTime = isNaN(wMs) ? createdAtMs : Math.max(createdAtMs, wMs);
    } else {
      refTime = createdAtMs;
    }
    if (isNaN(refTime)) refTime = Date.now();
  } catch { refTime = Date.now(); }

  const elapsedMs = Date.now() - refTime;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  if (elapsedSeconds < requiredSeconds) {
    const remaining = requiredSeconds - elapsedSeconds;
    console.log(`[Widget] Code request TOO EARLY — IP: ${ip}, task: #${task.id}, elapsed: ${elapsedSeconds}s < required: ${requiredSeconds}s`);
    return res.status(403).json({ error: 'Phát hiện gian lận!', remaining });
  }

  if (!isTrustedWorker && requiredSeconds >= 15) {
    try {
      let sd2 = {};
      try { sd2 = JSON.parse(task.security_detail || '{}'); } catch { }
      const hbCount = Number(sd2.hb_count) || 0;
      const minHbs = Math.max(1, Math.floor(requiredSeconds / HB_INTERVAL_S) - 1);
      if (hbCount < minHbs) {
        console.log(`[Widget] BLOCKED HB count: task=#${task.id}, got=${hbCount}, need>=${minHbs}, IP=${ip}`);
        return res.status(403).json({ error: 'Phát hiện gian lận! Vui lòng thực hiện trên trình duyệt.' });
      }
      // Heartbeat recency: heartbeat cuối phải trong vòng HB_INTERVAL_S*2 giây trước get-code
      // Attacker không thể burst heartbeat sớm rồi đợi lâu mới gọi get-code
      if (sd2.hb_last) {
        const lastHbMs = new Date(sd2.hb_last).getTime();
        const maxStalenessMs = HB_INTERVAL_S * 2 * 1000; // 20 giây
        if (!isNaN(lastHbMs) && (Date.now() - lastHbMs) > maxStalenessMs) {
          console.log(`[Widget] BLOCKED HB stale: task=#${task.id}, staleness=${Date.now() - lastHbMs}ms, IP=${ip}`);
          return res.status(403).json({ error: 'Phát hiện gian lận! Vui lòng thực hiện trên trình duyệt.' });
        }
      }
    } catch { /* fail-open */ }
  }

  // ── Behavioral entropy check ────────────────────────────────────────
  // Script thuần (curl, python, node-fetch) không tạo ra mouse/scroll/keyboard events.
  // Behavioral hoàn toàn trống = không có browser thật → block.
  // Fail-open (không block) nếu bhv=null (client cũ không gửi), isTrustedWorker, hoặc requiredSeconds < 15.
  if (!isTrustedWorker && requiredSeconds >= 15) {
    try {
      const bhv = req.body?._bv || null;
      if (bhv !== null) {
        const mousePoints = Number(bhv.mousePoints) || 0;
        const scrollCount = Array.isArray(bhv.scrollEvents) ? bhv.scrollEvents.length : (Number(bhv.scrollEvents) || 0);
        const totalKeys = Number(bhv.totalKeys) || 0;
        const focusCh = Number(bhv.focusChanges) || 0;
        const entropy = mousePoints + scrollCount * 3 + totalKeys * 2 + focusCh * 5;
        // Threshold rất thấp — user mobile chỉ tap 1 lần cũng qua
        if (entropy === 0) {
          console.log(`[Widget] BLOCKED behavioral=empty: task=#${task.id}, IP=${ip}, mouse=${mousePoints}, scroll=${scrollCount}, keys=${totalKeys}, focus=${focusCh}`);
          return res.status(403).json({ error: 'Phát hiện gian lận! Vui lòng thực hiện trên trình duyệt.' });
        }
      }
    } catch { /* fail-open */ }
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
