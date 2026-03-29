import { useState, useEffect, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useToast } from '../../components/Toast';
import {
  Wallet, Gift, Banknote, ArrowRight, ArrowLeftRight,
  Info, LogOut, X, Copy, Check, Clock, RefreshCw,
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
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-slate-800">{value}</span>
        <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="p-1.5 rounded-lg bg-slate-100/80 hover:bg-slate-200 transition text-slate-400 focus:outline-none">
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-md p-6 z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${isTransfer ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-500'}`}>
              {isTransfer ? <ArrowLeftRight size={18} /> : <LogOut size={18} />}
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg tracking-tight">
                {isTransfer ? 'Chuyển sang Ví Traffic' : 'Rút tiền tài khoản'}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Khả dụng: <strong className="text-emerald-600">{fmt(balance)} đ</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X size={18} /></button>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex justify-between items-end mb-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Chọn định mức</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {QUICK.slice(0, 6).map(q => {
                const capped = Math.min(q, balance);
                return (
                  <button key={q} type="button" onClick={() => setAmount(String(capped))}
                    className={`py-2 text-[11px] font-bold rounded-xl border-2 transition-all
                      ${amount === String(capped) ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm' : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}>
                    {fmt(capped)} đ
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Hoặc nhập số tiền</p>
            <div className="relative">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                max={balance} min="1000" placeholder="0"
                className="w-full pl-5 pr-14 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-bold text-slate-800 focus:outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:font-normal placeholder:text-slate-300" />
               <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VNĐ</span>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 text-[13px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-colors">
              Hủy bỏ
            </button>
            <button type="button" disabled={!valid} onClick={() => onConfirm(num, isTransfer ? 'transfer' : method)}
              className={`flex-1 py-3 text-[13px] text-white font-bold rounded-2xl transition-all shadow-md active:scale-[0.98]
                disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed
                ${isTransfer ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'}`}>
              {isTransfer ? 'Xác nhận chuyển' : 'Yêu cầu rút'}
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
  const baseColor = isTrc20 ? 'rose' : 'emerald';
  const lightBg = isTrc20 ? 'bg-rose-50/50' : 'bg-emerald-50/50';
  const borderCol = isTrc20 ? 'border-rose-100' : 'border-emerald-100';
  const textTitle = isTrc20 ? 'text-rose-700' : 'text-emerald-700';

  return (
    <div className={`${lightBg} border-2 ${borderCol} rounded-[24px] p-6 lg:p-7 space-y-6 relative overflow-hidden group`}>
      {/* Decorative pulse glow */}
      <div className={`absolute -right-20 -top-20 w-64 h-64 bg-${baseColor}-500/10 blur-[60px] rounded-full pointer-events-none`} />

      <div className="relative flex justify-between items-start">
        <div className="flex gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm bg-${baseColor}-100 shrink-0`}>
            <UsdtIcon size={26} />
          </div>
          <div>
            <h3 className={`font-black ${textTitle} text-lg`}>Hoàn tất bằng USDT</h3>
            <p className={`text-[11px] font-semibold text-${baseColor}-600/70 mt-0.5`}>
              {data.auto ? '⚡ Duyệt tiền tự động sau 1-3 phút' : '⏳ Cần chờ Admin kiểm tra'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 -mr-2 bg-white/50 hover:bg-white rounded-full text-slate-400 transition-colors"><X size={16} /></button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Số USDT phải gửi chính xác</p>
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-black ${textTitle}`}>{data.usdtAmount}</span>
          <span className={`text-[13px] font-bold text-${baseColor}-600/80`}>USDT</span>
          <button onClick={() => { navigator.clipboard.writeText(String(data.usdtAmount)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className={`ml-auto px-4 py-2 bg-${baseColor}-50 hover:bg-${baseColor}-100 rounded-xl text-[12px] font-bold text-${baseColor}-700 flex items-center gap-1.5 transition-colors focus:outline-none`}>
            {copied ? <><Check size={14} /> Copy xong</> : <><Copy size={14} /> Copy số</>}
          </button>
        </div>
        <p className="text-[11px] font-medium text-slate-400 mt-2 flex items-center gap-1.5">
          <ArrowRight size={10} className="text-slate-300" /> Tương đương {fmt(data.amount)} VNĐ (Tỷ giá: {fmt(data.rate)})
        </p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Địa chỉ ví ({networkLabel})</p>
        <div className="flex items-center gap-2 bg-slate-50/80 rounded-xl p-3 border border-slate-100 group-hover:bg-slate-50 transition-colors">
          <code className="text-[13px] font-medium text-slate-700 break-all flex-1 select-all">{data.depositAddress}</code>
          <button onClick={() => navigator.clipboard.writeText(data.depositAddress)}
            className="p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 shadow-sm text-slate-400 hover:text-slate-600 transition-all focus:outline-none shrink-0" title="Copy địa chỉ">
            <Copy size={14} />
          </button>
        </div>
        <div className="flex items-start gap-1.5 mt-3 px-1">
          <Info size={13} className={`shrink-0 mt-0.5 ${isTrc20 ? 'text-rose-500' : 'text-amber-500'}`} />
          <p className={`text-[11px] font-semibold leading-relaxed ${isTrc20 ? 'text-rose-600/80' : 'text-amber-600/80'}`}>
            Đảm bảo bạn chọn đúng mạng <strong>{networkLabel}</strong> khi chuyển. Chuyển nhầm mạng sẽ KHÔNG được cộng tiền và không thể hoàn lại.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3.5 bg-blue-50/50 border border-blue-100/50 rounded-2xl p-4">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 shadow-sm">
          <Clock size={16} className="text-blue-600 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-bold text-blue-800 tracking-tight">Đang chờ blockchain...</p>
          <div className="flex items-center gap-2 text-[11px] text-blue-600/80 font-medium mt-0.5">
            <span>Mã GD: {data.refCode}</span>
            <span className="w-1 h-1 rounded-full bg-blue-300" />
            <span className="tabular-nums font-bold">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
          </div>
        </div>
        {data.auto && (
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-600 font-bold bg-emerald-100/50 px-2.5 py-1.5 rounded-lg border border-emerald-200/50">
            <RefreshCw size={10} className="animate-spin" /> Tự động
          </div>
        )}
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
        toast.success(data.message || `Đã chuyển ${fmt(num)} đ sang Ví Traffic`, 'Chuyển thành công');
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
  if (bankEnabled) methods.push({ id: 'bank', label: 'Chuyển khoản VNĐ', Icon: Banknote, color: 'text-blue-500', bg: 'bg-blue-50', ring: 'focus:ring-blue-500/20' });
  if (cryptoEnabled) methods.push({ id: 'bep20', label: 'USDT (BEP20)', icon: 'usdt', color: 'text-emerald-500', bg: 'bg-emerald-50', ring: 'focus:ring-emerald-500/20' });
  if (trc20Enabled) methods.push({ id: 'trc20', label: 'USDT (TRC20)', icon: 'usdt', color: 'text-rose-500', bg: 'bg-rose-50', ring: 'focus:ring-rose-500/20' });

  // Auto-select first available method
  useEffect(() => {
    if (methods.length > 0 && !methods.find(m => m.id === method)) {
      setMethod(methods[0].id);
    }
  }, [depositConfig]);

  return (
    <div className="space-y-6 lg:space-y-8 pb-10">
      <Breadcrumb items={[
        { label: 'Tổng quan', to: '/buyer/dashboard' },
        { label: 'Tài chính', to: '/buyer/dashboard/finance/deposit' },
        { label: 'Quản lý ví & Nạp tiền' },
      ]} />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-black text-slate-800 tracking-tight">Quản lý ví tài chính</h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5">Theo dõi số dư, nạp tiền hoặc rút hoa hồng</p>
        </div>
      </div>

      {/* Wallet cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
        {/* Main Wallet */}
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 p-6 lg:p-7 text-white shadow-xl shadow-indigo-500/20">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 blur-[50px] rounded-full pointer-events-none" />
          
          <div className="relative flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
                <Wallet size={22} className="text-white drop-shadow" />
              </div>
              <div className="pt-1">
                <p className="text-[13px] font-bold text-indigo-100 tracking-wide uppercase">Ví Traffic chính</p>
                <p className="text-[11px] font-medium text-indigo-200 mt-0.5">Dùng để thanh toán gói</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur border border-white/20 px-2.5 py-1 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/90">Hoạt động</span>
            </div>
          </div>
          
          <div className="flex items-baseline gap-2 mb-6">
            <p className="text-4xl lg:text-[40px] font-black tracking-tight drop-shadow-sm">{fmt(wallets.main.balance)}</p>
            <span className="text-lg font-bold text-indigo-200">VNĐ</span>
          </div>
          
          <button onClick={() => document.getElementById('deposit-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full py-3.5 bg-white text-indigo-700 text-[13px] font-black rounded-2xl transition hover:bg-slate-50 hover:scale-[1.01] active:scale-[0.99] shadow-[0_4px_12px_-2px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2">
            Nạp thêm tiền vào ví <ArrowRight size={14} />
          </button>
        </div>

        {/* Commission Wallet */}
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-6 lg:p-7 text-white shadow-xl shadow-emerald-500/20">
          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-black/10 blur-[50px] rounded-full pointer-events-none" />
          
          <div className="relative flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
                <Gift size={22} className="text-white drop-shadow" />
              </div>
              <div className="pt-1">
                <p className="text-[13px] font-bold text-emerald-100 tracking-wide uppercase">Ví phụ (Hoa hồng)</p>
                <p className="text-[11px] font-medium text-emerald-200 mt-0.5">Tiền thưởng giới thiệu</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-baseline gap-2 mb-6">
            <p className="text-4xl lg:text-[40px] font-black tracking-tight drop-shadow-sm">{fmt(wallets.commission.balance)}</p>
            <span className="text-lg font-bold text-emerald-200">VNĐ</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 relative z-10">
            <button onClick={() => setModal('transfer')} disabled={wallets.commission.balance <= 0}
              className="flex items-center justify-center gap-2 py-3.5 border-2 border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed hover:disabled:bg-white/10 hover:disabled:border-white/30 text-white text-[13px] font-bold rounded-2xl transition-all">
              <ArrowLeftRight size={14} /> Trút vào ví chính
            </button>
            <button onClick={() => setModal('withdraw')} disabled={wallets.commission.balance <= 0}
              className="flex items-center justify-center gap-2 py-3.5 border-2 border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed hover:disabled:bg-white/10 hover:disabled:border-white/30 text-white text-[13px] font-bold rounded-2xl transition-all">
              <LogOut size={14} /> Làm lệnh rút
            </button>
          </div>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* Deposit form section */}
      <div id="deposit-form" className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* Left 2/3 - Action Area */}
        <div className="lg:col-span-2 space-y-6">

          {/* Crypto result panel */}
          {cryptoResult ? (
            <CryptoDepositPanel data={cryptoResult} onClose={() => { setCryptoResult(null); fetchWallets(); }} />
          ) : (
            <>
              {/* Method Selector */}
              {methods.length > 0 && (
                <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] p-6 lg:p-7">
                  <h2 className="text-lg font-black text-slate-800 tracking-tight mb-2">1. Chọn phương thức nạp</h2>
                  <p className="text-[13px] font-medium text-slate-500 mb-6">Tiền sẽ được cộng tự động vào Ví Traffic của bạn.</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    {methods.map(({ id, label, Icon, icon, color, bg, ring }) => {
                      const sel = method === id;
                      return (
                        <button key={id} type="button" onClick={() => setMethod(id)}
                          className={`relative flex flex-col items-start gap-4 p-5 rounded-[20px] transition-all duration-200 text-left overflow-hidden outline-none
                            ${sel 
                              ? `bg-indigo-50 border-2 border-indigo-600 shadow-[0_4px_16px_-4px_rgba(79,70,229,0.2)]` 
                              : `bg-slate-50/50 border-2 border-transparent hover:bg-slate-50 hover:border-slate-200 ${ring}`}`}>
                          
                          {/* Top right check icon for active */}
                          {sel && (
                            <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}

                          <div className={`w-12 h-12 rounded-[16px] ${bg} flex items-center justify-center shadow-inner ${sel ? 'bg-white' : ''}`}>
                            {icon === 'usdt' ? <UsdtIcon size={24} /> : <Icon size={22} className={color} strokeWidth={2.5} />}
                          </div>
                          
                          <span className={`text-[13px] mt-1 ${sel ? 'font-black text-indigo-900' : 'font-bold text-slate-600'}`}>
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Amount form */}
              {methods.length > 0 && (
                <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] p-6 lg:p-7 relative overflow-hidden">
                  
                  <h2 className="text-lg font-black text-slate-800 tracking-tight mb-2">2. Số tiền thanh toán</h2>
                  <p className="text-[13px] font-medium text-slate-500 mb-6">
                    {method === 'bep20' || method === 'trc20'
                      ? `Nạp tối thiểu ${method === 'trc20' ? (depositConfig?.trc20?.minUsdt || depositConfig?.crypto?.minUsdt || 1) : (depositConfig?.crypto?.minUsdt || 1)} USDT (tỷ giá gốc 1 USDT ≈ ${fmt(depositConfig?.rate || 25500)} đ)`
                      : 'Hệ thống hỗ trợ nạp từ 10.000 VNĐ'}
                  </p>

                  <form onSubmit={handleDeposit} className="space-y-6">
                    {/* Quick selectors */}
                    <div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {QUICK.map(q => (
                          <button key={q} type="button" onClick={() => setAmount(String(q))}
                            className={`py-2 px-1 text-[12px] font-bold rounded-xl border border-transparent transition-all outline-none
                              ${amount === String(q) 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-[1.05]' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            {fmt(q)} đ
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom input */}
                    <div className="relative max-w-sm">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <span className="text-slate-400 font-bold">VND</span>
                      </div>
                      <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                        placeholder="0" min="10000" step="1000"
                        className="w-full pl-16 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-[20px] text-lg font-black text-slate-800 focus:outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:font-normal placeholder:text-slate-300" />
                        
                      {/* Sub hints */}
                      {amount && Number(amount) >= 10000 && (method === 'bep20' || method === 'trc20') && depositConfig?.rate && (
                        <div className="absolute -bottom-7 left-2 flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 animate-in slide-in-from-top-1">
                          <ArrowRight size={12} /> {(Number(amount) / depositConfig.rate).toFixed(2)} USDT cần gửi
                        </div>
                      )}
                    </div>

                    <div className="pt-4 max-w-sm">
                      <button type="submit" disabled={processing || Number(amount) < 10000}
                        className="w-full flex items-center justify-center gap-2 py-4 font-black text-white text-[15px] rounded-[20px]
                          bg-indigo-600 shadow-[0_4px_16px_-4px_rgba(79,70,229,0.3)]
                          transition-all hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-[0.98] outline-none focus:ring-4 focus:ring-indigo-500/20
                          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100">
                        {processing
                          ? <><RefreshCw size={18} className="animate-spin" /> Hệ thống đang tạo lệnh...</>
                          : (method === 'bep20' || method === 'trc20')
                            ? <><UsdtIcon size={20} /> Thanh toán bằng Crypto</>
                            : <><Wallet size={18} /> Xác nhận nạp tiền ngay</>}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {methods.length === 0 && depositConfig && (
                <div className="bg-amber-50 border-2 border-amber-200/50 rounded-[24px] p-8 text-center">
                  <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-500">
                    <Info size={32} />
                  </div>
                  <h3 className="text-xl font-black text-amber-900 mb-2 tracking-tight">Cổng nạp đang bảo trì</h3>
                  <p className="text-[13px] font-medium text-amber-700">Tất cả các phương thức nạp tiền hiện đang được vô hiệu hóa. Vui lòng liên hệ quản trị viên.</p>
                </div>
              )}
            </>
          )}

        </div>

        {/* Right 1/3 - Info Sidebar */}
        <div className="space-y-5">

          {/* Guidelines Box */}
          <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] p-6 block">
            <h3 className="font-black text-slate-800 text-base mb-4 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Info size={14} className="text-slate-500" />
              </span>
              Lưu ý dịch vụ
            </h3>
            <ul className="text-[12px] font-medium text-slate-500 space-y-3">
              <li className="flex gap-2"><span className="text-slate-300 inline-block w-4">01</span> Tiền nạp không thể rút lại (Chỉ dùng mua Traffic).</li>
              <li className="flex gap-2"><span className="text-slate-300 inline-block w-4">02</span> VNĐ được xử lý siêu tốc trong vòng 3-5 phút làm việc.</li>
              {(cryptoEnabled || trc20Enabled) && (depositConfig?.crypto?.auto || depositConfig?.trc20?.auto) && (
                <li className="flex gap-2"><span className="text-slate-300 inline-block w-4">03</span> USDT mạng Web3 hệ thống sẽ tự động đối soát 24/7.</li>
              )}
              {cryptoEnabled && (
                <li className="flex gap-2"><span className="text-slate-300 inline-block w-4">04</span> Tuyệt đối không chuyển USDT nhầm mạng BEP20/TRC20.</li>
              )}
            </ul>
          </div>

          {/* Reference Boxes */}
          {!cryptoResult && (
            <div className="space-y-4">
              {bankEnabled && depositConfig?.bank && (
                <div className="bg-slate-50 rounded-[20px] p-5 border border-slate-100 transition-colors hover:bg-slate-100/50">
                  <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-widest mb-3">Tài khoản đích (VNĐ)</h4>
                  <div className="space-y-1">
                    <CopyField label="Ngân hàng" value={depositConfig.bank.bankName} />
                    <CopyField label="Số thẻ/TK" value={depositConfig.bank.accountNumber} />
                    <CopyField label="Chủ TK" value={depositConfig.bank.accountHolder} />
                    {depositConfig.bank.branch && <CopyField label="Chi nhánh" value={depositConfig.bank.branch} />}
                  </div>
                </div>
              )}

              {(cryptoEnabled || trc20Enabled) && (
                <div className="bg-slate-50 rounded-[20px] p-5 border border-slate-100 transition-colors hover:bg-slate-100/50">
                  <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-widest mb-4">MetaMask / TrustWallet</h4>
                  <div className="space-y-3.5 text-[12px] font-medium text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Stablecoin</span>
                      <span className="font-black text-slate-800 tracking-tight flex items-center gap-1.5"><UsdtIcon size={14} /> USDT</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Thuật toán khớp</span>
                      <span className="text-emerald-600 font-black">Xác thực Auto 2.0</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
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