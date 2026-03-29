import { useState, useEffect, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useToast } from '../../components/Toast';
import {
  Wallet, Gift, Banknote, ArrowRight, ArrowLeftRight,
  Info, LogOut, X, Copy, Check, Clock, ExternalLink, RefreshCw, ArrowDownLeft
} from 'lucide-react';
import api from '../../lib/api';
import Breadcrumb from '../../components/Breadcrumb';
import { formatMoney as fmt } from '../../lib/format';

const QUICK = [100000, 200000, 500000, 1000000, 2000000, 5000000];

const UsdtIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path d="M17.9 17.05v-.03c-.1 0-.71.04-2 .04-1 0-1.72-.04-1.96-.04v.03c-3.47-.15-6.06-.8-6.06-1.58 0-.78 2.59-1.43 6.06-1.58v2.52c.25.02.98.06 1.98.06 1.2 0 1.77-.05 1.98-.06v-2.52c3.46.15 6.04.8 6.04 1.58 0 .78-2.58 1.43-6.04 1.58zm0-3.42V11.5h4.46V8.5H9.63v3h4.43v2.13c-3.93.18-6.88 1.02-6.88 2.02s2.95 1.84 6.88 2.02v7.23h3.84v-7.23c3.91-.18 6.85-1.02 6.85-2.02s-2.94-1.84-6.85-2.02z" fill="#fff" />
  </svg>
);

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-800">{value}</span>
        <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition">
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
        </button>
      </div>
    </div>
  );
}

