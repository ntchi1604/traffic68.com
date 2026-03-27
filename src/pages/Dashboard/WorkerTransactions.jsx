import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { CheckCircle2, Clock, XCircle, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const LIMIT = 20;

function StatusBadge({ status }) {
  const config = {
    completed: { label: 'Hoàn thành', icon: CheckCircle2, cls: 'bg-green-50 text-green-600' },
    pending:   { label: 'Đang xử lý', icon: Clock,        cls: 'bg-amber-50 text-amber-600' },
    failed:    { label: 'Thất bại',   icon: XCircle,      cls: 'bg-red-50 text-red-500' },
    rejected:  { label: 'Từ chối',   icon: XCircle,      cls: 'bg-red-50 text-red-500' },
  };
  const c = config[status] || config.completed;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.cls}`}>
      <Icon size={10} /> {c.label}
    </span>
  );
}

function Pagination({ page, total, limit, onPage }) {
  if (total <= limit) return null;
  const totalPages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
      <p className="text-xs text-slate-500">
        Trang <span className="font-bold text-slate-700">{page}</span> / {totalPages}
        <span className="ml-2 text-slate-400">({total} giao dịch)</span>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition">
          <ChevronLeft size={14} className="text-slate-600" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, [])
          .map((p, i) => p === '...' ? (
            <span key={`d${i}`} className="px-1 text-slate-400 text-xs">…</span>
          ) : (
            <button key={p} onClick={() => onPage(p)}
              className={`w-7 h-7 text-xs font-bold rounded-lg transition ${page === p ? 'bg-blue-600 text-white' : 'hover:bg-white border border-slate-200 text-slate-600'}`}>
              {p}
            </button>
          ))}
        <button onClick={() => onPage(page + 1)} disabled={page === Math.ceil(total / limit)}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition">
          <ChevronRight size={14} className="text-slate-600" />
        </button>
      </div>
    </div>
  );
}

export default function WorkerTransactions() {
  usePageTitle('Lịch sử giao dịch');
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope: 'worker', page: p, limit: LIMIT });
      if (filter !== 'all') params.set('type', filter);
      const d = await api.get(`/finance/transactions?${params}`);
      setTransactions(d.transactions || []);
      setTotal(d.total || 0);
      setPage(p);
    } catch { }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleFilter = (val) => { setFilter(val); };
  // fetchData runs via useEffect when filter changes

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Lịch sử giao dịch' }]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Lịch sử giao dịch</h1>
        <p className="text-slate-500 text-sm mt-1">Tất cả giao dịch thu nhập và rút tiền</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="flex gap-2 p-4 border-b border-slate-100">
          {[['all', 'Tất cả'], ['earning', 'Thu nhập'], ['withdraw', 'Rút tiền'], ['commission', 'Hoa hồng']].map(([val, label]) => (
            <button key={val} onClick={() => handleFilter(val)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filter === val ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100 bg-slate-50/50">
                <th className="py-3 px-5 font-semibold text-[11px] uppercase tracking-wider">Loại</th>
                <th className="py-3 px-3 font-semibold text-[11px] uppercase tracking-wider">Mô tả</th>
                <th className="py-3 px-3 font-semibold text-[11px] uppercase tracking-wider text-right">Số tiền</th>
                <th className="py-3 px-3 font-semibold text-[11px] uppercase tracking-wider text-center">TT</th>
                <th className="py-3 px-5 font-semibold text-[11px] uppercase tracking-wider text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Đang tải...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Chưa có giao dịch nào</td></tr>
              ) : transactions.map(t => {
                const formatNote = (note) => {
                  if (!note) return null;
                  let cleaned = note.replace(/Gateway link \/v\/\w+\s*/g, '');
                  cleaned = cleaned.replace(/Vượt link\s*/g, '');
                  cleaned = cleaned.replace(/[\u{1F300}-\u{1FAF8}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '');
                  return cleaned.trim() || note;
                };
                const rawDesc = t.note || (t.type === 'withdraw' ? `Rút tiền (${t.ref_code})` : t.type === 'deposit' ? `Nạp tiền (${t.ref_code})` : t.ref_code);
                const desc = t.keyword ? `${t.keyword} - ${t.campaign_name || ''}` : formatNote(rawDesc);
                const isPositive = ['deposit', 'earning', 'bonus', 'commission'].includes(t.type);
                return (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
                        {isPositive ? <ArrowDownLeft size={14} className="text-green-600" /> : <ArrowUpRight size={14} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs font-medium text-slate-700 max-w-[240px]">
                      <p className="truncate">{desc}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{t.ref_code}</p>
                    </td>
                    <td className={`py-3 px-3 text-right text-xs font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                      {isPositive ? '+' : '-'}{fmt(t.amount)} đ
                    </td>
                    <td className="py-3 px-3 text-center"><StatusBadge status={t.status} /></td>
                    <td className="py-3 px-5 text-right text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={total} limit={LIMIT} onPage={fetchData} />
      </div>
    </div>
  );
}
