const express = require('express');
const geoip = require('geoip-lite');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { analyzeDevice } = require('../lib/behavior');

const router = express.Router();

// Helper: ensure wallet exists then credit — fixes bug where UPDATE affects 0 rows if wallet missing
async function ensureWalletCredit(pool, userId, walletType, amount) {
  const [res] = await pool.execute(
    'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?',
    [amount, userId, walletType]
  );
  if (res.affectedRows === 0) {
    await pool.execute(
      'INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)',
      [userId, walletType, amount]
    );
  }
}
const BOT_UA = /bot|crawler|spider|curl|wget|python|httpie|postman|insomnia|axios|node-fetch|headlesschrome|phantomjs|selenium/i;
const HMAC_SECRET = process.env.CHALLENGE_KEY || crypto.randomBytes(32).toString('hex');

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

// Rate limit counters (in-memory, reset hourly)
const ipTaskCount = {};
setInterval(() => { Object.keys(ipTaskCount).forEach(k => delete ipTaskCount[k]); }, 3600000);

// Challenge store (anti-replay)
const challenges = {};
setInterval(() => {
  const now = Date.now();
  Object.keys(challenges).forEach(k => { if (now - challenges[k].createdAt > 120000) delete challenges[k]; });
}, 30000);


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
         WHERE wl.slug = ? AND wl.hidden = 0 AND u.status = 'active'`, [slug]);
      if (rows.length > 0) {
        workerLinkId = rows[0].id;
        refWorkerId = rows[0].worker_id;
      } else {
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

  const challengeId = crypto.randomBytes(16).toString('hex');
  const prefix = crypto.randomBytes(8).toString('hex');
  const difficulty = 4;
  challenges[challengeId] = { createdAt: Date.now(), used: false, ip, prefix, difficulty, workerLinkId, refWorkerId };
  res.json({ c: challengeId, p: prefix, d: difficulty });
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

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  ipTaskCount[ip] = (ipTaskCount[ip] || 0) + 1;
  if (ipTaskCount[ip] > 30) {
    return res.status(429).json({ error: 'Quá nhiều yêu cầu. Thử lại sau.' });
  }

  const { challengeId, powNonce, visitorId, deviceData, botDetection, excludeCampaigns } = req.body || {};

  let botDetected = false;
  let detectionLog = [];

  if (!challengeId || powNonce === undefined) return res.status(403).json(ERR);
  const ch = challenges[challengeId];
  if (!ch) return res.status(403).json(ERR);
  if (ch.used) { delete challenges[challengeId]; return res.status(403).json(ERR); }
  if (Date.now() - ch.createdAt > 300000) { delete challenges[challengeId]; return res.status(403).json(ERR); }
  if (ch.ip && ch.ip !== ip) return res.status(403).json(ERR);

  const hash = crypto.createHash('sha256').update(ch.prefix + String(powNonce)).digest('hex');
  const target = '0'.repeat(ch.difficulty);
  if (!hash.startsWith(target)) {
    delete challenges[challengeId];
    return res.status(403).json(ERR);
  }


  ch.used = true;

  // ── Check if gateway link owner is still active (prevent banned user links) ──
  if (ch.workerLinkId) {
    const pool = getPool();
    const [wlCheck] = await pool.execute(
      `SELECT u.status FROM worker_links wl JOIN users u ON u.id = wl.worker_id WHERE wl.id = ?`,
      [ch.workerLinkId]
    );
    if (!wlCheck.length || wlCheck[0].status !== 'active') {
      delete challenges[challengeId];
      return res.status(403).json({ error: 'Link này đã bị vô hiệu hóa.' });
    }
  }

  // ── Bot detection: tổng hợp từ CreepJS (botDetection) + client flags (deviceData) ──
  // analyzeDevice v2 nhận cả 3: deviceData (scroll/click/sensor), ua, botDetection (CreepJS)
  const devResult = analyzeDevice(deviceData || {}, ua, botDetection || {});
  if (devResult.isFake) {
    botDetected = true;
    detectionLog.push(...devResult.detectionLog);
  }

  // Thêm: CreepJS bot flag trực tiếp (fallback nếu analyzeDevice miss)
  if (!botDetected && botDetection && botDetection.bot === true) {
    botDetected = true;
    if (!detectionLog.includes('headless_or_webdriver')) detectionLog.push('headless_or_webdriver');
  }


  // ── Limit check: load setting ONCE ──
  const pool = getPool();
  const [limitSetting] = await pool.execute("SELECT setting_value FROM site_settings WHERE setting_key = 'views_per_ip'");
  const maxViewsPerIp = limitSetting.length > 0 ? parseInt(limitSetting[0].setting_value) || 2 : 2;

  // Explicitly calculate Vietnam Day and Hour string to enforce limits flawlessly
  // This bypasses any bugs in MySQL server's global or session timezone defaults
  const vnOpts = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' };
  const todayVn = new Intl.DateTimeFormat('en-CA', vnOpts).format(new Date()); // e.g. "2026-03-26"
  const hourVnRaw = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false }).format(new Date());
  const hourStartVn = `${todayVn} ${hourVnRaw.padStart(2, '0')}:00:00`;

  // Count completed views today for this device (visitorId)
  let deviceViewsToday = 0;
  if (visitorId && visitorId !== 'unknown') {
    const [vCount] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE visitor_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed'`,
      [visitorId, `${todayVn} 00:00:00`, `${todayVn} 23:59:59`]
    );
    deviceViewsToday = vCount[0].cnt;
    if (deviceViewsToday >= maxViewsPerIp) {
      console.log(`[VuotLink] Device limit: visitorId=${visitorId.substring(0, 8)}..., count=${deviceViewsToday}, max=${maxViewsPerIp}`);
      return res.status(429).json({ error: `Thiết bị đã đạt giới hạn ${maxViewsPerIp} lượt/ngày. Thử lại sau.`, remaining: 0, maxViews: maxViewsPerIp });
    }
  }

  // Count completed views today for this IP
  const [ipCount] = await pool.execute(
    `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE ip_address = ? AND created_at >= ? AND created_at <= ? AND status = 'completed'`,
    [ip, `${todayVn} 00:00:00`, `${todayVn} 23:59:59`]
  );
  const ipViewsToday = ipCount[0].cnt;
  if (ipViewsToday >= maxViewsPerIp) {
    console.log(`[VuotLink] IP blocked: IP ${ip} reached daily limit (${ipViewsToday}/${maxViewsPerIp})`);
    return res.status(429).json({ error: `Bạn đã đạt giới hạn ${maxViewsPerIp} lượt/ngày. Vui lòng quay lại ngày mai.`, remaining: 0, maxViews: maxViewsPerIp });
  }

  const viewsUsed = Math.max(deviceViewsToday, ipViewsToday);
  const viewsRemaining = maxViewsPerIp - viewsUsed;
  console.log(`[VuotLink] ✅ VN_DATE=${todayVn} | PASS: IP=${ip}, visitor=${visitorId?.substring(0, 8) || '?'}, views=${viewsUsed}/${maxViewsPerIp}`);

  const campaignWhere = `c.status = 'running'
    AND ((c.traffic_type = 'google_search' AND c.keyword != '') OR c.traffic_type = 'direct')
    AND c.views_done < c.total_views
    AND (c.daily_views <= 0 OR COALESCE(td.today_done, 0) < c.daily_views)
    AND (c.view_by_hour <= 0 OR COALESCE(th.hour_done, 0) < CEIL(c.daily_views / 24))`;
  const todaySubquery = `LEFT JOIN (
      SELECT campaign_id, COUNT(*) as today_done
      FROM vuot_link_tasks
      WHERE status = 'completed' AND completed_at >= '${todayVn} 00:00:00' AND completed_at <= '${todayVn} 23:59:59'
      GROUP BY campaign_id
    ) td ON td.campaign_id = c.id
    LEFT JOIN (
      SELECT campaign_id, COUNT(*) as hour_done
      FROM vuot_link_tasks
      WHERE status = 'completed' AND completed_at >= '${hourStartVn}'
      GROUP BY campaign_id
    ) th ON th.campaign_id = c.id`;

  // Build exclude filter for skipped campaigns
  let excludeFilter = '';
  if (Array.isArray(excludeCampaigns) && excludeCampaigns.length > 0) {
    const safeIds = excludeCampaigns.filter(id => Number.isInteger(Number(id))).map(Number);
    if (safeIds.length > 0) excludeFilter = ` AND c.id NOT IN (${safeIds.join(',')})`;
  }

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) as cnt FROM campaigns c ${todaySubquery} WHERE ${campaignWhere}${excludeFilter}`
  );
  let totalCampaigns = countRows[0].cnt;

  // Nếu user bấm "Đổi nhiệm vụ" (loại trừ ID cũ) nhưng hệ thống chỉ còn đúng 1 mẩu task duy nhất
  // -> Xóa bộ lọc loại trừ và ưu tiên trả về task đó để user không bị rỗng nhiệm vụ.
  if (totalCampaigns === 0 && excludeFilter) {
    const [countAll] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM campaigns c ${todaySubquery} WHERE ${campaignWhere}`
    );
    totalCampaigns = countAll[0].cnt;
    excludeFilter = '';
  }

  if (totalCampaigns === 0) {
    // Debug: log to identify why no campaigns available
    try {
      const [dbTime] = await pool.execute("SELECT NOW() as now_vn, CURDATE() as today_vn, @@session.time_zone as tz");
      const [allCamps] = await pool.execute("SELECT COUNT(*) as total FROM campaigns WHERE status = 'running'");
      const [todayDone] = await pool.execute(
        `SELECT campaign_id, COUNT(*) as done FROM vuot_link_tasks WHERE status = 'completed' AND DATE(completed_at) = CURDATE() GROUP BY campaign_id`
      );
      console.log(`[VuotLink] NO CAMPAIGNS - DB time: ${JSON.stringify(dbTime[0])}, running: ${allCamps[0].total}, todayDone: ${JSON.stringify(todayDone)}`);
    } catch (e) { console.log('[VuotLink] Debug error:', e.message); }
    return res.status(404).json(ERR);
  }
  const randomOffset = Math.floor(Math.random() * totalCampaigns);
  const [campaigns] = await pool.execute(
    `SELECT c.* FROM campaigns c ${todaySubquery} WHERE ${campaignWhere}${excludeFilter} LIMIT 1 OFFSET ?`,
    [randomOffset]
  );
  if (campaigns.length === 0) return res.status(404).json(ERR);
  const campaign = campaigns[0];

  // Parse JSON arrays for keyword, url, images (backward compatible)
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

  const selectedKeyword = pickRandom(campaign.keyword) || campaign.keyword;
  const selectedUrl = campaign.url; // primary URL always used as target
  const allImages = [...parseImgArray(campaign.image1_url), ...parseImgArray(campaign.image2_url)].filter(Boolean);
  const selectedImage1 = allImages.length > 0 ? allImages[Math.floor(Math.random() * allImages.length)] : '';
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

  const expirySeconds = 600;

  const workerLinkId = ch.workerLinkId || null;
  const refWorkerId = ch.refWorkerId || null;

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

  const [result] = await pool.execute(
    `INSERT INTO vuot_link_tasks (campaign_id, worker_id, keyword, target_url, target_page, status, ip_address, user_agent, code_given, visitor_id, bot_detected, expires_at, worker_link_id, ref_worker_id, security_detail) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?, ?, ?)`,
    [campaign.id, req.userId || null, selectedKeyword, selectedUrl, campaign.target_page || '', ip, ua, randomCode, visitorId || null, botDetected ? 1 : 0, expirySeconds, workerLinkId, refWorkerId, securityDetail]
  );

  let isTrustedWorker = false;
  const targetCheckId = refWorkerId || req.userId;
  if (targetCheckId) {
    try {
      const [usr] = await pool.execute('SELECT trusted FROM users WHERE id = ?', [targetCheckId]);
      if (usr.length && usr[0].trusted === 1) isTrustedWorker = true;
    } catch (_) { }
  }

  // Track view (worker entered the page/claimed task)
  try {
    const [vLogs] = await pool.execute('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = CURDATE()', [campaign.id]);
    if (vLogs.length > 0) {
      await pool.execute('UPDATE traffic_logs SET views = views + 1 WHERE id = ?', [vLogs[0].id]);
    } else {
      await pool.execute(
        'INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source) VALUES (?, CURDATE(), 1, 0, 1, ?)',
        [campaign.id, campaign.traffic_type || 'google_search']
      );
    }
  } catch (_) { }

  // Fetch widget config from advertiser (for button preview in Step 4)
  let widgetConfig = null;
  try {
    let wRows;
    // Priority 1: Auto-match by domain from campaign URL
    try {
      const campaignDomain = new URL(campaign.url).hostname.replace(/^www\./, '');
      [wRows] = await pool.execute(
        `SELECT config FROM widgets WHERE user_id = ? AND is_active = 1 AND website_url LIKE ? ORDER BY created_at DESC LIMIT 1`,
        [campaign.user_id, `%${campaignDomain}%`]
      );
    } catch (_) { /* invalid URL, skip */ }
    if (!wRows || wRows.length === 0) {
      [wRows] = await pool.execute(
        `SELECT config FROM widgets WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`,
        [campaign.user_id]
      );
    }
    console.log(`[VuotLink] Widget query: user_id=${campaign.user_id}, found=${wRows.length}`);
    if (wRows.length > 0) {
      const raw = JSON.parse(wRows[0].config || '{}');
      const DEFAULTS = {
        buttonText: 'Lấy Mã', buttonColor: '#f97316', textColor: '#ffffff',
        borderRadius: 50, fontSize: 15, shadow: true,
        iconUrl: '', iconBg: 'rgba(255,255,255,0.92)', iconSize: 22,
      };
      widgetConfig = { ...DEFAULTS, ...raw };
      console.log(`[VuotLink] widgetConfig: color=${widgetConfig.buttonColor}, text=${widgetConfig.buttonText}`);
    }
  } catch (e) {
    console.error('[VuotLink] Widget config error:', e.message);
  }

  const _tk = signTask(result.insertId, ip);

  const isDirect = (campaign.traffic_type || 'google_search') === 'direct';
  res.json({
    id: result.insertId,
    keyword: selectedKeyword,
    image1_url: selectedImage1,
    image2_url: selectedImage2,
    widgetConfig,
    traffic_type: campaign.traffic_type || 'google_search',
    ...(isDirect ? { target_url: selectedUrl } : {}),
    _tk,
    trusted: isTrustedWorker,
  });
}

