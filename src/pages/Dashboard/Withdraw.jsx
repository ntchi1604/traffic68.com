import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import { Wallet, Building2, Bitcoin, AlertCircle, CheckCircle2, Clock, Gift, ShieldCheck, Settings, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

export default function Withdraw() {
  usePageTitle('Rút tiền');
  const toast = useToast();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [trafficSource, setTrafficSource] = useState('');
  const [balance, setBalance] = useState(0);
  const [commission, setCommission] = useState(0);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const balanceIntervalRef = useRef(null);
  const [wdTotal, setWdTotal] = useState(0);
  const [wdPage, setWdPage] = useState(1);
  const WD_LIMIT = 5;
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [bankEnabled, setBankEnabled] = useState(false);
  const [cryptoEnabled, setCryptoEnabled] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [usdtRate, setUsdtRate] = useState(null);

  // Saved wallet state
  const [savedWallet, setSavedWallet] = useState(null); // null = not loaded yet
  const [walletLoaded, setWalletLoaded] = useState(false);

  // Source approval
  const [sourceStatus, setSourceStatus] = useState(null);
  const [approvedSource, setApprovedSource] = useState('');

  const minWithdraw = 50000;

  const fetchBalance = (showSpinner = false) => {
    if (showSpinner) setBalanceRefreshing(true);
    api.get('/vuot-link/worker/balance').then(d => {
      setBalance(d.balance || 0);
      setCommission(d.commission || 0);
    }).catch(() => { }).finally(() => {
      if (showSpinner) setTimeout(() => setBalanceRefreshing(false), 500);
    });
  };

  const fetchWithdrawals = (p = 1) => {
    api.get(`/finance/withdrawals?page=${p}&limit=${WD_LIMIT}`)
      .then(d => { setWithdrawals(d.withdrawals || []); setWdTotal(d.total || 0); setWdPage(p); })
      .catch(() => { });
  };

  useEffect(() => {
    fetchBalance();
    fetchWithdrawals(1);
    // Auto-refresh số dư mỗi 30 giây
    balanceIntervalRef.current = setInterval(() => fetchBalance(), 30000);
    return () => clearInterval(balanceIntervalRef.current);

    // Fetch withdraw method settings
    api.get('/finance/withdraw-config').then(d => {
      setBankEnabled(d.bank_enabled);
      setCryptoEnabled(d.crypto_enabled);
      setConfigLoaded(true);
    }).catch(() => {
      setBankEnabled(true);
      setCryptoEnabled(true);
      setConfigLoaded(true);
    });

    // Load saved wallet
    api.get('/users/profile').then(data => {
      const u = data.user;
      if (u.withdraw_wallet) {
        setSavedWallet(u.withdraw_wallet);
      }
      setWalletLoaded(true);
    }).catch(() => setWalletLoaded(true));

    // Load approved source
    const token = localStorage.getItem('token') || '';
    fetch('/api/worker/source', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setSourceStatus(d.source_status || 'pending');
        if (d.source_status === 'approved' && d.source_url) {
          setApprovedSource(d.source_url);
          setTrafficSource(d.source_url); // auto-fill
        }
      })
      .catch(() => {});

    // USDT rate
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd')
      .then(r => r.json())
      .then(d => { if (d?.tether?.vnd) setUsdtRate(d.tether.vnd); })
      .catch(() => { setUsdtRate(25500); });
  }, []);

  const handleTransferCommission = async () => {
    if (commission <= 0) return;
    if (!window.confirm(`Bạn muốn chuyển ${fmt(commission)} VNĐ từ Ví Hoa Hồng sang Ví Thu nhập để rút tiền?`)) return;
    setTransferring(true);
    try {
      const d = await api.post('/finance/transfer', { amount: commission, targetWallet: 'earning' });
      toast.success(d.message);
      fetchBalance();
      fetchWithdrawals(1);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Lỗi chuyển tiền');
    } finally {
      setTransferring(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!savedWallet) {
      toast.error('Bạn chưa lưu ví rút tiền! Vào Hồ sơ → tab Ví rút tiền để cài đặt.');
      return;
    }
    if (!trafficSource.trim()) {
      toast.error('Vui lòng nhập nguồn lưu lượng truy cập');
      return;
    }
    setLoading(true);
    try {
      const d = await api.post('/finance/withdraw', { amount, trafficSource });
      toast.success(d.message, 'Rút tiền');
      setAmount('');
      fetchBalance();
      fetchWithdrawals(1);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Có lỗi xảy ra');
    }
    setLoading(false);
  };

  // Wallet display helper
  const WalletDisplay = () => {
    if (!walletLoaded) {
      return <div className="h-16 bg-slate-100 animate-pulse rounded-xl" />;
    }
    if (!savedWallet) {
      return (
        <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50">
          <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-700">Chưa có ví rút tiền</p>
            <p className="text-xs text-amber-600 mt-0.5">Bạn cần lưu thông tin ví trước khi rút tiền.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/worker/dashboard/profile?tab=wallet')}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition"
          >
            <Settings size={12} /> Cài đặt ví
          </button>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {savedWallet.method === 'bank'
              ? <Building2 size={16} className="text-emerald-600" />
              : <Bitcoin size={16} className="text-emerald-600" />}
            <span className="text-sm font-bold text-emerald-700">
              {savedWallet.method === 'bank' ? 'Ngân hàng' : 'Crypto'}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-200 text-emerald-800 rounded-full">Ví đã lưu</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/worker/dashboard/profile?tab=wallet')}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition"
          >
            <Settings size={12} /> Thay đổi
          </button>
        </div>
        {savedWallet.method === 'bank' ? (
          <div className="space-y-1">
            <p className="text-xs text-slate-700"><span className="text-slate-400 w-28 inline-block">Ngân hàng:</span> <b>{savedWallet.bankName}</b></p>
            <p className="text-xs text-slate-700"><span className="text-slate-400 w-28 inline-block">Số TK:</span> <b className="font-mono">{savedWallet.accountNumber}</b></p>
            <p className="text-xs text-slate-700"><span className="text-slate-400 w-28 inline-block">Chủ tài khoản:</span> <b>{savedWallet.accountName}</b></p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-slate-700"><span className="text-slate-400 w-28 inline-block">Mạng:</span> <b>{savedWallet.cryptoNetwork}</b></p>
            <p className="text-xs text-slate-700 break-all"><span className="text-slate-400 w-28 inline-block">Địa chỉ ví:</span> <b className="font-mono text-[11px]">{savedWallet.cryptoAddress}</b></p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Rút tiền' }]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3"><Wallet size={20} /><span className="text-sm font-medium text-indigo-100">Ví Thu nhập</span></div>
                <button onClick={() => fetchBalance(true)} title="Làm mới số dư"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
                >
                  <RefreshCw size={13} className={balanceRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>
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
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={minWithdraw} max={balance}
                placeholder={`Tối thiểu ${fmt(minWithdraw)} đ`} required
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              <div className="flex gap-2 mt-2">
                {[50000, 100000, 200000, 500000].map(v => (
                  <button key={v} type="button" onClick={() => setAmount(v)}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition">{fmt(v)}</button>
                ))}
              </div>
              {/* USDT conversion */}
              {savedWallet?.method === 'crypto' && amount && Number(amount) > 0 && usdtRate && (
                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-lg p-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-700">Quy đổi USDT</span>
                    <span className="text-lg font-black text-indigo-600">{(Number(amount) / usdtRate).toFixed(2)} USDT</span>
                  </div>
                  <p className="text-[10px] text-indigo-500 mt-1">Tỷ giá: 1 USDT ~ {fmt(Math.round(usdtRate))} VNĐ (CoinGecko)</p>
                </div>
              )}
            </div>

            {/* Wallet info (readonly) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ví nhận tiền</label>
              <WalletDisplay />
            </div>

            {/* Traffic Source */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <ShieldCheck size={13} className={sourceStatus === 'approved' ? 'text-emerald-500' : 'text-indigo-500'} />
                Nguồn lưu lượng truy cập *
                {sourceStatus === 'approved' && (
                  <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded-full">Đã duyệt</span>
                )}
              </label>
              {sourceStatus === 'approved' ? (
                // Approved: show as readonly
                <div className="relative">
                  <div className="w-full px-4 py-3 text-sm border border-emerald-300 rounded-lg bg-emerald-50/50 text-slate-700 min-h-[80px] whitespace-pre-wrap leading-relaxed">
                    {approvedSource}
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full">
                      <CheckCircle2 size={9} /> Tự động
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-600 mt-1 font-medium">✅ Nguồn đã được duyệt — áp dụng tự động</p>
                </div>
              ) : (
                // Not approved: allow manual input
                <>
                  <textarea value={trafficSource} onChange={e => setTrafficSource(e.target.value)}
                    placeholder={"VD: Website cá nhân tại domain.com\nFanpage Facebook: fb.com/page\nGroup Telegram: t.me/group\n..."}
                    required
                    rows={3}
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-y min-h-[80px]" />
                  <p className="text-[10px] text-slate-400 mt-1">Mô tả chi tiết nơi bạn chia sẻ link để chúng tôi xác minh</p>
                  {sourceStatus === 'pending' && (
                    <p className="text-[10px] text-amber-600 mt-1 font-medium">⏳ Nguồn của bạn đang chờ duyệt. Sau khi duyệt sẽ tự động điền.</p>
                  )}
                </>
              )}
            </div>

            <button type="submit" disabled={loading || !walletLoaded || (!bankEnabled && !cryptoEnabled)}
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
                <p>• Ví rút phải được lưu trước trong Hồ sơ</p>
                <p>• Nguồn đã duyệt sẽ <b>tự động áp dụng</b></p>
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
                const noteBody = (w.note || '').replace(/\s*\|?\s*TxHash:\s*0x[a-fA-F0-9]+/, '').trim();
                const sourceSplit = noteBody.split(' | Nguồn: ');
                const accountInfo = sourceSplit[0] || '';
                const trafficInfo = sourceSplit[1] ? sourceSplit[1].split(' | ')[0] : '';
                const accountDisplay = accountInfo.replace(/^\[(Bank|Crypto)\]\s*/, '');
                return (
                  <div key={w.id} className="py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{fmt(w.amount)} đ</p>
                        <p className="text-[10px] text-slate-400">
                          {w.method === 'crypto' ? 'Crypto' : 'Bank'} • {new Date(w.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${w.status === 'completed' ? 'bg-green-50 text-green-600' : w.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                        {w.status === 'completed' ? <><CheckCircle2 size={10} /> Thành công</> : w.status === 'pending' ? <><Clock size={10} /> Đang xử lý</> : 'Từ chối'}
                      </span>
                    </div>
                    {accountDisplay && (
                      <p className="text-[10px] text-slate-500 mt-1 truncate" title={accountDisplay}>
                        🏦 {accountDisplay}
                      </p>
                    )}
                    {trafficInfo && (
                      <p className="text-[10px] text-indigo-500 mt-0.5 truncate" title={trafficInfo}>
                        🌐 Nguồn: {trafficInfo}
                      </p>
                    )}
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
