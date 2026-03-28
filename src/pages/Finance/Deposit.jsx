import { useState, useEffect, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useToast } from '../../components/Toast';
import {
  Wallet, Gift, Banknote, ArrowRight, ArrowLeftRight,
  Info, LogOut, X, Copy, Check, Clock, ExternalLink, RefreshCw,
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isTransfer ? 'bg-blue-100' : 'bg-red-100'}`}>
              {isTransfer ? <ArrowLeftRight size={16} className="text-blue-600" /> : <LogOut size={16} className="text-red-500" />}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                {isTransfer ? 'Chuyển sang Ví Traffic' : 'Rút tiền về tài khoản'}
              </h3>
              <p className="text-xs text-gray-400">Số dư: <strong className="text-orange-600">{fmt(balance)} đ</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Chọn nhanh</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK.slice(0, 6).map(q => {
                const capped = Math.min(q, balance);
                return (
                  <button key={q} type="button" onClick={() => setAmount(String(capped))}
                    className={`py-1.5 text-xs font-bold rounded-lg border-2 transition-all
                      ${amount === String(capped) ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {fmt(capped)} đ
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Số tiền</p>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              max={balance} min="1000" placeholder="Nhập số tiền..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-xl transition">
              Hủy
            </button>
            <button type="button" disabled={!valid} onClick={() => onConfirm(num, isTransfer ? 'transfer' : method)}
              className={`flex-1 py-2.5 text-white font-bold text-sm rounded-xl transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isTransfer ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-500 hover:bg-red-600'}`}>
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

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <UsdtIcon size={22} />
          </div>
          <div>
            <h3 className="font-black text-emerald-800 text-base">Gửi USDT để hoàn tất</h3>
            <p className="text-xs text-emerald-600">
              {data.auto ? '⚡ Tự động xác nhận sau khi nhận USDT' : '⏳ Admin sẽ xác nhận thủ công'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
      </div>

      {/* Amount to send */}
      <div className="bg-white rounded-xl p-4 border border-emerald-200">
        <p className="text-xs text-gray-500 mb-1">Số USDT cần gửi (chính xác)</p>
        <div className="flex items-center gap-3">
          <p className="text-3xl font-black text-emerald-700">{data.usdtAmount}</p>
          <span className="text-sm font-bold text-emerald-500">USDT</span>
          <button onClick={() => { navigator.clipboard.writeText(String(data.usdtAmount)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="ml-auto px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-xs font-bold text-emerald-700 flex items-center gap-1 transition">
            {copied ? <><Check size={12} /> Đã copy</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">≈ {fmt(data.amount)} VNĐ • Tỷ giá: 1 USDT = {fmt(data.rate)} VNĐ</p>
      </div>

      {/* Deposit address */}
      <div className="bg-white rounded-xl p-4 border border-emerald-200">
        <p className="text-xs text-gray-500 mb-2">Địa chỉ ví nhận (BSC - BEP20)</p>
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
          <code className="text-xs font-mono text-gray-800 break-all flex-1">{data.depositAddress}</code>
          <button onClick={() => { navigator.clipboard.writeText(data.depositAddress); }}
            className="p-1.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 transition shrink-0">
            <Copy size={14} className="text-gray-500" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 mt-2 text-amber-600">
          <Info size={12} />
          <p className="text-[10px] font-semibold">Chỉ gửi USDT trên mạng BSC (BEP20). Gửi sai mạng sẽ mất tiền!</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <Clock size={16} className="text-blue-500 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-blue-700">Đang chờ giao dịch...</p>
          <p className="text-[10px] text-blue-500">Mã: {data.refCode} • {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</p>
        </div>
        {data.auto && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-full">
            <RefreshCw size={10} className="animate-spin" /> Auto
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Sau khi gửi USDT, hệ thống sẽ tự động phát hiện trong 1-3 phút và cộng tiền vào ví.
      </p>
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
      if (method === 'crypto') {
        const data = await api.post('/finance/deposits', { amount: num, method: 'crypto' });
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
  const methods = [];
  if (bankEnabled) methods.push({ id: 'bank', label: 'Ngân hàng', Icon: Banknote, color: 'bg-blue-600', border: 'border-blue-200', bg: 'bg-blue-50' });
  if (cryptoEnabled) methods.push({ id: 'crypto', label: 'Crypto (USDT)', icon: 'usdt', color: 'bg-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50' });

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

      <div>
        <h1 className="text-2xl font-black text-gray-900">Quản lý ví</h1>
        <p className="text-sm text-gray-500 mt-1">Nạp tiền vào Ví Traffic, chuyển hoặc rút Ví Hoa Hồng</p>
      </div>

      {/* Wallet cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center"><Wallet size={18} /></div>
            <div>
              <p className="text-xs font-semibold text-blue-200">Ví Traffic</p>
              <p className="text-[10px] text-blue-300">Dùng để mua gói traffic</p>
            </div>
          </div>
          <p className="text-3xl font-black">{fmt(wallets.main.balance)}</p>
          <p className="text-sm text-blue-200 mt-0.5 mb-4">VNĐ</p>
          <button onClick={() => document.getElementById('deposit-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition">
            + Nạp tiền vào ví này ↓
          </button>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-orange-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center"><Gift size={18} /></div>
            <div>
              <p className="text-xs font-semibold text-orange-100">Ví Hoa Hồng</p>
              <p className="text-[10px] text-orange-200">Nhận từ chương trình giới thiệu</p>
            </div>
          </div>
          <p className="text-3xl font-black">{fmt(wallets.commission.balance)}</p>
          <p className="text-sm text-orange-200 mt-0.5 mb-4">VNĐ</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setModal('transfer')} disabled={wallets.commission.balance <= 0}
              className="flex items-center justify-center gap-1.5 py-2 bg-white/20 hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition">
              <ArrowLeftRight size={13} /> Chuyển → Traffic
            </button>
            <button onClick={() => setModal('withdraw')} disabled={wallets.commission.balance <= 0}
              className="flex items-center justify-center gap-1.5 py-2 bg-white/20 hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition">
              <LogOut size={13} /> Rút tiền
            </button>
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
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-bold text-gray-800 mb-1">Phương thức nạp tiền</h2>
              <p className="text-xs text-gray-400 mb-4">Chọn phương thức để nạp vào <span className="font-semibold text-blue-600">Ví Traffic</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {methods.map(({ id, label, Icon, icon, color, border, bg }) => {
                  const sel = method === id;
                  return (
                    <button key={id} type="button" onClick={() => setMethod(id)}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-all
                        ${sel ? `${border} ${bg} shadow-sm scale-[1.02]` : 'border-gray-200 hover:border-gray-300'}`}>
                      {icon === 'usdt' ? (
                        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
                          <UsdtIcon size={22} />
                        </div>
                      ) : (
                        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
                          <Icon size={18} className="text-white" />
                        </div>
                      )}
                      <span className={`text-xs font-semibold ${sel ? 'text-gray-800' : 'text-gray-500'}`}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amount form */}
          {!cryptoResult && methods.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-bold text-gray-800 mb-1">Nhập số tiền nạp</h2>
              <p className="text-xs text-gray-400 mb-4">
                {method === 'crypto'
                  ? `Tối thiểu ${depositConfig?.crypto?.minUsdt || 1} USDT • Tỷ giá: 1 USDT ≈ ${fmt(depositConfig?.rate || 25500)} VNĐ`
                  : 'Nạp tối thiểu 10.000 VNĐ'}
              </p>
              <form onSubmit={handleDeposit} className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">Chọn nhanh</p>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK.map(q => (
                      <button key={q} type="button" onClick={() => setAmount(String(q))}
                        className={`py-2.5 text-xs font-bold rounded-xl border-2 transition-all
                          ${amount === String(q) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {fmt(q)} đ
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Hoặc nhập số tiền khác</p>
                  <div className="relative">
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="Nhập số tiền (VNĐ)" min="10000" step="1000"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-14" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">VNĐ</span>
                  </div>
                  {amount && Number(amount) >= 10000 && method === 'crypto' && depositConfig?.rate && (
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      ≈ {(Number(amount) / depositConfig.rate).toFixed(4)} USDT
                    </p>
                  )}
                  {amount && Number(amount) >= 10000 && method !== 'crypto' && (
                    <p className="text-xs text-blue-600 font-medium mt-1">✓ {fmt(Number(amount))} VNĐ</p>
                  )}
                </div>

                <button type="submit" disabled={processing || Number(amount) < 10000}
                  className="w-full flex items-center justify-center gap-2 py-3.5 font-black text-white text-base rounded-2xl
                    bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg shadow-blue-200
                    transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  {processing
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Đang xử lý...</>
                    : method === 'crypto'
                      ? <><UsdtIcon size={18} />Tạo đơn nạp Crypto<ArrowRight size={16} /></>
                      : <><Wallet size={16} />Nạp vào Ví Traffic<ArrowRight size={16} /></>}
                </button>
              </form>
            </div>
          )}

          {/* No methods available */}
          {!cryptoResult && methods.length === 0 && depositConfig && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
              <p className="text-amber-700 font-bold mb-1">Chưa có phương thức nạp tiền nào được bật</p>
              <p className="text-xs text-amber-600">Vui lòng liên hệ admin để được hỗ trợ nạp tiền.</p>
            </div>
          )}
        </div>

        {/* Right 1/3 - Sidebar */}
        <div className="space-y-4">

          {/* Bank info (from admin config) */}
          {bankEnabled && depositConfig?.bank && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <Banknote size={14} className="text-blue-500" /> Thông tin chuyển khoản
              </h3>
              <div className="space-y-0.5 divide-y divide-gray-100">
                <CopyField label="Ngân hàng" value={depositConfig.bank.bankName} />
                <CopyField label="Số TK" value={depositConfig.bank.accountNumber} />
                <CopyField label="Chủ TK" value={depositConfig.bank.accountHolder} />
                {depositConfig.bank.branch && <CopyField label="Chi nhánh" value={depositConfig.bank.branch} />}
              </div>
            </div>
          )}

          {/* Crypto info */}
          {cryptoEnabled && (
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5">
              <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <UsdtIcon size={16} /> Nạp Crypto
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Mạng</span>
                  <span className="font-bold text-gray-800">BSC (BEP20)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Token</span>
                  <span className="font-bold text-emerald-600">USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tỷ giá</span>
                  <span className="font-bold text-gray-800">1 USDT ≈ {fmt(depositConfig?.rate || 25500)} VNĐ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Xác nhận</span>
                  <span className={`font-bold ${depositConfig?.crypto?.auto ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {depositConfig?.crypto?.auto ? '⚡ Tự động' : '⏳ Thủ công'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1.5"><Info size={13} /> Lưu ý quan trọng</p>
            <ul className="text-xs text-amber-700 space-y-1.5">
              <li>• Nạp tối thiểu <strong>10.000 VNĐ</strong></li>
              {bankEnabled && <li>• Chuyển khoản: Admin xác nhận trong <strong>5-15 phút</strong></li>}
              {cryptoEnabled && depositConfig?.crypto?.auto && (
                <li>• Crypto: Tự động xác nhận sau <strong>1-3 phút</strong></li>
              )}
              <li>• Chuyển ví HH → Traffic: <strong>ngay lập tức</strong></li>
              {cryptoEnabled && (
                <li>• <strong className="text-red-600">Chỉ gửi USDT trên BSC (BEP20)</strong></li>
              )}
            </ul>
          </div>

          {/* Commission quick actions */}
          <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 text-sm mb-1 flex items-center gap-2">
              <Gift size={14} className="text-orange-500" /> Ví Hoa Hồng
            </h3>
            <p className="text-xs text-gray-400 mb-3">Số dư: <strong className="text-orange-600">{fmt(wallets.commission.balance)} đ</strong></p>
            <div className="space-y-2">
              <button onClick={() => setModal('transfer')} disabled={wallets.commission.balance <= 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-blue-200 bg-blue-50
                  hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed">
                <ArrowLeftRight size={13} /> Chuyển sang Ví Traffic
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