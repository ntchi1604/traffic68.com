import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import { Wallet, Building2, Bitcoin, AlertCircle, CheckCircle2, Clock, Globe } from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

export default function Withdraw() {
  usePageTitle('Rút tiền');
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [cryptoNetwork, setCryptoNetwork] = useState('');
  const [cryptoAddress, setCryptoAddress] = useState('');
  const [trafficSource, setTrafficSource] = useState('');
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bankEnabled, setBankEnabled] = useState(true);
  const [cryptoEnabled, setCryptoEnabled] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [usdtRate, setUsdtRate] = useState(null);

  const minWithdraw = 50000;

  useEffect(() => {
    api.get('/vuot-link/worker/balance').then(d => setBalance(d.balance || 0)).catch(() => {});
    api.get('/finance/withdrawals').then(d => setWithdrawals(d.withdrawals || [])).catch(() => {});
    // Fetch withdraw method settings
    api.get('/admin/settings/site').then(d => {
      const c = d.config || {};
      const bank = c.withdraw_bank_enabled !== 'false';
      const crypto = c.withdraw_crypto_enabled !== 'false';
      setBankEnabled(bank);
      setCryptoEnabled(crypto);
      // Auto-select first available method
      if (bank) setMethod('bank');
      else if (crypto) setMethod('crypto');
      setConfigLoaded(true);
    }).catch(() => setConfigLoaded(true));
    // Fetch USDT/VND rate from Binance
    fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL')
      .catch(() => null);
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd')
      .then(r => r.json())
      .then(d => {
        if (d?.tether?.vnd) setUsdtRate(d.tether.vnd);
      })
      .catch(() => {
        // Fallback rate
        setUsdtRate(25500);
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trafficSource.trim()) {
      toast.error('Vui lòng nhập nguồn lưu lượng truy cập');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        amount, method, trafficSource,
        bankName, accountNumber, accountName,
        cryptoNetwork, cryptoAddress,
      };
      const d = await api.post('/finance/withdraw', payload);
      toast.success(d.message, 'Rút tiền');
      setAmount('');
      setTrafficSource('');
      api.get('/vuot-link/worker/balance').then(d => setBalance(d.balance || 0)).catch(() => {});
      api.get('/finance/withdrawals').then(d => setWithdrawals(d.withdrawals || [])).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Có lỗi xảy ra');
    }
    setLoading(false);
  };

  const CRYPTO_NETWORKS = ['USDT (TRC20)', 'USDT (BEP20)', 'USDT (ERC20)', 'BTC', 'ETH', 'BUSD'];

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Rút tiền' }]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Rút tiền</h1>
        <p className="text-slate-500 text-sm mt-1">Rút thu nhập về tài khoản ngân hàng hoặc ví crypto</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
            <div className="flex items-center gap-3 mb-2"><Wallet size={20} /><span className="text-sm font-medium text-blue-100">Số dư khả dụng</span></div>
            <p className="text-3xl font-black">{fmt(balance)} đ</p>
            <p className="text-xs text-blue-200 mt-1">Tối thiểu rút: {fmt(minWithdraw)} đ</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Thông tin rút tiền</h2>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số tiền rút (VNĐ) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={minWithdraw} max={balance} placeholder={`Tối thiểu ${fmt(minWithdraw)} đ`} required
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              <div className="flex gap-2 mt-2">
                {[50000, 100000, 200000, 500000].map(v => (
                  <button key={v} type="button" onClick={() => setAmount(v)} className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition">{fmt(v)}</button>
                ))}
              </div>

              {/* USDT conversion display */}
              {method === 'crypto' && amount && Number(amount) > 0 && usdtRate && (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-700">≈ Quy đổi USDT</span>
                    <span className="text-lg font-black text-orange-600">
                      {(Number(amount) / usdtRate).toFixed(2)} USDT
                    </span>
                  </div>
                  <p className="text-[10px] text-orange-500 mt-1">Tỷ giá: 1 USDT ≈ {fmt(Math.round(usdtRate))} VNĐ (CoinGecko)</p>
                </div>
              )}
            </div>

            {/* Traffic Source */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Globe size={13} className="text-blue-500" /> Nguồn lưu lượng truy cập *
              </label>
              <input type="text" value={trafficSource} onChange={e => setTrafficSource(e.target.value)}
                placeholder="VD: Website cá nhân, Blog, Fanpage Facebook, Telegram..."
                required
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              <p className="text-[10px] text-slate-400 mt-1">Cho biết bạn chia sẻ link kiếm tiền ở đâu để chúng tôi xác minh</p>
            </div>

            {/* Method selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phương thức *</label>
              <div className="grid grid-cols-2 gap-3">
                {bankEnabled && (
                  <button type="button" onClick={() => setMethod('bank')}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition ${method === 'bank' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Building2 size={18} className={method === 'bank' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-sm font-semibold">Ngân hàng</span>
                  </button>
                )}
                {cryptoEnabled && (
                  <button type="button" onClick={() => setMethod('crypto')}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition ${method === 'crypto' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Bitcoin size={18} className={method === 'crypto' ? 'text-orange-600' : 'text-slate-400'} />
                    <span className="text-sm font-semibold">Crypto</span>
                  </button>
                )}
                {!bankEnabled && !cryptoEnabled && (
                  <p className="col-span-2 text-sm text-red-500 font-semibold py-3 text-center">Tạm thời không có phương thức rút tiền nào khả dụng</p>
                )}
              </div>
            </div>

            {/* Bank fields */}
            {method === 'bank' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tên ngân hàng *</label>
                  <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="VD: Vietcombank, MB Bank..." required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số tài khoản *</label>
                  <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Nhập số tài khoản" required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tên chủ tài khoản *</label>
                  <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="NGUYEN VAN A" required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
              </>
            )}

            {/* Crypto fields */}
            {method === 'crypto' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mạng / Loại coin *</label>
                  <select value={cryptoNetwork} onChange={e => setCryptoNetwork(e.target.value)} required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white">
                    <option value="">Chọn mạng...</option>
                    {CRYPTO_NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Địa chỉ ví *</label>
                  <input type="text" value={cryptoAddress} onChange={e => setCryptoAddress(e.target.value)} placeholder="Nhập địa chỉ ví nhận" required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono text-xs" />
                  <p className="text-[10px] text-red-500 mt-1 font-semibold">⚠️ Vui lòng kiểm tra kỹ địa chỉ ví. Giao dịch crypto không thể hoàn lại.</p>
                </div>
              </>
            )}

            <button type="submit" disabled={loading || !method || (!bankEnabled && !cryptoEnabled)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition text-sm disabled:opacity-50">
              {loading ? 'Đang xử lý...' : 'Gửi yêu cầu rút tiền'}
            </button>
          </form>
        </div>

        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800 space-y-1">
                <p className="font-bold">Lưu ý</p>
                <p>• Rút tối thiểu {fmt(minWithdraw)} đ</p>
                <p>• Xử lý trong 1-3 ngày làm việc</p>
                <p>• Bắt buộc điền nguồn lưu lượng truy cập</p>
                {bankEnabled && <p>• Ngân hàng: Tên phải trùng với đăng ký</p>}
                {cryptoEnabled && <p>• Crypto: Kiểm tra kỹ địa chỉ ví và mạng</p>}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Lịch sử rút tiền</h3>
            <div className="space-y-3">
              {withdrawals.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Chưa có lịch sử rút tiền</p>
              ) : withdrawals.slice(0, 5).map(w => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{fmt(w.amount)} đ</p>
                    <p className="text-[10px] text-slate-400">
                      {w.method === 'crypto' ? 'Crypto' : 'Bank'} • {w.note} • {new Date(w.created_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${w.status === 'completed' ? 'bg-green-50 text-green-600' : w.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                    {w.status === 'completed' ? <><CheckCircle2 size={10} /> Thành công</> : w.status === 'pending' ? <><Clock size={10} /> Đang xử lý</> : 'Từ chối'}
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
