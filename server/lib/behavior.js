const HEADLESS_UA = /HeadlessChrome|PhantomJS/i;

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

  if (cores >= 16 && ram < 2) return `Cấu hình mâu thuẫn: ${cores} nhân CPU nhưng chỉ ${ram}GB RAM`;
  if (cores >= 32 && ram < 4) return `Cấu hình mâu thuẫn: ${cores} nhân CPU nhưng chỉ ${ram}GB RAM`;

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

function checkClickLatency(deviceData, userAgent) {
  const ua = (userAgent || '').toLowerCase();
  const isMobile = /mobi|android|iphone|ipad/i.test(ua);

  const clicks = deviceData?.behavior?.clicks;
  if (!Array.isArray(clicks) || clicks.length < 3) return null;

  const latencies = clicks.map(c => c.duration).filter(d => typeof d === 'number' && d >= 0);
  if (latencies.length < 3) return null;

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const variance = latencies.reduce((acc, d) => acc + Math.pow(d - avg, 2), 0) / latencies.length;
  const stdDev = Math.sqrt(variance);

  // Người dùng mobile thường bị dính dưới 10ms do OS biên dịch mousedown->mouseup từ màn cảm ứng
  if (avg < 10 && stdDev < 5 && !isMobile)          return 'Click cực nhanh (dưới 10ms, Tool Desktop Auto Click)';
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
  if (allZero) return 'Cảm biến gia tốc toàn số 0 (Dùng Giả lập Android)';

  if (samples.length >= 6) {
    const fmt = s => `${s.x.toFixed(1)},${s.y.toFixed(1)},${s.z.toFixed(1)}`;
    const first3  = samples.slice(0, 3).map(fmt).join('|');
    const second3 = samples.slice(3, 6).map(fmt).join('|');
    // Chỉ flag nếu lặp và không phải giá trị gần-0 (trường hợp nằm yên được chấp nhận)
    const nearZero = samples.every(s => Math.abs(s.x) < 1.5 && Math.abs(s.y) < 1.5 && Math.abs(s.z) < 1.5);
    if (first3 === second3 && !nearZero) return 'Dữ liệu cảm biến bị lặp khung hình (Bot giả lập điện thoại)';
  }

  return null;
}

function analyzeDevice(deviceData, userAgent, botDetection) {
  if (!deviceData && !userAgent && !botDetection) {
    return { isFake: false, score: 0, reasons: [], detectionLog: [] };
  }

  const reasons = [];
  const detectionLog = [];
  let score = 0;

  
  if (HEADLESS_UA.test(userAgent || '')) {
    reasons.push('User-Agent là trình duyệt headless (HeadlessChrome / PhantomJS)');
    detectionLog.push('Trình duyệt headless / tự động hóa');
    score += 100;
  }

  
  if (botDetection?.headless || botDetection?.stealth) {
    reasons.push('CreepJS phát hiện chế độ headless hoặc stealth');
    detectionLog.push('Trình duyệt headless / tự động hóa');
    score += 100;
  }

  
  if (botDetection?.workerLied) {
    reasons.push('Worker scope bị giả mạo (CreepJS)');
    detectionLog.push('Trình duyệt headless / tự động hóa');
    score += 80;
  }

  
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

  if (automation.eventTampered === true) {
    reasons.push('Event.prototype.isTrusted bị override bởi extension (giả mạo tương tác người thật)');
    detectionLog.push('Extension can thiệp sự kiện trình duyệt');
    score += 30;
  }

  
  const liesResult = checkCreepLies(botDetection);
  if (liesResult) {
    reasons.push(liesResult);
    detectionLog.push('Fingerprint bị giả mạo');
    score += botDetection?.totalLies >= 10 ? 70 : 40;
  }

  
  const fontMismatch = checkFontOsMismatch(botDetection?.fonts, userAgent);
  if (fontMismatch) {
    reasons.push(fontMismatch);
    detectionLog.push('Font không khớp hệ điều hành');
    score += 35;
  }

  
  const screenMismatch = checkScreenWindowMismatch(botDetection?.screen, userAgent);
  if (screenMismatch) {
    reasons.push(screenMismatch);
    detectionLog.push('Màn hình = cửa sổ (headless)');
    score += 30;
  }

  
  const hwMismatch = checkHardwareInconsistency(botDetection?.hardware);
  if (hwMismatch) {
    reasons.push(hwMismatch);
    detectionLog.push('Phần cứng mâu thuẫn');
    score += 25;
  }

  
  const canvasNoise = checkCanvasNoise(botDetection?.canvas);
  if (canvasNoise) {
    reasons.push(canvasNoise);
    detectionLog.push('Canvas fingerprint bị giả mạo');
    score += 60;
  }

  
  const clickAnomaly = checkClickLatency(deviceData, userAgent);
  if (clickAnomaly) {
    reasons.push(clickAnomaly);
    detectionLog.push('Hành vi click bất thường');
    score += 40;
  }

  
  const scrollAnomaly = checkScrollSpeed(deviceData);
  if (scrollAnomaly) {
    reasons.push(scrollAnomaly);
    detectionLog.push('Tốc độ cuộn bất thường');
    score += 35;
  }

  
  const sensorAnomaly = checkFakeSensor(deviceData, userAgent);
  if (sensorAnomaly) {
    reasons.push(sensorAnomaly);
    detectionLog.push('Cảm biến mobile giả lập');
    score += 50;
  }

  
  if (botDetection?.hardware?.maxTouchPoints === 0 && /mobile|android|iphone/i.test(userAgent || '')) {
    reasons.push('UA mobile nhưng không có cảm ứng (maxTouchPoints = 0)');
    score += 20;
  }

  
  if (botDetection?.timezoneLied) {
    reasons.push('Múi giờ bị giả mạo (CreepJS)');
    score += 20;
  }

  
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
