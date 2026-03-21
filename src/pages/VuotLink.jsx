import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Globe, Target, ShieldCheck, Copy, Check,
  ExternalLink, ArrowRight, Eye,
  Sparkles, AlertCircle, CheckCircle2, MousePointerClick,
  Loader2, WifiOff
} from 'lucide-react';

/* ─── Load FingerprintJS + BotD from server files (same as embed script) ── */
function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

// CreepJS provides both bot detection and visitorId

// CreepJS — for bot detection (intercept console.log since it doesn't set globals)
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

if (typeof window !== 'undefined') {
  // Console already muted by index.html — just need to capture CreepJS data
  const _savedLog = console.log; // currently a no-op
  // Override with capture logic
  console.log = function (...args) {
    for (const arg of args) {
      if (arg && typeof arg === 'object' && arg.workerScope && arg.workerScope.lied !== undefined) {
        let totalLied = 0;
        const liedSections = [];
        for (const key in arg) {
          if (arg[key] && typeof arg[key] === 'object' && arg[key].lied !== undefined) {
            const liedVal = arg[key].lied === true ? 1 : (typeof arg[key].lied === 'number' ? arg[key].lied : 0);
            totalLied += liedVal;
            if (liedVal > 0) liedSections.push(key + ':' + liedVal);
          }
        }
        // Use $hash as visitorId
        if (arg.workerScope && arg.workerScope.$hash) {
          _creepVisitorId = arg.workerScope.$hash;
        }
        _resolveCreep({
          bot: totalLied > 0,
          totalLied,
          liedSections,
          headless: arg.headless || (arg.headlessness ? arg.headlessness.lied : null),
          stealth: arg.stealth || (arg.resistance ? arg.resistance.lied : null),
        });
        console.log = _savedLog;
        return;
      }
    }
    _savedLog.apply(console, args);
  };

  loadScript('/creep.js').catch(() => {
    console.log = _savedLog;
    _resolveCreep({ bot: false, creepError: true });
  });

  setTimeout(() => {
    if (!_creepDone) {
      console.log = _savedLog;
      _resolveCreep({ bot: false, creepTimeout: true });
    }
  }, 10000);
}

function getCreepData() {
  if (_creepDone) return Promise.resolve({ botDetection: _creepResult, visitorId: _creepVisitorId });
  return new Promise(resolve => {
    _creepResolvers.push(r => resolve({ botDetection: r, visitorId: _creepVisitorId }));
    setTimeout(() => {
      if (!_creepDone) _resolveCreep({ bot: false, creepTimeout: true });
    }, 10000);
  });
}

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

const _bhv = {
  startTime: Date.now(),
  mouseTrail: [], clickPositions: [],
  keyDwellTimes: [], keyFlightTimes: [], _keyDownMap: {},
  backspaceCount: 0, totalKeys: 0,
  scrollEvents: [], scrollPauses: 0, _lastScrollT: 0,
  totalBlur: 0, rafStable: true, _lastKeyUp: 0,
  screen: typeof window !== 'undefined' ? { w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1 } : null,
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
    keyDwellTimes: _bhv.keyDwellTimes,
    keyFlightTimes: _bhv.keyFlightTimes,
    backspaceCount: _bhv.backspaceCount,
    totalKeys: _bhv.totalKeys,
    scrollEvents: _bhv.scrollEvents,
    scrollPauses: _bhv.scrollPauses,
    totalBlur: _bhv.totalBlur,
    rafStable: _bhv.rafStable,
    screen: _bhv.screen,
    probes: probeData,
  };
}

const API = '/api/vuot-link';


