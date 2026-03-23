/**
 * LinkGateway — public page /vuot-link/:slug
 * Visitor must complete a vượt link task to access the destination URL
 * set by the worker who created this link.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, Globe, ShieldCheck, ShieldOff, ExternalLink, ArrowRight,
  AlertCircle, Loader2, WifiOff, Copy, Check, Lock, Unlock, RefreshCw,
} from 'lucide-react';

/* ─── CreepJS via iframe (same approach as VuotLink.jsx) ─── */
let _creepResult = null;
let _creepVisitorId = 'unknown';
let _creepDone = false;
let _creepResolvers = [];

function _resolveCreep(result) {
  if (_creepDone) return;
  _creepResult = result;
  _creepDone = true;
  _creepResolvers.forEach(r => r(result));
  _creepResolvers = [];
}

function _generateFallbackId() {
  try {
    const cv = document.createElement('canvas');
    cv.width = 200; cv.height = 50;
    const ctx = cv.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('traffic68-fp-' + navigator.userAgent.length, 2, 2);
    return 'fb-' + cv.toDataURL().slice(-32);
  } catch { return 'fb-' + Date.now().toString(36); }
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', function handler(e) {
    if (!e.data || e.data.type !== 'creep-result') return;
    const d = e.data.data;
    if (d) {
      if (d.visitorId && d.visitorId !== 'unknown') _creepVisitorId = d.visitorId;
      _resolveCreep(d.botDetection || { bot: false });
    }
    window.removeEventListener('message', handler);
  });

  const _loadCreepFrame = () => {
    const iframe = document.createElement('iframe');
    iframe.src = '/creep-frame.html';
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.onerror = () => {
      if (_creepVisitorId === 'unknown') _creepVisitorId = _generateFallbackId();
      _resolveCreep({ bot: false, creepError: true });
    };
    document.body.appendChild(iframe);
  };

  if (document.body) _loadCreepFrame();
  else document.addEventListener('DOMContentLoaded', _loadCreepFrame);

  setTimeout(() => {
    if (!_creepDone) {
      if (_creepVisitorId === 'unknown') _creepVisitorId = _generateFallbackId();
      _resolveCreep({ bot: false, creepTimeout: true });
    }
  }, 12000);
}

function getCreepData() {
  if (_creepDone) return Promise.resolve({ botDetection: _creepResult, visitorId: _creepVisitorId });
  return new Promise(resolve => {
    _creepResolvers.push(r => resolve({ botDetection: r, visitorId: _creepVisitorId }));
    setTimeout(() => {
      if (!_creepDone) {
        if (_creepVisitorId === 'unknown') _creepVisitorId = _generateFallbackId();
        _resolveCreep({ bot: false, creepTimeout: true });
      }
    }, 12000);
  });
}

/* ─── Probe data ─── */
const probeData = {};
if (typeof window !== 'undefined') {
  try {
    probeData.webdriver = !!navigator.webdriver;
    probeData.cdc = !!(window.cdc_adoQpoasnfa76pfcZLmcfl_ || window.cdc_adoQpoasnfa76pfcZLmcfl_Array || window.cdc_adoQpoasnfa76pfcZLmcfl_Promise || window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol);
    probeData.selenium = !!(document.__selenium_unwrapped || document.__webdriver_evaluate || document.__driver_evaluate || window._Selenium_IDE_Recorder || window.__nightmare);
    probeData.pluginCount = navigator.plugins ? navigator.plugins.length : -1;
    probeData.langCount = navigator.languages ? navigator.languages.length : 0;
    probeData.hasChrome = !!window.chrome;
    probeData.hasChromeRuntime = !!(window.chrome && window.chrome.runtime);
    if (window.Notification) probeData.notifPerm = Notification.permission;
    if (navigator.connection) probeData.rtt = navigator.connection.rtt;
  } catch (e) { }
}

