import { useState } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { Wallet, Building2, CreditCard, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const fmt = (n) => Number(n).toLocaleString('vi-VN');

const recentWithdrawals = [
  { id: 1, amount: 100000, method: 'Ngân hàng', bank: 'Vietcombank', account: '****5678', status: 'completed', date: '20/03/2026' },
  { id: 2, amount: 50000, method: 'Ngân hàng', bank: 'MB Bank', account: '****1234', status: 'pending', date: '19/03/2026' },
  { id: 3, amount: 200000, method: 'Momo', bank: 'Momo', account: '****9012', status: 'completed', date: '15/03/2026' },
];

export default function Withdraw() {
  usePageTitle('Rút tiền');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const balance = 450750;
  const minWithdraw = 50000;

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Yêu cầu rút tiền đã được gửi!');
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Rút tiền' },
      ]} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Rút tiền</h1>
        <p className="text-slate-500 text-sm mt-1">Rút thu nhập về tài khoản ngân hàng</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Withdrawal form ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Balance card */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Wallet size={20} />
              <span className="text-sm font-medium text-blue-100">Số dư khả dụng</span>
            </div>
            <p className="text-3xl font-black">{fmt(balance)} đ</p>
            <p className="text-xs text-blue-200 mt-1">Tối thiểu rút: {fmt(minWithdraw)} đ</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Thông tin rút tiền</h2>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số tiền rút (VNĐ) *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={minWithdraw}
                max={balance}
                placeholder={`Tối thiểu ${fmt(minWithdraw)} đ`}
                required
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              <div className="flex gap-2 mt-2">
                {[50000, 100000, 200000, 500000].map(v => (
                  <button key={v} type="button" onClick={() => setAmount(v)} className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition">
                    {fmt(v)}
                  </button>
                ))}
              </div>
            </div>

            {/* Method */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phương thức *</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setMethod('bank')} className={`flex items-center gap-2 p-3 rounded-lg border-2 transition ${method === 'bank' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                  <Building2 size={18} className={method === 'bank' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="text-sm font-semibold">Ngân hàng</span>
                </button>
                <button type="button" onClick={() => setMethod('momo')} className={`flex items-center gap-2 p-3 rounded-lg border-2 transition ${method === 'momo' ? 'border-pink-500 bg-pink-50' : 'border-slate-200'}`}>
                  <CreditCard size={18} className={method === 'momo' ? 'text-pink-600' : 'text-slate-400'} />
                  <span className="text-sm font-semibold">Momo</span>
                </button>
              </div>
            </div>

            {/* Bank details */}
            {method === 'bank' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tên ngân hàng *</label>
                  <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="VD: Vietcombank, MB Bank..." required className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số tài khoản *</label>
                  <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Nhập số tài khoản" required className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tên chủ tài khoản *</label>
                  <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="NGUYEN VAN A" required className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
              </>
            )}
            {method === 'momo' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số điện thoại Momo *</label>
                <input type="tel" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0912345678" required className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
            )}

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition text-sm">
              Gửi yêu cầu rút tiền
            </button>
          </form>
        </div>

        {/* ── Sidebar info + history ── */}
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800 space-y-1">
                <p className="font-bold">Lưu ý</p>
                <p>• Rút tối thiểu {fmt(minWithdraw)} đ</p>
                <p>• Xử lý trong 1-3 ngày làm việc</p>
                <p>• Số tài khoản phải trùng tên đăng ký</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Lịch sử rút tiền</h3>
            <div className="space-y-3">
              {recentWithdrawals.map(w => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{fmt(w.amount)} đ</p>
                    <p className="text-[10px] text-slate-400">{w.bank} • {w.date}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${w.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                    {w.status === 'completed' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                    {w.status === 'completed' ? 'Thành công' : 'Đang xử lý'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
