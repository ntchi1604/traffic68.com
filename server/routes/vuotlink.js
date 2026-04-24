const express = require('express');
const geoip = require('geoip-lite');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { analyzeDevice } = require('../lib/behavior');
const cache = require('../lib/cache');

const router = express.Router();

// Helper: ensure wallet exists then credit
async function ensureWalletCredit(pool, userId, walletType, amount) {
  const [res] = await pool.execute(
    'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?',
    [amount, userId, walletType]
  );
  if (res.affectedRows === 0) {
    // Tạo ví với balance=0 trước (INSERT IGNORE tránh race condition tạo trùng)
    await pool.execute(
      'INSERT IGNORE INTO wallets (user_id, type, balance) VALUES (?, ?, 0)',
      [userId, walletType]
    );
    // Ví chắc chắn tồn tại sau đây (dù INSERT bị ignore vì concurrent) → cộng tiền an toàn
    await pool.execute(
      'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?',
      [amount, userId, walletType]
    );
  }
}
const BOT_UA = /bot|crawler|spider|curl|wget|python|httpie|postman|insomnia|axios|node-fetch|headlesschrome|phantomjs|selenium/i;
const HMAC_SECRET = process.env.CHALLENGE_KEY || crypto.randomBytes(32).toString('hex');

// ── Normalize IPv4-mapped IPv6 to plain IPv4 ─────────────────────
function normalizeIp(raw) {
  if (!raw) return raw;
  const s = String(raw).trim();
  if (s.startsWith('::ffff:') || s.startsWith('::FFFF:')) return s.slice(7);
  return s;
}

async function logSecurityEvent(reason, ip, ua, visitorId, extra) {
  try {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO security_logs (source, reason, ip_address, user_agent, visitor_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      ['vuotlink', reason, ip || null, (ua || '').substring(0, 500), visitorId || null, JSON.stringify(extra || {}).substring(0, 10000)]
    );
  } catch (e) { /* ignore DB errors to not break main flow */ }
}

// Generate HMAC token for task (binds task to IP)
function signTask(taskId, ip) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(`${taskId}|${ip}`).digest('hex').substring(0, 24);
}
function verifyTaskToken(token, taskId, ip) {
  return token === signTask(taskId, ip);
}

// Generate HMAC challengeToken after human challenge is passed (binds taskId + IP + timestamp)
function signChallengeToken(taskId, ip, ts) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(`cp|${taskId}|${ip}|${ts}`).digest('hex').substring(0, 32);
}

// In-memory store: taskId -> { token, ts, ip }  (expires 15 min)
const challengePassedStore = {};
setInterval(() => {
  const now = Date.now();
  Object.keys(challengePassedStore).forEach(k => {
    if (now - challengePassedStore[k].ts > 900000) delete challengePassedStore[k];
  });
}, 60000);

// Rate limit counters (in-memory, reset every 10 minutes)
const ipTaskCount = {};
setInterval(() => { Object.keys(ipTaskCount).forEach(k => delete ipTaskCount[k]); }, 600000);

// ── Cache site_settings 'views_per_ip' ─ tránh query DB mỗi task request ──
let _viewsPerIpCache = null;
let _viewsPerIpExpiry = 0;
async function getViewsPerIp(pool) {
  if (_viewsPerIpCache !== null && Date.now() < _viewsPerIpExpiry) return _viewsPerIpCache;
  const [rows] = await pool.execute("SELECT setting_value FROM site_settings WHERE setting_key = 'views_per_ip'");
  const parsed = rows.length > 0 ? parseInt(rows[0].setting_value) : 0;
  _viewsPerIpCache = parsed > 0 ? parsed : (rows.length > 0 ? 2 : 5);
  console.log(`[VuotLink] views_per_ip loaded: ${_viewsPerIpCache} (DB row: ${rows.length > 0 ? rows[0].setting_value : 'NOT FOUND'})`);
  _viewsPerIpExpiry = Date.now() + 60 * 1000;
  return _viewsPerIpCache;
}

function clearSettingsCache() {
  _viewsPerIpCache = null;
  _viewsPerIpExpiry = 0;
  _campPoolCache = null;
  _campPoolExpiry = 0;
  console.log('[VuotLink] Settings cache cleared');
}
module.exports.clearSettingsCache = clearSettingsCache;

let _campPoolCache = null;
let _campPoolExpiry = 0;
let _campPoolHourKey = '';
async function _getCampaignPool(pool, todaySubquery, campaignWhere) {
  const now = Date.now();
  const hourKey = new Date().toISOString().substring(0, 13);
  if (_campPoolCache !== null && _campPoolHourKey === hourKey && now < _campPoolExpiry) {
    return _campPoolCache;
  }
  const [rows] = await pool.execute(
    `SELECT c.*, COALESCE(td.today_done, 0) AS _today_done, COALESCE(th.hour_done, 0) AS _hour_done FROM campaigns c ${todaySubquery} WHERE ${campaignWhere} ORDER BY COALESCE(td.today_done, 0) ASC LIMIT 500`
  );
  _campPoolCache = rows;
  _campPoolHourKey = hourKey;
  _campPoolExpiry = now + 1000;
  return rows;
}

