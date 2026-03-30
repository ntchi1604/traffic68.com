import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import {
  CheckCircle2, Clock, XCircle, ArrowDownLeft, ArrowUpRight,
  ChevronLeft, ChevronRight, Wallet, TrendingUp, Gift, Minus,
  ReceiptText,
} from 'lucide-react';
import api from '../../lib/api';
import { formatMoney as fmt } from '../../lib/format';

const LIMIT = 20;

const TYPE_CONFIG = {
  earning:    { label: 'Thu nhập',   bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', dot: '#10B981' },
  withdraw:   { label: 'Rút tiền',   bg: 'bg-red-50',    border: 'border-red-100',    text: 'text-red-600',    dot: '#EF4444' },
  commission: { label: 'Hoa hồng',   bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700',  dot: '#8B5CF6' },
  deposit:    { label: 'Nạp tiền',   bg: 'bg-blue-50',   border: 'border-blue-100',   text: 'text-blue-700',   dot: '#3B82F6' },
  bonus:      { label: 'Thưởng',     bg: 'bg-amber-50',  border: 'border-amber-100',  text: 'text-amber-700',  dot: '#F59E0B' },
};

const STATUS_CONFIG = {
  completed: { label: 'Hoàn thành', icon: CheckCircle2, cls: 'bg-green-50 text-green-600 ring-green-500/20' },
  pending:   { label: 'Đang xử lý', icon: Clock,        cls: 'bg-amber-50 text-amber-600 ring-amber-500/20' },
  failed:    { label: 'Thất bại',   icon: XCircle,      cls: 'bg-red-50 text-red-500 ring-red-500/20' },
  rejected:  { label: 'Từ chối',   icon: XCircle,      cls: 'bg-red-50 text-red-500 ring-red-500/20' },
};

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || { label: type, bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-600', dot: '#94A3B8' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.completed;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${cfg.cls}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

function Pagination({ page, total, limit, onPage }) {
  if (total <= limit) return null;
  const totalPages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/40">
      <p className="text-xs text-slate-400">
        Trang <span className="font-bold text-slate-600">{page}</span> / {totalPages}
        <span className="ml-1.5 text-slate-300">·</span>
        <span className="ml-1.5 text-slate-400">{total} giao dịch</span>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm">
          <ChevronLeft size={13} className="text-slate-600" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, [])
          .map((p, i) => p === '...' ? (
            <span key={`d${i}`} className="px-1 text-slate-300 text-xs">…</span>
          ) : (
            <button key={p} onClick={() => onPage(p)}
              className={`w-7 h-7 text-[11px] font-bold rounded-lg transition shadow-sm ${
                page === p
                  ? 'bg-indigo-600 text-white shadow-indigo-200'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {p}
            </button>
          ))}
        <button onClick={() => onPage(page + 1)} disabled={page >= Math.ceil(total / limit)}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm">
          <ChevronRight size={13} className="text-slate-600" />
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
  const [summary, setSummary] = useState({ earning: 0, withdraw: 0, commission: 0 });

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

  // Fetch summary (all, no limit)
  useEffect(() => {
    api.get('/finance/transactions?scope=worker&limit=1000&page=1')
      .then(d => {
        const all = d.transactions || [];
        setSummary({
          earning: all.filter(t => t.type === 'earning' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0),
          commission: all.filter(t => t.type === 'commission' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0),
          withdraw: all.filter(t => t.type === 'withdraw' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0),
        });
      }).catch(() => {});
  }, []);

  const FILTERS = [
    { val: 'all', label: 'Tất cả', icon: ReceiptText },
    { val: 'earning', label: 'Thu nhập', icon: TrendingUp },
    { val: 'withdraw', label: 'Rút tiền', icon: Minus },
    { val: 'commission', label: 'Hoa hồng', icon: Gift },
  ];

  const formatNote = (note) => {
    if (!note) return null;
    let cleaned = note.replace(/Gateway link \/v\/\w+\s*/g, '');
    cleaned = cleaned.replace(/Vượt link\s*/g, '');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1FAF8}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '');
    return cleaned.trim() || note;
  };

  return (
    <div className="space-y-5 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Lịch sử giao dịch' }]} />


      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Tổng thu nhập', value: summary.earning, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', sign: '+' },
          { label: 'Hoa hồng referal', value: summary.commission, icon: Gift, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', sign: '+' },
          { label: 'Đã rút', value: summary.withdraw, icon: Wallet, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', sign: '-' },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-xl border ${k.border} p-4 flex items-center gap-3`}>
            <div className={`w-9 h-9 ${k.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <k.icon size={16} className={k.color} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-medium truncate">{k.label}</p>
              <p className={`text-base font-black ${k.color}`}>{k.sign}{fmt(k.value)} đ</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(({ val, label, icon: Icon }) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                filter === val
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="py-3 px-5 text-left font-semibold text-[11px] uppercase tracking-wider text-slate-400">Loại</th>
                <th className="py-3 px-3 text-left font-semibold text-[11px] uppercase tracking-wider text-slate-400">Mô tả</th>
                <th className="py-3 px-3 text-right font-semibold text-[11px] uppercase tracking-wider text-slate-400">Số tiền</th>
                <th className="py-3 px-3 text-center font-semibold text-[11px] uppercase tracking-wider text-slate-400">Trạng thái</th>
                <th className="py-3 px-5 text-right font-semibold text-[11px] uppercase tracking-wider text-slate-400">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="w-7 h-7 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderWidth: 3 }} />
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <ReceiptText size={36} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm font-medium">Chưa có giao dịch nào</p>
                  </td>
                </tr>
              ) : transactions.map(t => {
                const rawDesc = t.note || (t.type === 'withdraw' ? `Rút tiền (${t.ref_code})` : t.type === 'deposit' ? `Nạp tiền (${t.ref_code})` : t.ref_code);
                const desc = t.keyword ? `${t.keyword} — ${t.campaign_name || ''}` : formatNote(rawDesc);
                const isPositive = ['deposit', 'earning', 'bonus', 'commission'].includes(t.type);
                const d = new Date(t.created_at);
                const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                return (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors group">
                    {/* Loại */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isPositive ? 'bg-emerald-50' : 'bg-red-50'}`}>
                          {isPositive
                            ? <ArrowDownLeft size={14} className="text-emerald-600" />
                            : <ArrowUpRight size={14} className="text-red-500" />}
                        </div>
                        <TypeBadge type={t.type} />
                      </div>
                    </td>

                    {/* Mô tả */}
                    <td className="py-3.5 px-3 max-w-[240px]">
                      <p className="text-xs font-semibold text-slate-700 truncate leading-relaxed">{desc}</p>
                      <p className="text-[10px] text-slate-300 font-mono mt-0.5">{t.ref_code}</p>
                    </td>

                    {/* Số tiền */}
                    <td className="py-3.5 px-3 text-right">
                      <span className={`text-sm font-black ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isPositive ? '+' : '−'}{fmt(t.amount)} đ
                      </span>
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3.5 px-3 text-center">
                      <StatusBadge status={t.status} />
                    </td>

                    {/* Thời gian */}
                    <td className="py-3.5 px-5 text-right">
                      <p className="text-[11px] font-semibold text-slate-500">{dateStr}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{timeStr}</p>
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
