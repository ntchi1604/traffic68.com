/**
 * behavior.js — Advanced bot detection engine v2
 * 
 * Data sources:
 *   botDetection — từ CreepJS (canvas, audio, fonts, screen, hardware, headless/stealth, lies)
 *   deviceData   — từ client tự thu thập (automation flags, scroll speed, click latency, sensor)
 *
 * CreepJS đã thu thập: canvas hash, audio hash, fonts, screen, hardware, webdriver/headless, lies
 * Tự thu thập: click latency, scroll speed, DeviceMotion sensor, Screen vs Window exact match
 */

const HEADLESS_UA = /HeadlessChrome|PhantomJS/i;

// ─── Font vs OS mismatch ───
// macOS-exclusive fonts
const MACOS_FONTS = ['Helvetica Neue', 'Lucida Grande', 'Geneva', 'Monaco', 'SF Pro Display', '.SF NS'];
// Windows-exclusive fonts
const WIN_FONTS   = ['Segoe UI', 'Calibri', 'Consolas', 'Cambria', 'Tahoma', 'Verdana', 'Segoe Fluent Icons'];

/**
 * Font vs OS mismatch check — dùng fonts từ CreepJS (botDetection.fonts)
 */
function checkFontOsMismatch(fonts, userAgent) {
  const ua = (userAgent || '').toLowerCase();
  if (!Array.isArray(fonts) || fonts.length === 0) return null;

  const isWindowsUA = /windows/i.test(ua);
  const isMacUA = /mac os x/i.test(ua) && !/iphone|ipad/i.test(ua);
  const isAndroidUA = /android/i.test(ua);
  const isiOSUA = /iphone|ipad/i.test(ua);

  const hasMacFonts = MACOS_FONTS.some(f => fonts.includes(f));
  const hasWinFonts = WIN_FONTS.some(f => fonts.includes(f));

  if (isWindowsUA && hasMacFonts && !hasWinFonts) return 'font_os_mismatch_win_has_mac';
  if (isMacUA && hasWinFonts && !hasMacFonts)     return 'font_os_mismatch_mac_has_win';
  if ((isAndroidUA || isiOSUA) && (hasMacFonts || hasWinFonts)) return 'font_os_mismatch_mobile_has_desktop';

  return null;
}

/**
 * Screen vs Window exact match (desktop only)
 * Dùng screen data từ botDetection.screen (CreepJS extract từ window)
 */
function checkScreenWindowMismatch(screenData, userAgent) {
  const ua = (userAgent || '').toLowerCase();
  if (/mobi|android|iphone|ipad/i.test(ua)) return null; // mobile OK

  if (!screenData) return null;
  const { width: sw, height: sh, innerWidth: ww, innerHeight: wh } = screenData;
  if (!sw || !sh || !ww || !wh) return null;

  if (sw === ww && sh === wh) return 'screen_window_exact_match';
  return null;
}

/**
 * Hardware inconsistency — dùng hardware data từ botDetection.hardware (CreepJS)
 */
function checkHardwareInconsistency(hardware) {
  if (!hardware) return null;
  const { cores, ram } = hardware;
  if (!cores || !ram) return null;

  if (cores >= 16 && ram < 4) return `hw_mismatch_${cores}cores_${ram}gb`;
  if (cores >= 8  && ram <= 2) return `hw_mismatch_${cores}cores_${ram}gb`;

  return null;
}

/**
 * Canvas Noise Detection — từ botDetection.canvas (thu thập trong creep-frame.html)
 * hash1 !== hash2 → Anti-detect browser đang inject noise
 */
function checkCanvasNoise(canvasData) {
  if (!canvasData) return null;
  const { hash1, hash2, noisy } = canvasData;

  if (noisy === true) return 'canvas_noise_detected';
  if (hash1 && hash2 && hash1 !== hash2) return 'canvas_noise_detected';

  return null;
}

