import { useState, useRef, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Info, Upload, X, Tag, Globe, Monitor, Smartphone,
  BarChart2, Wallet, Gift, Star, CheckCircle2, AlertCircle,
} from 'lucide-react';
import api from '../../lib/api';
import Breadcrumb from '../../components/Breadcrumb';

/* ── Static data ─────────────────────────────────────────── */
const TRAFFIC_TYPES = [
  { value: '', label: 'Chọn loại traffic' },
  { value: 'google_search', label: 'Google Search' },
  { value: 'direct', label: 'Direct / Redirect' },
  { value: 'social', label: 'Social' },
];

const DURATIONS = [
  { value: '', label: 'Chọn thời gian' },
  { value: '30', label: '30 giây' },
  { value: '60', label: '60 giây' },
  { value: '90', label: '90 giây' },
  { value: '120', label: '2 phút' },
  { value: '180', label: '3 phút' },
  { value: '300', label: '5 phút' },
];

const DEVICES = [
  { value: 'desktop', label: 'Desktop', icon: Monitor },
  { value: 'mobile', label: 'Mobile', icon: Smartphone },
];

const COUNTRIES = [
  { value: 'VN', label: 'Việt Nam', flag: '🇻🇳' },
];

/* ── Tiny UI primitives ──────────────────────────────────── */
function Label({ children, required, hint }) {
  return (
    <label className="flex items-center gap-1 text-sm font-semibold text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500">*</span>}
      {hint && (
        <span className="group relative cursor-help">
          <Info size={13} className="text-gray-400" />
          <span className="absolute left-5 top-0 z-50 hidden group-hover:block w-52 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-xl">
            {hint}
          </span>
        </span>
      )}
    </label>
  );
}

function Hint({ children }) {
  return <p className="mt-1 text-xs text-gray-400 leading-snug">{children}</p>;
}