router.put('/task/:id/step', optionalAuth, (req, res) => res.json({ ok: true }));
router.post('/task/:id/challenge-passed', optionalAuth, async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';
  const { _tk, shakeLog } = req.body || {};

  if (!_tk || !verifyTaskToken(_tk, req.params.id, ip)) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  let dbTaskVisitorId = null;
  try {
    const pool = getPool();
    const [tasks] = await pool.execute(
      'SELECT id, status, expires_at, visitor_id FROM vuot_link_tasks WHERE id = ?',
      [req.params.id]
    );
    if (!tasks.length) return res.status(404).json({ error: 'Task không tồn tại' });
    const task = tasks[0];
    if (task.status === 'completed') return res.status(400).json({ error: 'Task đã hoàn thành' });
    if (task.status === 'expired') return res.status(410).json({ error: 'Task đã hết hạn' });
    const [expCheck] = await pool.execute('SELECT NOW() > ? as expired', [task.expires_at]);
    if (expCheck[0]?.expired) return res.status(410).json({ error: 'Task đã hết hạn' });
    dbTaskVisitorId = task.visitor_id;
  } catch (e) {
    console.error('[VuotLink] challenge-passed DB error:', e.message);
    return res.status(500).json({ error: 'Lỗi server' });
  }

  // ── Trusted worker: bỏ qua challenge hoàn toàn ──
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

  let detectedBotReason = null;
  const isMobile = /mobi|android|iphone|ipad|ipod/i.test(ua);
  if (isMobile) {
    if (!Array.isArray(shakeLog) || shakeLog.length < 5) {
      return res.status(403).json({ error: 'Thiếu dữ liệu xác minh cảm biến.' });
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

    if (EMULATOR_UA.test(ua)) {
      logSecurityEvent('Giả lập Android', ip, ua, dbTaskVisitorId, { ua });
      detectedBotReason = 'Giả lập Android';
    } else if (zeroZCount === rawEvents.length) {
      logSecurityEvent('Giả lập cảm biến', ip, ua, dbTaskVisitorId, { shakeLog: rawEvents });
      detectedBotReason = 'Dữ liệu cảm biến không hợp lệ';
    } else if (intervals.length >= 10 && intervalVariance < 0.1 && avgInterval > 0) {
      logSecurityEvent('Giả lập ADB/Macro', ip, ua, dbTaskVisitorId, { intervalVariance, avgInterval });
      detectedBotReason = 'Tín hiệu cảm biến bất thường';
    } else if (maxTotal < 15) {
      detectedBotReason = 'Lực cảm biến thiếu';
    } else if (forceVariance < 0.5 && rawEvents.length >= 5) {
      logSecurityEvent('Cảm biến tĩnh lặp lại', ip, ua, dbTaskVisitorId, { forceVariance });
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
        logSecurityEvent('Trỏ chuột di chuyển đều tuyệt đối', ip, ua, dbTaskVisitorId, { curveLog: points, spdVar });
        detectedBotReason = 'Chuyển động chuột bất thường';
      }
    }
  }

  if (detectedBotReason) {
    try {
      const pool = getPool();
      await pool.execute('UPDATE vuot_link_tasks SET bot_detected = 1 WHERE id = ?', [req.params.id]);
    } catch(e) {}
  }

  const ts = Date.now();
  const challengeToken = signChallengeToken(req.params.id, ip, ts);
  challengePassedStore[req.params.id] = { token: challengeToken, ts, ip };

  res.json({ challengeToken });
});

