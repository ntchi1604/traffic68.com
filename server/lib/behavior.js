function _cv(arr) {
  if (!arr || arr.length < 3) return 999;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  if (avg === 0) return 0;
  const variance = arr.reduce((a, b) => a + (b - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance) / avg;
}

function analyzeBehavior(b) {
  if (!b) return { score: 0, reasons: [], assessments: [] };
  let score = 0;
  const reasons = [];
  const assessments = [];
  const trail = b.mouseTrail || [];
  const n = trail.length;

  // ═══════════════════════════════════════════════════════════
  // 0. KIỂM TRA TƯƠNG TÁC BẮT BUỘC
  //    Script yêu cầu click + cuộn → nếu thiếu = BOT
  // ═══════════════════════════════════════════════════════════

  const clicks = b.clickPositions || [];
  const scrollEvts = b.scrollEvents || [];
  const noClick = clicks.length === 0;
  const noScroll = scrollEvts.length === 0;

  if (noClick || noScroll) {
    const missing = [];
    if (noClick) missing.push('click');
    if (noScroll) missing.push('scroll');
    return {
      score: 100,
      reasons: ['no_interaction'],
      assessments: [{
        cat: 'interaction', check: 'mandatory',
        value: `click: ${clicks.length}, scroll: ${scrollEvts.length}`,
        flagged: true,
        note: `Không có ${missing.join(' và ')} — script bắt buộc tương tác, đây chắc chắn là bot`
      }]
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 1. DI CHUYỂN CHUỘT (Mouse Dynamics)
  // ═══════════════════════════════════════════════════════════

  // 1a. Số lượng sự kiện mousemove
  //     Người thật tạo ra hàng trăm sự kiện liên tục
  //     Bot chỉ tạo 1-2 sự kiện tại điểm đầu và cuối
  const tooFewMouse = n < 5 && (b.clickPositions || []).length > 0;
  assessments.push({
    cat: 'mouse', check: 'mousemove_count', value: n,
    flagged: tooFewMouse,
    note: tooFewMouse
      ? `Chỉ ${n} sự kiện mousemove — bot click trực tiếp không rê chuột`
      : n >= 10 ? `${n} sự kiện — đủ dữ liệu phân tích` : `${n} sự kiện — ít, chưa đủ phân tích`
  });
  if (tooFewMouse) { score += 15; reasons.push('no_hover_before_click'); }

  if (n >= 10) {
    // 1b. Tính tuyến tính (Linearity)
    //     Bot di chuyển theo đường thẳng tuyệt đối từ A→B (hàm toán học)
    //     Người thật luôn có đường cong tự nhiên với sai số nhỏ
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
      cat: 'mouse', check: 'linearity', value: `${linearRatio}%`, threshold: '> 85%',
      flagged: linearFlag,
      note: linearFlag
        ? 'Di chuyển thẳng tắp như hàm toán học — bot dùng moveTo(x,y)'
        : `Đường cong tự nhiên (${linearRatio}% thẳng) — người thật`
    });

    // 1c. Gia tốc (Acceleration)
    //     Người thật: Tăng tốc → Đạt đỉnh → Giảm tốc khi gần mục tiêu
    //     Bot: Tốc độ hằng số (constant velocity) suốt quá trình
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
      cat: 'mouse', check: 'speed_cv', value: speedCVr, threshold: '< 0.1',
      flagged: speedFlag,
      note: speedFlag
        ? 'Tốc độ không đổi suốt quá trình — thiếu gia tốc/giảm tốc tự nhiên'
        : `Tốc độ thay đổi tự nhiên (CV=${speedCVr}) — có gia tốc lên và giảm tốc xuống`
    });

    // 1d. Mô hình tăng tốc - giảm tốc (Acceleration Profile)
    //     Người thật: nửa đầu tăng tốc, nửa sau giảm tốc
    //     Bot Bézier: tốc độ đều hoặc không có phase rõ ràng
    if (speeds.length >= 10) {
      const half = Math.floor(speeds.length / 2);
      const firstHalf = speeds.slice(0, half);
      const secondHalf = speeds.slice(half);
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const hasDecel = avgSecond < avgFirst * 0.7;
      assessments.push({
        cat: 'mouse', check: 'accel_profile', value: `${Math.round(avgFirst*100)/100} → ${Math.round(avgSecond*100)/100}`,
        flagged: false,
        note: hasDecel
          ? 'Có giảm tốc khi gần mục tiêu — hành vi tự nhiên'
          : 'Gia tốc không rõ ràng — cần kết hợp chỉ số khác'
      });
    }

    // 1e. Micro-jitter (Rung lắc cơ tay)
    //     Bot Bézier xịn giả lập đường cong nhưng thiếu "rung lắc" do cơ tay tạo ra
    //     Người thật luôn có sai lệch nhỏ ±1-10px so với đường trung bình
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
          cat: 'mouse', check: 'micro_jitter', value: `${avgDeviation}px`, threshold: '< 0.5px',
          flagged: jitterFlag,
          note: jitterFlag
            ? 'Không có rung lắc cơ tay — bot Bézier hoặc script di chuyển'
            : `Rung lắc tay tự nhiên ${avgDeviation}px — người thật`
        });
      }
    }

    // 1f. Timestamp giả mạo
    //     Bot inject sự kiện với timestamp giống nhau hoặc rất ít giá trị unique
    const uniqueTimes = new Set(trail.map(p => p.t)).size;
    const fakeFlag = uniqueTimes <= 3 && n > 10;
    if (fakeFlag) { score += 30; reasons.push('fake_timestamps'); }
    assessments.push({
      cat: 'mouse', check: 'timestamp_unique', value: uniqueTimes, threshold: '≤ 3',
      flagged: fakeFlag,
      note: fakeFlag
        ? `Chỉ ${uniqueTimes} timestamp khác nhau trong ${n} sự kiện — inject giả mạo`
        : `${uniqueTimes} timestamp riêng biệt — bình thường`
    });

    // 1g. Khoảng cách thời gian giữa các điểm
    //     Bot dùng setInterval tạo sự kiện đều đặn như máy
    //     Người thật có khoảng cách thời gian biến đổi
    if (n > 15) {
      const ints = [];
      for (let i = 1; i < n; i++) ints.push(trail[i].t - trail[i-1].t);
      const intCV = _cv(ints);
      const intCVr = Math.round(intCV * 100) / 100;
      const intFlag = intCV < 0.12;
      if (intFlag) { score += 25; reasons.push('regular_intervals'); }
      assessments.push({
        cat: 'mouse', check: 'interval_cv', value: intCVr, threshold: '< 0.12',
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
    //     Người thật cuộn → dừng ở hình ảnh/văn bản quan trọng → cuộn tiếp
    //     Bot cuộn một mạch từ đầu đến cuối trang
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
    //     Bot cuộn với tốc độ đều hoặc nhảy cóc đến tọa độ cố định
    //     Người thật cuộn nhanh/chậm tùy đoạn nội dung
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
    //     Bot thường nhảy ngay đến tọa độ cố định (ví dụ: scrollTo(0, 5000))
    //     Người thật cuộn mượt với khoảng nhỏ
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
  // 3. TỌA ĐỘ CLICK
  // ═══════════════════════════════════════════════════════════

  if (clicks.length >= 2) {
    // 3a. Click chính xác vào tâm phần tử
    //     Bot dùng element.click() → tọa độ chính xác tâm nút
    //     Người thật thường lệch tâm nút bấm một chút
    let centerClicks = 0;
    for (const c of clicks) {
      if (c.elCenterX !== undefined) {
        const dx = Math.abs(c.x - c.elCenterX);
        const dy = Math.abs(c.y - c.elCenterY);
        if (dx <= 1 && dy <= 1) centerClicks++;
      }
    }
    const centerFlag = centerClicks === clicks.length && clicks.length >= 2;
    if (centerFlag) { score += 15; reasons.push('exact_center_clicks'); }
    assessments.push({
      cat: 'click', check: 'center_accuracy',
      value: `${centerClicks}/${clicks.length} click chính xác vào tâm`,
      flagged: centerFlag,
      note: centerFlag
        ? 'Tất cả click đúng tâm nút (±1px) — bot dùng element.click()'
        : `Click lệch tâm tự nhiên — ${clicks.length - centerClicks}/${clicks.length} click có sai số ngón tay`
    });
  } else {
    assessments.push({
      cat: 'click', check: 'click_data', value: clicks.length,
      note: clicks.length === 0 ? 'Không có dữ liệu click' : `Chỉ ${clicks.length} click — chưa đủ phân tích`
    });
  }

  return { score, reasons, assessments };
}

module.exports = { analyzeBehavior };
