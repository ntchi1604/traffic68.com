const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const BOT_UA = /bot|crawler|spider|curl|wget|python|httpie|postman|insomnia|axios|node-fetch|headlesschrome|phantomjs|selenium/i;
const HMAC_SECRET = process.env.CHALLENGE_KEY || crypto.randomBytes(32).toString('hex');

// Generate HMAC token for task (binds task to IP+UA)
function signTask(taskId, ip) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(`${taskId}|${ip}`).digest('hex').substring(0, 24);
}

function verifyTaskToken(token, taskId, ip) {
  const expected = signTask(taskId, ip);
  return token === expected;
}

const ipTaskCount = {};
const deviceTaskCount = {};  // deviceId -> count per hour
setInterval(() => { Object.keys(ipTaskCount).forEach(k => delete ipTaskCount[k]); Object.keys(deviceTaskCount).forEach(k => delete deviceTaskCount[k]); }, 3600000);

const challenges = {};
setInterval(() => {
  const now = Date.now();
  Object.keys(challenges).forEach(k => { if (now - challenges[k].createdAt > 120000) delete challenges[k]; });
}, 30000);

/* ── A. Hash uniqueness tracking ─────────────────────── */
const hashIpMap = {};   // webglHash -> Set<ip>
const hashIpTimers = {}; // webglHash -> timestamp
setInterval(() => {
  const now = Date.now();
  Object.keys(hashIpMap).forEach(h => {
    if (now - (hashIpTimers[h] || 0) > 3600000) {
      delete hashIpMap[h]; delete hashIpTimers[h];
    }
  });
}, 300000); // cleanup every 5 min

function trackHash(hash, ip) {
  if (!hashIpMap[hash]) { hashIpMap[hash] = new Set(); hashIpTimers[hash] = Date.now(); }
  hashIpMap[hash].add(ip);
  return hashIpMap[hash].size;
}

/* ── C. Dynamic PoW difficulty ───────────────────────── */
const POW_NORMAL = '0000';    // 4 zeros = ~65K iter (normal user)
const POW_SUSPECT = '00000';  // 5 zeros = ~1M iter (suspicious IP)
const POW_HARD = '000000';    // 6 zeros = ~16M iter (datacenter IP)

// Simple datacenter/hosting IP detection
function getIpRisk(ip) {
  const count = ipTaskCount[ip] || 0;
  if (count > 25) return 'hard';    // >25 tasks/hour = datacenter/bot
  if (count > 15) return 'suspect'; // >15 tasks/hour = suspicious
  return 'normal';                  // ≤15 = normal user (F5 vài lần OK)
}

function getPowDifficulty(ip) {
  const risk = getIpRisk(ip);
  if (risk === 'hard') return POW_HARD;
  if (risk === 'suspect') return POW_SUSPECT;
  return POW_NORMAL;
}

function generateJsChallenge() {
  const v = 'abcdefghijklmnopqrstuvwxyz'.split('').sort(() => Math.random() - 0.5);
  const a = Math.floor(Math.random() * 90) + 10;
  const b = Math.floor(Math.random() * 90) + 10;
  const c = Math.floor(Math.random() * 50) + 5;
  const domVal = Math.floor(Math.random() * 500) + 100;
  const mathResult = ((a * b) + c) % 9973;
  const expected = domVal + mathResult;
  const jsCode = `(function(){var ${v[0]}=0;try{var ${v[4]}=document.createElement('canvas');var ${v[5]}=${v[4]}.getContext('2d');if(${v[5]}){${v[5]}.fillText('t',0,0);${v[0]}=${domVal}}}catch(e){}var ${v[1]}=${a};var ${v[2]}=${b};var ${v[3]}=${c};return ${v[0]}+((${v[1]}*${v[2]})+${v[3]})%9973})()`;
  return { jsCode, expected };
}

function generateCanvasChallenge() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 8; i++) text += chars[Math.floor(Math.random() * chars.length)];
  const fontSize = Math.floor(Math.random() * 20) + 14;
  const color = `rgb(${Math.floor(Math.random()*200)+50},${Math.floor(Math.random()*200)+50},${Math.floor(Math.random()*200)+50})`;
  return { text, fontSize, color };
}