router.post('/task/:id/verify', optionalAuth, async (req, res) => {
  const pool = getPool();
  const { code, _tk, challengeToken } = req.body;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
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
      return res.status(403).json({ error: 'Bạn chưa hoàn thành bước xác minh người thật.' });
    }
    if (cpEntry.token !== challengeToken || cpEntry.ip !== ip) {
      return res.status(403).json({ error: 'Token xác minh không hợp lệ.' });
    }
    delete challengePassedStore[taskIdStr];
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
  const ipOk = task.ip_address && task.ip_address === ip;
  const vidOk = task.visitor_id && verifyVid && task.visitor_id === verifyVid;
  if (!ipOk && !vidOk) {
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

  const [campaigns] = await pool.execute('SELECT cpc, budget, total_views, user_id, traffic_type, time_on_site, version, name, discount_applied FROM campaigns WHERE id = ?', [task.campaign_id]);
  if (campaigns.length === 0) return res.status(404).json({ error: 'Campaign không tồn tại' });
  const campaign = campaigns[0];

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
    }
  } catch (e) {
    console.error('[VuotLink] Buyer CPC lookup error:', e.message);
  }
  console.log(`[VuotLink] buyerCpc=${buyerCpc} (discount=${campaign.discount_applied}, cpc_col=${campaign.cpc})`);

  // ── Check buyer balance ──
  const [buyerWallets] = await pool.execute(
    "SELECT balance FROM wallets WHERE user_id = ? AND type = 'main'", [campaign.user_id]
  );
  if ((buyerWallets[0]?.balance || 0) < buyerCpc) {
    // Hết tiền → auto-pause, task hoàn thành nhưng không trả
    await pool.execute("UPDATE campaigns SET status = 'paused' WHERE id = ? AND status = 'running'", [task.campaign_id]);
    await pool.execute(
      `UPDATE vuot_link_tasks SET status = 'completed', completed_at = NOW(), time_on_site = ?, earning = 0 WHERE id = ?`,
      [Math.floor((Date.now() - new Date(task.created_at).getTime()) / 1000), task.id]
    );
    return res.json({ success: true, message: 'Chiến dịch hết ngân sách', earning: 0, destinationUrl: null });
  }

  // ── Worker earning: look up from worker_pricing_tiers (giá admin set cho worker) ──
  let earning = campaign.cpc;
  try {
    const duration = (campaign.time_on_site || '60').split('-')[0] + 's';
    const [wptRows] = await pool.execute(
      'SELECT v1_price, v2_price FROM worker_pricing_tiers WHERE traffic_type = ? AND duration = ?',
      [campaign.traffic_type || 'google_search', duration]
    );
    if (wptRows.length > 0) {
      earning = campaign.version === 2 ? wptRows[0].v2_price : wptRows[0].v1_price;
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

  const isBotUser = task.bot_detected === 1 || Boolean(task.security_detail?.includes('flagged'));
  if (isBotUser) {
    buyerCpc = 0;
    earning = 0;
  }

  await pool.execute(
    `UPDATE vuot_link_tasks SET status = 'completed', completed_at = NOW(), time_on_site = ?, earning = ?, ip_country = ? WHERE id = ?`,
    [timeOnSite, earning, ipCountry, task.id]
  );

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

    const [logs] = await pool.execute('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = CURDATE()', [task.campaign_id]);
    if (logs.length > 0) {
      await pool.execute(`UPDATE traffic_logs SET clicks = COALESCE(clicks, 0) + 1, views = COALESCE(views, 0) + 1, ${deviceCol} = COALESCE(${deviceCol}, 0) + 1 WHERE id = ?`, [logs[0].id]);
    } else {
      await pool.execute(
        `INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source, ${deviceCol}) VALUES (?, CURDATE(), 1, 1, 1, ?, 1)`,
        [task.campaign_id, campaign.traffic_type || 'google_search']
      );
    }
  }

  // ── Trừ tiền buyer (theo giá set) ──
  if (buyerCpc > 0) {
    await pool.execute("UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = 'main'", [buyerCpc, campaign.user_id]);
    const buyerRef = 'VW-' + Date.now();
    await pool.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, 'main', 'campaign', 'system', ?, 'completed', ?, ?)`,
      [campaign.user_id, buyerCpc, buyerRef, `Lượt xem chiến dịch "${campaign.name}" (#${task.campaign_id})`]
    );
  }

  // ── Cộng tiền worker (theo giá set) ──
  let paidWorkerId = null;
  if (task.worker_id && !task.worker_link_id && earning > 0) {
    paidWorkerId = task.worker_id;
    await ensureWalletCredit(pool, task.worker_id, 'earning', earning);
    const refCode = 'VL-' + Date.now();
    await pool.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, 'earning', 'earning', 'system', ?, 'completed', ?, ?)`,
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
        paidWorkerId = wl.worker_id;
        
        if (earning > 0) {
          await ensureWalletCredit(pool, wl.worker_id, 'earning', earning);
          await pool.execute('UPDATE worker_links SET completed_count = completed_count + 1, earning = earning + ? WHERE id = ?', [earning, wl.id]);
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

  // ── Ref link mode: cộng earning cho worker ref ──
  // Áp dụng khi task được tạo qua ?ref=username (không phải slug/gateway)
  if (!paidWorkerId && task.ref_worker_id && earning > 0) {
    try {
      // Lấy % hoa hồng ref từ site_settings (tái dùng referral_commission_worker)
      const [refCommSetting] = await pool.execute(
        "SELECT setting_value FROM site_settings WHERE setting_key = 'referral_commission_worker'"
      );
      const refCommPct = Number(refCommSetting[0]?.setting_value || 0);
      const refEarning = refCommPct > 0 ? Math.floor(earning * refCommPct / 100) : 0;
      if (refEarning > 0) {
        paidWorkerId = task.ref_worker_id; // set để trigger referral bên dưới
        await ensureWalletCredit(pool, task.ref_worker_id, 'earning', refEarning);
        const refTxCode = 'RL-' + Date.now();
        await pool.execute(
          `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
           VALUES (?, 'earning', 'earning', 'ref_link', ?, 'completed', ?, ?)`,
          [task.ref_worker_id, refEarning, refTxCode,
          `Hoa hong ref ${refCommPct}% - ${task.keyword || 'Vượt link'} #${task.id} (${earning} đ)`]
        );
        console.log(`[VuotLink] Ref earning: paid ${refEarning} to ref_worker_id=${task.ref_worker_id} (${refCommPct}% of ${earning})`);
      }
    } catch (e) { console.error('[VuotLink] Ref link earning error:', e.message); }
  }

  // ── Hoa hồng referral: cộng % cho người đã ref paidWorker ──
  if (paidWorkerId && earning > 0) {
    try {
      console.log(`[Commission] Checking referral for worker=${paidWorkerId}, earning=${earning}`);
      const [refRows] = await pool.execute('SELECT referred_by FROM users WHERE id = ?', [paidWorkerId]);
      const referrerId = refRows[0]?.referred_by;
      console.log(`[Commission] referred_by=${referrerId}`);
      if (referrerId) {
        const [commSetting] = await pool.execute(
          "SELECT setting_value FROM site_settings WHERE setting_key = 'referral_commission_worker'"
        );
        const commPct = Number(commSetting[0]?.setting_value || 0);
        console.log(`[Commission] commPct=${commPct}`);
        if (commPct > 0) {
          const commAmount = Math.floor(earning * commPct / 100);
          console.log(`[Commission] commAmount=${commAmount}, paying referrerId=${referrerId}`);
          if (commAmount > 0) {
            await ensureWalletCredit(pool, referrerId, 'commission', commAmount);
            const commRef = `COMM-WORKER-${Date.now()}`;
            await pool.execute(
              `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
               VALUES (?, 'commission', 'commission', 'referral', ?, 'completed', ?, ?)`,
              [referrerId, commAmount, commRef, `Hoa hong ${commPct}% tu worker vuot link (${earning} d)`]
            );
            console.log(`[Commission] Paid ${commAmount} to referrer ${referrerId}`);
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
      logSecurityEvent('Phát hiện Bot', task.ip_address, task.user_agent, task.visitor_id, {
        taskId: task.id,
        source: 'vuotlink',
        campaignId: task.campaign_id,
        targetUrl: task.target_url || null,
        workerLinkId: task.worker_link_id || null,
        gatewaySlug: gatewaySlug,
        timeOnSite,
        earning,
        ipCountry,
        // Lý do phát hiện chi tiết
        detectionLog: secDetail.detectionLog || [],
        reasons: secDetail.reasons || [],
        deviceScore: secDetail.deviceScore ?? null,
        deviceType: secDetail.deviceType || null,
        automationFlags: secDetail.detail?.automation || null,
        canvasHash: secDetail.canvasHash || null,
        audioHash: secDetail.audioHash || null,
        creepSummary: secDetail.creepSummary || null,
      });
    }
  } catch (e) { }

  // Calculate remaining views for today (after this completion)
  let remaining = 0;
  let maxViews = 2;
  try {
    const [limitSetting] = await pool.execute("SELECT setting_value FROM site_settings WHERE setting_key = 'views_per_ip'");
    maxViews = limitSetting.length > 0 ? parseInt(limitSetting[0].setting_value) || 2 : 2;

    // Count completed tasks today for this IP
    const [ipDone] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE ip_address = ? AND DATE(created_at) = CURDATE() AND status = 'completed'`,
      [ip]
    );
    // Also count by visitor_id if available
    let vidDone = 0;
    if (task.visitor_id && task.visitor_id !== 'unknown') {
      const [vDone] = await pool.execute(
        `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE visitor_id = ? AND DATE(created_at) = CURDATE() AND status = 'completed'`,
        [task.visitor_id]
      );
      vidDone = vDone[0].cnt;
    }
    const usedToday = Math.max(ipDone[0].cnt, vidDone);
    remaining = Math.max(0, maxViews - usedToday);
  } catch (e) { console.error('[VuotLink] Remaining calc error:', e.message); }

  res.json({ success: true, earning, destination_url: destinationUrl });
});

/* ═════════════════════════════════════════════════════════
   Keep old /task/:id/complete for backward compat (redirect to verify)
═════════════════════════════════════════════════════════ */
router.post('/task/:id/complete', optionalAuth, async (req, res) => {
  // Redirect old flow to verify
  req.body.code = req.body.code || '';
  return res.status(400).json({ error: 'Vui lòng sử dụng flow xác nhận mã mới.' });
});

/* ═════════════════════════════════════════════════════════
   SECRET API — Tra cứu trang đích bằng keyword + image
   Không cần login, chỉ cần SECRET_API_KEY
   
   POST /api/vuot-link/secret/lookup
   Headers: x-api-key: <SECRET_API_KEY>
   Body: { keyword: "...", image_url: "..." }
   
   GET  /api/vuot-link/secret/campaigns
   Headers: x-api-key: <SECRET_API_KEY>
═════════════════════════════════════════════════════════ */
const SECRET_API_KEY = process.env.SECRET_API_KEY || 'CHANGE_ME_IN_ENV';

function secretApiAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key || '';
  if (!key || key !== SECRET_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET & POST /api/vuot-link/secret/lookup — Tìm campaign theo keyword + image → trả về URL dạng text
async function _secretLookup(req, res) {
  try {
    const pool = getPool();
    // Support cả GET (query) và POST (body)
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
    const pool = getPool();
    const uid = req.userId;

    // Get worker's link IDs for gateway tasks
    const [wLinks] = await pool.execute('SELECT id FROM worker_links WHERE worker_id = ?', [uid]);
    const wlIds = wLinks.map(w => w.id);
    const wlCondition = wlIds.length > 0
      ? `(worker_id = ? OR worker_link_id IN (${wlIds.map(() => '?').join(',')}))`
      : `worker_id = ?`;
    const wlParams = wlIds.length > 0 ? [uid, ...wlIds] : [uid];

    const [todayTasks] = await pool.execute(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(earning),0) as earn FROM vuot_link_tasks WHERE ${wlCondition} AND status = 'completed' AND DATE(completed_at) = CURDATE()`,

      wlParams
    );
    const [totalTasks] = await pool.execute(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(earning),0) as earn FROM vuot_link_tasks WHERE ${wlCondition} AND status = 'completed'`,
      wlParams
    );
    const [pendingTasks] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE ${wlCondition} AND status IN ('pending','step1','step2','step3')`,
      wlParams
    );
    const [wallets] = await pool.execute(
      `SELECT type, balance FROM wallets WHERE user_id = ?`,
      [uid]
    );
    const walletMap = {};
    wallets.forEach(w => { walletMap[w.type] = Number(w.balance); });

    // 7 day chart
    const [chart] = await pool.execute(
      `SELECT DATE(completed_at) as day, COUNT(*) as tasks, COALESCE(SUM(earning),0) as earn
       FROM vuot_link_tasks WHERE ${wlCondition} AND status = 'completed' AND DATE(completed_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(completed_at) ORDER BY day`,
      wlParams
    );

    // Recent tasks
    const [recent] = await pool.execute(
      `SELECT t.id, c.name as campaign_name, t.status, t.earning, t.completed_at, t.created_at
       FROM vuot_link_tasks t JOIN campaigns c ON t.campaign_id = c.id
       WHERE ${wlCondition.replace(/worker_id/g, 't.worker_id').replace(/worker_link_id/g, 't.worker_link_id')} ORDER BY t.created_at DESC LIMIT 10`,
      wlParams
    );

    // Remaining daily views = SUM(daily_views) - today's completed tasks
    const [remRows] = await pool.execute(
      `SELECT
        COALESCE(SUM(c.daily_views), 0) as total_daily,
        COALESCE(SUM(LEAST(COALESCE(td.done, 0), c.daily_views)), 0) as today_done
       FROM campaigns c
       LEFT JOIN (
         SELECT campaign_id, COUNT(*) as done FROM vuot_link_tasks
         WHERE status = 'completed' AND DATE(completed_at) = CURDATE()
         GROUP BY campaign_id
       ) td ON td.campaign_id = c.id
       WHERE c.status = 'running' AND c.daily_views > 0`
    );

    res.json({
      today: { tasks: todayTasks[0].cnt, earnings: Number(todayTasks[0].earn) },
      total: { tasks: totalTasks[0].cnt, earnings: Number(totalTasks[0].earn) },
      pending: pendingTasks[0].cnt,
      remainingDailyViews: Math.max(0, Number(remRows[0].total_daily) - Number(remRows[0].today_done)),
      balance: walletMap.earning || 0,
      commissionBalance: walletMap.commission || 0,
      chart,
      recent,
    });
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
    const pool = getPool();
    const uid = req.userId;
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 7));

    // Bao gồm cả gateway link tasks (giống worker/stats)
    const [wLinks] = await pool.execute('SELECT id FROM worker_links WHERE worker_id = ?', [uid]);
    const wlIds = wLinks.map(w => w.id);
    const wlCondition = wlIds.length > 0
      ? `(worker_id = ? OR worker_link_id IN (${wlIds.map(() => '?').join(',')}))`
      : `worker_id = ?`;
    const wlParams = wlIds.length > 0 ? [uid, ...wlIds] : [uid];

    const [daily] = await pool.execute(
      `SELECT DATE(completed_at) as date,
              COUNT(*) as tasks,
              COALESCE(SUM(earning), 0) as earnings
       FROM vuot_link_tasks
       WHERE ${wlCondition} AND status = 'completed'
         AND DATE(completed_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(completed_at)
       ORDER BY date DESC`,
      [...wlParams, days]
    );

    const [summary] = await pool.execute(
      `SELECT COALESCE(SUM(earning), 0) as total, COUNT(*) as tasks
       FROM vuot_link_tasks
       WHERE ${wlCondition} AND status = 'completed'
         AND DATE(completed_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [...wlParams, days]
    );

    const [todayR] = await pool.execute(
      `SELECT COALESCE(SUM(earning), 0) as earn, COUNT(*) as tasks
       FROM vuot_link_tasks
       WHERE ${wlCondition} AND status = 'completed' AND DATE(completed_at) = CURDATE()`,
      wlParams
    );

    res.json({
      daily,
      summary: {
        total: Number(summary[0].total),
        tasks: Number(summary[0].tasks),
        avgDaily: daily.length > 0 ? Math.round(Number(summary[0].total) / daily.length) : 0,
      },
      today: Number(todayR[0].earn),
      todayTasks: Number(todayR[0].tasks),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/vuot-link/worker/balance
router.get('/worker/balance', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [wallets] = await pool.execute('SELECT type, balance FROM wallets WHERE user_id = ?', [req.userId]);
    const map = {};
    wallets.forEach(w => { map[w.type] = Number(w.balance); });
    res.json({ balance: map.earning || 0, main: map.main || 0, commission: map.commission || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
