import { useState, useEffect, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useToast } from '../../components/Toast';
import {
  Wallet, Gift, Banknote, ArrowRight, ArrowLeftRight,
  Info, LogOut, X, Copy, Check, Clock, RefreshCw,
  ChevronRight, Shield, Zap, TrendingUp, CircleDollarSign,
  Building2, Coins, Star, Sparkles, CheckCircle2, AlertCircle,
} from 'lucide-react';
import api from '../../lib/api';
import Breadcrumb from '../../components/Breadcrumb';
import { formatMoney as fmt } from '../../lib/format';

const QUICK = [100000, 200000, 500000, 1000000, 2000000, 5000000];

/* ── USDT SVG ── */
const UsdtIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path d="M17.9 17.05v-.03c-.1 0-.71.04-2 .04-1 0-1.72-.04-1.96-.04v.03c-3.47-.15-6.06-.8-6.06-1.58 0-.78 2.59-1.43 6.06-1.58v2.52c.25.02.98.06 1.98.06 1.2 0 1.77-.05 1.98-.06v-2.52c3.46.15 6.04.8 6.04 1.58 0 .78-2.58 1.43-6.04 1.58zm0-3.42V11.5h4.46V8.5H9.63v3h4.43v2.13c-3.93.18-6.88 1.02-6.88 2.02s2.95 1.84 6.88 2.02v7.23h3.84v-7.23c3.91-.18 6.85-1.02 6.85-2.02s-2.94-1.84-6.85-2.02z" fill="#fff" />
  </svg>
);

/* ── Step indicator ── */
function StepDot({ n, active, done }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 border-2
      ${done ? 'bg-indigo-600 border-indigo-600 text-white' : active ? 'bg-white border-indigo-600 text-indigo-600 shadow-md shadow-indigo-100' : 'bg-white border-slate-200 text-slate-400'}`}>
      {done ? <Check size={14} /> : n}
    </div>
  );
}

/* ── Animated counter ── */
function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const target = value;
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;
    const duration = 600;
    const startTime = performance.now();
    const tick = (now) => {
      const p = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + diff * ease));
      if (p < 1) requestAnimationFrame(tick);
      else { setDisplay(target); prev.current = target; }
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span>{fmt(display)}</span>;
}

/* ── Copy button inline ── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200
        ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700'}`}>
      {copied ? <><Check size={10} /> Đã copy</> : <><Copy size={10} /> Copy</>}
    </button>
  );
}

/* ── Bank info row ── */
function BankRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 group">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">{value}</span>
        <CopyBtn text={value} />
      </div>
    </div>
  );
}

