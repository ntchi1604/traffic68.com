import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Globe, Target, ShieldCheck, Copy, Check,
  ExternalLink, ArrowRight, Eye,
  Sparkles, AlertCircle, CheckCircle2, MousePointerClick,
  Loader2, WifiOff
} from 'lucide-react';

/* ─── AES-256-GCM crypto helpers (Web Crypto API) ──── */
const KEY_RAW = import.meta.env.VITE_CHALLENGE_KEY || 't68vLsecur3Chall3ng3Key2026xZqWx';

async function getCryptoKey() {
  let keyBytes = new TextEncoder().encode(KEY_RAW);
  if (keyBytes.length < 32) {
    const padded = new Uint8Array(32);
    padded.set(keyBytes);
    keyBytes = padded;
  } else if (keyBytes.length > 32) {
    keyBytes = keyBytes.slice(0, 32);
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function b64ToUint8(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function uint8ToB64(arr) {
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

async function decryptPayload(encStr) {
  const [ivB64, dataB64, tagB64] = encStr.split('.');
  const iv = b64ToUint8(ivB64);
  const encrypted = b64ToUint8(dataB64);
  const tag = b64ToUint8(tagB64);
  const combined = new Uint8Array(encrypted.length + tag.length);
  combined.set(encrypted);
  combined.set(tag, encrypted.length);
  const key = await getCryptoKey();
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function encryptPayload(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getCryptoKey();
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const encArr = new Uint8Array(encrypted);
  const ciphertext = encArr.slice(0, encArr.length - 16);
  const tag = encArr.slice(encArr.length - 16);
  return uint8ToB64(iv) + '.' + uint8ToB64(ciphertext) + '.' + uint8ToB64(tag);
}

/* ─── Browser proof (anti-bot) ──────────────────────── */
function collectBrowserProof() {
  const sw = window.screen?.width || 0;
  const sh = window.screen?.height || 0;
  let botScore = 0;
  if (navigator.webdriver) botScore += 20;
  if (!window.chrome && /Chrome/.test(navigator.userAgent)) botScore += 15;
  if (sw === 0 || sh === 0) botScore += 20;
  return { sw, sh, botScore, ts: Date.now() };
}

/* ─── API base ──────────────────────────────────────── */
const API = '/api/vuot-link';


/* ─── Incognito detection via persistent cookie ─── */
// Cookie `_t68_v` is set from App Layout on every page visit (max-age=1year).
// Normal users: cookie exists from previous page visits.
// Incognito: cookies from previous sessions don't carry over → no cookie.
function detectIncognito() {
  return !document.cookie.split(';').some(c => c.trim().startsWith('_t68_v='));
}

/* ─── Main Component ────────────────────────────────── */
export default function VuotLink() {
  // Set tab title
  useEffect(() => {
    document.title = 'Vượt Link — traffic68.com';
  }, []);

  // Task state from API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [task, setTask] = useState(null); // { id, keyword, image1_url, waitTime, startedAt, expiresAt }
  const [isIncognito, setIsIncognito] = useState(false);

  // UI state
  const [activeStep, setActiveStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [showError, setShowError] = useState(false);
  const [completionResult, setCompletionResult] = useState(null); // { earning }
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

        // Check for incognito/private browsing (cookie-based)
        const incognito = detectIncognito();
        if (incognito) {
          if (!cancelled) setIsIncognito(true);
          return;
        }

        // Step 1: Get challenge
        const chRes = await fetch(`${API}/challenge`);
        if (!chRes.ok) throw new Error('Không thể lấy challenge');
        const chData = await chRes.json();
        const challenge = await decryptPayload(chData.d);

        // Step 2: Execute JS challenge
        // eslint-disable-next-line no-eval
        const jsResult = eval(challenge.j);

        // Step 3: Collect browser proof
        const proof = collectBrowserProof();

        // Step 4: Request task
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const encBody = await encryptPayload({
          challengeId: challenge.c,
          jsResult,
          proof,
        });

        const taskRes = await fetch(`${API}/task`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ d: encBody }),
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
        const decryptedTask = await decryptPayload(taskData.d);

        if (!cancelled) {
          setTask(decryptedTask);
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
        body: JSON.stringify({ step: stepName }),
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
        body: JSON.stringify({ code: inputCode.trim() }),
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