// WebGL seed — uses canvas.text as target_text + random geometry
function generateWebGLSeed(targetText) {
  const r = () => (Math.random() * 1.6 - 0.8).toFixed(3);
  return {
    v: [parseFloat(r()), parseFloat(r()), parseFloat(r()), parseFloat(r()), parseFloat(r()), parseFloat(r())],
    bg: [Math.random().toFixed(2), Math.random().toFixed(2), Math.random().toFixed(2)].map(Number),
    fg: [Math.random().toFixed(2), Math.random().toFixed(2), Math.random().toFixed(2)].map(Number),
    text: targetText, // MUST render this text as texture on WebGL canvas
  };
}

/* ── Header Fingerprint Scoring (detect curl_cffi) ───── */
function scoreHeaders(req) {
  let suspicion = 0;
  const h = req.headers;

  // Chrome sends sec-ch-ua headers; curl_cffi often doesn't or sends wrong values
  if (!h['sec-ch-ua']) suspicion += 10;
  if (!h['sec-ch-ua-mobile']) suspicion += 5;
  if (!h['sec-ch-ua-platform']) suspicion += 5;

  // Real browser fetch sends sec-fetch-* headers
  if (!h['sec-fetch-site']) suspicion += 10;
  if (!h['sec-fetch-mode']) suspicion += 5;

  // accept-language should exist
  if (!h['accept-language']) suspicion += 10;

  // accept-encoding should contain gzip
  const ae = h['accept-encoding'] || '';
  if (!ae.includes('gzip')) suspicion += 5;

  // Connection header typically "keep-alive" from browser
  if (h['connection'] && h['connection'] === 'close') suspicion += 5;

  // Origin or Referer should exist for POST from browser
  if (req.method === 'POST' && !h['origin'] && !h['referer']) suspicion += 10;

  return suspicion;
}

// Anti-replay: track used hash pairs per IP
const usedHashes = {}; // ip -> Set<canvasHash+webglHash>
setInterval(() => { Object.keys(usedHashes).forEach(k => delete usedHashes[k]); }, 3600000);