/* ─── Main Component ────────────────────────────────── */
export default function VuotLink() {
  // Set tab title
  useEffect(() => {
    document.title = 'Vượt Link — traffic68.com';
  }, []);

  // Task state from API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [task, setTask] = useState(null);
  const [isIncognito, setIsIncognito] = useState(false);

  // UI state
  const [activeStep, setActiveStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [showError, setShowError] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [completing, setCompleting] = useState(false);
  const taskStartTime = useRef(Date.now());

  const waitTime = task?.waitTime || 60;



  /* ─── Fetch task from API on mount ─────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');

        // Incognito detection via storage quota
        if (navigator.storage && navigator.storage.estimate) {
          const { quota } = await navigator.storage.estimate();
          if (quota && quota < 10 * 1024 * 1024 * 1024) {
            if (!cancelled) setIsIncognito(true);
            return;
          }
        }

        // Step 1: Load CreepJS for bot detection + visitorId
        const creepData = await getCreepData();
        let visitorId = creepData.visitorId || 'unknown';
        let botDetectionResult = creepData.botDetection;

        // Tag Clarity session with visitor_id
        if (window.clarity) {
          window.clarity('set', 'visitor_id', visitorId);
          window.clarity('identify', visitorId);
          console.log('[VuotLink] Clarity tagged:', visitorId);
        } else {
          console.warn('[VuotLink] Clarity not loaded');
        }

        // Step 2: Get challenge + solve Proof-of-Work
        const chRes = await fetch(`${API}/challenge`);
        if (!chRes.ok) throw new Error('Không thể lấy challenge');
        const challenge = await chRes.json();

        // Solve PoW: find nonce where SHA-256(prefix+nonce) starts with d zeros
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

        // Solve DOM challenge: Canvas 2D + WebGL (requires real browser)
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

        // Step 3: Request task with PoW + Canvas 2D + WebGL proof
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const taskRes = await fetch(`${API}/task`, {
          method: 'POST',
          headers,
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
          if (!cancelled) setError('Hiện tại không có nhiệm vụ nào. Vui lòng thử lại sau.');
          return;
        }
        if (taskRes.status === 429) {
          const errData = await taskRes.json();
          if (!cancelled) setError(errData.error || 'Bạn đã đạt giới hạn lượt vượt link hôm nay.');
          return;
        }
        if (!taskRes.ok) throw new Error('Không thể lấy task');

        const taskData = await taskRes.json();

        if (!cancelled) {
          setTask(taskData);
          taskStartTime.current = Date.now();
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Đã xảy ra lỗi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ─── Report step progress ────────────────────── */
  const reportStep = useCallback(async (stepName) => {
    if (!task?.id) return;
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`${API}/task/${task.id}/step`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ step: stepName, _tk: task._tk }),
      });
    } catch { /* silent */ }
  }, [task]);

  /* ─── Handle step navigation ──────────────────── */
  const goToStep = useCallback((step) => {
    setActiveStep(step);
    // Report to API
    if (step === 1) reportStep('step1');
    if (step === 2) reportStep('step2');
    if (step === 3) reportStep('step3');
  }, [reportStep]);

  /* ─── Copy keyword ────────────────────────────── */
  const handleCopy = useCallback(() => {
    if (!task?.keyword) return;
    navigator.clipboard.writeText(task.keyword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [task]);

  /* ─── Verify code entered by user ─────────────── */
  const handleVerify = useCallback(async () => {
    if (!inputCode.trim() || inputCode.trim().length < 4) {
      setShowError(true);
      setError('Vui lòng nhập mã xác nhận.');
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    // Verify code via API — server checks against code_given in vuot_link_tasks
    setCompleting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/task/${task.id}/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: inputCode.trim(), _tk: task._tk }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Mã xác nhận không đúng');
      }

      setCompletionResult(data);
      setVerified(true);
      setShowError(false);
    } catch (err) {
      setShowError(true);
      setError(err.message);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setCompleting(false);
    }
  }, [inputCode, task]);

  /* ─── Derived values ──────────────────────────── */
  const keyword = task?.keyword || '';
  const campaignImage = task?.image1_url || '';

  const progress = verified ? 100 : ((activeStep - 1) / 4) * 100;

  const steps = [
    { id: 1, icon: Globe, title: 'MỞ GOOGLE', subtitle: 'Mở trình duyệt và truy cập Google', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)' },
    { id: 2, icon: Search, title: 'NHẬP TỪ KHÓA', subtitle: 'Tìm kiếm từ khóa trên Google', color: '#f97316', bgColor: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.2)' },
    { id: 3, icon: Target, title: 'TÌM TRANG ĐÍCH', subtitle: 'Tìm và click vào trang đích', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.2)' },
    { id: 4, icon: ShieldCheck, title: 'MÃ XÁC NHẬN', subtitle: 'Đợi và nhập code xác nhận', color: '#10b981', bgColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' },
  ];

  /* ─── Loading State ────────────────────────────── */
  if (loading) {
    return (
      <PageWrapper>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'spin 1.5s linear infinite',
          }}>
            <Loader2 size={28} style={{ color: '#f97316' }} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: '15px', fontWeight: 500 }}>Đang tải nhiệm vụ...</p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </PageWrapper>
    );
  }

  /* ─── Incognito Block ────────────────────────────── */
  if (isIncognito) {
    return (
      <PageWrapper>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px', textAlign: 'center', padding: '0 20px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={30} style={{ color: '#f97316' }} />
          </div>
          <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, margin: 0 }}>Không hỗ trợ trình duyệt ẩn danh</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, maxWidth: '400px', lineHeight: 1.6 }}>
            Trang vượt link không hoạt động trong chế độ ẩn danh (Incognito / Private).
            Vui lòng mở bằng cửa sổ trình duyệt bình thường.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff',
              padding: '12px 28px', borderRadius: '12px', border: 'none',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(249,115,22,0.3)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
          >
            Thử lại
          </button>
        </div>
      </PageWrapper>
    );
  }

  /* ─── Error State ──────────────────────────────── */
  if (error && !task) {
    return (
      <PageWrapper>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px', textAlign: 'center', padding: '0 20px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <WifiOff size={30} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, margin: 0 }}>Không thể tải nhiệm vụ</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, maxWidth: '360px' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff',
              padding: '12px 28px', borderRadius: '12px', border: 'none',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(249,115,22,0.3)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
          >
            Thử lại
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {/* Main Content */}
      <main style={{ position: 'relative', zIndex: 10, maxWidth: '780px', margin: '0 auto', padding: '0 16px 60px' }}>

        {/* Title Section */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)',
            borderRadius: '100px', padding: '6px 18px', marginBottom: '16px',
          }}>
            <Sparkles size={14} style={{ color: '#f97316' }} />
            <span style={{ color: '#fb923c', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px' }}>
              HƯỚNG DẪN VƯỢT LINK
            </span>
          </div>
          <h1 style={{
            color: '#f1f5f9', fontSize: 'clamp(22px, 4vw, 30px)',
            fontWeight: 800, margin: '0 0 8px', lineHeight: 1.3,
          }}>
            Hoàn thành <span style={{ color: '#f97316' }}>4 bước</span> bên dưới
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Vui lòng thực hiện theo thứ tự từng bước để hoàn tất nhiệm vụ.
          </p>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '36px', padding: '0 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>Tiến độ</span>
            <span style={{ color: '#f97316', fontSize: '12px', fontWeight: 700 }}>
              {verified ? '4' : activeStep - 1}/4 bước hoàn thành
            </span>
          </div>
          <div style={{
            height: '6px', borderRadius: '100px',
            background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: '100px',
              background: verified ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f97316, #fb923c)',
              width: `${progress}%`, transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        {/* Step Navigation Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '28px' }}>
          {steps.map((step) => {
            const isActive = activeStep === step.id;
            const isDone = verified || activeStep > step.id;
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                onClick={() => !verified && goToStep(step.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: '6px', padding: '14px 6px',
                  borderRadius: '14px', border: 'none', cursor: verified ? 'default' : 'pointer',
                  background: isActive && !verified
                    ? `linear-gradient(135deg, ${step.bgColor}, rgba(255,255,255,0.05))`
                    : isDone ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                  borderWidth: '1.5px', borderStyle: 'solid',
                  borderColor: isActive && !verified ? step.borderColor : isDone ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                  transition: 'all 0.3s ease',
                  transform: isActive && !verified ? 'translateY(-2px)' : 'none',
                  boxShadow: isActive && !verified ? `0 8px 24px ${step.bgColor}` : 'none',
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDone ? 'rgba(16,185,129,0.15)' : isActive ? step.bgColor : 'rgba(255,255,255,0.05)',
                }}>
                  {isDone ? (
                    <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                  ) : (
                    <Icon size={18} style={{ color: isActive ? step.color : '#64748b' }} />
                  )}
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: 700,
                  color: isDone ? '#10b981' : isActive ? step.color : '#64748b',
                  letterSpacing: '0.3px', textAlign: 'center',
                }}>
                  BƯỚC {step.id}
                </span>
              </button>
            );
          })}
        </div>

        {/* Step Content Cards */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px', backdropFilter: 'blur(20px)', overflow: 'hidden',
        }}>
          {/* ── STEP 1: Open Google ──────── */}
          {activeStep === 1 && !verified && (
            <div style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
              <StepHeader step={steps[0]} number={1} desc="Mở trình duyệt và truy cập trang chủ Google." />
              <div style={{
                background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)',
                borderRadius: '16px', padding: '24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
              }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Globe size={32} style={{ color: '#3b82f6' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>
                    Truy cập Google.com
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                    Mở tab mới và vào trang tìm kiếm Google
                  </p>
                </div>
                <a
                  href="https://www.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => reportStep('step1')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: '#fff', textDecoration: 'none',
                    padding: '12px 28px', borderRadius: '12px',
                    fontSize: '14px', fontWeight: 700,
                    boxShadow: '0 4px 20px rgba(59,130,246,0.3)',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(59,130,246,0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.3)'; }}
                >
                  <ExternalLink size={16} /> Mở Google
                </a>
              </div>
              <NextStepButton onClick={() => goToStep(2)} color="#3b82f6" />
            </div>
          )}

          {/* ── STEP 2: Search Keyword ──────── */}
          {activeStep === 2 && !verified && (
            <div style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
              <StepHeader step={steps[1]} number={2} desc="Tìm kiếm từ khóa bên dưới trên Google." />
              <div style={{
                background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.12)',
                borderRadius: '16px', padding: '24px',
              }}>
                <p style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', margin: '0 0 12px', textTransform: 'uppercase' }}>
                  Từ khóa tìm kiếm
                </p>
                <div style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(249,115,22,0.25)',
                  borderRadius: '12px', padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <Search size={18} style={{ color: '#f97316', flexShrink: 0 }} />
                    <span style={{
                      color: '#f97316', fontSize: 'clamp(15px, 3vw, 18px)',
                      fontWeight: 700, wordBreak: 'break-word',
                    }}>
                      {keyword}
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(249,115,22,0.15)',
                      border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(249,115,22,0.3)'}`,
                      color: copied ? '#10b981' : '#fb923c',
                      padding: '8px 14px', borderRadius: '8px',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.2s ease', flexShrink: 0,
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Đã copy' : 'Copy'}
                  </button>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <InstructionItem icon={<span style={{ color: '#f97316', fontWeight: 800 }}>1</span>} text="Copy từ khóa bên trên" />
                  <InstructionItem icon={<span style={{ color: '#f97316', fontWeight: 800 }}>2</span>} text="Dán vào ô tìm kiếm Google" />
                  <InstructionItem icon={<span style={{ color: '#f97316', fontWeight: 800 }}>3</span>} text="Nhấn Enter để tìm kiếm" />
                </div>
              </div>
              <NextStepButton onClick={() => goToStep(3)} color="#f97316" />
            </div>
          )}

          {/* ── STEP 3: Find Target ──────── */}
          {activeStep === 3 && !verified && (
            <div style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
              <StepHeader step={steps[2]} number={3} desc="Tìm trang đích trong kết quả tìm kiếm Google và click vào." />
              <div style={{
                background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)',
                borderRadius: '16px', padding: '24px',
              }}>
                <p style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', margin: '0 0 12px', textTransform: 'uppercase' }}>
                  Trang đích cần tìm
                </p>
                <div style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: '12px', padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px',
                }}>
                  <Target size={18} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                  <span style={{ color: '#a78bfa', fontSize: '14px', fontWeight: 600, wordBreak: 'break-all' }}>
                    Tìm trang có giao diện giống hình bên dưới
                  </span>
                </div>

                {/* Campaign Image */}
                {campaignImage && (
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', margin: '0 0 12px', textTransform: 'uppercase' }}>
                      <Eye size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
                      Hình ảnh trang đích — Tìm trang có giao diện giống hình bên dưới
                    </p>
                    <div style={{
                      position: 'relative', borderRadius: '14px', overflow: 'hidden',
                      border: '2px solid rgba(139,92,246,0.25)', background: 'rgba(0,0,0,0.2)',
                    }}>
                      <img
                        src={campaignImage}
                        alt="Campaign Target"
                        style={{ width: '100%', display: 'block', borderRadius: '12px' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div style={{
                        position: 'absolute', top: '12px', left: '12px',
                        background: 'rgba(139,92,246,0.85)', backdropFilter: 'blur(8px)',
                        borderRadius: '8px', padding: '6px 12px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <MousePointerClick size={13} style={{ color: '#fff' }} />
                        <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>CLICK VÀO TRANG NÀY</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* No image fallback */}
                {!campaignImage && (
                  <div style={{
                    background: 'rgba(139,92,246,0.06)', border: '1px dashed rgba(139,92,246,0.25)',
                    borderRadius: '12px', padding: '28px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                    marginBottom: '20px',
                  }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '14px',
                      background: 'rgba(139,92,246,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Target size={24} style={{ color: '#8b5cf6' }} />
                    </div>
                    <p style={{ color: '#a78bfa', fontSize: '13px', fontWeight: 600, margin: 0, textAlign: 'center' }}>
                      Tìm trang web phù hợp với từ khóa <span style={{ color: '#c4b5fd' }}>"{keyword}"</span> trong kết quả Google
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <InstructionItem icon={<span style={{ color: '#8b5cf6', fontWeight: 800 }}>1</span>} text="Cuộn tìm trong kết quả Google" />
                  <InstructionItem icon={<span style={{ color: '#8b5cf6', fontWeight: 800 }}>2</span>} text="Tìm trang có giao diện giống hình trên" />
                  <InstructionItem icon={<span style={{ color: '#8b5cf6', fontWeight: 800 }}>3</span>} text="Click vào kết quả để truy cập trang" />
                </div>
              </div>
              <NextStepButton onClick={() => goToStep(4)} color="#8b5cf6" />
            </div>
          )}

          {/* ── STEP 4: Verification ──────── */}
          {activeStep === 4 && (
            <div style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
              <StepHeader step={steps[3]} number={4} desc={`Vào trang đích, đợi ${waitTime}s để hiện mã. Quay lại đây nhập mã xác nhận.`} />

              {verified ? (
                /* ── Success state ── */
                <div style={{
                  background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '16px', padding: '40px 24px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center',
                }}>
                  <div style={{
                    width: '80px', height: '80px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'pulse 2s ease-in-out infinite',
                  }}>
                    <CheckCircle2 size={40} style={{ color: '#10b981' }} />
                  </div>
                  <h3 style={{ color: '#10b981', fontSize: '22px', fontWeight: 800, margin: 0 }}>
                    Xác nhận thành công!
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, maxWidth: '320px' }}>
                    Bạn đã hoàn thành tất cả các bước. Cảm ơn bạn đã thực hiện nhiệm vụ!
                  </p>

                  {/* Show completion result */}
                  {completionResult && completionResult.earning > 0 && (
                    <div style={{
                      background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(16,185,129,0.2)',
                      borderRadius: '12px', padding: '16px 24px', marginTop: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Tiền thưởng:</span>
                      <span style={{ color: '#f97316', fontSize: '15px', fontWeight: 700 }}>{Number(completionResult.earning).toLocaleString('vi-VN')} VNĐ</span>
                    </div>
                  )}

                  <Link
                    to="/"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#fff', textDecoration: 'none',
                      padding: '12px 28px', borderRadius: '12px',
                      fontSize: '14px', fontWeight: 700, marginTop: '8px',
                      boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
                      transition: 'all 0.25s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                  >
                    Quay về trang chủ
                  </Link>
                </div>
              ) : (
                /* ── Verification form ── */
                <div style={{
                  background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)',
                  borderRadius: '16px', padding: '24px',
                }}>
                  {/* Icon */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px',
                  }}>
                    <div style={{
                      width: '64px', height: '64px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ShieldCheck size={28} style={{ color: '#10b981' }} />
                    </div>
                    <p style={{ color: '#10b981', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                      Nhập mã xác nhận từ trang đích
                    </p>
                  </div>

                  {/* Instructions */}
                  <div style={{
                    background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
                    borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                  }}>
                    <AlertCircle size={16} style={{ color: '#f97316', marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <p style={{ color: '#fb923c', fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>
                        Mã hiển thị trên trang đích
                      </p>
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                        Sau khi vào đúng trang web và đợi hết {waitTime} giây, nút trên trang sẽ hiện mã xác nhận. Hãy copy mã đó và quay lại đây nhập vào.
                      </p>
                    </div>
                  </div>

                  {/* Input */}
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', margin: '0 0 10px', textTransform: 'uppercase' }}>
                      Nhập mã xác nhận
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        maxLength={6}
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                        disabled={completing}
                        placeholder="Nhập mã từ trang đích..."
                        style={{
                          flex: 1, padding: '14px 16px',
                          background: 'rgba(0,0,0,0.3)',
                          border: `1.5px solid ${showError ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.2)'}`,
                          borderRadius: '12px', outline: 'none',
                          color: '#e2e8f0', fontSize: '16px', fontWeight: 700,
                          letterSpacing: '4px', textAlign: 'center',
                          fontFamily: "'Inter', monospace",
                          transition: 'all 0.2s ease',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(16,185,129,0.5)'; }}
                        onBlur={(e) => { e.target.style.borderColor = showError ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.2)'; }}
                      />
                      <button
                        onClick={handleVerify}
                        disabled={inputCode.length < 4 || completing}
                        style={{
                          padding: '14px 24px', borderRadius: '12px', border: 'none',
                          background: inputCode.length >= 4 && !completing
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : 'rgba(255,255,255,0.05)',
                          color: inputCode.length >= 4 ? '#fff' : '#475569',
                          fontSize: '14px', fontWeight: 700,
                          cursor: inputCode.length >= 4 && !completing ? 'pointer' : 'not-allowed',
                          transition: 'all 0.25s ease',
                          boxShadow: inputCode.length >= 4 ? '0 4px 20px rgba(16,185,129,0.3)' : 'none',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                        onMouseEnter={(e) => { if (inputCode.length >= 4 && !completing) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                      >
                        {completing && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                        {completing ? 'Đang xử lý...' : 'Xác nhận'}
                      </button>
                    </div>
                  </div>

                  {/* Error message */}
                  {showError && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: '10px', padding: '10px 14px',
                    }}>
                      <AlertCircle size={16} style={{ color: '#ef4444' }} />
                      <span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: 500 }}>
                        {error || 'Mã xác nhận không đúng. Vui lòng kiểm tra và thử lại.'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div style={{ textAlign: 'center', marginTop: '32px', padding: '0 20px' }}>
          <p style={{ color: '#475569', fontSize: '12px', margin: 0 }}>
            Được cung cấp bởi{' '}
            <a href="https://traffic68.com" target="_blank" rel="noopener noreferrer" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>
              traffic68.com
            </a>{' '}
            — Traffic User Thật 100%
          </p>
        </div>
      </main>

      {/* Global keyframe animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </PageWrapper>
  );
}

/* ─── Page Wrapper ──────────────────────────────────── */
function PageWrapper({ children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0b1a3e 0%, #101d42 40%, #0f2359 100%)',
        fontFamily: "'Inter', sans-serif",
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Background decorations */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-15%', right: '-10%',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-5%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Header */}
      <header style={{
        position: 'relative', zIndex: 10,
        padding: '20px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <img src="/traffic68_com.gif" alt="traffic68.com" style={{ height: '44px', objectFit: 'contain' }} />
        </Link>
      </header>

      {children}
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────── */
function StepHeader({ step, number, desc }) {
  const Icon = step.icon;
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: `linear-gradient(135deg, ${step.bgColor}, rgba(255,255,255,0.02))`,
          border: `1.5px solid ${step.borderColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} style={{ color: step.color }} />
        </div>
        <div>
          <p style={{ color: step.color, fontSize: '11px', fontWeight: 700, letterSpacing: '1px', margin: '0 0 2px' }}>BƯỚC {number}</p>
          <h2 style={{ color: '#f1f5f9', fontSize: 'clamp(18px, 3.5vw, 22px)', fontWeight: 800, margin: 0 }}>{step.title}</h2>
        </div>
      </div>
      <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, paddingLeft: '58px' }}>{desc}</p>
    </div>
  );
}

function NextStepButton({ onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', marginTop: '20px', padding: '14px',
        borderRadius: '12px', border: 'none',
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: '#fff', fontSize: '14px', fontWeight: 700,
        cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: '8px',
        boxShadow: `0 4px 20px ${color}40`,
        transition: 'all 0.25s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 30px ${color}50`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 20px ${color}40`; }}
    >
      Tiếp tục bước tiếp theo <ArrowRight size={16} />
    </button>
  );
}

function InstructionItem({ icon, text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      background: 'rgba(0,0,0,0.15)', borderRadius: '10px', padding: '10px 14px',
    }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px',
        background: 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', flexShrink: 0,
      }}>
        {icon}
      </div>
      <span style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 500 }}>{text}</span>
    </div>
  );
}
