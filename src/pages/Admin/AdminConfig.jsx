import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Save, Check, Settings2, Wallet, Send, RefreshCw, ExternalLink,
  CheckCircle2, XCircle, Clock, Zap, AlertTriangle, TrendingUp, Bell
} from 'lucide-react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

const UsdtIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path d="M17.9 17.05v-.03c-.1 0-.71.04-2 .04-1 0-1.72-.04-1.96-.04v.03c-3.47-.15-6.06-.8-6.06-1.58 0-.78 2.59-1.43 6.06-1.58v2.52c.25.02.98.06 1.98.06 1.2 0 1.77-.05 1.98-.06v-2.52c3.46.15 6.04.8 6.04 1.58 0 .78-2.58 1.43-6.04 1.58zm0-3.42V11.5h4.46V8.5H9.63v3h4.43v2.13c-3.93.18-6.88 1.02-6.88 2.02s2.95 1.84 6.88 2.02v7.23h3.84v-7.23c3.91-.18 6.85-1.02 6.85-2.02s-2.94-1.84-6.85-2.02z" fill="#fff" />
  </svg>
);

const VUOTLINK_FIELDS = [
  { key: 'views_per_ip', label: 'Giới hạn lượt xem / IP', description: 'Số lần tối đa 1 IP có thể vượt link trong 1 ngày', type: 'number', defaultValue: '5', min: 1, max: 100 },
  { key: 'vuotlink_min_time', label: 'Thời gian tối thiểu (giây)', description: 'Thời gian tối thiểu worker phải ở trên trang trước khi nhập code', type: 'number', defaultValue: '30', min: 5, max: 600 },
  { key: 'vuotlink_cooldown', label: 'Thời gian chờ giữa các task (giây)', description: 'Khoảng thời gian tối thiểu giữa 2 lần vượt link của 1 worker', type: 'number', defaultValue: '0', min: 0, max: 3600 },
  { key: 'vuotlink_max_daily_tasks', label: 'Số task tối đa / worker / ngày', description: 'Giới hạn số nhiệm vụ mỗi worker có thể làm trong 1 ngày (0 = không giới hạn)', type: 'number', defaultValue: '0', min: 0, max: 9999 },
  { key: 'captcha_enabled', label: 'Bật Captcha khi lấy code', description: 'Yêu cầu xác minh hCaptcha trước khi hiển thị mã code cho worker', type: 'toggle', defaultValue: 'true' },
];

const WITHDRAW_FIELDS = [
  { key: 'withdraw_bank_enabled', label: 'Cho phép rút qua Ngân hàng', description: 'Bật/tắt phương thức rút tiền qua chuyển khoản ngân hàng', type: 'toggle', defaultValue: 'true' },
  { key: 'withdraw_crypto_enabled', label: 'Cho phép rút qua Crypto', description: 'Bật/tắt phương thức rút tiền qua ví tiền mã hóa (USDT BEP20)', type: 'toggle', defaultValue: 'true' },
];

