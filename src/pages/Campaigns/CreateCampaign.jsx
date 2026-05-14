import { useState, useRef, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Info, Upload, X, Tag, Globe, Monitor, Smartphone,
  BarChart2, Wallet, Gift, Star, CheckCircle2, AlertCircle, Plus, Trash2,
  Zap, MousePointerClick, Sparkles, ArrowRight, CreditCard,
  Search, Link2, Share2, RefreshCw
} from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import Breadcrumb from '../../components/Breadcrumb';

/* ─── Static data ───────────────Tổng view (không sửa)────────────────────────────── */
const TRAFFIC_TYPES = [
  { value: 'google_search', label: 'Google Search', icon: Search, desc: 'Traffic từ kết quả tìm kiếm Google', iconBg: 'bg-blue-50', iconColor: 'text-indigo-600', activeBg: 'bg-blue-50/80', activeBorder: 'border-indigo-500', activeText: 'text-indigo-700' },
  { value: 'direct', label: 'Direct / Redirect', icon: Link2, desc: 'Traffic trực tiếp hoặc redirect URL', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', activeBg: 'bg-violet-50/80', activeBorder: 'border-violet-500', activeText: 'text-violet-700' },
  { value: 'social', label: 'Social', icon: Share2, desc: 'Traffic từ mạng xã hội (Facebook, TikTok…)', iconBg: 'bg-pink-50', iconColor: 'text-pink-600', activeBg: 'bg-pink-50/80', activeBorder: 'border-pink-500', activeText: 'text-pink-700' },
];

const DURATIONS = [
  { value: '', label: 'Chọn thời gian' },
  { value: '60', label: 'Gói 60s' },
  { value: '90', label: 'Gói 90s' },
  { value: '120', label: 'Gói 120s' },
  { value: '150', label: 'Gói 150s' },
  { value: '200', label: 'Gói 200s' },
];

const DEVICES = [
  { value: 'desktop', label: 'Desktop', icon: Monitor, desc: 'PC, Laptop' },
  { value: 'mobile', label: 'Mobile', icon: Smartphone, desc: 'Điện thoại, Tablet' },
];

/* ─── Form primitives ───────────────────────────────────────── */
function Label({ children, required, hint }) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 text-xs">*</span>}
      {hint && (
        <span className="group relative cursor-help">
          <Info size={13} className="text-slate-400 hover:text-slate-600 transition-colors" />
          <span className="absolute left-5 top-0 z-50 hidden group-hover:block w-56 p-2.5 bg-slate-900 text-white text-xs rounded-xl shadow-2xl leading-relaxed">
            {hint}
          </span>
        </span>
      )}
    </label>
  );
}

function Hint({ children }) {
  return <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{children}</p>;
}

function TextInput({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                  placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30
                  focus:border-indigo-400 transition-all shadow-sm hover:border-slate-300 ${className}`}
      {...props}
    />
  );
}

function SelectInput({ children, ...props }) {
  return (
    <select
      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400
                 transition-all appearance-none cursor-pointer shadow-sm hover:border-slate-300"
      {...props}
    >
      {children}
    </select>
  );
}

function NumberInput({ suffix, ...props }) {
  return (
    <div className="relative">
      <input
        type="number"
        min="0"
        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                   placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30
                   focus:border-indigo-400 transition-all pr-20 shadow-sm hover:border-slate-300"
        {...props}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none bg-slate-50 px-1.5 py-0.5 rounded-md">
          {suffix}
        </span>
      )}
    </div>
  );
}

/* ─── Section card wrapper ──────────────────────────────────── */
function SectionCard({ icon: Icon, iconBg, iconColor, title, badge, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon size={15} className={iconColor} />
          </div>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        </div>
        {badge && (
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
            {badge}
          </span>
        )}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

/* ─── Version card ──────────────────────────────────────────── */
function VersionCard({ value, selected, onSelect, badge, title, desc }) {
  return (
    <div
      onClick={() => onSelect(value)}
      className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${selected
          ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
          : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
        }`}
    >
      {badge && (
        <span className="absolute -top-2.5 left-3 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
          <Star size={9} fill="white" /> {badge}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
          }`}>
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        <div>
          <p className={`text-sm font-bold mb-1 ${selected ? 'text-indigo-700' : 'text-slate-700'}`}>{title}</p>
          <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Toggle switch ─────────────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 rounded-full border-2 border-transparent cursor-pointer
                  transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${checked ? 'bg-indigo-600' : 'bg-slate-200'
        }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'
          }`}
      />
    </button>
  );
}

