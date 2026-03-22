/**
 * LinkGateway — public page /v/:slug
 * Visitor must complete a vượt link task to access the destination URL
 * set by the worker who created this link.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, Globe, ShieldCheck, ExternalLink, ArrowRight,
  AlertCircle, Loader2, WifiOff, Copy, Check, Lock, Unlock,
} from 'lucide-react';

/* ─── Same bot-detection + PoW helpers as VuotLink.jsx ─── */
function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(); s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

let _creepResult = null;
let _creepVisitorId = 'unknown';
let _creepDone = false;
let _creepResolvers = [];
function _resolveCreep(result) {
  if (_creepDone) return;
  _creepResult = result; _creepDone = true;
  _creepResolvers.forEach(r => r(result)); _creepResolvers = [];
}
if (typeof window !== 'undefined') {
  const _savedLog = console.log;
  console.log = function (...args) {
    for (const arg of args) {
      if (arg && typeof arg === 'object' && arg.workerScope && arg.workerScope.lied !== undefined) {
        let totalLied = 0; const liedSections = [];
        for (const key in arg) {
          if (arg[key] && typeof arg[key] === 'object' && arg[key].lied !== undefined) {
            const v = arg[key].lied === true ? 1 : (typeof arg[key].lied === 'number' ? arg[key].lied : 0);
            totalLied += v; if (v > 0) liedSections.push(key + ':' + v);
          }
        }
        if (arg.workerScope?.$hash) _creepVisitorId = arg.workerScope.$hash;
        _resolveCreep({ bot: totalLied > 0, totalLied, liedSections });
        console.log = _savedLog; return;
      }
    }
    _savedLog.apply(console, args);
  };
  loadScript('/creep.js').catch(() => { console.log = _savedLog; _resolveCreep({ bot: false }); });
  setTimeout(() => { if (!_creepDone) { console.log = _savedLog; _resolveCreep({ bot: false, timeout: true }); } }, 10000);
}
function getCreepData() {
  if (_creepDone) return Promise.resolve({ botDetection: _creepResult, visitorId: _creepVisitorId });
  return new Promise(resolve => {
    _creepResolvers.push(r => resolve({ botDetection: r, visitorId: _creepVisitorId }));
    setTimeout(() => { if (!_creepDone) _resolveCreep({ bot: false }); }, 10000);
  });
}
const probeData = {};
if (typeof window !== 'undefined') {
  try {
    probeData.webdriver = !!navigator.webdriver;
    probeData.pluginCount = navigator.plugins ? navigator.plugins.length : -1;
  } catch (e) { }
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

  const [inputCode, setInputCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [showError, setShowError] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Step 1: Load link info
  useEffect(() => {
    document.title = 'Vượt link để truy cập — traffic68.com';
    fetch(`/api/shortlink/info/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setLinkError(data.error);
        else setLinkInfo(data.link);
      })
      .catch(() => setLinkError('Không thể tải thông tin link'));
  }, [slug]);

  // Step 2: After link info loaded, fetch challenge + task
  useEffect(() => {
    if (!linkInfo) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError('');
        const creepData = await getCreepData();
        const visitorId = creepData.visitorId || 'unknown';
        const botDetectionResult = creepData.botDetection;

        // Get challenge
        const chRes = await fetch(`${API}/challenge`);
        if (!chRes.ok) throw new Error('Không thể lấy challenge');
        const challenge = await chRes.json();

        // Solve PoW
        let powNonce = 0;
        const target = '0'.repeat(challenge.d || 4);
        const enc = new TextEncoder();
        while (true) {
          const buf = await crypto.subtle.digest('SHA-256', enc.encode(challenge.p + powNonce));
          const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
          if (hex.startsWith(target)) break;
          powNonce++;
          if (powNonce > 5000000) throw new Error('PoW timeout');
        }

        // Canvas + WebGL proof
        let domWidth = 100, glRenderer = 'Generic', glPixel = [0, 0, 0];
        try {
          const cv = document.createElement('canvas');
          const ctx2d = cv.getContext('2d');
          ctx2d.font = `${challenge.df}px monospace`;
          domWidth = ctx2d.measureText(challenge.dt).width;
        } catch { }
        try {
          const glCv = document.createElement('canvas'); glCv.width = 4; glCv.height = 4;
          const gl = glCv.getContext('webgl') || glCv.getContext('experimental-webgl');
          if (gl) {
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            glRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            const [cr, cg, cb] = challenge.gc;
            gl.clearColor(cr, cg, cb, 1); gl.clear(gl.COLOR_BUFFER_BIT);
            const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            glPixel = [px[0], px[1], px[2]];
          }
        } catch { }

        // Request task, passing worker_link_id so server can track it
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const taskRes = await fetch(`${API}/task`, {
          method: 'POST', headers,
          body: JSON.stringify({
            challengeId: challenge.c, powNonce, domWidth, glRenderer, glPixel,
            visitorId, botDetection: botDetectionResult, probes: probeData,
            worker_link_id: linkInfo.id,   // ← key: link gateway tracking
          }),
        });

        if (taskRes.status === 429) {
          const e = await taskRes.json();
          if (!cancelled) setError(e.error || 'Bạn đã đạt giới hạn hôm nay.');
          return;
        }
        if (!taskRes.ok) throw new Error('Không thể lấy nhiệm vụ');
        if (!cancelled) setTask(await taskRes.json());
      } catch (err) {
        if (!cancelled) setError(err.message || 'Lỗi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [linkInfo]);

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
  const widgetConfig = task?.widgetConfig || null;

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
  if (!linkInfo || loading) return (
    <Wrapper>
      <Center>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748B', fontWeight: 500 }}>{!linkInfo ? 'Đang tải link...' : 'Đang chuẩn bị nhiệm vụ...'}</p>
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

        {/* ── Destination info ── */}
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1.5px solid #BFDBFE', borderRadius: 16, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lock size={20} color="#3B82F6" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, color: '#3B82F6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Link được bảo vệ</p>
            <p style={{ fontWeight: 700, color: '#1E293B', fontSize: 15, marginBottom: 2 }}>{linkInfo.title || 'Hoàn thành nhiệm vụ để truy cập link'}</p>
            <p style={{ fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkInfo.destination_url}</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 'clamp(20px,4vw,30px)', fontWeight: 900, color: '#1E3A6E', margin: '0 0 6px' }}>
            HOÀN THÀNH NHIỆM VỤ ĐỂ TRUY CẬP
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>Thực hiện 4 bước bên dưới theo thứ tự để mở khóa liên kết</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Step 1 */}
          <StepCard n={1} color="#3B82F6" title="MỞ GOOGLE" verified={verified}>
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>
                <span style={{ color: '#4285F4' }}>G</span><span style={{ color: '#EA4335' }}>o</span><span style={{ color: '#FBBC04' }}>o</span><span style={{ color: '#4285F4' }}>g</span><span style={{ color: '#34A853' }}>l</span><span style={{ color: '#EA4335' }}>e</span>
              </div>
              <a href="https://www.google.com" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', textDecoration: 'none', padding: '11px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700 }}>
                <ExternalLink size={14} /> Mở Google
              </a>
            </div>
          </StepCard>

          {/* Step 2 */}
          <StepCard n={2} color="#F97316" title="NHẬP TỪ KHÓA" verified={verified}>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 11, color: '#92400E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Từ khóa tìm kiếm</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px dashed #FB923C', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
                <Search size={16} color="#F97316" />
                <span style={{ flex: 1, color: '#EA580C', fontSize: 15, fontWeight: 700 }}>{keyword || 'traffic user giá rẻ traffic68'}</span>
                <CopyBtn text={keyword || 'traffic user giá rẻ traffic68'} />
              </div>
              {['Copy từ khóa bên trên', 'Dán vào ô tìm kiếm Google', 'Nhấn Enter'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 2 ? 6 : 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                  </div>
                  <span style={{ color: '#374151', fontSize: 13 }}>{t}</span>
                </div>
              ))}
            </div>
          </StepCard>

          {/* Step 3 */}
          <StepCard n={3} color="#7C3AED" title="TÌM TRANG ĐÍCH" verified={verified}>
            <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 14, padding: 14 }}>
              {task?.image1_url && (
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid #DDD6FE', marginBottom: 14 }}>
                  <img src={task.image1_url} alt="Trang đích" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', objectPosition: 'top', display: 'block' }} onError={e => e.target.style.display = 'none'} />
                </div>
              )}
              {['Cuộn tìm trong kết quả Google', 'Tìm trang có giao diện giống hình trên', 'Click vào kết quả để truy cập'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 8, padding: '8px 12px', marginBottom: i < 2 ? 8 : 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                  </div>
                  <span style={{ color: '#374151', fontSize: 13 }}>{t}</span>
                </div>
              ))}
            </div>
          </StepCard>

          {/* Step 4 — Code entry */}
          <StepCard n={4} color="#16A34A" title="NHẬP MÃ XÁC NHẬN" verified={verified}>
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
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#fff', textDecoration: 'none', padding: '12px 28px', borderRadius: 12, fontSize: 14, fontWeight: 700 }}>
                    Đến trang đích ngay <ArrowRight size={16} />
                  </a>
                )}
              </div>
            ) : (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: 20 }}>
                <p style={{ fontSize: 13, color: '#15803D', marginBottom: 16 }}>
                  Trên trang đích, chờ đủ thời gian → bấm nút lấy mã → sao chép mã → quay lại đây nhập.
                </p>
                {/* Button preview */}
                <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Nút trông như thế này:</span>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: widgetConfig?.buttonColor || '#F97316',
                    color: widgetConfig?.textColor || '#fff',
                    borderRadius: `${widgetConfig?.borderRadius ?? 50}px`,
                    fontSize: `${widgetConfig?.fontSize || 15}px`,
                    fontWeight: 700, padding: '8px 16px', userSelect: 'none',
                    boxShadow: `0 4px 16px ${(widgetConfig?.buttonColor || '#F97316')}55`,
                  }}>
                    <img src={widgetConfig?.iconUrl || 'https://traffic68.com/lg.png'}
                      width={widgetConfig?.iconSize ?? 20} height={widgetConfig?.iconSize ?? 20}
                      alt="" style={{ borderRadius: 4, background: 'rgba(255,255,255,0.9)', padding: 2, objectFit: 'contain' }}
                      onError={e => e.target.style.display = 'none'} />
                    {widgetConfig?.buttonText || 'Lấy Mã'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input type="text" maxLength={6} value={inputCode}
                    onChange={e => setInputCode(e.target.value.toUpperCase())}
                    disabled={completing} placeholder="Nhập mã tại đây"
                    onKeyDown={e => e.key === 'Enter' && handleVerify()}
                    style={{ flex: 1, padding: '12px 14px', background: '#fff', border: `1.5px solid ${showError ? '#FCA5A5' : '#86EFAC'}`, borderRadius: 10, outline: 'none', fontSize: 16, fontWeight: 700, letterSpacing: 3, textAlign: 'center', color: '#1E293B' }}
                  />
                  <button onClick={handleVerify} disabled={inputCode.length < 4 || completing}
                    style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: inputCode.length >= 4 && !completing ? 'linear-gradient(135deg,#22C55E,#16A34A)' : '#E2E8F0', color: inputCode.length >= 4 ? '#fff' : '#94A3B8', fontWeight: 700, cursor: inputCode.length >= 4 && !completing ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {completing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    {completing ? 'Xử lý...' : 'Xác nhận'}
                  </button>
                </div>
                {showError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                    <AlertCircle size={14} color="#EF4444" />
                    <span style={{ color: '#DC2626', fontSize: 12 }}>{error}</span>
                  </div>
                )}
                <button onClick={handleVerify} disabled={inputCode.length < 4 || completing}
                  style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: inputCode.length >= 4 && !completing ? 'linear-gradient(135deg,#F97316,#EA580C)' : '#E2E8F0', color: inputCode.length >= 4 ? '#fff' : '#94A3B8', fontSize: 14, fontWeight: 800, cursor: inputCode.length >= 4 && !completing ? 'pointer' : 'not-allowed', letterSpacing: '0.3px' }}>
                  {completing ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN VÀ MỞ KHÓA LINK →'}
                </button>
              </div>
            )}
          </StepCard>
        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes progress { from{width:0} to{width:100%} }
      `}</style>
    </Wrapper>
  );
}

function Wrapper({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#DBEAFE 0%,#EFF6FF 40%,#F0F9FF 70%,#F8FAFC 100%)', fontFamily: "'Inter',sans-serif" }}>
      {children}
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
  return (
    <div style={{ background: '#fff', border: `2px solid ${verified ? '#86EFAC' : '#E2E8F0'}`, borderRadius: 20, padding: 'clamp(18px,3vw,28px)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', transition: 'border-color 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: verified ? '#22C55E' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>{n}</span>
        </div>
        <span style={{ color: verified ? '#16A34A' : color, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>BƯỚC {n}</span>
        {verified && <span style={{ marginLeft: 'auto', background: '#F0FEF4', border: '1px solid #86EFAC', color: '#16A34A', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100 }}>✓ HOÀN THÀNH</span>}
      </div>
      <h2 style={{ color: verified ? '#16A34A' : color, fontSize: 'clamp(16px,3vw,22px)', fontWeight: 900, margin: '0 0 14px' }}>{title}</h2>
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