/* ── Commission Modal ── */
function CommissionModal({ mode, balance, onConfirm, onClose }) {
  const [amount, setAmount] = useState('');
  const isTransfer = mode === 'transfer';
  const num = Number(amount);
  const valid = num > 0 && num <= balance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-lg" />
      <div className="relative bg-white rounded-3xl w-full max-w-sm p-7 z-10 shadow-2xl" onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 40px 80px -12px rgba(15,23,42,0.25)' }}>
        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition">
          <X size={14} className="text-slate-500" />
        </button>

        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${isTransfer ? 'bg-indigo-100' : 'bg-rose-100'}`}>
          {isTransfer ? <ArrowLeftRight size={20} className="text-indigo-600" /> : <LogOut size={20} className="text-rose-600" />}
        </div>

        <h3 className="text-xl font-black text-slate-900 mb-1">
          {isTransfer ? 'Chuyển sang Ví Traffic' : 'Rút tiền về tài khoản'}
        </h3>
        <p className="text-sm text-slate-400 mb-6">Số dư khả dụng: <span className="font-bold text-orange-500">{fmt(balance)} đ</span></p>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {QUICK.slice(0, 6).map(q => {
              const capped = Math.min(q, balance);
              const sel = amount === String(capped);
              return (
                <button key={q} type="button" onClick={() => setAmount(String(capped))}
                  className={`py-2 text-[11px] font-bold rounded-xl border-2 transition-all
                    ${sel ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                  {fmt(capped)}đ
                </button>
              );
            })}
          </div>

          <div className="relative">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              min="1000" max={balance} placeholder="Hoặc nhập số tiền..."
              className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all pr-16 bg-slate-50" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VNĐ</span>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition">
              Hủy
            </button>
            <button disabled={!valid} onClick={() => onConfirm(num, isTransfer ? 'transfer' : 'withdraw')}
              className={`flex-1 py-3.5 rounded-2xl text-white font-black text-sm transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isTransfer ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
              {isTransfer ? 'Chuyển ngay' : 'Rút tiền'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Crypto Panel ── */
function CryptoDepositPanel({ data, onClose }) {
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const isTrc20 = data.network === 'TRC20';
  const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const sec = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" />
      <div className="relative bg-white rounded-3xl w-full max-w-md z-10 overflow-hidden shadow-2xl"
        style={{ boxShadow: '0 40px 80px -12px rgba(15,23,42,0.3)' }} onClick={e => e.stopPropagation()}>

        {/* Header stripe */}
        <div className={`px-6 pt-6 pb-5 ${isTrc20 ? 'bg-gradient-to-r from-rose-500 to-pink-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center">
                <UsdtIcon size={20} />
              </div>
              <div>
                <p className="text-white font-black text-sm">Gửi USDT để hoàn tất</p>
                <p className="text-white/70 text-[10px]">{isTrc20 ? 'Tron (TRC20)' : 'BSC (BEP20)'}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition">
              <X size={14} className="text-white" />
            </button>
          </div>
          {/* Amount display */}
          <div className="bg-white/15 rounded-2xl p-4 backdrop-blur-sm">
            <p className="text-white/60 text-[10px] font-medium mb-1 uppercase tracking-wider">Số USDT cần gửi</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-white tracking-tight">{data.usdtAmount}</span>
              <span className="text-white/80 text-sm font-bold mb-1">USDT</span>
              <button onClick={() => { navigator.clipboard.writeText(String(data.usdtAmount)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="ml-auto mb-1 flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition">
                {copied ? <><Check size={11} /> Đã copy</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <p className="text-white/50 text-[10px] mt-1.5">≈ {fmt(data.amount)} VNĐ • 1 USDT = {fmt(data.rate)} VNĐ</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Address */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Địa chỉ ví nhận</p>
              <CopyBtn text={data.depositAddress} />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
              <code className="text-xs font-mono text-slate-700 break-all leading-relaxed">{data.depositAddress}</code>
            </div>
            <div className={`flex items-center gap-1.5 mt-2 ${isTrc20 ? 'text-rose-600' : 'text-amber-600'}`}>
              <AlertCircle size={11} />
              <p className="text-[10px] font-semibold">Chỉ gửi USDT trên mạng {isTrc20 ? 'Tron (TRC20)' : 'BSC (BEP20)'}. Sai mạng = mất tiền.</p>
            </div>
          </div>

          {/* Timer & status */}
          <div className="flex gap-3">
            <div className="flex-1 bg-blue-50 border border-blue-200 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock size={16} className="text-blue-600 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] text-blue-500 font-medium">Đang chờ</p>
                <p className="text-xl font-black text-blue-700 font-mono">{min}:{sec}</p>
              </div>
            </div>
            {data.auto && (
              <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                  <RefreshCw size={16} className="text-emerald-600 animate-spin" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-500 font-medium">Xác nhận</p>
                  <p className="text-sm font-black text-emerald-700">Tự động</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
            <CheckCircle2 size={14} className="text-slate-400 shrink-0" />
            <p className="text-[11px] text-slate-400 leading-relaxed">Mã giao dịch: <span className="font-mono font-bold text-slate-600">{data.refCode}</span> — Hệ thống tự phát hiện trong 1–3 phút.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
export default function Deposit() {
  usePageTitle('Tài chính – Nạp tiền');
  const toast = useToast();
  const [wallets, setWallets] = useState({ main: { balance: 0 }, commission: { balance: 0 } });
  const [step, setStep] = useState(1); // 1=method, 2=amount, 3=confirm
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

  const bankEnabled = depositConfig?.bank?.enabled;
  const cryptoEnabled = depositConfig?.crypto?.enabled;
  const trc20Enabled = depositConfig?.trc20?.enabled;

  const METHODS = [
    ...(bankEnabled ? [{ id: 'bank', label: 'Chuyển khoản ngân hàng', sub: 'Xác nhận 5–15 phút', Icon: Building2, gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', ring: 'ring-blue-400' }] : []),
    ...(cryptoEnabled ? [{ id: 'bep20', label: 'USDT (BEP20)', sub: 'BSC Network · Nhanh & tự động', icon: 'usdt', gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', ring: 'ring-emerald-400' }] : []),
    ...(trc20Enabled ? [{ id: 'trc20', label: 'USDT (TRC20)', sub: 'Tron Network · Nhanh & tự động', icon: 'usdt', gradient: 'from-violet-500 to-purple-700', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', ring: 'ring-violet-400' }] : []),
  ];

  useEffect(() => {
    if (METHODS.length > 0 && !METHODS.find(m => m.id === method)) setMethod(METHODS[0].id);
  }, [depositConfig]);

  const activeMeta = METHODS.find(m => m.id === method) || METHODS[0];
  const isCrypto = method === 'bep20' || method === 'trc20';
  const num = Number(amount);
  const minOk = isCrypto
    ? (num >= 10000)
    : num >= 10000;

  const handleDeposit = async () => {
    if (!minOk) { toast.error('Số tiền không hợp lệ'); return; }
    setProcessing(true);
    try {
      if (isCrypto) {
        const data = await api.post('/finance/deposits', { amount: num, method });
        setCryptoResult({ ...data, amount: num });
        setAmount(''); setStep(1);
      } else {
        const data = await api.post('/finance/deposits', { amount: num, method: method === 'bank' ? 'bank_transfer' : method });
        setAmount(''); setStep(1);
        toast.success(`Đơn nạp ${fmt(num)} đ đã gửi! Mã: ${data.refCode}`, 'Nạp tiền');
        fetchWallets();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCommission = async (num, meth) => {
    setModal(null);
    if (meth === 'transfer') {
      try {
        const data = await api.post('/finance/transfer', { amount: num });
        toast.success(data.message || `Đã chuyển ${fmt(num)} đ sang Ví Traffic`);
        fetchWallets();
      } catch (err) { toast.error(err.message); }
    }
  };

  const STEPS = [
    { n: 1, label: 'Phương thức' },
    { n: 2, label: 'Số tiền' },
    { n: 3, label: 'Xác nhận' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* ── Page header ── */}
      <div className="mb-6">
        <Breadcrumb items={[
          { label: 'Dashboard', to: '/buyer/dashboard' },
          { label: 'Tài chính', to: '/buyer/dashboard/finance/deposit' },
          { label: 'Nạp tiền' },
        ]} />

        <div className="mt-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            <Wallet size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight leading-tight" style={{ letterSpacing: '-0.02em' }}>Nạp tiền & Ví</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Nạp tiền vào Ví Traffic hoặc quản lý Ví Hoa Hồng</p>
          </div>
        </div>
      </div>

      {/* ── Wallet balance strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
        {/* Traffic wallet */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 flex items-center gap-5"
          style={{ boxShadow: '0 2px 20px rgba(15,23,42,0.06)' }}>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
            <Wallet size={24} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Ví Traffic</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight truncate"><AnimatedNumber value={wallets.main.balance} /></p>
            <p className="text-[10px] text-slate-400">VNĐ · Dùng để mua traffic</p>
          </div>
          <button
            onClick={() => document.getElementById('deposit-wizard')?.scrollIntoView({ behavior: 'smooth' })}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-md">
            <Zap size={12} /> Nạp
          </button>
        </div>

        {/* Commission wallet */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 flex items-center gap-5"
          style={{ boxShadow: '0 2px 20px rgba(15,23,42,0.06)' }}>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-200 shrink-0">
            <Gift size={24} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Ví Hoa Hồng</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight truncate"><AnimatedNumber value={wallets.commission.balance} /></p>
            <p className="text-[10px] text-slate-400">VNĐ · Từ chương trình giới thiệu</p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button onClick={() => setModal('transfer')} disabled={wallets.commission.balance <= 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed border border-blue-200">
              <ArrowLeftRight size={11} /> Chuyển
            </button>
            <button onClick={() => setModal('withdraw')} disabled={wallets.commission.balance <= 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200">
              <LogOut size={11} /> Rút tiền
            </button>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT — Deposit wizard */}
        <div id="deposit-wizard" className="lg:col-span-8 space-y-5">

          {/* Step navigator */}
          {METHODS.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm"
              style={{ boxShadow: '0 2px 20px rgba(15,23,42,0.05)' }}>
              <div className="flex items-center gap-0">
                {STEPS.map((s, i) => (
                  <div key={s.n} className="flex items-center flex-1 last:flex-none">
                    <button onClick={() => { if (s.n < step || (s.n === step)) return; }}
                      className="flex items-center gap-2.5">
                      <StepDot n={s.n} active={step === s.n} done={step > s.n} />
                      <span className={`text-xs font-bold hidden sm:block ${step === s.n ? 'text-indigo-600' : step > s.n ? 'text-slate-400' : 'text-slate-300'}`}>{s.label}</span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-3 rounded-full transition-all duration-500 ${step > s.n ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1 — Choose method */}
          {step === 1 && METHODS.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
              style={{ boxShadow: '0 2px 20px rgba(15,23,42,0.05)' }}>
              <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <h2 className="text-base font-black text-slate-900">Chọn phương thức nạp tiền</h2>
                <p className="text-xs text-slate-400 mt-0.5">Nạp vào <span className="text-indigo-600 font-semibold">Ví Traffic</span> để mua gói traffic</p>
              </div>
              <div className="p-6 space-y-3">
                {METHODS.map(({ id, label, sub, Icon, icon, gradient, bg, border, text, ring }) => {
                  const sel = method === id;
                  return (
                    <button key={id} type="button" onClick={() => { setMethod(id); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 text-left
                        ${sel ? `${border} ${bg} ring-2 ${ring} ring-offset-1` : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white'}`}>
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm shrink-0`}>
                        {icon === 'usdt' ? <UsdtIcon size={24} /> : <Icon size={22} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${sel ? text : 'text-slate-700'}`}>{label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${sel ? `${border.replace('border-', 'border-')} bg-indigo-600 border-indigo-600` : 'border-slate-300'}`}>
                        {sel && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="px-6 pb-6">
                <button onClick={() => setStep(2)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-sm
                    bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700
                    shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300
                    transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]">
                  Tiếp tục <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — Amount */}
          {step === 2 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
              style={{ boxShadow: '0 2px 20px rgba(15,23,42,0.05)' }}>
              <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900">Nhập số tiền nạp</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {activeMeta && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${activeMeta.bg || 'bg-slate-100'} ${activeMeta.text || 'text-slate-600'}`}>
                        {activeMeta.label}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {isCrypto ? `1 USDT ≈ ${fmt(depositConfig?.rate || 25500)} VNĐ` : 'Tối thiểu 10.000 VNĐ'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setStep(1)} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition">← Quay lại</button>
              </div>

              <div className="p-6 space-y-5">
                {/* Big amount input */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-1">
                  <div className="relative">
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="0" min="10000" step="1000"
                      className="w-full px-5 py-5 text-4xl font-black text-slate-900 placeholder:text-slate-300 bg-transparent focus:outline-none pr-24 tracking-tight"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">VNĐ</span>
                  </div>
                  {isCrypto && amount && num >= 10000 && depositConfig?.rate ? (
                    <div className="px-5 pb-3 -mt-1">
                      <p className="text-sm font-semibold text-emerald-600">≈ {(num / depositConfig.rate).toFixed(4)} USDT</p>
                    </div>
                  ) : amount && num >= 10000 ? (
                    <div className="px-5 pb-3 -mt-1">
                      <p className="text-sm font-semibold text-indigo-600">✓ {fmt(num)} VNĐ</p>
                    </div>
                  ) : null}
                </div>

                {/* Quick select */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Chọn nhanh</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {QUICK.map(q => {
                      const sel = amount === String(q);
                      return (
                        <button key={q} type="button" onClick={() => setAmount(String(q))}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all duration-150
                            ${sel ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'border-slate-200 text-slate-600 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'}`}>
                          {q >= 1000000 ? `${q / 1000000}M` : `${q / 1000}K`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button onClick={() => setStep(3)} disabled={!minOk}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-sm
                    bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700
                    shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:scale-[0.98]
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none">
                  Xem xác nhận <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Confirm */}
          {step === 3 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
              style={{ boxShadow: '0 2px 20px rgba(15,23,42,0.05)' }}>
              <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900">Xác nhận đơn nạp tiền</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Kiểm tra thông tin trước khi gửi</p>
                </div>
                <button onClick={() => setStep(2)} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition">← Sửa</button>
              </div>

              <div className="p-6">
                {/* Summary card */}
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-5 mb-5"
                  style={{ boxShadow: '0 8px 32px rgba(15,23,42,0.2)' }}>
                  <p className="text-[10px] text-white/40 font-semibold uppercase tracking-widest mb-1">Số tiền nạp</p>
                  <p className="text-3xl font-black text-white tracking-tight">{fmt(num)} <span className="text-white/50 text-base font-bold">VNĐ</span></p>
                  {isCrypto && depositConfig?.rate && (
                    <p className="text-sm text-indigo-300 font-semibold mt-1">≈ {(num / depositConfig.rate).toFixed(4)} USDT</p>
                  )}
                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-white/30 mb-0.5">Phương thức</p>
                      <p className="text-xs font-bold text-white">{activeMeta?.label || method}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 mb-0.5">Nhận vào</p>
                      <p className="text-xs font-bold text-white">Ví Traffic</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 mb-0.5">Xử lý</p>
                      <p className="text-xs font-bold text-white">{isCrypto ? (depositConfig?.crypto?.auto || depositConfig?.trc20?.auto ? '1–3 phút' : 'Thủ công') : '5–15 phút'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 mb-0.5">Trạng thái</p>
                      <p className="text-xs font-bold text-emerald-400">Sẵn sàng gửi</p>
                    </div>
                  </div>
                </div>

                {/* Bank info if bank method */}
                {method === 'bank' && bankEnabled && depositConfig?.bank && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
                    <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Building2 size={12} /> Thông tin chuyển khoản
                    </p>
                    <BankRow label="Ngân hàng" value={depositConfig.bank.bankName} />
                    <BankRow label="Số tài khoản" value={depositConfig.bank.accountNumber} />
                    <BankRow label="Chủ tài khoản" value={depositConfig.bank.accountHolder} />
                    {depositConfig.bank.branch && <BankRow label="Chi nhánh" value={depositConfig.bank.branch} />}
                  </div>
                )}

                <button onClick={handleDeposit} disabled={processing}
                  className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-white text-sm
                    bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600
                    hover:from-indigo-700 hover:via-violet-700 hover:to-purple-700
                    shadow-xl shadow-indigo-200/70 transition-all hover:-translate-y-0.5 active:scale-[0.98]
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0">
                  {processing
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang xử lý...</>
                    : isCrypto
                      ? <><UsdtIcon size={18} /> Tạo đơn nạp Crypto <Zap size={15} /></>
                      : <><CircleDollarSign size={17} /> Gửi đơn nạp tiền <ArrowRight size={15} /></>}
                </button>

                <div className="flex items-center gap-2 mt-4 justify-center">
                  <Shield size={12} className="text-slate-400" />
                  <p className="text-[11px] text-slate-400">Giao dịch được mã hóa và bảo vệ an toàn</p>
                </div>
              </div>
            </div>
          )}

          {/* No methods */}
          {METHODS.length === 0 && depositConfig && (
            <div className="bg-white rounded-3xl border border-amber-200 p-10 text-center shadow-sm">
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={24} className="text-amber-600" />
              </div>
              <p className="font-black text-slate-800 mb-1">Chưa có phương thức nạp tiền</p>
              <p className="text-sm text-slate-400">Vui lòng liên hệ admin để được hỗ trợ.</p>
            </div>
          )}
        </div>

        {/* RIGHT — Info sidebar */}
        <div className="lg:col-span-4 space-y-4">

          {/* Crypto rate info */}
          {(cryptoEnabled || trc20Enabled) && depositConfig?.rate && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5"
              style={{ boxShadow: '0 2px 20px rgba(15,23,42,0.05)' }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <TrendingUp size={14} className="text-emerald-600" />
                </div>
                <h3 className="text-sm font-black text-slate-800">Tỷ giá USDT</h3>
                <span className="ml-auto text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Live</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <UsdtIcon size={18} />
                    <span className="text-xs font-semibold text-slate-600">1 USDT</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">{fmt(depositConfig.rate)} VNĐ</span>
                </div>
                {[
                  { usdt: 1, label: '1 USDT' },
                  { usdt: 10, label: '10 USDT' },
                  { usdt: 100, label: '100 USDT' },
                ].map(({ usdt, label }) => (
                  <div key={usdt} className="flex justify-between text-xs">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-bold text-slate-700">{fmt(usdt * depositConfig.rate)} VNĐ</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bank info sidebar */}
          {bankEnabled && depositConfig?.bank && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5"
              style={{ boxShadow: '0 2px 20px rgba(15,23,42,0.05)' }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Building2 size={14} className="text-blue-600" />
                </div>
                <h3 className="text-sm font-black text-slate-800">Thông tin NH</h3>
              </div>
              <BankRow label="Ngân hàng" value={depositConfig.bank.bankName} />
              <BankRow label="Số TK" value={depositConfig.bank.accountNumber} />
              <BankRow label="Chủ TK" value={depositConfig.bank.accountHolder} />
              {depositConfig.bank.branch && <BankRow label="Chi nhánh" value={depositConfig.bank.branch} />}
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5"
            style={{ boxShadow: '0 2px 20px rgba(15,23,42,0.05)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <Info size={14} className="text-amber-600" />
              </div>
              <h3 className="text-sm font-black text-slate-800">Lưu ý</h3>
            </div>
            <ul className="space-y-2.5">
              {[
                { icon: CheckCircle2, color: 'text-slate-400', text: 'Nạp tối thiểu 10.000 VNĐ' },
                ...(bankEnabled ? [{ icon: Clock, color: 'text-blue-400', text: 'Chuyển khoản: 5–15 phút' }] : []),
                ...((cryptoEnabled || trc20Enabled) && (depositConfig?.crypto?.auto || depositConfig?.trc20?.auto) ? [{ icon: Zap, color: 'text-emerald-500', text: 'Crypto tự động: 1–3 phút' }] : []),
                { icon: ArrowLeftRight, color: 'text-indigo-400', text: 'Chuyển HH → Traffic: ngay lập tức' },
                ...(cryptoEnabled && trc20Enabled
                  ? [{ icon: AlertCircle, color: 'text-rose-500', text: 'BEP20: chỉ gửi USDT trên mạng BSC' }, { icon: AlertCircle, color: 'text-violet-500', text: 'TRC20: chỉ gửi USDT trên mạng Tron' }]
                  : cryptoEnabled
                    ? [{ icon: AlertCircle, color: 'text-rose-500', text: 'Chỉ gửi USDT trên mạng BSC (BEP20)' }]
                    : trc20Enabled
                      ? [{ icon: AlertCircle, color: 'text-violet-500', text: 'Chỉ gửi USDT trên mạng Tron (TRC20)' }]
                      : []),
              ].map(({ icon: Icon, color, text }, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Icon size={13} className={`${color} shrink-0 mt-0.5`} />
                  <span className="text-xs text-slate-500 leading-relaxed">{text}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* Modals */}
      {modal && (
        <CommissionModal mode={modal} balance={wallets.commission.balance}
          onConfirm={handleCommission} onClose={() => setModal(null)} />
      )}
      {cryptoResult && (
        <CryptoDepositPanel data={cryptoResult} onClose={() => { setCryptoResult(null); fetchWallets(); }} />
      )}
    </div>
  );
}