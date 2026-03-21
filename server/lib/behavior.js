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

  assessments.push({ cat: 'mouse', check: 'mousemove_count', value: n, note: n >= 10 ? 'Đủ dữ liệu phân tích' : 'Quá ít sự kiện mousemove' });

  if (n >= 10) {
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
    assessments.push({ cat: 'mouse', check: 'linearity', value: `${linearRatio}%`, threshold: '> 85%', flagged: linearFlag, note: linearFlag ? 'Di chuyển thẳng tắp — bot' : 'Có đường cong tự nhiên — người' });

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
    assessments.push({ cat: 'mouse', check: 'speed_cv', value: speedCVr, threshold: '< 0.1', flagged: speedFlag, note: speedFlag ? 'Tốc độ đều — không có gia tốc/giảm tốc' : `Tốc độ biến thiên tự nhiên (CV=${speedCVr})` });

    let avgDeviation = -1;
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
        avgDeviation = Math.round(totalDeviation / (n - 2) * 100) / 100;
        const jitterFlag = avgDeviation < 0.5;
        if (jitterFlag) { score += 15; reasons.push('no_micro_jitter'); }
        assessments.push({ cat: 'mouse', check: 'micro_jitter', value: `${avgDeviation}px`, threshold: '< 0.5px', flagged: jitterFlag, note: jitterFlag ? 'Không rung lắc tay — bot/bezier' : `Rung lắc tự nhiên ${avgDeviation}px — người` });
      }
    }

    const uniqueTimes = new Set(trail.map(p => p.t)).size;
    const fakeFlag = uniqueTimes <= 3 && n > 10;
    if (fakeFlag) { score += 30; reasons.push('fake_timestamps'); }
    assessments.push({ cat: 'mouse', check: 'timestamp_unique', value: uniqueTimes, threshold: '≤ 3', flagged: fakeFlag, note: fakeFlag ? `Chỉ ${uniqueTimes} timestamp khác nhau — giả mạo` : `${uniqueTimes} timestamp — bình thường` });

    if (n > 15) {
      const ints = [];
      for (let i = 1; i < n; i++) ints.push(trail[i].t - trail[i-1].t);
      const intCV = _cv(ints);
      const intCVr = Math.round(intCV * 100) / 100;
      const intFlag = intCV < 0.12;
      if (intFlag) { score += 25; reasons.push('regular_intervals'); }
      assessments.push({ cat: 'mouse', check: 'interval_cv', value: intCVr, threshold: '< 0.12', flagged: intFlag, note: intFlag ? 'Khoảng cách thời gian đều máy — script' : `Khoảng cách thời gian biến thiên (CV=${intCVr}) — người` });
    }
  }

  const clickCount = (b.clickPositions || []).length;
  const hoverFlag = n < 5 && clickCount > 0;
  if (hoverFlag) { score += 15; reasons.push('no_hover_before_click'); }
  if (clickCount > 0) {
    assessments.push({ cat: 'mouse', check: 'hover_before_click', value: `${n} mousemove, ${clickCount} click`, flagged: hoverFlag, note: hoverFlag ? 'Click mà không rê chuột — bot' : 'Có di chuột trước khi click — người' });
  }

  const dwellTimes = b.keyDwellTimes || [];
  const flightTimes = b.keyFlightTimes || [];

  if (dwellTimes.length >= 5) {
    const dwellCV = _cv(dwellTimes);
    const dwellCVr = Math.round(dwellCV * 100) / 100;
    const dwellFlag = dwellCV < 0.1;
    if (dwellFlag) { score += 20; reasons.push('constant_dwell_time'); }
    assessments.push({ cat: 'keyboard', check: 'dwell_time_cv', value: dwellCVr, threshold: '< 0.1', flagged: dwellFlag, note: dwellFlag ? 'Nhấn giữ phím đều nhau — bot' : `Thời gian giữ phím đa dạng (CV=${dwellCVr}) — người` });

    if (flightTimes.length >= 5) {
      const flightCV = _cv(flightTimes);
      const flightCVr = Math.round(flightCV * 100) / 100;
      const flightFlag = flightCV < 0.1;
      if (flightFlag) { score += 20; reasons.push('constant_flight_time'); }
      assessments.push({ cat: 'keyboard', check: 'flight_time_cv', value: flightCVr, threshold: '< 0.1', flagged: flightFlag, note: flightFlag ? 'Gõ phím nhịp điệu đều — bot' : `Nhịp gõ đa dạng (CV=${flightCVr}) — người` });
    }
  } else {
    assessments.push({ cat: 'keyboard', check: 'keystroke_data', value: dwellTimes.length, note: dwellTimes.length === 0 ? 'Không có dữ liệu bàn phím' : 'Quá ít phím để phân tích' });
  }

  if ((b.totalKeys || 0) > 20 && (b.backspaceCount || 0) === 0) {
    score += 5; reasons.push('no_typos');
    assessments.push({ cat: 'keyboard', check: 'backspace', value: `${b.totalKeys} phím, 0 Backspace`, flagged: true, note: 'Gõ nhiều nhưng không sửa lỗi — bot' });
  }

  const scrollEvts = b.scrollEvents || [];
  if (scrollEvts.length >= 5) {
    const pauseFlag = (b.scrollPauses || 0) === 0 && scrollEvts.length > 10;
    if (pauseFlag) { score += 10; reasons.push('no_scroll_pauses'); }
    assessments.push({ cat: 'scroll', check: 'scroll_pauses', value: `${b.scrollPauses || 0} lần dừng / ${scrollEvts.length} sự kiện`, flagged: pauseFlag, note: pauseFlag ? 'Cuộn liên tục không dừng đọc — bot' : 'Có dừng đọc nội dung — người' });

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
    assessments.push({ cat: 'scroll', check: 'scroll_speed_cv', value: scrollCVr, threshold: '< 0.1', flagged: scrollFlag, note: scrollFlag ? 'Tốc độ cuộn đều — bot' : `Tốc độ cuộn biến thiên (CV=${scrollCVr}) — người` });
  } else {
    assessments.push({ cat: 'scroll', check: 'scroll_data', value: scrollEvts.length, note: 'Ít/không có dữ liệu cuộn trang' });
  }

  if (b.rafStable === false) {
    score += 15; reasons.push('raf_unstable');
    assessments.push({ cat: 'focus', check: 'raf_stable', value: false, flagged: true, note: 'Trình duyệt không render frame — headless' });
  } else {
    assessments.push({ cat: 'focus', check: 'raf_stable', value: true, flagged: false, note: 'Render frame ổn định — trình duyệt thật' });
  }

  if (!b.screen?.w || !b.screen?.h) {
    score += 20; reasons.push('zero_screen');
    assessments.push({ cat: 'focus', check: 'screen', value: '0x0', flagged: true, note: 'Không có màn hình — headless' });
  } else {
    const { w, h } = b.screen;
    const vmFlag = (w === 800 && h === 600) || (w === 1024 && h === 768 && b.screen.dpr === 1);
    if (vmFlag) { score += 5; reasons.push('vm_screen'); }
    assessments.push({ cat: 'focus', check: 'screen', value: `${w}x${h}@${b.screen.dpr || 1}x`, flagged: vmFlag, note: vmFlag ? 'Độ phân giải giống máy ảo' : 'Độ phân giải bình thường' });
  }

  assessments.push({ cat: 'focus', check: 'tab_blur', value: b.totalBlur || 0, note: `Chuyển tab ${b.totalBlur || 0} lần` });

  const clicks = b.clickPositions || [];
  if (clicks.length >= 3) {
    let centerClicks = 0;
    for (const c of clicks) {
      if (c.elCenterX !== undefined) {
        const dx = Math.abs(c.x - c.elCenterX);
        const dy = Math.abs(c.y - c.elCenterY);
        if (dx <= 1 && dy <= 1) centerClicks++;
      }
    }
    const centerFlag = centerClicks === clicks.length;
    if (centerFlag) { score += 15; reasons.push('exact_center_clicks'); }
    assessments.push({ cat: 'click', check: 'center_accuracy', value: `${centerClicks}/${clicks.length} click vào tâm`, flagged: centerFlag, note: centerFlag ? 'Tất cả click chính xác vào tâm — element.click()' : 'Click lệch tâm tự nhiên — người' });
  } else {
    assessments.push({ cat: 'click', check: 'click_data', value: clicks.length, note: clicks.length === 0 ? 'Không có dữ liệu click' : `Chỉ ${clicks.length} click — chưa đủ phân tích` });
  }

  return { score, reasons, assessments };
}

module.exports = { analyzeBehavior };