/**
 * CreepJS Lies Analysis — dùng botDetection.liesCount, lieNames, totalLies
 * Nhiều lies = Anti-detect browser đang giả mạo nhiều API
 */
function checkCreepLies(botDetection) {
  if (!botDetection) return null;

  const totalLies = botDetection.totalLies || 0;
  const lieNames = botDetection.lieNames || [];

  if (totalLies >= 10) return `creep_many_lies_${totalLies}`;
  if (botDetection.canvasLied) return 'canvas_api_lied';
  if (botDetection.audioLied)  return 'audio_api_lied';
  if (botDetection.navigatorLied) return 'navigator_api_lied';

  return null;
}

/**
 * Click latency — từ deviceData.behavior (tự thu thập ngoài CreepJS)
 */
function checkClickLatency(deviceData) {
  const clicks = deviceData?.behavior?.clicks;
  if (!Array.isArray(clicks) || clicks.length < 3) return null;

  const latencies = clicks.map(c => c.duration).filter(d => typeof d === 'number' && d >= 0);
  if (latencies.length < 3) return null;

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const variance = latencies.reduce((acc, d) => acc + Math.pow(d - avg, 2), 0) / latencies.length;
  const stdDev = Math.sqrt(variance);

  if (avg < 10 && stdDev < 5) return 'click_latency_zero';
  if (avg > 0 && stdDev < 3 && latencies.length >= 5) return 'click_latency_constant';

  return null;
}

/**
 * Scroll speed — từ deviceData.behavior (tự thu thập)
 */
function checkScrollSpeed(deviceData) {
  const scroll = deviceData?.behavior?.scroll;
  if (!scroll) return null;

  const { totalDistance, timeMs } = scroll;
  if (!totalDistance || !timeMs) return null;

  const pps = (totalDistance / timeMs) * 1000;
  if (pps > 5000) return 'scroll_speed_bot';
  if (totalDistance > 3000 && timeMs < 200) return 'scroll_speed_instant';

  return null;
}

/**
 * Fake Sensor — từ deviceData.sensor (tự thu thập DeviceMotion)
 * Chỉ áp dụng khi UA là mobile nhưng sensor data là fake
 */
function checkFakeSensor(deviceData, userAgent) {
  const motion = deviceData?.sensor?.motion;
  if (!motion) return null;

  const ua = (userAgent || '').toLowerCase();
  if (!/mobi|android|iphone|ipad/i.test(ua)) return null; // Desktop không có sensor — bỏ qua

  const { samples } = motion;
  if (!Array.isArray(samples) || samples.length < 5) return null;

  const allZero = samples.every(s => s.x === 0 && s.y === 0 && s.z === 0);
  if (allZero) return 'sensor_all_zero';

  if (samples.length >= 6) {
    const fmt = s => `${s.x.toFixed(1)},${s.y.toFixed(1)},${s.z.toFixed(1)}`;
    const first3  = samples.slice(0, 3).map(fmt).join('|');
    const second3 = samples.slice(3, 6).map(fmt).join('|');
    if (first3 === second3) return 'sensor_cyclic_pattern';
  }

  return null;
}

