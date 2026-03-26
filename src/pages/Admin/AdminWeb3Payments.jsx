import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useToast } from '../../components/Toast';
import {
  Wallet, Send, RefreshCw, ExternalLink, CheckCircle2, XCircle,
  Clock, Zap, Settings, TrendingUp, AlertTriangle, Coins, CreditCard
} from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

// BNB icon SVG
const BnbIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
    <path d="M16 6l3.09 3.09L13.18 15l-3.09-3.09L16 6zm5.91 5.91L25 15l-3.09 3.09-5.91-5.91 3.09-3.09zM7 15l3.09-3.09 5.91 5.91L12.91 21 7 15zm8.91 8.91L19 21l5.91 5.91L22 30l-6.09-6.09z" fill="#fff" />
  </svg>
);

export default function AdminWeb3Payments() {
  usePageTitle('Admin - Web3 Thanh toán');
  const toast = useToast();

  const [status, setStatus] = useState(null);
  const [payments, setPayments] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [batchPaying, setBatchPaying] = useState(false);
  const [tab, setTab] = useState('pending'); // 'pending' | 'history' | 'config'

  // Config form
  const [configForm, setConfigForm] = useState({
    web3_enabled: 'false',
    web3_network: 'mainnet',
    web3_private_key: '',
    web3_pay_token: 'BNB',
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
      // Filter only crypto withdrawals
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
        web3_pay_token: c.web3_pay_token || 'BNB',
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
    if (!await toast.confirm('Xác nhận thanh toán Web3 cho yêu cầu này?')) return;
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
    if (!await toast.confirm(`Thanh toán tự động ${withdrawals.length} yêu cầu crypto đang chờ?`)) return;
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
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <BnbIcon size={28} /> Web3 Auto Payment
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Thanh toán tự động cho worker qua BSC (BNB/BEP20)</p>
        </div>
        <button onClick={() => { setLoading(true); Promise.all([fetchStatus(), fetchWithdrawals(), fetchPayments()]).finally(() => setLoading(false)); }}
          className="p-2 hover:bg-slate-100 rounded-lg transition">
          <RefreshCw size={18} className="text-slate-500" />
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hot Wallet */}
        <div className={`rounded-xl p-4 border ${status?.enabled ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className={status?.enabled ? 'text-amber-600' : 'text-slate-400'} />
            <span className="text-xs font-semibold text-slate-500">Hot Wallet</span>
            <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold ${status?.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {status?.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          {status?.enabled ? (
            <>
              <p className="text-lg font-black text-slate-800">{Number(status.hotWallet?.balanceBNB || 0).toFixed(4)} BNB</p>
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
          <p className="text-xs text-slate-400">{Number(status?.last24h?.totalCrypto || 0).toFixed(4)} {status?.payToken || 'BNB'}</p>
        </div>

        {/* Network */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={16} className="text-purple-500" />
            <span className="text-xs font-semibold text-slate-500">Network</span>
          </div>
          <p className="text-lg font-black text-slate-800">{(status?.network || 'mainnet').toUpperCase()}</p>
          <p className="text-xs text-slate-400">Token: {status?.payToken || 'BNB'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[
          ['pending', `Chờ thanh toán (${withdrawals.length})`, Clock],
          ['history', 'Lịch sử Web3', CheckCircle2],
          ['config', 'Cấu hình', Settings],
        ].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition -mb-px
              ${tab === key ? 'bg-white border border-b-white border-slate-200 text-blue-600' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'pending' && (
        <div className="space-y-4">
          {/* Batch pay button */}
          {withdrawals.length > 0 && status?.enabled && (
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Zap size={20} className="text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Thanh toán hàng loạt</p>
                  <p className="text-xs text-slate-500">{withdrawals.length} yêu cầu crypto đang chờ — {fmt(withdrawals.reduce((s, w) => s + Number(w.amount), 0))} VNĐ</p>
                </div>
              </div>
              <button onClick={handleBatchPay} disabled={batchPaying}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5">
                {batchPaying ? <><RefreshCw size={13} className="animate-spin" /> Đang xử lý...</> : <><Send size={13} /> Pay All</>}
              </button>
            </div>
          )}

          {/* Pending list */}
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] font-bold rounded-lg transition disabled:opacity-50">
                            {payingId === w.id ? <><RefreshCw size={11} className="animate-spin" /> Đang gửi...</> : <><BnbIcon size={12} /> Pay BNB</>}
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
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Crypto</th>
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
                    <td className="px-4 py-3 text-right font-bold text-xs text-amber-600">
                      {Number(p.amount_crypto).toFixed(p.token === 'BNB' ? 6 : 2)} {p.token}
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

      {tab === 'config' && (
        <form onSubmit={handleSaveConfig} className="max-w-2xl space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Settings size={18} /> Cấu hình Web3 Payment
            </h2>

            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-slate-800">Bật Web3 Auto Payment</p>
                <p className="text-xs text-slate-400">Cho phép thanh toán tự động qua BSC</p>
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
                    className={`p-3 rounded-lg border-2 text-sm font-semibold transition ${configForm.web3_network === v ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
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
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 font-mono" />
              <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-red-600">
                  <strong>CẢNH BÁO:</strong> Private key sẽ được lưu trong database. Chỉ sử dụng hot wallet riêng biệt với số dư nhỏ. KHÔNG BAO GIỜ sử dụng ví chính.
                </p>
              </div>
            </div>

            {/* Pay Token */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Token thanh toán</label>
              <div className="grid grid-cols-3 gap-3">
                {['BNB', 'USDT', 'BUSD'].map(t => (
                  <button key={t} type="button" onClick={() => setConfigForm(f => ({ ...f, web3_pay_token: t }))}
                    className={`p-3 rounded-lg border-2 text-sm font-bold transition ${configForm.web3_pay_token === t ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* VND Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Tỷ giá VNĐ (1 {configForm.web3_pay_token} = ? VNĐ)
              </label>
              <input type="number" value={configForm.web3_vnd_rate}
                onChange={e => setConfigForm(f => ({ ...f, web3_vnd_rate: e.target.value }))}
                placeholder="Để trống = tự động lấy từ CoinGecko"
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
              <p className="text-[10px] text-slate-400 mt-1">Để trống sẽ tự động lấy giá realtime từ CoinGecko</p>
            </div>

            {/* Gas Limit */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gas Limit</label>
              <input type="number" value={configForm.web3_gas_limit}
                onChange={e => setConfigForm(f => ({ ...f, web3_gas_limit: e.target.value }))}
                placeholder={configForm.web3_pay_token === 'BNB' ? '21000 (mặc định)' : '100000 (mặc định)'}
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
            </div>

            {/* Auto Approve */}
            <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-slate-800">Tự động thanh toán khi duyệt</p>
                <p className="text-xs text-slate-400">Khi admin duyệt rút crypto → tự động gửi BNB</p>
              </div>
              <button type="button"
                onClick={() => setConfigForm(f => ({ ...f, web3_auto_approve: f.web3_auto_approve === 'true' ? 'false' : 'true' }))}
                className={`w-12 h-6 rounded-full transition relative ${configForm.web3_auto_approve === 'true' ? 'bg-green-500' : 'bg-slate-300'}`}>
                <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${configForm.web3_auto_approve === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <button type="submit" disabled={savingConfig}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 rounded-xl transition text-sm disabled:opacity-50">
              {savingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