async function _fetchWidgetConfig(pool, userId, selectedUrl) {
  try {
    let wRows;
    try {
      const campaignDomain = new URL(selectedUrl).hostname.replace(/^www\./, '');
      [wRows] = await pool.execute(
        `SELECT config FROM widgets WHERE user_id = ? AND is_active = 1 AND website_url LIKE ? ORDER BY created_at DESC LIMIT 1`,
        [userId, `%${campaignDomain}%`]
      );
    } catch (_) { /* invalid URL */ }
    if (!wRows || wRows.length === 0) {
      [wRows] = await pool.execute(
        `SELECT config FROM widgets WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
    }
    console.log(`[VuotLink] Widget query: user_id=${userId}, found=${wRows ? wRows.length : 0}`);
    if (wRows && wRows.length > 0) {
      const raw = JSON.parse(wRows[0].config || '{}');
      const DEFAULTS = {
        buttonText: 'Lấy Mã', buttonColor: '#f97316', textColor: '#ffffff',
        borderRadius: 50, fontSize: 15, shadow: true,
        iconUrl: '', iconBg: 'rgba(255,255,255,0.92)', iconSize: 22,
      };
      const cfg = { ...DEFAULTS, ...raw };
      console.log(`[VuotLink] widgetConfig: color=${cfg.buttonColor}, text=${cfg.buttonText}`);
      return cfg;
    }
  } catch (e) {
    console.error('[VuotLink] Widget config error:', e.message);
  }
  return null;
}

// ── Stateless challenge (HMAC-signed, works across PM2 cluster workers) ──
// Format: HMAC_SECRET signs payload so ANY worker can verify without shared memory
// Payload: base64url({ prefix, ts, ip, workerLinkId, refWorkerId })
const CHALLENGE_TTL_MS = 20 * 60 * 1000; // 20 minutes

function _b64(s) { return Buffer.from(s).toString('base64url'); }
function _unb64(s) { try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')); } catch { return null; } }

function signChallenge(payload) {
  const data = _b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyChallenge(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const data = token.substring(0, dot);
  const sig = token.substring(dot + 1);
  const expected = crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('base64url');
  // Constant-time compare to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = _unb64(data);
  if (!payload || !payload.ts || Date.now() - payload.ts > CHALLENGE_TTL_MS) return null;
  return payload;
}

router.get('/challenge', async (req, res) => {

  const ua = req.headers['user-agent'] || '';
  if (!ua || BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  let workerLinkId = null;
  let refWorkerId = null;

  const slug = (req.query.slug || '').trim();
  if (slug) {
    try {
      const pool = getPool();
      const [rows] = await pool.execute(
        `SELECT wl.id, wl.worker_id FROM worker_links wl
         JOIN users u ON u.id = wl.worker_id
         WHERE wl.slug = ? AND wl.hidden = 0
           AND u.status = 'active'
           AND u.source_status = 'approved'`, [slug]);
      if (rows.length > 0) {
        workerLinkId = rows[0].id;
        refWorkerId = rows[0].worker_id;
      } else {
        // Check if link exists but worker is not approved
        const [raw] = await pool.execute(
          `SELECT u.source_status FROM worker_links wl JOIN users u ON u.id = wl.worker_id WHERE wl.slug = ?`, [slug]
        );
        if (raw.length > 0 && raw[0].source_status !== 'approved') {
          return res.status(403).json({ error: 'Link này chưa được kích hoạt.' });
        }
        return res.status(404).json({ error: 'Link không tồn tại' });
      }
    } catch (e) {
      console.error('[VuotLink] Challenge slug lookup error:', e.message);
      return res.status(500).json({ error: 'Lỗi server' });
    }
  }

  // ── Ref link mode: ?ref=<referral_code> ──
  // Dùng referral_code (6 ký tự random, VD: "AB3X9K") thay vì username/id
  // → URL ?ref=AB3X9K không lộ danh tính worker
  const refParam = (req.query.ref || '').trim().toUpperCase();
  if (!slug && refParam) {
    try {
      const pool = getPool();
      // Không lọc theo role vì worker mặc định có role='user'
      const [rows] = await pool.execute(
        `SELECT id FROM users WHERE referral_code = ? AND status = 'active' LIMIT 1`,
        [refParam]
      );
      if (rows.length > 0) {
        refWorkerId = rows[0].id;
        console.log(`[VuotLink] Ref link: ref=${refParam} → refWorkerId=${refWorkerId}`);
      } else {
        // Ref không tồn tại → bỏ qua, không reject
        console.log(`[VuotLink] Ref not found: ref=${refParam}`);
      }
    } catch (e) {
      console.error('[VuotLink] Challenge ref lookup error:', e.message);
    }
  }

  const prefix = crypto.randomBytes(8).toString('hex');
  const difficulty = 4;
  const payload = { prefix, ts: Date.now(), ip, difficulty, wlid: workerLinkId, rwid: refWorkerId };
  const token = signChallenge(payload);
  // Prevent browser/proxy from caching this response — each challenge must be unique
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.json({ c: token, p: prefix, d: difficulty });
});

router.post('/task', optionalAuth, (req, res) => {
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[VuotLink] ⏱ POST /task TIMED OUT after 25s');
      res.status(503).json({ error: 'Server bận, vui lòng thử lại.' });
    }
  }, 25000);

  const done = () => clearTimeout(timeoutId);

  _handleTaskPost(req, res).then(done).catch(err => {
    done();
    console.error('[VuotLink] Unhandled error in task POST:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Lỗi server.' });
  });
});

async function _handleTaskPost(req, res) {
  const ERR = { error: 'Yêu cầu không hợp lệ' };
  const ua = req.headers['user-agent'] || '';
  if (!ua || BOT_UA.test(ua)) return res.status(403).json(ERR);

  const ip = normalizeIp(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress);

  const { challengeId, powNonce, visitorId, deviceData, botDetection, excludeCampaigns } = req.body || {};

  let botDetected = false;
  let detectionLog = [];

  if (!challengeId || powNonce === undefined) return res.status(403).json(ERR);

  // Verify stateless HMAC challenge token
  const ch = verifyChallenge(challengeId);
  if (!ch) return res.status(403).json(ERR);
  // IP binding: soft check — log mismatch but don't block
  // Dual-stack (IPv4/IPv6) routing can cause GET /challenge and POST /task to come from different IPs.
  // HMAC signature + PoW prevents token forgery, so this is defense-in-depth only.
  if (ch.ip && ch.ip !== ip) {
    console.warn(`[VuotLink] IP mismatch (allowed): challenge_ip=${ch.ip} request_ip=${ip} — likely dual-stack`);
  }

  const hash = crypto.createHash('sha256').update(ch.prefix + String(powNonce)).digest('hex');
  const target = '0'.repeat(ch.difficulty || 4);
  if (!hash.startsWith(target)) return res.status(403).json(ERR);

  // ── Rate limit: chỉ đếm sau khi PoW pass (không đếm retry do 404 tự động) ──
  ipTaskCount[ip] = (ipTaskCount[ip] || 0) + 1;
  if (ipTaskCount[ip] > 30) {
    return res.status(429).json({ error: 'Quá nhiều yêu cầu. Thử lại sau.' });
  }

  // Extract workerLinkId / refWorkerId from signed token
  const workerLinkIdFromCh = ch.wlid || null;
  const refWorkerIdFromCh = ch.rwid || null;

  // ── Check if gateway link owner is still active (prevent banned user links) ──
  if (workerLinkIdFromCh) {
    const pool = getPool();
    const [wlCheck] = await pool.execute(
      `SELECT u.status, u.source_status FROM worker_links wl JOIN users u ON u.id = wl.worker_id WHERE wl.id = ?`,
      [workerLinkIdFromCh]
    );
    if (!wlCheck.length || wlCheck[0].status !== 'active') {
      return res.status(403).json({ error: 'Link này đã bị vô hiệu hóa.' });
    }
    if (wlCheck[0].source_status !== 'approved') {
      return res.status(403).json({ error: 'Link này chưa được kích hoạt. Vui lòng chờ admin duyệt nguồn.' });
    }
  }

  const _isWorkerTablet = /ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(ua);
  const _isWorkerMobile = !_isWorkerTablet && /Mobi|Android|iPhone|iPod|BlackBerry|Windows Phone/i.test(ua);
  // workerDeviceType: 'mobile' | 'desktop' (tablet coi như mobile)
  const workerDeviceType = (_isWorkerMobile || _isWorkerTablet) ? 'mobile' : 'desktop';

  const devResult = analyzeDevice(deviceData || {}, ua, botDetection || {});
  if (devResult.isFake) {
    botDetected = true;
    detectionLog.push(...devResult.detectionLog);
  }

  // Thêm: CreepJS bot flag trực tiếp (fallback nếu analyzeDevice miss)
  if (!botDetected && botDetection && botDetection.bot === true) {
    botDetected = true;
    // Ghi lý do chi tiết từ CreepJS để admin xem
    const creepReasons = [];
    if (botDetection.headless) creepReasons.push('CreepJS: Headless browser');
    if (botDetection.stealth) creepReasons.push('CreepJS: Stealth mode');
    if (botDetection.workerLied) creepReasons.push('CreepJS: Worker scope bị giả mạo');
    if (botDetection.navigatorLied) creepReasons.push('CreepJS: Navigator bị giả mạo');
    if (botDetection.webglLied) creepReasons.push('CreepJS: WebGL bị giả mạo');
    if (botDetection.canvasLied) creepReasons.push('CreepJS: Canvas API bị giả mạo');
    if (botDetection.audioLied) creepReasons.push('CreepJS: Audio API bị giả mạo');
    if ((botDetection.totalLies || 0) > 0 && creepReasons.length === 0) {
      creepReasons.push(`CreepJS: ${botDetection.totalLies} API bị giả mạo (anti-detect browser)`);
    }
    if (creepReasons.length === 0) creepReasons.push('CreepJS: Fingerprint bất thường (bot=true, không xác định cụ thể)');
    detectionLog.push('creepjs_bot');
    devResult.reasons.push(...creepReasons);
  }


  const pool = getPool();
  const maxViewsPerIp = await getViewsPerIp(pool);

  const vnOpts = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' };
  const todayVn = new Intl.DateTimeFormat('en-CA', vnOpts).format(new Date()); // e.g. "2026-04-09"
  const hourVnRaw = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false, hourCycle: 'h23' }).format(new Date());
  const hourPad = String(parseInt(hourVnRaw) || 0).padStart(2, '0');
  // Phút hiện tại trong giờ (0-59) — dùng để rải đều view trong giờ khi bật view_by_hour
  const minuteVn = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', minute: '2-digit' }).format(new Date())) || 0;

  const vnDayStart = `${todayVn} 00:00:00`;
  const vnDayEnd = `${todayVn} 23:59:59`;
  const vnHourStart = `${todayVn} ${hourPad}:00:00`;
  const hourStartVn = vnHourStart;
  const _nextHourInt = parseInt(hourPad) + 1;
  const vnNextHourStart = _nextHourInt < 24
    ? `${todayVn} ${String(_nextHourInt).padStart(2, '0')}:00:00`
    : (() => {
      const tomorrow = new Intl.DateTimeFormat('en-CA', vnOpts).format(new Date(Date.now() + 86400000));
      return `${tomorrow} 00:00:00`;
    })();

  const _cleanVidCount = (visitorId && visitorId !== 'unknown') ? visitorId : null;
  const [deviceResult, ipResult] = await Promise.all([
    _cleanVidCount
      ? pool.execute(
        `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE visitor_id = ? AND completed_at >= ? AND completed_at <= ? AND status = 'completed' AND bot_detected = 0`,
        [_cleanVidCount, vnDayStart, vnDayEnd]
      )
      : Promise.resolve([[{ cnt: 0 }]]),
    pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE ip_address = ? AND completed_at >= ? AND completed_at <= ? AND status = 'completed' AND bot_detected = 0`,
      [ip, vnDayStart, vnDayEnd]
    ),
  ]);

  const deviceViewsToday = _cleanVidCount ? Number(deviceResult[0][0].cnt) : 0;
  // Device limit: block nếu đã vượt maxViewsPerIp
  if (_cleanVidCount && deviceViewsToday >= maxViewsPerIp) {
    console.log(`[VuotLink] Device limit: visitorId=${_cleanVidCount.substring(0, 8)}..., count=${deviceViewsToday}, max=${maxViewsPerIp}`);
    return res.status(429).json({ error: `Thiết bị đã đạt giới hạn ${maxViewsPerIp} lượt/ngày. Thử lại sau.`, remaining: 0, maxViews: maxViewsPerIp });
  }

  const ipViewsToday = Number(ipResult[0][0].cnt);
  const ipLimitReached = ipViewsToday >= maxViewsPerIp;
  if (ipLimitReached) {
    console.log(`[VuotLink] IP limit reached: IP ${ip} (${ipViewsToday}/${maxViewsPerIp}) → checking bonus_mode`);
  }

  const viewsUsed = Math.max(deviceViewsToday, ipViewsToday);
  const viewsRemaining = ipLimitReached ? 0 : maxViewsPerIp - viewsUsed;
  if (!ipLimitReached) {
    console.log(`[VuotLink] ✅ VN_DATE=${todayVn} | PASS: IP=${ip}, visitor=${visitorId?.substring(0, 8) || '?'}, views=${viewsUsed}/${maxViewsPerIp}`);
  }

  pool.execute(
    `UPDATE campaigns SET status = 'running' WHERE status = 'completed' AND views_done < total_views AND user_id IS NOT NULL`
  ).catch(e => console.warn('[VuotLink] Auto-recover error:', e.message));

  let workerBonusMode = false;
  const bonusCheckWorkerId = refWorkerIdFromCh || null;
  if (ipLimitReached) {
    if (bonusCheckWorkerId) {
      try {
        const [bmRows] = await pool.execute('SELECT bonus_mode FROM users WHERE id = ?', [bonusCheckWorkerId]);
        workerBonusMode = bmRows.length > 0 && bmRows[0].bonus_mode === 1;
      } catch (_) { }
    }
    if (!workerBonusMode) {
      console.log(`[VuotLink] IP limit reached: IP ${ip} (${ipViewsToday}/${maxViewsPerIp}), worker ${bonusCheckWorkerId} has no bonus_mode`);
      return res.status(429).json({ error: `Bạn đã đạt giới hạn ${maxViewsPerIp} lượt/ngày. Vui lòng quay lại ngày mai.`, remaining: 0, maxViews: maxViewsPerIp });
    }
    console.log(`[VuotLink] BONUS MODE: worker ${bonusCheckWorkerId} (IP ${ip}) hit limit but has bonus_mode → allowed`);
  }

  const campaignWhere = `c.status = 'running'
    AND (
      (c.traffic_type = 'google_search' AND c.keyword != '')
      OR c.traffic_type = 'direct'
      OR (c.traffic_type = 'social' AND c.keyword != '')
    )
    AND c.views_done < c.total_views
    AND (
      c.daily_views <= 0
      OR COALESCE(td.today_done, 0) < c.daily_views
    )
    AND (
      c.view_by_hour <= 0
      OR COALESCE(th.hour_done, 0) < CEIL(CEIL(COALESCE(NULLIF(c.daily_views, 0), c.total_views) / 24) * ${minuteVn + 1} / 60)
    )`;
  const todaySubquery = `LEFT JOIN (
      SELECT campaign_id, COUNT(*) as today_done
      FROM vuot_link_tasks
      WHERE status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
        AND completed_at >= '${vnDayStart}' AND completed_at <= '${vnDayEnd}'
      GROUP BY campaign_id
    ) td ON td.campaign_id = c.id
    LEFT JOIN (
      SELECT campaign_id, COUNT(*) as hour_done
      FROM vuot_link_tasks
      WHERE status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
        AND completed_at >= '${vnHourStart}' AND completed_at < '${vnNextHourStart}'
      GROUP BY campaign_id
    ) th ON th.campaign_id = c.id`;

  const cleanVidExcl = (visitorId && visitorId !== 'unknown') ? visitorId : '';
  const clientExcludes = Array.isArray(excludeCampaigns)
    ? excludeCampaigns.filter(id => Number.isInteger(Number(id))).map(Number)
    : [];

  // ── Chạy song song: exclude-list + campaign pool (cached) — tiết kiệm 1 DB round-trip ──
  const [ipDoneResult, allCandidates] = await Promise.all([
    pool.execute(
      `SELECT DISTINCT campaign_id FROM vuot_link_tasks
       WHERE (ip_address = ? OR (? != '' AND visitor_id = ?))
         AND (
           (status = 'completed' AND completed_at >= '${vnDayStart}' AND completed_at <= '${vnDayEnd}')
           OR
           (status IN ('pending', 'step1', 'step2', 'step3') AND expires_at > NOW())
         )`,
      [ip, cleanVidExcl, cleanVidExcl]
    ),
    _getCampaignPool(pool, todaySubquery, campaignWhere),
  ]);
  const serverExcludeIds = ipDoneResult[0].map(r => Number(r.campaign_id));
  const allExcludeIds = [...new Set([...serverExcludeIds, ...clientExcludes])];

  // Apply excludes in memory — không cần query DB lần 2
  let topCampaigns = allExcludeIds.length > 0
    ? allCandidates.filter(c => !allExcludeIds.includes(c.id))
    : allCandidates;

  let campaigns;
  if (topCampaigns.length === 0 && clientExcludes.length > 0) {
    campaigns = serverExcludeIds.length > 0
      ? allCandidates.filter(c => !serverExcludeIds.includes(c.id))
      : allCandidates;
  } else {
    campaigns = topCampaigns;
  }

  // Fallback: drop client skips, keep server-enforced excludes (in memory)
  const deviceFilteredCampaigns = campaigns.filter(c => {
    const dev = (c.device || '').toLowerCase();
    if (!dev) return true;
    const allowsDesktop = dev.includes('desktop');
    const allowsMobile = dev.includes('mobile');
    if (allowsDesktop && allowsMobile) return true;
    if (workerDeviceType === 'mobile') return allowsMobile;
    return allowsDesktop;
  });

  if (deviceFilteredCampaigns.length > 0) {
    campaigns = deviceFilteredCampaigns;
    console.log(`[VuotLink] Device filter: workerType=${workerDeviceType} → ${campaigns.length}/${topCampaigns.length || allCandidates.length} camps pass`);
  } else {
    console.log(`[VuotLink] Device filter: workerType=${workerDeviceType} → no match, skipping device filter (fallback)`);
  }

  if (campaigns.length === 0) {
    if (ipLimitReached) {
      return res.status(429).json({ error: `Bạn đã đạt giới hạn ${maxViewsPerIp} lượt/ngày. Vui lòng quay lại ngày mai.`, remaining: 0, maxViews: maxViewsPerIp });
    }
    // Không có campaign nào khả dụng (worker bonus_mode nhưng hết camp) → thông báo cụ thể
    try {
      const [dbTime] = await pool.execute("SELECT NOW() as now_vn, CURDATE() as today_vn, @@session.time_zone as tz");
      const [allCamps] = await pool.execute("SELECT COUNT(*) as total FROM campaigns WHERE status = 'running'");
      console.log(`[VuotLink] NO CAMPAIGNS - DB time: ${JSON.stringify(dbTime[0])}, running: ${allCamps[0].total}, pool: ${allCandidates.length}, serverExclude: ${serverExcludeIds.length}, clientExclude: ${clientExcludes.length}, IP: ${ip}`);
    } catch (e) { console.log('[VuotLink] Debug error:', e.message); }
    return res.status(404).json({ error: 'Không có nhiệm vụ phù hợp. Vui lòng thử lại sau.' });
  }

  const PRIORITY_WEIGHTS = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32 };

  const pickRandom = (val) => {
    if (!val) return val;
    try { const a = JSON.parse(val); if (Array.isArray(a) && a.length) return a[Math.floor(Math.random() * a.length)]; } catch { }
    return val;
  };
  const parseImgArray = (val) => {
    if (!val) return [];
    try { const a = JSON.parse(val); if (Array.isArray(a)) return a; } catch { }
    return [val];
  };

  let selectedKeyword;
  let selectedKwUrl = null;
  let selectedKwImage = null;
  let campaign = null;

  // Pool có thể bị thu hẹp dần qua các vòng retry
  let remainingCamps = [...campaigns];

  while (remainingCamps.length > 0) {
    // ── Weighted-random pick từ pool hiện tại ──
    let totalWeight = 0;
    const weightedCamps = remainingCamps.map(c => {
      const w = (c.priority != null && c.priority > 0) ? (PRIORITY_WEIGHTS[c.priority] || 1) : 1;
      totalWeight += w;
      return { ...c, _weight: w };
    });

    const rand = Math.random() * totalWeight;
    let picked = null;
    let cumulative = 0;
    for (const c of weightedCamps) {
      cumulative += c._weight;
      if (rand <= cumulative) { picked = c; break; }
    }
    if (!picked) picked = weightedCamps[weightedCamps.length - 1];

    const pLabel = picked.priority ? `priority=${picked.priority}(×${picked._weight})` : 'no-priority(×1)';
    console.log(`[VuotLink] Selected campaign id=${picked.id} ${pLabel} today=${picked._today_done} daily=${picked.daily_views} (pool: ${remainingCamps.length} camps, weighted-random totalW=${totalWeight})`);

    // ── Thử chọn keyword cho camp vừa pick ──
    let kwOk = false;
    try {
      const kwConfig = picked.keyword_config ? JSON.parse(picked.keyword_config) : null;
      if (Array.isArray(kwConfig) && kwConfig.length > 0) {
        // ── Merge 3 metrics thành 1 query: total + today_done + hour_done (giảm round-trip DB) ──
        const [kwCombined] = await pool.execute(
          `SELECT keyword,
                  COUNT(*) as done,
                  SUM(CASE WHEN completed_at >= ? AND completed_at <= ? THEN 1 ELSE 0 END) as today_done,
                  SUM(CASE WHEN completed_at >= ? AND completed_at < ? THEN 1 ELSE 0 END) as hour_done
           FROM vuot_link_tasks
           WHERE campaign_id = ? AND status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
           GROUP BY keyword`,
          [vnDayStart, vnDayEnd, vnHourStart, vnNextHourStart, picked.id]
        );
        const doneMap = {};
        const todayMap = {};
        const hourMap = {};
        kwCombined.forEach(r => {
          doneMap[r.keyword] = Number(r.done);
          todayMap[r.keyword] = Number(r.today_done);
          hourMap[r.keyword] = Number(r.hour_done);
        });

        const campaignDailyViews = Number(picked.daily_views) || 0;
        const hasAnyExplicitDaily = kwConfig.some(k => Number(k.daily_views) > 0);
        const totalExplicitDaily = kwConfig.reduce((s, k) => s + (Number(k.daily_views) > 0 ? Number(k.daily_views) : 0), 0);
        const limitedCount = kwConfig.filter(k => Number(k.daily_views) > 0).length;
        const unsetCount = kwConfig.filter(k => !(Number(k.daily_views) > 0)).length;
        const remainingDaily = Math.max(0, campaignDailyViews - totalExplicitDaily);
        // autoDaily: lượng ngày còn lại cho các kw không đặt daily_views tường minh
        // Nếu không có unsetCount hoặc remainingDaily = 0 thì fallback sang campaign daily / total kw
        const autoDaily = unsetCount > 0
          ? (hasAnyExplicitDaily && campaignDailyViews > 0
            ? Math.floor(remainingDaily / unsetCount)
            : campaignDailyViews > 0
              ? Math.floor(campaignDailyViews / kwConfig.length)
              : 0)
          : 0;

        // [FIX 1] Virtual target cho keyword không có daily limit:
        //   Thay vì dùng 1000 cứng (làm kw unlimited áp đảo kw có daily_views nhỏ),
        //   tính virtualTargetForUnlimited = avg daily_views của các kw có giới hạn tường minh,
        //   hoặc campaignDailyViews / tổng số kw nếu không có kw nào set daily tường minh.
        //   Sau đó trừ todayDone để weight cũng giảm dần theo thời gian (tự cân bằng).
        const avgExplicitDaily = hasAnyExplicitDaily && limitedCount > 0
          ? Math.ceil(totalExplicitDaily / limitedCount)
          : 0;
        const virtualTargetForUnlimited =
          campaignDailyViews > 0
            ? (unsetCount > 0 ? Math.max(1, Math.floor(remainingDaily / unsetCount)) : campaignDailyViews)
            : avgExplicitDaily > 0
              ? avgExplicitDaily
              : 1000;

        // ── Tính hourly cap per-keyword (áp dụng khi campaign bật view_by_hour) ──
        //   Cách tính kwHourlyCap:
        //   • Keyword có daily_views tường minh → hourly = CEIL(daily_views / 24)
        //   • Keyword không set daily, camp có daily_views → hourly = CEIL(autoDaily / 24)
        //   • Keyword không set daily, camp không set daily → hourly = CEIL(total_views / 24)
        const kwViewByHour = picked.view_by_hour > 0;
        const campTotalViews = Number(picked.total_views) || 0;

        const weighted = kwConfig
          .filter(k => k.keyword && k.keyword.trim())
          .map(k => {
            const totalDone = doneMap[k.keyword] || 0;
            const todayDone = todayMap[k.keyword] || 0;
            const hourDone = hourMap[k.keyword] || 0;
            const kwTotalViews = Number(k.views) || 0;
            const hasNoTotalLimit = kwTotalViews <= 0;
            const totalRemaining = hasNoTotalLimit ? Infinity : Math.max(0, kwTotalViews - totalDone);
            const effectiveDailyLimit = Number(k.daily_views) > 0 ? Number(k.daily_views) : autoDaily;
            const dailyRemaining = effectiveDailyLimit > 0 ? Math.max(0, effectiveDailyLimit - todayDone) : 0;
            const dailyOk = effectiveDailyLimit <= 0 || todayDone < effectiveDailyLimit;

            // Daily limit: hard stop — weight = 0 nếu đã hết quota ngày
            if (!dailyOk) return { ...k, weight: 0 };

            // ── Hourly cap per-keyword khi view_by_hour bật ──
            // Quy tắc: keyword có daily_views → daily_views/24
            //          không có daily_views, camp có daily_views → camp.daily_views/24
            //          không có gì → total_views/24
            let kwHourlyCap = 0;
            if (kwViewByHour) {
              if (Number(k.daily_views) > 0) {
                // Keyword có daily tường minh → cap = daily/24
                kwHourlyCap = Math.max(1, Math.ceil(Number(k.daily_views) / 24));
              } else if (autoDaily > 0) {
                // Keyword không set daily, camp có quota còn lại → cap = autoDaily/24
                kwHourlyCap = Math.max(1, Math.ceil(autoDaily / 24));
              } else if (campaignDailyViews > 0) {
                // Fallback: campaign daily / số kw / 24
                kwHourlyCap = Math.max(1, Math.ceil(campaignDailyViews / Math.max(1, kwConfig.length) / 24));
              } else if (campTotalViews > 0) {
                // Fallback cuối: total_views / 24
                kwHourlyCap = Math.max(1, Math.ceil(campTotalViews / 24));
              }
              // Rải đều trong giờ: tại phút m, chỉ cho phép ceil(hourlyCap*(m+1)/60) views
              const allowedHourlyNow = Math.ceil(kwHourlyCap * (minuteVn + 1) / 60);
              if (hourDone >= allowedHourlyNow) {
                return { ...k, weight: 0 };
              }
            }

            // Base weight = số lượt còn lại (tuyệt đối) để duy trì tỷ lệ đúng
            let baseWeight;
            if (effectiveDailyLimit > 0) {
              baseWeight = dailyRemaining;
            } else if (!hasNoTotalLimit) {
              baseWeight = Math.max(totalRemaining, 1);
            } else {
              baseWeight = Math.max(1, virtualTargetForUnlimited - todayDone);
            }

            if (kwViewByHour && kwHourlyCap > 0) {
              const hourlyRemaining = Math.max(0, kwHourlyCap - hourDone);
              baseWeight = Math.min(baseWeight, hourlyRemaining);
            }

            const totalPenalty = (!hasNoTotalLimit && totalRemaining === 0) ? 0.05 : 1;
            return { ...k, weight: baseWeight * totalPenalty };
          });

        const kwTotalWeight = weighted.reduce((s, w) => s + w.weight, 0);

        let selectedObj = null;
        if (kwTotalWeight > 0) {
          let kwRand = Math.random() * kwTotalWeight;
          selectedObj = weighted[weighted.length - 1];
          for (const item of weighted) {
            kwRand -= item.weight;
            if (kwRand <= 0) { selectedObj = item; break; }
          }
        } else {
          // All keywords hit their weight=0 (daily OR hourly cap)
          // Check if it's hourly cap (not daily) — if so, skip this camp entirely (view_by_hour)
          if (kwViewByHour) {
            // Kiểm tra xem có keyword nào còn quota ngày nhưng bị chặn bởi hourly cap không
            // Dùng cùng rule tính kwHourlyCap: kw.daily_views/24 → camp.daily_views/24 → total_views/24
            const anyBlockedByHour = kwConfig.some(k => {
              const kwDailyLimitEx = Number(k.daily_views) || 0;
              // effectiveDailyLimit cho keyword này
              const effDaily = kwDailyLimitEx > 0 ? kwDailyLimitEx
                : autoDaily > 0 ? autoDaily
                  : campaignDailyViews > 0 ? Math.floor(campaignDailyViews / Math.max(1, kwConfig.length))
                    : 0;
              const todayDoneKw = todayMap[k.keyword] || 0;
              const hourDoneKw = hourMap[k.keyword] || 0;
              // Keyword còn quota ngày (hoặc không giới hạn ngày)
              const dailyOkKw = effDaily <= 0 || todayDoneKw < effDaily;
              // Tính hourly cap cùng rule với trên
              let kwHourlyCapCheck = 0;
              if (kwDailyLimitEx > 0) {
                kwHourlyCapCheck = Math.max(1, Math.ceil(kwDailyLimitEx / 24));
              } else if (autoDaily > 0) {
                kwHourlyCapCheck = Math.max(1, Math.ceil(autoDaily / 24));
              } else if (campaignDailyViews > 0) {
                kwHourlyCapCheck = Math.max(1, Math.ceil(campaignDailyViews / Math.max(1, kwConfig.length) / 24));
              } else if (campTotalViews > 0) {
                kwHourlyCapCheck = Math.max(1, Math.ceil(campTotalViews / 24));
              }
              const allowedNow = Math.ceil(kwHourlyCapCheck * (minuteVn + 1) / 60);
              return dailyOkKw && kwHourlyCapCheck > 0 && hourDoneKw >= allowedNow;
            });
            if (anyBlockedByHour) {
              console.log(`[VuotLink] Campaign ${picked.id}: all keywords hit hourly cap (view_by_hour) → remove from pool, retrying`);
              // kwOk stays false → camp bị loại khỏi pool
            } else {
              // All blocked by daily limit
              console.log(`[VuotLink] Campaign ${picked.id}: all keywords hit daily limit today (view_by_hour on) → remove from pool, retrying`);
            }
          } else {
            // view_by_hour OFF: fallback cho keyword unlimited nếu tất cả bị daily
            const hasUnlimitedKw = kwConfig.some(k => {
              const effectiveDailyLimit = Number(k.daily_views) > 0 ? Number(k.daily_views) : autoDaily;
              return effectiveDailyLimit <= 0;
            });

            if (hasUnlimitedKw) {
              const stillRemaining = kwConfig.filter(k => {
                const effectiveDailyLimit = Number(k.daily_views) > 0 ? Number(k.daily_views) : autoDaily;
                const totalDone = doneMap[k.keyword] || 0;
                const kwTotalViews = Number(k.views) || 0;
                return effectiveDailyLimit <= 0 && (kwTotalViews <= 0 || totalDone < kwTotalViews);
              });
              const fallbackPool = stillRemaining.length > 0 ? stillRemaining : kwConfig.filter(k => {
                const effectiveDailyLimit = Number(k.daily_views) > 0 ? Number(k.daily_views) : autoDaily;
                return effectiveDailyLimit <= 0;
              });
              if (fallbackPool.length > 0) {
                selectedObj = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
              }
            } else {
              // ALL keywords exhausted for today → skip this campaign, try another
              console.log(`[VuotLink] Campaign ${picked.id}: all keywords hit daily limit today → remove from pool, retrying`);
            }
          }
        }

        if (selectedObj) {
          campaign = picked;
          selectedKeyword = selectedObj.keyword;
          selectedKwUrl = selectedObj.url || selectedObj.domain;
          selectedKwImage = selectedObj.image;
          console.log(`[VuotLink] Keyword config selected: "${selectedKeyword}" (URL: ${selectedKwUrl || 'None'}, Image: ${selectedKwImage ? 'Yes' : 'No'})`);
          kwOk = true;
        }
        // else: kwOk stays false → camp bị loại khỏi pool bên dưới
      } else {
        // No keyword_config (e.g. direct traffic) — check daily + hourly cap in memory
        const pickedDailyViews = Number(picked.daily_views) || 0;
        const pickedTodayDone = Number(picked._today_done) || 0;
        const pickedHourDone = Number(picked._hour_done) || 0;
        const pickedViewByHour = Number(picked.view_by_hour) > 0;
        const campTotalViews2 = Number(picked.total_views) || 0;

        // Daily limit check
        if (pickedDailyViews > 0 && pickedTodayDone >= pickedDailyViews) {
          console.log(`[VuotLink] Campaign ${picked.id} (direct): daily limit reached (${pickedTodayDone}/${pickedDailyViews}) → skip`);
          // Camp bị loại khỏi pool
        } else if (pickedViewByHour) {
          // Hourly per-minute cap
          const effectiveDailyForHour = pickedDailyViews > 0 ? pickedDailyViews : campTotalViews2;
          const hourlyCap = effectiveDailyForHour > 0 ? Math.max(1, Math.ceil(effectiveDailyForHour / 24)) : 0;
          if (hourlyCap > 0) {
            const allowedHourlyNow = Math.ceil(hourlyCap * (minuteVn + 1) / 60);
            if (pickedHourDone >= allowedHourlyNow) {
              console.log(`[VuotLink] Campaign ${picked.id} (direct): hourly per-min cap reached (${pickedHourDone}/${allowedHourlyNow} at minute ${minuteVn}) → skip`);
              // Camp bị loại khỏi pool
            } else {
              campaign = picked;
              selectedKeyword = pickRandom(picked.keyword) || picked.keyword;
              kwOk = true;
            }
          } else {
            campaign = picked;
            selectedKeyword = pickRandom(picked.keyword) || picked.keyword;
            kwOk = true;
          }
        } else {
          campaign = picked;
          selectedKeyword = pickRandom(picked.keyword) || picked.keyword;
          kwOk = true;
        }
      }
    } catch (kwErr) {
      console.error('[VuotLink] Keyword config parse error:', kwErr.message);
      // Fallback to keyword field to avoid dropping valid campaign
      campaign = picked;
      selectedKeyword = pickRandom(picked.keyword) || picked.keyword;
      kwOk = true;
    }

    if (kwOk) break; // Chọn được camp + keyword hợp lệ → thoát loop

    // Camp này không còn keyword khả dụng → loại khỏi pool và thử lại
    remainingCamps = remainingCamps.filter(c => c.id !== picked.id);
  }

  if (!campaign) {
    // Tất cả camps trong pool đều đã hết keyword daily limit
    console.log(`[VuotLink] All camps exhausted keyword daily limits today → no task available`);
    return res.status(404).json({ error: 'Không có nhiệm vụ phù hợp. Vui lòng thử lại sau.' });
  }

  const selectedUrl = (selectedKwUrl && selectedKwUrl.trim()) ? selectedKwUrl.trim() : campaign.url; // primary URL always used as target

  // Direct traffic: lưu URL đích vào cột keyword (không có từ khóa tìm kiếm)
  if (campaign.traffic_type === 'direct') {
    selectedKeyword = selectedUrl;
  }

  // ── Bắt đầu fetch widget config sớm (song song với INSERT / race check) ──
  const _widgetConfigPromise = _fetchWidgetConfig(pool, campaign.user_id, selectedUrl);

  const allImages = [...parseImgArray(campaign.image1_url), ...parseImgArray(campaign.image2_url)].filter(Boolean);
  const selectedImage1 = (selectedKwImage && selectedKwImage.trim()) ? selectedKwImage.trim() : (allImages.length > 0 ? allImages[Math.floor(Math.random() * allImages.length)] : '');
  const selectedImage2 = allImages.length > 1 ? allImages.filter(u => u !== selectedImage1)[Math.floor(Math.random() * Math.max(1, allImages.length - 1))] || '' : '';

  // Extra URLs for url2 (pick random from JSON array)
  const selectedUrl2 = pickRandom(campaign.url2) || '';


  // Generate random verification code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomCode = '';
  for (let i = 0; i < 6; i++) randomCode += chars[Math.floor(Math.random() * chars.length)];

  // Parse campaign duration from time_on_site
  let waitTime = 60; // default
  const tos = campaign.time_on_site || '';
  if (tos.includes('-')) {
    waitTime = parseInt(tos.split('-')[0]) || 60;
  } else {
    waitTime = parseInt(tos) || 60;
  }

  const expirySeconds = 1200; // 20 phút

  const workerLinkId = workerLinkIdFromCh || null;
  const refWorkerId = refWorkerIdFromCh || null;

  const secObj = {
    detectionLog: [...new Set(detectionLog)],
    isMobile: /Mobi|Android|iPhone|iPad|iPod/i.test(ua),
    deviceScore: devResult.score,
    deviceType: devResult.deviceType,
    reasons: devResult.reasons,
    detail: devResult.detail,

    canvasHash: botDetection?.canvasHash || devResult.detail?.canvasHash || null,
    audioHash: botDetection?.audioHash || devResult.detail?.audioHash || null,
    canvas: { hash1: botDetection?.canvas?.hash1, hash2: botDetection?.canvas?.hash2, noisy: botDetection?.canvas?.noisy },

    creepSummary: botDetection ? {
      totalLies: botDetection.totalLies || 0,
      lieNames: (botDetection.lieNames || []).slice(0, 5),
      canvasLied: !!botDetection.canvasLied,
      audioLied: !!botDetection.audioLied,
      webglRenderer: botDetection.webglRenderer || null,
    } : null,
  };
  const securityDetail = JSON.stringify(secObj).substring(0, 10000);
  const cleanVidCancel = (visitorId && visitorId !== 'unknown') ? visitorId : '';
  // Cancel tất cả pending tasks của session này:
  // 1) Theo visitorId trước (bắt cả trường hợp IP thay đổi trên mobile)
  // 2) Theo IP (xử lý trường hợp visitorId không ổn định / unknown trên iOS Safari)
  const cancelPromises = [];
  if (cleanVidCancel) {
    cancelPromises.push(
      pool.execute(
        `UPDATE vuot_link_tasks SET status = 'cancelled', expires_at = NOW()
         WHERE visitor_id = ? AND status IN ('pending', 'step1', 'step2', 'step3') AND expires_at > NOW()`,
        [cleanVidCancel]
      ).catch(() => { })
    );
  }
  cancelPromises.push(
    pool.execute(
      `UPDATE vuot_link_tasks SET status = 'cancelled', expires_at = NOW()
       WHERE ip_address = ? AND status IN ('pending', 'step1', 'step2', 'step3') AND expires_at > NOW()`,
      [ip]
    ).catch(() => { })
  );
  await Promise.all(cancelPromises);

  // is_over_limit: view vượt giới hạn IP nhưng được phép qua bonus_mode
  const isOverLimit = (workerBonusMode && ipLimitReached) ? 1 : 0;
  // Khi vượt link của người khác (gateway link), worker_id = null để tránh nhầm lẫn người nhận tiền.
  // Chủ link được xác định qua worker_link_id → wl.worker_id (xem phần Pay gateway link creator bên dưới).
  const taskWorkerId = workerLinkId ? null : (req.userId || null);
  const [result] = await pool.execute(
    `INSERT INTO vuot_link_tasks (campaign_id, worker_id, keyword, target_url, target_page, status, ip_address, user_agent, code_given, visitor_id, bot_detected, expires_at, worker_link_id, ref_worker_id, security_detail, is_over_limit) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?, ?, ?, ?)`,
    [campaign.id, taskWorkerId, selectedKeyword, selectedUrl, campaign.target_page || '', ip, ua, randomCode, visitorId || null, botDetected ? 1 : 0, expirySeconds, workerLinkId, refWorkerId, securityDetail, isOverLimit]
  );

  // ── Race-condition guard: recount sau INSERT để bắt concurrent requests ──
  // Chỉ đếm:
  //   (1) completed hôm nay
  //   (2) pending/active được tạo trong 5 PHÚT GẦN ĐÂY (đang thực sự làm)
  //       → KHÔNG đếm pending cũ bị bỏ dở/fail (tránh false-positive trên iOS khi IP rotate)
  // Bỏ qua check nếu worker có bonus_mode (IP hết lượt vẫn được phép làm)
  if (!workerBonusMode) {
    try {
      const newTaskId = result.insertId;
      const [rcIp] = await pool.execute(
        `SELECT (
          SELECT COUNT(*) FROM vuot_link_tasks
          WHERE ip_address = ? AND bot_detected = 0
            AND status = 'completed'
            AND completed_at >= ? AND completed_at <= ?
            AND id != ?
        ) + (
          SELECT COUNT(*) FROM vuot_link_tasks
          WHERE ip_address = ? AND bot_detected = 0
            AND status IN ('pending', 'step1', 'step2', 'step3')
            AND expires_at > NOW()
            AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            AND id != ?
        ) as cnt`,
        [ip, vnDayStart, vnDayEnd, result.insertId, ip, result.insertId]
      );
      if (Number(rcIp[0].cnt) >= maxViewsPerIp) {
        // Vượt limit do race — expire task vừa tạo và trả lỗi
        await pool.execute(`UPDATE vuot_link_tasks SET status = 'expired', expires_at = NOW() WHERE id = ?`, [result.insertId]);
        console.log(`[VuotLink] Race-condition limit: IP=${ip}, existing=${rcIp[0].cnt}, max=${maxViewsPerIp} → expired task ${result.insertId}`);
        return res.status(429).json({ error: `Bạn đã đạt giới hạn ${maxViewsPerIp} lượt/ngày. Vui lòng quay lại ngày mai.`, remaining: 0, maxViews: maxViewsPerIp });
      }
    } catch (rcErr) {
      console.error('[VuotLink] Race-condition check error:', rcErr.message);
      // Không block nếu check lỗi — tiếp tục bình thường
    }
  }

  let isTrustedWorker = false;
  const targetCheckId = refWorkerId || req.userId;
  if (targetCheckId) {
    try {
      const [usr] = await pool.execute('SELECT trusted FROM users WHERE id = ?', [targetCheckId]);
      if (usr.length && usr[0].trusted === 1) isTrustedWorker = true;
    } catch (_) { }
  }

  // Track view — fire-and-forget (không chặn response)
  ; (async () => {
    try {
      const [vLogs] = await pool.execute('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = ?', [campaign.id, todayVn]);
      if (vLogs.length > 0) {
        await pool.execute('UPDATE traffic_logs SET views = views + 1 WHERE id = ?', [vLogs[0].id]);
      } else {
        await pool.execute(
          'INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source) VALUES (?, ?, 1, 0, 1, ?)',
          [campaign.id, todayVn, campaign.traffic_type || 'google_search']
        );
      }
    } catch (_) { }
  })();

  // Await widget config (đã được khởi động sớm song song — thường đã xong rồi)
  const widgetConfig = await _widgetConfigPromise;

  const _tk = signTask(result.insertId, ip);

  const isDirect = (campaign.traffic_type || 'google_search') === 'direct';
  const isSocial = campaign.traffic_type === 'social';
  res.json({
    id: result.insertId,
    keyword: selectedKeyword,
    image1_url: selectedImage1,
    image2_url: selectedImage2,
    widgetConfig,
    traffic_type: campaign.traffic_type || 'google_search',
    ...((isDirect || isSocial) ? { target_url: selectedUrl } : {}),
    _tk,
    trusted: isTrustedWorker,
  });
}