/* ── Commission action modal ── */
function CommissionModal({ mode, balance, onConfirm, onClose }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('transfer');
  const isTransfer = mode === 'transfer';
  const num = Number(amount);
  const valid = num > 0 && num <= balance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
      <div className="relative bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-md p-7 z-10 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Premium header background shape */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-indigo-50 to-white -z-10" />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm border ${isTransfer ? 'bg-indigo-50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
              {isTransfer ? <ArrowLeftRight size={18} className="text-indigo-600" /> : <LogOut size={18} className="text-red-500" />}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">
                {isTransfer ? 'Chuyển sang Ví Traffic' : 'Rút tiền về tài khoản'}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Số dư: <strong className="text-amber-600 tabular-nums">{fmt(balance)} đ</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors bg-white shadow-sm border border-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Chọn nhanh</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK.slice(0, 6).map(q => {
                const capped = Math.min(q, balance);
                const isSelected = amount === String(capped);
                return (
                  <button key={q} type="button" onClick={() => setAmount(String(capped))}
                    className={`py-2 text-[11px] font-bold rounded-xl outline-none transition-all duration-200
                      ${isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:shadow-sm hover:text-indigo-600'}`}>
                    {fmt(capped)} đ
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Số tiền tùy chỉnh</p>
            <div className="relative">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                max={balance} min="1000" placeholder="Nhập số tiền..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-12" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VNĐ</span>
            </div>
          </div>
          <div className="flex gap-2.5 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-sm rounded-xl transition-all shadow-sm">
              Hủy
            </button>
            <button type="button" disabled={!valid} onClick={() => onConfirm(num, isTransfer ? 'transfer' : method)}
              className={`flex-1 py-3 text-white font-bold text-sm rounded-xl transition-all shadow-md
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isTransfer
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-200'
                  : 'bg-gradient-to-r from-red-500 to-red-400 hover:from-red-400 hover:to-red-300 shadow-red-200'}`}>
              {isTransfer ? 'Xác nhận chuyển' : 'Tạo lệnh rút'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Crypto deposit result panel ── */
function CryptoDepositPanel({ data, onClose }) {
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const isTrc20 = data.network === 'TRC20';
  const networkLabel = isTrc20 ? 'Tron (TRC20)' : 'BSC (BEP20)';
  const themeAccent = isTrc20 ? 'red' : 'emerald';

  return (
    <div className={`relative bg-white border border-${themeAccent}-100 rounded-3xl p-6 shadow-sm overflow-hidden`}>
      {/* Background decoration */}
      <div className={`absolute top-0 right-0 w-64 h-64 bg-${themeAccent}-50 rounded-full blur-3xl -mx-20 -my-20 opacity-50 pointer-events-none`} />

      <div className="relative space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 bg-gradient-to-br from-${themeAccent}-100 to-${themeAccent}-50 rounded-xl flex items-center justify-center border border-${themeAccent}-100 shadow-sm`}>
              <UsdtIcon size={24} />
            </div>
            <div>
              <h3 className={`font-black text-slate-800 text-lg tracking-tight`}>Gửi USDT để hoàn tất</h3>
              <p className={`text-[11px] font-semibold text-${themeAccent}-600 bg-${themeAccent}-50 inline-block px-2 py-0.5 rounded-md mt-1`}>
                {data.auto ? '⚡ Tự động xác nhận sau khi nhận USDT' : '⏳ Admin sẽ xác nhận thủ công'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors bg-white shadow-sm border border-slate-200">
            <X size={16} />
          </button>
        </div>

        {/* Amount to send */}
        <div className={`bg-gradient-to-br from-white to-${themeAccent}-50/30 rounded-2xl p-5 border border-${themeAccent}-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]`}>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Số USDT cần gửi (chính xác)</p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <p className={`text-4xl font-black text-${themeAccent}-600 tracking-tight leading-none`}>{data.usdtAmount}</p>
              <span className={`text-sm font-bold text-${themeAccent}-400`}>USDT</span>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(String(data.usdtAmount)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className={`shrink-0 px-4 py-2 bg-white hover:bg-${themeAccent}-50 border border-${themeAccent}-200 rounded-xl text-xs font-bold text-${themeAccent}-600 flex items-center gap-1.5 transition-all shadow-sm`}>
              {copied ? <><Check size={14} className="text-emerald-500" /> Đã copy</> : <><Copy size={14} /> Copy số lượng</>}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3 text-[11px] font-medium text-slate-500">
            <div className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600">≈ {fmt(data.amount)} VNĐ</div>
            <span>•</span>
            <span>Tỷ giá: 1 USDT = {fmt(data.rate)} VNĐ</span>
          </div>
        </div>

        {/* Deposit address */}
        <div className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group`}>
          <div className={`absolute top-0 left-0 w-1 h-full bg-${themeAccent}-500`} />
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Địa chỉ ví nhận</p>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${isTrc20 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
              MẠNG: {networkLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50/80 rounded-xl p-3 border border-slate-200 group-hover:bg-indigo-50/30 group-hover:border-indigo-100 transition-colors">
            <code className="text-[13px] font-mono font-semibold text-slate-800 break-all flex-1">{data.depositAddress}</code>
            <button onClick={() => { navigator.clipboard.writeText(data.depositAddress); }}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 hover:text-indigo-600 transition shrink-0 text-slate-500">
              <Copy size={14} />
            </button>
          </div>
          <div className={`flex items-start gap-2 mt-3 ${isTrc20 ? 'text-red-600 bg-red-50/50' : 'text-amber-600 bg-amber-50/50'} p-2.5 rounded-lg border border-transparent`}>
            <Info size={14} className="shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold leading-relaxed">
              <span className="font-extrabold uppercase mr-1">Lưu ý mạng lưới:</span>
              Chỉ gửi USDT trên đúng mạng <strong>{networkLabel}</strong>. Việc gửi sai mạng sẽ dẫn đến mất tiền và không thể hoàn hồi.
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
          <div className="w-10 h-10 rounded-full bg-white border border-blue-100 shadow-sm flex items-center justify-center shrink-0">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock size={12} className="text-blue-600 animate-spin-slow" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-800">Đang chờ giao dịch...</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs font-semibold text-blue-500 tracking-tight">
                Mã LH: <span className="font-bold text-blue-600">{data.refCode}</span>
              </p>
              <div className="w-1 h-1 rounded-full bg-blue-300" />
              <p className="text-xs font-bold text-blue-600 font-mono">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function Deposit() {
  usePageTitle('Quản lý ví');
  const toast = useToast();
  const [wallets, setWallets] = useState({ main: { balance: 0 }, commission: { balance: 0 } });
  const [method, setMethod] = useState('bank');
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [modal, setModal] = useState(null);
  const [depositConfig, setDepositConfig] = useState(null);
  const [cryptoResult, setCryptoResult] = useState(null);

  const fetchWallets = () => {
    api.get('/finance').then(data => {
      setWallets({
        main: { balance: data.wallets?.main?.balance || 0 },
        commission: { balance: data.wallets?.commission?.balance || 0 },
      });
    }).catch(console.error);
  };

  useEffect(() => {
    fetchWallets();
    api.get('/finance/deposit-config').then(setDepositConfig).catch(console.error);
  }, []);

  const handleDeposit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num < 10000) { toast.error('Số tiền nạp tối thiểu là 10.000 VNĐ'); return; }
    setProcessing(true);
    try {
      if (method === 'bep20' || method === 'trc20') {
        const data = await api.post('/finance/deposits', { amount: num, method });
        setCryptoResult({ ...data, amount: num });
        setAmount('');
      } else {
        const methodMap = { bank: 'bank_transfer' };
        const data = await api.post('/finance/deposits', { amount: num, method: methodMap[method] || method });
        setAmount('');
        toast.success(`Đơn nạp ${fmt(num)} đ đã gửi! Mã: ${data.refCode}. Vui lòng chờ admin xác minh.`, 'Nạp tiền');
        fetchWallets();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCommissionAction = async (num, meth) => {
    setModal(null);
    if (meth === 'transfer') {
      try {
        const data = await api.post('/finance/transfer', { amount: num });
        toast.success(data.message || `Đã chuyển ${fmt(num)} đ sang Ví Traffic`, 'Chuyển ví');
        fetchWallets();
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const bankEnabled = depositConfig?.bank?.enabled;
  const cryptoEnabled = depositConfig?.crypto?.enabled;
  const trc20Enabled = depositConfig?.trc20?.enabled;
  const methods = [];
  if (bankEnabled) methods.push({ id: 'bank', label: 'Ngân hàng', Icon: Banknote, color: 'bg-blue-600', border: 'border-blue-200', bg: 'bg-blue-50' });
  if (cryptoEnabled) methods.push({ id: 'bep20', label: 'USDT (BEP20)', icon: 'usdt', color: 'bg-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50' });
  if (trc20Enabled) methods.push({ id: 'trc20', label: 'USDT (TRC20)', icon: 'usdt', color: 'bg-red-500', border: 'border-red-200', bg: 'bg-red-50' });

  // Auto-select first available method
  useEffect(() => {
    if (methods.length > 0 && !methods.find(m => m.id === method)) {
      setMethod(methods[0].id);
    }
  }, [depositConfig]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/buyer/dashboard' },
        { label: 'Tài chính', to: '/buyer/dashboard/finance/deposit' },
        { label: 'Nạp tiền & Quản lý ví' },
      ]} />

      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/60 p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mx-20 -my-20 opacity-50 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Quản lý ví & Nạp tiền</h1>
          <p className="text-sm font-medium text-slate-500 mt-2 max-w-xl leading-relaxed">
            Nạp tiền vào Ví Traffic để mua gói, hoặc quản lý Ví Hoa Hồng từ chương trình giới thiệu.
          </p>
        </div>
      </div>

      {/* Wallet cards */}
      {/* Wallet cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Main Wallet */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 rounded-3xl p-7 text-white shadow-xl shadow-indigo-200 overflow-hidden group">
          {/* Abstract bg shapes */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl -mt-10 -mr-10" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-400 opacity-20 rounded-full blur-3xl -mb-10 -ml-10" />
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                <Wallet size={20} className="text-indigo-100" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-indigo-100 tracking-wide uppercase">Ví Traffic</p>
                <p className="text-[11px] font-medium text-indigo-300">Dùng để chạy chiến dịch</p>
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-8">
                <p className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-md">{fmt(wallets.main.balance)}</p>
                <p className="text-base font-bold text-indigo-200">VNĐ</p>
              </div>
            </div>

            <button onClick={() => document.getElementById('deposit-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full py-3.5 bg-white text-indigo-700 text-sm font-bold rounded-xl transition-all hover:bg-indigo-50 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2">
              <ArrowDownLeft size={16} /> Nạp tiền vào ví
            </button>
          </div>
        </div>

        {/* Commission Wallet */}
        <div className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 rounded-3xl p-7 text-white shadow-xl shadow-orange-200 overflow-hidden group">
          {/* Abstract bg shapes */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -mt-10 -mr-10" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-orange-400 opacity-20 rounded-full blur-3xl -mb-10 -ml-10" />

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                <Gift size={20} className="text-orange-100" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-orange-100 tracking-wide uppercase">Ví Hoa Hồng</p>
                <p className="text-[11px] font-medium text-orange-200">Từ chương trình giới thiệu</p>
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-8">
                <p className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-md">{fmt(wallets.commission.balance)}</p>
                <p className="text-base font-bold text-orange-200">VNĐ</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setModal('transfer')} disabled={wallets.commission.balance <= 0}
                className="flex items-center justify-center gap-2 py-3.5 bg-white/15 backdrop-blur-md border border-white/20 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95">
                <ArrowLeftRight size={16} /> Chuyển
              </button>
              <button onClick={() => setModal('withdraw')} disabled={wallets.commission.balance <= 0}
                className="flex items-center justify-center gap-2 py-3.5 bg-white text-orange-600 hover:bg-orange-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95">
                <LogOut size={16} /> Rút tiền
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit form */}
      <div id="deposit-form" className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-5">

          {/* Crypto result panel */}
          {cryptoResult && (
            <CryptoDepositPanel data={cryptoResult} onClose={() => { setCryptoResult(null); fetchWallets(); }} />
          )}

          {/* Payment method selector */}
          {!cryptoResult && methods.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 sm:p-8">
              <h2 className="font-extrabold text-slate-800 text-lg mb-1 tracking-tight">Phương thức nạp tiền</h2>
              <p className="text-[13px] font-medium text-slate-500 mb-6">Nạp bảo mật qua các phương thức thanh toán hỗ trợ</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {methods.map(({ id, label, Icon, icon, color, border, bg }) => {
                  const sel = method === id;
                  return (
                    <button key={id} type="button" onClick={() => setMethod(id)}
                      className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200 overflow-hidden group
                        ${sel ? `bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-2 ring-indigo-500 scale-[1.02]` : 'bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-white hover:shadow-md'}`}>
                      {sel && <div className="absolute top-0 inset-x-0 h-1 bg-indigo-500" />}
                      {icon === 'usdt' ? (
                        <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
                          <UsdtIcon size={24} />
                        </div>
                      ) : (
                        <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
                          <Icon size={24} className="text-white" />
                        </div>
                      )}
                      <span className={`text-[13px] font-bold ${sel ? 'text-indigo-700' : 'text-slate-600 group-hover:text-indigo-600'}`}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amount form */}
          {!cryptoResult && methods.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 sm:p-8">
              <h2 className="font-extrabold text-slate-800 text-lg mb-1 tracking-tight">Số tiền nạp</h2>
              <p className="text-[13px] font-medium text-slate-500 mb-6 w-full flex items-center justify-between border-b border-slate-100 pb-4">
                {method === 'bep20' || method === 'trc20'
                  ? <span>Tối thiểu <strong className="text-slate-800">{method === 'trc20' ? (depositConfig?.trc20?.minUsdt || depositConfig?.crypto?.minUsdt || 1) : (depositConfig?.crypto?.minUsdt || 1)} USDT</strong></span>
                  : <span>Tối thiểu <strong className="text-slate-800">10.000 VNĐ</strong></span>}
                {((method === 'bep20' || method === 'trc20') && depositConfig?.rate) && (
                  <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-[11px] font-bold">1 USDT ≈ {fmt(depositConfig.rate)} VNĐ</span>
                )}
              </p>

              <form onSubmit={handleDeposit} className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Chọn nhanh mệnh giá</p>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {QUICK.map(q => {
                      const sel = amount === String(q);
                      return (
                        <button key={q} type="button" onClick={() => setAmount(String(q))}
                          className={`py-3 text-[13px] font-bold rounded-xl transition-all duration-200 outline-none
                            ${sel 
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2 scale-[1.02]' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30'}`}>
                          {fmt(q)} đ
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Hoặc nhập số tiền khác</p>
                  <div className="relative group">
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="VD: 500000" min="10000" step="1000"
                      className="w-full px-5 py-4 border border-slate-200 rounded-xl text-lg font-black text-slate-800 placeholder:text-slate-300 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-16 bg-white shadow-sm group-hover:border-indigo-200" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VNĐ</span>
                  </div>
                  
                  <div className="h-6 mt-2 px-1">
                    {amount && Number(amount) >= 10000 && (method === 'bep20' || method === 'trc20') && depositConfig?.rate && (
                      <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                        <Check size={14} /> ≈ {(Number(amount) / depositConfig.rate).toFixed(4)} USDT
                      </p>
                    )}
                    {amount && Number(amount) >= 10000 && method !== 'bep20' && method !== 'trc20' && (
                      <p className="text-xs text-indigo-600 font-semibold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                        <Check size={14} /> Giá trị hợp lệ
                      </p>
                    )}
                  </div>
                </div>

                <button type="submit" disabled={processing || Number(amount) < 10000}
                  className="w-full flex items-center justify-center gap-2 py-4 font-black text-white text-base rounded-2xl
                    bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-xl shadow-indigo-200
                    transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-300 hover:-translate-y-1 active:scale-[0.98]
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-indigo-200 overflow-hidden relative">
                  <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300 rounded-2xl" />
                  <span className="relative flex items-center gap-2">
                    {processing
                      ? <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Đang xử lý...</>
                      : (method === 'bep20' || method === 'trc20')
                        ? <><UsdtIcon size={20} />Tiếp tục thanh toán Crypto <ArrowRight size={18} /></>
                        : <><Wallet size={20} />Xác nhận nạp tiền <ArrowRight size={18} /></>}
                  </span>
                </button>
              </form>
            </div>
          )}

          {/* No methods available */}
          {!cryptoResult && methods.length === 0 && depositConfig && (
            <div className="bg-amber-50/80 border border-amber-200/60 rounded-3xl p-8 text-center shadow-sm">
              <div className="w-14 h-14 bg-amber-100/80 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
                <Info size={28} className="text-amber-500" />
              </div>
              <p className="text-amber-800 font-extrabold text-lg tracking-tight mb-1.5">Chưa khả dụng</p>
              <p className="text-sm font-medium text-amber-700/80 max-w-sm mx-auto">Vui lòng liên hệ Admin qua kênh hỗ trợ để được nạp tiền vào hệ thống.</p>
            </div>
          )}
        </div>

        {/* Right 1/3 - Sidebar */}
        <div className="space-y-5">

          {/* Bank info (from admin config) */}
          {bankEnabled && depositConfig?.bank && (
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 group">
              <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-2.5 tracking-tight group-hover:text-blue-700 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                  <Banknote size={16} className="text-blue-600" />
                </div>
                Chuyển khoản Ngân hàng
              </h3>
              <div className="space-y-1 divide-y divide-slate-100/80 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <CopyField label="Ngân hàng" value={depositConfig.bank.bankName} />
                <CopyField label="Số TK" value={depositConfig.bank.accountNumber} />
                <CopyField label="Chủ TK" value={depositConfig.bank.accountHolder} />
                {depositConfig.bank.branch && <CopyField label="Chi nhánh" value={depositConfig.bank.branch} />}
              </div>
            </div>
          )}

          {/* Crypto info */}
          {(cryptoEnabled || trc20Enabled) && (
            <div className={`bg-white rounded-3xl border ${method === 'trc20' ? 'border-red-200/60' : 'border-emerald-200/60'} shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6`}>
              <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-2.5 tracking-tight">
                <div className={`w-8 h-8 rounded-lg ${method === 'trc20' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'} flex items-center justify-center border`}>
                  <UsdtIcon size={16} />
                </div>
                Tỷ giá Crypto
              </h3>
              <div className="space-y-3 text-[13px] bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Mạng</span>
                  <span className={`font-bold px-2 py-0.5 rounded-md ${method === 'trc20' ? 'text-red-700 bg-red-50 border border-red-100' : 'text-emerald-700 bg-emerald-50 border border-emerald-100'}`}>
                    {method === 'trc20' ? 'Tron (TRC20)' : 'BSC (BEP20)'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Token</span>
                  <span className={`font-black ${method === 'trc20' ? 'text-red-500' : 'text-emerald-600'}`}>USDT</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Tỷ giá</span>
                  <span className="font-bold text-slate-800">1 USDT ≈ {fmt(depositConfig?.rate || 25500)} đ</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Xác nhận</span>
                  <span className={`font-bold text-[11px] px-2 py-0.5 rounded-md ${(method === 'trc20' ? depositConfig?.trc20?.auto : depositConfig?.crypto?.auto) ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                    {(method === 'trc20' ? depositConfig?.trc20?.auto : depositConfig?.crypto?.auto) ? '⚡ Tự động' : '⏳ Thủ công'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-amber-50/50 border border-amber-200/50 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-200/20 rounded-full blur-2xl -mr-10 -mt-10" />
            <p className="text-xs font-black text-amber-700 mb-3 flex items-center gap-2 uppercase tracking-wide relative z-10">
              <Info size={16} /> Thông tin cần biết
            </p>
            <ul className="text-[13px] text-amber-800/80 space-y-2.5 font-medium relative z-10">
              <li className="flex items-start gap-1.5"><strong className="text-amber-900">•</strong> Nạp tối thiểu <strong className="text-amber-900">10.000 VNĐ</strong></li>
              {bankEnabled && <li className="flex items-start gap-1.5"><strong className="text-amber-900">•</strong> Chuyển khoản xử lý thủ công trong <strong className="text-amber-900">5-15 phút</strong></li>}
              {(cryptoEnabled || trc20Enabled) && (depositConfig?.crypto?.auto || depositConfig?.trc20?.auto) && (
                <li className="flex items-start gap-1.5"><strong className="text-amber-900">•</strong> Crypto xác nhận tự động <strong className="text-amber-900">1-3 phút</strong></li>
              )}
              {cryptoEnabled && (
                <li className="flex items-start gap-1.5"><strong className="text-red-500">•</strong> <strong className="text-red-600">Sai mạng lưới Crypto sẽ mất quyền truy cập tài sản.</strong></li>
              )}
            </ul>
          </div>

          {/* Commission quick actions */}
          <div className="bg-gradient-to-br from-indigo-50 to-white rounded-3xl border border-indigo-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
            <h3 className="font-extrabold text-slate-800 text-sm mb-1.5 flex items-center gap-2 relative z-10">
              <Gift size={16} className="text-indigo-600" /> Rút Hoa Hồng
            </h3>
            <p className="text-xs font-semibold text-slate-500 mb-4 relative z-10">
              Số dư: <strong className="text-indigo-600 text-base ml-1">{fmt(wallets.commission.balance)} đ</strong>
            </p>
            <div className="relative z-10">
              <button onClick={() => setModal('transfer')} disabled={wallets.commission.balance <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-indigo-200
                  hover:bg-indigo-50 text-indigo-700 text-[13px] font-bold rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
                <ArrowLeftRight size={14} /> Chuyển sang Ví Traffic
              </button>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <CommissionModal
          mode={modal}
          balance={wallets.commission.balance}
          onConfirm={handleCommissionAction}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}