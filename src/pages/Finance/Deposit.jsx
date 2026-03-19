import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Gift, CreditCard, Banknote, Smartphone,
  ArrowRight, ArrowLeftRight, CheckCircle2, AlertCircle,
  Info, ChevronRight, LogOut, X,
} from 'lucide-react';
import api from '../../lib/api';
import Breadcrumb from '../../components/Breadcrumb';

/* ── helpers ──────────────────────────────────────── */
const fmt = (n) => n.toLocaleString('vi-VN');

const METHODS = [
  { id: 'momo',  label: 'Momo',           Icon: Smartphone, color: 'bg-pink-500',  border: 'border-pink-200',  bg: 'bg-pink-50'  },
  { id: 'bank',  label: 'Chuyển khoản',   Icon: Banknote,   color: 'bg-green-600', border: 'border-green-200', bg: 'bg-green-50' },
  { id: 'card',  label: 'Thẻ tín dụng',   Icon: CreditCard,  color: 'bg-blue-600',  border: 'border-blue-200',  bg: 'bg-blue-50'  },
];

const QUICK = [50000, 100000, 200000, 500000, 1000000, 2000000];

/* ── Toast ────────────────────────────────────────── */
function Toast({ type, msg, onClose }) {
  if (!msg) return null;
  const ok = type === 'success';
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold border
                     ${ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
      {ok ? <CheckCircle2 size={16} className="flex-shrink-0 text-green-500" /> : <AlertCircle size={16} className="flex-shrink-0 text-red-500" />}
      <span className="flex-1">{msg}</span>
      <button onClick={onClose}><X size={14} /></button>
    </div>
  );
}