/* ─── Summary row ───────────────────────────────────────────── */
function SummaryRow({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-semibold text-right max-w-[55%] break-words ${accent ? 'text-emerald-600' : 'text-slate-800'}`}>
        {value || <span className="text-slate-300 font-normal">—</span>}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════════════════ */
export default function CreateCampaign() {
  usePageTitle('Tạo chiến dịch mới');
  const navigate = useNavigate();
  const toast = useToast();
  const [walletBalance, setWalletBalance] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadingIdx, setUploadingIdx] = useState(-1);

  const [pricingTiers, setPricingTiers] = useState([]);
  const [pricingConfig, setPricingConfig] = useState({});
  const [discountApplied, setDiscountApplied] = useState(false);

  useEffect(() => {
    api.get('/finance').then(data => {
      setWalletBalance(data.wallets?.main?.balance || 0);
    }).catch(() => { });
    fetch('/api/pricing?domain=' + window.location.hostname).then(r => r.json()).then(data => {
      setPricingTiers(data.tiers || []);
      if (data.config) setPricingConfig(data.config);
    }).catch(() => { });
  }, []);

  const [form, setForm] = useState({
    campaignName: '',
    trafficType: '',
    version: 'v1',
    duration: '',
    totalViews: 1000,
    directDailyViews: 0,
    viewByHour: false,
    useKeywordViews: false,       // per-keyword daily_views limit toggle
    keywords: [{ keyword: '', views: 1000, daily_views: 0, urls: [''], images: [''], device: 'both', mobilePct: 50 }],
    urls: [''],
    imageUrls: [''],
    discountCode: '',
    note: '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  /* ── Keyword helpers ── */
  const addKeyword = () => setForm(f => ({
    ...f,
    keywords: [...f.keywords, {
      keyword: '', urls: [''], images: [''], daily_views: 0,
      views: f.keywords[0]?.views || 1000,
      device: 'both', mobilePct: 50,
    }],
  }));
  const removeKeyword = (idx) => setForm(f => ({ ...f, keywords: f.keywords.filter((_, i) => i !== idx) }));
  const updateKeywordText = (idx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === idx ? { ...k, keyword: val } : k),
  }));
  const updateKeywordUrlItem = (kwIdx, urlIdx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => {
      if (i !== kwIdx) return k;
      const newUrls = [...(k.urls || [''])];
      newUrls[urlIdx] = val;
      return { ...k, urls: newUrls };
    }),
  }));
  const addKeywordUrl = (kwIdx) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === kwIdx ? { ...k, urls: [...(k.urls || ['']), ''] } : k),
  }));
  const removeKeywordUrl = (kwIdx, urlIdx) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => {
      if (i !== kwIdx) return k;
      return { ...k, urls: (k.urls || ['']).filter((_, j) => j !== urlIdx) };
    }),
  }));
  const updateKeywordImage = (kwIdx, imgIdx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => {
      if (i !== kwIdx) return k;
      const newImages = [...k.images];
      newImages[imgIdx] = val;
      return { ...k, images: newImages };
    }),
  }));
  const addKeywordImage = (kwIdx) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === kwIdx ? { ...k, images: [...k.images, ''] } : k),
  }));
  const removeKeywordImage = (kwIdx, imgIdx) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => {
      if (i !== kwIdx) return k;
      return { ...k, images: k.images.filter((_, j) => j !== imgIdx) };
    }),
  }));
  const updateKeywordViews = (idx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === idx ? { ...k, views: Number(val) || 0 } : k),
  }));
  const updateKeywordDailyViews = (idx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === idx ? { ...k, daily_views: Number(val) || 0 } : k),
  }));

  const toggleKeywordViews = () => setForm(f => {
    const next = !f.useKeywordViews;
    return { ...f, useKeywordViews: next, keywords: f.keywords.map(k => ({ ...k, daily_views: 0 })) };
  });

  const updateKeywordDevice = (idx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === idx ? { ...k, device: val } : k),
  }));
  const updateKeywordMobilePct = (idx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === idx ? { ...k, mobilePct: Math.min(100, Math.max(0, Number(val) || 0)) } : k),
  }));



  /* ── URL / image helpers ── */
  const addArrayItem = (key) => setForm(f => ({ ...f, [key]: [...f[key], ''] }));
  const removeArrayItem = (key, idx) => setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));
  const updateArrayItem = (key, idx, val) => setForm(f => ({ ...f, [key]: f[key].map((v, i) => i === idx ? val : v) }));

  /* ── Computed totals ── */
  // Total views always computed from keyword views sum
  const computedTotalViews = form.keywords.reduce((s, k) => s + (Number(k.views) || 0), 0);
  const keywordTotalViews = computedTotalViews;
  const allocatedDailyViews = form.useKeywordViews
    ? form.keywords.reduce((s, k) => s + (Number(k.daily_views) || 0), 0)
    : 0;
  const remainingDailyViews = Math.max(0, computedTotalViews - allocatedDailyViews);

  const adminDiscountEnabled = pricingConfig.discount_enabled === 'true';
  const applyDiscount = () => {
    if (!form.discountCode.trim()) return;
    if (form.discountCode.trim().toUpperCase() === (pricingConfig.discount_code || '').toUpperCase()) {
      setDiscountApplied(true);
    } else {
      setDiscountApplied(false);
      setError('Mã giảm giá không hợp lệ!');
      setTimeout(() => setError(''), 3000);
    }
  };

  const findTier = () => {
    const durSec = form.duration ? form.duration + 's' : '';
    return pricingTiers.find(t => t.traffic_type === form.trafficType && t.duration === durSec) || null;
  };

  const tier = findTier();
  const hasPricing = !!(form.trafficType && form.duration && tier);
  const pricePerView = (() => {
    if (!tier) return 0;
    if (discountApplied) return form.version === 'v1' ? tier.v1_discount : tier.v2_discount;
    return form.version === 'v1' ? tier.v1_price : tier.v2_price;
  })();
  const effectiveTotalViews = (form.trafficType === 'direct') ? (Number(form.totalViews) || 0) : keywordTotalViews;
  const totalPrice = hasPricing ? Math.round(effectiveTotalViews * pricePerView) : 0;
  const budgetOk = totalPrice <= walletBalance;

  const handleImageUpload = async (e, idx) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingIdx(idx);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/campaigns/upload-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      updateArrayItem('imageUrls', idx, data.imageUrl);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingIdx(-1);
    }
  };

  const [uploadingKwIdx, setUploadingKwIdx] = useState(-1);
  const [uploadingKwImgIdx, setUploadingKwImgIdx] = useState(-1);
  const handleKeywordImageUpload = async (e, kwIdx, imgIdx) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingKwIdx(kwIdx);
    setUploadingKwImgIdx(imgIdx);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/campaigns/upload-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      updateKeywordImage(kwIdx, imgIdx, data.imageUrl);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingKwIdx(-1);
      setUploadingKwImgIdx(-1);
    }
  };

  const isDirect = form.trafficType === 'direct';
  const isSocial = form.trafficType === 'social';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validGlobalUrl = form.urls[0]?.trim();

    if (isDirect) {
      // Direct traffic: chỉ cần tên, loại, thời gian, URL
      if (!form.campaignName || !form.trafficType || !form.duration || !validGlobalUrl) {
        setError('Vui lòng điền đầy đủ Tên chiến dịch, Thời gian và URL đích.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setError('');
      setSubmitting(true);
      try {
        const directTotalViews = Number(form.totalViews) || 1000;
        const directUrls = form.urls.filter(u => u && u.trim());
        const firstKw = form.keywords[0] || {};
        const kwDevice = firstKw.device || 'both';
        const kwMobilePct = firstKw.mobilePct ?? 50;
        const deviceStr = kwDevice === 'mobile' ? 'mobile' : kwDevice === 'desktop' ? 'desktop' : 'desktop,mobile';
        await api.post('/campaigns', {
          name: form.campaignName,
          url: validGlobalUrl,
          url2: JSON.stringify(directUrls.slice(1)),
          traffic_type: 'direct',
          keyword: JSON.stringify([validGlobalUrl]),
          keyword_config: JSON.stringify([{ keyword: validGlobalUrl, views: directTotalViews, daily_views: Number(form.directDailyViews) || 0, url: validGlobalUrl, image: '', device: kwDevice, mobilePct: kwMobilePct }]),
          total_views: directTotalViews,
          daily_views: Number(form.directDailyViews) || 0,
          view_by_hour: form.viewByHour ? 1 : 0,
          duration: Number(form.duration),
          version: form.version,
          discount_applied: discountApplied,
          discount_code: discountApplied ? form.discountCode.trim() : '',
          cpc: pricePerView,
          budget: totalPrice,
          device: deviceStr,
          country: 'VN',
          image1_url: '',
          image2_url: '',
          note: form.note,
        });
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        setError(err.message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Non-direct: Google Search / Social cần từ khóa
    const validKeywords = form.keywords.filter(k => k.keyword.trim());
    const extractedUrls = validKeywords.flatMap(k => (k.urls || []).filter(u => u && u.trim()));

    if (!form.campaignName || !form.trafficType || !form.duration || validKeywords.length === 0) {
      setError('Vui lòng điền đầy đủ Tên, Loại traffic, Thời gian và ít nhất 1 từ khoá.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      // Collect all images from all keywords
      const allKeywordImages = validKeywords.flatMap(k =>
        (k.images || []).filter(img => img && img.trim())
      );
      const globalImage = form.imageUrls[0]?.trim();
      const allImages = globalImage ? [globalImage, ...allKeywordImages] : allKeywordImages;

      // Build keyword_config — views = views riêng của từng keyword (không dùng total)
      const keywordConfig = validKeywords.map(k => ({
        keyword: k.keyword,
        views: Number(k.views) || 0,
        daily_views: Number(k.daily_views) || 0,
        url: (k.urls || []).find(u => u && u.trim()) || '',
        urls: (k.urls || []).filter(u => u && u.trim()),
        images: (k.images || []).filter(img => img && img.trim()),
        device: k.device || 'both',
        mobilePct: k.mobilePct ?? 50,
      }));

      // tổng daily = sum keyword daily; nếu tất cả = 0 thì dùng form.dailyViews (tính trong allocatedDailyViews)
      const kwDailySum = keywordConfig.reduce((s, k) => s + (Number(k.daily_views) || 0), 0);
      const finalDailyViews = kwDailySum > 0 ? kwDailySum : allocatedDailyViews;

      await api.post('/campaigns', {
        name: form.campaignName,
        url: extractedUrls[0] || form.urls[0]?.trim() || '',
        url2: JSON.stringify([]),
        traffic_type: form.trafficType,
        keyword: JSON.stringify(validKeywords.map(k => k.keyword)),
        keyword_config: JSON.stringify(keywordConfig),
        total_views: computedTotalViews,
        daily_views: finalDailyViews,
        view_by_hour: form.viewByHour ? 1 : 0,
        duration: Number(form.duration),
        version: form.version,
        discount_applied: discountApplied,
        discount_code: discountApplied ? form.discountCode.trim() : '',
        cpc: pricePerView,
        budget: totalPrice,
        device: 'desktop,mobile',
        country: 'VN',
        image1_url: allImages.length > 0 ? JSON.stringify(allImages) : '',
        image2_url: '',
        note: form.note,
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 w-full min-w-0 pb-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/buyer/dashboard' },
        { label: 'Chiến dịch', to: '/buyer/dashboard/campaigns' },
        { label: 'Tạo chiến dịch mới' },
      ]} />

      {/* Wallet balance pill */}
      <div className="flex justify-end">
        <div className="flex items-center gap-2.5 bg-white border border-indigo-100 rounded-2xl px-4 py-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Wallet size={15} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Ví Traffic</p>
            <p className="text-sm font-black text-indigo-700 tabular-nums">{fmt(walletBalance)} <span className="text-xs font-semibold text-slate-400">đ</span></p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/buyer/dashboard/finance/deposit')}
            className="ml-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
          >
            + Nạp
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {submitted && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-4 rounded-2xl text-sm font-semibold shadow-sm">
          <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
          <div>
            <p className="font-bold">Chiến dịch đã được tạo thành công!</p>
            <p className="text-xs text-emerald-600 font-normal mt-0.5">Chúng tôi sẽ bắt đầu xử lý trong vòng 24 giờ.</p>
          </div>
          <button
            onClick={() => navigate('/buyer/dashboard/campaigns')}
            className="ml-auto flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition-colors"
          >
            Xem chiến dịch <ArrowRight size={12} />
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl text-sm shadow-sm">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="font-semibold">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* ══ LEFT: Main form ════════════════════════════════════════ */}
          <div className="xl:col-span-2 space-y-5">

            {/* ── 1. Thông tin cơ bản ── */}
            <SectionCard icon={BarChart2} iconBg="bg-indigo-50" iconColor="text-indigo-600" title="Thông tin cơ bản" badge="Bắt buộc">
              {/* Campaign name */}
              <div>
                <Label required hint="Đặt tên để dễ nhận biết và quản lý chiến dịch">Tên chiến dịch</Label>
                <TextInput
                  type="text"
                  value={form.campaignName}
                  onChange={e => set('campaignName', e.target.value)}
                  placeholder="VD: SEO traffic68.com – tháng 4"
                />
              </div>

              {/* Traffic type */}
              <div>
                <Label required hint="Mỗi loại traffic có mức giá và hành vi khác nhau">Loại traffic</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TRAFFIC_TYPES.map(t => {
                    const Icon = t.icon;
                    const active = form.trafficType === t.value;
                    return (
                      <div
                        key={t.value}
                        onClick={() => set('trafficType', t.value)}
                        className={`relative flex flex-col gap-2.5 border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${active
                            ? `${t.activeBorder} ${t.activeBg} shadow-md`
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${active ? t.iconBg : 'bg-slate-100'
                            }`}>
                            <Icon size={17} className={active ? t.iconColor : 'text-slate-400'} />
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${active ? `${t.activeBorder.replace('border-', 'border-')} bg-current` : 'border-slate-300 bg-white'
                            }`} style={active ? { backgroundColor: 'currentColor' } : {}}>
                            {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <div>
                          <p className={`text-sm font-bold leading-tight ${active ? t.activeText : 'text-slate-700'
                            }`}>{t.label}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{t.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Version */}
              <div>
                <Label required hint="Version khác nhau ảnh hưởng đến chất lượng tín hiệu và giá">Version</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <VersionCard
                    value="v1" selected={form.version === 'v1'} onSelect={v => set('version', v)}
                    badge="Tốt nhất" title="Version 1"
                    desc="(2 bước) Chờ X thời gian → click link nội bộ → chờ thêm 25–35 giây. Tín hiệu tự nhiên hơn."
                  />
                  <VersionCard
                    value="v2" selected={form.version === 'v2'} onSelect={v => set('version', v)}
                    title="Version 2"
                    desc="(1 bước) Chờ X thời gian hết là xong. Đơn giản, giá thấp hơn."
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <Label required hint="Thời gian ở lại trang — dài hơn giá cao hơn nhưng tín hiệu tốt hơn">Thời gian (Duration)</Label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.filter(d => d.value).map(d => (
                    <button
                      key={d.value} type="button"
                      onClick={() => set('duration', d.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all duration-150 ${form.duration === d.value
                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-200'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <Hint>Thời gian dài → SEO tín hiệu tốt hơn. Giá sẽ hiển thị sau khi chọn loại traffic.</Hint>
              </div>



            </SectionCard>

            {/* ── 2. URL đích (Direct) hoặc Từ khóa & URL ── */}
            {isDirect ? (
              /* ── Direct: URL đích + View/ngày ── */
              <SectionCard icon={Link2} iconBg="bg-violet-50" iconColor="text-violet-600" title="URL đích & Lượt xem" badge="Direct">

                {/* Header — giống search: label ở trái, toggle ở phải */}
                <div className="flex items-center justify-between mb-2">
                  <Label required>URL đích</Label>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold transition-colors ${form.directDailyViews > 0 ? 'text-sky-600' : 'text-slate-400'}`}>
                      Cài view/ngày
                    </span>
                    <Toggle
                      checked={form.directDailyViews > 0}
                      onChange={() => set('directDailyViews', form.directDailyViews > 0 ? 0 : 1000)}
                    />
                  </div>
                </div>

                {/* Row — giống keyword row: URL + amber views + sky daily */}
                <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex gap-2 items-center">
                    <TextInput
                      placeholder="https://example.com"
                      value={form.urls[0]}
                      onChange={e => updateArrayItem('urls', 0, e.target.value)}
                      className="flex-1"
                    />

                    {/* Tổng view — amber như keyword views */}
                    <div className="relative w-28 flex-shrink-0">
                      <input
                        type="number" min="1"
                        value={form.totalViews}
                        onChange={e => set('totalViews', Number(e.target.value) || 1)}
                        className="w-full px-2 py-2.5 text-sm border-2 border-amber-300 rounded-xl bg-amber-50
                                   focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500
                                   transition pr-10 font-black text-amber-900 text-right"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 font-bold pointer-events-none">view</span>
                    </div>

                    {/* View/ngày — sky như keyword daily */}
                    {form.directDailyViews > 0 && (
                      <div className="relative w-28 flex-shrink-0">
                        <input
                          type="number" min="1"
                          value={form.directDailyViews}
                          onChange={e => set('directDailyViews', Number(e.target.value) || 1)}
                          className="w-full px-2 py-2.5 text-sm border-2 border-sky-300 rounded-xl bg-sky-50
                                     focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-500
                                     transition pr-12 font-black text-sky-900 text-right"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sky-500 font-bold pointer-events-none">/ngày</span>
                      </div>
                    )}
                  </div>

                  {/* URL đích riêng — thêm/xóa giống image */}
                  {form.urls.slice(1).map((u, idx) => (
                    <div key={idx + 1} className="flex gap-2 items-center">
                      <TextInput
                        placeholder={`URL đích ${idx + 2}`}
                        value={u}
                        onChange={e => updateArrayItem('urls', idx + 1, e.target.value)}
                        className="flex-1 text-xs"
                      />
                      <button type="button" onClick={() => removeArrayItem('urls', idx + 1)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addArrayItem('urls')}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 mt-1">
                    <Plus size={14} /> Thêm URL đích
                  </button>
                </div>

                {/* Device targeting cho Direct */}
                <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
                  <p className="text-xs font-bold text-teal-700 mb-2">📱 Thiết bị & Tỷ lệ Mobi/PC</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {[
                      { value: 'both', label: 'Cả hai' },
                      { value: 'desktop', label: '🖥️ Desktop' },
                      { value: 'mobile', label: '📱 Mobile' },
                    ].map(d => {
                      const kw0 = form.keywords[0] || {};
                      const active = (kw0.device || 'both') === d.value;
                      return (
                        <button key={d.value} type="button"
                          onClick={() => updateKeywordDevice(0, d.value)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl border-2 transition-all ${active
                            ? 'border-teal-500 bg-teal-100 text-teal-800 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'}`}>
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  {(form.keywords[0]?.device === 'both' || !form.keywords[0]?.device) && (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-teal-700 whitespace-nowrap">Mobile</span>
                      <input
                        type="range" min="0" max="100" step="5"
                        value={form.keywords[0]?.mobilePct ?? 50}
                        onChange={e => updateKeywordMobilePct(0, e.target.value)}
                        className="flex-1 accent-teal-600 h-1.5"
                      />
                      <span className="text-[11px] font-bold text-teal-700 whitespace-nowrap">PC</span>
                      <span className="text-xs font-black text-teal-800 bg-white border border-teal-200 px-2 py-0.5 rounded-lg tabular-nums min-w-[70px] text-center">
                        {form.keywords[0]?.mobilePct ?? 50}% / {100 - (form.keywords[0]?.mobilePct ?? 50)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Tổng view summary — amber box giống bên search */}
                <div className="mt-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <span className="text-xs font-bold text-amber-700">Tổng view</span>
                  <span className="text-sm font-black text-amber-900 tabular-nums">
                    {Number(form.totalViews).toLocaleString()}
                    <span className="text-[10px] font-semibold text-amber-500 ml-1">view</span>
                  </span>
                </div>

              </SectionCard>

            ) : (
              /* ── Google Search / Social: cần từ khóa & URL ── */
              <SectionCard icon={Globe} iconBg="bg-amber-50" iconColor="text-amber-600" title="Từ khóa & Địa chỉ web">

                {/* Keywords */}
                <div>
                  {/* Header with only 1 toggle: Cài view/ngày */}
                  <div className="flex items-center justify-between mb-2">
                    <Label required>{isSocial ? 'URL Social' : 'Từ khóa tìm kiếm'}</Label>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold transition-colors ${form.useKeywordViews ? 'text-sky-600' : 'text-slate-400'}`}>
                        Cài view/ngày riêng
                      </span>
                      <Toggle checked={form.useKeywordViews} onChange={toggleKeywordViews} />
                    </div>
                  </div>

                  {/* Info box — chỉ hiện khi bật useKeywordViews */}
                  {form.useKeywordViews && (
                    <div className="mb-3 flex items-start gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2.5">
                      <BarChart2 size={13} className="text-sky-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-sky-700">
                        <strong>Giới hạn view/ngày cho từng từ khóa.</strong> Từ khóa để <b>0</b> tự nhận phần còn lại
                        ({remainingDailyViews.toLocaleString()} view/ngày ÷ {form.keywords.filter(k => !(Number(k.daily_views) > 0)).length} từ khóa).
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {form.keywords.map((kw, i) => (
                      <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl relative">
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{i + 1}</span>
                            <TextInput
                              placeholder={isSocial ? `URL Social ${i + 1} (Facebook, TikTok...)` : `Từ khóa ${i + 1}`}
                              value={kw.keyword}
                              onChange={e => updateKeywordText(i, e.target.value)}
                              className="pl-10"
                            />
                          </div>

                          {/* views per keyword — luôn hiện */}
                          <div className="relative w-28 flex-shrink-0">
                            <input
                              type="number" min="1"
                              value={kw.views || 1}
                              onChange={e => updateKeywordViews(i, e.target.value)}
                              className="w-full px-2 py-2.5 text-sm border-2 border-amber-300 rounded-xl bg-amber-50
                                         focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500
                                         transition pr-10 font-black text-amber-900 text-right"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 font-bold pointer-events-none">view</span>
                          </div>

                          {/* daily_views — chỉ hiện khi bật Cài view/ngày riêng */}
                          {form.useKeywordViews && (
                            <div className="relative w-28 flex-shrink-0">
                              <input
                                type="number" min="0"
                                value={kw.daily_views || 0}
                                onChange={e => updateKeywordDailyViews(i, e.target.value)}
                                className="w-full px-2 py-2.5 text-sm border-2 border-sky-300 rounded-xl bg-sky-50
                                           focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-500
                                           transition pr-12 font-black text-sky-900 text-right"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sky-500 font-bold pointer-events-none">/ngày</span>
                            </div>
                          )}

                          {form.keywords.length > 1 && (
                            <button type="button" onClick={() => removeKeyword(i)}
                              className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex-shrink-0 absolute -top-2 -right-2 bg-white border border-red-100 shadow-sm z-10 w-8 h-8 flex items-center justify-center">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        {/* URL Đích riêng — nhiều URL giống ảnh */}
                        <div className="flex gap-2 items-start mt-1">
                          <div className="flex-1 space-y-2">
                            {(kw.urls || ['']).map((urlItem, urlIdx) => (
                              <div key={urlIdx} className="flex gap-2">
                                <TextInput
                                  placeholder={isSocial ? `URL Đích ${urlIdx + 1} (trang sẽ đến)` : `URL Đích ${urlIdx + 1} (Tuỳ chọn)`}
                                  value={urlItem}
                                  onChange={e => updateKeywordUrlItem(i, urlIdx, e.target.value)}
                                  className="flex-1 text-xs"
                                />
                                {(kw.urls || []).length > 1 && (
                                  <button type="button" onClick={() => removeKeywordUrl(i, urlIdx)}
                                    className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex-shrink-0">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={() => addKeywordUrl(i)}
                              className="text-xs text-violet-600 hover:text-violet-700 font-semibold flex items-center gap-1">
                              <Plus size={14} /> Thêm URL đích
                            </button>
                          </div>
                          <div className="flex-1 space-y-2">
                            {(kw.images || ['']).map((img, imgIdx) => (
                              <div key={imgIdx} className="flex gap-2">
                                <TextInput
                                  placeholder={`Link Image ${imgIdx + 1} - Ctrl+V dán ảnh`}
                                  value={img}
                                  onChange={e => updateKeywordImage(i, imgIdx, e.target.value)}
                                  onPaste={async e => {
                                    const items = e.clipboardData?.items;
                                    if (!items) return;
                                    for (let j = 0; j < items.length; j++) {
                                      const item = items[j];
                                      if (item.type.startsWith('image/')) {
                                        e.preventDefault();
                                        const file = item.getAsFile();
                                        if (file) handleKeywordImageUpload({ target: { files: [file] } }, i, imgIdx);
                                        break;
                                      }
                                    }
                                  }}
                                  className="flex-1 text-xs"
                                />
                                <label className="flex items-center justify-center p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition flex-shrink-0" title="Upload Image">
                                  {uploadingKwIdx === i && uploadingKwImgIdx === imgIdx ? <RefreshCw size={14} className="animate-spin text-slate-400" /> : <Upload size={14} className="text-slate-500" />}
                                  <input type="file" accept="image/*" className="hidden" onChange={e => handleKeywordImageUpload(e, i, imgIdx)} />
                                </label>
                                {(kw.images || []).length > 1 && (
                                  <button type="button" onClick={() => removeKeywordImage(i, imgIdx)}
                                    className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex-shrink-0">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={() => addKeywordImage(i)}
                              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                              <Plus size={14} /> Thêm ảnh
                            </button>
                          </div>
                        </div>
                        {/* Device targeting per keyword */}
                        <div className="flex items-center gap-2 mt-1 p-2 bg-teal-50 border border-teal-100 rounded-lg">
                          <span className="text-[10px] font-bold text-teal-700 whitespace-nowrap">Thiết bị:</span>
                          {[
                            { value: 'both', label: 'Cả hai' },
                            { value: 'desktop', label: 'PC' },
                            { value: 'mobile', label: 'Mobi' },
                          ].map(d => {
                            const active = (kw.device || 'both') === d.value;
                            return (
                              <button key={d.value} type="button"
                                onClick={() => updateKeywordDevice(i, d.value)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all ${active
                                  ? 'border-teal-500 bg-teal-200 text-teal-900'
                                  : 'border-slate-200 bg-white text-slate-500 hover:border-teal-300'}`}>
                                {d.label}
                              </button>
                            );
                          })}
                          {(kw.device === 'both' || !kw.device) && (
                            <>
                              <input
                                type="range" min="0" max="100" step="5"
                                value={kw.mobilePct ?? 50}
                                onChange={e => updateKeywordMobilePct(i, e.target.value)}
                                className="flex-1 accent-teal-600 h-1"
                                style={{ minWidth: 60 }}
                              />
                              <span className="text-[10px] font-black text-teal-800 bg-white border border-teal-200 px-1.5 py-0.5 rounded tabular-nums whitespace-nowrap">
                                M:{kw.mobilePct ?? 50}% P:{100 - (kw.mobilePct ?? 50)}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Daily views budget summary */}
                  {form.useKeywordViews && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-sky-600">Đã phân bổ</span>
                        <span className="text-sm font-black text-sky-700 tabular-nums">
                          {allocatedDailyViews.toLocaleString()}<span className="text-[10px] font-semibold text-sky-400 ml-1">/ngày</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-emerald-600">Còn lại (tự động)</span>
                        <span className="text-sm font-black text-emerald-700 tabular-nums">
                          {remainingDailyViews.toLocaleString()}<span className="text-[10px] font-semibold text-emerald-400 ml-1">/ngày</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Tổng view — always computed from keyword views sum, read-only */}
                  <div className="mt-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <span className="text-xs font-bold text-amber-700">Tổng view</span>
                    <span className="text-sm font-black text-amber-900 tabular-nums">
                      {computedTotalViews.toLocaleString()}
                      <span className="text-[10px] font-semibold text-amber-500 ml-1">view</span>
                    </span>
                  </div>

                  <button type="button" onClick={addKeyword}
                    className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition">
                    <Plus size={13} /> {isSocial ? 'Thêm URL Social' : 'Thêm từ khóa'}
                  </button>
                  <Hint>
                    {isSocial
                      ? 'Nhập URL bài đăng Social (Facebook, TikTok…). URL Đích là trang visitor sẽ truy cập. Link Image là ảnh đính kèm.'
                      : form.useKeywordViews
                        ? 'Từ khóa để 0 sẽ tự nhận phần còn lại chia đều. Tổng view mua không thay đổi.'
                        : 'Hệ thống sẽ ngẫu nhiên chọn 1 từ khóa cho mỗi lượt truy cập'}
                  </Hint>
                </div>
              </SectionCard>
            )}

            {/* ── Phân phối theo giờ: hiện sau khi đã set daily views ── */}
            {(() => {
              const hasDaily = isDirect ? form.directDailyViews > 0 : allocatedDailyViews > 0;
              // Tự tắt nếu daily views bị xóa
              if (!hasDaily && form.viewByHour) set('viewByHour', false);
              return (
                <div className={`flex items-center gap-4 border rounded-xl px-4 py-3.5 bg-white shadow-sm transition-colors ${
                  hasDaily
                    ? 'border-slate-200'
                    : 'border-slate-100 opacity-50 cursor-not-allowed'
                }`}>
                  <Toggle
                    checked={form.viewByHour}
                    onChange={() => hasDaily && set('viewByHour', !form.viewByHour)}
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Phân phối theo giờ</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {hasDaily
                        ? 'Chia đều view trong 24h mỗi ngày — áp dụng cho từng từ khóa'
                        : 'Cần cài giới hạn view/ngày trước khi bật'}
                    </p>
                  </div>
                </div>
              );
            })()}


            {/* ── 5. Mã giảm giá & Ghi chú ── */}
            <SectionCard icon={Tag} iconBg="bg-indigo-50" iconColor="text-indigo-600" title="Mã giảm giá & Ghi chú">
              {/* Discount */}
              <div>
                <Label>Mã giảm giá</Label>
                <div className="flex gap-2">
                  <TextInput
                    placeholder="Nhập mã giảm giá nếu có..."
                    value={form.discountCode}
                    onChange={e => { set('discountCode', e.target.value); setDiscountApplied(false); }}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={applyDiscount}
                    className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-95 flex-shrink-0 ${discountApplied
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                      }`}
                  >
                    {discountApplied ? '✓ Đã áp dụng' : 'Áp dụng'}
                  </button>
                </div>
                {discountApplied && (
                  <div className="mt-2 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                    <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-emerald-700">
                      Mã <strong>{form.discountCode}</strong> đã áp dụng! Giảm <strong>{pricingConfig.discount_percent}%</strong> trên toàn bộ đơn hàng.
                    </p>
                  </div>
                )}
                {!discountApplied && adminDiscountEnabled && (
                  <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      Có mã giảm giá đang áp dụng! Nhớ nhập mã để được giá tốt hơn: <strong>{pricingConfig.discount_code}</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <Label>Ghi chú đơn hàng</Label>
                <textarea
                  rows={3}
                  placeholder="Thêm ghi chú: mã đơn hàng, yêu cầu đặc biệt..."
                  value={form.note}
                  onChange={e => set('note', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                             placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30
                             focus:border-indigo-400 transition-all resize-none shadow-sm hover:border-slate-300"
                />
                <Hint>Ghi chú internal, không ảnh hưởng đến chiến dịch.</Hint>
              </div>
            </SectionCard>
          </div>

          {/* ══ RIGHT: Order Summary ═══════════════════════════════════ */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden sticky top-6">
              {/* Header */}
              <div className="px-5 py-4 border-b border-indigo-100"
                style={{ background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={13} className="text-indigo-500" />
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Đơn hàng</span>
                </div>
                <p className="text-base font-black text-slate-900">Tóm tắt chiến dịch</p>
              </div>

              {/* Summary rows */}
              <div className="p-5 space-y-0">
                <SummaryRow label="Tên chiến dịch" value={form.campaignName || '—'} />
                <SummaryRow label="Loại traffic" value={TRAFFIC_TYPES.find(t => t.value === form.trafficType)?.label || '—'} />
                <SummaryRow label="Version" value={form.version === 'v1' ? 'Version 1 (2 bước)' : 'Version 2 (1 bước)'} />
                <SummaryRow label="Thời gian" value={DURATIONS.find(d => d.value === form.duration)?.label || '—'} />
                <SummaryRow label="View/ngày" value={form.useKeywordViews ? `${(allocatedDailyViews).toLocaleString()} view` : '—'} />
                <SummaryRow label="Tổng view" value={`${fmt(keywordTotalViews)} view`} />
                <SummaryRow
                  label="Đơn giá/view"
                  value={hasPricing ? `${fmt(pricePerView)} đ` : 'Chọn loại & thời gian'}
                />
                {discountApplied && (
                  <SummaryRow label="Giảm giá" value={`✓ -${pricingConfig.discount_percent}%`} accent />
                )}

                {/* Per-keyword breakdown */}
                {form.useKeywordViews && form.keywords.filter(k => k.keyword.trim()).length > 0 && (
                  <div className="py-2.5 border-b border-slate-50">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold mb-2 flex items-center gap-1.5">
                      <BarChart2 size={10} /> Phân bổ theo từ khóa
                    </p>
                    <div className="space-y-1.5">
                      {form.keywords.filter(k => k.keyword.trim()).map((k, i) => {
                        const pct = keywordTotalViews > 0 ? Math.round((Number(k.views) || 0) / keywordTotalViews * 100) : 0;
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] text-slate-600 font-medium truncate max-w-[55%]">{k.keyword}</span>
                              <span className="text-[10px] font-black text-indigo-600 tabular-nums">
                                {(Number(k.views) || 0).toLocaleString()}v
                                <span className="text-slate-400 font-normal ml-1">({pct}%)</span>
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="px-5 pb-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-600">Tổng tiền</span>
                  <span className="text-2xl font-black text-indigo-700 tabular-nums">
                    {hasPricing ? fmt(totalPrice) : '—'}
                    {hasPricing && <span className="text-sm text-slate-400 font-semibold ml-1">đ</span>}
                  </span>
                </div>

                {/* Budget check */}
                {hasPricing && (
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold mt-2 ${budgetOk
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {budgetOk
                      ? <><CheckCircle2 size={12} /> Số dư đủ (còn {fmt(walletBalance - totalPrice)} đ)</>
                      : <><AlertCircle size={12} /> Số dư không đủ – cần nạp thêm {fmt(totalPrice - walletBalance)} đ</>
                    }
                  </div>
                )}

                {!hasPricing && (
                  <p className="text-xs text-slate-400 mt-1">Chọn loại traffic và thời gian để xem giá.</p>
                )}
              </div>

              {/* Submit */}
              <div className="px-5 pb-5">
                {!budgetOk && hasPricing ? (
                  <button
                    type="button"
                    onClick={() => navigate('/buyer/dashboard/finance/deposit')}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700
                               text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
                  >
                    <CreditCard size={15} /> Nạp tiền ngay
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700
                               text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {submitting ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xử lý...</>
                    ) : (
                      <><Zap size={15} /> Mua Dịch Vụ</>
                    )}
                  </button>
                )}
              </div>

              {/* Notes */}
              <div className="mx-5 mb-5 p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-xs font-bold text-indigo-700 mb-2 flex items-center gap-1.5">
                  <Info size={11} /> Lưu ý quan trọng
                </p>
                <ul className="space-y-1 text-xs text-indigo-600 leading-relaxed">
                  <li>• Traffic bắt đầu trong vòng <strong>24h</strong></li>
                  <li>• Số dư hiện tại: <strong>{fmt(walletBalance)} đ</strong></li>
                  <li>• Cam kết hoàn tiền nếu không đạt KPI</li>
                  <li>• Hỗ trợ tư vấn <strong>24/7</strong></li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}