/**
 * Main device analysis function
 * @param {Object} deviceData   - Automation flags + behavioral signals (scroll, click, sensor)
 * @param {string} userAgent    - Raw User-Agent string
 * @param {Object} botDetection - CreepJS extracted data (canvas, audio, fonts, screen, hardware, lies)
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
    reasons.push('headless_ua');
    detectionLog.push('headless_or_webdriver');
    score += 100;
  }

  // ── 2. CreepJS: headless/stealth flags ──
  if (botDetection?.headless || botDetection?.stealth) {
    reasons.push('creepjs_headless');
    detectionLog.push('headless_or_webdriver');
    score += 100;
  }

  // ── 3. CreepJS: workerScope lied ──
  if (botDetection?.workerLied) {
    reasons.push('creepjs_worker_lied');
    detectionLog.push('headless_or_webdriver');
    score += 80;
  }

  // ── 4. Client automation flags (webdriver, selenium, cdc) ──
  const automation = deviceData?.automation || {};
  if (automation.webdriver || automation.selenium || automation.cdc) {
    reasons.push('automation_flag');
    detectionLog.push('headless_or_webdriver');
    score += 100;
  }

  // ── 5. CreepJS API Lies (canvas, audio, navigator, etc.) ──
  const liesResult = checkCreepLies(botDetection);
  if (liesResult) {
    reasons.push(liesResult);
    detectionLog.push('Fingerprint_bot');
    score += botDetection?.totalLies >= 10 ? 70 : 40;
  }

  // ── 6. Font vs OS mismatch (dùng fonts từ CreepJS) ──
  const fontMismatch = checkFontOsMismatch(botDetection?.fonts, userAgent);
  if (fontMismatch) {
    reasons.push(fontMismatch);
    detectionLog.push('font_os_mismatch');
    score += 35;
  }

  // ── 7. Screen vs Window exact match (dùng screen từ CreepJS) ──
  const screenMismatch = checkScreenWindowMismatch(botDetection?.screen, userAgent);
  if (screenMismatch) {
    reasons.push(screenMismatch);
    detectionLog.push('screen_window_mismatch');
    score += 30;
  }

  // ── 8. Hardware inconsistency (dùng hardware từ CreepJS) ──
  const hwMismatch = checkHardwareInconsistency(botDetection?.hardware);
  if (hwMismatch) {
    reasons.push(hwMismatch);
    detectionLog.push('hardware_inconsistency');
    score += 25;
  }

  // ── 9. Canvas noise detection (vẽ 2 lần trong creep-frame) ──
  const canvasNoise = checkCanvasNoise(botDetection?.canvas);
  if (canvasNoise) {
    reasons.push(canvasNoise);
    detectionLog.push('canvas_noise_detected');
    score += 60;
  }

  // ── 10. Click latency (tự thu thập) ──
  const clickAnomaly = checkClickLatency(deviceData);
  if (clickAnomaly) {
    reasons.push(clickAnomaly);
    detectionLog.push('click_latency_anomaly');
    score += 40;
  }

  // ── 11. Scroll speed (tự thu thập) ──
  const scrollAnomaly = checkScrollSpeed(deviceData);
  if (scrollAnomaly) {
    reasons.push(scrollAnomaly);
    detectionLog.push('scroll_speed_bot');
    score += 35;
  }

  // ── 12. Fake sensor (tự thu thập, chỉ mobile) ──
  const sensorAnomaly = checkFakeSensor(deviceData, userAgent);
  if (sensorAnomaly) {
    reasons.push(sensorAnomaly);
    detectionLog.push('fake_sensor');
    score += 50;
  }

  // ── 13. Mobile UA nhưng không có touch (CreepJS hardware.maxTouchPoints) ──
  if (botDetection?.hardware?.maxTouchPoints === 0 && /mobile|android|iphone/i.test(userAgent || '')) {
    reasons.push('mobile_ua_no_touch');
    score += 20;
  }

  // ── 14. Timezone mismatch (CreepJS timezoneLied) ──
  if (botDetection?.timezoneLied) {
    reasons.push('timezone_lied');
    score += 20;
  }

  // ── 15. WebGL lied (CreepJS) ──
  if (botDetection?.webglLied) {
    reasons.push('webgl_api_lied');
    detectionLog.push('Fingerprint_bot');
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
      // Pass-through CreepJS hashes for clustering
      canvasHash: botDetection?.canvasHash || null,
      audioHash: botDetection?.audioHash || null,
      webglRenderer: botDetection?.webglRenderer || null,
      totalLies: botDetection?.totalLies || 0,
    },
  };
}

module.exports = { analyzeDevice };
