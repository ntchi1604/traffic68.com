function _cv(arr) {
  if (!arr || arr.length < 3) return 999;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  if (avg === 0) return 0;
  const variance = arr.reduce((a, b) => a + (b - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance) / avg;
}

function analyzeBehavior(b, userAgent) {
  if (!b) return { score: 0, reasons: [], assessments: [] };
  let score = 0;
  const reasons = [];
  const assessments = [];

  // ── Detect device type (multi-layered) ──
  const touchTrail = b.touchTrail || [];
  const touchTaps = b.touchTaps || [];
  const mouseTrail = b.mouseTrail || [];

  // 1. Server-side UA detection (most reliable — can't be spoofed by client code)
  const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile|Windows Phone|Kindle|Silk/i;
  const serverDetectMobile = userAgent ? MOBILE_UA.test(userAgent) : null;

  // 2. Client-sent flag
  const clientIsMobile = !!b.isMobile;

  // 3. Screen-based detection (small screen or portrait = likely mobile)
  const screen = b.screen || {};
  const screenIsMobile = (screen.w && screen.w < 768) || (screen.w && screen.h && screen.h > screen.w && screen.w < 1024);

  // 4. Touch-based detection (has touch events = likely mobile)
  const touchIsMobile = touchTrail.length > 0 || touchTaps.length > 0;

  // Final decision: server UA wins, then client flag, then screen/touch
  const isMobile = serverDetectMobile !== null
    ? serverDetectMobile
    : (clientIsMobile || screenIsMobile || touchIsMobile);

  // On mobile: use touch data as primary movement signal
  // On desktop: use mouse data
  const trail = isMobile && touchTrail.length > 0 ? touchTrail : mouseTrail;
  const n = trail.length;

  // Detection source for logging
  const detectionSource = serverDetectMobile !== null
    ? 'server-UA' : clientIsMobile ? 'client-flag' : screenIsMobile ? 'screen-size' : touchIsMobile ? 'touch-events' : 'default';

  assessments.push({
    cat: 'device', check: 'device_type',
    value: isMobile ? 'mobile' : 'desktop',
    flagged: false,
    note: isMobile
      ? `Thiết bị di động (${detectionSource}) — phân tích touch (${touchTrail.length} touchmove, ${touchTaps.length} taps)`
      : `Desktop (${detectionSource}) — phân tích mouse (${mouseTrail.length} mousemove)`
  });

  // ═══════════════════════════════════════════════════════════
  // 0. KIỂM TRA TƯƠNG TÁC BẮT BUỘC
  //    Script yêu cầu click/tap + cuộn → nếu thiếu = BOT
  // ═══════════════════════════════════════════════════════════

  const clicks = b.clickPositions || [];
  const scrollEvts = b.scrollEvents || [];

  // On mobile: touch taps count as clicks (browsers also fire click on tap)
  const hasClicks = clicks.length > 0 || touchTaps.length > 0;
  const noScroll = scrollEvts.length === 0;

  if (!hasClicks || noScroll) {
    const missing = [];
    if (!hasClicks) missing.push('click/tap');
    if (noScroll) missing.push('scroll');
    return {
      score: 100,
      reasons: ['no_interaction'],
      assessments: [{
        cat: 'interaction', check: 'mandatory',
        value: `click: ${clicks.length}, taps: ${touchTaps.length}, scroll: ${scrollEvts.length}`,
        flagged: true,
        note: `Không có ${missing.join(' và ')} — script bắt buộc tương tác, đây chắc chắn là bot`
      }]
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 0b. MÂU THUẪN UA MOBILE + MOUSE EVENTS
  //     UA nói mobile nhưng có mousemove = giả mạo mobile
  //     (Chrome DevTools, Selenium/Puppeteer giả UA, emulator)
  // ═══════════════════════════════════════════════════════════
  if (serverDetectMobile && mouseTrail.length > 5 && touchTrail.length === 0 && touchTaps.length === 0) {
    // UA mobile nhưng chỉ có mouse, không có touch = giả mạo
    score += 40;
    reasons.push('fake_mobile');
    assessments.push({
      cat: 'device', check: 'mobile_mouse_conflict',
      value: `UA=mobile, mouse=${mouseTrail.length}, touch=${touchTrail.length}, taps=${touchTaps.length}`,
      flagged: true,
      note: 'UA báo mobile nhưng chỉ có mouse events, không có touch — nghi giả mạo thiết bị (emulator/DevTools)'
    });
  } else if (serverDetectMobile && mouseTrail.length > 0 && touchTrail.length > 0) {
    // Có cả mouse và touch — một số thiết bị hybrid (tablet + bút), chỉ cảnh báo nhẹ
    assessments.push({
      cat: 'device', check: 'mobile_mouse_conflict',
      value: `mouse=${mouseTrail.length}, touch=${touchTrail.length}`,
      flagged: false,
      note: 'Mobile có cả mouse và touch — có thể tablet/hybrid, không đáng ngờ'
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 1. DI CHUYỂN (Mouse / Touch Dynamics)
  //    Áp dụng chung cho cả mouseTrail và touchTrail
  // ═══════════════════════════════════════════════════════════

  const catLabel = isMobile ? 'touch' : 'mouse';
  const moveLabel = isMobile ? 'touchmove' : 'mousemove';

  // 1a. Số lượng sự kiện di chuyển
  //     Người thật tạo ra nhiều sự kiện liên tục
  //     Bot chỉ tạo 1-2 sự kiện tại điểm đầu và cuối
  //     ⚠ Trên mobile: ít/không có touchmove là BÌNH THƯỜNG (user tap, không swipe)
  //       và KHÔNG CÓ mousemove là hoàn toàn tự nhiên (điện thoại dùng touch)
  if (isMobile) {
    // Mobile: chỉ ghi nhận thông tin, KHÔNG TRỪNG PHẠT
    assessments.push({
      cat: catLabel, check: `${moveLabel}_count`, value: n,
      flagged: false,
      note: n >= 10
        ? `${n} touchmove — đủ dữ liệu phân tích chuyển động`
        : touchTrail.length > 0
          ? `${touchTrail.length} touchmove, ${touchTaps.length} taps — người dùng tap, ít vuốt`
          : `Không có touchmove — người dùng chỉ tap, bình thường trên điện thoại`
    });
  } else {
    // Desktop: ít mousemove + có click = đáng ngờ
    const tooFewMove = n < 5 && hasClicks;
    assessments.push({
      cat: catLabel, check: `${moveLabel}_count`, value: n,
      flagged: tooFewMove,
      note: tooFewMove
        ? `Chỉ ${n} sự kiện mousemove — bot click trực tiếp không rê chuột`
        : n >= 10 ? `${n} sự kiện — đủ dữ liệu phân tích` : `${n} sự kiện — ít`
    });
    if (tooFewMove) { score += 15; reasons.push('no_hover_before_click'); }
  }

  if (n >= 10) {
    // 1b. Tính tuyến tính (Linearity)
    let linearCount = 0;
    for (let i = 2; i < n; i++) {
      const dx1 = trail[i].x - trail[i-1].x, dy1 = trail[i].y - trail[i-1].y;
      const dx0 = trail[i-1].x - trail[i-2].x, dy0 = trail[i-1].y - trail[i-2].y;
      const cross = Math.abs(dx1 * dy0 - dy1 * dx0);
      const mag = Math.sqrt(dx1*dx1+dy1*dy1) * Math.sqrt(dx0*dx0+dy0*dy0);
      if (mag > 0 && cross / mag < 0.05) linearCount++;
    }
    const linearRatio = Math.round(linearCount / (n - 2) * 100);
    const linearFlag = linearRatio > 85 && n > 15;
    if (linearFlag) { score += 20; reasons.push('linear_movement'); }
    assessments.push({
      cat: catLabel, check: 'linearity', value: `${linearRatio}%`, threshold: '> 85%',
      flagged: linearFlag,
      note: linearFlag
        ? `Di chuyển thẳng tắp — ${isMobile ? 'bot giả lập touch' : 'bot dùng moveTo(x,y)'}`
        : `Đường cong tự nhiên (${linearRatio}% thẳng)`
    });

    // 1c. Gia tốc (Acceleration)
    const speeds = [];
    for (let i = 1; i < n; i++) {
      const dx = trail[i].x - trail[i-1].x, dy = trail[i].y - trail[i-1].y;
      const dt = trail[i].t - trail[i-1].t;
      if (dt > 0) speeds.push(Math.sqrt(dx*dx + dy*dy) / dt);
    }
    const speedCV = _cv(speeds);
    const speedCVr = Math.round(speedCV * 100) / 100;
    const speedFlag = speeds.length > 8 && speedCV < 0.1;
    if (speedFlag) { score += 20; reasons.push('constant_velocity'); }
    assessments.push({
      cat: catLabel, check: 'speed_cv', value: speedCVr, threshold: '< 0.1',
      flagged: speedFlag,
      note: speedFlag
        ? 'Tốc độ không đổi — thiếu gia tốc/giảm tốc tự nhiên'
        : `Tốc độ thay đổi tự nhiên (CV=${speedCVr})`
    });

    // 1d. Mô hình tăng tốc - giảm tốc
    if (speeds.length >= 10) {
      const half = Math.floor(speeds.length / 2);
      const firstHalf = speeds.slice(0, half);
      const secondHalf = speeds.slice(half);
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const hasDecel = avgSecond < avgFirst * 0.7;
      assessments.push({
        cat: catLabel, check: 'accel_profile', value: `${Math.round(avgFirst*100)/100} → ${Math.round(avgSecond*100)/100}`,
        flagged: false,
        note: hasDecel
          ? 'Có giảm tốc khi gần mục tiêu — hành vi tự nhiên'
          : 'Gia tốc không rõ ràng — cần kết hợp chỉ số khác'
      });
    }

    // 1e. Micro-jitter (Rung lắc)
    if (n > 10) {
      const sx = trail[0].x, sy = trail[0].y;
      const ex = trail[n-1].x, ey = trail[n-1].y;
      const lineLen = Math.sqrt((ex-sx)**2 + (ey-sy)**2);
      if (lineLen > 50) {
        let totalDeviation = 0;
        for (let i = 1; i < n - 1; i++) {
          const d = Math.abs((ey-sy)*(trail[i].x-sx) - (ex-sx)*(trail[i].y-sy)) / lineLen;
          totalDeviation += d;
        }
        const avgDeviation = Math.round(totalDeviation / (n - 2) * 100) / 100;
        const jitterFlag = avgDeviation < 0.5;
        if (jitterFlag) { score += 15; reasons.push('no_micro_jitter'); }
        assessments.push({
          cat: catLabel, check: 'micro_jitter', value: `${avgDeviation}px`, threshold: '< 0.5px',
          flagged: jitterFlag,
          note: jitterFlag
            ? `Không có rung lắc — ${isMobile ? 'bot giả lập touch' : 'bot Bézier hoặc script di chuyển'}`
            : `Rung lắc tự nhiên ${avgDeviation}px`
        });
      }
    }

    // 1f. Timestamp giả mạo
    const uniqueTimes = new Set(trail.map(p => p.t)).size;
    const fakeFlag = uniqueTimes <= 3 && n > 10;
    if (fakeFlag) { score += 30; reasons.push('fake_timestamps'); }
    assessments.push({
      cat: catLabel, check: 'timestamp_unique', value: uniqueTimes, threshold: '≤ 3',
      flagged: fakeFlag,
      note: fakeFlag
        ? `Chỉ ${uniqueTimes} timestamp khác nhau trong ${n} sự kiện — inject giả mạo`
        : `${uniqueTimes} timestamp riêng biệt — bình thường`
    });

    // 1g. Khoảng cách thời gian đều đặn
    if (n > 15) {
      const ints = [];
      for (let i = 1; i < n; i++) ints.push(trail[i].t - trail[i-1].t);
      const intCV = _cv(ints);
      const intCVr = Math.round(intCV * 100) / 100;
      const intFlag = intCV < 0.12;
      if (intFlag) { score += 25; reasons.push('regular_intervals'); }
      assessments.push({
        cat: catLabel, check: 'interval_cv', value: intCVr, threshold: '< 0.12',
        flagged: intFlag,
        note: intFlag
          ? `Khoảng cách thời gian đều như setInterval (CV=${intCVr}) — script tự động`
          : `Khoảng cách thời gian biến thiên (CV=${intCVr}) — người thật`
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 2. CUỘN TRANG (Scroll Patterns)
  // ═══════════════════════════════════════════════════════════

  if (scrollEvts.length >= 5) {
    // 2a. Sự tương tác nội dung (dừng đọc)
    const pauseFlag = (b.scrollPauses || 0) === 0 && scrollEvts.length > 10;
    if (pauseFlag) { score += 10; reasons.push('no_scroll_pauses'); }
    assessments.push({
      cat: 'scroll', check: 'scroll_pauses',
      value: `${b.scrollPauses || 0} lần dừng / ${scrollEvts.length} sự kiện`,
      flagged: pauseFlag,
      note: pauseFlag
        ? 'Cuộn trang liên tục không dừng — bot quét nội dung một mạch'
        : `Dừng đọc ${b.scrollPauses || 0} lần — tương tác nội dung tự nhiên`
    });

    // 2b. Tốc độ cuộn
    const scrollSpeeds = [];
    for (let i = 1; i < scrollEvts.length; i++) {
      const dy = Math.abs(scrollEvts[i].y - scrollEvts[i-1].y);
      const dt = scrollEvts[i].t - scrollEvts[i-1].t;
      if (dt > 0) scrollSpeeds.push(dy / dt);
    }
    const scrollCV = _cv(scrollSpeeds);
    const scrollCVr = Math.round(scrollCV * 100) / 100;
    const scrollFlag = scrollSpeeds.length > 5 && scrollCV < 0.1;
    if (scrollFlag) { score += 15; reasons.push('uniform_scroll_speed'); }
    assessments.push({
      cat: 'scroll', check: 'scroll_speed_cv', value: scrollCVr, threshold: '< 0.1',
      flagged: scrollFlag,
      note: scrollFlag
        ? `Tốc độ cuộn đều như máy (CV=${scrollCVr}) — bot scrollTo() hoặc scrollBy()`
        : `Tốc độ cuộn biến thiên (CV=${scrollCVr}) — cuộn tay tự nhiên`
    });

    // 2c. Nhảy cóc trang (Jump Scroll)
    let jumpCount = 0;
    for (let i = 1; i < scrollEvts.length; i++) {
      if (Math.abs(scrollEvts[i].y - scrollEvts[i-1].y) > 500) jumpCount++;
    }
    if (scrollEvts.length > 3) {
      const jumpFlag = jumpCount > scrollEvts.length * 0.5;
      if (jumpFlag) { score += 10; reasons.push('jump_scroll'); }
      assessments.push({
        cat: 'scroll', check: 'jump_scroll', value: `${jumpCount}/${scrollEvts.length} nhảy > 500px`,
        flagged: jumpFlag,
        note: jumpFlag
          ? 'Nhảy tọa độ cố định — bot dùng scrollTo() hoặc anchor'
          : jumpCount > 0 ? `${jumpCount} lần nhảy lớn — có thể click anchor` : 'Cuộn mượt, không nhảy cóc — bình thường'
      });
    }
  } else {
    assessments.push({
      cat: 'scroll', check: 'scroll_data', value: scrollEvts.length,
      note: scrollEvts.length === 0 ? 'Không có dữ liệu cuộn trang' : `Chỉ ${scrollEvts.length} sự kiện — chưa đủ phân tích`
    });
  }


  // ═══════════════════════════════════════════════════════════
  // 3. TỌA ĐỘ CLICK / TAP
  // ═══════════════════════════════════════════════════════════

  // Combine clicks and touch taps for analysis
  const allTaps = isMobile && touchTaps.length > 0 ? touchTaps : clicks;
  const tapLabel = isMobile ? 'tap' : 'click';

  if (allTaps.length >= 2) {
    // 3a. Click/Tap chính xác vào tâm phần tử
    let centerClicks = 0;
    for (const c of allTaps) {
      if (c.elCenterX !== undefined) {
        const dx = Math.abs(c.x - c.elCenterX);
        const dy = Math.abs(c.y - c.elCenterY);
        // Touch is naturally less precise (finger vs cursor), use wider threshold
        const threshold = isMobile ? 3 : 1;
        if (dx <= threshold && dy <= threshold) centerClicks++;
      }
    }
    const centerFlag = centerClicks === allTaps.length && allTaps.length >= 2;
    if (centerFlag) { score += 15; reasons.push(`exact_center_${tapLabel}s`); }
    assessments.push({
      cat: tapLabel, check: 'center_accuracy',
      value: `${centerClicks}/${allTaps.length} ${tapLabel} chính xác vào tâm`,
      flagged: centerFlag,
      note: centerFlag
        ? `Tất cả ${tapLabel} đúng tâm nút — ${isMobile ? 'bot giả lập tap' : 'bot dùng element.click()'}`
        : `${tapLabel} lệch tâm tự nhiên — ${allTaps.length - centerClicks}/${allTaps.length} ${tapLabel} có sai số`
    });
  } else {
    assessments.push({
      cat: tapLabel, check: `${tapLabel}_data`, value: allTaps.length,
      note: allTaps.length === 0 ? `Không có dữ liệu ${tapLabel}` : `Chỉ ${allTaps.length} ${tapLabel} — chưa đủ phân tích`
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 4. PHÂN TÍCH TOUCH ĐẶC THÙ (Chỉ cho mobile)
  //    Điện thoại thật luôn có touch radius, force, và
  //    duration biến thiên tự nhiên
  // ═══════════════════════════════════════════════════════════

  if (isMobile) {
    // 4a. Touch radius — điện thoại thật luôn có radiusX/radiusY (kích thước ngón tay)
    //     Bot giả lập touch thường không có hoặc luôn = 0
    if (touchTrail.length >= 5) {
      const hasRadius = touchTrail.filter(t => t.rx && t.rx > 0).length;
      const radiusRatio = Math.round(hasRadius / touchTrail.length * 100);
      const noRadiusFlag = radiusRatio < 10 && touchTrail.length >= 10;
      if (noRadiusFlag) { score += 15; reasons.push('no_touch_radius'); }
      assessments.push({
        cat: 'touch', check: 'touch_radius',
        value: `${radiusRatio}% có radius (${hasRadius}/${touchTrail.length})`,
        flagged: noRadiusFlag,
        note: noRadiusFlag
          ? 'Touch events thiếu radius — bot giả lập không có thông tin ngón tay'
          : `${radiusRatio}% touch có radius — điện thoại thật`
      });

      // 4b. Radius variability — ngón tay thật thay đổi kích thước khi vuốt
      if (hasRadius >= 5) {
        const radii = touchTrail.filter(t => t.rx).map(t => t.rx);
        const radiusCV = _cv(radii);
        const radiusCVr = Math.round(radiusCV * 100) / 100;
        const uniformRadiusFlag = radiusCV < 0.05 && radii.length >= 5;
        if (uniformRadiusFlag) { score += 10; reasons.push('uniform_touch_radius'); }
        assessments.push({
          cat: 'touch', check: 'radius_cv', value: radiusCVr, threshold: '< 0.05',
          flagged: uniformRadiusFlag,
          note: uniformRadiusFlag
            ? `Kích thước touch không đổi (CV=${radiusCVr}) — bot giả lập`
            : `Kích thước touch biến thiên (CV=${radiusCVr}) — ngón tay thật`
        });
      }
    }

    // 4c. Tap duration variability — người thật tap nhanh/chậm khác nhau
    //     Bot giả lập thường dispatch touchstart+touchend với timing cố định
    if (touchTaps.length >= 3) {
      const durations = touchTaps.filter(t => t.duration != null).map(t => t.duration);
      if (durations.length >= 3) {
        const durCV = _cv(durations);
        const durCVr = Math.round(durCV * 100) / 100;
        const avgDur = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        const uniformDurFlag = durCV < 0.08 && durations.length >= 3;
        if (uniformDurFlag) { score += 15; reasons.push('uniform_tap_duration'); }
        assessments.push({
          cat: 'touch', check: 'tap_duration_cv',
          value: `CV=${durCVr}, avg=${avgDur}ms`,
          threshold: '< 0.08',
          flagged: uniformDurFlag,
          note: uniformDurFlag
            ? `Tap duration đều đặn (CV=${durCVr}) — bot giả lập touch`
            : `Tap duration biến thiên (CV=${durCVr}, avg=${avgDur}ms) — tự nhiên`
        });
      }

      // 4d. Zero-duration taps — dispatched events have 0ms or very small duration
      const zeroDurTaps = durations.filter(d => d < 5).length;
      const zeroDurFlag = zeroDurTaps === durations.length && durations.length >= 2;
      if (zeroDurFlag) { score += 20; reasons.push('zero_duration_taps'); }
      assessments.push({
        cat: 'touch', check: 'zero_duration',
        value: `${zeroDurTaps}/${durations.length} taps < 5ms`,
        flagged: zeroDurFlag,
        note: zeroDurFlag
          ? 'Tất cả taps có duration < 5ms — bot dispatch event lập tình'
          : `${zeroDurTaps} taps nhanh — bình thường`
      });
    }

    // 4e. Touch force — một số điện thoại hỗ trợ Force Touch / 3D Touch
    //     Nếu có force data, kiểm tra tính biến thiên
    if (touchTrail.length >= 5) {
      const forces = touchTrail.filter(t => t.force != null && t.force > 0).map(t => t.force);
      if (forces.length >= 5) {
        const forceCV = _cv(forces);
        const forceCVr = Math.round(forceCV * 100) / 100;
        assessments.push({
          cat: 'touch', check: 'force_variability',
          value: `CV=${forceCVr} (${forces.length} mẫu)`,
          flagged: false,
          note: `Lực ấn biến thiên CV=${forceCVr} — ${forceCVr > 0.1 ? 'tự nhiên' : 'quá đều'}`
        });
      }
    }
  }

  return { score, reasons, assessments };
}

module.exports = { analyzeBehavior };