/* ─── Behavioral tracking ─── */
const _bhv = {
  startTime: Date.now(),
  mouseTrail: [], clickPositions: [],
  touchTrail: [], touchTaps: [], _touchStartMap: {},
  keyDwellTimes: [], keyFlightTimes: [], _keyDownMap: {},
  backspaceCount: 0, totalKeys: 0,
  scrollEvents: [], scrollPauses: 0, _lastScrollT: 0,
  totalBlur: 0, rafStable: true, _lastKeyUp: 0,
  screen: typeof window !== 'undefined' ? { w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1 } : null,
  isMobile: typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
};
let _bhvBound = false;
function bindBehavior() {
  if (_bhvBound || typeof document === 'undefined') return;
  _bhvBound = true;
  const st = _bhv.startTime;
  document.addEventListener('mousemove', (e) => {
    _bhv.mouseTrail.push({ x: e.clientX, y: e.clientY, t: Date.now() - st });
    if (_bhv.mouseTrail.length > 80) _bhv.mouseTrail.shift();
  }, { passive: true });
  document.addEventListener('click', (e) => {
    const r = e.target ? e.target.getBoundingClientRect() : null;
    const entry = { x: e.clientX, y: e.clientY, t: Date.now() - st };
    if (r) { entry.elCenterX = Math.round(r.left + r.width / 2); entry.elCenterY = Math.round(r.top + r.height / 2); }
    _bhv.clickPositions.push(entry);
    if (_bhv.clickPositions.length > 20) _bhv.clickPositions.shift();
  }, { passive: true });
  // ── Touch events (mobile) ──
  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    const now = Date.now();
    _bhv._touchStartMap[touch.identifier] = { x: touch.clientX, y: touch.clientY, t: now };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    const entry = { x: Math.round(touch.clientX), y: Math.round(touch.clientY), t: Date.now() - st };
    if (touch.radiusX) { entry.rx = Math.round(touch.radiusX); entry.ry = Math.round(touch.radiusY); }
    if (touch.force) entry.force = Math.round(touch.force * 100) / 100;
    _bhv.touchTrail.push(entry);
    if (_bhv.touchTrail.length > 80) _bhv.touchTrail.shift();
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    const now = Date.now();
    const start = _bhv._touchStartMap[touch.identifier];
    const entry = { x: Math.round(touch.clientX), y: Math.round(touch.clientY), t: now - st };
    if (start) {
      entry.duration = now - start.t;
      entry.dx = Math.round(touch.clientX - start.x);
      entry.dy = Math.round(touch.clientY - start.y);
      delete _bhv._touchStartMap[touch.identifier];
    }
    const r = e.target ? e.target.getBoundingClientRect() : null;
    if (r) { entry.elCenterX = Math.round(r.left + r.width / 2); entry.elCenterY = Math.round(r.top + r.height / 2); }
    _bhv.touchTaps.push(entry);
    if (_bhv.touchTaps.length > 20) _bhv.touchTaps.shift();
  }, { passive: true });
  document.addEventListener('keydown', (e) => {
    _bhv.totalKeys++;
    if (e.key === 'Backspace') _bhv.backspaceCount++;
    if (!_bhv._keyDownMap[e.key]) _bhv._keyDownMap[e.key] = Date.now();
  }, { passive: true });
  document.addEventListener('keyup', (e) => {
    const d = _bhv._keyDownMap[e.key];
    if (d) {
      const dwell = Date.now() - d;
      _bhv.keyDwellTimes.push(dwell);
      if (_bhv.keyDwellTimes.length > 30) _bhv.keyDwellTimes.shift();
      if (_bhv._lastKeyUp) {
        _bhv.keyFlightTimes.push(Date.now() - _bhv._lastKeyUp);
        if (_bhv.keyFlightTimes.length > 30) _bhv.keyFlightTimes.shift();
      }
      _bhv._lastKeyUp = Date.now();
      delete _bhv._keyDownMap[e.key];
    }
  }, { passive: true });
  window.addEventListener('scroll', () => {
    const now = Date.now();
    if (_bhv._lastScrollT && (now - _bhv._lastScrollT) > 500) _bhv.scrollPauses++;
    _bhv._lastScrollT = now;
    _bhv.scrollEvents.push({ y: window.scrollY || 0, t: now - st });
    if (_bhv.scrollEvents.length > 40) _bhv.scrollEvents.shift();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) _bhv.totalBlur++; });
  let rafCount = 0; const rafStart = performance.now();
  function checkRaf(ts) {
    rafCount++;
    if (rafCount < 60) requestAnimationFrame(checkRaf);
    else _bhv.rafStable = (ts - rafStart) < 3000;
  }
  if (window.requestAnimationFrame) requestAnimationFrame(checkRaf);
}
if (typeof window !== 'undefined') bindBehavior();

