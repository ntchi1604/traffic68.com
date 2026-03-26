import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useToast } from '../../components/Toast';
import {
  Wallet, Send, RefreshCw, ExternalLink, CheckCircle2, XCircle,
  Clock, Zap, Settings, TrendingUp, AlertTriangle, Coins
} from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

// USDT icon
const UsdtIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path d="M17.9 17.05v-.03c-.1 0-.71.04-2 .04-1 0-1.72-.04-1.96-.04v.03c-3.47-.15-6.06-.8-6.06-1.58 0-.78 2.59-1.43 6.06-1.58v2.52c.25.02.98.06 1.98.06 1.2 0 1.77-.05 1.98-.06v-2.52c3.46.15 6.04.8 6.04 1.58 0 .78-2.58 1.43-6.04 1.58zm0-3.42V11.5h4.46V8.5H9.63v3h4.43v2.13c-3.93.18-6.88 1.02-6.88 2.02s2.95 1.84 6.88 2.02v7.23h3.84v-7.23c3.91-.18 6.85-1.02 6.85-2.02s-2.94-1.84-6.85-2.02z" fill="#fff" />
  </svg>
);

export default function AdminWeb3Payments() {
  usePageTitle('Admin - Web3 USDT Payment');
  const toast = useToast();

  const [status, setStatus] = useState(null);
  const [payments, setPayments] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [batchPaying, setBatchPaying] = useState(false);
  const [tab, setTab] = useState('pending');

  // Config form
  const [configForm, setConfigForm] = useState({
    web3_enabled: 'false',
    web3_network: 'mainnet',
    web3_private_key: '',
    web3_vnd_rate: '',
    web3_auto_approve: 'false',
    web3_gas_limit: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const d = await api.get('/admin/web3/status');
      setStatus(d);
    } catch { setStatus({ enabled: false }); }
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const d = await api.get('/admin/worker-withdrawals?status=pending');
      const crypto = (d.withdrawals || []).filter(w => (w.note || '').includes('[Crypto]'));
      setWithdrawals(crypto);
    } catch { }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const d = await api.get('/admin/web3/payments');
      setPayments(d.payments || []);
    } catch { }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const d = await api.get('/admin/settings/site');
      const c = d.config || {};
      setConfigForm({
        web3_enabled: c.web3_enabled || 'false',
        web3_network: c.web3_network || 'mainnet',
        web3_private_key: c.web3_private_key || '',
        web3_vnd_rate: c.web3_vnd_rate || '',
        web3_auto_approve: c.web3_auto_approve || 'false',
        web3_gas_limit: c.web3_gas_limit || '',
      });
    } catch { }
  }, []);

  useEffect(() => {
    Promise.all([fetchStatus(), fetchWithdrawals(), fetchPayments(), fetchConfig()])
      .finally(() => setLoading(false));
  }, []);

  const handlePay = async (id) => {
    if (!await toast.confirm('Xác nhận gửi USDT (BEP20) cho yêu cầu này?')) return;
    setPayingId(id);
    try {
      const d = await api.post(`/admin/web3/pay/${id}`);
      toast.success(d.message || 'Thanh toán thành công');
      fetchStatus(); fetchWithdrawals(); fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
    setPayingId(null);
  };

  const handleBatchPay = async () => {
    if (!await toast.confirm(`Gửi USDT tự động cho ${withdrawals.length} yêu cầu đang chờ?`)) return;
    setBatchPaying(true);
    try {
      const d = await api.post('/admin/web3/batch-pay');
      toast.success(`${d.success}/${d.total} giao dịch thành công`);
      fetchStatus(); fetchWithdrawals(); fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
    setBatchPaying(false);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.put('/admin/settings/site', { settings: configForm });
      toast.success('Đã lưu cấu hình Web3');
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
    setSavingConfig(false);
  };

  const parseNote = (note) => {
    const parts = (note || '').split(' | Nguồn: ');
    const info = parts[0]?.replace('[Crypto] ', '') || '';
    const source = parts[1] || '';
    return { info, source };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <UsdtIcon size={28} /> Web3 Auto Payment
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Thanh toán tự động USDT (BEP20) trên BSC cho worker</p>
        </div>
        <button onClick={() => { setLoading(true); Promise.all([fetchStatus(), fetchWithdrawals(), fetchPayments()]).finally(() => setLoading(false)); }}
          className="p-2 hover:bg-slate-100 rounded-lg transition">
          <RefreshCw size={18} className="text-slate-500" />
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hot Wallet USDT */}
        <div className={`rounded-xl p-4 border ${status?.enabled ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className={status?.enabled ? 'text-emerald-600' : 'text-slate-400'} />
            <span className="text-xs font-semibold text-slate-500">Hot Wallet</span>
            <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold ${status?.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {status?.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          {status?.enabled ? (
            <>
              <p className="text-lg font-black text-slate-800">{Number(status.hotWallet?.usdtBalance || 0).toFixed(2)} USDT</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{Number(status.hotWallet?.bnbBalance || 0).toFixed(4)} BNB (gas)</p>
              <p className="text-[10px] text-slate-400 font-mono truncate mt-1">{status.hotWallet?.address}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-1">Chưa cấu hình</p>
          )}
        </div>

        {/* Pending */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-blue-500" />
            <span className="text-xs font-semibold text-slate-500">Chờ thanh toán</span>
          </div>
          <p className="text-lg font-black text-slate-800">{status?.pendingWithdrawals?.count || 0}</p>
          <p className="text-xs text-slate-400">{fmt(status?.pendingWithdrawals?.totalVND || 0)} VNĐ</p>
        </div>

        {/* 24h */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-green-500" />
            <span className="text-xs font-semibold text-slate-500">24h qua</span>
          </div>
          <p className="text-lg font-black text-slate-800">{status?.last24h?.count || 0} tx</p>
          <p className="text-xs text-slate-400">{Number(status?.last24h?.totalCrypto || 0).toFixed(2)} USDT</p>
        </div>

        {/* Network */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={16} className="text-purple-500" />
            <span className="text-xs font-semibold text-slate-500">Network</span>
          </div>
          <p className="text-lg font-black text-slate-800">BSC {(status?.network || 'mainnet') === 'mainnet' ? 'Mainnet' : 'Testnet'}</p>
          <p className="text-xs text-slate-400">Token: USDT (BEP20)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[
          ['pending', `Chờ thanh toán (${withdrawals.length})`, Clock],
          ['history', 'Lịch sử', CheckCircle2],
          ['config', 'Cấu hình', Settings],
        ].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition -mb-px
              ${tab === key ? 'bg-white border border-b-white border-slate-200 text-emerald-600' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab: Pending */}
      {tab === 'pending' && (
        <div className="space-y-4">
          {withdrawals.length > 0 && status?.enabled && (
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Zap size={20} className="text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Thanh toán hàng loạt</p>
                  <p className="text-xs text-slate-500">{withdrawals.length} yêu cầu — {fmt(withdrawals.reduce((s, w) => s + Number(w.amount), 0))} VNĐ</p>
                </div>
              </div>
              <button onClick={handleBatchPay} disabled={batchPaying}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5">
                {batchPaying ? <><RefreshCw size={13} className="animate-spin" /> Đang xử lý...</> : <><Send size={13} /> Pay All USDT</>}
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            {withdrawals.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">Không có yêu cầu crypto nào đang chờ</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500">Mã</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500">Worker</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">Số tiền</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500">Ví nhận</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">Ngày</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-500">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {withdrawals.map(w => {
                    const { info } = parseNote(w.note);
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{w.ref_code}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 text-xs">{w.user_name || '—'}</p>
                          <p className="text-[10px] text-slate-400">{w.user_email || ''}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800 text-xs">{fmt(w.amount)} đ</td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-slate-600">{info}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 text-xs">
                          {new Date(w.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handlePay(w.id)} disabled={payingId === w.id || !status?.enabled}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-[10px] font-bold rounded-lg transition disabled:opacity-50">
                            {payingId === w.id ? <><RefreshCw size={11} className="animate-spin" /> Đang gửi...</> : <><UsdtIcon size={12} /> Pay USDT</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          {payments.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Chưa có giao dịch Web3</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500">TxHash</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500">Worker</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">VNĐ</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">USDT</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500">Đến</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <a href={p.explorer_url} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-600 hover:underline flex items-center gap-1">
                        {p.tx_hash?.slice(0, 10)}...{p.tx_hash?.slice(-6)}
                        <ExternalLink size={10} />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 text-xs">{p.user_name || '—'}</p>
                      <p className="text-[10px] text-slate-400">{p.user_email}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">{fmt(p.amount_vnd)} đ</td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-emerald-600">
                      {Number(p.amount_crypto).toFixed(2)} USDT
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                      {p.to_address?.slice(0, 8)}...{p.to_address?.slice(-4)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                        ${p.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {p.status === 'success' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {p.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 text-xs">
                      {new Date(p.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Config */}
      {tab === 'config' && (
        <form onSubmit={handleSaveConfig} className="max-w-2xl space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Settings size={18} /> Cấu hình USDT BEP20 Payment
            </h2>

            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-slate-800">Bật Web3 Auto Payment</p>
                <p className="text-xs text-slate-400">Thanh toán USDT (BEP20) trên BSC</p>
              </div>
              <button type="button"
                onClick={() => setConfigForm(f => ({ ...f, web3_enabled: f.web3_enabled === 'true' ? 'false' : 'true' }))}
                className={`w-12 h-6 rounded-full transition relative ${configForm.web3_enabled === 'true' ? 'bg-green-500' : 'bg-slate-300'}`}>
                <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${configForm.web3_enabled === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Network */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mạng BSC</label>
              <div className="grid grid-cols-2 gap-3">
                {[['mainnet', 'Mainnet (Thật)'], ['testnet', 'Testnet (Test)']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setConfigForm(f => ({ ...f, web3_network: v }))}
                    className={`p-3 rounded-lg border-2 text-sm font-semibold transition ${configForm.web3_network === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Private Key */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Private Key (Hot Wallet) *
              </label>
              <input type="password" value={configForm.web3_private_key}
                onChange={e => setConfigForm(f => ({ ...f, web3_private_key: e.target.value }))}
                placeholder="0x..."
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 font-mono" />
              <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-red-600">
                  <strong>CẢNH BÁO:</strong> Chỉ dùng hot wallet riêng biệt với số dư nhỏ. NẠP USDT (BEP20) + một ít BNB (gas fee) vào ví này.
                </p>
              </div>
            </div>

            {/* VND Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Tỷ giá VNĐ (1 USDT = ? VNĐ)
              </label>
              <input type="number" value={configForm.web3_vnd_rate}
                onChange={e => setConfigForm(f => ({ ...f, web3_vnd_rate: e.target.value }))}
                placeholder="Để trống = tự động lấy từ CoinGecko"
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
              <p className="text-[10px] text-slate-400 mt-1">Để trống sẽ tự động lấy giá realtime từ CoinGecko</p>
            </div>

            {/* Gas Limit */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gas Limit (BEP20 transfer)</label>
              <input type="number" value={configForm.web3_gas_limit}
                onChange={e => setConfigForm(f => ({ ...f, web3_gas_limit: e.target.value }))}
                placeholder="100000 (mặc định)"
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
            </div>

            {/* Auto Approve */}
            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-slate-800">Tự động gửi USDT khi duyệt</p>
                <p className="text-xs text-slate-400">Khi admin duyệt rút crypto → tự động gửi USDT (BEP20)</p>
              </div>
              <button type="button"
                onClick={() => setConfigForm(f => ({ ...f, web3_auto_approve: f.web3_auto_approve === 'true' ? 'false' : 'true' }))}
                className={`w-12 h-6 rounded-full transition relative ${configForm.web3_auto_approve === 'true' ? 'bg-green-500' : 'bg-slate-300'}`}>
                <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${configForm.web3_auto_approve === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <button type="submit" disabled={savingConfig}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-3 rounded-xl transition text-sm disabled:opacity-50">
              {savingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
