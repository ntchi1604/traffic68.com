const express = require('express');
const geoip = require('geoip-lite');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { analyzeBehavior } = require('../lib/behavior');

const router = express.Router();

// Helper: ensure wallet exists then credit — fixes bug where UPDATE affects 0 rows if wallet missing
async function ensureWalletCredit(pool, userId, walletType, amount) {
  await pool.execute(
    `INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE balance = balance + ?`,
    [userId, walletType, amount, amount]
  );
}
const BOT_UA = /bot|crawler|spider|curl|wget|python|httpie|postman|insomnia|axios|node-fetch|headlesschrome|phantomjs|selenium/i;
const HMAC_SECRET = process.env.CHALLENGE_KEY || crypto.randomBytes(32).toString('hex');

// Log security events to DB for admin visibility
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

// Rate limit counters (in-memory, reset hourly)
const ipTaskCount = {};
setInterval(() => { Object.keys(ipTaskCount).forEach(k => delete ipTaskCount[k]); }, 3600000);

// Challenge store (anti-replay)
const challenges = {};
setInterval(() => {
  const now = Date.now();
  Object.keys(challenges).forEach(k => { if (now - challenges[k].createdAt > 120000) delete challenges[k]; });
}, 30000);



/* ═══════════════════════════════════════════════════════════
   STEP 1: GET /challenge (anti-replay token + optional slug session)
   If ?slug=xxx is provided, server looks up the worker_link
   and stores worker_link_id in the challenge session (server-side).
   Client never sends worker_link_id directly.
═══════════════════════════════════════════════════════════ */
router.get('/challenge', async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (!ua || BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  // If slug is provided, look up worker_link and bind to this challenge session
  // Slug MUST be valid — if provided but not found, reject the request
  let workerLinkId = null;
  const slug = (req.query.slug || '').trim();
  if (slug) {
    try {
      const pool = getPool();
      const [rows] = await pool.execute('SELECT id FROM worker_links WHERE slug = ? AND hidden = 0', [slug]);
      if (rows.length > 0) {
        workerLinkId = rows[0].id;
      } else {
        return res.status(404).json({ error: 'Link không tồn tại' });
      }
    } catch (e) {
      console.error('[VuotLink] Challenge slug lookup error:', e.message);
      return res.status(500).json({ error: 'Lỗi server' });
    }
  }

  const challengeId = crypto.randomBytes(16).toString('hex');
  const prefix = crypto.randomBytes(8).toString('hex');
  const difficulty = 4;
  const domText = crypto.randomBytes(6).toString('hex');
  const domFontSize = 14 + Math.floor(Math.random() * 10);
  const glSalt = crypto.randomBytes(8).toString('hex');
  const glColor = [Math.random(), Math.random(), Math.random()].map(v => Math.round(v * 100) / 100);
  challenges[challengeId] = { createdAt: Date.now(), used: false, ip, prefix, difficulty, domText, domFontSize, glSalt, glColor, workerLinkId };
  res.json({ c: challengeId, p: prefix, d: difficulty, dt: domText, df: domFontSize, gs: glSalt, gc: glColor });
});

