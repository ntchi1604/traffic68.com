import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Rocket, ExternalLink, Search, CheckCircle, Loader2, Link2 } from 'lucide-react';

/* ─────────────────── SVG Icon Components ─────────────────── */

const BarChartIcon = () => (
  <svg viewBox="0 0 80 80" className="w-full h-full">
    <rect x="8" y="50" width="12" height="22" rx="3" fill="#86efac" />
    <rect x="24" y="35" width="12" height="37" rx="3" fill="#4ade80" />
    <rect x="40" y="20" width="12" height="52" rx="3" fill="#22c55e" />
    <rect x="56" y="8" width="12" height="64" rx="3" fill="#16a34a" />
    <path d="M14 48 L30 33 L46 18 L62 6" stroke="#15803d" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <polygon points="62,2 66,8 58,8" fill="#15803d" />
  </svg>
);

const WalletIcon = () => (
  <svg viewBox="0 0 80 80" className="w-full h-full">
    <rect x="10" y="20" width="55" height="42" rx="8" fill="#92400e" />
    <rect x="10" y="20" width="55" height="12" rx="6" fill="#78350f" />
    <rect x="14" y="36" width="20" height="14" rx="3" fill="#22c55e" />
    <rect x="18" y="40" width="20" height="14" rx="3" fill="#4ade80" />
    <circle cx="55" cy="42" r="5" fill="#fbbf24" />
    <rect x="8" y="18" width="55" height="4" rx="2" fill="#a16207" />
  </svg>
);

const DashboardIcon = () => (
  <svg viewBox="0 0 80 80" className="w-full h-full">
    <rect x="6" y="8" width="68" height="52" rx="6" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
    <rect x="6" y="8" width="68" height="10" rx="6" fill="#64748b" />
    <circle cx="14" cy="13" r="2" fill="#ef4444" />
    <circle cx="20" cy="13" r="2" fill="#eab308" />
    <circle cx="26" cy="13" r="2" fill="#22c55e" />
    <rect x="12" y="24" width="24" height="14" rx="3" fill="#dbeafe" />
    <rect x="40" y="24" width="28" height="14" rx="3" fill="#dcfce7" />
    <rect x="12" y="42" width="56" height="4" rx="2" fill="#e0f2fe" />
    <rect x="12" y="50" width="36" height="4" rx="2" fill="#fef3c7" />
    <rect x="14" y="27" width="8" height="8" rx="1" fill="#3b82f6" opacity="0.6" />
    <rect x="24" y="30" width="8" height="5" rx="1" fill="#3b82f6" opacity="0.4" />
  </svg>
);

const LinkCustomIcon = () => (
  <svg viewBox="0 0 80 80" className="w-full h-full">
    <path d="M30 40 Q22 40 22 32 Q22 24 30 24 L40 24 Q48 24 48 32" stroke="#14b8a6" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M50 40 Q58 40 58 48 Q58 56 50 56 L40 56 Q32 56 32 48" stroke="#0d9488" strokeWidth="4" fill="none" strokeLinecap="round" />
    <line x1="36" y1="32" x2="44" y2="48" stroke="#14b8a6" strokeWidth="3" strokeLinecap="round" />
    <circle cx="58" cy="28" r="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
    <path d="M56 28 L58 26 L62 30" stroke="#14b8a6" strokeWidth="1.5" fill="none" strokeLinecap="round" />
  </svg>
);