router.put('/task/:id/step', optionalAuth, (req, res) => res.json({ ok: true }));
router.post('/task/:id/challenge-passed', optionalAuth, async (req, res) => {
  const ip = normalizeIp(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress);
  const ua = req.headers['user-agent'] || '';
  const { _tk, shakeLog } = req.body || {};

  if (!_tk || !verifyTaskToken(_tk, req.params.id, ip)) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  let dbTaskVisitorId = null;
  let task = null;
  try {
    const pool = getPool();
    const [tasks] = await pool.execute(
      'SELECT vt.id, vt.status, vt.expires_at, vt.created_at, vt.visitor_id, wl.slug as gatewaySlug FROM vuot_link_tasks vt LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id WHERE vt.id = ?',
      [req.params.id]
    );
    if (!tasks.length) return res.status(404).json({ error: 'Task không tồn tại' });
    task = tasks[0];
    if (task.status === 'completed') return res.status(400).json({ error: 'Task đã hoàn thành' });
    if (task.status === 'expired') return res.status(410).json({ error: 'Task đã hết hạn' });
    const [expCheck] = await pool.execute('SELECT NOW() > ? as expired', [task.expires_at]);
    if (expCheck[0]?.expired) return res.status(410).json({ error: 'Task đã hết hạn' });
    dbTaskVisitorId = task.visitor_id;
  } catch (e) {
    console.error('[VuotLink] challenge-passed DB error:', e.message);
    return res.status(500).json({ error: 'Lỗi server' });
  }

  try {
    const pool = getPool();
    const workerId = req.userId;
    if (workerId) {
      const [uRows] = await pool.execute('SELECT trusted FROM users WHERE id = ?', [workerId]);
      if (uRows[0]?.trusted === 1) {
        const ts = Date.now();
        const challengeToken = signChallengeToken(req.params.id, ip, ts);
        challengePassedStore[req.params.id] = { token: challengeToken, ts, ip };
        return res.json({ challengeToken, trusted: true });
      }
    }
  } catch (_) { }

  // ── [SERVER-SIDE] Time gate: task phải tồn tại ít nhất 3 giây ──
  // Không tin client — dùng created_at từ DB (server timestamp, không ai thay đổi được)
  // Bot script gọi ngay lập tức sau khi lấy task → age < 3s → bị chặn
  if (task.created_at) {
    const ageMs = Date.now() - new Date(task.created_at).getTime();
    if (ageMs < 3000) {
      console.log(`[VuotLink] Time gate: task #${req.params.id} age=${ageMs}ms < 3000ms → reject (instant bot)`);
      return res.status(429).json({ error: 'Quá nhanh, vui lòng thử lại.' });
    }
  }

  // console.log('[DEBUG ADB SHAKE] shakeLog received:', JSON.stringify(shakeLog));


  let detectedBotReason = null;
  // ── [SERVER-SIDE] Không tin UA — dùng sự hiện diện của shakeLog ──
  // Nếu client gửi shakeLog → mobile (lắc). Không có shakeLog → desktop (curve).
  // Trường hợp: UA=mobile nhưng shakeLog rỗng/thiếu → bị chặn
  const clientClaimsMobile = /mobi|android|iphone|ipad|ipod/i.test(ua);
  const isMobile = clientClaimsMobile; // giữ để tương thích log
  if (clientClaimsMobile) {
    if (!Array.isArray(shakeLog) || shakeLog.length < 8) {
      return res.status(403).json({ error: 'Thiếu dữ liệu xác minh cảm biến.' });
    }

    // ── [SERVER] Timestamp validation — không tin client time nhưng dùng để phát hiện replay ──
    const serverNow = Date.now();
    const logStart = Number(shakeLog[0]?.t || 0);
    const logEnd = Number(shakeLog[shakeLog.length - 1]?.t || 0);
    const logSpan = logEnd - logStart;

    if (logSpan < 800) {
      console.log(`[VuotLink] ShakeLog time span too short: ${logSpan}ms < 800ms (task #${req.params.id})`);
      return res.status(403).json({ error: 'Dữ liệu cảm biến không hợp lệ.' });
    }
    if (serverNow - logEnd > 300_000) {
      console.log(`[VuotLink] ShakeLog too old: ${serverNow - logEnd}ms (task #${req.params.id})`);
      return res.status(403).json({ error: 'Dữ liệu cảm biến đã hết hạn.' });
    }
    if (logEnd > serverNow + 10_000) {
      console.log(`[VuotLink] ShakeLog from future: logEnd=${logEnd}, now=${serverNow} (task #${req.params.id})`);
      return res.status(403).json({ error: 'Dữ liệu cảm biến không hợp lệ.' });
    }

    const EMULATOR_UA = /bluestacks|bstk|nox|ldplayer|memu|andy|genymotion|android.*x86_64|android.*x86;|com\.vphone|goldfish|ranchu/i;

    const rawEvents = shakeLog;
    const intervals = [];
    let zeroZCount = 0;

    for (let i = 1; i < rawEvents.length; i++) {
      intervals.push(rawEvents[i].t - rawEvents[i - 1].t);
      if ((rawEvents[i].az || 0) === 0) zeroZCount++;
    }

    const totals = rawEvents.map(s => Math.abs(s.ax || 0) + Math.abs(s.ay || 0) + Math.abs(s.az || 0));
    const maxTotal = Math.max(...totals);
    const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
    const forceVariance = totals.reduce((a, t) => a + (t - avgTotal) ** 2, 0) / totals.length;

    let intervalVariance = 0;
    let avgInterval = 0;
    if (intervals.length >= 10) {
      avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      intervalVariance = intervals.reduce((a, v) => a + (v - avgInterval) ** 2, 0) / intervals.length;
    }

    const deltaY = rawEvents.map(e => (e.ay || 0) - (e.ax || 0));
    const avgDeltaY = deltaY.reduce((a, b) => a + b, 0) / deltaY.length;
    const varDeltaY = deltaY.reduce((a, v) => a + (v - avgDeltaY) ** 2, 0) / deltaY.length;

    let identicalFrames = 0;
    for (let i = 1; i < rawEvents.length; i++) {
      if (rawEvents[i].ax === rawEvents[i - 1].ax && rawEvents[i].ay === rawEvents[i - 1].ay && rawEvents[i].az === rawEvents[i - 1].az) {
        identicalFrames++;
      }
    }
    const identicalRatio = identicalFrames / rawEvents.length;

    const ext = { taskId: req.params.id, gatewaySlug: task.gatewaySlug };

    if (EMULATOR_UA.test(ua)) {
      logSecurityEvent('Dùng trình duyệt của Giả lập (Bluestacks/Nox/LDPlayer...)', ip, ua, dbTaskVisitorId, { ua, reasons: ['Giả lập Android (BlueStacks/Nox/LDPlayer)'], ...ext });
      detectedBotReason = 'Giả lập Android';
    } else if (varDeltaY < 1) {
      logSecurityEvent('Dùng tool lắc cảm biến ảo (Trục X/Y song song)', ip, ua, dbTaskVisitorId, { varDeltaY, reasons: ['Cảm biến X/Y song song - Tool lắc ảo', `Độ lệch trục Y: ${varDeltaY.toFixed(4)}`], ...ext });
      detectedBotReason = 'Dữ liệu cảm biến không tự nhiên';
    } else if (identicalRatio > 0.25 && totals.length > 10) {
      logSecurityEvent('Dùng tool lắc tự động (Lỗi lặp khung hình PC)', ip, ua, dbTaskVisitorId, { identicalRatio, reasons: ['Dữ liệu cảm biến bị lặp khung hình (Bot giả lập điện thoại)', `Tỷ lệ frame lặp: ${(identicalRatio * 100).toFixed(1)}%`], ...ext });
      detectedBotReason = 'Can thiệp cảm biến';
    } else if (zeroZCount === rawEvents.length) {
      logSecurityEvent('Không có trọng lực Z (Dùng Tool trên Desktop)', ip, ua, dbTaskVisitorId, { reasons: ['Không có dữ liệu trọng lực trục Z', 'Desktop giả lập cảm biến điện thoại'], ...ext });
      detectedBotReason = 'Dữ liệu cảm biến không hợp lệ';
    } else if (intervals.length >= 10 && intervalVariance < 0.1 && avgInterval > 0) {
      logSecurityEvent('Dùng Tool Macro/Auto Click (Nhịp độ quá đều)', ip, ua, dbTaskVisitorId, { intervalVariance, avgInterval, reasons: ['Nhịp lắc quá đều - Macro/Auto-click', `Độ lệch nhịp: ${intervalVariance.toFixed(4)}, TB: ${avgInterval.toFixed(1)}ms`], ...ext });
      detectedBotReason = 'Tín hiệu cảm biến bất thường';
    } else if (maxTotal < 15) {
      detectedBotReason = 'Lực cảm biến thiếu';
    } else if (forceVariance < 0.5 && rawEvents.length >= 5) {
      logSecurityEvent('Lắc bằng máy tĩnh / Điện thoại đặt cố định', ip, ua, dbTaskVisitorId, { forceVariance, reasons: ['Lực cảm biến quá đều - máy đặt cố định hoặc robot', `Phương sai lực: ${forceVariance.toFixed(4)}`], ...ext });
      detectedBotReason = 'Tín hiệu lực quá đều tăm tắp';
    }
  } else {
    const curveLog = shakeLog;
    if (!Array.isArray(curveLog) || curveLog.length < 10) {
      return res.status(403).json({ error: 'Thiếu dữ liệu xác minh trỏ chuột.' });
    }
    const points = curveLog.slice(0, 50);

    const speeds = [];
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1], p2 = points[i];
      const dt = Math.max(p2.t - p1.t, 1);
      const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      speeds.push(dist / dt);
    }

    if (speeds.length >= 5) {
      const avgSpd = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const spdVar = speeds.reduce((a, s) => a + (s - avgSpd) ** 2, 0) / speeds.length;
      if (spdVar < 0.0001 && avgSpd > 0.05) {
        logSecurityEvent('Dùng Tool kéo chuột tự động (Auto Mouse)', ip, ua, dbTaskVisitorId, { spdVar, reasons: ['Chuyển động chuột tuyến tính - Auto Mouse/Bot', `Độ lệch tốc độ: ${spdVar.toFixed(6)}, TB: ${avgSpd.toFixed(2)} px/ms`], taskId: req.params.id, gatewaySlug: task.gatewaySlug });
        detectedBotReason = 'Chuyển động chuột bất thường';
      }
    }
  }

  if (detectedBotReason) {
    try {
      const pool = getPool();
      await pool.execute('UPDATE vuot_link_tasks SET bot_detected = 1 WHERE id = ?', [req.params.id]);
    } catch (e) { }
  }

  const ts = Date.now();
  const challengeToken = signChallengeToken(req.params.id, ip, ts);
  challengePassedStore[req.params.id] = { token: challengeToken, ts, ip };

  // Lưu vào DB — để vẫn hoạt động sau khi PM2 restart (challengePassedStore sẽ trống)
  try {
    const pool = getPool();
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step1' WHERE id = ? AND status = 'pending'", [req.params.id]);
  } catch (e) { console.error('[VuotLink] challenge-passed step1 update error:', e.message); }

  res.json({ challengeToken });
});

