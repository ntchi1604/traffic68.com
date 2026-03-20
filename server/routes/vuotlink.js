const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const BOT_UA = /bot|crawler|spider|curl|wget|python|httpie|postman|insomnia|axios|node-fetch|headlesschrome|phantomjs|selenium/i;
const HMAC_SECRET = process.env.CHALLENGE_KEY || crypto.randomBytes(32).toString('hex');

// Log security events to DB for admin visibility
async function logSecurityEvent(reason, ip, ua, visitorId, extra) {
  try {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO security_logs (source, reason, ip_address, user_agent, visitor_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      ['vuotlink', reason, ip || null, (ua || '').substring(0, 500), visitorId || null, JSON.stringify(extra || {}).substring(0, 2000)]
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
   MOUSE TRAJECTORY ANALYSIS (server-side)
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

  // 2. Check for constant velocity (using speed variance)
  const speeds = [];
  for (let i = 1; i < trail.length; i++) {
    const dx = trail[i].x - trail[i-1].x;
    const dy = trail[i].y - trail[i-1].y;
    const dt = trail[i].t - trail[i-1].t;
    if (dt > 0) speeds.push(Math.sqrt(dx*dx + dy*dy) / dt);
  }
  if (speeds.length > 3) {
    const avgSpeed = speeds.reduce((a,b) => a+b, 0) / speeds.length;
    const speedVar = speeds.reduce((a,b) => a + (b - avgSpeed) ** 2, 0) / speeds.length;
    // Real humans have high variance (start/stop/accelerate), bots are smooth
    if (avgSpeed > 0 && speedVar / (avgSpeed ** 2) < 0.1) {
      score += 25;
      reasons.push('constant_velocity');
    }
  }

  // 3. Fake timestamps (all same or only 1-2 unique)
  const uniqueTimes = new Set(trail.map(p => p.t)).size;
  if (uniqueTimes <= 2 && trail.length > 5) {
    score += 35;
    reasons.push('fake_timestamps');
  }

  // 4. Timestamp regularity — scripts fire mousemove at fixed intervals
  if (trail.length > 10) {
    const intervals = [];
    for (let i = 1; i < trail.length; i++) intervals.push(trail[i].t - trail[i-1].t);
    const avgInt = intervals.reduce((a,b) => a+b, 0) / intervals.length;
    const intVar = intervals.reduce((a,b) => a + (b - avgInt) ** 2, 0) / intervals.length;
    if (avgInt > 0 && intVar < 2 && trail.length > 15) {
      score += 25;
      reasons.push('regular_intervals');
    }
  }

  // 5. Out of bounds coordinates
  const oob = trail.filter(p => p.x < 0 || p.y < 0 || p.x > 4000 || p.y > 3000).length;
  if (oob > trail.length * 0.3) {
    score += 20;
    reasons.push('out_of_bounds');
  }

  // 6. No direction changes — humans change direction frequently
  let dirChanges = 0;
  for (let i = 2; i < trail.length; i++) {
    const dx1 = trail[i].x - trail[i-1].x;
    const dy1 = trail[i].y - trail[i-1].y;
    const dx0 = trail[i-1].x - trail[i-2].x;
    const dy0 = trail[i-1].y - trail[i-2].y;
    if ((dx1 * dx0 + dy1 * dy0) < 0 || (Math.sign(dx1) !== Math.sign(dx0) && dx0 !== 0)) {
      dirChanges++;
    }
  }
  if (trail.length > 15 && dirChanges < 2) {
    score += 15;
    reasons.push('no_direction_changes');
  }

  // 7. Bezier curve pattern — automation libs move in perfect diagonal ratios
  let exactDiag = 0;
  for (let i = 1; i < trail.length; i++) {
    const dx = Math.abs(trail[i].x - trail[i-1].x);
    const dy = Math.abs(trail[i].y - trail[i-1].y);
    if (dx === dy && dx > 2) exactDiag++;
  }
  if (exactDiag > trail.length * 0.3 && trail.length > 10) {
    score += 20;
    reasons.push('bezier_pattern');
  }

  // 8. Single axis movement (only X or only Y changes) — script moves linearly
  let xOnly = 0, yOnly = 0;
  for (let i = 1; i < trail.length; i++) {
    if (trail[i].x !== trail[i-1].x && trail[i].y === trail[i-1].y) xOnly++;
    if (trail[i].y !== trail[i-1].y && trail[i].x === trail[i-1].x) yOnly++;
  }
  if ((xOnly > trail.length * 0.9 || yOnly > trail.length * 0.9) && trail.length > 10) {
    score += 20;
    reasons.push('single_axis');
  }

  return { score, reasons };
}

/* ═══════════════════════════════════════════════════════════
   STEP 1: GET /challenge (anti-replay token only)
═══════════════════════════════════════════════════════════ */
router.get('/challenge', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (!ua || BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  const challengeId = crypto.randomBytes(16).toString('hex');
  challenges[challengeId] = { createdAt: Date.now(), used: false, ip };
  res.json({ c: challengeId });
});

/* ═════════════════════════════════════════════════════════
   STEP 2: POST task — create session + generate code
   - Stores IP, UA, random code in vuot_link_tasks
   - Code will be shown on the target website embed script
═════════════════════════════════════════════════════════ */
router.post('/task', optionalAuth, async (req, res) => {
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

  const { challengeId, visitorId, botDetection, behavioral } = req.body || {};

  // ── Collect detection results (saved to DB later) ──
  let botDetected = false;
  let mouseScore = 0;
  let mouseReasons = '';
  let detectionLog = [];

  // ── 1. Challenge validation (anti-replay) ──
  if (!challengeId) return res.status(403).json(ERR);
  const ch = challenges[challengeId];
  if (!ch) return res.status(403).json(ERR);
  if (ch.used) { delete challenges[challengeId]; return res.status(403).json(ERR); }
  if (Date.now() - ch.createdAt > 300000) { delete challenges[challengeId]; return res.status(403).json(ERR); }
  if (ch.ip && ch.ip !== ip) return res.status(403).json(ERR);
  ch.used = true;

  // ── 2. CreepJS / BotD check ──
  if (botDetection) {
    const lies = botDetection.lies;
    const hasLies = Array.isArray(lies) ? lies.length > 0 : (typeof lies === 'number' ? lies > 0 : !!lies);
    const isBot = botDetection.bot === true || hasLies;
    if (isBot) {
      botDetected = true;
      detectionLog.push('creep_detected');
      console.log(`[VuotLink] 🤖 CreepJS detected: IP=${ip}, bot=${botDetection.bot}, lies=${JSON.stringify(lies).substring(0, 200)}`);
      logSecurityEvent('creep_detected', ip, ua, visitorId, botDetection);
      return res.status(403).json(ERR);
    }
  }

  // ── 2b. Client-side automation probes ──
  const probes = behavioral?.probes || {};
  if (probes.webdriver === true || probes.cdc === true || probes.selenium === true) {
    console.log(`[VuotLink] 🤖 Automation probe hit: IP=${ip}, webdriver=${probes.webdriver}, cdc=${probes.cdc}, selenium=${probes.selenium}`);
    logSecurityEvent('automation_probes', ip, ua, visitorId, probes);
    return res.status(403).json(ERR);
  }
  // Probe warnings (not blocking but logged)
  const probeWarnings = [];
  if (probes.pluginCount === 0) probeWarnings.push('zero_plugins');
  if (probes.rtt === 0) probeWarnings.push('zero_rtt');
  if (probes.langCount === 0) probeWarnings.push('zero_languages');
  if (probes.hasChrome === true && probes.hasChromeRuntime === false) probeWarnings.push('no_chrome_runtime');
  if (probeWarnings.length > 0) {
    console.log(`[VuotLink] ⚠️ Probe warnings: IP=${ip}, ${probeWarnings.join(',')}`);
    logSecurityEvent('probe_warning', ip, ua, visitorId, { ...probes, probeWarnings });
  }

  // ── 3. VisitorId rate limit (5 tasks / 24h per device — from DB) ──
  const pool = getPool();
  if (visitorId && visitorId !== 'unknown') {
    const [vCount] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE visitor_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) AND status = 'completed'`,
      [visitorId]
    );
    if (vCount[0].cnt >= 5) {
      detectionLog.push('device_limit');
      console.log(`[VuotLink] Device limit: visitorId=${visitorId.substring(0,8)}..., count=${vCount[0].cnt}`);
      return res.status(429).json({ error: 'Thiết bị đã đạt giới hạn 5 lượt/ngày. Thử lại sau.' });
    }
  }

  // ── 4. Behavioral analysis (server-side mouse trajectory) ──
  const mousePoints = behavioral?.mousePoints || 0;
  const clicks = behavioral?.clicks || 0;
  const keys = behavioral?.keys || 0;
  const scrolls = behavioral?.scrolls || 0;

  if (behavioral && behavioral.mouseTrail) {
    const mouseResult = analyzeMouseTrail(behavioral.mouseTrail);
    mouseScore = mouseResult.score;
    mouseReasons = mouseResult.reasons.join(',');
    if (mouseResult.score >= 50) {
      detectionLog.push('mouse_bot');
      console.log(`[VuotLink] 🤖 Mouse bot: score=${mouseResult.score}, reasons=${mouseReasons}, IP=${ip}`);
      logSecurityEvent('mouse_bot', ip, ua, visitorId, { score: mouseResult.score, reasons: mouseReasons });
      return res.status(403).json(ERR);
    }
    if (mouseResult.score > 0) {
      console.log(`[VuotLink] ⚠️ Mouse warning: score=${mouseResult.score}, reasons=${mouseReasons}, IP=${ip}`);
    }
  }

  // ── 5. Zero screen = headless ──
  if (behavioral && (!behavioral.screen?.w || !behavioral.screen?.h)) {
    detectionLog.push('zero_screen');
    console.log(`[VuotLink] 🤖 Zero screen: IP=${ip}`);
    logSecurityEvent('zero_screen', ip, ua, visitorId, {});
    return res.status(403).json(ERR);
  }

  // ── 6. Suspicious pattern warnings (NOT blocked, but logged for admin) ──
  const warnings = [];

  // a) Mouse score > 0 but < 50 → suspicious but not enough to block
  if (mouseScore > 0) {
    warnings.push(`mouse_warning(score=${mouseScore})`);
  }

  // b) No interaction at all (0 clicks, 0 scrolls, 0 keys, 0 mouse) → likely script
  if (mousePoints === 0 && clicks === 0 && scrolls === 0 && keys === 0) {
    warnings.push('zero_interaction');
  }

  // c) Very fast completion (< 2s) → script auto
  if (behavioral?.loadTime && behavioral.loadTime < 2000) {
    warnings.push(`fast_load(${behavioral.loadTime}ms)`);
  }

  // g) Screen resolution commonly used by bots/VMs
  if (behavioral?.screen) {
    const { w, h } = behavioral.screen;
    if ((w === 800 && h === 600) || (w === 1024 && h === 768 && behavioral.screen.dpr === 1)) {
      warnings.push(`vm_screen(${w}x${h})`);
    }
  }

  // h) Same visitorId already has tasks today → repeat device
  if (visitorId && visitorId !== 'unknown') {
    const [todayCount] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE visitor_id = ? AND DATE(created_at) = CURDATE()`,
      [visitorId]
    );
    if (todayCount[0].cnt >= 3) {
      warnings.push(`repeat_device(${todayCount[0].cnt})`);
    }
  }

  // Log all warnings to security_logs for admin review
  if (warnings.length > 0) {
    console.log(`[VuotLink] ⚠️ SUSPICIOUS: IP=${ip}, visitor=${visitorId?.substring(0,8) || '?'}, warnings=${warnings.join(',')}`);
    logSecurityEvent('suspicious', ip, ua, visitorId, {
      warnings,
      mouseScore,
      mousePoints,
      clicks,
      scrolls,
      keys,
      loadTime: behavioral?.loadTime,
      screen: behavioral?.screen,
      botDetection: botDetection || 'null'
    });
  }

  console.log(`[VuotLink] ✅ PASS: IP=${ip}, visitor=${visitorId?.substring(0,8) || '?'}, mouse=${mousePoints}, clicks=${clicks}, mouseScore=${mouseScore}${warnings.length > 0 ? ', ⚠️warnings=' + warnings.join(',') : ''}`);

  // ── Check IP view limit ──
  const [ipSettings] = await pool.execute("SELECT setting_value FROM site_settings WHERE setting_key = 'views_per_ip'");
  const maxViewsPerIp = ipSettings.length > 0 ? parseInt(ipSettings[0].setting_value) || 2 : 2;

  const [ipCount] = await pool.execute(
    `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE ip_address = ? AND DATE(created_at) = CURDATE() AND status = 'completed'`,
    [ip]
  );
  if (ipCount[0].cnt >= maxViewsPerIp) {
    console.log(`VuotLink blocked: IP ${ip} reached daily limit (${ipCount[0].cnt}/${maxViewsPerIp})`);
    return res.status(429).json({ error: `Bạn đã đạt giới hạn ${maxViewsPerIp} lượt/ngày. Vui lòng quay lại ngày mai.` });
  }

  const [campaigns] = await pool.execute(
    `SELECT * FROM campaigns WHERE status = 'running' AND traffic_type = 'google_search' AND keyword != '' AND views_done < total_views ORDER BY RAND() LIMIT 1`
  );
  if (campaigns.length === 0) return res.status(404).json(ERR);
  const campaign = campaigns[0];

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

  // Use MySQL DATE_ADD for consistent timezone
  // Session expires after campaign waitTime + 3 minutes buffer
  const expirySeconds = waitTime + 180; // campaign duration + 3 min
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const [result] = await pool.execute(
    `INSERT INTO vuot_link_tasks (campaign_id, worker_id, keyword, target_url, target_page, status, ip_address, user_agent, code_given, visitor_id, bot_detected, mouse_score, mouse_reasons, mouse_points, clicks, expires_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [campaign.id, req.userId || null, campaign.keyword, campaign.url, campaign.target_page || '', ip, ua, randomCode, visitorId || null, botDetected ? 1 : 0, mouseScore, mouseReasons || null, mousePoints, clicks, expirySeconds]
  );

  console.log(`[VuotLink] Task #${result.insertId} created — IP: ${ip}, code: ${randomCode}, campaign: ${campaign.id}, waitTime: ${waitTime}s`);

  // Generate signed task token (binds to IP, cannot be forged)
  const _tk = signTask(result.insertId, ip);

  res.json({
    id: result.insertId,
    keyword: campaign.keyword,
    image1_url: campaign.image1_url || '',
    waitTime,
    startedAt: now,
    _tk, // signed token for subsequent calls
  });
});

/* ═════════════════════════════════════════════════════════
   STEP 3: PUT /task/:id/step — report step progress
═════════════════════════════════════════════════════════ */
router.put('/task/:id/step', optionalAuth, async (req, res) => {
  const pool = getPool();
  const { step, _tk } = req.body;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  // Anti-cheat: verify task token
  if (!_tk || !verifyTaskToken(_tk, req.params.id, ip)) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  const [tasks] = await pool.execute('SELECT * FROM vuot_link_tasks WHERE id = ?', [req.params.id]);
  if (tasks.length === 0) return res.status(404).json({ error: 'Task không tồn tại' });
  const task = tasks[0];

  // Anti-cheat: IP must match task creator
  if (task.ip_address && task.ip_address !== ip) {
    return res.status(403).json({ error: 'IP mismatch' });
  }

  // Anti-cheat: don't allow going backward (but allow same or forward)
  const stepOrder = { 'pending': 0, 'step1': 1, 'step2': 2, 'step3': 3, 'completed': 4 };
  const stepNum = stepOrder[step];
  const currentNum = stepOrder[task.status] ?? 0;
  if (stepNum === undefined || stepNum < currentNum) {
    return res.status(400).json({ error: 'Step order invalid' });
  }
  // Already at this step or beyond — just return OK (idempotent)
  if (stepNum <= currentNum) {
    return res.json({ status: task.status });
  }

  // Anti-cheat: minimum time between steps (prevent instant clicks)
  if (step === 'step1') {
    const elapsed = Date.now() - new Date(task.created_at).getTime();
    if (elapsed < 3000) { // must wait at least 3 seconds
      return res.status(403).json({ error: 'Too fast' });
    }
  }

  // Check expiry
  if (task.expires_at) {
    const [expCheck] = await pool.execute('SELECT NOW() > ? as expired', [task.expires_at]);
    if (expCheck[0]?.expired) {
      await pool.execute("UPDATE vuot_link_tasks SET status = 'expired' WHERE id = ?", [task.id]);
      return res.status(410).json({ error: 'Task đã hết hạn' });
    }
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (step === 'step1') {
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step1', step1_at = ?, ip_address = ?, user_agent = ? WHERE id = ?", [now, ip, ua, task.id]);
  } else if (step === 'step2') {
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step2', step2_at = ? WHERE id = ?", [now, task.id]);
  } else if (step === 'step3') {
    await pool.execute("UPDATE vuot_link_tasks SET status = 'step3', step3_at = ? WHERE id = ?", [now, task.id]);
  } else {
    return res.status(400).json({ error: 'Step không hợp lệ' });
  }

  res.json({ status: step });
});

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

  // Anti-cheat: must have reached step3 (visited target website)
  if (!['step3'].includes(task.status)) {
    return res.status(403).json({ error: 'Chưa hoàn thành các bước trước đó' });
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
  const [campaigns] = await pool.execute('SELECT cpc, user_id, traffic_type FROM campaigns WHERE id = ?', [task.campaign_id]);
  if (campaigns.length === 0) return res.status(404).json({ error: 'Campaign không tồn tại' });
  const campaign = campaigns[0];

  const earning = campaign.cpc;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const timeOnSite = task.step3_at ? Math.floor((new Date(now) - new Date(task.step3_at)) / 1000) : 0;

  await pool.execute(
    `UPDATE vuot_link_tasks SET status = 'completed', completed_at = ?, time_on_site = ?, earning = ? WHERE id = ?`,
    [now, timeOnSite, earning, task.id]
  );

  // Count view for campaign
  await pool.execute('UPDATE campaigns SET views_done = views_done + 1 WHERE id = ?', [task.campaign_id]);

  // Update traffic log
  const today = new Date().toISOString().slice(0, 10);
  const [logs] = await pool.execute('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = ?', [task.campaign_id, today]);
  if (logs.length > 0) {
    await pool.execute('UPDATE traffic_logs SET views = views + 1, clicks = clicks + 1 WHERE id = ?', [logs[0].id]);
  } else {
    await pool.execute('INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source) VALUES (?, ?, 1, 1, 1, ?)', [task.campaign_id, today, campaign.traffic_type || 'google_search']);
  }

  // Pay worker commission
  if (task.worker_id) {
    await pool.execute("UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = 'commission'", [earning, task.worker_id]);
    const refCode = 'VL-' + Date.now();
    await pool.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, 'commission', 'commission', 'system', ?, 'completed', ?, ?)`,
      [task.worker_id, earning, refCode, `Vượt link task #${task.id}`]
    );
  }

  console.log(`[VuotLink] Task #${task.id} VERIFIED — code=${code}, earning=${earning}`);

  res.json({ success: true, earning });
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

module.exports = router;