/* ─── CSS Browser Mockup ─── */
const BrowserMockup = ({ children, dark = false, tabTitle = '', url = '', className = '' }) => (
  <div className={`rounded-lg overflow-hidden shadow-lg ${dark ? 'bg-[#27272a]' : 'bg-white border border-gray-200'} ${className}`}>
    {/* Title bar */}
    <div className={`flex items-center gap-2 px-3 py-2 ${dark ? 'bg-[#18181b]' : 'bg-gray-100 border-b border-gray-200'}`}>
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
      </div>
      {tabTitle && (
        <span className={`text-[9px] font-medium truncate ${dark ? 'text-zinc-400' : 'text-gray-500'}`}>{tabTitle}</span>
      )}
    </div>
    {/* Address bar */}
    {url && (
      <div className={`mx-2 mt-1.5 mb-1 px-2.5 py-1 rounded-md text-[10px] font-medium truncate ${dark ? 'bg-[#3f3f46] text-zinc-300' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
        {url}
      </div>
    )}
    {/* Content */}
    <div className="p-2">
      {children}
    </div>
  </div>
);

/* ─── CSS Phone Mockup ─── */
const PhoneMockup = ({ children, className = '' }) => (
  <div className={`relative mx-auto ${className}`} style={{ width: '85px' }}>
    <div className="bg-zinc-800 rounded-[14px] p-1 shadow-xl border-2 border-zinc-700">
      {/* Notch */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-zinc-900 rounded-full z-10" />
      {/* Screen */}
      <div className="bg-white rounded-[10px] overflow-hidden" style={{ minHeight: '120px' }}>
        {children}
      </div>
    </div>
  </div>
);

/* ─── Person / Avatar Illustration ─── */
const PersonIllustration = ({ color = '#22c55e', className = '' }) => (
  <svg viewBox="0 0 40 60" className={className} fill="none">
    <circle cx="20" cy="12" r="8" fill={color} opacity="0.8" />
    <path d="M10 60 L10 32 Q10 24 20 24 Q30 24 30 32 L30 60" fill={color} opacity="0.6" />
    <circle cx="20" cy="12" r="4" fill="white" opacity="0.5" />
  </svg>
);

/* ─── Feature Sidebar Card ─── */
const FeatureCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 flex flex-col items-center gap-3 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group flex-1">
    <p className="font-black text-center text-[11px] uppercase leading-snug tracking-wide whitespace-pre-line"
      style={{ color: '#166534' }}>
      {title}
    </p>
    <div className="w-16 h-16 transition-transform duration-300 group-hover:scale-110">
      {children}
    </div>
  </div>
);

/* ─── Step Number Badge ─── */
const StepBadge = ({ num }) => (
  <div className="absolute top-2.5 left-2.5 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110"
    style={{ background: 'linear-gradient(135deg, #166534, #15803d)' }}>
    <span className="text-white font-black text-sm leading-none">{num}</span>
  </div>
);

/* ═══════════════════════════════════════════════════════════════ */
/*                        MAIN COMPONENT                         */
/* ═══════════════════════════════════════════════════════════════ */

export default function VuotLink() {
  usePageTitle('Vượt Link');

  const [glowing, setGlowing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [campaignImg, setCampaignImg] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeResult, setCodeResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  /* ── Code submission handler ── */
  const handleCodeSubmit = async () => {
    if (!taskId || !codeInput.trim() || submitting) return;
    setSubmitting(true);
    setCodeResult(null);
    try {
      const res = await fetch(`/api/vuot-link/task/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput.trim(), timeOnSite: Math.floor((Date.now() - performance.now()) / 1000) })
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setCodeResult({ success: true, message: `✅ Thành công! Mã của bạn: ${data.code} — Bạn nhận được ${data.earning}đ` });
      } else {
        setCodeResult({ success: false, message: data.error || 'Xác nhận thất bại. Vui lòng thử lại.' });
      }
    } catch (err) {
      setCodeResult({ success: false, message: 'Lỗi kết nối. Vui lòng thử lại.' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Bot detection + task fetching ── */
  useEffect(() => {
    let botScore = 0;
    if (navigator.webdriver) botScore += 50;
    if (window._phantom || window.__nightmare || window.callPhantom) botScore += 50;
    if (navigator.plugins && navigator.plugins.length === 0 && !/mobile/i.test(navigator.userAgent)) botScore += 20;
    if (window.screen.width === 0 || window.screen.height === 0) botScore += 30;
    if (window.outerWidth === 0 && window.outerHeight === 0) botScore += 20;
    if (/Chrome/.test(navigator.userAgent) && !window.chrome) botScore += 25;

    try {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 50;
      const ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('AB test', 2, 15);
      if (c.toDataURL().length < 1000) botScore += 20;
    } catch (e) { botScore += 10; }

    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          const r = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
          if (/swiftshader|llvmpipe|software|mesa/i.test(r)) botScore += 30;
        }
      } else { botScore += 15; }
    } catch (e) { botScore += 5; }

    if (!navigator.language) botScore += 15;
    try { if (!Intl.DateTimeFormat().resolvedOptions().timeZone) botScore += 10; } catch (e) { botScore += 10; }

    if (botScore >= 40) {
      setKeyword('Trình duyệt không hợp lệ');
      return;
    }

    let interacted = false;
    let mouseCount = 0;
    const loadTime = Date.now();

    const trackM = () => { mouseCount++; };
    window.addEventListener('mousemove', trackM);
    window.addEventListener('touchmove', trackM);

    const doFetch = async () => {
      if (interacted) return;
      interacted = true;

      setKeyword('Đang xác minh...');

      try {
        const decrypt = async (enc) => {
          const [ivB64, dataB64, tagB64] = enc.split('.');
          const keyData = new TextEncoder().encode(import.meta.env.VITE_CHALLENGE_KEY);
          const k = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['decrypt']);
          const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
          const ct = Uint8Array.from(atob(dataB64), c => c.charCodeAt(0));
          const tg = Uint8Array.from(atob(tagB64), c => c.charCodeAt(0));
          const buf = new Uint8Array(ct.length + tg.length);
          buf.set(ct); buf.set(tg, ct.length);
          const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, buf);
          return JSON.parse(new TextDecoder().decode(dec));
        };

        const chRes = await fetch('/api/vuot-link/challenge');
        const { d: encCh } = await chRes.json();
        const { c: challengeId, j: jsCode } = await decrypt(encCh);

        const jsResult = new Function('return ' + jsCode)();

        const payload = {
          challengeId,
          jsResult,
          proof: { botScore, mouseCount, timeOnPage: Date.now() - loadTime, sw: window.screen.width, sh: window.screen.height, plugins: navigator.plugins?.length || 0 }
        };
        const ck = import.meta.env.VITE_CHALLENGE_KEY;
        const ek = await crypto.subtle.importKey('raw', new TextEncoder().encode(ck), 'AES-GCM', false, ['encrypt']);
        const eiv = crypto.getRandomValues(new Uint8Array(12));
        const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: eiv }, ek, new TextEncoder().encode(JSON.stringify(payload)));
        const encArr = new Uint8Array(enc);
        const eCt = encArr.slice(0, encArr.length - 16);
        const eTag = encArr.slice(encArr.length - 16);
        const toB64 = arr => btoa(String.fromCharCode(...arr));
        const encBody = toB64(eiv) + '.' + toB64(eCt) + '.' + toB64(eTag);

        const taskRes = await fetch('/api/vuot-link/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ d: encBody })
        });
        const taskJson = await taskRes.json();
        if (taskJson.d) {
          const task = await decrypt(taskJson.d);
          setKeyword(task.keyword); setTaskId(task.id);
          if (task.image1_url) setCampaignImg(task.image1_url);
        } else {
          setKeyword(taskJson.error || 'Không có task');
        }
      } catch (err) { console.error('VuotLink error:', err); setKeyword('Không có task'); }
    };

    doFetch();

    return () => {
      window.removeEventListener('mousemove', trackM);
      window.removeEventListener('touchmove', trackM);
    };
  }, []);

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="min-h-screen font-sans relative overflow-hidden" style={{ background: '#f1f5f9' }}>

      {/* ── Abstract geometric background pattern ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #22c55e, transparent 70%)' }} />
        <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
        <div className="absolute bottom-20 left-1/4 w-72 h-72 rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, #f97316, transparent 70%)' }} />
        {/* Subtle grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
          <defs>
            <pattern id="vuotlink-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#334155" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#vuotlink-grid)" />
        </svg>
        {/* Floating geometric shapes */}
        <div className="absolute top-[15%] left-[8%] w-6 h-6 rounded rotate-45 opacity-10 float-anim" style={{ background: '#22c55e', animationDelay: '0s' }} />
        <div className="absolute top-[60%] right-[12%] w-4 h-4 rounded-full opacity-10 float-anim" style={{ background: '#3b82f6', animationDelay: '1.5s' }} />
        <div className="absolute top-[40%] left-[85%] w-5 h-5 rounded opacity-8 float-anim" style={{ background: '#f97316', animationDelay: '2.5s' }} />
        <div className="absolute top-[75%] left-[15%] w-3 h-3 rounded-full opacity-10 float-anim" style={{ background: '#8b5cf6', animationDelay: '1s' }} />
      </div>

      {/* ── Main content wrapper ── */}
      <div className="relative z-10 max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6 py-6 md:py-10 flex flex-col gap-6">

        {/* ── Title + Lấy Mã ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 fade-in-up">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase text-center leading-tight tracking-wide"
            style={{ color: '#166534' }}>
            QUY TRÌNH HOÀN TẤT VƯỢT LINK 4 BƯỚC
          </h1>
          <button
            onMouseEnter={() => setGlowing(true)}
            onMouseLeave={() => setGlowing(false)}
            className="relative flex-shrink-0 flex items-center gap-2 text-white font-black uppercase text-xs sm:text-sm px-5 py-2.5 rounded-xl cursor-pointer select-none transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#f97316 0%,#ea580c 100%)',
              boxShadow: glowing
                ? '0 0 32px 10px rgba(249,115,22,.65),0 4px 18px rgba(249,115,22,.4)'
                : '0 0 16px 4px rgba(249,115,22,.4)',
            }}>
            <Link2 size={16} /> LẤY MÃ
            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-yellow-300 rounded-full animate-ping opacity-80" />
          </button>
        </div>

        {/* ══════════════════ DESKTOP 3-COLUMN LAYOUT ══════════════════ */}
        <div className="hidden lg:grid gap-5" style={{ gridTemplateColumns: '180px 1fr 180px' }}>

          {/* ── LEFT SIDEBAR ── */}
          <div className="flex flex-col gap-5 fade-in-up" style={{ animationDelay: '0.1s' }}>
            <FeatureCard title="CPM CAO NHẤT">
              <BarChartIcon />
            </FeatureCard>
            <FeatureCard title={'THANH TOÁN\nMOMO/PAYPAL'}>
              <WalletIcon />
            </FeatureCard>
          </div>

          {/* ── CENTER MAIN BOARD ── */}
          <div className="relative fade-in-up" style={{ animationDelay: '0.2s' }}>
            {/* Main board container */}
            <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] shadow-2xl border border-gray-100 p-5 lg:p-6 relative overflow-visible">

              {/* ── Connecting vertical lines ── */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full pointer-events-none z-[1]">
                <div className="absolute top-[22%] left-0 w-0.5 h-[18%] rounded-full"
                  style={{ background: 'linear-gradient(to bottom, #bbf7d0, #22c55e, #bbf7d0)' }} />
                <div className="absolute top-[58%] left-0 w-0.5 h-[18%] rounded-full"
                  style={{ background: 'linear-gradient(to bottom, #bbf7d0, #22c55e, #bbf7d0)' }} />
              </div>

              {/* Person illustrations on connecting lines */}
              <div className="absolute z-[2] pointer-events-none" style={{ top: '32%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                <PersonIllustration color="#22c55e" className="w-6 h-9 opacity-40" />
              </div>
              <div className="absolute z-[2] pointer-events-none" style={{ top: '68%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                <PersonIllustration color="#16a34a" className="w-6 h-9 opacity-40" />
              </div>

              {/* Character guide center */}
              <div className="absolute z-10 pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -60%)', width: '100px' }}>
                <img src="/character_guide.png" alt="Hướng dẫn viên" className="w-full h-auto object-contain drop-shadow-2xl" />
              </div>

              {/* ── 2×2 Grid of Steps ── */}
              <div className="grid grid-cols-2 gap-5 relative z-[3]">

                {/* ───── STEP 1 ───── */}
                <div className="relative flex rounded-2xl border-2 shadow-md overflow-hidden group transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                  style={{ borderColor: '#bbf7d0', background: 'linear-gradient(135deg, #f0fdf4, #ffffff)' }}>
                  <StepBadge num={1} />
                  {/* Graphic: Laptop with Google */}
                  <div className="flex-shrink-0 flex items-center justify-center p-3" style={{ background: '#dcfce7', width: '145px' }}>
                    <BrowserMockup tabTitle="Google" url="google.com" className="w-full">
                      <div className="flex flex-col items-center py-2">
                        <span className="text-[10px] font-bold text-blue-500">G</span>
                        <span className="text-[7px] font-bold tracking-wider" style={{ color: '#4285F4' }}>
                          <span style={{ color: '#4285F4' }}>G</span>
                          <span style={{ color: '#ea4335' }}>o</span>
                          <span style={{ color: '#fbbc05' }}>o</span>
                          <span style={{ color: '#4285F4' }}>g</span>
                          <span style={{ color: '#34a853' }}>l</span>
                          <span style={{ color: '#ea4335' }}>e</span>
                        </span>
                        <div className="mt-1 w-[80%] h-2 bg-gray-100 rounded-full border border-gray-200" />
                      </div>
                    </BrowserMockup>
                  </div>
                  <div className="bg-white/80 p-3 flex flex-col gap-1.5 flex-1 justify-center">
                    <p className="font-black text-xs leading-snug" style={{ color: '#166534' }}>BƯỚC 1: MỞ GOOGLE</p>
                    <p className="text-gray-500 text-[11px] leading-relaxed">Mở trình duyệt và truy cập trang chủ Google.</p>
                    <a href="https://www.google.com" target="_blank" rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[11px] font-bold transition-all hover:scale-[1.03] active:scale-95 shadow-md w-fit"
                      style={{ background: 'linear-gradient(135deg, #4285F4, #34A853)' }}>
                      <ExternalLink size={12} /> Mở Google.com
                    </a>
                  </div>
                </div>

                {/* ───── STEP 2 ───── */}
                <div className="relative flex rounded-2xl border-2 shadow-md overflow-hidden group transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                  style={{ borderColor: '#bbf7d0', background: 'linear-gradient(135deg, #ffffff, #f0fdf4)' }}>
                  <StepBadge num={2} />
                  <div className="bg-white/80 p-3 flex flex-col gap-1.5 flex-1 justify-center">
                    <p className="font-black text-xs leading-snug" style={{ color: '#166534' }}>BƯỚC 2: NHẬP TỪ KHÓA TÌM KIẾM</p>
                    <p className="text-gray-500 text-[11px] leading-relaxed">Tìm kiếm từ khóa bên dưới trên Google.</p>
                    <div className="mt-1 flex items-center gap-1.5 bg-amber-50 border-2 border-amber-300 rounded-lg p-2 transition-all hover:border-amber-400"
                      style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onCopy={e => e.preventDefault()}>
                      <Search size={13} className="text-amber-600 flex-shrink-0" />
                      <span className="flex-1 font-black text-amber-800 text-[11px]">{keyword || 'Đang tải...'}</span>
                    </div>
                  </div>
                  {/* Graphic: Search results browser */}
                  <div className="flex-shrink-0 flex items-center justify-center p-3" style={{ background: '#dcfce7', width: '145px' }}>
                    <BrowserMockup tabTitle="Kết quả tìm kiếm" url="google.com/search" className="w-full">
                      <div className="space-y-1 py-1">
                        <div className="w-full h-1.5 bg-blue-200 rounded" />
                        <div className="w-[90%] h-1 bg-gray-200 rounded" />
                        <div className="w-[75%] h-1 bg-gray-100 rounded" />
                        <div className="mt-1.5 w-full h-1.5 bg-blue-200 rounded" />
                        <div className="w-[85%] h-1 bg-gray-200 rounded" />
                        <div className="w-[60%] h-1 bg-gray-100 rounded" />
                      </div>
                    </BrowserMockup>
                  </div>
                </div>

                {/* ───── STEP 3 ───── */}
                <div className="relative flex rounded-2xl border-2 shadow-md overflow-hidden group transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                  style={{ borderColor: '#bbf7d0', background: 'linear-gradient(135deg, #f0fdf4, #ffffff)' }}>
                  <StepBadge num={3} />
                  <div className="bg-white/80 p-3 flex flex-col gap-1.5 flex-1 justify-center">
                    <p className="font-black text-xs leading-snug" style={{ color: '#166534' }}>BƯỚC 3: TÌM KIẾM TRANG ĐÍCH</p>
                    <p className="text-gray-500 text-[11px] leading-relaxed">Tìm kiếm trang đích.</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center justify-center p-3" style={{ background: '#dcfce7', width: '180px' }}>
                    <img src={campaignImg || '/step3_getcode.png'} alt="Tìm kiếm trang đích" className="w-full h-full object-contain" />
                  </div>
                </div>

                {/* ───── STEP 4 ───── */}
                <div className="relative flex rounded-2xl border-2 shadow-md overflow-hidden group transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                  style={{ borderColor: '#bbf7d0', background: 'linear-gradient(135deg, #ffffff, #f0fdf4)' }}>
                  <StepBadge num={4} />
                  {/* Graphic: Mobile phone with code */}
                  <div className="flex-shrink-0 flex items-center justify-center p-3" style={{ background: '#dcfce7', width: '130px' }}>
                    <PhoneMockup>
                      <div className="p-2 space-y-1.5 flex flex-col items-center justify-center" style={{ minHeight: '90px' }}>
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle size={14} className="text-green-600" />
                        </div>
                        <div className="w-full h-1.5 bg-green-100 rounded" />
                        <div className="w-[70%] h-1 bg-gray-100 rounded" />
                        <div className="w-full h-3 bg-green-50 rounded border border-green-200 mt-0.5" />
                      </div>
                    </PhoneMockup>
                  </div>
                  <div className="bg-white/80 p-3 flex flex-col gap-1.5 flex-1 justify-center">
                    <p className="font-black text-xs leading-snug" style={{ color: '#166534' }}>BƯỚC 4: NHẬP MÃ XÁC NHẬN</p>
                    <p className="text-gray-500 text-[11px] leading-relaxed">Tìm kiếm nút - Đợi và nhập code</p>
                    <input
                      type="text"
                      placeholder="Nhập mã code tại đây..."
                      value={codeInput}
                      onChange={e => setCodeInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border-2 border-green-300 text-[11px] font-bold focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all placeholder:text-green-300"
                      style={{ background: '#f0fdf4' }}
                      disabled={submitting || (codeResult && codeResult.success)}
                    />
                    <button
                      onClick={handleCodeSubmit}
                      disabled={submitting || !codeInput.trim() || (codeResult && codeResult.success)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{ background: codeResult?.success ? '#16a34a' : 'linear-gradient(135deg, #f97316, #ea580c)' }}
                    >
                      {submitting ? (
                        <><Loader2 size={12} className="animate-spin" /> Đang xác nhận...</>
                      ) : codeResult?.success ? (
                        <><CheckCircle size={12} /> Đã xác nhận!</>
                      ) : (
                        <><CheckCircle size={12} /> Xác Nhận</>
                      )}
                    </button>
                    {codeResult && (
                      <div className={`text-[10px] font-bold rounded-md px-2 py-1 ${codeResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {codeResult.message}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* ───── STEP 3 OVERLAY: Dark Browser Mockup ───── */}
              <div className="absolute z-20 pointer-events-none"
                style={{ top: '50%', left: '50%', transform: 'translate(-50%, -15%)', width: 'clamp(280px, 55%, 420px)' }}>
                <div className="rounded-xl overflow-hidden shadow-2xl border border-zinc-700"
                  style={{ background: '#27272a', boxShadow: '0 25px 60px rgba(0,0,0,0.4), 0 0 40px rgba(34,197,94,0.08)' }}>
                  {/* macOS title bar */}
                  <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#18181b' }}>
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.5)]" />
                      <span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <span className="text-[10px] text-zinc-400 font-medium bg-zinc-800 px-3 py-0.5 rounded-md">
                        Traffician Service Landing
                      </span>
                    </div>
                  </div>
                  {/* Address bar */}
                  <div className="mx-3 mt-1.5 mb-2 flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-white font-black text-lg sm:text-xl md:text-2xl tracking-wide flex-1 text-center">
                      traffictot.com
                    </span>
                  </div>
                  {/* Content area hint */}
                  <div className="px-3 pb-3 space-y-1.5">
                    <div className="w-full h-2 bg-zinc-700 rounded" />
                    <div className="w-[80%] h-1.5 bg-zinc-800 rounded" />
                    <div className="w-[60%] h-1.5 bg-zinc-800 rounded" />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="flex flex-col gap-5 fade-in-up" style={{ animationDelay: '0.3s' }}>
            <FeatureCard title="THỐNG KÊ CHI TIẾT">
              <DashboardIcon />
            </FeatureCard>
            <FeatureCard title="TÙY CHỈNH LINK">
              <LinkCustomIcon />
            </FeatureCard>
          </div>

        </div>

        {/* ══════════════════ MOBILE / TABLET LAYOUT ══════════════════ */}
        <div className="flex flex-col gap-4 lg:hidden">

          {/* Step 1 */}
          <div className="relative flex flex-col sm:flex-row rounded-2xl border-2 shadow-md overflow-hidden group transition-all duration-300 hover:shadow-xl"
            style={{ borderColor: '#bbf7d0', background: 'linear-gradient(135deg, #f0fdf4, #ffffff)' }}>
            <StepBadge num={1} />
            <div className="flex-shrink-0 flex items-center justify-center sm:w-40" style={{ background: '#dcfce7', minHeight: '140px' }}>
              <div className="p-3 w-full max-w-[180px]">
                <BrowserMockup tabTitle="Google" url="google.com">
                  <div className="flex flex-col items-center py-2">
                    <span className="text-[8px] font-bold tracking-wider">
                      <span style={{ color: '#4285F4' }}>G</span>
                      <span style={{ color: '#ea4335' }}>o</span>
                      <span style={{ color: '#fbbc05' }}>o</span>
                      <span style={{ color: '#4285F4' }}>g</span>
                      <span style={{ color: '#34a853' }}>l</span>
                      <span style={{ color: '#ea4335' }}>e</span>
                    </span>
                    <div className="mt-1 w-[80%] h-2 bg-gray-100 rounded-full border border-gray-200" />
                  </div>
                </BrowserMockup>
              </div>
            </div>
            <div className="bg-white/80 p-4 flex flex-col gap-2 flex-1">
              <p className="font-black text-sm leading-snug" style={{ color: '#166534' }}>BƯỚC 1: MỞ GOOGLE</p>
              <p className="text-gray-500 text-xs leading-relaxed">Mở trình duyệt và truy cập trang chủ Google.</p>
              <a href="https://www.google.com" target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md w-fit"
                style={{ background: 'linear-gradient(135deg, #4285F4, #34A853)' }}>
                <ExternalLink size={14} /> Mở Google.com
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col sm:flex-row rounded-2xl border-2 shadow-md overflow-hidden group transition-all duration-300 hover:shadow-xl"
            style={{ borderColor: '#bbf7d0', background: 'linear-gradient(135deg, #ffffff, #f0fdf4)' }}>
            <StepBadge num={2} />
            <div className="bg-white/80 p-4 flex flex-col gap-2 flex-1 order-2 sm:order-1">
              <p className="font-black text-sm leading-snug" style={{ color: '#166534' }}>BƯỚC 2: NHẬP TỪ KHÓA TÌM KIẾM</p>
              <p className="text-gray-500 text-xs leading-relaxed">Tìm kiếm từ khóa bên dưới trên Google.</p>
              <div className="mt-1 flex items-center gap-2 bg-amber-50 border-2 border-amber-300 rounded-xl p-2"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onCopy={e => e.preventDefault()}>
                <Search size={14} className="text-amber-600 flex-shrink-0" />
                <span className="flex-1 font-black text-amber-800 text-xs">{keyword || 'Đang tải...'}</span>
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center justify-center sm:w-40 order-1 sm:order-2" style={{ background: '#dcfce7', minHeight: '140px' }}>
              <div className="p-3 w-full max-w-[180px]">
                <BrowserMockup tabTitle="Tìm kiếm" url="google.com/search">
                  <div className="space-y-1 py-1">
                    <div className="w-full h-1.5 bg-blue-200 rounded" />
                    <div className="w-[90%] h-1 bg-gray-200 rounded" />
                    <div className="w-[75%] h-1 bg-gray-100 rounded" />
                    <div className="mt-1 w-full h-1.5 bg-blue-200 rounded" />
                    <div className="w-[85%] h-1 bg-gray-200 rounded" />
                  </div>
                </BrowserMockup>
              </div>
            </div>
          </div>

          {/* Character guide mobile */}
          <div className="flex justify-center">
            <img src="/character_guide.png" alt="Hướng dẫn viên" className="h-28 w-auto object-contain drop-shadow" />
          </div>

          {/* Step 3 — with dark browser overlay */}
          <div className="relative flex flex-col sm:flex-row rounded-2xl border-2 shadow-md overflow-hidden group transition-all duration-300 hover:shadow-xl"
            style={{ borderColor: '#bbf7d0', background: 'linear-gradient(135deg, #f0fdf4, #ffffff)' }}>
            <StepBadge num={3} />
            <div className="bg-white/80 p-4 flex flex-col gap-2 flex-1">
              <p className="font-black text-sm leading-snug" style={{ color: '#166534' }}>BƯỚC 3: TÌM KIẾM TRANG ĐÍCH</p>
              <p className="text-gray-500 text-xs leading-relaxed">Tìm kiếm trang đích.</p>
              {/* Dark browser inline for mobile */}
              <div className="mt-2 rounded-xl overflow-hidden shadow-lg border border-zinc-700" style={{ background: '#27272a' }}>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ background: '#18181b' }}>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <span className="text-[8px] text-zinc-400 font-medium ml-1">Traffician Service Landing</span>
                </div>
                <div className="mx-2 mt-1 mb-1.5 bg-zinc-800 rounded px-2 py-1">
                  <span className="text-white font-black text-sm text-center block">traffictot.com</span>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center justify-center sm:w-48" style={{ background: '#dcfce7', minHeight: '140px' }}>
              <img src={campaignImg || '/step3_getcode.png'} alt="Tìm kiếm trang đích" className="h-32 sm:h-full w-auto sm:w-full object-contain p-3" />
            </div>
          </div>

          {/* Step 4 */}
          <div className="relative flex flex-col sm:flex-row rounded-2xl border-2 shadow-md overflow-hidden group transition-all duration-300 hover:shadow-xl"
            style={{ borderColor: '#bbf7d0', background: 'linear-gradient(135deg, #ffffff, #f0fdf4)' }}>
            <StepBadge num={4} />
            <div className="flex-shrink-0 flex items-center justify-center sm:w-40" style={{ background: '#dcfce7', minHeight: '140px' }}>
              <PhoneMockup className="scale-110">
                <div className="p-2 space-y-1.5 flex flex-col items-center justify-center" style={{ minHeight: '90px' }}>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle size={16} className="text-green-600" />
                  </div>
                  <div className="w-full h-1.5 bg-green-100 rounded" />
                  <div className="w-[70%] h-1 bg-gray-100 rounded" />
                  <div className="w-full h-4 bg-green-50 rounded border border-green-200" />
                </div>
              </PhoneMockup>
            </div>
            <div className="bg-white/80 p-4 flex flex-col gap-2 flex-1">
              <p className="font-black text-sm leading-snug" style={{ color: '#166534' }}>BƯỚC 4: NHẬP MÃ XÁC NHẬN</p>
              <p className="text-gray-500 text-xs leading-relaxed">Tìm kiếm nút - Đợi và nhập code</p>
              <input
                type="text"
                placeholder="Nhập mã code tại đây..."
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border-2 border-green-300 text-xs font-bold focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all placeholder:text-green-300"
                style={{ background: '#f0fdf4' }}
                disabled={submitting || (codeResult && codeResult.success)}
              />
              <button
                onClick={handleCodeSubmit}
                disabled={submitting || !codeInput.trim() || (codeResult && codeResult.success)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ background: codeResult?.success ? '#16a34a' : 'linear-gradient(135deg, #f97316, #ea580c)' }}
              >
                {submitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Đang xác nhận...</>
                ) : codeResult?.success ? (
                  <><CheckCircle size={14} /> Đã xác nhận!</>
                ) : (
                  <><CheckCircle size={14} /> Xác Nhận</>
                )}
              </button>
              {codeResult && (
                <div className={`text-[11px] font-bold rounded-lg px-2.5 py-1.5 ${codeResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {codeResult.message}
                </div>
              )}
            </div>
          </div>

          {/* Features mobile 2×2 */}
          <div className="grid grid-cols-2 gap-3">
            <FeatureCard title="CPM CAO NHẤT">
              <BarChartIcon />
            </FeatureCard>
            <FeatureCard title="THỐNG KÊ CHI TIẾT">
              <DashboardIcon />
            </FeatureCard>
            <FeatureCard title={'THANH TOÁN\nMOMO/PAYPAL'}>
              <WalletIcon />
            </FeatureCard>
            <FeatureCard title="TÙY CHỈNH LINK">
              <LinkCustomIcon />
            </FeatureCard>
          </div>

        </div>

        {/* ── Footer Bar ── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-6 shadow-[0_-4px_30px_rgba(0,0,0,0.3)]"
          style={{ background: '#18181b' }}>
          {/* Left: Coin + MoMo */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <img src="/footer_coins.png" alt="Coin" className="h-10 sm:h-14 w-auto object-contain drop-shadow" />
            <img src="/momo_logo.png" alt="Momo" className="h-8 sm:h-11 w-8 sm:w-11 rounded-full object-cover shadow border-2 border-white/30" />
          </div>
          {/* Center text */}
          <p className="flex-1 text-white font-black text-center uppercase text-sm sm:text-xl md:text-2xl tracking-wide leading-snug">
            HƯỚNG DẪN VƯỢT LINK AN TOÀN &amp; HIỆU QUẢ
          </p>
          {/* Right: MoMo + PayPal */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <img src="/momo_logo.png" alt="Momo" className="h-10 sm:h-12 w-10 sm:w-12 rounded-full object-cover shadow border-2 border-white/30" />
            <div className="h-10 sm:h-12 px-3 sm:px-4 rounded-xl flex items-center justify-center shadow-lg" style={{ background: '#fff' }}>
              <span className="font-extrabold text-base sm:text-lg" style={{ color: '#003087' }}>Pay</span>
              <span className="font-extrabold text-base sm:text-lg" style={{ color: '#009cde' }}>Pal</span>
            </div>
          </div>
        </div>

      </div>

      {/* Spacer for footer */}
      <div className="h-32 sm:h-24" />
    </div>
  );
}