const DEPOSIT_FIELDS = [
  { key: 'deposit_bank_enabled', label: 'Cho phép nạp qua Ngân hàng', description: 'Bật/tắt phương thức nạp tiền qua chuyển khoản ngân hàng', type: 'toggle', defaultValue: 'false' },
  { key: 'deposit_bank_name', label: 'Tên ngân hàng', description: 'VD: Techcombank, Vietcombank,...', type: 'text', defaultValue: '' },
  { key: 'deposit_bank_account', label: 'Số tài khoản', description: 'Số tài khoản ngân hàng nhận tiền', type: 'text', defaultValue: '' },
  { key: 'deposit_bank_holder', label: 'Chủ tài khoản', description: 'Tên chủ tài khoản ngân hàng', type: 'text', defaultValue: '' },
  { key: 'deposit_bank_branch', label: 'Chi nhánh (tùy chọn)', description: 'Chi nhánh ngân hàng', type: 'text', defaultValue: '' },
  { key: 'deposit_crypto_enabled', label: 'Cho phép nạp qua Crypto (BEP20)', description: 'Bật/tắt nạp tiền bằng USDT (BEP20)', type: 'toggle', defaultValue: 'false' },
  { key: 'deposit_crypto_address', label: 'Địa chỉ ví nhận USDT (BEP20)', description: 'Ví BEP20 nhận tiền nạp', type: 'text', defaultValue: '' },
  { key: 'deposit_crypto_auto', label: 'Tự động xác nhận nạp BEP20', description: 'Polling BSC mỗi 60s để tự động cộng tiền', type: 'toggle', defaultValue: 'false' },
  { key: 'deposit_trc20_enabled', label: 'Cho phép nạp qua Crypto (TRC20)', description: 'Bật/tắt nạp tiền bằng USDT (TRC20)', type: 'toggle', defaultValue: 'false' },
  { key: 'deposit_trc20_address', label: 'Địa chỉ ví nhận USDT (TRC20)', description: 'Ví TRC20 nhận tiền nạp', type: 'text', defaultValue: '' },
  { key: 'deposit_trc20_auto', label: 'Tự động xác nhận nạp TRC20', description: 'Polling Tron mỗi 60s để tự động cộng tiền', type: 'toggle', defaultValue: 'false' },
  { key: 'deposit_crypto_min_usdt', label: 'Nạp tối thiểu (USDT)', description: 'Số USDT tối thiểu cho mỗi đơn nạp', type: 'number', defaultValue: '1', min: 0 },
];

// Web3 fields saved to DB (NOT including private key)
const WEB3_DB_FIELDS = [
  { key: 'web3_enabled', label: 'Bật Web3 Auto Payment', description: 'Tự động gửi USDT (BEP20) trên BSC Mainnet', type: 'toggle', defaultValue: 'false' },
  { key: 'web3_vnd_rate', label: 'Tỷ giá (1 USDT = ? VNĐ)', description: 'Để trống = tự động lấy từ CoinGecko', type: 'number', defaultValue: '', min: 0 },
  { key: 'web3_gas_limit', label: 'Gas Limit', description: 'Mặc định 100000. Thường không cần thay đổi', type: 'number', defaultValue: '', min: 21000 },
  { key: 'web3_auto_approve', label: 'Tự động gửi khi duyệt', description: 'Khi admin duyệt rút crypto → tự động gửi USDT', type: 'toggle', defaultValue: 'false' },
];

const ANNOUNCEMENT_FIELDS = [
  { key: 'worker_announcement_enabled', label: 'Hiển thị thông báo cho Worker', description: 'Bật/tắt banner thông báo trên trang Tổng quan của worker', type: 'toggle', defaultValue: 'false' },
  {
    key: 'worker_announcement_type', label: 'Loại thông báo Worker', description: 'Màu sắc và kiểu thông báo worker', type: 'select', defaultValue: 'info', options: [
      { value: 'info', label: '🔵 Info (Xanh dương)' },
      { value: 'warning', label: '🟡 Warning (Vàng)' },
      { value: 'success', label: '🟢 Success (Xanh lá)' },
      { value: 'error', label: '🔴 Error (Đỏ)' },
    ]
  },
];

const BUYER_ANNOUNCEMENT_FIELDS = [
  { key: 'buyer_announcement_enabled', label: 'Hiển thị thông báo cho Buyer', description: 'Bật/tắt banner thông báo trên trang Tổng quan của buyer', type: 'toggle', defaultValue: 'false' },
  {
    key: 'buyer_announcement_type', label: 'Loại thông báo Buyer', description: 'Màu sắc và kiểu thông báo buyer', type: 'select', defaultValue: 'info', options: [
      { value: 'info', label: '🔵 Info (Xanh dương)' },
      { value: 'warning', label: '🟡 Warning (Vàng)' },
      { value: 'success', label: '🟢 Success (Xanh lá)' },
      { value: 'error', label: '🔴 Error (Đỏ)' },
    ]
  },
];

const ALL_CONFIG_FIELDS = [...VUOTLINK_FIELDS, ...DEPOSIT_FIELDS, ...WITHDRAW_FIELDS, ...WEB3_DB_FIELDS, ...ANNOUNCEMENT_FIELDS, ...BUYER_ANNOUNCEMENT_FIELDS];

// LocalStorage key for private key
const PK_STORAGE_KEY = 'web3_hot_wallet_pk';

