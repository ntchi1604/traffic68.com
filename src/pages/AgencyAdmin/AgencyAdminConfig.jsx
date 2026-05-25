import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Save, Check, Palette, Building2, Phone, Globe, CheckCircle, AlertCircle,
  CreditCard, Coins, Wallet, ImageIcon, Webhook,
} from 'lucide-react';
import api from '../../lib/api';

const DEFAULT_PAYMENT = {
  sepay: { enabled: false, apiKey: '', bankName: '', accountNumber: '', accountHolder: '', webhookSecret: '' },
  pay666: { enabled: false, merchantId: '', apiKey: '', secret: '', endpoint: '' },
  manualBank: { enabled: false, bankName: '', accountNumber: '', accountHolder: '', branch: '' },
  bep20: { enabled: false, address: '', auto: false },
  trc20: { enabled: false, address: '', auto: false },
  vndRate: '',
};

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative inline-flex w-12 h-6 rounded-full transition-colors duration-200 ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${value ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text', mono }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${mono ? 'font-mono' : ''}`} />
    </div>
  );
}

export default function AgencyAdminConfig() {
  usePageTitle('Đại lý - Cấu hình');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('brand');

  const [config, setConfig] = useState({
    domain: '', name: '', logo_url: '', favicon_url: '', primary_color: '#0ea5e9',
    contact_email: '', contact_phone: '',
    payment_config: { ...DEFAULT_PAYMENT },
  });

  useEffect(() => {
    api.get('/agency-admin/config')
      .then(data => {
        const a = data || {};
        const pc = { ...DEFAULT_PAYMENT, ...(a.payment_config || {}) };
        // Deep-merge sub-objects to avoid undefined fields
        Object.keys(DEFAULT_PAYMENT).forEach(k => {
          if (typeof DEFAULT_PAYMENT[k] === 'object' && DEFAULT_PAYMENT[k] !== null) {
            pc[k] = { ...DEFAULT_PAYMENT[k], ...(a.payment_config?.[k] || {}) };
          }
        });
        setConfig({
          domain: a.domain || '',
          name: a.name || '',
          logo_url: a.logo_url || '',
          favicon_url: a.favicon_url || '',
          primary_color: a.primary_color || '#0ea5e9',
          contact_email: a.contact_email || '',
          contact_phone: a.contact_phone || '',
          payment_config: pc,
        });
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const setField = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));
  const setPay = (gateway, field, value) =>
    setConfig(prev => ({ ...prev, payment_config: { ...prev.payment_config, [gateway]: { ...prev.payment_config[gateway], [field]: value } } }));
  const setPayRoot = (field, value) =>
    setConfig(prev => ({ ...prev, payment_config: { ...prev.payment_config, [field]: value } }));

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    try {
      const { domain, ...payload } = config;
      await api.put('/agency-admin/config', payload);
      setMsg('Lưu cấu hình thành công!');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setErr(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pc = config.payment_config;

  const TABS = [
    { id: 'brand', label: 'Thương hiệu', Icon: Palette },
    { id: 'payment', label: 'Thanh toán', Icon: Wallet },
    { id: 'contact', label: 'Liên hệ', Icon: Phone },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Cấu hình đại lý</h1>
          <p className="text-sm text-slate-500 mt-1">Thương hiệu, thanh toán, liên hệ</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition ${saved
            ? 'bg-green-100 text-green-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} disabled:opacity-50`}>
          {saved ? <><Check size={16} /> Đã lưu</> : <><Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}</>}
        </button>
      </div>

      {msg && <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium flex items-center gap-2"><CheckCircle size={16} /> {msg}</div>}
      {err && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2"><AlertCircle size={16} /> {err}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition border-b-2 -mb-px ${tab === id ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {tab === 'brand' && (
          <>
            {/* Domain */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe size={18} className="text-indigo-500" />
                <h2 className="font-bold text-slate-800">Tên miền</h2>
              </div>
              <input type="text" value={config.domain} readOnly
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>

            {/* Branding */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-indigo-500" />
                <h2 className="font-bold text-slate-800">Thương hiệu</h2>
              </div>

              <Input label="Tên đại lý" value={config.name} onChange={v => setField('name', v)} placeholder="Tên hiển thị" />

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">URL Logo</label>
                <input type="url" value={config.logo_url} onChange={e => setField('logo_url', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                {config.logo_url && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 inline-block">
                    <img src={config.logo_url} alt="Logo preview" className="h-12 w-auto"
                      onError={e => { e.target.style.display = 'none'; }} />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-indigo-500" /> URL Favicon
                </label>
                <input type="url" value={config.favicon_url} onChange={e => setField('favicon_url', e.target.value)}
                  placeholder="https://example.com/favicon.ico hoặc favicon.png"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <p className="text-[11px] text-slate-400 mt-1">Khuyến nghị 32×32 hoặc 64×64 px (.ico, .png, .svg)</p>
                {config.favicon_url && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 inline-flex items-center gap-3">
                    <img src={config.favicon_url} alt="Favicon preview" className="w-8 h-8"
                      onError={e => { e.target.style.display = 'none'; }} />
                    <span className="text-xs text-slate-500">Xem trước favicon</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Màu chủ đạo</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={config.primary_color} onChange={e => setField('primary_color', e.target.value)}
                    className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer p-1" />
                  <input type="text" value={config.primary_color} onChange={e => setField('primary_color', e.target.value)}
                    placeholder="#0ea5e9"
                    className="w-40 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  <div className="w-20 h-10 rounded-lg" style={{ backgroundColor: config.primary_color }} />
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'payment' && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Bật tắt từng cổng độc lập. Buyer sẽ thấy đúng các cổng đang bật. Thông tin nhạy cảm (API key, secret) chỉ lưu trong DB của agency, không lộ ra public.
            </div>

            {/* SePay */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-blue-500" />
                  <h2 className="font-bold text-slate-800">SePay (chuyển khoản tự động)</h2>
                </div>
                <Toggle value={pc.sepay.enabled} onChange={v => setPay('sepay', 'enabled', v)} />
              </div>
              {pc.sepay.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Tên ngân hàng" value={pc.sepay.bankName} onChange={v => setPay('sepay', 'bankName', v)} placeholder="VD: Techcombank" />
                  <Input label="Chủ tài khoản" value={pc.sepay.accountHolder} onChange={v => setPay('sepay', 'accountHolder', v)} placeholder="NGUYEN VAN A" />
                  <Input label="Số tài khoản" value={pc.sepay.accountNumber} onChange={v => setPay('sepay', 'accountNumber', v)} placeholder="0123456789" mono />
                  <Input label="API Key (SePay)" value={pc.sepay.apiKey} onChange={v => setPay('sepay', 'apiKey', v)} placeholder="sepay_xxx" type="password" mono />
                  <div className="md:col-span-2">
                    <Input label="Webhook Secret" value={pc.sepay.webhookSecret} onChange={v => setPay('sepay', 'webhookSecret', v)} placeholder="Tạo chuỗi ngẫu nhiên dùng để verify webhook" type="password" mono />
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1"><Webhook size={11} /> Webhook URL: <code className="bg-slate-100 px-1.5 py-0.5 rounded">https://{config.domain}/api/agencies/webhook/sepay</code></p>
                  </div>
                </div>
              )}
            </div>

            {/* 666Pay */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-rose-500" />
                  <h2 className="font-bold text-slate-800">666Pay</h2>
                </div>
                <Toggle value={pc.pay666.enabled} onChange={v => setPay('pay666', 'enabled', v)} />
              </div>
              {pc.pay666.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Merchant ID" value={pc.pay666.merchantId} onChange={v => setPay('pay666', 'merchantId', v)} placeholder="MID_xxx" mono />
                  <Input label="Endpoint" value={pc.pay666.endpoint} onChange={v => setPay('pay666', 'endpoint', v)} placeholder="https://api.666pay.com" />
                  <Input label="API Key" value={pc.pay666.apiKey} onChange={v => setPay('pay666', 'apiKey', v)} placeholder="api_key" type="password" mono />
                  <Input label="Secret" value={pc.pay666.secret} onChange={v => setPay('pay666', 'secret', v)} placeholder="secret" type="password" mono />
                </div>
              )}
            </div>

            {/* Manual Bank */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-500" />
                  <h2 className="font-bold text-slate-800">Ngân hàng thủ công</h2>
                </div>
                <Toggle value={pc.manualBank.enabled} onChange={v => setPay('manualBank', 'enabled', v)} />
              </div>
              {pc.manualBank.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Tên ngân hàng" value={pc.manualBank.bankName} onChange={v => setPay('manualBank', 'bankName', v)} placeholder="VD: Vietcombank" />
                  <Input label="Chủ tài khoản" value={pc.manualBank.accountHolder} onChange={v => setPay('manualBank', 'accountHolder', v)} placeholder="NGUYEN VAN A" />
                  <Input label="Số tài khoản" value={pc.manualBank.accountNumber} onChange={v => setPay('manualBank', 'accountNumber', v)} placeholder="0123456789" mono />
                  <Input label="Chi nhánh (tuỳ chọn)" value={pc.manualBank.branch} onChange={v => setPay('manualBank', 'branch', v)} placeholder="HCM" />
                </div>
              )}
            </div>

            {/* Crypto BEP20 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins size={18} className="text-emerald-500" />
                  <h2 className="font-bold text-slate-800">Crypto USDT (BEP20)</h2>
                </div>
                <Toggle value={pc.bep20.enabled} onChange={v => setPay('bep20', 'enabled', v)} />
              </div>
              {pc.bep20.enabled && (
                <div className="space-y-4">
                  <Input label="Địa chỉ ví nhận BEP20" value={pc.bep20.address} onChange={v => setPay('bep20', 'address', v)} placeholder="0x..." mono />
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Tự động xác nhận</p>
                      <p className="text-xs text-slate-400">Polling BSC mỗi 60s để tự cộng tiền</p>
                    </div>
                    <Toggle value={pc.bep20.auto} onChange={v => setPay('bep20', 'auto', v)} />
                  </div>
                </div>
              )}
            </div>

            {/* Crypto TRC20 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins size={18} className="text-violet-500" />
                  <h2 className="font-bold text-slate-800">Crypto USDT (TRC20)</h2>
                </div>
                <Toggle value={pc.trc20.enabled} onChange={v => setPay('trc20', 'enabled', v)} />
              </div>
              {pc.trc20.enabled && (
                <div className="space-y-4">
                  <Input label="Địa chỉ ví nhận TRC20" value={pc.trc20.address} onChange={v => setPay('trc20', 'address', v)} placeholder="T..." mono />
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Tự động xác nhận</p>
                      <p className="text-xs text-slate-400">Polling Tron mỗi 60s để tự cộng tiền</p>
                    </div>
                    <Toggle value={pc.trc20.auto} onChange={v => setPay('trc20', 'auto', v)} />
                  </div>
                </div>
              )}
            </div>

            {/* Tỷ giá */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <Input label="Tỷ giá USDT (1 USDT = ? VNĐ) — để trống = lấy CoinGecko" value={pc.vndRate} onChange={v => setPayRoot('vndRate', v)} placeholder="VD: 26000" type="number" />
            </div>
          </>
        )}

        {tab === 'contact' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Phone size={18} className="text-indigo-500" />
              <h2 className="font-bold text-slate-800">Liên hệ</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input label="Email" value={config.contact_email} onChange={v => setField('contact_email', v)} placeholder="support@agency.com" type="email" />
              <Input label="Số điện thoại" value={config.contact_phone} onChange={v => setField('contact_phone', v)} placeholder="0912 345 678" type="tel" />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition ${saved
              ? 'bg-green-100 text-green-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} disabled:opacity-50`}>
            {saved ? <><Check size={16} /> Đã lưu</> : <><Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
