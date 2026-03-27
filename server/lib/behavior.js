/**
 * behavior.js — Advanced bot detection engine v2
 *
 * Data sources:
 *   botDetection — từ CreepJS (canvas, audio, fonts, screen, hardware, headless/stealth, lies)
 *   deviceData   — từ client tự thu thập (automation flags, scroll speed, click latency, sensor)
 */

const HEADLESS_UA = /HeadlessChrome|PhantomJS/i;

// ─── Font vs OS mismatch ───
const MACOS_FONTS = ['Helvetica Neue', 'Lucida Grande', 'Geneva', 'Monaco', 'SF Pro Display', '.SF NS'];
const WIN_FONTS   = ['Segoe UI', 'Calibri', 'Consolas', 'Cambria', 'Tahoma', 'Verdana', 'Segoe Fluent Icons'];

function checkFontOsMismatch(fonts, userAgent) {
  const ua = (userAgent || '').toLowerCase();
  if (!Array.isArray(fonts) || fonts.length === 0) return null;

  const isWindowsUA = /windows/i.test(ua);
  const isMacUA     = /mac os x/i.test(ua) && !/iphone|ipad/i.test(ua);
  const isAndroidUA = /android/i.test(ua);
  const isiOSUA     = /iphone|ipad/i.test(ua);

  const hasMacFonts = MACOS_FONTS.some(f => fonts.includes(f));
  const hasWinFonts = WIN_FONTS.some(f => fonts.includes(f));

  if (isWindowsUA && hasMacFonts && !hasWinFonts) return 'Font Windows nhưng có font macOS (giả UA)';
  if (isMacUA    && hasWinFonts && !hasMacFonts)   return 'Font macOS nhưng có font Windows (giả UA)';
  if ((isAndroidUA || isiOSUA) && (hasMacFonts || hasWinFonts)) return 'Thiết bị mobile nhưng có font desktop (giả UA)';

  return null;
}

function checkScreenWindowMismatch(screenData, userAgent) {
  const ua = (userAgent || '').toLowerCase();
  if (/mobi|android|iphone|ipad/i.test(ua)) return null;
  if (!screenData) return null;

  const { width: sw, height: sh, innerWidth: ww, innerHeight: wh } = screenData;
  if (!sw || !sh || !ww || !wh) return null;

  if (sw === ww && sh === wh) return 'Kích thước màn hình = cửa sổ (trình duyệt không khung, dấu hiệu headless)';
  return null;
}

function checkHardwareInconsistency(hardware) {
  if (!hardware) return null;
  const { cores, ram } = hardware;
  if (!cores || !ram) return null;

  if (cores >= 16 && ram < 4) return `Cấu hình mâu thuẫn: ${cores} nhân CPU nhưng chỉ ${ram}GB RAM`;
  if (cores >= 8  && ram <= 2) return `Cấu hình mâu thuẫn: ${cores} nhân CPU nhưng chỉ ${ram}GB RAM`;

  return null;
}

function checkCanvasNoise(canvasData) {
  if (!canvasData) return null;
  const { hash1, hash2, noisy } = canvasData;

  if (noisy === true)               return 'Canvas bị nhiễu nhân tạo (trình duyệt anti-detect inject noise)';
  if (hash1 && hash2 && hash1 !== hash2) return 'Canvas vẽ 2 lần cho kết quả khác nhau (giả mạo fingerprint)';

  return null;
}

function checkCreepLies(botDetection) {
  if (!botDetection) return null;

  const totalLies = botDetection.totalLies || 0;

  if (totalLies >= 10)           return `Giả mạo ${totalLies} API trình duyệt (anti-detect browser)`;
  if (botDetection.canvasLied)   return 'Canvas API bị giả mạo';
  if (botDetection.audioLied)    return 'Audio API bị giả mạo';
  if (botDetection.navigatorLied) return 'Navigator API bị giả mạo';

  return null;
}