router.post('/task/:id/verify', optionalAuth, async (req, res) => {
  const pool = getPool();
  const { code, _tk, challengeToken } = req.body;
  const ip = normalizeIp(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress);
  if (!_tk || !verifyTaskToken(_tk, req.params.id, ip)) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  if (!code || code.trim().length < 4) {
    return res.status(400).json({ error: 'Mã xác nhận không hợp lệ' });
  }
  const [tasks] = await pool.execute('SELECT * FROM vuot_link_tasks WHERE id = ?', [req.params.id]);
  if (tasks.length === 0) return res.status(404).json({ error: 'Task không tồn tại' });
  const task = tasks[0];

  const taskIdStr = String(req.params.id);

  let isTrustedWorker = false;
  const targetCheckId = task.ref_worker_id || task.worker_id || req.userId;
  if (targetCheckId) {
    try {
      const [tRows] = await pool.execute('SELECT trusted FROM users WHERE id = ?', [targetCheckId]);
      isTrustedWorker = tRows[0]?.trusted === 1;
    } catch (_) { }
  }

  if (!isTrustedWorker) {
    const cpEntry = challengePassedStore[taskIdStr];
    if (!cpEntry) {
      // Fallback DB: nếu challengePassedStore đã bị xóa (PM2 restart) nhưng task đã qúa bước challenge
      if (!['step1', 'step2', 'step3'].includes(task.status)) {
        return res.status(403).json({ error: 'Bạn chưa hoàn thành bước xác minh người thật.' });
      }
      // DB fallback: đã step1 → dùng challengeToken để verify hướng khác (bỏ qua store check)
      console.log(`[VuotLink] challengePassedStore miss — using DB fallback for task #${taskIdStr} (status=${task.status})`);
    } else if (cpEntry.token !== challengeToken || cpEntry.ip !== ip) {
      return res.status(403).json({ error: 'Token xác minh không hợp lệ.' });
    } else {
      delete challengePassedStore[taskIdStr];
    }
  }

  if (task.status === 'completed') return res.status(400).json({ error: 'Task đã hoàn thành' });
  if (task.status === 'expired') return res.status(410).json({ error: 'Task đã hết hạn. Vui lòng lấy nhiệm vụ mới.' });

  const validStatuses = ['pending', 'step1', 'step2', 'step3'];
  if (!validStatuses.includes(task.status)) {
    return res.status(403).json({ error: 'Trạng thái task không hợp lệ: ' + task.status });
  }
  if (task.status !== 'step3') {
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step3' WHERE id = ?", [task.id]);
  }

  const { visitorId: verifyVid } = req.body || {};
  const ipOk = task.ip_address && normalizeIp(task.ip_address) === ip;
  const vidOk = task.visitor_id && verifyVid && task.visitor_id === verifyVid;
  if (!ipOk && !vidOk) {
    console.log(`[VuotLink] verify session check: task.ip=${task.ip_address} normTask=${normalizeIp(task.ip_address || '')} req.ip=${ip} vidOk=${vidOk}`);
    return res.status(403).json({ error: 'Phien khong hop le' });
  }

  if (task.expires_at) {
    const [expCheck] = await pool.execute('SELECT NOW() > ? as expired', [task.expires_at]);
    if (expCheck[0]?.expired) {
      await pool.execute("UPDATE vuot_link_tasks SET status = 'expired' WHERE id = ?", [task.id]);
      return res.status(410).json({ error: 'Task đã hết hạn' });
    }
  }

  if (code.trim().toUpperCase() !== (task.code_given || '').toUpperCase()) {
    return res.status(400).json({ error: 'Mã xác nhận không đúng. Vui lòng kiểm tra lại.' });
  }

  const [campaigns] = await pool.execute('SELECT cpc, budget, total_views, daily_views, user_id, traffic_type, time_on_site, version, name, discount_applied FROM campaigns WHERE id = ?', [task.campaign_id]);
  if (campaigns.length === 0) return res.status(404).json({ error: 'Campaign không tồn tại' });
  const campaign = campaigns[0];

  // workerIdForBonus: dùng cho log và commission referral
  const workerIdForBonus = task.ref_worker_id || task.worker_id;
  // Lưu ý: Không cần check bonus_mode ở đây nữa.
  // "is_over_limit" đã được lưu vào task khi tạo → dùng task.is_over_limit để quyết định earning.

  let buyerCpc = campaign.cpc || 0;
  try {
    const duration = (campaign.time_on_site || '60').split('-')[0] + 's';
    const [bptRows] = await pool.execute(
      'SELECT v1_price, v2_price, v1_discount, v2_discount FROM pricing_tiers WHERE traffic_type = ? AND duration = ?',
      [campaign.traffic_type || 'google_search', duration]
    );
    if (bptRows.length > 0) {
      const tier = bptRows[0];
      const hasDiscount = campaign.discount_applied === 1;
      if (campaign.version === 2) {
        buyerCpc = hasDiscount && tier.v2_discount > 0 ? tier.v2_discount : tier.v2_price;
      } else {
        buyerCpc = hasDiscount && tier.v1_discount > 0 ? tier.v1_discount : tier.v1_price;
      }
    } else {
      // ⚠️ Không tìm thấy pricing tier → fallback về cpc cũ trong bảng campaigns
      // Có thể gây tính phí sai nếu bảng giá chưa được cấu hình đúng
      console.warn(`[VuotLink] ⚠️ No pricing tier found for type=${campaign.traffic_type || 'google_search'}, duration=${duration} → fallback to campaign.cpc=${buyerCpc} (campaign #${task.campaign_id})`);
    }
  } catch (e) {
    console.error('[VuotLink] Buyer CPC lookup error:', e.message);
  }
  console.log(`[VuotLink] buyerCpc=${buyerCpc} (discount=${campaign.discount_applied}, cpc_col=${campaign.cpc}, campaign=#${task.campaign_id})`);

  // NOTE: Không check balance ở đây nữa — sẽ dùng atomic UPDATE bên dưới (tránh race condition)

  // ── Worker earning: lấy từ nhóm giá của worker ──
  let earning = 0;
  try {
    const duration = (campaign.time_on_site || '60').split('-')[0] + 's';
    // Ưu tiên: chủ gateway link (worker_link_id) → ref_worker_id → worker_id trực tiếp
    // KHÔNG dùng req.userId vì user đang đăng nhập có thể vượt link của người khác
    let workerIdToCheck = task.ref_worker_id || task.worker_id || null;
    // Nếu là gateway link, phải lấy worker_id từ bảng worker_links (chủ link)
    if (task.worker_link_id && !workerIdToCheck) {
      try {
        const [wlPriceRows] = await pool.execute('SELECT worker_id FROM worker_links WHERE id = ?', [task.worker_link_id]);
        if (wlPriceRows.length > 0) workerIdToCheck = wlPriceRows[0].worker_id;
      } catch (_) { }
    }
    if (workerIdToCheck) {
      const [pgRows] = await pool.execute(
        `SELECT r.v1_price, r.v2_price FROM users u
         JOIN worker_pricing_group_rates r ON r.group_id = u.pricing_group_id
         WHERE u.id = ? AND r.traffic_type = ? AND r.duration = ?
         LIMIT 1`,
        [workerIdToCheck, campaign.traffic_type || 'google_search', duration]
      );
      if (pgRows.length > 0) {
        earning = campaign.version === 2 ? pgRows[0].v2_price : pgRows[0].v1_price;
        console.log(`[VuotLink] Group pricing: worker=${workerIdToCheck}, earning=${earning}`);
      } else {
        console.log(`[VuotLink] Worker ${workerIdToCheck} has no pricing group — earning=0`);
      }
    }
  } catch (e) {
    console.error('[VuotLink] Worker pricing lookup error:', e.message);
  }

  const timeOnSite = Math.floor((Date.now() - new Date(task.created_at).getTime()) / 1000);

  // Detect country from IP
  let ipCountry = null;
  try {
    const ip = task.ip_address || '';
    const cleanIp = ip.replace(/^::ffff:/, '');
    const geo = geoip.lookup(cleanIp);
    if (geo && geo.country) ipCountry = geo.country;
  } catch (_) { }

  // Kiểm tra bot: chỉ dùng bot_detected flag (set bởi challenge-passed route).
  // KHÔNG dùng security_detail.includes('flagged') vì JSON string luôn chứa key "flagged"
  // ngay cả khi value là false → false positive làm buyer không bị trừ tiền nhưng view cũng không đếm.
  const isBotUser = task.bot_detected === 1;
  if (isBotUser) {
    buyerCpc = 0;
    earning = 0;
  }

  // View vượt giới hạn (bonus mode): buyer VẪN bị trừ tiền bình thường, chỉ worker không được trả
  // View hợp lệ (is_over_limit = 0): cộng tiền bình thường dù worker có bonus_mode
  if (task.is_over_limit === 1 && !isBotUser) {
    console.log(`[VuotLink] OVER LIMIT VIEW: worker=${workerIdForBonus}, task=${task.id} — buyer CHARGED normally, worker NOT paid (bonus mode over-limit)`);
    earning = 0; // Worker không được trả vì view vượt giới hạn
    // buyerCpc giữ nguyên — buyer vẫn bị trừ tiền
  }

  // ── Atomic daily limit guard ──
  // Nếu camp có daily_views và worker KHÔNG phải bonus/over_limit:
  //   Chỉ mark completed khi today_done < daily_views (đếm ngay tại thời điểm UPDATE)
  //   → MySQL đảm bảo atomic: không bao giờ vượt daily limit dù 100 worker cùng lúc
  const campDailyViews = Number(campaign.daily_views) || 0;
  const needsDailyGuard = campDailyViews > 0 && task.is_over_limit !== 1 && !isBotUser;

  let taskMarkedCompleted = false;
  if (needsDailyGuard) {
    const vnDayStartVerify = `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())} 00:00:00`;
    const vnDayEndVerify = `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())} 23:59:59`;
    const [markResult] = await pool.execute(
      `UPDATE vuot_link_tasks
       SET status = 'completed', completed_at = NOW(), time_on_site = ?, earning = ?, ip_country = ?
       WHERE id = ?
         AND (
           SELECT COUNT(*) FROM vuot_link_tasks t2
           WHERE t2.campaign_id = ? AND t2.status = 'completed'
             AND t2.bot_detected = 0 AND t2.is_over_limit = 0
             AND t2.completed_at >= ? AND t2.completed_at <= ?
         ) < ?`,
      [timeOnSite, earning, ipCountry, task.id, task.campaign_id, vnDayStartVerify, vnDayEndVerify, campDailyViews]
    );
    taskMarkedCompleted = markResult.affectedRows > 0;
    if (!taskMarkedCompleted) {
      // Daily limit đã đủ tại thời điểm verify → đánh dấu expired, không cộng view
      await pool.execute(
        `UPDATE vuot_link_tasks SET status = 'expired', expires_at = NOW(), earning = 0 WHERE id = ? AND status != 'completed'`,
        [task.id]
      );
      console.log(`[VuotLink] Daily limit atomic guard: campaign ${task.campaign_id} daily_views=${campDailyViews} already full → task ${task.id} expired (race)`);
      return res.status(429).json({ error: 'Chiến dịch đã đạt giới hạn view hôm nay. Vui lòng thử nhiệm vụ khác.', code: 'DAILY_LIMIT_FULL' });
    }
  } else {
    await pool.execute(
      `UPDATE vuot_link_tasks SET status = 'completed', completed_at = NOW(), time_on_site = ?, earning = ?, ip_country = ? WHERE id = ?`,
      [timeOnSite, earning, ipCountry, task.id]
    );
    taskMarkedCompleted = true;
  }

  if (!isBotUser) {
    await pool.execute('UPDATE campaigns SET views_done = COALESCE(views_done, 0) + 1 WHERE id = ?', [task.campaign_id]);
    await pool.execute(
      `UPDATE campaigns SET status = 'completed' WHERE id = ? AND views_done >= total_views AND status != 'completed'`,
      [task.campaign_id]
    );

    const ua = (task.user_agent || '').toLowerCase();
    const isTablet = /ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(ua);
    const isMobile = !isTablet && /mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua);
    const deviceCol = isTablet ? 'tablet_views' : isMobile ? 'mobile_views' : 'desktop_views';

    // ── Cập nhật traffic_logs (dùng VN timezone tránh lệch CURDATE UTC) ──
    const vnDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const [logs] = await pool.execute('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = ?', [task.campaign_id, vnDate]);
    if (logs.length > 0) {
      await pool.execute(`UPDATE traffic_logs SET clicks = COALESCE(clicks, 0) + 1, views = COALESCE(views, 0) + 1, ${deviceCol} = COALESCE(${deviceCol}, 0) + 1 WHERE id = ?`, [logs[0].id]);
    } else {
      await pool.execute(
        `INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source, ${deviceCol}) VALUES (?, ?, 1, 1, 1, ?, 1)`,
        [task.campaign_id, vnDate, campaign.traffic_type || 'google_search']
      );
    }
  }

  // ── Trừ tiền buyer: atomic UPDATE tránh race condition ──
  // Điều kiện AND balance >= buyerCpc đảm bảo không bao giờ âm số dư
  // dù nhiều worker verify cùng lúc (không cần SELECT trước)
  if (buyerCpc > 0) {
    const [deductResult] = await pool.execute(
      "UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = 'main' AND balance >= ?",
      [buyerCpc, campaign.user_id, buyerCpc]
    );
    if (deductResult.affectedRows === 0) {
      // Ví không còn đủ tiền (race condition hoặc hết budget) → auto-pause + ghi log thất bại
      console.warn(`[VuotLink] ⚠️ Wallet insufficient (atomic): buyer=${campaign.user_id}, campaign=#${task.campaign_id}, required=${buyerCpc} — view COUNTED but buyer NOT charged`);
      await pool.execute(
        "UPDATE campaigns SET status = 'paused', pause_reason = 'Số dư không đủ' WHERE id = ? AND status = 'running'",
        [task.campaign_id]
      ).catch(() => pool.execute("UPDATE campaigns SET status = 'paused' WHERE id = ? AND status = 'running'", [task.campaign_id]));
      // Ghi transaction thất bại để admin có thể audit (view đã completed nhưng không trừ tiền được)
      try {
        const failRef = 'VW-FAIL-' + Date.now();
        await pool.execute(
          `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, 'main', 'campaign', 'system', ?, 'failed', ?, ?)`,
          [campaign.user_id, buyerCpc, failRef, `[Ví không đủ tiền] Lượt xem chiến dịch "${campaign.name}" (#${task.campaign_id}) - task #${task.id}`]
        );
      } catch (txErr) {
        console.error('[VuotLink] Failed to log insufficient deduction transaction:', txErr.message);
      }
    } else {
      const buyerRef = 'VW-' + Date.now();
      await pool.execute(
        `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, 'main', 'campaign', 'system', ?, 'completed', ?, ?)`,
        [campaign.user_id, buyerCpc, buyerRef, `Lượt xem chiến dịch "${campaign.name}" (#${task.campaign_id})`]
      );
    }
  }

  // ── Cộng tiền worker (theo giá set) ──
  // paidWorkerId = worker thực sự được nhận tiền (để tính hoa hồng referral)
  let paidWorkerId = null;

  if (task.worker_id && !task.worker_link_id && earning > 0) {
    // Case 1: Task trực tiếp từ worker
    paidWorkerId = task.worker_id;
    await ensureWalletCredit(pool, task.worker_id, 'earning', earning);
    const refCode = 'VL-' + Date.now();
    await pool.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
       VALUES (?, 'earning', 'earning', 'system', ?, 'completed', ?, ?)`,
      [task.worker_id, earning, refCode, `${task.keyword || 'Vượt link'} - ${campaign.name} #${task.id}`]
    );
  }

  // Pay gateway link creator
  let destinationUrl = null;
  let gatewaySlug = null;
  if (task.worker_link_id) {
    try {
      const [wlRows] = await pool.execute('SELECT * FROM worker_links WHERE id = ?', [task.worker_link_id]);
      if (wlRows.length) {
        const wl = wlRows[0];
        destinationUrl = wl.destination_url;
        gatewaySlug = wl.slug || null;
        paidWorkerId = wl.worker_id; // Case 2: Gateway link

        if (earning > 0) {
          await ensureWalletCredit(pool, wl.worker_id, 'earning', earning);
          await pool.execute(
            'UPDATE worker_links SET completed_count = completed_count + 1, earning = earning + ? WHERE id = ?',
            [earning, wl.id]
          );
          const refCode = 'GL-' + Date.now();
          await pool.execute(
            `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
             VALUES (?, 'earning', 'earning', 'gateway_link', ?, 'completed', ?, ?)`,
            [wl.worker_id, earning, refCode, `${task.keyword || 'Gateway link'} - ${campaign.name} #${task.id}`]
          );
        } else {
          await pool.execute('UPDATE worker_links SET completed_count = completed_count + 1 WHERE id = ?', [wl.id]);
        }
      }
    } catch (e) { console.error('[VuotLink] Gateway link pay error:', e.message); }
  }

  // ── Ref link mode: cộng % earning cho worker ref ──
  // KHÔNG set paidWorkerId ở đây để tránh trigger hoa hồng lần 2
  if (!paidWorkerId && task.ref_worker_id && earning > 0) {
    try {
      const [refCommSetting] = await pool.execute(
        "SELECT setting_value FROM site_settings WHERE setting_key = 'referral_commission_worker'"
      );
      const refCommPct = Number(refCommSetting[0]?.setting_value || 0);
      const refEarning = refCommPct > 0 ? Math.floor(earning * refCommPct / 100) : 0;
      if (refEarning > 0) {
        await ensureWalletCredit(pool, task.ref_worker_id, 'earning', refEarning);
        const refTxCode = 'RL-' + Date.now();
        await pool.execute(
          `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
           VALUES (?, 'earning', 'earning', 'ref_link', ?, 'completed', ?, ?)`,
          [task.ref_worker_id, refEarning, refTxCode,
          `Hoa hong ref ${refCommPct}% - ${task.keyword || 'Vượt link'} #${task.id} (${earning} đ)`]
        );
        console.log(`[VuotLink] Ref earning: paid ${refEarning} to ref_worker_id=${task.ref_worker_id} (${refCommPct}% of ${earning})`);
        // Ref link không trigger hoa hồng referral thêm lần nữa
      }
    } catch (e) { console.error('[VuotLink] Ref link earning error:', e.message); }
  }

  // ── Hoa hồng referral: cộng % cho người đã ref paidWorker (Case 1 & 2 only) ──
  // Chỉ chạy khi paidWorkerId được set (task trực tiếp hoặc gateway link)
  // KHÔNG chạy cho ref_link để tránh double-commission
  if (paidWorkerId && earning > 0) {
    try {
      const [refRows] = await pool.execute('SELECT referred_by FROM users WHERE id = ?', [paidWorkerId]);
      const referrerId = refRows[0]?.referred_by;
      if (referrerId) {
        const [commSetting] = await pool.execute(
          "SELECT setting_value FROM site_settings WHERE setting_key = 'referral_commission_worker'"
        );
        const commPct = Number(commSetting[0]?.setting_value || 0);
        if (commPct > 0) {
          const commAmount = Math.floor(earning * commPct / 100);
          if (commAmount > 0) {
            await ensureWalletCredit(pool, referrerId, 'commission', commAmount);
            const commRef = `COMM-WORKER-${Date.now()}`;
            await pool.execute(
              `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
               VALUES (?, 'commission', 'commission', 'referral', ?, 'completed', ?, ?)`,
              [referrerId, commAmount, commRef, `Hoa hong ${commPct}% tu worker #${paidWorkerId} - task #${task.id} (${earning} d)`]
            );
            console.log(`[Commission] Paid ${commAmount} to referrer ${referrerId} for worker ${paidWorkerId}`);
          }
        }
      }
    } catch (e) { console.error('[VuotLink] Worker referral commission error:', e.message, e.stack); }
  }

  console.log(`[VuotLink] Task #${task.id} VERIFIED — code=${code}, earning=${earning}`);

  // Chỉ log security event khi phát hiện bot thực sự (không log phiên bình thường)
  try {
    let secDetail = {};
    try { secDetail = JSON.parse(task.security_detail || '{}'); } catch { }
    const flagged = (secDetail.assessments || []).some(a => a.flagged);
    const isBotTask = task.bot_detected == 1;
    if (flagged || isBotTask) {
      const DL_VI = {
        headless_or_webdriver: 'Headless / Webdriver tự động',
        Fingerprint_bot: 'Fingerprint Bot',
        ip_rate_limit: 'Rate limit IP',
        bot_ua: 'User-Agent Bot',
        font_os_mismatch: 'Font/OS không khớp',
        screen_window_mismatch: 'Screen=Window (Headless)',
        hardware_inconsistency: 'Phần cứng bất thường',
        canvas_noise_detected: 'Canvas Noise (Anti-detect browser)',
        click_latency_anomaly: 'Click bất thường (Bot click)',
        scroll_speed_bot: 'Cuộn quá nhanh (Bot)',
        fake_sensor: 'Cảm biến giả (Desktop→Mobile)',
        canvas_api_lied: 'Canvas API bị giả mạo',
        audio_api_lied: 'Audio API bị giả mạo',
        navigator_api_lied: 'Navigator bị giả mạo',
        webgl_api_lied: 'WebGL bị giả mạo',
        creepjs_bot: 'CreepJS phát hiện Bot',
        creepjs_headless: 'CreepJS phát hiện Headless',
        widget_bot_detected: 'Widget: Bot phát hiện',
        widget_bot: 'Widget Bot',
      };

      const specificReasons = [];
      if (secDetail.reasons && secDetail.reasons.length > 0) {
        specificReasons.push(...secDetail.reasons.slice(0, 3));
      }
      if (secDetail.detectionLog && secDetail.detectionLog.length > 0) {
        secDetail.detectionLog.slice(0, 3).forEach(key => {
          const label = DL_VI[key] || key;
          if (!specificReasons.some(r => r.toLowerCase().includes(label.toLowerCase()))) {
            specificReasons.push(label);
          }
        });
      }

      const logReason = specificReasons.length > 0
        ? specificReasons[0] + (specificReasons.length > 1 ? ' (+' + (specificReasons.length - 1) + ' ly do)' : '')
        : 'Phat hien Bot';

      logSecurityEvent(logReason, task.ip_address, task.user_agent, task.visitor_id, {
        taskId: task.id,
        source: 'vuotlink',
        campaignId: task.campaign_id,
        targetUrl: task.target_url || null,
        workerLinkId: task.worker_link_id || null,
        gatewaySlug: gatewaySlug,
        timeOnSite,
        earning,
        ipCountry,
        detectionLog: secDetail.detectionLog || [],
        reasons: specificReasons,
        deviceScore: secDetail.deviceScore ?? null,
        deviceType: secDetail.deviceType || null,
        automationFlags: secDetail.detail && secDetail.detail.automation || null,
        canvasHash: secDetail.canvasHash || null,
        audioHash: secDetail.audioHash || null,
        creepSummary: secDetail.creepSummary || null,
      });
    }
  } catch (e) { }

  let remaining = 0;
  let maxViews = 2;
  try {
    const [limitSetting] = await pool.execute("SELECT setting_value FROM site_settings WHERE setting_key = 'views_per_ip'");
    const parsedMax = limitSetting.length > 0 ? parseInt(limitSetting[0].setting_value) : 0;
    maxViews = parsedMax > 0 ? parsedMax : 5;

    // Dùng VN timezone (nhất quán với phần lấy task) — tránh bug UTC vs VN
    const vnNow = new Date();
    const vnDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(vnNow);
    const vnStart = `${vnDateStr} 00:00:00`;
    const vnEnd = `${vnDateStr} 23:59:59`;

    // Count completed tasks today for this IP
    const [ipDone] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE ip_address = ? AND completed_at >= ? AND completed_at <= ? AND status = 'completed' AND bot_detected = 0`,
      [ip, vnStart, vnEnd]
    );
    let vidDone = 0;
    if (task.visitor_id && task.visitor_id !== 'unknown') {
      const [vDone] = await pool.execute(
        `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE visitor_id = ? AND completed_at >= ? AND completed_at <= ? AND status = 'completed' AND bot_detected = 0`,
        [task.visitor_id, vnStart, vnEnd]
      );
      vidDone = vDone[0].cnt;
    }
    const usedToday = Math.max(ipDone[0].cnt, vidDone);
    remaining = Math.max(0, maxViews - usedToday);
  } catch (e) { console.error('[VuotLink] Remaining calc error:', e.message); }

  res.json({ success: true, earning, remaining, maxViews, destination_url: destinationUrl });
  // Invalidate cache sau khi task completed — để request tiếp theo lấy pool mới
  try {
    const workerIdToInvalidate = task.worker_id || (task.worker_link_id ? paidWorkerId : null);
    if (workerIdToInvalidate) {
      cache.invalidate('worker:balance:' + workerIdToInvalidate);
      cache.invalidatePrefix('worker:stats:' + workerIdToInvalidate);
      cache.invalidatePrefix('worker:earnings:' + workerIdToInvalidate + ':');
    }
    if (campaign && campaign.user_id) cache.invalidate('reports:overview:' + campaign.user_id);
    cache.invalidatePrefix('admin:overview:');
  } catch (e) { }
});

router.post('/task/:id/complete', optionalAuth, async (req, res) => {
  req.body.code = req.body.code || '';
  return res.status(400).json({ error: 'Vui lòng sử dụng flow xác nhận mã mới.' });
});

const SECRET_API_KEY = process.env.SECRET_API_KEY || 'CHANGE_ME_IN_ENV';

function secretApiAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key || '';
  if (!key || key !== SECRET_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

async function _secretLookup(req, res) {
  try {
    const pool = getPool();
    const keyword = req.query.keyword || (req.body || {}).keyword || '';
    let image_url = req.query.image_url || (req.body || {}).image_url || '';

    if (image_url && image_url.includes('/uploads')) {
      image_url = image_url.substring(image_url.indexOf('/uploads'));
    }

    if (!keyword && !image_url) {
      return res.status(400).json({ error: 'Cần truyền ít nhất keyword hoặc image_url' });
    }

    // Build dynamic query
    let conditions = [`c.status IN ('running', 'paused', 'completed')`];
    let params = [];

    if (keyword) {
      // Search keyword: exact match OR JSON array contains
      conditions.push(`(c.keyword = ? OR c.keyword LIKE ? OR c.keyword LIKE ?)`);
      params.push(keyword, `%"${keyword}"%`, `%${keyword}%`);
    }

    if (image_url) {
      // Search image in image1_url or image2_url
      conditions.push(`(c.image1_url LIKE ? OR c.image2_url LIKE ? OR c.image1_url = ? OR c.image2_url = ?)`);
      params.push(`%${image_url}%`, `%${image_url}%`, image_url, image_url);
    }

    const [campaigns] = await pool.execute(
      `SELECT c.id, c.name, c.url, c.url2, c.keyword, c.target_page, c.traffic_type,
              c.image1_url, c.image2_url, c.status, c.views_done, c.total_views,
              c.time_on_site, c.version, c.daily_views, c.created_at
       FROM campaigns c
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.created_at DESC
       LIMIT 1`,
      params
    );

    if (campaigns.length === 0) {
      return res.type('text').status(404).send('NOT_FOUND');
    }

    // Collect all URLs from campaign (url + url2, both can be JSON arrays)
    const c = campaigns[0];
    const allUrls = [];
    const parseUrls = (val) => {
      if (!val) return;
      try { const a = JSON.parse(val); if (Array.isArray(a)) { allUrls.push(...a.filter(Boolean)); return; } } catch { }
      allUrls.push(val);
    };
    parseUrls(c.url);
    parseUrls(c.url2);

    if (allUrls.length === 0) {
      return res.type('text').status(404).send('NO_URL');
    }

    // Pick random URL and return as plain text
    const picked = allUrls[Math.floor(Math.random() * allUrls.length)];
    res.type('text').send(picked);
  } catch (err) {
    console.error('[SecretAPI] Lookup error:', err.message);
    res.type('text').status(500).send('ERROR');
  }
}
router.get('/secret/lookup', secretApiAuth, _secretLookup);
router.get('/secret/campaigns', secretApiAuth, _secretLookup); // alias


/* ═════════════════════════════════════════════════════════
   PROTECTED endpoints
═════════════════════════════════════════════════════════ */
router.use(authMiddleware);

router.get('/stats', async (req, res) => {
  const pool = getPool();
  const [total] = await pool.execute(
    `SELECT COUNT(*) as total,
      SUM(CASE WHEN vt.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN vt.status IN ('pending','assigned','step1','step2','step3') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN vt.status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN vt.status = 'completed' THEN vt.earning ELSE 0 END) as totalEarning
    FROM vuot_link_tasks vt JOIN campaigns c ON c.id = vt.campaign_id WHERE c.user_id = ?`,
    [req.userId]
  );

  const [recent] = await pool.execute(
    `SELECT vt.*, c.name as campaign_name FROM vuot_link_tasks vt JOIN campaigns c ON c.id = vt.campaign_id WHERE c.user_id = ? ORDER BY vt.created_at DESC LIMIT 20`,
    [req.userId]
  );

  res.json({ stats: total[0], recent });
});

/* ═══════════════════════════════════════════════════════════
   WORKER DASHBOARD APIs (require auth)
═══════════════════════════════════════════════════════════ */

// GET /api/vuot-link/worker/stats
router.get('/worker/stats', authMiddleware, async (req, res) => {
  try {
    const uid = req.userId;
    const data = await cache.get(
      `worker:stats:${uid}`,
      async () => {
        const pool = getPool();
        const [wLinks] = await pool.execute('SELECT id FROM worker_links WHERE worker_id = ?', [uid]);
        const wlIds = wLinks.map(w => w.id);
        const wlCond = wlIds.length > 0
          ? '(worker_id = ? OR worker_link_id IN (' + wlIds.map(() => '?').join(',') + '))'
          : 'worker_id = ?';
        const wlParams = wlIds.length > 0 ? [uid, ...wlIds] : [uid];
        const wlCondT = wlCond.replace(/worker_id/g, 't.worker_id').replace(/worker_link_id/g, 't.worker_link_id');

        const vnToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
        const todayStart = vnToday + ' 00:00:00';
        const todayEnd = vnToday + ' 23:59:59';
        const d7 = new Date(); d7.setDate(d7.getDate() - 7);
        const sevenAgo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d7) + ' 00:00:00';

        const [todayR, totalR, pendingR, walletR, chartR, recentR, remR] = await Promise.all([
          pool.execute('SELECT COUNT(*) as cnt, COALESCE(SUM(earning),0) as earn FROM vuot_link_tasks WHERE ' + wlCond + " AND status = 'completed' AND bot_detected = 0 AND is_over_limit = 0 AND completed_at >= ? AND completed_at <= ?", [...wlParams, todayStart, todayEnd]),
          pool.execute('SELECT COUNT(*) as cnt, COALESCE(SUM(earning),0) as earn FROM vuot_link_tasks WHERE ' + wlCond + " AND status = 'completed' AND bot_detected = 0 AND is_over_limit = 0 AND completed_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)", wlParams),
          pool.execute('SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE ' + wlCond + " AND status IN ('pending','step1','step2','step3')", wlParams),
          pool.execute('SELECT type, balance FROM wallets WHERE user_id = ?', [uid]),
          pool.execute('SELECT DATE(completed_at) as day, COUNT(*) as tasks, COALESCE(SUM(earning),0) as earn FROM vuot_link_tasks WHERE ' + wlCond + " AND status = 'completed' AND bot_detected = 0 AND completed_at >= ? AND completed_at <= ? GROUP BY DATE(completed_at) ORDER BY day", [...wlParams, sevenAgo, todayEnd]),
          pool.execute('SELECT t.id, c.name as campaign_name, t.status, t.earning, t.completed_at, t.created_at FROM vuot_link_tasks t JOIN campaigns c ON t.campaign_id = c.id WHERE ' + wlCondT + " AND (t.bot_detected = 0 OR t.status != 'completed') ORDER BY t.created_at DESC LIMIT 10", wlParams),
          pool.execute("SELECT COALESCE(SUM(c.daily_views),0) as total_daily, COALESCE(SUM(LEAST(COALESCE(td.done,0),c.daily_views)),0) as today_done FROM campaigns c LEFT JOIN (SELECT campaign_id, COUNT(*) as done FROM vuot_link_tasks WHERE status = 'completed' AND bot_detected = 0 AND is_over_limit = 0 AND completed_at >= ? AND completed_at <= ? GROUP BY campaign_id) td ON td.campaign_id = c.id WHERE c.status = 'running' AND c.daily_views > 0", [todayStart, todayEnd]),
        ]);

        const walletMap = {};
        walletR[0].forEach(w => { walletMap[w.type] = Number(w.balance); });
        return {
          today: { tasks: todayR[0][0].cnt, earnings: Number(todayR[0][0].earn) },
          total: { tasks: totalR[0][0].cnt, earnings: Number(totalR[0][0].earn) },
          pending: pendingR[0][0].cnt,
          remainingDailyViews: Math.max(0, Number(remR[0][0].total_daily) - Number(remR[0][0].today_done)),
          balance: walletMap.earning || 0,
          commissionBalance: walletMap.commission || 0,
          chart: chartR[0],
          recent: recentR[0],
        };
      },
      30 * 1000,  // 30s TTL — đủ real-time cho dashboard
      20 * 1000   // stale-while-revalidate: refresh background sau 20s
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vuot-link/worker/tasks?page=1&status=completed
router.get('/worker/tasks', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const uid = req.userId;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';

    // Get worker's link IDs for gateway tasks
    const [wLinks] = await pool.execute('SELECT id FROM worker_links WHERE worker_id = ?', [uid]);
    const wlIds = wLinks.map(w => w.id);
    const wlBase = wlIds.length > 0
      ? `(t.worker_id = ? OR t.worker_link_id IN (${wlIds.map(() => '?').join(',')}))`
      : `t.worker_id = ?`;
    const baseParams = wlIds.length > 0 ? [uid, ...wlIds] : [uid];

    let where = wlBase;
    const params = [...baseParams];
    if (status && status !== 'all') { where += ' AND t.status = ?'; params.push(status); }

    const [countR] = await pool.execute(`SELECT COUNT(*) as c FROM vuot_link_tasks t WHERE ${where}`, params);
    const [tasks] = await pool.execute(
      `SELECT t.id, c.name as campaign_name, c.url as campaign_url, t.keyword, t.status, t.earning, t.code_given, t.completed_at, t.created_at
       FROM vuot_link_tasks t JOIN campaigns c ON t.campaign_id = c.id
       WHERE ${where} ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const statsWhere = wlIds.length > 0
      ? `(worker_id = ? OR worker_link_id IN (${wlIds.map(() => '?').join(',')}))`
      : `worker_id = ?`;
    const [stats] = await pool.execute(
      `SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status='completed' THEN earning ELSE 0 END),0) as totalEarnings,
       SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed
       FROM vuot_link_tasks WHERE ${statsWhere}`,
      baseParams
    );

    res.json({ tasks, total: countR[0].c, page, limit, stats: stats[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vuot-link/worker/earnings?days=30
router.get('/worker/earnings', authMiddleware, async (req, res) => {
  try {
    const uid = req.userId;
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 7));
    const data = await cache.get(
      `worker:earnings:${uid}:${days}`,
      async () => {
        const pool = getPool();
        const [wLinks] = await pool.execute('SELECT id FROM worker_links WHERE worker_id = ?', [uid]);
        const wlIds = wLinks.map(w => w.id);
        const wlCondition = wlIds.length > 0
          ? `(worker_id = ? OR worker_link_id IN (${wlIds.map(() => '?').join(',')}))`
          : `worker_id = ?`;
        const wlParams = wlIds.length > 0 ? [uid, ...wlIds] : [uid];

        const vnNow = new Date();
        const vnToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(vnNow);
        const startD = new Date(vnNow); startD.setDate(startD.getDate() - days);
        const startStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(startD) + ' 00:00:00';
        const todayStart = vnToday + ' 00:00:00';
        const todayEnd = vnToday + ' 23:59:59';

        const [[dailyRows], [todayR]] = await Promise.all([
          pool.execute(
            `SELECT DATE(completed_at) as date, COUNT(*) as tasks, COALESCE(SUM(earning), 0) as earnings
             FROM vuot_link_tasks WHERE ${wlCondition} AND status = 'completed'
               AND bot_detected = 0 AND is_over_limit = 0 AND completed_at >= ?
             GROUP BY DATE(completed_at) ORDER BY date DESC`,
            [...wlParams, startStr]
          ),
          pool.execute(
            `SELECT COALESCE(SUM(earning), 0) as earn, COUNT(*) as tasks FROM vuot_link_tasks
             WHERE ${wlCondition} AND status = 'completed'
               AND bot_detected = 0 AND is_over_limit = 0
               AND completed_at >= ? AND completed_at <= ?`,
            [...wlParams, todayStart, todayEnd]
          ),
        ]);

        const totalEarnings = dailyRows.reduce((s, d) => s + Number(d.earnings), 0);
        const totalTasks = dailyRows.reduce((s, d) => s + Number(d.tasks), 0);
        return {
          daily: dailyRows,
          summary: {
            total: totalEarnings,
            tasks: totalTasks,
            avgDaily: dailyRows.length > 0 ? Math.round(totalEarnings / dailyRows.length) : 0,
          },
          today: Number(todayR[0].earn),
          todayTasks: Number(todayR[0].tasks),
        };
      },
      60 * 1000,  // 60s TTL cho biểu đồ lịch sử
      45 * 1000   // stale-while-revalidate sau 45s
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





// GET /api/vuot-link/worker/balance
router.get('/worker/balance', authMiddleware, async (req, res) => {
  try {
    const uid = req.userId;
    const data = await cache.get(
      `worker:balance:${uid}`,
      async () => {
        const pool = getPool();
        const [wallets] = await pool.execute('SELECT type, balance FROM wallets WHERE user_id = ?', [uid]);
        const map = {};
        wallets.forEach(w => { map[w.type] = Number(w.balance); });
        return { balance: map.earning || 0, main: map.main || 0, commission: map.commission || 0 };
      },
      10 * 1000  // 10s TTL — balance cần tương đối real-time
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