/* ═════════════════════════════════════════════════════════
   STEP 2: POST task — create session + generate code
   - Stores IP, UA, random code in vuot_link_tasks
   - Code will be shown on the target website embed script
═════════════════════════════════════════════════════════ */
router.post('/task', optionalAuth, (req, res) => {
  // Hard 25s timeout — prevents Nginx 504 by responding before Nginx gives up
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
    console.log(`[VuotLink] IP rate limit: ${ip}`);
    logSecurityEvent('ip_rate_limit', ip, ua, null, { count: ipTaskCount[ip] });
    return res.status(429).json({ error: 'Quá nhiều yêu cầu. Thử lại sau.' });
  }

  const { challengeId, powNonce, domWidth, glRenderer, glPixel, visitorId, botDetection, probes: clientProbes, behavioral } = req.body || {};

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

  if (!domWidth || typeof domWidth !== 'number' || domWidth <= 0) {
    delete challenges[challengeId];
    return res.status(403).json(ERR);
  }
  const expectedWidth = ch.domText.length * ch.domFontSize * 0.6;
  if (domWidth < expectedWidth * 0.3 || domWidth > expectedWidth * 2.0) {
    delete challenges[challengeId];
    return res.status(403).json(ERR);
  }

  if (!glRenderer || typeof glRenderer !== 'string' || glRenderer.length < 3) {
    delete challenges[challengeId];
    return res.status(403).json(ERR);
  }
  if (glPixel && Array.isArray(glPixel) && glPixel.length >= 3) {
    const tol = 15;
    const [er, eg, eb] = ch.glColor.map(v => Math.round(v * 255));
    if (Math.abs(glPixel[0] - er) > tol || Math.abs(glPixel[1] - eg) > tol || Math.abs(glPixel[2] - eb) > tol) {
      delete challenges[challengeId];
      return res.status(403).json(ERR);
    }
  }

  ch.used = true;

  // ── 2. CreepJS check — with mobile tolerance ──
  const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  if (botDetection && botDetection.bot === true) {
    console.log(`[VuotLink] 🚫 CreepJS BOT: IP=${ip}`);
    logSecurityEvent('creep_detected', ip, ua, visitorId, botDetection);
    botDetected = true;
    detectionLog.push('creep_detected');
    return res.status(403).json(ERR);
  }
  if (botDetection && botDetection.totalLied > 0) {
    // On mobile: clientRects, maths, css often differ due to DPI/font rendering — not reliable
    const mobileSafe = ['clientRects', 'maths', 'css', 'domRect'];
    const lied = botDetection.liedSections || [];
    console.log(`[VuotLink] CreepJS lied debug: IP=${ip}, mobile=${isMobileDevice}, UA=${ua.substring(0,60)}, liedSections=${JSON.stringify(lied)}, totalLied=${botDetection.totalLied}`);
    const realLies = isMobileDevice ? lied.filter(s => !mobileSafe.some(safe => s === safe || s.startsWith(safe + ':'))) : lied;
    if (realLies.length > 0 || (!isMobileDevice && botDetection.totalLied > 0)) {
      console.log(`[VuotLink] 🚫 CreepJS BLOCKED: IP=${ip}, totalLied=${botDetection.totalLied}, realLies=${realLies.join(',')}, mobile=${isMobileDevice}`);
      logSecurityEvent('creep_detected', ip, ua, visitorId, botDetection);
      botDetected = true;
      detectionLog.push('creep_detected');
      return res.status(403).json(ERR);
    } else {
      console.log(`[VuotLink] ⚠️ CreepJS mobile tolerance: IP=${ip}, ignored: ${lied.join(',')}`);
    }
  }

  const probes = clientProbes || {};
  if (probes.webdriver === true || probes.cdc === true || probes.selenium === true) {
    console.log(`[VuotLink] 🤖 Automation probe hit: IP=${ip}`);
    return res.status(403).json(ERR);
  }

  // ── Limit check: load setting ONCE ──
  const pool = getPool();
  const [limitSetting] = await pool.execute("SELECT setting_value FROM site_settings WHERE setting_key = 'views_per_ip'");
  const maxViewsPerIp = limitSetting.length > 0 ? parseInt(limitSetting[0].setting_value) || 2 : 2;

  if (visitorId && visitorId !== 'unknown') {
    const [vCount] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE visitor_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) AND status = 'completed'`,
      [visitorId]
    );
    if (vCount[0].cnt >= maxViewsPerIp) {
      console.log(`[VuotLink] Device limit: visitorId=${visitorId.substring(0, 8)}..., count=${vCount[0].cnt}, max=${maxViewsPerIp}`);
      return res.status(429).json({ error: `Thiết bị đã đạt giới hạn ${maxViewsPerIp} lượt/ngày. Thử lại sau.` });
    }
  }

  console.log(`[VuotLink] ✅ PASS: IP=${ip}, visitor=${visitorId?.substring(0, 8) || '?'}`);

  const [ipCount] = await pool.execute(
    `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE ip_address = ? AND DATE(created_at) = CURDATE() AND status = 'completed'`,
    [ip]
  );
  if (ipCount[0].cnt >= maxViewsPerIp) {
    console.log(`VuotLink blocked: IP ${ip} reached daily limit (${ipCount[0].cnt}/${maxViewsPerIp})`);
    return res.status(429).json({ error: `Bạn đã đạt giới hạn ${maxViewsPerIp} lượt/ngày. Vui lòng quay lại ngày mai.` });
  }

  // Fast random campaign: avoid ORDER BY RAND() full-table-scan
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) as cnt FROM campaigns WHERE status = 'running' AND traffic_type = 'google_search' AND keyword != '' AND views_done < total_views`
  );
  const totalCampaigns = countRows[0].cnt;
  if (totalCampaigns === 0) return res.status(404).json(ERR);
  const randomOffset = Math.floor(Math.random() * totalCampaigns);
  const [campaigns] = await pool.execute(
    `SELECT * FROM campaigns WHERE status = 'running' AND traffic_type = 'google_search' AND keyword != '' AND views_done < total_views LIMIT 1 OFFSET ?`,
    [randomOffset]
  );
  if (campaigns.length === 0) return res.status(404).json(ERR);
  const campaign = campaigns[0];

  // Parse JSON arrays for keyword, url, images (backward compatible)
  const pickRandom = (val) => {
    if (!val) return val;
    try { const a = JSON.parse(val); if (Array.isArray(a) && a.length) return a[Math.floor(Math.random() * a.length)]; } catch {}
    return val;
  };
  const parseImgArray = (val) => {
    if (!val) return [];
    try { const a = JSON.parse(val); if (Array.isArray(a)) return a; } catch {}
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

  // Task expires after 10 minutes — code cannot be used after expiry
  const expirySeconds = 600;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Use worker_link_id from challenge session (server-side), NOT from client body
  const workerLinkId = ch.workerLinkId || null;

  const [result] = await pool.execute(
    `INSERT INTO vuot_link_tasks (campaign_id, worker_id, keyword, target_url, target_page, status, ip_address, user_agent, code_given, visitor_id, bot_detected, expires_at, worker_link_id) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?)`,
    [campaign.id, req.userId || null, selectedKeyword, selectedUrl, campaign.target_page || '', ip, ua, randomCode, visitorId || null, botDetected ? 1 : 0, expirySeconds, workerLinkId]
  );

  console.log(`[VuotLink] Task #${result.insertId} created — IP: ${ip}, code: ${randomCode}, campaign: ${campaign.id}, keyword: ${selectedKeyword}, waitTime: ${waitTime}s`);

  // Track view (worker entered the page/claimed task)
  try {
    const todayView = new Date().toISOString().slice(0, 10);
    const [vLogs] = await pool.execute('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = ?', [campaign.id, todayView]);
    if (vLogs.length > 0) {
      await pool.execute('UPDATE traffic_logs SET views = views + 1 WHERE id = ?', [vLogs[0].id]);
    } else {
      await pool.execute(
        'INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source) VALUES (?, ?, 1, 0, 1, ?)',
        [campaign.id, todayView, campaign.traffic_type || 'google_search']
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
    // Priority 2: Fallback to latest active widget for this user
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

  // Generate signed task token (binds to IP, cannot be forged)
  const _tk = signTask(result.insertId, ip);

  res.json({
    id: result.insertId,
    keyword: selectedKeyword,
    image1_url: selectedImage1,
    image2_url: selectedImage2,
    url2: selectedUrl2,
    waitTime,
    startedAt: now,
    widgetConfig,
    _tk,
  });
}

/* PUT /task/:id/step - no-op (step tracking removed) */
router.put('/task/:id/step', optionalAuth, (req, res) => res.json({ ok: true }));


/* ═════════════════════════════════════════════════════════
   STEP 4: POST /task/:id/verify — verify code & complete
   - User enters code from target website
   - Server verifies it matches code_given
   - If correct → count as 1 view, pay worker
═════════════════════════════════════════════════════════ */
router.post('/task/:id/verify', optionalAuth, async (req, res) => {
  const pool = getPool();
  const { code, _tk } = req.body;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  // Anti-cheat: verify task token
  if (!_tk || !verifyTaskToken(_tk, req.params.id, ip)) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  if (!code || code.trim().length < 4) {
    return res.status(400).json({ error: 'Mã xác nhận không hợp lệ' });
  }

  const [tasks] = await pool.execute('SELECT * FROM vuot_link_tasks WHERE id = ?', [req.params.id]);
  if (tasks.length === 0) return res.status(404).json({ error: 'Task không tồn tại' });
  const task = tasks[0];

  if (task.status === 'completed') return res.status(400).json({ error: 'Task đã hoàn thành' });

  // Accept task in any non-terminal status
  const validStatuses = ['pending', 'step1', 'step2', 'step3'];
  if (!validStatuses.includes(task.status)) {
    return res.status(403).json({ error: 'Trạng thái task không hợp lệ' });
  }
  // Auto-advance to step3 if needed (widget may not have been triggered)
  if (task.status !== 'step3') {
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step3' WHERE id = ?", [task.id]);
  }

  // Anti-cheat: IP must match
  if (task.ip_address && task.ip_address !== ip) {
    return res.status(403).json({ error: 'IP mismatch' });
  }

  // Check expiry
  if (task.expires_at) {
    const [expCheck] = await pool.execute('SELECT NOW() > ? as expired', [task.expires_at]);
    if (expCheck[0]?.expired) {
      await pool.execute("UPDATE vuot_link_tasks SET status = 'expired' WHERE id = ?", [task.id]);
      return res.status(410).json({ error: 'Task đã hết hạn' });
    }
  }

  // Verify code matches
  if (code.trim().toUpperCase() !== (task.code_given || '').toUpperCase()) {
    return res.status(400).json({ error: 'Mã xác nhận không đúng. Vui lòng kiểm tra lại.' });
  }

  // Code correct! → Complete task, count as 1 view
  const [campaigns] = await pool.execute('SELECT cpc, user_id, traffic_type, time_on_site, version, name FROM campaigns WHERE id = ?', [task.campaign_id]);
  if (campaigns.length === 0) return res.status(404).json({ error: 'Campaign không tồn tại' });
  const campaign = campaigns[0];

  // ── Buyer CPC: look up from pricing_tiers (giá admin set cho buyer) ──
  let buyerCpc = campaign.cpc || 0;
  try {
    const duration = (campaign.time_on_site || '60').split('-')[0] + 's';
    const [bptRows] = await pool.execute(
      'SELECT v1_price, v2_price FROM pricing_tiers WHERE traffic_type = ? AND duration = ?',
      [campaign.traffic_type || 'google_search', duration]
    );
    if (bptRows.length > 0) {
      buyerCpc = campaign.version === 2 ? bptRows[0].v2_price : bptRows[0].v1_price;
    }
  } catch (e) {
    console.error('[VuotLink] Buyer CPC lookup error:', e.message);
  }

  // ── Check buyer balance ──
  const [buyerWallets] = await pool.execute(
    "SELECT balance FROM wallets WHERE user_id = ? AND type = 'main'", [campaign.user_id]
  );
  if ((buyerWallets[0]?.balance || 0) < buyerCpc) {
    // Hết tiền → auto-pause, task hoàn thành nhưng không trả
    await pool.execute("UPDATE campaigns SET status = 'paused' WHERE id = ? AND status = 'running'", [task.campaign_id]);
    const now2 = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute(
      `UPDATE vuot_link_tasks SET status = 'completed', completed_at = ?, time_on_site = ?, earning = 0 WHERE id = ?`,
      [now2, Math.floor((Date.now() - new Date(task.created_at).getTime()) / 1000), task.id]
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

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const timeOnSite = Math.floor((Date.now() - new Date(task.created_at).getTime()) / 1000);

  // Detect country from IP
  let ipCountry = null;
  try {
    const ip = task.ip_address || '';
    const cleanIp = ip.replace(/^::ffff:/, '');
    const geo = geoip.lookup(cleanIp);
    if (geo && geo.country) ipCountry = geo.country;
  } catch (_) { }

  await pool.execute(
    `UPDATE vuot_link_tasks SET status = 'completed', completed_at = ?, time_on_site = ?, earning = ?, ip_country = ? WHERE id = ?`,
    [now, timeOnSite, earning, ipCountry, task.id]
  );

  // Count view + auto-complete
  await pool.execute('UPDATE campaigns SET views_done = views_done + 1 WHERE id = ?', [task.campaign_id]);
  await pool.execute(
    `UPDATE campaigns SET status = 'completed' WHERE id = ? AND views_done >= total_views AND status != 'completed'`,
    [task.campaign_id]
  );

  // Traffic log
  const today = new Date().toISOString().slice(0, 10);
  const ua = (task.user_agent || '').toLowerCase();
  const isTablet = /ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(ua);
  const isMobile = !isTablet && /mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua);
  const deviceCol = isTablet ? 'tablet_views' : isMobile ? 'mobile_views' : 'desktop_views';

  const [logs] = await pool.execute('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = ?', [task.campaign_id, today]);
  if (logs.length > 0) {
    await pool.execute(`UPDATE traffic_logs SET clicks = clicks + 1, ${deviceCol} = ${deviceCol} + 1 WHERE id = ?`, [logs[0].id]);
  } else {
    await pool.execute(
      `INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source, ${deviceCol}) VALUES (?, ?, 1, 1, 1, ?, 1)`,
      [task.campaign_id, today, campaign.traffic_type || 'google_search']
    );
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
  if (task.worker_id && !task.worker_link_id) {
    paidWorkerId = task.worker_id;
    await ensureWalletCredit(pool, task.worker_id, 'earning', earning);
    const refCode = 'VL-' + Date.now();
    await pool.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, 'earning', 'earning', 'system', ?, 'completed', ?, ?)`,
      [task.worker_id, earning, refCode, `Vượt link task #${task.id}`]
    );
  }

  // Pay gateway link creator
  let destinationUrl = null;
  if (task.worker_link_id) {
    try {
      const [wlRows] = await pool.execute('SELECT * FROM worker_links WHERE id = ?', [task.worker_link_id]);
      if (wlRows.length) {
        const wl = wlRows[0];
        destinationUrl = wl.destination_url;
        paidWorkerId = wl.worker_id;
        await ensureWalletCredit(pool, wl.worker_id, 'earning', earning);
        await pool.execute('UPDATE worker_links SET completed_count = completed_count + 1, earning = earning + ? WHERE id = ?', [earning, wl.id]);
        const refCode = 'GL-' + Date.now();
        await pool.execute(
          `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
           VALUES (?, 'earning', 'earning', 'gateway_link', ?, 'completed', ?, ?)`,
          [wl.worker_id, earning, refCode, `Gateway link /v/${wl.slug} task #${task.id}`]
        );
      }
    } catch (e) { console.error('[VuotLink] Gateway link pay error:', e.message); }
  }

  // Worker referral commission — pay referrer when worker earns
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
            await ensureWalletCredit(pool, referrerId, 'commission', commAmount
            );
            const commRef = `COMM-WORKER-${Date.now()}`;
            await pool.execute(
              `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
               VALUES (?, 'commission', 'commission', 'referral', ?, 'completed', ?, ?)`,
              [referrerId, commAmount, commRef, `Hoa hồng ${commPct}% từ worker vượt link (${earning} đ)`]
            );
          }
        }
      }
    } catch (e) { console.error('[VuotLink] Worker referral commission error:', e.message); }
  }

  console.log(`[VuotLink] Task #${task.id} VERIFIED — code=${code}, earning=${earning}`);

  // Log security event at completion
  try {
    let secDetail = {};
    try { secDetail = JSON.parse(task.security_detail || '{}'); } catch { }
    const flagged = (secDetail.assessments || []).some(a => a.flagged);
    logSecurityEvent(flagged ? 'bot_behavior' : 'completed', task.ip_address, task.user_agent, task.visitor_id, {
      ...secDetail, taskId: task.id, source: 'vuotlink', timeOnSite, earning,
    });
  } catch (e) { }

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

    const [todayTasks] = await pool.execute(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(earning),0) as earn FROM vuot_link_tasks WHERE worker_id = ? AND status = 'completed' AND DATE(completed_at) = CURDATE()`,
      [uid]
    );
    const [totalTasks] = await pool.execute(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(earning),0) as earn FROM vuot_link_tasks WHERE worker_id = ? AND status = 'completed'`,
      [uid]
    );
    const [pendingTasks] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE worker_id = ? AND status = 'pending'`,
      [uid]
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
       FROM vuot_link_tasks WHERE worker_id = ? AND status = 'completed' AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(completed_at) ORDER BY day`,
      [uid]
    );

    // Recent tasks
    const [recent] = await pool.execute(
      `SELECT t.id, c.name as campaign_name, t.status, t.earning, t.completed_at, t.created_at
       FROM vuot_link_tasks t JOIN campaigns c ON t.campaign_id = c.id
       WHERE t.worker_id = ? ORDER BY t.created_at DESC LIMIT 10`,
      [uid]
    );

    // Total remaining views across all running campaigns
    const [remRows] = await pool.execute(
      `SELECT COALESCE(SUM(GREATEST(total_views - views_done, 0)), 0) as remaining FROM campaigns WHERE status = 'running'`
    );

    res.json({
      today: { tasks: todayTasks[0].cnt, earnings: Number(todayTasks[0].earn) },
      total: { tasks: totalTasks[0].cnt, earnings: Number(totalTasks[0].earn) },
      pending: pendingTasks[0].cnt,
      remainingViews: Number(remRows[0].remaining),
      balance: walletMap.earning || 0,
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

    let where = 't.worker_id = ?';
    const params = [uid];
    if (status && status !== 'all') { where += ' AND t.status = ?'; params.push(status); }

    const [countR] = await pool.execute(`SELECT COUNT(*) as c FROM vuot_link_tasks t WHERE ${where}`, params);
    const [tasks] = await pool.execute(
      `SELECT t.id, c.name as campaign_name, c.url as campaign_url, t.keyword, t.status, t.earning, t.code_given, t.completed_at, t.created_at
       FROM vuot_link_tasks t JOIN campaigns c ON t.campaign_id = c.id
       WHERE ${where} ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [stats] = await pool.execute(
      `SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status='completed' THEN earning ELSE 0 END),0) as totalEarnings,
       SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed
       FROM vuot_link_tasks WHERE worker_id = ?`,
      [uid]
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

    const [daily] = await pool.execute(
      `SELECT DATE(completed_at) as date, COUNT(*) as tasks, COALESCE(SUM(earning),0) as earnings
       FROM vuot_link_tasks WHERE worker_id = ? AND status = 'completed' AND completed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(completed_at) ORDER BY date DESC`,
      [uid, days]
    );

    const [summary] = await pool.execute(
      `SELECT COALESCE(SUM(earning),0) as total, COUNT(*) as tasks
       FROM vuot_link_tasks WHERE worker_id = ? AND status = 'completed' AND completed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [uid, days]
    );

    const [todayR] = await pool.execute(
      `SELECT COALESCE(SUM(earning),0) as earn FROM vuot_link_tasks WHERE worker_id = ? AND status = 'completed' AND DATE(completed_at) = CURDATE()`,
      [uid]
    );

    res.json({
      daily,
      summary: { total: Number(summary[0].total), tasks: summary[0].tasks, avgDaily: daily.length > 0 ? Math.round(Number(summary[0].total) / daily.length) : 0 },
      today: Number(todayR[0].earn),
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
    res.json({ balance: map.earning || 0, main: map.main || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
