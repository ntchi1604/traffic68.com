import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Rocket, ExternalLink, Search } from 'lucide-react';

const STEPS = [
  { num: 1, title: 'BƯỚC 1:', subtitle: 'MỞ GOOGLE', desc: 'Mở trình duyệt và truy cập trang chủ Google.', img: '/step1_google.png', alt: 'Mở Google', action: 'google' },
  { num: 2, title: 'BƯỚC 2:', subtitle: 'NHẬP TỪ KHÓA TÌM KIẾM', desc: 'Tìm kiếm từ khóa bên dưới trên Google.', img: '/step2_search.png', alt: 'Nhập từ khóa', action: 'keyword' },
  { num: 3, title: 'BƯỚC 3:', subtitle: 'TÌM KIẾM TRANG ĐÍCH', desc: 'Tìm kiếm trang đích', img: '/step3_getcode.png', alt: 'Tìm kiếm trang đích', action: 'campaign_img' },
  { num: 4, title: 'BƯỚC 4:', subtitle: 'NHẬP MÃ XÁC NHẬN', desc: 'Tìm kiếm nút - Đợi và nhập code', img: '/step4_code.png', alt: 'Nhập mã xác nhận' },
];

const FEATURES = [
  { label: 'CPM CAO NHẤT', img: '/feat_cpm.png', alt: 'CPM Cao Nhất' },
  { label: 'THANH TOÁN\nMomo/PayPal', img: '/feat_wallet.png', alt: 'Thanh Toán' },
  { label: 'THỐNG KÊ CHI TIẾT', img: '/feat_dashboard.png', alt: 'Thống Kê' },
  { label: 'TÙY CHỈNH LINK', img: '/feat_link.png', alt: 'Tùy Chỉnh Link' },
];

function StepCard({ num, title, subtitle, desc, img, alt, action, keyword, campaignImg }) {
  return (
    <div className="relative flex flex-col rounded-2xl border-2 shadow-md card-hover" style={{ borderColor: '#166534' }}>
      <div className="absolute top-3 left-3 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#166534' }}>
        <span className="text-white font-black text-base leading-none">{num}</span>
      </div>
      <div className="overflow-hidden rounded-t-[14px] flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7', height: '200px' }}>
        <img src={action === 'campaign_img' && campaignImg ? campaignImg : img} alt={alt} className="w-full h-full object-contain p-3" />
      </div>
      <div className="bg-white rounded-b-[14px] p-4 flex flex-col gap-2 flex-1">
        <p className="font-black text-sm sm:text-base leading-snug" style={{ color: '#166534' }}>
          {title} <span>{subtitle}</span>
        </p>
        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{desc}</p>
        {action === 'google' && (
          <a href="https://www.google.com" target="_blank" rel="noopener noreferrer"
            className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md"
            style={{ background: 'linear-gradient(135deg, #4285F4, #34A853)' }}>
            <ExternalLink size={15} /> Mở Google.com
          </a>
        )}
        {action === 'keyword' && (
          <div className="mt-1 flex items-center gap-2 bg-amber-50 border-2 border-amber-300 rounded-xl p-2.5"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onCopy={e => e.preventDefault()}>
            <Search size={16} className="text-amber-600 flex-shrink-0" />
            <span className="flex-1 font-black text-amber-800 text-sm">{keyword || 'Đang tải...'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VuotLink() {
  usePageTitle('Vượt Link');
  const [glowing, setGlowing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [campaignImg, setCampaignImg] = useState('');

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
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 flex flex-col gap-8">

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase text-center leading-tight tracking-wide" style={{ color: '#166534' }}>
            QUY TRÌNH HOÀN TẤT VƯỢT LINK 4 BƯỚC
          </h2>
          <button
            onMouseEnter={() => setGlowing(true)}
            onMouseLeave={() => setGlowing(false)}
            className="relative flex-shrink-0 flex items-center gap-2 text-white font-black uppercase text-sm px-5 py-2.5 rounded-xl cursor-pointer select-none transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#f97316 0%,#ea580c 100%)',
              boxShadow: glowing ? '0 0 32px 10px rgba(249,115,22,.65),0 4px 18px rgba(249,115,22,.4)' : '0 0 16px 4px rgba(249,115,22,.4)',
            }}>
            <Rocket size={18} /> LẤY MÃ
            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-yellow-300 rounded-full animate-ping opacity-80" />
          </button>
        </div>

        <div className="relative hidden md:block">
          <div className="absolute z-10 pointer-events-none" style={{ bottom: '108px', left: '25%', transform: 'translateX(-50%)', width: '110px' }}>
            <img src="/character_guide.png" alt="Hướng dẫn viên" className="w-full h-auto object-contain drop-shadow-2xl" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {STEPS.map((step) => (<StepCard key={step.num} {...step} keyword={keyword} campaignImg={campaignImg} />))}
          </div>
        </div>

        <div className="flex flex-col gap-5 md:hidden">
          {STEPS.map((step) => (<StepCard key={step.num} {...step} keyword={keyword} campaignImg={campaignImg} />))}
          <div className="flex justify-center">
            <img src="/character_guide.png" alt="Hướng dẫn viên" className="h-44 w-auto object-contain drop-shadow" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ label, img, alt }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 flex flex-col items-center gap-3 shadow-sm card-hover cursor-default">
              <p className="font-black text-center text-xs sm:text-sm uppercase leading-snug whitespace-pre-line" style={{ color: '#166534' }}>{label}</p>
              <div className="flex-1 flex items-center justify-center w-full">
                <img src={img} alt={alt} className="h-16 sm:h-20 w-auto object-contain" />
              </div>
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 shadow-[0_-4px_30px_rgba(0,0,0,0.3)]" style={{ background: '#1e3a8a' }}>
          <div className="flex-shrink-0 flex items-center gap-2">
            <img src="/footer_coins.png" alt="Coin" className="h-14 w-auto object-contain drop-shadow" />
            <img src="/momo_logo.png" alt="Momo" className="h-11 w-11 rounded-full object-cover shadow border-2 border-white/30" />
          </div>
          <p className="flex-1 text-white font-black text-center uppercase text-base sm:text-xl md:text-2xl tracking-wide leading-snug">
            HƯỚNG DẪN VƯỢT LINK AN TOÀN &amp; HIỆU QUẢ
          </p>
          <div className="flex-shrink-0 flex items-center gap-3">
            <img src="/momo_logo.png" alt="Momo" className="h-12 w-12 rounded-full object-cover shadow border-2 border-white/30" />
            <div className="h-12 px-4 rounded-xl flex items-center justify-center shadow-lg" style={{ background: '#fff' }}>
              <span className="font-extrabold text-lg" style={{ color: '#003087' }}>Pay</span>
              <span className="font-extrabold text-lg" style={{ color: '#009cde' }}>Pal</span>
            </div>
          </div>
        </div>

      </div>
      <div className="h-40 sm:h-24" />
    </div>
  );
}
