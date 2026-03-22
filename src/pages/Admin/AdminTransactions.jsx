import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { CheckCircle, XCircle, X, Calendar, Filter } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';



const TYPE_MAP = {
  deposit: { label: 'Nạp tiền', cls: 'bg-green-100 text-green-700' },
  withdraw: { label: 'Rút/Chi', cls: 'bg-red-100 text-red-700' },
  campaign: { label: 'Mua Traffic', cls: 'bg-orange-100 text-orange-700' },
  commission: { label: 'Hoa hồng', cls: 'bg-blue-100 text-blue-700' },
  refund: { label: 'Hoàn tiền', cls: 'bg-purple-100 text-purple-700' },
};

const STATUS_MAP = {
  completed: { label: 'Đã duyệt', cls: 'bg-green-100 text-green-700' },
  pending: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700' },
  failed: { label: 'Từ chối', cls: 'bg-red-100 text-red-700' },
};

/* Date helper */
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const PRESETS = [
  { label: 'Hôm nay', from: today(), to: today() },
  { label: '7 ngày', from: daysAgo(7), to: today() },
  { label: '30 ngày', from: daysAgo(30), to: today() },
  { label: 'Tất cả', from: '', to: '' },
];

/* ── Reject Modal ── */
function RejectModal({ tx, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReject = async () => {
    setLoading(true);
    try {
      await api.put(`/admin/transactions/${tx.id}/reject`, { reason: reason || 'Không hợp lệ' });
      onDone();
      onClose();
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Từ chối đơn nạp</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 bg-red-50 rounded-xl text-sm">
            <p className="font-semibold text-red-700">Mã: {tx.ref_code}</p>
            <p className="text-red-600">Số tiền: {fmt(tx.amount)} đ — {tx.user_name}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Lý do từ chối</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Nhập lý do..."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>
          <button onClick={handleReject} disabled={loading}
            className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
            {loading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function AdminTransactions() {
  usePageTitle('Admin - Giao dịch');
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [rejectTx, setRejectTx] = useState(null);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams({ type: typeFilter, status: statusFilter, limit: '100' });
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);

    api.get(`/admin/transactions?${params}`)
      .then(data => setTransactions(data.transactions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [typeFilter, statusFilter, fromDate, toDate]);

  const approveTx = async (tx) => {
    if (!confirm(`Duyệt đơn nạp ${fmt(tx.amount)} đ của ${tx.user_name}?`)) return;
    try {
      await api.put(`/admin/transactions/${tx.id}/approve`);
      toast.success(`Đã duyệt đơn nạp ${fmt(tx.amount)} đ`);
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const applyPreset = (p) => {
    setFromDate(p.from);
    setToDate(p.to);
  };

  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const totalDeposit = transactions.filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalWithdraw = transactions.filter(t => ['withdraw', 'campaign'].includes(t.type) && t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Giao dịch hệ thống</h1>
        <p className="text-sm text-slate-500 mt-1">
          {transactions.length} giao dịch
          {pendingCount > 0 && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full animate-pulse">{pendingCount} chờ duyệt</span>}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Tổng nạp</p>
          <p className="text-xl font-black text-green-600 mt-0.5">+{fmt(totalDeposit)} đ</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Tổng rút/chi</p>
          <p className="text-xl font-black text-red-600 mt-0.5">-{fmt(totalWithdraw)} đ</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Số dư</p>
          <p className="text-xl font-black text-blue-600 mt-0.5">{fmt(totalDeposit - totalWithdraw)} đ</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Filter size={14} /> Bộ lọc
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">Từ ngày</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
            </div>
            <span className="text-slate-300 mt-4">→</span>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">Đến ngày</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
            </div>
          </div>

          {/* Presets */}
          <div className="flex gap-1.5">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition ${fromDate === p.from && toDate === p.to
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type + Status filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Loại:</span>
            {['all', 'deposit', 'withdraw', 'campaign', 'commission'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${typeFilter === t
                  ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {t === 'all' ? 'Tất cả' : TYPE_MAP[t]?.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Trạng thái:</span>
            {['all', 'pending', 'completed', 'failed'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${statusFilter === s
                  ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {s === 'all' ? 'Tất cả' : STATUS_MAP[s]?.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Calendar size={32} className="mx-auto mb-2 opacity-50" />
            <p className="font-semibold">Không có giao dịch nào</p>
            <p className="text-xs mt-1">Thử thay đổi bộ lọc ngày hoặc loại</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Mã GD</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Người dùng</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Loại</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Số tiền</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Trạng thái</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Thời gian</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-500">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map(t => {
                const tp = TYPE_MAP[t.type] || { label: t.type, cls: 'bg-gray-100 text-gray-700' };
                const st = STATUS_MAP[t.status] || STATUS_MAP.completed;
                const isPending = t.status === 'pending';
                return (
                  <tr key={t.id} className={`hover:bg-slate-50/70 ${isPending ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-5 py-3 font-mono text-sm text-slate-500">{t.ref_code}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-700">{t.user_name || '—'}</p>
                      <p className="text-xs text-slate-400">{t.user_email}</p>
                    </td>
                    <td className="px-5 py-3"><span className={`px-2 py-1 text-xs font-bold rounded-full ${tp.cls}`}>{tp.label}</span></td>
                    <td className={`px-5 py-3 font-bold ${t.type === 'deposit' || t.type === 'commission' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'deposit' || t.type === 'commission' ? '+' : '-'}{fmt(t.amount)} đ
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${st.cls} ${isPending ? 'animate-pulse' : ''}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">{new Date(t.created_at).toLocaleString('vi-VN')}</td>
                    <td className="px-5 py-3">
                      {isPending ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => approveTx(t)} title="Duyệt"
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-lg transition">
                            <CheckCircle size={13} /> Duyệt
                          </button>
                          <button onClick={() => setRejectTx(t)} title="Từ chối"
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition">
                            <XCircle size={13} /> Từ chối
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 text-center block">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject Modal */}
      {rejectTx && <RejectModal tx={rejectTx} onClose={() => setRejectTx(null)} onDone={fetchData} />}
    </div>
  );
}