function checkClickLatency(deviceData) {
  const clicks = deviceData?.behavior?.clicks;
  if (!Array.isArray(clicks) || clicks.length < 3) return null;

  const latencies = clicks.map(c => c.duration).filter(d => typeof d === 'number' && d >= 0);
  if (latencies.length < 3) return null;

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const variance = latencies.reduce((acc, d) => acc + Math.pow(d - avg, 2), 0) / latencies.length;
  const stdDev = Math.sqrt(variance);

  if (avg < 10 && stdDev < 5)                      return 'Click quá nhanh (dưới 10ms, không thể là người thật)';
  if (avg > 0 && stdDev < 3 && latencies.length >= 5) return 'Thời gian click đều đặn bất thường (tự động hóa)';

  return null;
}

function checkScrollSpeed(deviceData) {
  const scroll = deviceData?.behavior?.scroll;
  if (!scroll) return null;

  const { totalDistance, timeMs } = scroll;
  if (!totalDistance || !timeMs) return null;

  const pps = (totalDistance / timeMs) * 1000;
  if (pps > 5000)                              return `Cuộn cực nhanh ${Math.round(pps)}px/s (bot)`;
  if (totalDistance > 3000 && timeMs < 200)    return 'Cuộn 3000px+ trong dưới 200ms (không thể thao tác tay)';

  return null;
}

function checkFakeSensor(deviceData, userAgent) {
  const motion = deviceData?.sensor?.motion;
  if (!motion) return null;

  const ua = (userAgent || '').toLowerCase();
  if (!/mobi|android|iphone|ipad/i.test(ua)) return null;

  const { samples } = motion;
  if (!Array.isArray(samples) || samples.length < 5) return null;

  const allZero = samples.every(s => s.x === 0 && s.y === 0 && s.z === 0);
  if (allZero) return 'Cảm biến gia tốc toàn số 0 (giả lập thiết bị mobile)';

  if (samples.length >= 6) {
    const fmt = s => `${s.x.toFixed(1)},${s.y.toFixed(1)},${s.z.toFixed(1)}`;
    const first3  = samples.slice(0, 3).map(fmt).join('|');
    const second3 = samples.slice(3, 6).map(fmt).join('|');
    if (first3 === second3) return 'Cảm biến lặp dữ liệu theo chu kỳ (giả lập sensor)';
  }

  return null;
}

/**
 * Main device analysis function
 * @param {Object} deviceData   - Automation flags + behavioral signals
 * @param {string} userAgent    - Raw User-Agent string
 * @param {Object} botDetection - CreepJS extracted data
 */
