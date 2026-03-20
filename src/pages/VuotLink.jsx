import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { load as loadBotd } from '@fingerprintjs/botd';
import {
  Search, Globe, Target, ShieldCheck, Copy, Check,
  ExternalLink, ArrowRight, Eye,
  Sparkles, AlertCircle, CheckCircle2, MousePointerClick,
  Loader2, WifiOff
} from 'lucide-react';

/* ─── Behavioral tracker (inline, no external file) ────── */
const behaviorData = {
  mouse: [],
  clicks: 0,
  keys: 0,
  scrolls: 0,
  startTime: Date.now(),
};
if (typeof window !== 'undefined') {
  const MAX = 50;
  document.addEventListener('mousemove', (e) => {
    behaviorData.mouse.push({ x: e.clientX, y: e.clientY, t: Date.now() - behaviorData.startTime });
    if (behaviorData.mouse.length > MAX) behaviorData.mouse.shift();
  }, { passive: true });
  document.addEventListener('click', () => { behaviorData.clicks++; }, { passive: true });
  document.addEventListener('keydown', () => { behaviorData.keys++; }, { passive: true });
  window.addEventListener('scroll', () => { behaviorData.scrolls++; }, { passive: true });
}

/* ─── API base ──────────────────────────────────────── */
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
  const [deviceId, setDeviceId] = useState('');
  const [botResult, setBotResult] = useState(null);
  const [fpComponents, setFpComponents] = useState(null);

  const waitTime = task?.waitTime || 60;

  /* ─── FingerprintJS + BotD on mount ──────────── */
  useEffect(() => {
    (async () => {
      try {
        // FingerprintJS — device identification
        const fp = await FingerprintJS.load();
        const fpResult = await fp.get();
        setDeviceId(fpResult.visitorId);
        setFpComponents({
          canvas: fpResult.components?.canvas?.value,
          webgl: fpResult.components?.webgl?.value,
          audio: fpResult.components?.audio?.value,
          fonts: fpResult.components?.fonts?.value?.length || 0,
          plugins: fpResult.components?.plugins?.value?.length || 0,
          screen: fpResult.components?.screenResolution?.value,
          platform: fpResult.components?.platform?.value,
          timezone: fpResult.components?.timezone?.value,
          touchSupport: fpResult.components?.touchSupport?.value,
        });
      } catch { setDeviceId('unknown'); }

      try {
        // BotD — bot detection
        const botd = await loadBotd();
        const result = botd.detect();
        setBotResult(result);
      } catch { setBotResult(null); }
    })();
  }, []);

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

        // Step 1: Get challenge
        const chRes = await fetch(`${API}/challenge`);
        if (!chRes.ok) throw new Error('Không thể lấy challenge');
        const challenge = await chRes.json();

        // Step 2: Execute JS challenge
        // eslint-disable-next-line no-eval
        const jsResult = eval(challenge.j);

        // Step 3: Proof-of-Work mining (dynamic difficulty)
        let powNonce = '';
        if (challenge.pow) {
          const diff = challenge.powDiff || '0000';
          const zeroBytes = Math.floor(diff.length / 2); // 4→2, 5→2, 6→3
          const halfByte = diff.length % 2 === 1;        // 5→true
          const encoder = new TextEncoder();
          for (let n = 0; n < 100000000; n++) {
            const candidate = String(n);
            const data = encoder.encode(challenge.pow + candidate);
            const hashBuf = await crypto.subtle.digest('SHA-256', data);
            const hashArr = new Uint8Array(hashBuf);
            let valid = true;
            for (let b = 0; b < zeroBytes; b++) {
              if (hashArr[b] !== 0) { valid = false; break; }
            }
            if (valid && halfByte && (hashArr[zeroBytes] >> 4) !== 0) valid = false;
            if (valid) {
              powNonce = candidate;
              break;
            }
          }
        }

        // Step 4: Canvas fingerprint challenge (requires real browser)
        let canvasHash = '';
        if (challenge.canvas) {
          try {
            const cvs = document.createElement('canvas');
            cvs.width = 200; cvs.height = 50;
            const ctx = cvs.getContext('2d');
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, 200, 50);
            ctx.font = `${challenge.canvas.fontSize}px Arial`;
            ctx.fillStyle = challenge.canvas.color;
            ctx.fillText(challenge.canvas.text, 10, 35);
            const pixels = ctx.getImageData(0, 0, 200, 50).data;
            const pixelBuf = await crypto.subtle.digest('SHA-256', pixels.buffer);
            const pixelArr = new Uint8Array(pixelBuf);
            canvasHash = Array.from(pixelArr).map(b => b.toString(16).padStart(2, '0')).join('');
          } catch { canvasHash = ''; }
        }

        // Step 4b: WebGL 3D fingerprint (renders target_text as texture)
        let webglHash = '';
        try {
          const ws = challenge.webgl || {};
          const verts = ws.v || [0, 0.8, -0.7, -0.6, 0.7, -0.6];
          const bg = ws.bg || [0.1, 0.1, 0.1];
          const fg = ws.fg || [0.2, 0.7, 0.3];
          const targetText = ws.text || '';
          const glCanvas = document.createElement('canvas');
          glCanvas.width = 64; glCanvas.height = 64;
          const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
          if (gl) {
            // Render triangle with dynamic colors/vertices
            const vs = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vs, 'attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0,1);}');
            gl.compileShader(vs);
            const fs = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fs, `precision mediump float;varying vec2 v;void main(){gl_FragColor=vec4(v.x*${fg[0].toFixed(2)}+0.5,v.y*${fg[1].toFixed(2)}+0.5,${fg[2].toFixed(2)},1.0);}`);
            gl.compileShader(fs);
            const prog = gl.createProgram();
            gl.attachShader(prog, vs); gl.attachShader(prog, fs);
            gl.linkProgram(prog); gl.useProgram(prog);
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
            const loc = gl.getAttribLocation(prog, 'p');
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            gl.clearColor(bg[0], bg[1], bg[2], 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            // Overlay target_text via 2D canvas (binds hash to challenge text)
            if (targetText) {
              const txtCvs = document.createElement('canvas');
              txtCvs.width = 64; txtCvs.height = 64;
              const txtCtx = txtCvs.getContext('2d');
              // Copy WebGL render to 2D canvas
              txtCtx.drawImage(glCanvas, 0, 0);
              // Draw target_text on top
              txtCtx.font = '12px monospace';
              txtCtx.fillStyle = `rgb(${Math.floor(fg[0] * 255)},${Math.floor(fg[1] * 255)},${Math.floor(fg[2] * 255)})`;
              txtCtx.fillText(targetText, 4, 40);
              // Hash the composited result
              const compositePixels = txtCtx.getImageData(0, 0, 64, 64).data;
              const glBuf = await crypto.subtle.digest('SHA-256', compositePixels.buffer);
              webglHash = Array.from(new Uint8Array(glBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
            } else {
              const px = new Uint8Array(64 * 64 * 4);
              gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
              const glBuf = await crypto.subtle.digest('SHA-256', px.buffer);
              webglHash = Array.from(new Uint8Array(glBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
            }
          }
        } catch { webglHash = ''; }

        // Step 5: Collect behavioral + fingerprint data
        const behavioral = {
          mousePoints: behaviorData.mouse.length,
          mouseTrail: behaviorData.mouse.slice(-20),
          clicks: behaviorData.clicks,
          keys: behaviorData.keys,
          scrolls: behaviorData.scrolls,
          loadTime: Date.now() - behaviorData.startTime,
          screen: { w: window.screen?.width, h: window.screen?.height, dpr: window.devicePixelRatio },
        };

        // Step 6: Request task
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const taskRes = await fetch(`${API}/task`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            challengeId: challenge.c,
            jsResult,
            powNonce,
            canvasHash,
            webglHash,
            deviceId,
            botDetection: botResult,
            fingerprint: fpComponents,
            behavioral,
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