function getBehavioralData() {
  return {
    mouseTrail: _bhv.mouseTrail,
    clickPositions: _bhv.clickPositions,
    touchTrail: _bhv.touchTrail,
    touchTaps: _bhv.touchTaps,
    keyDwellTimes: _bhv.keyDwellTimes,
    keyFlightTimes: _bhv.keyFlightTimes,
    backspaceCount: _bhv.backspaceCount,
    totalKeys: _bhv.totalKeys,
    scrollEvents: _bhv.scrollEvents,
    scrollPauses: _bhv.scrollPauses,
    totalBlur: _bhv.totalBlur,
    rafStable: _bhv.rafStable,
    screen: _bhv.screen,
    isMobile: _bhv.isMobile,
    probes: probeData,
  };
}

const API = '/api/vuot-link';

/* ─── Main Component ─── */
export default function LinkGateway() {
  const { slug } = useParams();
  const [linkInfo, setLinkInfo] = useState(null);
  const [linkError, setLinkError] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [task, setTask] = useState(null);
  const [isIncognito, setIsIncognito] = useState(false);
  const [isAdBlock, setIsAdBlock] = useState(false);

  const [inputCode, setInputCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [showError, setShowError] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Set tab title
  useEffect(() => {
    document.title = 'Vượt link để truy cập — traffic68.com';
  }, []);

  // Ad blocker detection
  useEffect(() => {
    const detectAdBlock = async () => {
      const bait = document.createElement('div');
      bait.className = 'ad ads adsbox ad-placement ad-banner textads banner-ads';
      bait.setAttribute('id', 'ad-test-banner');
      bait.innerHTML = '&nbsp;';
      bait.style.cssText = 'position:absolute;top:-10px;left:-10px;width:1px;height:1px;overflow:hidden;';
      document.body.appendChild(bait);
      await new Promise(r => setTimeout(r, 200));
      const baitBlocked = bait.offsetHeight === 0 || bait.clientHeight === 0 ||
        window.getComputedStyle(bait).display === 'none' ||
        window.getComputedStyle(bait).visibility === 'hidden';
      bait.remove();
      let fetchBlocked = false;
      try { await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', { method: 'HEAD', mode: 'no-cors', cache: 'no-cache' }); } catch { fetchBlocked = true; }
      if (baitBlocked || fetchBlocked) setIsAdBlock(true);
    };
    detectAdBlock();
  }, []);

  // Step 1: Load link info
  useEffect(() => {
    fetch(`/api/shortlink/info/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setLinkError(data.error);
        else setLinkInfo(data.link);
      })
      .catch(() => setLinkError('Không thể tải thông tin link'));
  }, [slug]);

  // Fetch challenge + task (reusable)
  const fetchTask = useCallback(async (force = false) => {
    if (!linkInfo) return;
    const sessionKey = `gw_task_${slug}`;

    // If not forced, try to restore from sessionStorage
    if (!force) {
      try {
        const cached = sessionStorage.getItem(sessionKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Only use cache if task is still pending (not completed/expired)
          if (parsed && parsed.id && !parsed._expired) {
            setTask(parsed);
            setLoading(false);
            return;
          }
        }
      } catch { }
    }

    try {
      setLoading(true); setError('');

      // Incognito detection
      if (navigator.storage && navigator.storage.estimate) {
        const { quota } = await navigator.storage.estimate();
        if (quota && quota < 10 * 1024 * 1024 * 1024) {
          setIsIncognito(true);
          return;
        }
      }

      const creepData = await getCreepData();
      let visitorId = creepData.visitorId || 'unknown';
      let botDetectionResult = creepData.botDetection;

      if (window.clarity) {
        window.clarity('set', 'visitor_id', visitorId);
        window.clarity('identify', visitorId);
      }

      // Get challenge — pass slug so server binds worker_link_id to session
      const chRes = await fetch(`${API}/challenge?slug=${encodeURIComponent(slug)}`);
      if (!chRes.ok) throw new Error('Không thể lấy challenge');
      const challenge = await chRes.json();

      // Solve PoW
      let powNonce = 0;
      const target = '0'.repeat(challenge.d || 4);
      const enc = new TextEncoder();
      while (true) {
        const data = enc.encode(challenge.p + powNonce);
        const buf = await crypto.subtle.digest('SHA-256', data);
        const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (hex.startsWith(target)) break;
        powNonce++;
        if (powNonce > 5000000) throw new Error('PoW timeout');
      }

      // Canvas 2D + WebGL proof
      let domWidth = 0;
      let glRenderer = '';
      let glPixel = [0, 0, 0];
      try {
        const cv = document.createElement('canvas');
        const ctx2d = cv.getContext('2d');
        ctx2d.font = `${challenge.df}px monospace`;
        domWidth = ctx2d.measureText(challenge.dt).width;
      } catch { }
      try {
        const glCv = document.createElement('canvas');
        glCv.width = 4; glCv.height = 4;
        const gl = glCv.getContext('webgl') || glCv.getContext('experimental-webgl');
        if (gl) {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          glRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
          const [cr, cg, cb] = challenge.gc;
          gl.clearColor(cr, cg, cb, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          const px = new Uint8Array(4);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          glPixel = [px[0], px[1], px[2]];
        }
      } catch { }

      // Request task
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const taskRes = await fetch(`${API}/task`, {
        method: 'POST', headers,
        body: JSON.stringify({
          challengeId: challenge.c,
          powNonce,
          domWidth,
          glRenderer,
          glPixel,
          visitorId,
          botDetection: botDetectionResult,
          probes: probeData,
          behavioral: getBehavioralData(),
        }),
      });

      if (taskRes.status === 404) {
        setError('Hiện tại không có nhiệm vụ nào. Vui lòng thử lại sau.');
        return;
      }
      if (taskRes.status === 429) {
        const e = await taskRes.json();
        setError(e.error || 'Bạn đã đạt giới hạn hôm nay.');
        return;
      }
      if (!taskRes.ok) throw new Error('Không thể lấy nhiệm vụ');
      const newTask = await taskRes.json();
      setTask(newTask);
      // Save to sessionStorage
      try { sessionStorage.setItem(sessionKey, JSON.stringify(newTask)); } catch { }
    } catch (err) {
      setError(err.message || 'Lỗi');
    } finally {
      setLoading(false);
    }
  }, [linkInfo, slug]);

  // Step 2: After link info loaded, fetch challenge + task
  useEffect(() => {
    if (!linkInfo) return;
    fetchTask(false);
  }, [linkInfo, fetchTask]);

  // Change task (skip current)
  const [changingTask, setChangingTask] = useState(false);
  const handleChangeTask = useCallback(async () => {
    setChangingTask(true);
    setTask(null);
    setInputCode('');
    setVerified(false);
    setCompletionResult(null);
    setShowError(false);
    try { sessionStorage.removeItem(`gw_task_${slug}`); } catch { }
    await fetchTask(true);
    setChangingTask(false);
  }, [fetchTask, slug]);

  // Verify code
  const handleVerify = useCallback(async () => {
    if (!inputCode.trim() || inputCode.trim().length < 4) {
      setShowError(true); setError('Vui lòng nhập mã xác nhận.');
      setTimeout(() => setShowError(false), 3000); return;
    }
    setCompleting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/task/${task.id}/verify`, {
        method: 'POST', headers,
        body: JSON.stringify({ code: inputCode.trim(), _tk: task._tk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mã không đúng');
      setCompletionResult(data);
      setVerified(true); setShowError(false);
      try { sessionStorage.removeItem(`gw_task_${slug}`); } catch { }

      // Redirect to destination_url after 3 seconds
      if (data.destination_url) {
        setRedirecting(true);
        setTimeout(() => { window.location.href = data.destination_url; }, 3000);
      }
    } catch (err) {
      setShowError(true); setError(err.message);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setCompleting(false);
    }
  }, [inputCode, task]);

  const keyword = task?.keyword || '';
  const campaignImage = task?.image1_url || '';
  const campaignImage2 = task?.image2_url || '';
  const hasMultiSite = !!(campaignImage2);
  const widgetConfig = task?.widgetConfig || null;
  const trafficType = task?.traffic_type || 'google_search';
  const targetUrl = task?.target_url || '';
  const isDirect = trafficType === 'direct';

  // ── Link not found ──
  if (linkError) return (
    <Wrapper>
      <Center>
        <Icon bg="#FEF2F2" border="#FECACA"><WifiOff size={32} color="#EF4444" /></Icon>
        <h2 style={{ color: '#1E3A6E', fontWeight: 800, margin: '0 0 8px' }}>Link không tồn tại</h2>
        <p style={{ color: '#64748B', margin: 0 }}>{linkError}</p>
      </Center>
    </Wrapper>
  );

  // ── Loading link info ──
  if (!linkInfo) return (
    <Wrapper>
      <Center>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748B', fontWeight: 500 }}>Đang tải link...</p>
      </Center>
    </Wrapper>
  );

  // ── Incognito ──
  if (isIncognito) return (
    <Wrapper>
      <Center>
        <Icon bg="#FFF7ED" border="#FED7AA"><ShieldCheck size={32} color="#F97316" /></Icon>
        <h2 style={{ color: '#1E3A6E', fontWeight: 800, margin: 0 }}>Không hỗ trợ trình duyệt ẩn danh</h2>
        <p style={{ color: '#64748B', margin: 0 }}>Vui lòng mở bằng cửa sổ trình duyệt bình thường.</p>
      </Center>
    </Wrapper>
  );

  // ── Ad Blocker ──
  if (isAdBlock) return (
    <Wrapper>
      <Center>
        <Icon bg="#FEF2F2" border="#FECACA"><ShieldOff size={32} color="#EF4444" /></Icon>
        <h2 style={{ color: '#1E3A6E', fontWeight: 800, margin: 0 }}>Vui lòng tắt trình chặn quảng cáo</h2>
        <p style={{ color: '#64748B', margin: 0, maxWidth: 400, lineHeight: 1.6 }}>
          Hệ thống phát hiện bạn đang sử dụng tiện ích chặn quảng cáo.<br />
          Vui lòng <strong>tắt trình chặn quảng cáo</strong> rồi tải lại trang.
        </p>
        <button onClick={() => window.location.reload()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#F97316,#EA580C)', color: '#fff', padding: '12px 28px', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8, boxShadow: '0 4px 20px rgba(249,115,22,0.3)' }}>
          Tải lại trang
        </button>
      </Center>
    </Wrapper>
  );

  // ── Loading task ──
  if (loading) return (
    <Wrapper>
      <Center>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748B', fontWeight: 500 }}>Đang chuẩn bị nhiệm vụ...</p>
      </Center>
    </Wrapper>
  );

  // ── Error getting task ──
  if (error && !task) return (
    <Wrapper>
      <Center>
        <Icon bg="#FEF2F2" border="#FECACA"><WifiOff size={32} color="#EF4444" /></Icon>
        <h2 style={{ color: '#1E3A6E', fontWeight: 800, margin: '0 0 8px' }}>Không thể tải nhiệm vụ</h2>
        <p style={{ color: '#64748B', margin: '0 0 16px' }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#3B82F6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Thử lại</button>
      </Center>
    </Wrapper>
  );

  return (
    <Wrapper>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 48px' }}>


        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 'clamp(20px,4vw,30px)', fontWeight: 900, color: '#1E3A6E', margin: '0 0 6px' }}>
            HOÀN THÀNH NHIỆM VỤ ĐỂ TRUY CẬP
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>Thực hiện {isDirect ? 2 : 4} bước bên dưới theo thứ tự để mở khóa liên kết</p>
          {task && !verified && (
            <button onClick={handleChangeTask} disabled={changingTask}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'none', border: '1.5px solid #CBD5E1', color: '#64748B', padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#64748B'; }}>
              <RefreshCw size={14} style={changingTask ? { animation: 'spin 1s linear infinite' } : {}} />
              {changingTask ? 'Đang đổi...' : 'Đổi nhiệm vụ'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Google Search cards (only when NOT direct) ── */}
          {!isDirect && (
            <StepCard n={1} color="#3B82F6" title="MỞ GOOGLE" verified={verified}>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0' }}>
                  <div style={{ background: '#F1F5F9', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {['#EF4444', '#F59E0B', '#22C55E'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                    </div>
                    <div style={{ flex: 1, background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#3B82F6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Globe size={12} style={{ color: '#3B82F6' }} /> google.com
                    </div>
                  </div>
                  <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>
                      <span style={{ color: '#4285F4' }}>G</span><span style={{ color: '#EA4335' }}>o</span><span style={{ color: '#FBBC04' }}>o</span><span style={{ color: '#4285F4' }}>g</span><span style={{ color: '#34A853' }}>l</span><span style={{ color: '#EA4335' }}>e</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', margin: '16px auto 0', maxWidth: 300, background: '#fff', border: '1px solid #ddd', borderRadius: 24, padding: '8px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                      <Search size={16} style={{ color: '#94A3B8', marginRight: 8 }} />
                      <span style={{ color: '#94A3B8', fontSize: 14 }}>Tìm kiếm...</span>
                    </div>
                  </div>
                </div>
                <a href="https://www.google.com" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', textDecoration: 'none', padding: '11px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}>
                  <ExternalLink size={15} /> Mở Google
                </a>
              </div>
            </StepCard>
          )}

          {!isDirect && (
            <StepCard n={2} color="#F97316" title="NHẬP TỪ KHÓA" verified={verified}>
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 14, padding: 16 }}>
                <p style={{ fontSize: 11, color: '#92400E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Từ khóa tìm kiếm</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px dashed #FB923C', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
                  <Search size={16} color="#F97316" />
                  <span style={{ flex: 1, color: '#EA580C', fontSize: 'clamp(13px,2.5vw,16px)', fontWeight: 700 }}>{keyword || 'traffic user giá rẻ traffic68'}</span>
                  <CopyBtn text={keyword || 'traffic user giá rẻ traffic68'} />
                </div>
                {['Copy từ khóa bên trên', 'Dán vào ô tìm kiếm Google', 'Nhấn Enter để tìm kiếm'].map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(249,115,22,0.06)', borderRadius: 8, padding: '8px 12px', marginBottom: i < 2 ? 6 : 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                    </div>
                    <span style={{ color: '#374151', fontSize: 13 }}>{t}</span>
                  </div>
                ))}
              </div>
            </StepCard>
          )}

          {!isDirect && (
            <StepCard n={3} color="#7C3AED" title="TÌM TRANG ĐÍCH" verified={verified}>
              {(campaignImage || campaignImage2) && (
                <div style={{ marginBottom: 16 }}>
                  {hasMultiSite ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                        <span style={{ fontSize: 16 }}>&#x1F4A1;</span>
                        <p style={{ margin: 0, color: '#1D4ED8', fontSize: 13, fontWeight: 700 }}>
                          Bạn có thể truy cập <strong>1 trong 2 trang web</strong> bất kỳ dưới đây.
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[{ img: campaignImage, label: 'Trang web 1' }, { img: campaignImage2, label: 'Trang web 2' }].map(({ img, label }, idx) => img ? (
                          <div key={idx}>
                            <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>🎯 {label}</p>
                            <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #DDD6FE', boxShadow: '0 4px 16px rgba(99,102,241,0.1)' }}>
                              <img src={img} alt={label} style={{ width: '100%', display: 'block' }} onError={e => e.target.style.display = 'none'} />
                            </div>
                          </div>
                        ) : null)}
                      </div>
                    </>
                  ) : campaignImage ? (
                    <>
                      <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                        🎯 Trang đích cần tìm:
                      </p>
                      <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #DDD6FE', boxShadow: '0 4px 20px rgba(99,102,241,0.12)' }}>
                        <img src={campaignImage} alt="Trang đích" style={{ width: '100%', display: 'block' }} onError={e => e.target.style.display = 'none'} />
                      </div>
                    </>
                  ) : null}
                </div>
              )}
              <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 14, padding: 14 }}>
                {['Cuộn tìm trong kết quả Google', hasMultiSite ? 'Tìm trang có giao diện giống 1 trong 2 hình trên' : 'Tìm trang có giao diện giống hình trên', 'Click vào kết quả để truy cập trang'].map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(139,92,246,0.06)', borderRadius: 8, padding: '8px 12px', marginBottom: i < 2 ? 8 : 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                    </div>
                    <span style={{ color: '#374151', fontSize: 13 }}>{t}</span>
                  </div>
                ))}
              </div>
            </StepCard>
          )}

          {/* ── Direct traffic card ── */}
          {isDirect && (
            <StepCard n={1} color="#3B82F6" title="TRUY CẬP TRANG WEB" verified={verified}>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px dashed #3B82F6', borderRadius: 10, padding: '12px 16px', width: '100%', maxWidth: 400 }}>
                  <Globe size={16} style={{ color: '#3B82F6', flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#1D4ED8', fontSize: 'clamp(12px,2.5vw,14px)', fontWeight: 700, wordBreak: 'break-all' }}>{targetUrl}</span>
                  <CopyBtn text={targetUrl} />
                </div>
                <a href={targetUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', textDecoration: 'none', padding: '11px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}>
                  <ExternalLink size={15} /> Mở trang web
                </a>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  {['Copy hoặc nhấn nút mở trang web', 'Ở lại trang và tương tác tự nhiên', 'Tìm nút lấy mã trên trang → lấy mã', 'Quay lại đây nhập mã xác nhận'].map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                      </div>
                      <span style={{ color: '#374151', fontSize: 13 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </StepCard>
          )}

          {/* Step — Code entry */}
          <StepCard n={isDirect ? 2 : 4} color="#16A34A" title="NHẬP MÃ XÁC NHẬN" verified={verified}>
            {verified ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F0FEF4', border: '3px solid #86EFAC', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Unlock size={36} color="#22C55E" />
                </div>
                <h3 style={{ color: '#16A34A', fontWeight: 800, margin: '0 0 8px' }}>Xác nhận thành công!</h3>
                <p style={{ color: '#64748B', margin: '0 0 20px' }}>
                  {redirecting ? '🔄 Đang chuyển hướng đến trang đích...' : 'Bạn đã hoàn thành nhiệm vụ!'}
                </p>
                {redirecting && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ height: 4, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: 4, background: '#22C55E', borderRadius: 99, animation: 'progress 3s linear forwards' }} />
                    </div>
                  </div>
                )}
                {completionResult?.destination_url && (
                  <a href={completionResult.destination_url}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#fff', textDecoration: 'none', padding: '12px 28px', borderRadius: 12, fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
                    Đến trang đích ngay <ArrowRight size={16} />
                  </a>
                )}
              </div>
            ) : (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Flow steps */}
                {[
                  {
                    num: '1', color: '#3B82F6', label: 'Cuộn & tìm nút',
                    content: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#64748B' }}>Nút trông như thế này trên trang đích:</span>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          background: widgetConfig?.buttonColor || '#F97316',
                          color: widgetConfig?.textColor || '#fff',
                          borderRadius: `${widgetConfig?.borderRadius ?? 50}px`,
                          fontSize: `${widgetConfig?.fontSize || 15}px`,
                          fontWeight: 700,
                          padding: '8px 16px',
                          boxShadow: `0 4px 16px ${(widgetConfig?.buttonColor || '#F97316')}55`,
                          userSelect: 'none', whiteSpace: 'nowrap', cursor: 'default',
                        }}>
                          <img
                            src={widgetConfig?.iconUrl || 'https://traffic68.com/lg.png'}
                            width={widgetConfig?.iconSize ?? 22}
                            height={widgetConfig?.iconSize ?? 22}
                            alt=""
                            style={{
                              background: widgetConfig?.iconBg ?? 'rgba(255,255,255,0.92)',
                              borderRadius: 6,
                              padding: 2,
                              objectFit: 'contain',
                              flexShrink: 0,
                              display: 'block',
                            }}
                            onError={e => { e.target.src = 'https://traffic68.com/lg.png'; }}
                          />
                          {widgetConfig?.buttonText || 'Lấy Mã'}
                        </div>
                      </div>
                    ),
                  },
                  {
                    num: '2', color: '#F97316', label: 'Chờ đủ thời gian → bấm nút → sao chép mã',
                    content: (
                      <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                        Khi nút kích hoạt, bấm vào — popup sẽ hiện mã. Sao chép mã rồi quay lại đây.
                      </p>
                    ),
                  },
                ].map(({ num, color, label, content }) => (
                  <div key={num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>{num}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>{label}</p>
                      {content}
                    </div>
                  </div>
                ))}

                {/* Divider */}
                <div style={{ borderTop: '1.5px dashed #BBF7D0', margin: 0 }} />

                {/* Code input */}
                <div>
                  <p style={{ color: '#16A34A', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#22C55E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 900, flexShrink: 0 }}>3</span>
                    Nhập mã xác nhận
                  </p>
                  <div style={{ marginBottom: 10 }}>
                    <input type="text" maxLength={6} value={inputCode}
                      onChange={e => setInputCode(e.target.value.toUpperCase())}
                      disabled={completing} placeholder="Nhập mã tại đây"
                      onKeyDown={e => e.key === 'Enter' && handleVerify()}
                      style={{ width: '100%', padding: '12px 14px', background: '#fff', border: `1.5px solid ${showError ? '#FCA5A5' : '#86EFAC'}`, borderRadius: 10, outline: 'none', fontSize: 16, fontWeight: 700, letterSpacing: 3, textAlign: 'center', color: '#1E293B', boxSizing: 'border-box' }}
                    />
                  </div>
                  {showError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                      <AlertCircle size={14} color="#EF4444" />
                      <span style={{ color: '#DC2626', fontSize: 12, fontWeight: 500 }}>{error || 'Mã xác nhận không đúng.'}</span>
                    </div>
                  )}
                  <button onClick={handleVerify} disabled={inputCode.length < 4 || completing}
                    style={{
                      width: '100%', padding: 15, borderRadius: 12, border: 'none',
                      background: inputCode.length >= 4 && !completing ? 'linear-gradient(135deg,#F97316,#EA580C)' : '#E2E8F0',
                      color: inputCode.length >= 4 ? '#fff' : '#94A3B8',
                      fontSize: 14, fontWeight: 800,
                      cursor: inputCode.length >= 4 && !completing ? 'pointer' : 'not-allowed',
                      letterSpacing: '0.3px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: inputCode.length >= 4 && !completing ? '0 6px 24px rgba(249,115,22,0.4)' : 'none',
                      transition: 'all 0.3s',
                      animation: inputCode.length >= 4 && !completing ? 'glow 2.5s ease-in-out infinite' : 'none',
                    }}
                    onMouseEnter={e => { if (inputCode.length >= 4 && !completing) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                  >
                    {completing ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN VÀ MỞ KHÓA LINK'}
                  </button>
                </div>
              </div>
            )}
          </StepCard>
        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes progress { from{width:0} to{width:100%} }
        @keyframes glow { 0%,100%{box-shadow:0 6px 24px rgba(249,115,22,0.4)} 50%{box-shadow:0 8px 36px rgba(249,115,22,0.6)} }
      `}</style>
    </Wrapper>
  );
}

/* ─── Wrapper ─── */
function Wrapper({ children }) {
  return (
    <div style={{ background: 'linear-gradient(160deg,#DBEAFE 0%,#EFF6FF 40%,#F0F9FF 70%,#F8FAFC 100%)', fontFamily: "'Inter',sans-serif", position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <svg width="100%" height="100%" style={{ opacity: 0.04 }}>
          <defs><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1E3A6E" strokeWidth="1" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

function Center({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center', padding: '0 24px' }}>{children}</div>;
}

function Icon({ children, bg, border }) {
  return <div style={{ width: 72, height: 72, borderRadius: '50%', background: bg, border: `2px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>;
}

function StepCard({ n, color, title, verified, children }) {
  const colors = { 1: '#3B82F6', 2: '#F97316', 3: '#7C3AED', 4: '#22C55E' };
  const c = colors[n] || color;
  return (
    <div style={{
      background: '#fff', border: `2px solid ${verified ? '#86EFAC' : n === 4 ? '#BBF7D0' : '#E2E8F0'}`,
      borderRadius: 20, padding: 'clamp(20px,3vw,28px)',
      boxShadow: verified ? '0 4px 16px rgba(34,197,94,0.08)' : '0 2px 12px rgba(0,0,0,0.05)',
      transition: 'all 0.4s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: verified ? '#22C55E' : c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${c}40` }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>{n}</span>
        </div>
        <span style={{ color: verified ? '#16A34A' : c, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>BƯỚC {n}</span>
        {verified && <span style={{ marginLeft: 'auto', background: '#F0FEF4', border: '1px solid #86EFAC', color: '#16A34A', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100 }}>✓ HOÀN THÀNH</span>}
      </div>
      <h2 style={{ color: verified ? '#16A34A' : c, fontSize: 'clamp(18px,3vw,24px)', fontWeight: 900, margin: '0 0 14px' }}>{title}</h2>
      {children}
    </div>
  );
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ display: 'flex', alignItems: 'center', gap: 5, background: copied ? '#F0FEF4' : '#FFF7ED', border: `1px solid ${copied ? '#86EFAC' : '#FED7AA'}`, color: copied ? '#16A34A' : '#EA580C', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Đã copy' : 'Copy'}
    </button>
  );
}
