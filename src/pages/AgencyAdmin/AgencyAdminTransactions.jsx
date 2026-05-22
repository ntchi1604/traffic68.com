import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { CheckCircle, XCircle, X, Calendar, Filter, Search } from 'lucide-react';
import api from '../../lib/api';
import { formatMoney as fmt, fmtDateTime } from '../../lib/format';

const TYPE_MAP = {
  deposit:    { label: 'Nạp tiền',   cls: 'bg-green-100 text-green-700' },
  withdraw:   { label: 'Rút tiền',   cls: 'bg-red-100 text-red-700' },
  campaign:   { label: 'Chiến dịch', cls: 'bg-orange-100 text-orange-700' },
  earning:    { label: 'Thu nhập',   cls: 'bg-emerald-100 text-emerald-700' },
  commission: { label: 'Hoa hồng',   cls: 'bg-blue-100 text-indigo-700' },
};

const STATUS_MAP = {
  pending:   { label: 'Chờ xử lý',   cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Thành công',  cls: 'bg-green-100 text-green-700' },
  success:   { label: 'Thành công',  cls: 'bg-green-100 text-green-700' },
  failed:    { label: 'Thất bại',    cls: 'bg-red-100 text-red-700' },
  rejected:  { label: 'Từ chối',     cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Đã hủy',      cls: 'bg-slate-100 text-slate-500' },
};

const localDate = (d = new Date()) => d.toLocaleDateString('en-CA');
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };

const PRESETS = [
  { label: 'Hôm nay', getRange: () => ({ from: localDate(), to: localDate() }) },
  { label: '7 ngày', getRange: () => ({ from: daysAgo(6), to: localDate() }) },
  { label: '30 ngày', getRange: () => ({ from: daysAgo(29), to: localDate() }) },
  { label: 'Tất cả', getRange: () => ({ from: '', to: '' }) },
];

const TYPE_FILTERS = [
  { value: '',          label: 'Tất cả' },
  { value: 'deposit',   label: 'Nạp tiền' },
  { value: 'withdraw',  label: 'Rút tiền' },
  { value: 'campaign',  label: 'Chiến dịch' },
  { value: 'commission', label: 'Hoa hồng' },
];

const STATUS_FILTERS = [
  { value: '',          label: 'Tất cả' },
  { value: 'pending',   label: 'Chờ xử lý' },
  { value: 'completed', label: 'Thành công' },
  { value: 'rejected',  label: 'Từ chối' },
  { value: 'failed',    label: 'Thất bại' },
];

/* ── Reject Modal ── */
function RejectModal({ tx, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReject = async () => {
    setLoading(true);
    try {
      await api.put(`/agency-admin/transactions/${tx.id}/reject`, { reason: reason || 'Không hợp lệ' });
      onDone();
      onClose();
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Từ chối giao dịch</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-red-50 rounded-xl text-sm">
            <p className="font-semibold text-red-700">Mã: {tx.ref_code || tx.id}</p>
            <p className="text-red-600">Số tiền: {fmt(tx.amount)} đ — {tx.user_name || 'N/A'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Lý do từ chối</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Nhập lý do..."
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent" />
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
export default function AgencyAdminTransactions() {
  usePageTitle('Đại lý - Giao dịch');
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [rejectTx, setRejectTx] = useState(null);
  const [totalDeposit, setTotalDeposit] = useState(0);
  const [totalWithdraw, setTotalWithdraw] = useState(0);
  const LIMIT = 20;

  const fetchData = (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (typeFilter) params.set('type', typeFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (searchUser) params.set('search', searchUser);
    api.get(`/agency-admin/transactions?${params}`)
      .then(data => {
        setTransactions(data.transactions || []);
        setTotal(data.total || 0);
        setTotalDeposit(data.totalDeposit || 0);
        setTotalWithdraw(data.totalWithdraw || 0);
        setPage(p);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(1); }, [typeFilter, statusFilter, fromDate, toDate, searchUser]);

  const approveTx = async (tx) => {
    if (!confirm(`Duyệt giao dịch ${fmt(tx.amount)} đ của ${tx.user_name || 'user'}?`)) return;
    try {
      await api.put(`/agency-admin/transactions/${tx.id}/approve`);
      fetchData(page);
    } catch (err) { console.error(err.message); }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const applyPreset = (p) => {
    const r = p.getRange();
    setFromDate(r.from);
    setToDate(r.to);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Tổng vào</p>
          <p className="text-xl font-black text-green-600 mt-0.5">+{fmt(totalDeposit)} đ</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Tổng ra / chi</p>
          <p className="text-xl font-black text-red-600 mt-0.5">-{fmt(totalWithdraw)} đ</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Chênh lệch</p>
          <p className="text-xl font-black text-indigo-600 mt-0.5">{fmt(totalDeposit - totalWithdraw)} đ</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Filter size={14} /> Bộ lọc
        </div>
        <form onSubmit={e => { e.preventDefault(); setSearchUser(searchInput); }} className="flex gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Tìm tên / email / mã GD..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition">Tìm</button>
          {searchUser && (
            <button type="button" onClick={() => { setSearchUser(''); setSearchInput(''); }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition">
              Xóa
            </button>
          )}
        </form>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">Từ ngày</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <span className="text-slate-300 mt-4">→</span>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">Đến ngày</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          </div>
          <div className="flex gap-1.5">
            {PRESETS.map(p => {
              const r = p.getRange();
              return (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition ${fromDate === r.from && toDate === r.to
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Loại:</span>
            {TYPE_FILTERS.map(f => (
              <button key={f.value} onClick={() => setTypeFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  typeFilter === f.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Trạng thái:</span>
            {STATUS_FILTERS.map(f => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  statusFilter === f.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Calendar size={32} className="mx-auto mb-2 opacity-50" />
            <p className="font-semibold">Không có giao dịch nào</p>
            <p className="text-xs mt-1">Thử thay đổi bộ lọc</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['ID', 'Người dùng', 'Loại', 'Phương thức', 'Số tiền', 'Trạng thái', 'Mã GD', 'Ghi chú', 'Ngày', 'Hành động'].map(h => (
                  <th key={h} className="px-5 py-3 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map(t => {
                const tp = TYPE_MAP[t.type] || { label: t.type, cls: 'bg-gray-100 text-gray-700' };
                const st = STATUS_MAP[t.status] || { label: t.status, cls: 'bg-gray-100 text-gray-600' };
                const isPending = t.status === 'pending';
                const isDeposit = t.type === 'deposit';
                const isIncome = ['deposit', 'earning', 'commission'].includes(t.type);
                return (
                  <tr key={t.id} className={`hover:bg-slate-50/70 transition-colors ${isPending ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-5 py-3 text-xs text-slate-500 font-mono">{t.id}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-700 text-xs">{t.user_name || '—'}</p>
                      <p className="text-[10px] text-slate-400">{t.user_email || t.email || ''}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${tp.cls}`}>{tp.label}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">{t.method || '—'}</td>
                    <td className={`px-4 py-3 text-xs font-bold tabular-nums whitespace-nowrap ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '-'}{fmt(t.amount)} đ
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${st.cls} ${isPending ? 'animate-pulse' : ''}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 font-mono">{t.ref_code || '—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500 max-w-[150px] truncate">{t.note || '—'}</td>
                    <td className="px-5 py-3 text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                      {fmtDateTime(t.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      {isPending && isDeposit ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => approveTx(t)} title="Duyệt"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-lg transition">
                            <CheckCircle size={13} /> Duyệt
                          </button>
                          <button onClick={() => setRejectTx(t)} title="Từ chối"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition">
                            <XCircle size={13} /> Từ chối
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 block text-center">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            Trang <span className="font-bold text-slate-700">{page}</span> / {totalPages}
            <span className="ml-2 text-slate-400">({total} giao dịch)</span>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => fetchData(page - 1)} disabled={page === 1}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              &lsaquo; Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, [])
              .map((p, i) => p === '...' ? (
                <span key={`d${i}`} className="px-1 text-slate-400 text-xs">&hellip;</span>
              ) : (
                <button key={p} onClick={() => fetchData(p)}
                  className={`w-8 h-8 text-xs font-bold rounded-lg transition ${
                    page === p ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 border border-slate-200 text-slate-600'
                  }`}>{p}</button>
              ))
            }
            <button onClick={() => fetchData(page + 1)} disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              Sau &rsaquo;
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTx && <RejectModal tx={rejectTx} onClose={() => setRejectTx(null)} onDone={() => fetchData(page)} />}
    </div>
  );
}