function analyzeDevice(deviceData, userAgent, botDetection) {
  if (!deviceData && !userAgent && !botDetection) {
    return { isFake: false, score: 0, reasons: [], detectionLog: [] };
  }

  const reasons = [];
  const detectionLog = [];
  let score = 0;

  // ── 1. Headless UA ──
  if (HEADLESS_UA.test(userAgent || '')) {
    reasons.push('User-Agent là trình duyệt headless (HeadlessChrome / PhantomJS)');
    detectionLog.push('Trình duyệt headless / tự động hóa');
    score += 100;
  }

  // ── 2. CreepJS: headless/stealth flags ──
  if (botDetection?.headless || botDetection?.stealth) {
    reasons.push('CreepJS phát hiện chế độ headless hoặc stealth');
    detectionLog.push('Trình duyệt headless / tự động hóa');
    score += 100;
  }

  // ── 3. CreepJS: workerScope lied ──
  if (botDetection?.workerLied) {
    reasons.push('Worker scope bị giả mạo (CreepJS)');
    detectionLog.push('Trình duyệt headless / tự động hóa');
    score += 80;
  }

  // ── 4. Client automation flags ──
  const automation = deviceData?.automation || {};
  if (automation.webdriver || automation.selenium || automation.cdc) {
    const flags = [
      automation.webdriver && 'navigator.webdriver=true',
      automation.selenium  && 'Selenium hooks',
      automation.cdc       && 'ChromeDriver CDC',
    ].filter(Boolean).join(', ');
    reasons.push(`Cờ tự động hóa bị lộ: ${flags}`);
    detectionLog.push('Trình duyệt headless / tự động hóa');
    score += 100;
  }

  // ── 5. CreepJS API Lies ──
  const liesResult = checkCreepLies(botDetection);
  if (liesResult) {
    reasons.push(liesResult);
    detectionLog.push('Fingerprint bị giả mạo');
    score += botDetection?.totalLies >= 10 ? 70 : 40;
  }

  // ── 6. Font vs OS mismatch ──
  const fontMismatch = checkFontOsMismatch(botDetection?.fonts, userAgent);
  if (fontMismatch) {
    reasons.push(fontMismatch);
    detectionLog.push('Font không khớp hệ điều hành');
    score += 35;
  }

  // ── 7. Screen vs Window exact match ──
  const screenMismatch = checkScreenWindowMismatch(botDetection?.screen, userAgent);
  if (screenMismatch) {
    reasons.push(screenMismatch);
    detectionLog.push('Màn hình = cửa sổ (headless)');
    score += 30;
  }

  // ── 8. Hardware inconsistency ──
  const hwMismatch = checkHardwareInconsistency(botDetection?.hardware);
  if (hwMismatch) {
    reasons.push(hwMismatch);
    detectionLog.push('Phần cứng mâu thuẫn');
    score += 25;
  }

  // ── 9. Canvas noise ──
  const canvasNoise = checkCanvasNoise(botDetection?.canvas);
  if (canvasNoise) {
    reasons.push(canvasNoise);
    detectionLog.push('Canvas fingerprint bị giả mạo');
    score += 60;
  }

  // ── 10. Click latency ──
  const clickAnomaly = checkClickLatency(deviceData);
  if (clickAnomaly) {
    reasons.push(clickAnomaly);
    detectionLog.push('Hành vi click bất thường');
    score += 40;
  }

  // ── 11. Scroll speed ──
  const scrollAnomaly = checkScrollSpeed(deviceData);
  if (scrollAnomaly) {
    reasons.push(scrollAnomaly);
    detectionLog.push('Tốc độ cuộn bất thường');
    score += 35;
  }

  // ── 12. Fake sensor (mobile only) ──
  const sensorAnomaly = checkFakeSensor(deviceData, userAgent);
  if (sensorAnomaly) {
    reasons.push(sensorAnomaly);
    detectionLog.push('Cảm biến mobile giả lập');
    score += 50;
  }

  // ── 13. Mobile UA nhưng không có touch ──
  if (botDetection?.hardware?.maxTouchPoints === 0 && /mobile|android|iphone/i.test(userAgent || '')) {
    reasons.push('UA mobile nhưng không có cảm ứng (maxTouchPoints = 0)');
    score += 20;
  }

  // ── 14. Timezone mismatch ──
  if (botDetection?.timezoneLied) {
    reasons.push('Múi giờ bị giả mạo (CreepJS)');
    score += 20;
  }

  // ── 15. WebGL lied ──
  if (botDetection?.webglLied) {
    reasons.push('WebGL API bị giả mạo (CreepJS)');
    detectionLog.push('Fingerprint bị giả mạo');
    score += 30;
  }

  const isFake = score >= 60;

  return {
    isFake,
    score,
    reasons,
    detectionLog: [...new Set(detectionLog)],
    deviceType: /mobi|android|iphone|ipad/i.test(userAgent || '') ? 'mobile' : 'desktop',
    detail: {
      fontMismatch,
      screenMismatch,
      hwMismatch,
      canvasNoise,
      clickAnomaly,
      scrollAnomaly,
      sensorAnomaly,
      liesResult,
      canvasHash: botDetection?.canvasHash || null,
      audioHash:  botDetection?.audioHash  || null,
      webglRenderer: botDetection?.webglRenderer || null,
      totalLies: botDetection?.totalLies || 0,
    },
  };
}

module.exports = { analyzeDevice };
