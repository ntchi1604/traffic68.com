/**
 * Anti-Bot Behavioral Validator v1.0
 * Server-side scoring logic — Express middleware
 * Phân tích mouse trail, WebGL, headless flags, timing
 */

const XOR_KEY = 'T68s3cur1ty';

/* ── Giải mã XOR + Base64 ─────────────────────────────── */
function xorDecode(encoded) {
  const raw = Buffer.from(encoded, 'base64').toString('binary');
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(raw.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
  }
  return JSON.parse(out);
}

/* ── Phân tích đường chuột ─────────────────────────────── */
function analyzeMouseTrail(points) {
  const result = { score: 0, reasons: [] };

  if (!points || points.length < 5) {
    result.score += 40;
    result.reasons.push('too_few_points');
    return result;
  }

  // 1. Tính khoảng cách và vận tốc giữa các điểm
  const velocities = [];
  const angles = [];
  let totalDistance = 0;
  let straightLineViolations = 0;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const dt = points[i].t - points[i - 1].t;
    const dist = Math.sqrt(dx * dx + dy * dy);
    totalDistance += dist;

    if (dt > 0) {
      const velocity = dist / dt; // pixels per ms
      velocities.push(velocity);

      // Phát hiện nhảy cóc: khoảng cách lớn + thời gian quá ngắn
      if (dist > 200 && dt < 10) {
        result.score += 15;
        result.reasons.push('teleport_detected');
      }
    }

    // Tính góc để phát hiện đường thẳng
    if (i >= 2) {
      const dx2 = points[i - 1].x - points[i - 2].x;
      const dy2 = points[i - 1].y - points[i - 2].y;
      const angle1 = Math.atan2(dy, dx);
      const angle2 = Math.atan2(dy2, dx2);
      const angleDiff = Math.abs(angle1 - angle2);
      angles.push(angleDiff);
    }
  }

  // 2. Phát hiện đường thẳng hoàn hảo (bot di chuyển chuột thẳng)
  if (angles.length > 3) {
    const avgAngleDiff = angles.reduce((a, b) => a + b, 0) / angles.length;
    if (avgAngleDiff < 0.01) {
      result.score += 30;
      result.reasons.push('perfect_straight_line');
    }
  }

  // 3. Phát hiện vận tốc đồng đều (bot di chuyển ở tốc độ cố định)
  if (velocities.length > 5) {
    const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVel, 2), 0) / velocities.length;
    const stdDev = Math.sqrt(variance);
    const cv = avgVel > 0 ? stdDev / avgVel : 0; // Coefficient of variation

    // Con người có vận tốc biến đổi cao (cv > 0.3), bot gần như đồng đều
    if (cv < 0.1) {
      result.score += 25;
      result.reasons.push('uniform_velocity');
    }
  }

  // 4. Phát hiện điểm trùng lặp (replay attack)
  const uniquePoints = new Set(points.map(p => `${p.x},${p.y}`));
  if (uniquePoints.size < points.length * 0.5) {
    result.score += 20;
    result.reasons.push('duplicate_points');
  }

  // 5. Phát hiện timestamp không tự nhiên (khoảng cách đều nhau)
  if (points.length > 5) {
    const timeDiffs = [];
    for (let i = 1; i < points.length; i++) {
      timeDiffs.push(points[i].t - points[i - 1].t);
    }
    const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    const timeVariance = timeDiffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / timeDiffs.length;
    if (timeVariance < 1) { // timestamps quá đều = fake
      result.score += 20;
      result.reasons.push('uniform_timestamps');
    }
  }

  return result;
}

/* ── Scoring chính ─────────────────────────────────────── */
function validateBehavior(payload) {
  let score = 0;
  const reasons = [];

  // 1. Check thời gian load → click (< 3s = bot)
  if (payload.lt < 3000) {
    score += 30;
    reasons.push('click_too_fast');
  } else if (payload.lt < 5000) {
    score += 10;
    reasons.push('click_fast');
  }

  // 2. Check headless flags
  if (payload.hd > 0) {
    // Bit 0 = webdriver (strongest signal)
    if (payload.hd & 1) { score += 50; reasons.push('webdriver_detected'); }
    // Bit 1 = no plugins
    if (payload.hd & 2) { score += 10; reasons.push('no_plugins'); }
    // Bit 2 = no languages
    if (payload.hd & 4) { score += 10; reasons.push('no_languages'); }
    // Bit 3 = Chrome without chrome object
    if (payload.hd & 8) { score += 15; reasons.push('fake_chrome'); }
    // Bit 5 = Phantom/Nightmare
    if (payload.hd & 32) { score += 50; reasons.push('phantom_detected'); }
    // Bit 6 = webdriver attribute
    if (payload.hd & 64) { score += 50; reasons.push('webdriver_attr'); }
    // Bit 7 = zero screen size
    if (payload.hd & 128) { score += 20; reasons.push('zero_screen'); }
  }

  // 3. Check WebGL
  if (payload.wgl === 'no-webgl' || payload.wgl === 'error') {
    score += 15;
    reasons.push('no_webgl');
  }

  // 4. Check Canvas 2D
  if (payload.c2d === 'error') {
    score += 15;
    reasons.push('no_canvas');
  }

  // 5. Check interaction counts (0 interactions = sus)
  if (payload.ic) {
    if (payload.ic.clicks === 0 && payload.ic.keys === 0 && payload.ic.scrolls === 0) {
      score += 10;
      reasons.push('no_interactions');
    }
  }

  // 6. Check screen info
  if (payload.sc) {
    if (payload.sc.w === 0 || payload.sc.h === 0) {
      score += 20;
      reasons.push('invalid_screen');
    }
  }

  // 7. Phân tích chuột (quan trọng nhất)
  const mouseResult = analyzeMouseTrail(payload.m);
  score += mouseResult.score;
  reasons.push(...mouseResult.reasons);

  return {
    score,          // 0-100+, cao = khả năng bot cao
    isBot: score >= 40,
    reasons,
    details: {
      mousePoints: payload.m ? payload.m.length : 0,
      loadTime: payload.lt,
      headlessFlags: payload.hd,
      webgl: payload.wgl,
      canvas2d: payload.c2d,
    },
  };
}

/* ── Export ─────────────────────────────────────────────── */
module.exports = { xorDecode, validateBehavior, analyzeMouseTrail };