/* ═════════════════════════════════════════════════════════
   STEP 1: GET challenge
═════════════════════════════════════════════════════════ */
router.get('/challenge', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (!ua || BOT_UA.test(ua)) return res.status(403).json({ error: 'Blocked' });
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  const challengeId = crypto.randomBytes(16).toString('hex');
  const { jsCode, expected } = generateJsChallenge();
  const pow = crypto.randomBytes(16).toString('hex');
  const canvas = generateCanvasChallenge();
  const webgl = generateWebGLSeed(canvas.text);
  const powDiff = getPowDifficulty(ip);
  challenges[challengeId] = { expected, createdAt: Date.now(), used: false, ip, pow, canvas, webgl, powDiff };
  res.json({ c: challengeId, j: jsCode, pow, canvas, webgl, powDiff });
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
  if (ipTaskCount[ip] > 30) { console.log('VuotLink blocked: IP rate limit exceeded', ip); return res.status(403).json(ERR); }

  // Header fingerprint check (detect curl_cffi)
  const headerScore = scoreHeaders(req);
  if (headerScore >= 30) {
    console.log(`VuotLink blocked: header fingerprint score=${headerScore}, IP=${ip}`);
    return res.status(403).json(ERR);
  }

  const { challengeId, jsResult, proof, powNonce, canvasHash, webglHash, deviceId } = req.body || {};

  // Device fingerprint rate limit
  if (deviceId && deviceId !== 'unknown') {
    deviceTaskCount[deviceId] = (deviceTaskCount[deviceId] || 0) + 1;
    if (deviceTaskCount[deviceId] > 5) {
      console.log(`VuotLink blocked: device rate limit, deviceId=${deviceId.substring(0,8)}..., IP=${ip}`);
      return res.status(429).json({ error: 'Thiết bị đã đạt giới hạn. Thử lại sau.' });
    }
  }

  if (!challengeId || jsResult === undefined) { console.log('VuotLink blocked: missing challengeId or jsResult'); return res.status(403).json(ERR); }

  const ch = challenges[challengeId];
  if (!ch) { console.log('VuotLink blocked: challenge not found', challengeId); return res.status(403).json(ERR); }
  if (ch.used) { delete challenges[challengeId]; console.log('VuotLink blocked: challenge already used', challengeId); return res.status(403).json(ERR); }
  // XK expiry: 5 minutes max
  if (Date.now() - ch.createdAt > 300000) { delete challenges[challengeId]; console.log('VuotLink blocked: challenge/xk expired', challengeId); return res.status(403).json(ERR); }
  if (Number(jsResult) !== ch.expected) { console.log('VuotLink blocked: jsResult mismatch', jsResult, 'expected', ch.expected); return res.status(403).json(ERR); }
  // Anti-cheat: challenge must come from same IP
  if (ch.ip && ch.ip !== ip) { console.log('VuotLink blocked: IP mismatch', ip, '!=', ch.ip); return res.status(403).json(ERR); }
  // Anti-cheat: verify Proof-of-Work (dynamic difficulty)
  if (!powNonce || typeof powNonce !== 'string') { console.log('VuotLink blocked: no PoW nonce'); return res.status(403).json(ERR); }
  const powHash = crypto.createHash('sha256').update(ch.pow + powNonce).digest('hex');
  const requiredDiff = ch.powDiff || POW_NORMAL;
  if (!powHash.startsWith(requiredDiff)) { console.log(`VuotLink blocked: PoW invalid (need ${requiredDiff})`, powHash.substring(0, 12)); return res.status(403).json(ERR); }
  // Anti-cheat: verify canvas 2D fingerprint
  if (!canvasHash || typeof canvasHash !== 'string' || !/^[a-f0-9]{64}$/.test(canvasHash)) {
    console.log('VuotLink blocked: invalid canvas hash'); return res.status(403).json(ERR);
  }
  // Anti-cheat: verify WebGL 3D fingerprint
  if (!webglHash || typeof webglHash !== 'string' || !/^[a-f0-9]{64}$/.test(webglHash)) {
    console.log('VuotLink blocked: invalid WebGL hash'); return res.status(403).json(ERR);
  }
  // Cross-validate canvas 2D vs WebGL 3D
  if (canvasHash === webglHash) {
    console.log('VuotLink blocked: canvas/webgl identical — spoofing'); return res.status(403).json(ERR);
  }
  const ZERO_HASH_PREFIX = '0000000000';
  if (canvasHash.startsWith(ZERO_HASH_PREFIX) || webglHash.startsWith(ZERO_HASH_PREFIX)) {
    console.log('VuotLink blocked: zero-data hash'); return res.status(403).json(ERR);
  }

  // A. Hash uniqueness: block if same webglHash used by >50 IPs
  const hashIpCount = trackHash(webglHash, ip);
  if (hashIpCount > 50) {
    console.log(`VuotLink blocked: webglHash shared by ${hashIpCount} IPs — bot farm`);
    return res.status(403).json(ERR);
  }

  // Anti-replay: same hash pair can't be used twice from same IP
  const hashPair = canvasHash + '|' + webglHash;
  if (!usedHashes[ip]) usedHashes[ip] = new Set();
  if (usedHashes[ip].has(hashPair)) {
    console.log('VuotLink blocked: hash replay detected', ip);
    return res.status(403).json(ERR);
  }
  usedHashes[ip].add(hashPair);

  ch.used = true;

  // ═══════════════════════════════════════════════════════
  //  SERVER-SIDE SECURITY (don't trust client data blindly)
  // ═══════════════════════════════════════════════════════

  const { botDetection, fingerprint, behavioral } = req.body || {};
  let serverBotScore = 0;             // 0-100, ≥60 = block

  // ── 1. Challenge solve timing ──
  // Real user: page load + PoW mining + render = at least 3 seconds
  const solveTime = Date.now() - ch.createdAt;
  if (solveTime < 3000) {
    serverBotScore += 40;
    console.log(`[VuotLink] ⚠️ Too fast: ${solveTime}ms, IP=${ip}`);
  } else if (solveTime < 5000) {
    serverBotScore += 15;
  }

  // ── 2. BotD result (signal, not final verdict) ──
  if (botDetection && botDetection.bot === true) {
    serverBotScore += 30;
    console.log(`[VuotLink] BotD flag: IP=${ip}`);
  }

  // ── 3. Missing behavioral data = suspicious ──
  if (!behavioral) {
    serverBotScore += 25;
    console.log(`[VuotLink] ⚠️ No behavioral data, IP=${ip}`);
  } else {
    // Zero screen = headless
    if (!behavioral.screen?.w || !behavioral.screen?.h) {
      serverBotScore += 30;
    }
    // No interaction at all = automated
    if (behavioral.mousePoints === 0 && behavioral.clicks === 0 && behavioral.keys === 0) {
      serverBotScore += 35;
      console.log(`[VuotLink] ⚠️ Zero interaction, IP=${ip}`);
    }
    // Suspiciously fast page load
    if (behavioral.loadTime && behavioral.loadTime < 2000) {
      serverBotScore += 15;
    }

    // ── 4. Mouse trajectory analysis (server-side, can't be easily faked) ──
    const trail = behavioral.mouseTrail;
    if (trail && Array.isArray(trail) && trail.length >= 5) {
      // Check for perfectly linear movement (bot draws straight lines)
      let linearCount = 0;
      let constantVelocity = 0;
      let prevDx = null, prevDy = null;

      for (let i = 2; i < trail.length; i++) {
        const dx1 = trail[i].x - trail[i - 1].x;
        const dy1 = trail[i].y - trail[i - 1].y;
        const dx0 = trail[i - 1].x - trail[i - 2].x;
        const dy0 = trail[i - 1].y - trail[i - 2].y;

        // Cross product ≈ 0 means collinear (straight line)
        const cross = Math.abs(dx1 * dy0 - dy1 * dx0);
        if (cross < 2) linearCount++;

        // Check constant velocity (bots move at exact same speed)
        const speed1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const speed0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
        if (speed0 > 0 && Math.abs(speed1 - speed0) < 1) constantVelocity++;
      }

      const linearRatio = linearCount / (trail.length - 2);
      const velocityRatio = constantVelocity / (trail.length - 2);

      if (linearRatio > 0.8) {
        serverBotScore += 25;
        console.log(`[VuotLink] ⚠️ Linear mouse: ${(linearRatio * 100).toFixed(0)}%, IP=${ip}`);
      }
      if (velocityRatio > 0.7) {
        serverBotScore += 20;
        console.log(`[VuotLink] ⚠️ Constant velocity: ${(velocityRatio * 100).toFixed(0)}%, IP=${ip}`);
      }

      // All points have identical timestamps (fake data injection)
      const uniqueTimes = new Set(trail.map(p => p.t)).size;
      if (uniqueTimes <= 2 && trail.length > 5) {
        serverBotScore += 30;
        console.log(`[VuotLink] ⚠️ Fake timestamps: only ${uniqueTimes} unique, IP=${ip}`);
      }

      // Points outside reasonable screen range
      const outOfBounds = trail.filter(p => p.x < 0 || p.y < 0 || p.x > 4000 || p.y > 3000).length;
      if (outOfBounds > trail.length * 0.3) {
        serverBotScore += 20;
      }
    } else if (behavioral.mousePoints > 0 && (!trail || trail.length < 3)) {
      // Claims mouse points but no trail data = spoofed
      serverBotScore += 20;
    }
  }

  // ── 5. Missing fingerprint = suspicious ──
  if (!fingerprint) {
    serverBotScore += 15;
  } else {
    // Headless browsers often have 0 plugins, 0 fonts
    if (fingerprint.fonts === 0 && fingerprint.plugins === 0) {
      serverBotScore += 20;
      console.log(`[VuotLink] ⚠️ Zero fonts+plugins (headless?), IP=${ip}`);
    }
  }

  // ── 6. Honeypot: check for fields that shouldn't exist ──
  const { _hp, email } = req.body || {};
  if (_hp || email) {
    serverBotScore += 50;
    console.log(`[VuotLink] 🍯 Honeypot triggered, IP=${ip}`);
  }

  // ═══ FINAL VERDICT ═══
  console.log(`[VuotLink] BotScore=${serverBotScore}, IP=${ip}, device=${deviceId?.substring(0,8) || '?'}, solve=${solveTime}ms`);

  if (serverBotScore >= 60) {
    console.log(`[VuotLink] 🤖 BLOCKED: score=${serverBotScore}, IP=${ip}`);
    return res.status(403).json(ERR);
  }

  // ── FingerprintJS components log ──
  if (fingerprint) {
    console.log(`[VuotLink] FP: fonts=${fingerprint.fonts}, plugins=${fingerprint.plugins}, platform=${fingerprint.platform}, tz=${fingerprint.timezone}`);
  }

  const pool = getPool();

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
    `INSERT INTO vuot_link_tasks (campaign_id, worker_id, keyword, target_url, target_page, status, ip_address, user_agent, code_given, expires_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [campaign.id, req.userId || null, campaign.keyword, campaign.url, campaign.target_page || '', ip, ua, randomCode, expirySeconds]
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
