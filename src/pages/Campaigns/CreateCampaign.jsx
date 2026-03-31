import { useState, useRef, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Info, Upload, X, Tag, Globe, Monitor, Smartphone,
  BarChart2, Wallet, Gift, Star, CheckCircle2, AlertCircle, Plus, Trash2,
  Zap, MousePointerClick, Sparkles, ArrowRight, CreditCard,
  Search, Link2, Share2,
} from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import Breadcrumb from '../../components/Breadcrumb';

/* ─── Static data ───────────────────────────────────────────── */
const TRAFFIC_TYPES = [
  { value: 'google_search', label: 'Google Search',    icon: Search, desc: 'Traffic từ kết quả tìm kiếm Google',       iconBg: 'bg-blue-50',   iconColor: 'text-indigo-600',   activeBg: 'bg-blue-50/80',   activeBorder: 'border-indigo-500',   activeText: 'text-indigo-700' },
  { value: 'direct',        label: 'Direct / Redirect', icon: Link2,  desc: 'Traffic trực tiếp hoặc redirect URL',       iconBg: 'bg-violet-50', iconColor: 'text-violet-600', activeBg: 'bg-violet-50/80', activeBorder: 'border-violet-500', activeText: 'text-violet-700' },
  { value: 'social',        label: 'Social',            icon: Share2, desc: 'Traffic từ mạng xã hội (Facebook, TikTok…)', iconBg: 'bg-pink-50',   iconColor: 'text-pink-600',   activeBg: 'bg-pink-50/80',   activeBorder: 'border-pink-500',   activeText: 'text-pink-700' },
];

const DURATIONS = [
  { value: '',    label: 'Chọn thời gian' },
  { value: '60',  label: 'Gói 60s' },
  { value: '90',  label: 'Gói 90s' },
  { value: '120', label: 'Gói 120s' },
  { value: '150', label: 'Gói 150s' },
  { value: '200', label: 'Gói 200s' },
];

