import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import { Wallet, Building2, Bitcoin, AlertCircle, CheckCircle2, Clock, Globe, Gift } from 'lucide-react';
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
  const [commission, setCommission] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [wdTotal, setWdTotal] = useState(0);
  const [wdPage, setWdPage] = useState(1);
  const WD_LIMIT = 5;
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [bankEnabled, setBankEnabled] = useState(false);
  const [cryptoEnabled, setCryptoEnabled] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [usdtRate, setUsdtRate] = useState(null);

  const minWithdraw = 50000;

  const fetchBalance = () => {
    api.get('/vuot-link/worker/balance').then(d => {
      setBalance(d.balance || 0);
      setCommission(d.commission || 0);
    }).catch(() => { });
  };

  const fetchWithdrawals = (p = 1) => {
    api.get(`/finance/withdrawals?page=${p}&limit=${WD_LIMIT}`)
      .then(d => { setWithdrawals(d.withdrawals || []); setWdTotal(d.total || 0); setWdPage(p); })
      .catch(() => { });
  };

  useEffect(() => {
    fetchBalance();
    fetchWithdrawals(1);
    // Fetch withdraw method settings
    api.get('/finance/withdraw-config').then(d => {
      const bank = d.bank_enabled;
      const crypto = d.crypto_enabled;
      setBankEnabled(bank);
      setCryptoEnabled(crypto);
      // Auto-select first available method
      if (bank) setMethod('bank');
      else if (crypto) setMethod('crypto');
      setConfigLoaded(true);
    }).catch(() => {
      setBankEnabled(true);
      setCryptoEnabled(true);
      setMethod('bank');
      setConfigLoaded(true);
    });
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

  const handleTransferCommission = async () => {
    if (commission <= 0) return;
    if (!window.confirm(`Bạn muốn chuyển ${fmt(commission)} VNĐ từ Ví Hoa Hồng sang Ví Thu nhập để rút tiền?`)) return;

    setTransferring(true);
    try {
      const d = await api.post('/finance/transfer', { amount: commission, targetWallet: 'earning' });
      toast.success(d.message);
      fetchWithdrawals(1);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Lỗi chuyển tiền');
    } finally {
      setTransferring(false);
    }
  };

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
      fetchBalance();
      fetchBalance();
      fetchWithdrawals(1);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Có lỗi xảy ra');
    }
    setLoading(false);
  };

  const CRYPTO_NETWORKS = ['USDT (BEP20)'];

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Rút tiền' }]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <div className="flex items-center gap-3 mb-2"><Wallet size={20} /><span className="text-sm font-medium text-indigo-100">Ví Thu nhập</span></div>
              <p className="text-3xl font-black">{fmt(balance)} đ</p>
              <p className="text-xs text-indigo-200 mt-1">Tối thiểu rút: {fmt(minWithdraw)} đ</p>
            </div>

            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-5 text-white flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2"><Gift size={20} /><span className="text-sm font-medium text-emerald-100">Ví Hoa hồng</span></div>
                <p className="text-3xl font-black">{fmt(commission)} đ</p>
              </div>
              <button
                onClick={handleTransferCommission}
                disabled={commission <= 0 || transferring}
                className="mt-3 w-full bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg transition cursor-pointer disabled:cursor-not-allowed">
                {transferring ? 'Đang chuyển...' : 'Chuyển sang Thu nhập'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Thông tin rút tiền</h2>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số tiền rút (VNĐ) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={minWithdraw} max={balance} placeholder={`Tối thiểu ${fmt(minWithdraw)} đ`} required
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              <div className="flex gap-2 mt-2">
                {[50000, 100000, 200000, 500000].map(v => (
                  <button key={v} type="button" onClick={() => setAmount(v)} className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition">{fmt(v)}</button>
                ))}
              </div>

              {/* USDT conversion display */}
              {method === 'crypto' && amount && Number(amount) > 0 && usdtRate && (
                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-lg p-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-700">Quy đổi USDT</span>
                    <span className="text-lg font-black text-indigo-600">
                      {(Number(amount) / usdtRate).toFixed(2)} USDT
                    </span>
                  </div>
                  <p className="text-[10px] text-indigo-500 mt-1">Tỷ giá: 1 USDT ~ {fmt(Math.round(usdtRate))} VNĐ (CoinGecko)</p>
                </div>
              )}
            </div>

            {/* Traffic Source */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Globe size={13} className="text-indigo-500" /> Nguồn lưu lượng truy cập *
              </label>
              <input type="text" value={trafficSource} onChange={e => setTrafficSource(e.target.value)}
                placeholder="VD: Website cá nhân, Blog, Fanpage Facebook, Telegram..."
                required
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              <p className="text-[10px] text-slate-400 mt-1">Cho biết bạn chia sẻ link kiếm tiền ở đâu để chúng tôi xác minh</p>
            </div>

            {/* Method selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phương thức *</label>
              <div className="grid grid-cols-2 gap-3">
                {!configLoaded && (
                  <>
                    <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                    <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                  </>
                )}
                {configLoaded && bankEnabled && (
                  <button type="button" onClick={() => setMethod('bank')}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition ${method === 'bank' ? 'border-indigo-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Building2 size={18} className={method === 'bank' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-sm font-semibold">Ngân hàng</span>
                  </button>
                )}
                {configLoaded && cryptoEnabled && (
                  <button type="button" onClick={() => setMethod('crypto')}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition ${method === 'crypto' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Bitcoin size={18} className={method === 'crypto' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-sm font-semibold">Crypto</span>
                  </button>
                )}
                {configLoaded && !bankEnabled && !cryptoEnabled && (
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
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số tài khoản *</label>
                  <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Nhập số tài khoản" required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tên chủ tài khoản *</label>
                  <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="NGUYEN VAN A" required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                </div>
              </>
            )}

            {/* Crypto fields */}
            {method === 'crypto' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mạng / Loại coin *</label>
                  <select value={cryptoNetwork} onChange={e => setCryptoNetwork(e.target.value)} required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white">
                    <option value="">Chọn mạng...</option>
                    {CRYPTO_NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Địa chỉ ví *</label>
                  <input type="text" value={cryptoAddress} onChange={e => setCryptoAddress(e.target.value)} placeholder="Nhập địa chỉ ví nhận" required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 font-mono text-xs" />
                  <p className="text-[10px] text-red-500 mt-1 font-semibold">Vui lòng kiểm tra kỹ địa chỉ ví. Giao dịch crypto không thể hoàn lại.</p>
                </div>
              </>
            )}

            <button type="submit" disabled={loading || !method || (!bankEnabled && !cryptoEnabled)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition text-sm disabled:opacity-50">
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
              ) : withdrawals.map(w => {
                const txMatch = (w.note || '').match(/TxHash:\s*(0x[a-fA-F0-9]+)/);
                const txHash = txMatch ? txMatch[1] : null;
                return (
                  <div key={w.id} className="py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{fmt(w.amount)} đ</p>
                        <p className="text-[10px] text-slate-400">
                          {w.method === 'crypto' ? 'Crypto' : 'Bank'} • {new Date(w.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${w.status === 'completed' ? 'bg-green-50 text-green-600' : w.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                        {w.status === 'completed' ? <><CheckCircle2 size={10} /> Thành công</> : w.status === 'pending' ? <><Clock size={10} /> Đang xử lý</> : 'Từ chối'}
                      </span>
                    </div>
                    {txHash && (
                      <a href={`https://bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-[10px] text-indigo-600 hover:text-blue-700 font-mono">
                        <svg width="10" height="10" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#F3BA2F" /></svg>
                        TxHash: {txHash.slice(0, 10)}...{txHash.slice(-6)} ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Pagination lịch sử rút */}
            {wdTotal > WD_LIMIT && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400">{wdPage}/{Math.ceil(wdTotal / WD_LIMIT)} trang</span>
                <div className="flex gap-1">
                  <button onClick={() => fetchWithdrawals(wdPage - 1)} disabled={wdPage === 1}
                    className="px-2 py-1 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition">‹</button>
                  <button onClick={() => fetchWithdrawals(wdPage + 1)} disabled={wdPage >= Math.ceil(wdTotal / WD_LIMIT)}
                    className="px-2 py-1 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition">›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
