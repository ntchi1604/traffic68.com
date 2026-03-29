import { useState, useEffect, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useToast } from '../../components/Toast';
import {
  Wallet, Gift, Banknote, ArrowRight, ArrowLeftRight,
  Info, LogOut, X, Copy, Check, Clock, ExternalLink, RefreshCw,
  ChevronRight, Sparkles, Shield, Zap, TrendingUp,
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
    <div className="flex items-center justify-between py-2.5 group">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">{value}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
        >
          {copied
            ? <Check size={12} className="text-emerald-500" />
            : <Copy size={12} className="text-slate-400 group-hover:text-blue-400" />}
        </button>
      </div>
    </div>
  );
}

/* ── Commission modal ── */
function CommissionModal({ mode, balance, onConfirm, onClose }) {
  const [amount, setAmount] = useState('');
  const [method] = useState('transfer');
  const isTransfer = mode === 'transfer';
  const num = Number(amount);
  const valid = num > 0 && num <= balance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-md" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 z-10 border border-slate-100"
        style={{ boxShadow: '0 32px 64px rgba(15,23,42,0.15), 0 4px 16px rgba(15,23,42,0.08)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${isTransfer ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
              {isTransfer ? <ArrowLeftRight size={18} className="text-white" /> : <LogOut size={18} className="text-white" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isTransfer ? 'Chuyển sang Ví Traffic' : 'Rút tiền về tài khoản'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Số dư: <strong className="text-orange-500">{fmt(balance)} đ</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all">
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Quick amounts */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Chọn nhanh</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK.slice(0, 6).map(q => {
                const capped = Math.min(q, balance);
                const sel = amount === String(capped);
                return (
                  <button key={q} type="button" onClick={() => setAmount(String(capped))}
                    className={`py-2 text-xs font-bold rounded-xl border-2 transition-all duration-200
                      ${sel ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm scale-[1.02]' : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                    {fmt(capped)}đ
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Số tiền</p>
            <div className="relative">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                max={balance} min="1000" placeholder="Nhập số tiền..."
                className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all pr-14 bg-slate-50"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VNĐ</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm rounded-2xl transition-all">
              Hủy
            </button>
            <button type="button" disabled={!valid} onClick={() => onConfirm(num, isTransfer ? 'transfer' : method)}
              className={`flex-1 py-3 text-white font-bold text-sm rounded-2xl transition-all shadow-lg
                disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                ${isTransfer ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-200' : 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-rose-200'}`}>
              {isTransfer ? 'Chuyển ngay' : 'Rút tiền'}
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

  return (
    <div className={`rounded-3xl border-2 p-6 space-y-5 ${isTrc20 ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50' : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50'}`}
      style={{ boxShadow: isTrc20 ? '0 8px 32px rgba(244,63,94,0.1)' : '0 8px 32px rgba(16,185,129,0.1)' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${isTrc20 ? 'bg-rose-100' : 'bg-emerald-100'}`}>
            <UsdtIcon size={26} />
          </div>
          <div>
            <h3 className={`font-black text-base ${isTrc20 ? 'text-rose-800' : 'text-emerald-800'}`}>Gửi USDT để hoàn tất</h3>
            <p className={`text-xs mt-0.5 ${isTrc20 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {data.auto ? '⚡ Tự động xác nhận sau khi nhận USDT' : '⏳ Admin sẽ xác nhận thủ công'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/60 hover:bg-white flex items-center justify-center transition-all">
          <X size={15} className="text-slate-500" />
        </button>
      </div>

      {/* USDT amount */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white shadow-sm">
        <p className="text-xs text-slate-500 font-medium mb-2">Số USDT cần gửi (chính xác)</p>
        <div className="flex items-center gap-3">
          <p className={`text-4xl font-black tracking-tight ${isTrc20 ? 'text-rose-700' : 'text-emerald-700'}`}>{data.usdtAmount}</p>
          <span className={`text-sm font-bold px-2 py-1 rounded-lg ${isTrc20 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>USDT</span>
          <button onClick={() => { navigator.clipboard.writeText(String(data.usdtAmount)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className={`ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${isTrc20 ? 'bg-rose-100 hover:bg-rose-200 text-rose-700' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}>
            {copied ? <><Check size={12} /> Đã copy</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">≈ {fmt(data.amount)} VNĐ • Tỷ giá: 1 USDT = {fmt(data.rate)} VNĐ</p>
      </div>

      {/* Address */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white shadow-sm">
        <p className="text-xs text-slate-500 font-medium mb-3">Địa chỉ ví nhận ({isTrc20 ? 'Tron TRC20' : 'BSC BEP20'})</p>
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
          <code className="text-xs font-mono text-slate-700 break-all flex-1 leading-relaxed">{data.depositAddress}</code>
          <button onClick={() => navigator.clipboard.writeText(data.depositAddress)}
            className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-100 transition shrink-0 shadow-sm">
            <Copy size={13} className="text-slate-500" />
          </button>
        </div>
        <div className={`flex items-center gap-1.5 mt-2.5 ${isTrc20 ? 'text-rose-600' : 'text-amber-600'}`}>
          <Shield size={11} />
          <p className="text-[10px] font-semibold">Chỉ gửi USDT trên mạng {isTrc20 ? 'Tron (TRC20)' : 'BSC (BEP20)'}. Gửi sai mạng sẽ mất tiền!</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
          <Clock size={18} className="text-blue-500 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-blue-700">Đang chờ giao dịch...</p>
          <p className="text-[10px] text-blue-400 mt-0.5">Mã: <span className="font-mono font-bold">{data.refCode}</span> • {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</p>
        </div>
        {data.auto && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2.5 py-1.5 rounded-full">
            <RefreshCw size={9} className="animate-spin" /> Auto
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 text-center">Sau khi gửi USDT, hệ thống tự động phát hiện trong 1–3 phút và cộng tiền vào ví.</p>
    </div>
  );
}

/* ── Wallet Card ── */
function WalletCard({ gradient, shadowColor, icon: Icon, title, subtitle, balance, action }) {
  return (
    <div
      className={`relative rounded-3xl p-6 text-white overflow-hidden ${gradient}`}
      style={{ boxShadow: `0 16px 48px ${shadowColor}` }}
    >
      {/* Decorative orb */}
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-black/10 blur-xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-sm">
            <Icon size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-white/90">{title}</p>
            <p className="text-[10px] text-white/60">{subtitle}</p>
          </div>
        </div>

        <div className="mb-5">
          <p className="text-[11px] text-white/50 font-medium uppercase tracking-widest mb-1">Số dư</p>
          <p className="text-3xl font-black tracking-tight">{fmt(balance)}</p>
          <p className="text-xs text-white/60 mt-0.5">VNĐ</p>
        </div>

        {action}
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
  if (bankEnabled) methods.push({ id: 'bank', label: 'Ngân hàng', Icon: Banknote, color: 'from-blue-500 to-blue-600', ring: 'ring-blue-400', light: 'bg-blue-50 text-blue-700 border-blue-200' });
  if (cryptoEnabled) methods.push({ id: 'bep20', label: 'USDT BEP20', icon: 'usdt', color: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-400', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' });
  if (trc20Enabled) methods.push({ id: 'trc20', label: 'USDT TRC20', icon: 'usdt', color: 'from-rose-400 to-rose-600', ring: 'ring-rose-400', light: 'bg-rose-50 text-rose-700 border-rose-200' });

  useEffect(() => {
    if (methods.length > 0 && !methods.find(m => m.id === method)) {
      setMethod(methods[0].id);
    }
  }, [depositConfig]);

  const activeMeta = methods.find(m => m.id === method);

  return (
    <div className="space-y-7">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/buyer/dashboard' },
        { label: 'Tài chính', to: '/buyer/dashboard/finance/deposit' },
        { label: 'Nạp tiền & Quản lý ví' },
      ]} />

      {/* Page title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Quản lý ví</h1>
          <p className="text-sm text-slate-400 mt-1">Nạp tiền, chuyển hoặc rút từ ví hoa hồng</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
          <Shield size={12} className="text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">Bảo mật 100%</span>
        </div>
      </div>

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <WalletCard
          gradient="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700"
          shadowColor="rgba(59,130,246,0.3)"
          icon={Wallet}
          title="Ví Traffic"
          subtitle="Dùng để mua gói traffic"
          balance={wallets.main.balance}
          action={
            <button
              onClick={() => document.getElementById('deposit-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-2xl transition-all border border-white/20"
            >
              <Zap size={13} /> Nạp tiền ngay
              <ChevronRight size={13} className="ml-auto" />
            </button>
          }
        />

        <WalletCard
          gradient="bg-gradient-to-br from-orange-400 via-orange-500 to-amber-600"
          shadowColor="rgba(251,146,60,0.3)"
          icon={Gift}
          title="Ví Hoa Hồng"
          subtitle="Nhận từ chương trình giới thiệu"
          balance={wallets.commission.balance}
          action={
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setModal('transfer')} disabled={wallets.commission.balance <= 0}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-white/20 hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-2xl transition-all border border-white/20">
                <ArrowLeftRight size={12} /> Chuyển ví
              </button>
              <button onClick={() => setModal('withdraw')} disabled={wallets.commission.balance <= 0}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-white/20 hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-2xl transition-all border border-white/20">
                <LogOut size={12} /> Rút tiền
              </button>
            </div>
          }
        />
      </div>

      {/* Deposit form area */}
      <div id="deposit-form" className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Main form */}
        <div className="lg:col-span-2 space-y-5">

          {/* Crypto result */}
          {cryptoResult && (
            <CryptoDepositPanel data={cryptoResult} onClose={() => { setCryptoResult(null); fetchWallets(); }} />
          )}

          {/* Method selector */}
          {!cryptoResult && methods.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6"
              style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.06)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={15} className="text-blue-500" />
                <h2 className="font-bold text-slate-800">Phương thức nạp tiền</h2>
              </div>
              <p className="text-xs text-slate-400 mb-5">Chọn phương thức để nạp vào <span className="font-semibold text-blue-600">Ví Traffic</span></p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {methods.map(({ id, label, Icon, icon, color, ring, light }) => {
                  const sel = method === id;
                  return (
                    <button key={id} type="button" onClick={() => setMethod(id)}
                      className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-200
                        ${sel ? `border-transparent ${light.replace('border-', '')} ring-2 ${ring} ring-offset-1 scale-[1.02] shadow-sm` : 'border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white'}`}
                    >
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm`}>
                        {icon === 'usdt' ? <UsdtIcon size={22} /> : <Icon size={18} className="text-white" />}
                      </div>
                      <span className={`text-xs font-bold ${sel ? '' : 'text-slate-500'}`}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amount form */}
          {!cryptoResult && methods.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6"
              style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.06)' }}>
              <h2 className="font-bold text-slate-800 mb-1">Nhập số tiền nạp</h2>
              <p className="text-xs text-slate-400 mb-5">
                {method === 'bep20' || method === 'trc20'
                  ? `Tối thiểu ${method === 'trc20' ? (depositConfig?.trc20?.minUsdt || depositConfig?.crypto?.minUsdt || 1) : (depositConfig?.crypto?.minUsdt || 1)} USDT • Tỷ giá: 1 USDT ≈ ${fmt(depositConfig?.rate || 25500)} VNĐ`
                  : 'Nạp tối thiểu 10.000 VNĐ • Xử lý trong 5–15 phút'}
              </p>

              <form onSubmit={handleDeposit} className="space-y-5">
                {/* Quick amounts */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Chọn nhanh</p>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK.map(q => {
                      const sel = amount === String(q);
                      return (
                        <button key={q} type="button" onClick={() => setAmount(String(q))}
                          className={`py-2.5 rounded-xl border-2 text-xs font-bold transition-all duration-200
                            ${sel
                              ? 'border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-200 scale-[1.02]'
                              : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'}`}>
                          {fmt(q)}đ
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom input */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Hoặc nhập số khác</p>
                  <div className="relative">
                    <input
                      type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="Nhập số tiền..." min="10000" step="1000"
                      className="w-full px-5 py-4 border-2 border-slate-200 rounded-2xl text-base font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all pr-16 bg-slate-50"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">VNĐ</span>
                  </div>
                  {/* Conversion hint */}
                  {amount && Number(amount) >= 10000 && (method === 'bep20' || method === 'trc20') && depositConfig?.rate && (
                    <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200 w-fit">
                      <TrendingUp size={11} className="text-emerald-600" />
                      <p className="text-xs text-emerald-700 font-semibold">≈ {(Number(amount) / depositConfig.rate).toFixed(4)} USDT</p>
                    </div>
                  )}
                  {amount && Number(amount) >= 10000 && method !== 'bep20' && method !== 'trc20' && (
                    <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-blue-50 rounded-xl border border-blue-200 w-fit">
                      <Check size={11} className="text-blue-600" />
                      <p className="text-xs text-blue-700 font-semibold">{fmt(Number(amount))} VNĐ</p>
                    </div>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={processing || Number(amount) < 10000}
                  className="w-full flex items-center justify-center gap-2.5 py-4 font-black text-white text-sm rounded-2xl
                    bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-indigo-600
                    transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]
                    shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none"
                >
                  {processing
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang xử lý...</>
                    : (method === 'bep20' || method === 'trc20')
                      ? <><UsdtIcon size={18} /> Tạo đơn nạp Crypto <ArrowRight size={16} /></>
                      : <><Wallet size={16} /> Nạp vào Ví Traffic <ArrowRight size={16} /></>}
                </button>
              </form>
            </div>
          )}

          {/* No methods */}
          {!cryptoResult && methods.length === 0 && depositConfig && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-8 text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Info size={22} className="text-amber-600" />
              </div>
              <p className="text-amber-800 font-bold mb-1">Chưa có phương thức nạp tiền nào</p>
              <p className="text-xs text-amber-600">Vui lòng liên hệ admin để được hỗ trợ nạp tiền.</p>
            </div>
          )}
        </div>

        {/* RIGHT: Sidebar */}
        <div className="space-y-4">

          {/* Bank info */}
          {bankEnabled && depositConfig?.bank && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5"
              style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.06)' }}>
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Banknote size={13} className="text-blue-600" />
                </div>
                Thông tin chuyển khoản
              </h3>
              <div className="divide-y divide-slate-100">
                <CopyField label="Ngân hàng" value={depositConfig.bank.bankName} />
                <CopyField label="Số tài khoản" value={depositConfig.bank.accountNumber} />
                <CopyField label="Chủ tài khoản" value={depositConfig.bank.accountHolder} />
                {depositConfig.bank.branch && <CopyField label="Chi nhánh" value={depositConfig.bank.branch} />}
              </div>
            </div>
          )}

          {/* Crypto info */}
          {(cryptoEnabled || trc20Enabled) && (
            <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm p-5"
              style={{ boxShadow: '0 4px 24px rgba(16,185,129,0.08)' }}>
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <UsdtIcon size={15} />
                </div>
                Thông tin Crypto
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Mạng', value: method === 'trc20' ? 'Tron (TRC20)' : 'BSC (BEP20)', accent: method === 'trc20' ? 'text-rose-600' : 'text-slate-800' },
                  { label: 'Token', value: 'USDT', accent: method === 'trc20' ? 'text-rose-500' : 'text-emerald-600' },
                  { label: 'Tỷ giá', value: `1 USDT ≈ ${fmt(depositConfig?.rate || 25500)} VNĐ`, accent: 'text-slate-800' },
                  { label: 'Xác nhận', value: (method === 'trc20' ? depositConfig?.trc20?.auto : depositConfig?.crypto?.auto) ? '⚡ Tự động' : '⏳ Thủ công', accent: (method === 'trc20' ? depositConfig?.trc20?.auto : depositConfig?.crypto?.auto) ? 'text-emerald-600' : 'text-amber-600' },
                ].map(({ label, value, accent }) => (
                  <div key={label} className="flex justify-between items-center py-1.5">
                    <span className="text-xs text-slate-400 font-medium">{label}</span>
                    <span className={`text-xs font-bold ${accent}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border border-amber-200 p-5">
            <p className="text-xs font-bold text-amber-800 mb-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-200 flex items-center justify-center">
                <Info size={11} className="text-amber-800" />
              </div>
              Lưu ý quan trọng
            </p>
            <ul className="space-y-2 text-xs text-amber-700">
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span> Nạp tối thiểu <strong>10.000 VNĐ</strong></li>
              {bankEnabled && <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span> Chuyển khoản: Admin xác nhận trong <strong>5–15 phút</strong></li>}
              {(cryptoEnabled || trc20Enabled) && (depositConfig?.crypto?.auto || depositConfig?.trc20?.auto) && (
                <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span> Crypto: Tự động xác nhận sau <strong>1–3 phút</strong></li>
              )}
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span> Chuyển HH → Traffic: <strong>ngay lập tức</strong></li>
              {cryptoEnabled && (
                <li className="flex items-start gap-2"><span className="text-rose-400 mt-0.5">!</span> <span className="text-rose-700 font-semibold">Chỉ gửi USDT đúng mạng BSC (BEP20)</span></li>
              )}
            </ul>
          </div>

          {/* Commission quick actions */}
          <div className="bg-white rounded-3xl border border-orange-200 shadow-sm p-5"
            style={{ boxShadow: '0 4px 24px rgba(251,146,60,0.1)' }}>
            <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center">
                <Gift size={13} className="text-orange-500" />
              </div>
              Ví Hoa Hồng
            </h3>
            <p className="text-xs text-slate-400 mb-4 ml-9">
              Số dư: <strong className="text-orange-500">{fmt(wallets.commission.balance)} đ</strong>
            </p>
            <button
              onClick={() => setModal('transfer')}
              disabled={wallets.commission.balance <= 0}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeftRight size={13} /> Chuyển sang Ví Traffic
            </button>
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