const DEVICES = [
  { value: 'desktop', label: 'Desktop', icon: Monitor, desc: 'PC, Laptop' },
  { value: 'mobile',  label: 'Mobile',  icon: Smartphone, desc: 'Điện thoại, Tablet' },
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
      className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${
        selected
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
        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
          selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
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
                  transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
        checked ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
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
  const [submitted, setSubmitted]         = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState('');
  const [uploadingIdx, setUploadingIdx]   = useState(-1);

  const [pricingTiers, setPricingTiers]     = useState([]);
  const [pricingConfig, setPricingConfig]   = useState({});
  const [discountApplied, setDiscountApplied] = useState(false);

  useEffect(() => {
    api.get('/finance').then(data => {
      setWalletBalance(data.wallets?.main?.balance || 0);
    }).catch(() => {});
    fetch('/api/pricing').then(r => r.json()).then(data => {
      setPricingTiers(data.tiers || []);
      if (data.config) setPricingConfig(data.config);
    }).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    campaignName:    '',
    trafficType:     '',
    version:         'v1',
    duration:        '',
    dailyViews:      500,
    totalViews:      1000,
    viewByHour:      false,
    useKeywordViews: false,          // ← new: toggle per-keyword traffic
    keywords:        [{ keyword: '', views: 1000, url: '', image: '' }],  // ← now objects
    urls:            [''],
    imageUrls:       [''],
    devices:         ['desktop', 'mobile'],
    countries:       ['VN'],
    discountCode:    '',
    note:            '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  /* ── Keyword helpers ── */
  const addKeyword = () => setForm(f => ({
    ...f,
    keywords: [...f.keywords, {
      keyword: '',
      url: '',
      image: '',
      views: f.useKeywordViews
        ? Math.max(1, Math.floor(keywordTotalViews / (f.keywords.length + 1)))
        : f.totalViews,
    }],
  }));
  const removeKeyword = (idx) => setForm(f => ({ ...f, keywords: f.keywords.filter((_, i) => i !== idx) }));
  const updateKeywordText = (idx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === idx ? { ...k, keyword: val } : k),
  }));
  const updateKeywordUrl = (idx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === idx ? { ...k, url: val } : k),
  }));
  const updateKeywordImage = (idx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === idx ? { ...k, image: val } : k),
  }));
  const updateKeywordViews = (idx, val) => setForm(f => ({
    ...f,
    keywords: f.keywords.map((k, i) => i === idx ? { ...k, views: Number(val) || 0 } : k),
  }));
  const toggleKeywordViews = () => setForm(f => {
    const next = !f.useKeywordViews;
    if (next) {
      const perKw = Math.max(1, Math.floor(f.totalViews / Math.max(1, f.keywords.length)));
      return { ...f, useKeywordViews: next, keywords: f.keywords.map(k => ({ ...k, views: perKw })) };
    }
    return { ...f, useKeywordViews: next };
  });

  /* ── URL / image helpers ── */
  const addArrayItem    = (key) => setForm(f => ({ ...f, [key]: [...f[key], ''] }));
  const removeArrayItem = (key, idx) => setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));
  const updateArrayItem = (key, idx, val) => setForm(f => ({ ...f, [key]: f[key].map((v, i) => i === idx ? val : v) }));

  /* ── Computed totals ── */
  const keywordTotalViews = form.useKeywordViews
    ? form.keywords.reduce((s, k) => s + (Number(k.views) || 0), 0)
    : form.totalViews;

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

  const tier         = findTier();
  const hasPricing   = !!(form.trafficType && form.duration && tier);
  const pricePerView = (() => {
    if (!tier) return 0;
    if (discountApplied) return form.version === 'v1' ? tier.v1_discount : tier.v2_discount;
    return form.version === 'v1' ? tier.v1_price : tier.v2_price;
  })();
  const totalPrice = hasPricing ? Math.round(keywordTotalViews * pricePerView) : 0;
  const budgetOk   = totalPrice <= walletBalance;

  const handleImageUpload = async (e, idx) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingIdx(idx);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res   = await fetch('/api/campaigns/upload-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data  = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      updateArrayItem('imageUrls', idx, data.imageUrl);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingIdx(-1);
    }
  };

  const [uploadingKwIdx, setUploadingKwIdx] = useState(-1);
  const handleKeywordImageUpload = async (e, idx) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingKwIdx(idx);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res   = await fetch('/api/campaigns/upload-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data  = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      updateKeywordImage(idx, data.imageUrl);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingKwIdx(-1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validKeywords = form.keywords.filter(k => k.keyword.trim());
    const urls          = form.urls.filter(u => u.trim());
    if (!form.campaignName || !form.trafficType || !form.duration || validKeywords.length === 0 || urls.length === 0) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc (*).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const images = form.imageUrls.filter(u => u.trim());
      // Build keyword_config – each keyword with its own view target
      const keywordConfig = form.useKeywordViews
        ? validKeywords.map(k => ({ keyword: k.keyword, views: Number(k.views) || 0, url: k.url || '', image: k.image || '' }))
        : validKeywords.map(k => ({ keyword: k.keyword, views: keywordTotalViews, url: k.url || '', image: k.image || '' }));

      await api.post('/campaigns', {
        name:             form.campaignName,
        url:              urls[0],
        url2:             JSON.stringify(urls.slice(1)),
        traffic_type:     form.trafficType,
        keyword:          JSON.stringify(validKeywords.map(k => k.keyword)),
        keyword_config:   JSON.stringify(keywordConfig),
        total_views:      keywordTotalViews,
        daily_views:      form.dailyViews,
        duration:         Number(form.duration),
        version:          form.version,
        discount_applied: discountApplied,
        discount_code:    discountApplied ? form.discountCode.trim() : '',
        cpc:              pricePerView,
        budget:           totalPrice,
        device:           form.devices.join(','),
        country:          form.countries.join(','),
        image1_url:       images.length > 0 ? JSON.stringify(images) : '',
        image2_url:       '',
        note:             form.note,
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
                    const Icon    = t.icon;
                    const active  = form.trafficType === t.value;
                    return (
                      <div
                        key={t.value}
                        onClick={() => set('trafficType', t.value)}
                        className={`relative flex flex-col gap-2.5 border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${
                          active
                            ? `${t.activeBorder} ${t.activeBg} shadow-md`
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                            active ? t.iconBg : 'bg-slate-100'
                          }`}>
                            <Icon size={17} className={active ? t.iconColor : 'text-slate-400'} />
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            active ? `${t.activeBorder.replace('border-', 'border-')} bg-current` : 'border-slate-300 bg-white'
                          }`} style={active ? { backgroundColor: 'currentColor' } : {}}>
                            {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <div>
                          <p className={`text-sm font-bold leading-tight ${
                            active ? t.activeText : 'text-slate-700'
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
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all duration-150 ${
                        form.duration === d.value
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

              {/* Views */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label required hint="Số view tối đa phân phối trong 1 ngày">Số view / ngày</Label>
                  <NumberInput
                    value={form.dailyViews}
                    onChange={e => set('dailyViews', Number(e.target.value))}
                    suffix="view/ngày"
                  />
                  <Hint>Giới hạn phân phối hàng ngày</Hint>
                </div>
                <div>
                  <Label required={!form.useKeywordViews} hint="Tổng số view cần mua cho chiến dịch">Tổng view mua</Label>
                  {form.useKeywordViews ? (
                    <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm flex items-center justify-between">
                      <span className="text-slate-400 text-xs">Tự động từ cấu hình từ khóa</span>
                      <span className="font-black text-indigo-700 tabular-nums">{keywordTotalViews.toLocaleString()} view</span>
                    </div>
                  ) : (
                    <NumberInput
                      value={form.totalViews}
                      onChange={e => set('totalViews', Number(e.target.value))}
                      suffix="view"
                    />
                  )}
                  <Hint>View dư ngày trước sẽ chuyển sang ngày sau</Hint>
                </div>
              </div>

              {/* View by hour */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <Toggle checked={form.viewByHour} onChange={() => set('viewByHour', !form.viewByHour)} />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Phân phối theo giờ</p>
                  <p className="text-xs text-slate-400 mt-0.5">Chia đều view trong 24h mỗi ngày</p>
                </div>
              </div>
            </SectionCard>

            {/* ── 2. Từ khóa & URL ── */}
            <SectionCard icon={Globe} iconBg="bg-amber-50" iconColor="text-amber-600" title="Từ khóa & Địa chỉ web">
              {/* Keywords */}
              <div>
                {/* Header row with toggle */}
                <div className="flex items-center justify-between mb-2">
                  <Label required>Từ khóa tìm kiếm</Label>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs font-semibold transition-colors ${form.useKeywordViews ? 'text-amber-600' : 'text-slate-400'}`}>
                      Config traffic / từ khóa
                    </span>
                    <Toggle checked={form.useKeywordViews} onChange={toggleKeywordViews} />
                  </div>
                </div>

                {form.useKeywordViews && (
                  <div className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <BarChart2 size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 mb-0.5">Chế độ phân bổ traffic theo từ khóa</p>
                      <p className="text-xs text-amber-600 leading-relaxed">
                        Mỗi từ khóa có số view riêng. Tổng view = tổng của tất cả từ khóa.
                        Hệ thống sẽ đảm bảo mỗi từ khóa đạt đúng số view đã cấu hình.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {form.keywords.map((kw, i) => (
                    <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl relative">
                      <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{i + 1}</span>
                          <TextInput
                            placeholder={`Từ khóa ${i + 1}`}
                            value={kw.keyword}
                            onChange={e => updateKeywordText(i, e.target.value)}
                            className="pl-10"
                          />
                        </div>

                        {form.useKeywordViews && (
                          <div className="relative w-36 flex-shrink-0">
                            <input
                              type="number"
                              min="1"
                              value={kw.views}
                              onChange={e => updateKeywordViews(i, e.target.value)}
                              className="w-full px-3 py-2.5 text-sm border-2 border-amber-300 rounded-xl bg-amber-50
                                         focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500
                                         transition pr-12 font-black text-amber-900 text-right"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 font-bold pointer-events-none">view</span>
                          </div>
                        )}

                        {form.keywords.length > 1 && (
                          <button type="button" onClick={() => removeKeyword(i)}
                            className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex-shrink-0 absolute -top-2 -right-2 bg-white border border-red-100 shadow-sm z-10 w-8 h-8 flex items-center justify-center">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 items-center mt-1">
                        <TextInput
                          placeholder="URL đích (Tuỳ chọn)"
                          value={kw.url}
                          onChange={e => updateKeywordUrl(i, e.target.value)}
                          className="flex-1 text-xs"
                        />
                        <div className="flex-1 flex gap-2">
                          <TextInput
                            placeholder="Link Image (Tuỳ chọn)"
                            value={kw.image}
                            onChange={e => updateKeywordImage(i, e.target.value)}
                            className="flex-1 text-xs"
                          />
                          <label className="flex items-center justify-center p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition flex-shrink-0" title="Upload Image">
                            {uploadingKwIdx === i ? <RefreshCw size={14} className="animate-spin text-slate-400" /> : <Upload size={14} className="text-slate-500" />}
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleKeywordImageUpload(e, i)} />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total summary bar when keyword views mode is active */}
                {form.useKeywordViews && (
                  <div className="mt-3 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <BarChart2 size={13} className="text-indigo-500" />
                      <span className="text-xs font-bold text-indigo-600">Tổng view tất cả từ khóa</span>
                    </div>
                    <span className="text-base font-black text-indigo-700 tabular-nums">
                      {keywordTotalViews.toLocaleString()}
                      <span className="text-xs font-semibold text-indigo-400 ml-1">view</span>
                    </span>
                  </div>
                )}

                <button type="button" onClick={addKeyword}
                  className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition">
                  <Plus size={13} /> Thêm từ khóa
                </button>
                <Hint>
                  {form.useKeywordViews
                    ? 'Mỗi từ khóa đạt đúng số view đã cấu hình. Tổng view = tổng cộng tất cả.'
                    : 'Hệ thống sẽ ngẫu nhiên chọn 1 từ khóa cho mỗi lượt truy cập'}
                </Hint>
              </div>

              {/* URLs */}
              <div>
                <Label required>Địa chỉ trang web (URL đích)</Label>
                <div className="space-y-2">
                  {form.urls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="relative flex-1">
                        <Globe size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <TextInput
                          type="url"
                          placeholder={i === 0 ? 'https://example.com/trang-can-tang-traffic' : `URL phụ ${i + 1}`}
                          value={url}
                          onChange={e => updateArrayItem('urls', i, e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {form.urls.length > 1 && (
                        <button type="button" onClick={() => removeArrayItem('urls', i)}
                          className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex-shrink-0">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addArrayItem('urls')}
                  className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition">
                  <Plus size={13} /> Thêm URL
                </button>
                <Hint>URL đầu tiên là trang chính. Các URL tiếp theo được chọn ngẫu nhiên.</Hint>
              </div>
            </SectionCard>

            {/* ── 3. Hình ảnh ── */}
            <SectionCard icon={Upload} iconBg="bg-violet-50" iconColor="text-violet-600" title="Hình ảnh chiến dịch" badge="Tuỳ chọn">
              <div className="space-y-3">
                {form.imageUrls.map((imgUrl, i) => (
                  <div key={i}>
                    {imgUrl && (
                      <img src={imgUrl} alt="" className="w-full h-28 object-cover rounded-xl border border-slate-200 mb-2" onError={e => e.target.style.display='none'} />
                    )}
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center gap-3 border-2 border-dashed border-slate-200 rounded-xl px-4 py-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center flex-shrink-0 transition-colors">
                          <Upload size={14} className={`text-slate-400 group-hover:text-indigo-500 transition-colors ${uploadingIdx === i ? 'animate-spin' : ''}`} />
                        </div>
                        <span className="text-xs text-slate-500 group-hover:text-indigo-600 transition-colors">
                          {uploadingIdx === i ? 'Đang tải lên...' : imgUrl ? 'Thay ảnh khác' : `Chọn ảnh ${i + 1}`}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, i)} />
                      </label>
                      {form.imageUrls.length > 1 && (
                        <button type="button" onClick={() => removeArrayItem('imageUrls', i)}
                          className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex-shrink-0">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => addArrayItem('imageUrls')}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition">
                <Plus size={13} /> Thêm ảnh
              </button>
              <Hint>Upload ảnh thumbnail hoặc ảnh đại diện chiến dịch. Không giới hạn số lượng.</Hint>
            </SectionCard>

            {/* ── 4. Thiết bị & Quốc gia ── */}
            <SectionCard icon={MousePointerClick} iconBg="bg-teal-50" iconColor="text-teal-600" title="Thiết bị & Quốc gia">
              {/* Devices */}
              <div>
                <Label hint="Chọn loại thiết bị mà visitor sẽ sử dụng để truy cập">Thiết bị target</Label>
                <div className="grid grid-cols-2 gap-3">
                  {DEVICES.map(d => {
                    const Icon   = d.icon;
                    const active = form.devices.includes(d.value);
                    return (
                      <div
                        key={d.value}
                        onClick={() => {
                          const next = active ? form.devices.filter(v => v !== d.value) : [...form.devices, d.value];
                          if (next.length > 0) set('devices', next);
                        }}
                        className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-all ${
                          active ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                          <Icon size={18} className={active ? 'text-indigo-600' : 'text-slate-400'} />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${active ? 'text-indigo-700' : 'text-slate-600'}`}>{d.label}</p>
                          <p className="text-xs text-slate-400">{d.desc}</p>
                        </div>
                        <div className={`ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          active ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                        }`}>
                          {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Hint>Chọn cả hai để phân phối đều, chọn một để target cụ thể hơn.</Hint>
              </div>

              {/* Country */}
              <div>
                <Label hint="Quốc gia xuất phát của traffic">Quốc gia</Label>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 border-indigo-500 bg-indigo-50 shadow-sm">
                    <img src="https://flagcdn.com/w40/vn.png" alt="VN" className="w-6 h-4 rounded-sm object-cover" />
                    <span className="text-sm font-bold text-indigo-700">Việt Nam</span>
                    <CheckCircle2 size={14} className="text-indigo-500" />
                  </div>
                </div>
                <Hint>Hiện tại chỉ hỗ trợ traffic từ Việt Nam.</Hint>
              </div>
            </SectionCard>

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
                    className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-95 flex-shrink-0 ${
                      discountApplied
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
                <SummaryRow label="Loại traffic"   value={TRAFFIC_TYPES.find(t => t.value === form.trafficType)?.label || '—'} />
                <SummaryRow label="Version"        value={form.version === 'v1' ? 'Version 1 (2 bước)' : 'Version 2 (1 bước)'} />
                <SummaryRow label="Thời gian"      value={DURATIONS.find(d => d.value === form.duration)?.label || '—'} />
                <SummaryRow label="View/ngày"      value={`${fmt(form.dailyViews)} view`} />
                <SummaryRow label="Tổng view"      value={`${fmt(keywordTotalViews)} view`} />
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
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold mt-2 ${
                    budgetOk
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