function TextInput({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white
                  shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2
                  focus:ring-blue-500 focus:border-transparent transition ${className}`}
      {...props}
    />
  );
}

function SelectInput({ children, ...props }) {
  return (
    <select
      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white
                 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                 focus:border-transparent transition appearance-none cursor-pointer"
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
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white
                   shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2
                   focus:ring-blue-500 focus:border-transparent transition pr-16"
        {...props}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

/* ── Image upload field ──────────────────────────────────── */
function ImageUpload({ label, required, hint, value, onChange }) {
  const ref = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) onChange(file);
  };

  return (
    <div>
      <Label required={required} hint={hint}>{label}</Label>
      <div
        onClick={() => ref.current.click()}
        className="flex items-center gap-3 border border-dashed border-gray-300 rounded-xl
                   px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition group"
      >
        <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0 transition">
          <Upload size={16} className="text-gray-400 group-hover:text-blue-500 transition" />
        </div>
        <div className="min-w-0 flex-1">
          {value ? (
            <span className="text-sm text-gray-700 font-medium truncate block">{value.name}</span>
          ) : (
            <span className="text-sm text-gray-400">No file chosen</span>
          )}
        </div>
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="text-gray-400 hover:text-red-500 transition flex-shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

/* ── Version card ────────────────────────────────────────── */
function VersionCard({ value, selected, onSelect, badge, title, desc }) {
  return (
    <div
      onClick={() => onSelect(value)}
      className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all
                  ${selected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}
    >
      {badge && (
        <span className="absolute -top-2.5 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
          <Star size={9} fill="white" /> {badge}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition
                        ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        <div>
          <p className={`text-sm font-bold mb-1 ${selected ? 'text-blue-700' : 'text-gray-700'}`}>{title}</p>
          <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Toggle switch ───────────────────────────────────────── */
function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={onChange}
        className={`relative w-10 h-5.5 rounded-full transition-colors duration-200
                    ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
        style={{ height: '22px', width: '40px' }}
      >
        <span
          className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform duration-200
                      ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
          style={{ width: '18px', height: '18px' }}
        />
      </div>
      <span className="text-sm text-gray-600">{label}</span>
    </label>
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function CreateCampaign() {
  usePageTitle('Tạo chiến dịch mới');
  const navigate = useNavigate();
  const [walletBalance, setWalletBalance] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fmt = (n) => (n || 0).toLocaleString('vi-VN');

  useEffect(() => {
    api.get('/finance').then(data => {
      setWalletBalance(data.wallets?.main?.balance || 0);
    }).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    trafficType: '',
    version: 'v1',
    duration: '',
    dailyViews: 500,
    totalViews: 1000,
    viewByHour: false,
    keyword: '',
    website: '',
    image1: null,
    image2: null,
    devices: ['desktop', 'mobile'],
    countries: ['VN'],
    discountCode: 'DISCOUNT_40',
    note: '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.trafficType || !form.duration || !form.keyword || !form.website) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc (*).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/campaigns', {
        name: form.keyword,
        url: form.website,
        traffic_type: form.trafficType,
        keyword: form.keyword,
        total_views: form.totalViews,
        daily_views: form.dailyViews,
        duration: Number(form.duration),
        cpc: form.version === 'v1' ? 15 : 10,
        budget: form.totalViews * (form.version === 'v1' ? 15 : 10),
        device: form.devices.join(','),
        country: form.countries.join(','),
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

  /* price per view (VNĐ) */
  const pricePerView = form.version === 'v1' ? 15 : 10;
  const totalPrice = (form.totalViews * pricePerView).toLocaleString('vi-VN');

  return (
    <div className="space-y-0">

      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Chiến dịch', to: '/dashboard/campaigns' },
        { label: 'Tạo chiến dịch mới' },
      ]} />

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Tạo chiến dịch mới</h1>
      </div>

      {/* Balance bar — 2 wallets */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Ví Traffic */}
        <div className="flex items-center gap-3 bg-white border border-blue-200 rounded-2xl px-5 py-3.5 shadow-sm flex-1 min-w-[200px]">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <Wallet size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Ví Traffic</p>
            <p className="text-lg font-black text-blue-700">{fmt(walletBalance)} <span className="text-sm font-semibold text-gray-400">VNĐ</span></p>
          </div>
          <button
            type="button"
            className="ml-auto text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl transition"
            onClick={() => navigate('/dashboard/finance/deposit')}
          >
            + Nạp tiền
          </button>
        </div>
      </div>

      {/* Toast messages */}
      {submitted && (
        <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-semibold shadow-sm animate-pulse">
          <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
          Chiến dịch đã được tạo thành công! Chúng tôi sẽ bắt đầu xử lý sớm nhất.
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold shadow-sm">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ══ LEFT: Main form ════════════════════════════════════ */}
          <div className="xl:col-span-2 space-y-5">

            {/* ── Card: Traffic type ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <BarChart2 size={16} className="text-blue-600" />
                </div>
                <h2 className="font-bold text-gray-800">Thông tin cơ bản</h2>
              </div>

              <div className="space-y-5">

                {/* Traffic type */}
                <div>
                  <Label required hint="Loại traffic khác nhau sẽ có mức giá khác nhau">
                    Loại traffic
                  </Label>
                  <SelectInput
                    value={form.trafficType}
                    onChange={e => set('trafficType', e.target.value)}
                  >
                    {TRAFFIC_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </SelectInput>
                  <Hint>Loại traffic khác nhau sẽ có mức giá khác nhau</Hint>
                </div>

                {/* Version */}
                <div>
                  <Label required hint="Version khác nhau sẽ có mức giá khác nhau">
                    Version
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                    <VersionCard
                      value="v1"
                      selected={form.version === 'v1'}
                      onSelect={v => set('version', v)}
                      badge="Tốt nhất"
                      title="Version 1"
                      desc="(2 bước) Chờ X thời gian hết sau đó click ngẫu nhiên link nội bộ và chờ X thời gian là xong. (thời gian bước 2 khoảng 25–35 giây)."
                    />
                    <VersionCard
                      value="v2"
                      selected={form.version === 'v2'}
                      onSelect={v => set('version', v)}
                      title="Version 2"
                      desc="(1 bước) Chờ X thời gian hết là xong."
                    />
                  </div>
                  <Hint>Version khác nhau sẽ có mức giá khác nhau</Hint>
                </div>

                {/* Duration */}
                <div>
                  <Label required hint="Thời gian khác nhau sẽ có mức giá khác nhau">
                    Thời gian
                  </Label>
                  <SelectInput
                    value={form.duration}
                    onChange={e => set('duration', e.target.value)}
                  >
                    {DURATIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </SelectInput>
                  <Hint>Thời gian khác nhau sẽ có mức giá khác nhau</Hint>
                </div>

                {/* Views */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label required hint="Số lượng view tối đa trong 1 ngày">
                      Số lượng view trong ngày
                    </Label>
                    <NumberInput
                      value={form.dailyViews}
                      onChange={e => set('dailyViews', Number(e.target.value))}
                      suffix="view/ngày"
                    />
                    <Hint>Số lượng view tối đa trong 1 ngày</Hint>
                  </div>
                  <div>
                    <Label required hint="Khi 1 ngày không dùng hết sẽ chuyển sang ngày hôm sau">
                      Tổng view mua
                    </Label>
                    <NumberInput
                      value={form.totalViews}
                      onChange={e => set('totalViews', Number(e.target.value))}
                      suffix="view"
                    />
                    <Hint>Tổng view mua: khi 1 ngày không dùng hết sẽ chuyển sang ngày hôm sau để view tiếp</Hint>
                  </div>
                </div>

                {/* View by hour toggle */}
                <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <div className="pt-0.5">
                    <Toggle
                      checked={form.viewByHour}
                      onChange={() => set('viewByHour', !form.viewByHour)}
                      label=""
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">View theo giờ</p>
                    <p className="text-xs text-gray-400 mt-0.5">Chia view theo giờ: Số view ngày / 24h</p>
                  </div>
                </div>

              </div>
            </div>

            {/* ── Card: Keyword / URL & Website ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Globe size={16} className="text-orange-500" />
                </div>
                <h2 className="font-bold text-gray-800">Từ khóa & Địa chỉ web</h2>
              </div>

              <div className="space-y-5">

                {/* Keyword */}
                <div>
                  <Label required>Từ khóa hoặc URL</Label>
                  <TextInput
                    placeholder="Nhập từ khóa. Ví dụ: traffic24h"
                    value={form.keyword}
                    onChange={e => set('keyword', e.target.value)}
                  />
                  <Hint>
                    Loại traffic google search: từ khóa để tìm kiếm từ google vào website{'\n'}
                    Loại traffic backlink: từ khóa hoặc link click để vào website.
                  </Hint>
                </div>

                {/* Website */}
                <div>
                  <Label required>Địa chỉ trang web</Label>
                  <TextInput
                    type="url"
                    placeholder="Nhập địa chỉ web. Ví dụ: https://traffic24h.top/"
                    value={form.website}
                    onChange={e => set('website', e.target.value)}
                  />
                  <Hint>Nhập địa chỉ trang web cần view</Hint>
                </div>

              </div>
            </div>

            {/* ── Card: Images ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Upload size={16} className="text-purple-600" />
                </div>
                <h2 className="font-bold text-gray-800">Hình ảnh trang đích</h2>
              </div>

              <div className="space-y-4">
                <ImageUpload
                  label="Image 1"
                  required
                  hint="Image 1: hình ảnh tìm kiếm từ khóa theo google hoặc từ backlink sau đó click vào web"
                  value={form.image1}
                  onChange={v => set('image1', v)}
                />
              </div>
            </div>

            {/* ── Card: Target thiết bị & Quốc gia ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Globe size={16} className="text-teal-600" />
                </div>
                <h2 className="font-bold text-gray-800">Target thiết bị & Quốc gia</h2>
              </div>

              <div className="space-y-5">
                {/* Devices */}
                <div>
                  <Label hint="Chọn thiết bị mà bạn muốn traffic đến từ">Thiết bị</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    {DEVICES.map(d => {
                      const Icon = d.icon;
                      const active = form.devices.includes(d.value);
                      return (
                        <div
                          key={d.value}
                          onClick={() => {
                            const next = active
                              ? form.devices.filter(v => v !== d.value)
                              : [...form.devices, d.value];
                            if (next.length > 0) set('devices', next);
                          }}
                          className={`flex flex-col items-center gap-2 border-2 rounded-xl px-3 py-3 cursor-pointer transition-all
                                      ${active
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-gray-200 hover:border-blue-300'}`}
                        >
                          <Icon size={20} className={active ? 'text-blue-600' : 'text-gray-400'} />
                          <span className={`text-xs font-semibold ${active ? 'text-blue-700' : 'text-gray-500'}`}>{d.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <Hint>Chọn thiết thiết bị mà bạn muốn traffic truy cập vào website.</Hint>
                </div>

                {/* Countries */}
                <div>
                  <Label hint="Chọn quốc gia mà bạn muốn traffic đến từ">Quốc gia</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {COUNTRIES.map(c => {
                      const active = form.countries.includes(c.value);
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? form.countries.filter(v => v !== c.value)
                              : [...form.countries, c.value];
                            if (next.length > 0) set('countries', next);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all
                                      ${active
                              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                              : 'border-gray-200 text-gray-500 hover:border-blue-300'}`}
                        >
                          <img src="https://flagcdn.com/w40/vn.png" alt="VN" className="w-6 h-4 rounded-sm object-cover" />
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                  <Hint>Hiện tại chúng tôi chỉ hỗ trợ quốc gia Việt Nam.</Hint>
                </div>
              </div>
            </div>

            {/* ── Card: Discount + Note ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Tag size={16} className="text-yellow-600" />
                </div>
                <h2 className="font-bold text-gray-800">Mã giảm giá & Ghi chú</h2>
              </div>

              <div className="space-y-5">
                {/* Discount */}
                <div>
                  <Label>Mã giảm giá</Label>
                  <div className="flex gap-2">
                    <TextInput
                      placeholder="Nhập mã giảm giá..."
                      value={form.discountCode}
                      onChange={e => set('discountCode', e.target.value)}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold
                                 rounded-xl transition-all active:scale-95 flex-shrink-0"
                    >
                      Áp dụng
                    </button>
                  </div>
                  <div className="mt-2 flex items-start gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                    <AlertCircle size={13} className="text-orange-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-orange-700">
                      Chú ý: Nhớ áp mã giảm giá để được giá tốt nhất. <strong>(DISCOUNT_40)</strong>
                    </p>
                  </div>
                </div>

                {/* Note */}
                <div>
                  <Label required>Ghi chú</Label>
                  <textarea
                    rows={3}
                    placeholder="Ghi chú: Mã đơn hàng..."
                    value={form.note}
                    onChange={e => set('note', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white
                               shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2
                               focus:ring-blue-500 focus:border-transparent transition resize-none"
                  />
                  <Hint>Ghi chú thông tin đơn hàng</Hint>
                </div>
              </div>
            </div>

          </div>

          {/* ══ RIGHT: Summary & CTA ═══════════════════════════════ */}
          <div className="space-y-5">

            {/* Order summary */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-6">
              <h2 className="font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100">
                Tóm tắt đơn hàng
              </h2>

              <div className="space-y-3 text-sm mb-5">
                <SummaryRow label="Loại traffic"
                  value={TRAFFIC_TYPES.find(t => t.value === form.trafficType)?.label || '—'} />
                <SummaryRow label="Version"
                  value={form.version === 'v1' ? 'Version 1 (2 bước)' : form.version === 'v2' ? 'Version 2 (1 bước)' : '—'} />
                <SummaryRow label="Thời gian"
                  value={DURATIONS.find(d => d.value === form.duration)?.label || '—'} />
                <SummaryRow label="View/ngày" value={form.dailyViews.toLocaleString('vi-VN')} />
                <SummaryRow label="Tổng view" value={form.totalViews.toLocaleString('vi-VN')} />
                <SummaryRow label="Đơn giá/view" value={`${pricePerView} VNĐ`} />
                {form.discountCode && (
                  <SummaryRow label="Mã giảm giá" value={form.discountCode} accent />
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-600">Tổng tiền</span>
                  <span className="text-xl font-black text-blue-700">{totalPrice} <span className="text-sm font-semibold">VNĐ</span></span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Giá ước tính, giá thực tế sau khi áp mã giảm giá.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
                           text-white font-black text-base rounded-2xl shadow-lg shadow-blue-200
                           transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
              >
                Mua Dịch Vụ
              </button>

              {/* Notes */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs font-bold text-blue-700 mb-1.5 flex items-center gap-1">
                  <Info size={12} /> Lưu ý quan trọng
                </p>
                <ul className="space-y-1 text-xs text-blue-600">
                  <li>• Traffic bắt đầu trong vòng 24h</li>
                  <li>• Số dư hiện tại: <strong>0 VNĐ</strong> – cần nạp thêm</li>
                  <li>• Cam kết hoàn tiền nếu không đạt KPI</li>
                  <li>• Hỗ trợ tư vấn 24/7</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
}

/* ── Inline summary row ──────────────────────────────────── */
function SummaryRow({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`text-xs font-semibold text-right max-w-[55%] break-words ${accent ? 'text-orange-500' : 'text-gray-800'}`}>
        {value || <span className="text-gray-300 font-normal">—</span>}
      </span>
    </div>
  );
}