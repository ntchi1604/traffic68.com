import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Rocket, ExternalLink, Search, CheckCircle, Loader2 } from 'lucide-react';

export default function VuotLink() {
  usePageTitle('Vượt Link');
  const [glowing, setGlowing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [campaignImg, setCampaignImg] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeResult, setCodeResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 md:py-10 flex flex-col gap-6">

        {/* ── Title + Lấy Mã ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase text-center leading-tight tracking-wide" style={{ color: '#166534' }}>
            QUY TRÌNH HOÀN TẤT VƯỢT LINK 4 BƯỚC
          </h2>
          <button
            onMouseEnter={() => setGlowing(true)}
            onMouseLeave={() => setGlowing(false)}
            className="relative flex-shrink-0 flex items-center gap-2 text-white font-black uppercase text-xs sm:text-sm px-4 py-2 rounded-xl cursor-pointer select-none transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#f97316 0%,#ea580c 100%)',
              boxShadow: glowing ? '0 0 32px 10px rgba(249,115,22,.65),0 4px 18px rgba(249,115,22,.4)' : '0 0 16px 4px rgba(249,115,22,.4)',
            }}>
            <Rocket size={16} /> LẤY MÃ
            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-yellow-300 rounded-full animate-ping opacity-80" />
          </button>
        </div>

        {/* ══════ DESKTOP LAYOUT ══════ */}
        <div className="hidden lg:grid gap-4" style={{ gridTemplateColumns: '160px 1fr 160px' }}>

          {/* ── Left Features ── */}
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm flex-1">
              <p className="font-black text-center text-xs uppercase leading-snug" style={{ color: '#166534' }}>CPM CAO NHẤT</p>
              <img src="/feat_cpm.png" alt="CPM Cao Nhất" className="h-20 w-auto object-contain" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm flex-1">
              <p className="font-black text-center text-xs uppercase leading-snug whitespace-pre-line" style={{ color: '#166534' }}>{'THANH TOÁN\nMOMO/PAYPAL'}</p>
              <img src="/feat_wallet.png" alt="Thanh Toán" className="h-20 w-auto object-contain" />
            </div>
          </div>

          {/* ── Center: Steps 2×2 + Character ── */}
          <div className="relative">
            {/* Character guide */}
            <div className="absolute z-10 pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -70%)', width: '100px' }}>
              <img src="/character_guide.png" alt="Hướng dẫn viên" className="w-full h-auto object-contain drop-shadow-2xl" />
            </div>

            <div className="grid grid-cols-2 gap-4">

              {/* ── STEP 1 ── */}
              <div className="relative flex rounded-2xl border-2 shadow-md overflow-hidden" style={{ borderColor: '#166534' }}>
                <div className="absolute top-2 left-2 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#166534' }}>
                  <span className="text-white font-black text-sm leading-none">1</span>
                </div>
                <div className="flex-shrink-0 flex items-center justify-center" style={{ background: '#dcfce7', width: '140px' }}>
                  <img src="/step1_google.png" alt="Mở Google" className="w-full h-full object-contain p-2" />
                </div>
                <div className="bg-white p-3 flex flex-col gap-1.5 flex-1 justify-center">
                  <p className="font-black text-xs leading-snug" style={{ color: '#166534' }}>BƯỚC 1: MỞ GOOGLE</p>
                  <p className="text-gray-600 text-[11px] leading-relaxed">Mở trình duyệt và truy cập trang chủ Google.</p>
                  <a href="https://www.google.com" target="_blank" rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md w-fit"
                    style={{ background: 'linear-gradient(135deg, #4285F4, #34A853)' }}>
                    <ExternalLink size={12} /> Mở Google.com
                  </a>
                </div>
              </div>

              {/* ── STEP 2 ── */}
              <div className="relative flex rounded-2xl border-2 shadow-md overflow-hidden" style={{ borderColor: '#166534' }}>
                <div className="absolute top-2 left-2 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#166534' }}>
                  <span className="text-white font-black text-sm leading-none">2</span>
                </div>
                <div className="bg-white p-3 flex flex-col gap-1.5 flex-1 justify-center">
                  <p className="font-black text-xs leading-snug" style={{ color: '#166534' }}>BƯỚC 2: NHẬP TỪ KHÓA TÌM KIẾM</p>
                  <p className="text-gray-600 text-[11px] leading-relaxed">Tìm kiếm từ khóa bên dưới trên Google.</p>
                  <div className="mt-0.5 flex items-center gap-1.5 bg-amber-50 border-2 border-amber-300 rounded-lg p-1.5"
                    style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onCopy={e => e.preventDefault()}>
                    <Search size={13} className="text-amber-600 flex-shrink-0" />
                    <span className="flex-1 font-black text-amber-800 text-[11px]">{keyword || 'Đang tải...'}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center justify-center" style={{ background: '#dcfce7', width: '140px' }}>
                  <img src="/step2_search.png" alt="Nhập từ khóa" className="w-full h-full object-contain p-2" />
                </div>
              </div>

              {/* ── STEP 3 ── */}
              <div className="relative flex rounded-2xl border-2 shadow-md overflow-hidden" style={{ borderColor: '#166534' }}>
                <div className="absolute top-2 left-2 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#166534' }}>
                  <span className="text-white font-black text-sm leading-none">3</span>
                </div>
                <div className="bg-white p-3 flex flex-col gap-1.5 flex-1 justify-center">
                  <p className="font-black text-xs leading-snug" style={{ color: '#166534' }}>BƯỚC 3: TÌM KIẾM TRANG ĐÍCH</p>
                  <p className="text-gray-600 text-[11px] leading-relaxed">Tìm kiếm trang đích.</p>
                </div>
                <div className="flex-shrink-0 flex items-center justify-center" style={{ background: '#dcfce7', width: '180px' }}>
                  <img src={campaignImg || '/step3_getcode.png'} alt="Tìm kiếm trang đích" className="w-full h-full object-contain p-2" />
                </div>
              </div>

              {/* ── STEP 4 ── */}
              <div className="relative flex rounded-2xl border-2 shadow-md overflow-hidden" style={{ borderColor: '#166534' }}>
                <div className="absolute top-2 left-2 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#166534' }}>
                  <span className="text-white font-black text-sm leading-none">4</span>
                </div>
                <div className="flex-shrink-0 flex items-center justify-center" style={{ background: '#dcfce7', width: '130px' }}>
                  <img src="/step4_code.png" alt="Nhập mã xác nhận" className="w-full h-full object-contain p-2" />
                </div>
                <div className="bg-white p-3 flex flex-col gap-1.5 flex-1 justify-center">
                  <p className="font-black text-xs leading-snug" style={{ color: '#166534' }}>BƯỚC 4: NHẬP MÃ XÁC NHẬN</p>
                  <p className="text-gray-600 text-[11px] leading-relaxed">Tìm kiếm nút - Đợi và nhập code</p>
                  <input
                    type="text"
                    placeholder="Nhập mã code tại đây..."
                    value={codeInput}
                    onChange={e => setCodeInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border-2 border-green-300 text-[11px] font-bold focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
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
          </div>

          {/* ── Right Features ── */}
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm flex-1">
              <p className="font-black text-center text-xs uppercase leading-snug" style={{ color: '#166534' }}>THỐNG KÊ CHI TIẾT</p>
              <img src="/feat_dashboard.png" alt="Thống Kê" className="h-20 w-auto object-contain" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm flex-1">
              <p className="font-black text-center text-xs uppercase leading-snug" style={{ color: '#166534' }}>TÙY CHỈNH LINK</p>
              <img src="/feat_link.png" alt="Tùy Chỉnh Link" className="h-20 w-auto object-contain" />
            </div>
          </div>

        </div>

        {/* ══════ MOBILE / TABLET LAYOUT ══════ */}
        <div className="flex flex-col gap-4 lg:hidden">

          {/* Step 1 */}
          <div className="relative flex flex-col sm:flex-row rounded-2xl border-2 shadow-md overflow-hidden" style={{ borderColor: '#166534' }}>
            <div className="absolute top-2 left-2 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#166534' }}>
              <span className="text-white font-black text-base leading-none">1</span>
            </div>
            <div className="flex-shrink-0 flex items-center justify-center sm:w-40" style={{ background: '#dcfce7', minHeight: '140px' }}>
              <img src="/step1_google.png" alt="Mở Google" className="h-32 sm:h-full w-auto sm:w-full object-contain p-3" />
            </div>
            <div className="bg-white p-4 flex flex-col gap-2 flex-1">
              <p className="font-black text-sm leading-snug" style={{ color: '#166534' }}>BƯỚC 1: MỞ GOOGLE</p>
              <p className="text-gray-600 text-xs leading-relaxed">Mở trình duyệt và truy cập trang chủ Google.</p>
              <a href="https://www.google.com" target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md w-fit"
                style={{ background: 'linear-gradient(135deg, #4285F4, #34A853)' }}>
                <ExternalLink size={14} /> Mở Google.com
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col sm:flex-row rounded-2xl border-2 shadow-md overflow-hidden" style={{ borderColor: '#166534' }}>
            <div className="absolute top-2 left-2 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#166534' }}>
              <span className="text-white font-black text-base leading-none">2</span>
            </div>
            <div className="bg-white p-4 flex flex-col gap-2 flex-1 order-2 sm:order-1">
              <p className="font-black text-sm leading-snug" style={{ color: '#166534' }}>BƯỚC 2: NHẬP TỪ KHÓA TÌM KIẾM</p>
              <p className="text-gray-600 text-xs leading-relaxed">Tìm kiếm từ khóa bên dưới trên Google.</p>
              <div className="mt-1 flex items-center gap-2 bg-amber-50 border-2 border-amber-300 rounded-xl p-2"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onCopy={e => e.preventDefault()}>
                <Search size={14} className="text-amber-600 flex-shrink-0" />
                <span className="flex-1 font-black text-amber-800 text-xs">{keyword || 'Đang tải...'}</span>
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center justify-center sm:w-40 order-1 sm:order-2" style={{ background: '#dcfce7', minHeight: '140px' }}>
              <img src="/step2_search.png" alt="Nhập từ khóa" className="h-32 sm:h-full w-auto sm:w-full object-contain p-3" />
            </div>
          </div>

          {/* Character guide mobile */}
          <div className="flex justify-center">
            <img src="/character_guide.png" alt="Hướng dẫn viên" className="h-32 w-auto object-contain drop-shadow" />
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col sm:flex-row rounded-2xl border-2 shadow-md overflow-hidden" style={{ borderColor: '#166534' }}>
            <div className="absolute top-2 left-2 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#166534' }}>
              <span className="text-white font-black text-base leading-none">3</span>
            </div>
            <div className="bg-white p-4 flex flex-col gap-2 flex-1">
              <p className="font-black text-sm leading-snug" style={{ color: '#166534' }}>BƯỚC 3: TÌM KIẾM TRANG ĐÍCH</p>
              <p className="text-gray-600 text-xs leading-relaxed">Tìm kiếm trang đích.</p>
            </div>
            <div className="flex-shrink-0 flex items-center justify-center sm:w-48" style={{ background: '#dcfce7', minHeight: '140px' }}>
              <img src={campaignImg || '/step3_getcode.png'} alt="Tìm kiếm trang đích" className="h-32 sm:h-full w-auto sm:w-full object-contain p-3" />
            </div>
          </div>

          {/* Step 4 */}
          <div className="relative flex flex-col sm:flex-row rounded-2xl border-2 shadow-md overflow-hidden" style={{ borderColor: '#166534' }}>
            <div className="absolute top-2 left-2 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#166534' }}>
              <span className="text-white font-black text-base leading-none">4</span>
            </div>
            <div className="flex-shrink-0 flex items-center justify-center sm:w-40" style={{ background: '#dcfce7', minHeight: '140px' }}>
              <img src="/step4_code.png" alt="Nhập mã xác nhận" className="h-32 sm:h-full w-auto sm:w-full object-contain p-3" />
            </div>
            <div className="bg-white p-4 flex flex-col gap-2 flex-1">
              <p className="font-black text-sm leading-snug" style={{ color: '#166534' }}>BƯỚC 4: NHẬP MÃ XÁC NHẬN</p>
              <p className="text-gray-600 text-xs leading-relaxed">Tìm kiếm nút - Đợi và nhập code</p>
              <input
                type="text"
                placeholder="Nhập mã code tại đây..."
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border-2 border-green-300 text-xs font-bold focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
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

          {/* Features mobile 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm">
              <p className="font-black text-center text-xs uppercase leading-snug" style={{ color: '#166534' }}>CPM CAO NHẤT</p>
              <img src="/feat_cpm.png" alt="CPM Cao Nhất" className="h-16 w-auto object-contain" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm">
              <p className="font-black text-center text-xs uppercase leading-snug" style={{ color: '#166534' }}>THỐNG KÊ CHI TIẾT</p>
              <img src="/feat_dashboard.png" alt="Thống Kê" className="h-16 w-auto object-contain" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm">
              <p className="font-black text-center text-xs uppercase leading-snug whitespace-pre-line" style={{ color: '#166534' }}>{'THANH TOÁN\nMOMO/PAYPAL'}</p>
              <img src="/feat_wallet.png" alt="Thanh Toán" className="h-16 w-auto object-contain" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm">
              <p className="font-black text-center text-xs uppercase leading-snug" style={{ color: '#166534' }}>TÙY CHỈNH LINK</p>
              <img src="/feat_link.png" alt="Tùy Chỉnh Link" className="h-16 w-auto object-contain" />
            </div>
          </div>

        </div>

        {/* ── Footer Bar ── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-6 shadow-[0_-4px_30px_rgba(0,0,0,0.3)]" style={{ background: '#1e3a8a' }}>
          <div className="flex-shrink-0 flex items-center gap-2">
            <img src="/footer_coins.png" alt="Coin" className="h-10 sm:h-14 w-auto object-contain drop-shadow" />
            <img src="/momo_logo.png" alt="Momo" className="h-8 sm:h-11 w-8 sm:w-11 rounded-full object-cover shadow border-2 border-white/30" />
          </div>
          <p className="flex-1 text-white font-black text-center uppercase text-sm sm:text-xl md:text-2xl tracking-wide leading-snug">
            HƯỚNG DẪN VƯỢT LINK AN TOÀN &amp; HIỆU QUẢ
          </p>
          <div className="flex-shrink-0 flex items-center gap-3">
            <img src="/momo_logo.png" alt="Momo" className="h-10 sm:h-12 w-10 sm:w-12 rounded-full object-cover shadow border-2 border-white/30" />
            <div className="h-10 sm:h-12 px-3 sm:px-4 rounded-xl flex items-center justify-center shadow-lg" style={{ background: '#fff' }}>
              <span className="font-extrabold text-base sm:text-lg" style={{ color: '#003087' }}>Pay</span>
              <span className="font-extrabold text-base sm:text-lg" style={{ color: '#009cde' }}>Pal</span>
            </div>
          </div>
        </div>

      </div>
      <div className="h-32 sm:h-24" />
    </div>
  );
}
