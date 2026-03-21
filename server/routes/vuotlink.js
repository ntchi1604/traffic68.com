const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { analyzeBehavior } = require('../lib/behavior');

const router = express.Router();
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

  const { challengeId, visitorId, botDetection, probes: clientProbes, behavioral } = req.body || {};

  // ── Collect detection results (saved to DB later) ──
  let botDetected = false;
  let detectionLog = [];

  // ── 1. Challenge validation (anti-replay) ──
  if (!challengeId) return res.status(403).json(ERR);
  const ch = challenges[challengeId];
  if (!ch) return res.status(403).json(ERR);
  if (ch.used) { delete challenges[challengeId]; return res.status(403).json(ERR); }
  if (Date.now() - ch.createdAt > 300000) { delete challenges[challengeId]; return res.status(403).json(ERR); }
  if (ch.ip && ch.ip !== ip) return res.status(403).json(ERR);
  ch.used = true;

  // ── 2. CreepJS check — any lie = block ──
  if (botDetection && (botDetection.bot === true || botDetection.totalLied > 0)) {
    console.log(`[VuotLink] 🚫 CreepJS BLOCKED: IP=${ip}, totalLied=${botDetection.totalLied}, sections=${JSON.stringify(botDetection.liedSections)}`);
    logSecurityEvent('creep_detected', ip, ua, visitorId, botDetection);
    botDetected = true;
    detectionLog.push('creep_detected');
    return res.status(403).json(ERR);
  }

  const probes = clientProbes || {};
  if (probes.webdriver === true || probes.cdc === true || probes.selenium === true) {
    console.log(`[VuotLink] 🤖 Automation probe hit: IP=${ip}`);
    return res.status(403).json(ERR);
  }

  const pool = getPool();
  if (visitorId && visitorId !== 'unknown') {
    const [vCount] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM vuot_link_tasks WHERE visitor_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) AND status = 'completed'`,
      [visitorId]
    );
    if (vCount[0].cnt >= 5) {
      console.log(`[VuotLink] Device limit: visitorId=${visitorId.substring(0,8)}..., count=${vCount[0].cnt}`);
      return res.status(429).json({ error: 'Thiết bị đã đạt giới hạn 5 lượt/ngày. Thử lại sau.' });
    }
  }

  console.log(`[VuotLink] ✅ PASS: IP=${ip}, visitor=${visitorId?.substring(0,8) || '?'}`);

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

  // Session expires after campaign waitTime + 3 minutes buffer
  const expirySeconds = waitTime + 180;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const [result] = await pool.execute(
    `INSERT INTO vuot_link_tasks (campaign_id, worker_id, keyword, target_url, target_page, status, ip_address, user_agent, code_given, visitor_id, bot_detected, expires_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [campaign.id, req.userId || null, campaign.keyword, campaign.url, campaign.target_page || '', ip, ua, randomCode, visitorId || null, botDetected ? 1 : 0, expirySeconds]
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

  // Log security event at completion with behavioral assessment from widget
  try {
    let secDetail = {};
    try { secDetail = JSON.parse(task.security_detail || '{}'); } catch {}
    const hasDetail = secDetail.assessments || secDetail.behaviorScore !== undefined;
    const reason = (secDetail.behaviorScore || 0) >= 30 ? 'suspicious' : 'completed';
    logSecurityEvent(reason, task.ip_address, task.user_agent, task.visitor_id, {
      ...secDetail,
      taskId: task.id,
      source: 'vuotlink',
      timeOnSite,
      earning,
    });
  } catch (e) { }

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