export default function AdminConfig() {
  usePageTitle('Admin - Cấu hình');
  const toast = useToast();
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Private key (localStorage only, never sent to DB)
  const [privateKey, setPrivateKey] = useState(() => {
    try { return localStorage.getItem(PK_STORAGE_KEY) || ''; } catch { return ''; }
  });

  // Web3 state
  const [web3Status, setWeb3Status] = useState(null);
  const [pendingCrypto, setPendingCrypto] = useState([]);
  const [web3Payments, setWeb3Payments] = useState([]);
  const [payingId, setPayingId] = useState(null);
  const [batchPaying, setBatchPaying] = useState(false);
  const [web3Tab, setWeb3Tab] = useState('history');

  useEffect(() => {
    api.get('/admin/settings/site')
      .then(d => {
        const c = d.config || {};
        ALL_CONFIG_FIELDS.forEach(f => {
          if (c[f.key] === undefined) c[f.key] = f.defaultValue;
        });
        setConfig(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    fetchWeb3();
  }, []);

  const fetchWeb3 = useCallback(async () => {
    try {
      const pk = localStorage.getItem(PK_STORAGE_KEY) || '';
      const [s, w, p] = await Promise.all([
        api.post('/admin/web3/status', { privateKey: pk }).catch(() => ({ enabled: false })),
        api.get('/admin/worker-withdrawals?status=pending').catch(() => ({ withdrawals: [] })),
        api.get('/admin/web3/payments').catch(() => ({ payments: [] })),
      ]);
      setWeb3Status(s);
      setPendingCrypto((w.withdrawals || []).filter(x => (x.note || '').includes('[Crypto]')));
      setWeb3Payments(p.payments || []);
    } catch { }
  }, []);

  const updateField = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const handleSavePrivateKey = (val) => {
    setPrivateKey(val);
    try { localStorage.setItem(PK_STORAGE_KEY, val); } catch { }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = {};
      ALL_CONFIG_FIELDS.forEach(f => { settings[f.key] = config[f.key] ?? f.defaultValue; });
      settings.worker_announcement = config.worker_announcement || '';
      settings.buyer_announcement = config.buyer_announcement || '';
      await api.put('/admin/settings/site', { settings });
      toast.success('Cấu hình đã được lưu');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      fetchWeb3();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handlePay = async (id) => {
    if (!privateKey) { toast.error('Chưa nhập Private Key!'); return; }
    if (!await toast.confirm('Xác nhận gửi USDT (BEP20) cho yêu cầu này?')) return;
    setPayingId(id);
    try {
      const d = await api.post(`/admin/web3/pay/${id}`, { privateKey });
      toast.success(d.message || 'Thanh toán thành công');
      fetchWeb3();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    setPayingId(null);
  };

  const handleBatchPay = async () => {
    if (!privateKey) { toast.error('Chưa nhập Private Key!'); return; }
    if (!await toast.confirm(`Gửi USDT cho ${pendingCrypto.length} yêu cầu?`)) return;
    setBatchPaying(true);
    try {
      const d = await api.post('/admin/web3/batch-pay', { privateKey });
      toast.success(`${d.success}/${d.total} thành công`);
      fetchWeb3();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    setBatchPaying(false);
  };

  const renderField = (field) => (
    <div key={field.key} className="px-6 py-4 flex items-center justify-between gap-6">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-slate-700">{field.label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{field.description}</p>
      </div>
      <div className="shrink-0">
        {field.type === 'toggle' ? (
          <button type="button"
            onClick={() => updateField(field.key, config[field.key] === 'true' ? 'false' : 'true')}
            className={`relative inline-flex w-14 h-7 rounded-full transition-colors duration-200 ${config[field.key] === 'true' ? 'bg-green-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${config[field.key] === 'true' ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        ) : field.type === 'select' ? (
          <select
            value={config[field.key] || field.defaultValue}
            onChange={e => updateField(field.key, e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
            {(field.options || []).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : field.type === 'text' ? (
          <input type="text"
            value={config[field.key] || ''}
            onChange={e => updateField(field.key, e.target.value)}
            placeholder={field.defaultValue || '...'}
            className="w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        ) : (
          <input type={field.type} min={field.min} max={field.max}
            value={config[field.key] || ''}
            onChange={e => updateField(field.key, e.target.value)}
            className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 text-right focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Cấu hình hệ thống</h1>
          <p className="text-sm text-slate-500 mt-1">Cài đặt Vượt Link, rút tiền, Web3 Payment</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition ${saved
            ? 'bg-green-100 text-green-700'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'} disabled:opacity-50`}>
          {saved ? <><Check size={16} /> Đã lưu</> : <><Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}</>}
        </button>
      </div>

      {/* Vuot Link Settings */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Settings2 size={16} className="text-indigo-500" />
          <h2 className="font-bold text-slate-800">Cài đặt Vượt Link</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {VUOTLINK_FIELDS.map(renderField)}
        </div>
      </div>

      {/* Deposit Settings */}
      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 flex items-center gap-2">
          <Wallet size={16} className="text-indigo-500" />
          <h2 className="font-bold text-slate-800">Cài đặt Nạp tiền (Buyer)</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {DEPOSIT_FIELDS.map(renderField)}
        </div>
      </div>

      {/* Withdraw Settings */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Wallet size={16} className="text-green-500" />
          <h2 className="font-bold text-slate-800">Cài đặt Rút tiền (Worker)</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {WITHDRAW_FIELDS.map(renderField)}
        </div>
      </div>

      {/* Web3 USDT Payment */}
      <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsdtIcon size={20} />
            <h2 className="font-bold text-slate-800">Web3 Auto Payment — USDT (BEP20)</h2>
          </div>
          <button onClick={fetchWeb3} className="p-1.5 hover:bg-white/50 rounded-lg transition">
            <RefreshCw size={14} className="text-slate-400" />
          </button>
        </div>

        {/* Web3 Config Fields (saved to DB) */}
        <div className="divide-y divide-slate-100">
          {WEB3_DB_FIELDS.map(renderField)}
        </div>

        {/* Private Key — localStorage only */}
        <div className="px-6 py-4 border-t border-slate-100">
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-700">Private Key (Hot Wallet)</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Lưu trên trình duyệt của bạn (localStorage)
              </p>
            </div>
            <input type="password" value={privateKey}
              onChange={e => handleSavePrivateKey(e.target.value)}
              placeholder="0x..."
              className="w-64 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
        </div>

        {/* Warning */}
        <div className="mx-6 my-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-amber-700">
            <strong>Private Key lưu ở trình duyệt</strong> — chỉ admin thấy được. Key được gửi tới server khi thanh toán nhưng <strong>không lưu vào database</strong>.
            Dùng hot wallet riêng biệt, nạp USDT (BEP20) + ~0.01 BNB (gas).
          </p>
        </div>

        {/* Web3 Status Cards */}
        {web3Status?.enabled && (
          <div className="px-6 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-slate-500 mb-1">Hot Wallet</p>
                <p className="text-sm font-black text-slate-800">{Number(web3Status.hotWallet?.usdtBalance || 0).toFixed(2)} USDT</p>
                <p className="text-[10px] text-slate-400">{Number(web3Status.hotWallet?.bnbBalance || 0).toFixed(4)} BNB (gas)</p>
                <p className="text-[9px] text-slate-400 font-mono truncate mt-1">{web3Status.hotWallet?.address}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-slate-500 mb-1">Chờ thanh toán</p>
                <p className="text-sm font-black text-slate-800">{web3Status.pendingWithdrawals?.count || 0}</p>
                <p className="text-[10px] text-slate-400">{fmt(web3Status.pendingWithdrawals?.totalVND || 0)} VNĐ</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-slate-500 mb-1">24h qua</p>
                <p className="text-sm font-black text-slate-800">{web3Status.last24h?.count || 0} tx</p>
                <p className="text-[10px] text-slate-400">{Number(web3Status.last24h?.totalCrypto || 0).toFixed(2)} USDT</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment history */}
        {web3Status?.enabled && (
          <div className="border-t border-slate-200">
            <div className="flex gap-0 border-b border-slate-100">
              {[['history', 'Lịch sử giao dịch Web3']].map(([k, l]) => (
                <button key={k} onClick={() => setWeb3Tab(k)}
                  className={`px-4 py-2.5 text-xs font-bold transition ${web3Tab === k ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-600'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Payment history */}
            {web3Tab === 'history' && (
              <div className="p-4">
                {web3Payments.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-6">Chưa có giao dịch Web3</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-500">TxHash</th>
                          <th className="px-3 py-2 text-left text-slate-500">Worker</th>
                          <th className="px-3 py-2 text-right text-slate-500">VNĐ</th>
                          <th className="px-3 py-2 text-right text-slate-500">USDT</th>
                          <th className="px-3 py-2 text-center text-slate-500">Status</th>
                          <th className="px-3 py-2 text-right text-slate-500">Ngày</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {web3Payments.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/70">
                            <td className="px-3 py-2">
                              <a href={p.explorer_url} target="_blank" rel="noopener noreferrer"
                                className="font-mono text-indigo-600 hover:underline flex items-center gap-1">
                                {p.tx_hash?.slice(0, 10)}...{p.tx_hash?.slice(-4)}
                                <ExternalLink size={9} />
                              </a>
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-800">{p.user_name || '—'}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{fmt(p.amount_vnd)} đ</td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-600">{Number(p.amount_crypto).toFixed(2)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold
                                ${p.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                {p.status === 'success' ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                                {p.status === 'success' ? 'OK' : 'Fail'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-400">
                              {new Date(p.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Worker Announcement */}
      <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center gap-2">
          <Bell size={16} className="text-amber-600" />
          <h2 className="font-bold text-slate-800">Thông báo cho Worker</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {ANNOUNCEMENT_FIELDS.map(renderField)}
        </div>
        {/* Nội dung thông báo: textarea riêng */}
        <div className="px-6 py-4 border-t border-slate-100">
          <p className="font-semibold text-sm text-slate-700 mb-1">Nội dung thông báo</p>
          <p className="text-xs text-slate-400 mb-3">Hiển thị trên trang Tổng quan của worker. Hỗ trợ nhiều dòng.</p>
          <textarea
            rows={4}
            value={config.worker_announcement || ''}
            onChange={e => updateField('worker_announcement', e.target.value)}
            placeholder="VD: Hệ thống sẽ bảo trì từ 23:00 đến 01:00 ngày mai. Cảm ơn bạn đã sử dụng dịch vụ!"
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all resize-none"
          />
        </div>
        {/* Preview */}
        {config.worker_announcement && (
          <div className="px-6 pb-5">
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Preview</p>
            <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium ${config.worker_announcement_type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                config.worker_announcement_type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                  config.worker_announcement_type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
              <Bell size={15} className="mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed whitespace-pre-line">{config.worker_announcement}</p>
            </div>
          </div>
        )}
      </div>

      {/* Buyer Announcement */}
      <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-indigo-200 flex items-center gap-2">
          <Bell size={16} className="text-indigo-600" />
          <h2 className="font-bold text-slate-800">Thông báo cho Buyer</h2>
          <span className="ml-auto text-xs font-semibold text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">Hiển trên dashboard buyer</span>
        </div>
        <div className="divide-y divide-slate-100">
          {BUYER_ANNOUNCEMENT_FIELDS.map(renderField)}
        </div>
        <div className="px-6 py-4 border-t border-slate-100">
          <p className="font-semibold text-sm text-slate-700 mb-1">Nội dung thông báo</p>
          <p className="text-xs text-slate-400 mb-3">Hiển thị trên trang Tổng quan của buyer. Hỗ trợ nhiều dòng.</p>
          <textarea
            rows={4}
            value={config.buyer_announcement || ''}
            onChange={e => updateField('buyer_announcement', e.target.value)}
            placeholder="VD: Chúng tôi đang nâng cấp hệ thống. Một số tính năng có thể bị ảnh hưởng tạm thời."
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none"
          />
        </div>
        {config.buyer_announcement && (
          <div className="px-6 pb-5">
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Preview</p>
            <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium ${
              config.buyer_announcement_type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
              config.buyer_announcement_type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              config.buyer_announcement_type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <Bell size={15} className="mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed whitespace-pre-line">{config.buyer_announcement}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