/* ── Commission action modal ──────────────────────── */
function CommissionModal({ mode, balance, onConfirm, onClose }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('momo');
  const isTransfer = mode === 'transfer';
  const num = Number(amount);
  const valid = num > 0 && num <= balance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isTransfer ? 'bg-blue-100' : 'bg-red-100'}`}>
              {isTransfer ? <ArrowLeftRight size={16} className="text-blue-600" /> : <LogOut size={16} className="text-red-500" />}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                {isTransfer ? 'Chuyển sang Ví Traffic' : 'Rút tiền về tài khoản'}
              </h3>
              <p className="text-xs text-gray-400">Số dư hoa hồng: <strong className="text-orange-600">{fmt(balance)} đ</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {/* Withdraw method */}
          {!isTransfer && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Phương thức rút</p>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map(({ id, label, Icon, color, border, bg }) => {
                  const sel = method === id;
                  return (
                    <button key={id} type="button" onClick={() => setMethod(id)}
                      className={`flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl transition-all text-xs font-semibold
                                  ${sel ? `${border} ${bg} text-gray-800` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center`}>
                        <Icon size={13} className="text-white" />
                      </div>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick amounts */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Chọn nhanh</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK.map(q => {
                const capped = Math.min(q, balance);
                const display = String(capped);
                return (
                  <button key={q} type="button" onClick={() => setAmount(display)}
                    className={`py-1.5 text-xs font-bold rounded-lg border-2 transition-all
                                 ${amount === display ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {fmt(capped)} đ
                  </button>
                );
              })}
              <button type="button" onClick={() => setAmount(String(balance))}
                className={`py-1.5 text-xs font-bold rounded-lg border-2 transition-all col-span-1
                             ${amount === String(balance) ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                Toàn bộ
              </button>
            </div>
          </div>

          {/* Input */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Hoặc nhập số tiền</p>
            <div className="relative">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                max={balance} min="1000" placeholder="Nhập số tiền..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none
                           focus:ring-2 focus:ring-orange-400 focus:border-transparent transition pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">VNĐ</span>
            </div>
            {num > balance && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> Vượt quá số dư ({fmt(balance)} đ)
              </p>
            )}
          </div>

          {/* Preview */}
          {valid && (
            <div className={`rounded-xl px-4 py-3 text-xs font-medium flex items-center gap-2
                             ${isTransfer ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {isTransfer
                ? <><ArrowLeftRight size={13} /> Ví Hoa Hồng <strong>−{fmt(num)} đ</strong> → Ví Traffic <strong>+{fmt(num)} đ</strong></>
                : <><LogOut size={13} /> Rút <strong>{fmt(num)} đ</strong> qua <strong>{METHODS.find(m => m.id === method)?.label}</strong></>}
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-xl transition">
              Hủy
            </button>
            <button type="button" disabled={!valid} onClick={() => onConfirm(num, method)}
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

/* ── Main ─────────────────────────────────────────── */
export default function Deposit() {
  usePageTitle('Quản lý ví');
  const navigate = useNavigate();
  const [wallets, setWallets] = useState({ main: { balance: 0 }, commission: { balance: 0 } });

  const [method, setMethod] = useState('momo');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState({ type: '', msg: '' });

  // Fetch wallets from API
  const fetchWallets = () => {
    api.get('/finance').then(data => {
      setWallets({
        main: { balance: data.wallets?.main?.balance || 0 },
        commission: { balance: data.wallets?.commission?.balance || 0 },
      });
    }).catch(console.error);
  };

  useEffect(() => { fetchWallets(); }, []);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast({ type: '', msg: '' }), 4000);
  };

  /* Deposit to main wallet via API */
  const handleDeposit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num < 10000) { showToast('error', 'Số tiền nạp tối thiểu là 10.000 VNĐ'); return; }
    setProcessing(true);
    try {
      const methodMap = { momo: 'momo', bank: 'bank_transfer', card: 'credit_card' };
      const data = await api.post('/finance/deposits', { amount: num, method: methodMap[method] || method });
      setAmount('');
      setNote('');
      showToast('success', `Đơn nạp ${fmt(num)} đ đã gửi thành công! Mã: ${data.refCode}. Vui lòng chờ admin xác minh.`);
      fetchWallets();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setProcessing(false);
    }
  };

  /* Commission actions */
  const handleCommissionAction = (num, meth) => {
    showToast('success', `Yêu cầu đã được gửi! (${fmt(num)} đ)`);
    setModal(null);
  };

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Tài chính', to: '/dashboard/finance/deposit' },
        { label: 'Nạp tiền & Quản lý ví' },
      ]} />

      <div>
        <h1 className="text-2xl font-black text-gray-900">Quản lý ví</h1>
        <p className="text-sm text-gray-500 mt-1">Nạp tiền vào Ví Traffic, chuyển hoặc rút Ví Hoa Hồng</p>
      </div>

      <Toast type={toast.type} msg={toast.msg} onClose={() => setToast({ type: '', msg: '' })} />

      {/* ── Wallet cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Ví Traffic */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200">Ví Traffic</p>
              <p className="text-[10px] text-blue-300">Dùng để mua gói traffic</p>
            </div>
          </div>
          <p className="text-3xl font-black">{fmt(wallets.main.balance)}</p>
          <p className="text-sm text-blue-200 mt-0.5 mb-4">VNĐ</p>
          {/* Scroll to form shortcut */}
          <button
            onClick={() => document.getElementById('deposit-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition"
          >
            + Nạp tiền vào ví này ↓
          </button>
        </div>

        {/* Ví Hoa Hồng */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-orange-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Gift size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-100">Ví Hoa Hồng</p>
              <p className="text-[10px] text-orange-200">Nhận từ chương trình giới thiệu</p>
            </div>
          </div>
          <p className="text-3xl font-black">{fmt(wallets.commission.balance)}</p>
          <p className="text-sm text-orange-200 mt-0.5 mb-4">VNĐ</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setModal('transfer')}
              disabled={wallets.commission.balance <= 0}
              className="flex items-center justify-center gap-1.5 py-2 bg-white/20 hover:bg-white/30
                         disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition"
            >
              <ArrowLeftRight size={13} /> Chuyển → Traffic
            </button>
            <button
              onClick={() => setModal('withdraw')}
              disabled={wallets.commission.balance <= 0}
              className="flex items-center justify-center gap-1.5 py-2 bg-white/20 hover:bg-white/30
                         disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition"
            >
              <LogOut size={13} /> Rút tiền
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div id="deposit-form" className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Deposit form (left 2/3) ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Payment method */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-1">Phương thức thanh toán</h2>
            <p className="text-xs text-gray-400 mb-4">Chọn phương thức để nạp vào <span className="font-semibold text-blue-600">Ví Traffic</span></p>
            <div className="grid grid-cols-3 gap-3">
              {METHODS.map(({ id, label, Icon, color, border, bg }) => {
                const sel = method === id;
                return (
                  <button key={id} type="button" onClick={() => setMethod(id)}
                    className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-all
                                ${sel ? `${border} ${bg} shadow-sm scale-[1.02]` : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <span className={`text-xs font-semibold ${sel ? 'text-gray-800' : 'text-gray-500'}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-1">Nhập số tiền nạp</h2>
            <p className="text-xs text-gray-400 mb-4">Nạp tối thiểu 10.000 VNĐ</p>
            <form onSubmit={handleDeposit} className="space-y-4">

              {/* Quick amounts */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">Chọn nhanh</p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK.map(q => (
                    <button key={q} type="button" onClick={() => setAmount(String(q))}
                      className={`py-2.5 text-xs font-bold rounded-xl border-2 transition-all
                                  ${amount === String(q)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {fmt(q)} đ
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1.5">Hoặc nhập số tiền khác</p>
                <div className="relative">
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="Nhập số tiền (VNĐ)" min="10000" step="1000"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-14" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">VNĐ</span>
                </div>
                {amount && Number(amount) >= 10000 && (
                  <p className="text-xs text-blue-600 font-medium mt-1">✓ {fmt(Number(amount))} VNĐ</p>
                )}
              </div>

              {/* Note */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1.5">Ghi chú (tùy chọn)</p>
                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Nội dung chuyển khoản..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
              </div>

              <button type="submit" disabled={processing || Number(amount) < 10000}
                className="w-full flex items-center justify-center gap-2 py-3.5 font-black text-white text-base rounded-2xl
                           bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg shadow-blue-200
                           transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                {processing
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Đang xử lý...</>
                  : <><Wallet size={16} />Nạp vào Ví Traffic<ArrowRight size={16} /></>}
              </button>
            </form>
          </div>
        </div>

        {/* ── Sidebar (right 1/3) ── */}
        <div className="space-y-4">

          {/* Bank info */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 text-sm mb-3">Thông tin chuyển khoản</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between"><span className="font-semibold text-gray-700">Ngân hàng</span><span>Techcombank</span></div>
              <div className="flex justify-between"><span className="font-semibold text-gray-700">Số TK</span><span>1900 1234 5678</span></div>
              <div className="flex justify-between"><span className="font-semibold text-gray-700">Chủ TK</span><span>Công ty Traffic68</span></div>
              <div className="flex justify-between"><span className="font-semibold text-gray-700">Momo</span><span>0909 123 456</span></div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1.5"><Info size={13} /> Lưu ý quan trọng</p>
            <ul className="text-xs text-amber-700 space-y-1.5">
              <li>• Nạp tối thiểu <strong>10.000 VNĐ</strong></li>
              <li>• Thời gian xử lý 5–15 phút</li>
              <li>• Chuyển ví: xử lý <strong>ngay lập tức</strong></li>
              <li>• Rút tiền: xử lý <strong>1–24 giờ</strong></li>
              <li>• Ví Hoa Hồng <strong>không</strong> mua traffic trực tiếp</li>
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
                           hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition
                           disabled:opacity-40 disabled:cursor-not-allowed">
                <ArrowLeftRight size={13} /> Chuyển sang Ví Traffic
              </button>
              <button onClick={() => setModal('withdraw')} disabled={wallets.commission.balance <= 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-red-200 bg-red-50
                           hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition
                           disabled:opacity-40 disabled:cursor-not-allowed">
                <LogOut size={13} /> Rút tiền về tài khoản
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
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