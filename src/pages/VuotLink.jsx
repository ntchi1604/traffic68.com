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
  const waitTime_ = task?.waitTime || waitTime || 60;
  const progress = verified ? 100 : (activeStep / 4) * 100;

  /* ─── Loading State ────────────────────────────── */
  if (loading) {
    return (
      <PageWrapper>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'spin 1.5s linear infinite' }}>
            <Loader2 size={28} style={{ color: '#f97316' }} />
          </div>
          <p style={{ color: '#64748b', fontSize: '15px', fontWeight: 500 }}>Đang tải nhiệm vụ...</p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </PageWrapper>
    );
  }

  /* ─── Incognito Block ─────────────────────────── */
  if (isIncognito) {
    return (
      <PageWrapper>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px', textAlign: 'center', padding: '0 20px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={30} style={{ color: '#f97316' }} />
          </div>
          <h2 style={{ color: '#1e3a6e', fontSize: '20px', fontWeight: 700, margin: 0 }}>Không hỗ trợ trình duyệt ẩn danh</h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, maxWidth: '400px', lineHeight: 1.6 }}>Trang vượt link không hoạt động trong chế độ ẩn danh. Vui lòng mở bằng cửa sổ trình duyệt bình thường.</p>
          <button onClick={() => window.location.reload()} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(249,115,22,0.3)', transition: 'all 0.25s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>Thử lại</button>
        </div>
      </PageWrapper>
    );
  }

  /* ─── Error State ─────────────────────────────── */
  if (error && !task) {
    return (
      <PageWrapper>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px', textAlign: 'center', padding: '0 20px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WifiOff size={30} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{ color: '#1e3a6e', fontSize: '20px', fontWeight: 700, margin: 0 }}>Không thể tải nhiệm vụ</h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, maxWidth: '360px' }}>{error}</p>
          <button onClick={() => window.location.reload()} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(249,115,22,0.3)', transition: 'all 0.25s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>Thử lại</button>
        </div>
      </PageWrapper>
    );
  }

  /* ─── Main UI ─────────────────────────────────── */
  return (
    <PageWrapper>
      {/* Page Title */}
      <div style={{ textAlign: 'center', padding: '32px 16px 20px' }}>
        <h1 style={{ fontSize: 'clamp(20px,4vw,32px)', fontWeight: 900, color: '#1e3a6e', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
          HƯỚNG DẪN VƯỢT LINK CHI TIẾT
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          Hoàn thành 4 bước bên dưới để tiếp tục đến liên kết gốc. Vui lòng thực hiện theo thứ tự từng bước.
        </p>
      </div>

      {/* Main Grid */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '0 16px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,0.85fr)', gap: '20px', alignItems: 'start' }}>

        {/* LEFT: Step Detail Card — animated on step change */}
        <div key={`step-${activeStep}-${verified}`} style={{ animation: 'slideIn 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
          <StepCard
            activeStep={activeStep} verified={verified} task={task}
            keyword={keyword} campaignImage={campaignImage}
            copied={copied} handleCopy={handleCopy}
            inputCode={inputCode} setInputCode={setInputCode}
            handleVerify={handleVerify} completing={completing}
            completionResult={completionResult} showError={showError}
            error={error} waitTime_={waitTime_}
            reportStep={reportStep} goToStep={goToStep}
          />
        </div>

        {/* RIGHT: Steps status grid + action button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[1, 2, 3, 4].map((n) => {
              const isDone = verified || activeStep > n;
              const isActive = !verified && activeStep === n;
              return (
                <div key={n} style={{ background: isDone ? '#f0fef4' : isActive ? '#eff6ff' : '#f8fafc', border: `2px solid ${isDone ? '#86efac' : isActive ? '#93c5fd' : '#e2e8f0'}`, borderRadius: '14px', padding: '16px 12px', textAlign: 'center', transition: 'all 0.45s cubic-bezier(0.4,0,0.2,1)' }}>
                  {isDone ? (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#22c55e', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(34,197,94,0.3)', animation: 'scalein 0.3s ease' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  ) : isActive ? (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#eff6ff', border: '2px solid #3b82f6', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', animation: 'blink 1.5s ease-in-out infinite' }} />
                    </div>
                  ) : (
                    <div style={{ width: '36px', height: '36px', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#94a3b8" strokeWidth="2" /><path d="M7 11V7a5 5 0 0110 0v4" stroke="#94a3b8" strokeWidth="2" /></svg>
                    </div>
                  )}
                  <p style={{ fontWeight: 800, fontSize: '13px', margin: '0 0 2px', color: isDone ? '#16a34a' : isActive ? '#1d4ed8' : '#94a3b8' }}>BƯỚC {n}</p>
                  <p style={{ fontSize: '10px', fontWeight: 700, margin: 0, letterSpacing: '0.4px', color: isDone ? '#22c55e' : isActive ? '#3b82f6' : '#cbd5e1' }}>
                    {isDone ? '- HOÀN THÀNH' : isActive ? '- ĐANG THỰC HIỆN' : 'CHƯA HOÀN THÀNH'}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Orange Action Button */}
          <ActionButton
            activeStep={activeStep} verified={verified} completing={completing}
            inputCode={inputCode} goToStep={goToStep}
            handleVerify={handleVerify}
          />
        </div>
      </main>

      <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '14px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tiến trình</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8' }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: '6px', background: '#eff6ff', borderRadius: '100px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '100px', background: verified ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#3b82f6,#1d4ed8)', width: `${progress}%`, transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)' }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes scalein { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes blink { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.6; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes glow { 0%,100% { box-shadow: 0 6px 24px rgba(249,115,22,0.4); } 50% { box-shadow: 0 8px 36px rgba(249,115,22,0.6); } }
        @media (max-width: 640px) { main { grid-template-columns: 1fr !important; } }
      `}</style>
    </PageWrapper>
  );
}

/* ─── Page Wrapper ───────────────────────────────────── */
function PageWrapper({ children }) {
  return (
    <div style={{ background: 'linear-gradient(160deg,#dbeafe 0%,#eff6ff 35%,#f0f9ff 65%,#f8fafc 100%)', fontFamily: "'Inter',sans-serif" }}>
      {children}
    </div>
  );
}

/* ─── Card style ─────────────────────────────────────── */
const cardSt = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: 'clamp(20px,3vw,32px)', boxShadow: '0 4px 24px rgba(30,58,110,0.07)', minHeight: '380px' };

/* ─── StepCard ───────────────────────────────────────── */
function StepCard({ activeStep, verified, task, keyword, campaignImage, copied, handleCopy, inputCode, setInputCode, handleVerify, completing, completionResult, showError, error, waitTime_, reportStep, goToStep }) {

  if (verified) return (
    <div style={cardSt}>
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f0fef4', border: '3px solid #86efac', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'scalein 0.4s ease' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h3 style={{ color: '#16a34a', fontSize: '22px', fontWeight: 800, margin: '0 0 8px' }}>Xác nhận thành công!</h3>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px' }}>Bạn đã hoàn thành tất cả các bước. Cảm ơn bạn!</p>
        {completionResult?.earning > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '12px 24px', marginBottom: '20px' }}>
            <span style={{ color: '#64748b', fontSize: '13px' }}>Tiền thưởng:</span>
            <span style={{ color: '#f97316', fontSize: '18px', fontWeight: 800 }}>{Number(completionResult.earning).toLocaleString('vi-VN')} VNĐ</span>
          </div>
        )}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', textDecoration: 'none', padding: '12px 28px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 20px rgba(34,197,94,0.3)', transition: 'all 0.25s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
          Quay về trang chủ <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );

  if (activeStep === 1) return (
    <div style={cardSt}>
      <StepLabel n={1} />
      <h2 style={{ color: '#f97316', fontSize: 'clamp(20px,3.5vw,26px)', fontWeight: 900, margin: '0 0 6px' }}>MỞ GOOGLE</h2>
      <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>Mở trình duyệt và truy cập trang chủ Google.</p>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '24px', marginBottom: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Globe size={38} style={{ color: '#3b82f6' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#1e40af', fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>Truy cập Google.com</p>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Mở tab mới và vào trang tìm kiếm Google</p>
        </div>
        <a href="https://www.google.com" target="_blank" rel="noopener noreferrer" onClick={() => reportStep('step1')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', textDecoration: 'none', padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 16px rgba(59,130,246,0.35)', transition: 'all 0.25s' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
        >
          <ExternalLink size={15} /> Mở Google
        </a>
      </div>
    </div>
  );

  if (activeStep === 2) return (
    <div style={cardSt}>
      <StepLabel n={2} />
      <h2 style={{ color: '#f97316', fontSize: 'clamp(20px,3.5vw,26px)', fontWeight: 900, margin: '0 0 6px' }}>NHẬP TỪ KHÓA</h2>
      <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>Tìm kiếm từ khóa bên dưới trên Google.</p>
      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '14px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1.5px dashed #fb923c', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', gap: '10px' }}>
          <span style={{ color: '#ea580c', fontSize: 'clamp(13px,2.5vw,16px)', fontWeight: 700, wordBreak: 'break-word', flex: 1 }}>{keyword}</span>
          <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: copied ? '#f0fef4' : '#fff7ed', border: `1px solid ${copied ? '#86efac' : '#fed7aa'}`, color: copied ? '#16a34a' : '#ea580c', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Đã copy' : 'Copy'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <InstructionRow n={1} text="Copy từ khóa bên trên" />
          <InstructionRow n={2} text="Dán vào ô tìm kiếm Google" />
          <InstructionRow n={3} text="Nhấn Enter để tìm kiếm" />
        </div>
      </div>
    </div>
  );

  if (activeStep === 3) return (
    <div style={cardSt}>
      <StepLabel n={3} />
      <h2 style={{ color: '#f97316', fontSize: 'clamp(20px,3.5vw,26px)', fontWeight: 900, margin: '0 0 4px' }}>TÌM TRANG ĐÍCH</h2>
      <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>Tìm trang đích trong kết quả tìm kiếm Google và click vào.</p>

      {campaignImage && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 8px' }}>
            🎯 Trang đích cần tìm — giao diện trông giống như hình bên dưới:
          </p>
          <div style={{ borderRadius: '14px', overflow: 'hidden', border: '2.5px solid #e0e7ff', boxShadow: '0 4px 20px rgba(99,102,241,0.12)' }}>
            <img
              src={campaignImage} alt="Trang đích cần tìm"
              style={{ width: '100%', display: 'block', maxHeight: '360px', objectFit: 'cover', objectPosition: 'top' }}
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>
        </div>
      )}

      <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '14px', padding: '14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <InstructionRow n={1} text="Cuộn tìm trong kết quả Google" color="#7c3aed" />
          <InstructionRow n={2} text="Tìm trang có giao diện giống hình trên" color="#7c3aed" />
          <InstructionRow n={3} text="Click vào kết quả để truy cập trang" color="#7c3aed" />
        </div>
      </div>
    </div>
  );

  if (activeStep === 4) return (
    <div style={cardSt}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <StepLabel n={4} />
          <h2 style={{ color: '#f97316', fontSize: 'clamp(20px,3.5vw,26px)', fontWeight: 900, margin: '0 0 6px' }}>MÃ XÁC NHẬN</h2>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Vào trang đích, đợi {waitTime_}s để hiện mã. Quay lại đây nhập mã xác nhận.</p>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'center', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fff', border: '3px solid #86efac', margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 900, color: '#16a34a' }}>{waitTime_}s</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '10px', margin: 0, fontWeight: 600 }}>Mã hiển thị trên trang đích</p>
          <p style={{ color: '#94a3b8', fontSize: '9px', margin: '2px 0 0', fontWeight: 500 }}>Sau khi đợi {waitTime_}s</p>
        </div>
      </div>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '18px' }}>
        <p style={{ color: '#374151', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.6 }}>
          Sau khi vào đúng trang web và đợi hết {waitTime_} giây, nút trên trang sẽ hiện mã xác nhận. Hãy copy mã đó và quay lại đây nhập vào.
        </p>
        <p style={{ color: '#16a34a', fontSize: '12px', fontWeight: 700, margin: '0 0 10px' }}>Nhập mã xác nhận</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" maxLength={6} value={inputCode} onChange={(e) => setInputCode(e.target.value.toUpperCase())} disabled={completing} placeholder="Nhập mã..."
            style={{ flex: 1, padding: '12px 14px', background: '#fff', border: `1.5px solid ${showError ? '#fca5a5' : '#86efac'}`, borderRadius: '10px', outline: 'none', color: '#1e293b', fontSize: '16px', fontWeight: 700, letterSpacing: '4px', textAlign: 'center', fontFamily: 'monospace', transition: 'border-color 0.2s' }}
          />
          <button onClick={handleVerify} disabled={inputCode.length < 4 || completing}
            style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: inputCode.length >= 4 && !completing ? 'linear-gradient(135deg,#22c55e,#16a34a)' : '#e2e8f0', color: inputCode.length >= 4 ? '#fff' : '#94a3b8', fontSize: '13px', fontWeight: 700, cursor: inputCode.length >= 4 && !completing ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', boxShadow: inputCode.length >= 4 ? '0 4px 16px rgba(34,197,94,0.3)' : 'none' }}
          >
            {completing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {completing ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
        {showError && (
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 12px' }}>
            <AlertCircle size={14} style={{ color: '#ef4444' }} />
            <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 500 }}>{error || 'Mã xác nhận không đúng.'}</span>
          </div>
        )}
      </div>
    </div>
  );

  return null;
}

/* ─── Orange Action Button ───────────────────────────── */
function ActionButton({ activeStep, verified, completing, inputCode, goToStep, handleVerify }) {
  if (verified) return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', textDecoration: 'none', padding: '16px', borderRadius: '12px', fontSize: '14px', fontWeight: 800, boxShadow: '0 6px 24px rgba(34,197,94,0.35)', transition: 'all 0.25s', letterSpacing: '0.3px' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
      HOÀN TẤT — VỀ TRANG CHỦ <ArrowRight size={18} />
    </Link>
  );
  const labels = { 1: 'MỞ GOOGLE - TIẾP TỤC BƯỚC TIẾP THEO →', 2: 'TIẾP TỤC BƯỚC TIẾP THEO →', 3: 'CLICK VÀO TRANG NÀY →', 4: 'XÁC NHẬN VÀ HOÀN TẤT →' };
  const disabled = activeStep === 4 && (inputCode.length < 4 || completing);
  const action = activeStep === 4 ? handleVerify : () => goToStep(activeStep + 1);
  return (
    <button onClick={action} disabled={disabled}
      style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: disabled ? '#e2e8f0' : 'linear-gradient(135deg,#f97316,#ea580c)', color: disabled ? '#94a3b8' : '#fff', fontSize: '14px', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: disabled ? 'none' : '0 6px 24px rgba(249,115,22,0.4)', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', animation: !disabled ? 'glow 2.5s ease-in-out infinite' : 'none', letterSpacing: '0.3px' }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
    >
      {completing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
      {completing ? 'ĐANG XỬ LÝ...' : (labels[activeStep] || labels[1])}
    </button>
  );
}

/* ─── Sub-components ─────────────────────────────────── */
function StepLabel({ n }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(249,115,22,0.4)' }}>
        <span style={{ color: '#fff', fontSize: '16px', fontWeight: 900 }}>{n}</span>
      </div>
      <span style={{ color: '#1e3a6e', fontSize: '13px', fontWeight: 800, letterSpacing: '1px' }}>BƯỚC {n}</span>
    </div>
  );
}

function InstructionRow({ n, text, color = '#ea580c' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', borderRadius: '8px', padding: '8px 12px' }}>
      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontSize: '11px', fontWeight: 800 }}>{n}</span>
      </div>
      <span style={{ color: '#374151', fontSize: '13px', fontWeight: 500 }}>{text}</span>
    </div>
  );
}

