/**
 * analyzeDevice — Desktop vs Mobile detection engine
 *
 * Phân tích dữ liệu thiết bị từ client để phát hiện giả lập/bot.
 * 3 lớp: (1) Phần cứng, (2) Hành vi, (3) Thông số hệ thống.
 *
 * @param {Object} deviceData - Dữ liệu thu thập từ client
 * @param {string} userAgent  - User-Agent header từ server
 * @returns {{ isFake: boolean, score: number, reasons: string[], deviceType: string, detail: Object }}
 */

const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile|Windows Phone|Kindle|Silk/i;
const HEADLESS_UA = /HeadlessChrome|PhantomJS/i;

// GPU blacklist — virtual/software renderers
const FAKE_GPU = [
  'swiftshader', 'llvmpipe', 'softpipe', 'microsoft basic render',
  'mesa', 'vmware', 'virtualbox', 'parallels', 'chromium',
  'google swiftshader', 'software rasterizer',
];

function _cv(arr) {
  if (!arr || arr.length < 3) return 999;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  if (avg === 0) return 0;
  const variance = arr.reduce((a, b) => a + (b - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance) / avg;
}

function analyzeDevice(deviceData, userAgent) {
  if (!deviceData) return { isFake: false, score: 0, reasons: [], deviceType: 'unknown', detail: {} };

  const d = deviceData;
  let score = 0;
  const reasons = [];
  const detail = {};

  // ═══════════════════════════════════════════════════════
  //  Xác định thiết bị: Mobile vs Desktop
  // ═══════════════════════════════════════════════════════
  const isMobile = userAgent ? MOBILE_UA.test(userAgent) : !!d.isMobile;
  const deviceType = isMobile ? 'mobile' : 'desktop';
  detail.deviceType = deviceType;
  detail.detectedBy = userAgent ? 'server-UA' : 'client-flag';

  // ═══════════════════════════════════════════════════════
  //  Kiểm tra chung: Automation flags
  // ═══════════════════════════════════════════════════════
  if (HEADLESS_UA.test(userAgent || '')) {
    score += 50;
    reasons.push('headless_browser');
    detail.headless = true;
  }

  const automation = d.automation || {};
  if (automation.webdriver) {
    score += 40;
    reasons.push('webdriver');
    detail.webdriver = true;
  }
  if (automation.selenium) {
    score += 40;
    reasons.push('selenium');
    detail.selenium = true;
  }
  if (automation.cdc) {
    score += 30;
    reasons.push('cdc_detected');
    detail.cdc = true;
  }

  // ═══════════════════════════════════════════════════════
  //  LỚP 1: PHẦN CỨNG & HIỆU NĂNG
  // ═══════════════════════════════════════════════════════

  if (isMobile) {
    // ── Mobile: Cảm biến vật lý (Gyro/Accel) ──
    const sensor = d.sensor || {};
    const samples = sensor.samples || [];

    if (samples.length === 0 || sensor.isNull) {
      // Không có dữ liệu cảm biến → rất cao khả năng giả lập
      score += 35;
      reasons.push('no_sensor_data');
      detail.sensor = 'null_or_empty';
    } else if (samples.length >= 3) {
      // Kiểm tra biến thiên — alpha, beta, gamma phải thay đổi ≥ 0.0001 trong 5s
      const alphas = samples.map(s => s.alpha).filter(v => v != null);
      const betas = samples.map(s => s.beta).filter(v => v != null);
      const gammas = samples.map(s => s.gamma).filter(v => v != null);

      const minVariance = 0.0001;
      const alphaRange = alphas.length > 1 ? Math.max(...alphas) - Math.min(...alphas) : 0;
      const betaRange = betas.length > 1 ? Math.max(...betas) - Math.min(...betas) : 0;
      const gammaRange = gammas.length > 1 ? Math.max(...gammas) - Math.min(...gammas) : 0;

      const allStatic = alphaRange < minVariance && betaRange < minVariance && gammaRange < minVariance;

      if (allStatic) {
        score += 35;
        reasons.push('sensor_static');
        detail.sensor = { alphaRange, betaRange, gammaRange, verdict: 'static_5s' };
      } else {
        detail.sensor = { alphaRange: +alphaRange.toFixed(4), betaRange: +betaRange.toFixed(4), gammaRange: +gammaRange.toFixed(4), verdict: 'ok' };
      }
    }
  } else {
    // ── Desktop: GPU & WebGL ──
    const gpu = d.gpu || {};

    // Unmasked Renderer — blacklist check
    const renderer = (gpu.unmaskedRenderer || '').toLowerCase();
    if (renderer) {
      const isFakeGpu = FAKE_GPU.some(fake => renderer.includes(fake));
      if (isFakeGpu) {
        score += 30;
        reasons.push('virtual_gpu');
        detail.gpu = { renderer, verdict: 'virtual' };
      } else {
        detail.gpu = { renderer, verdict: 'ok' };
      }
    } else {
      // Không có GPU info
      score += 15;
      reasons.push('no_gpu_info');
      detail.gpu = { verdict: 'missing' };
    }

    // Lỗi dấu phẩy động — GPU thật có sai số ≠ 0
    if (gpu.floatError !== undefined) {
      if (gpu.floatError === 0) {
        score += 20;
        reasons.push('gpu_no_float_error');
        detail.gpuFloat = { error: 0, verdict: 'software_renderer' };
      } else {
        detail.gpuFloat = { error: gpu.floatError, verdict: 'real_gpu' };
      }
    }

    // Hardware concurrency & device memory
    const hw = d.hardware || {};
    if (hw.concurrency && hw.concurrency < 2) {
      score += 10;
      reasons.push('low_cpu_cores');
      detail.cpu = { concurrency: hw.concurrency };
    }
    if (hw.memory && hw.memory < 2) {
      score += 10;
      reasons.push('low_memory');
      detail.memory = { deviceMemory: hw.memory };
    }
  }

  // ═══════════════════════════════════════════════════════
  //  LỚP 2: HÀNH VI
  // ═══════════════════════════════════════════════════════

  if (isMobile) {
    // ── Mobile: Touch analysis ──
    const touch = d.touch || {};

    // Touch radius — radiusX ≠ radiusY, phải biến thiên
    const touchSamples = touch.samples || [];
    if (touchSamples.length >= 3) {
      const radii = touchSamples.filter(t => t.rx != null);
      if (radii.length >= 3) {
        // Kiểm tra radius luôn = 0 hoặc cố định
        const allZero = radii.every(t => t.rx === 0 && t.ry === 0);
        if (allZero) {
          score += 25;
          reasons.push('touch_zero_radius');
          detail.touchRadius = 'all_zero';
        } else {
          const rxValues = radii.map(t => t.rx);
          const rxCV = _cv(rxValues);
          if (rxCV < 0.02 && radii.length >= 5) {
            score += 15;
            reasons.push('touch_fixed_radius');
            detail.touchRadius = { cv: +rxCV.toFixed(3), verdict: 'fixed' };
          } else {
            detail.touchRadius = { cv: +rxCV.toFixed(3), verdict: 'ok' };
          }
        }
      }
    }

    // Multi-touch — bot chỉ có 1 điểm chạm
    if (touch.maxTouches !== undefined && touch.maxTouches <= 1 && touchSamples.length >= 5) {
      // Chỉ 1 điểm chạm suốt — đáng nghi nhưng không chắc chắn
      score += 5;
      reasons.push('single_touch_only');
      detail.multiTouch = { max: touch.maxTouches };
    }
  } else {
    // ── Desktop: Mouse & Scroll ──
    const mouseTrail = d.mouse || [];

    if (mouseTrail.length >= 10) {
      // Gia tốc chuột — tốc độ phải biến thiên (đường Bezier)
      const speeds = [];
      for (let i = 1; i < mouseTrail.length; i++) {
        const dx = mouseTrail[i].x - mouseTrail[i - 1].x;
        const dy = mouseTrail[i].y - mouseTrail[i - 1].y;
        const dt = mouseTrail[i].t - mouseTrail[i - 1].t;
        if (dt > 0) speeds.push(Math.sqrt(dx * dx + dy * dy) / dt);
      }
      const speedCV = _cv(speeds);

      if (speeds.length > 8 && speedCV < 0.1) {
        score += 20;
        reasons.push('constant_mouse_speed');
        detail.mouse = { speedCV: +speedCV.toFixed(3), verdict: 'bot_linear' };
      } else {
        detail.mouse = { speedCV: +(speedCV || 0).toFixed(3), points: mouseTrail.length, verdict: 'ok' };
      }

      // Tuyến tính — đường thẳng tắp
      let linearCount = 0;
      for (let i = 2; i < mouseTrail.length; i++) {
        const dx1 = mouseTrail[i].x - mouseTrail[i - 1].x, dy1 = mouseTrail[i].y - mouseTrail[i - 1].y;
        const dx0 = mouseTrail[i - 1].x - mouseTrail[i - 2].x, dy0 = mouseTrail[i - 1].y - mouseTrail[i - 2].y;
        const cross = Math.abs(dx1 * dy0 - dy1 * dx0);
        const mag = Math.sqrt(dx1 * dx1 + dy1 * dy1) * Math.sqrt(dx0 * dx0 + dy0 * dy0);
        if (mag > 0 && cross / mag < 0.05) linearCount++;
      }
      const linearRatio = linearCount / (mouseTrail.length - 2);
      if (linearRatio > 0.85 && mouseTrail.length > 15) {
        score += 15;
        reasons.push('linear_mouse');
        detail.mouseLinear = { ratio: +(linearRatio * 100).toFixed(1), verdict: 'too_straight' };
      }
    }

    // Scroll — wheel events với deltaY biến thiên
    const scrollEvents = d.scroll || [];
    if (scrollEvents.length >= 5) {
      // Kiểm tra nhảy cóc (scrollTo)
      let jumpCount = 0;
      const deltas = [];
      for (let i = 1; i < scrollEvents.length; i++) {
        const dy = Math.abs(scrollEvents[i].y - scrollEvents[i - 1].y);
        deltas.push(dy);
        if (dy > 500) jumpCount++;
      }

      if (jumpCount > scrollEvents.length * 0.5) {
        score += 15;
        reasons.push('scroll_jump');
        detail.scroll = { jumps: jumpCount, total: scrollEvents.length, verdict: 'scrollTo_bot' };
      }

      // Tốc độ cuộn đều đặn
      const scrollCV = _cv(deltas);
      if (scrollCV < 0.1 && deltas.length > 5) {
        score += 10;
        reasons.push('uniform_scroll');
        detail.scrollSpeed = { cv: +scrollCV.toFixed(3), verdict: 'too_uniform' };
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  //  LỚP 3: THÔNG SỐ HỆ THỐNG
  // ═══════════════════════════════════════════════════════

  // ── Battery API ──
  const battery = d.battery || {};
  if (battery.level !== undefined) {
    const pinFull = battery.level === 1 || battery.level === 100;
    const alwaysCharging = battery.charging === true;
    const chargingTimeZero = battery.chargingTime === 0 || battery.chargingTime === Infinity;

    if (pinFull && alwaysCharging && chargingTimeZero) {
      score += 25;
      reasons.push('battery_emulator');
      detail.battery = { level: battery.level, charging: true, chargingTime: battery.chargingTime, verdict: 'emulator_pattern' };
    } else if (pinFull && alwaysCharging) {
      score += 10;
      reasons.push('battery_suspicious');
      detail.battery = { level: battery.level, charging: true, verdict: 'suspicious' };
    } else {
      detail.battery = { level: battery.level, charging: battery.charging, verdict: 'ok' };
    }
  }

  // ── AudioContext fingerprinting ──
  const audio = d.audio || {};
  if (audio.hash !== undefined) {
    if (audio.hash === 0 || audio.hash === null || audio.error) {
      score += 20;
      reasons.push('audio_static');
      detail.audio = { hash: audio.hash, error: audio.error, verdict: 'anti_detect' };
    } else {
      detail.audio = { hash: audio.hash, verdict: 'ok' };
    }
  }

  // ═══════════════════════════════════════════════════════
  //  KẾT LUẬN
  // ═══════════════════════════════════════════════════════
  const isFake = score >= 50;

  return { isFake, score, reasons, deviceType, detail };
}

module.exports = { analyzeDevice };
