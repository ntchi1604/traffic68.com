import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Users, Megaphone, TrendingUp, Wallet, LifeBuoy, UserPlus, Play, Clock,
  Calendar, ArrowUpRight, ArrowDownRight, Banknote, PiggyBank, ShoppingCart,
  CreditCard, Trophy, X, ChevronRight, Medal,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../lib/api';
import { formatMoney as fmt, fmtDateTime } from '../../lib/format';
import { Sk, SkStatGrid, SkChart, SkTableRows } from '../../components/SkeletonLoader';

const localDate = (d = new Date()) => d.toLocaleDateString('en-CA');
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
const currentMonth = () => new Date().toISOString().slice(0, 7);

const PRESETS = [
  { label: 'Hôm nay',  getRange: () => ({ from: localDate(), to: localDate() }) },
  { label: '7 ngày',   getRange: () => ({ from: daysAgo(6),  to: localDate() }) },
  { label: '30 ngày',  getRange: () => ({ from: daysAgo(29), to: localDate() }) },
  { label: 'Tất cả',   getRange: () => ({ from: '', to: '' }) },
];

const TX_TYPE_LABEL = {
  deposit: 'Nạp tiền', withdraw: 'Rút tiền', campaign_charge: 'Chi phí campaign',
  commission: 'Hoa hồng', referral: 'Giới thiệu', earning: 'Thu nhập',
};

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7c3f'];
const RANK_LABELS = ['🥇', '🥈', '🥉'];

/* ── Wallet Ranking Modal ── */
function WalletRankingModal({ walletType, title, onClose }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/finance/wallet-ranking?type=${walletType}&limit=50`)
      .then(r => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [walletType]);

  const labelMap = { main: 'Ví Traffic', earning: 'Ví Thu nhập', commission: 'Ví Hoa hồng' };
  const colorMap = { main: '#0ea5e9', earning: '#10b981', commission: '#f59e0b' };
  const color = colorMap[walletType] || '#6366f1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${color}18, ${color}08)` }}>
          <div>
            <h3 className="text-base font-black text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Sắp xếp theo số dư từ cao đến thấp</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition">
            <X size={18} className="text-slate-400" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">Không có dữ liệu</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                <tr>
                  {['#', 'Người dùng', 'Số dư hiện tại', 'Tổng nạp', 'Tổng chi/rút'].map((h, i) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                      style={{ textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((u, i) => (
                  <tr key={u.id} className={`hover:bg-slate-50/60 transition-colors ${i < 3 ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-5 py-3 w-10">
                      {i < 3
                        ? <span className="text-base">{RANK_LABELS[i]}</span>
                        : <span className="text-xs font-bold text-slate-400 tabular-nums">{i + 1}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800 text-xs">{u.name}</p>
                      <p className="text-[10px] text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-black text-sm tabular-nums" style={{ color }}>{fmt(u.balance)} đ</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-xs font-semibold text-emerald-600 tabular-nums">{fmt(u.total_deposit)} đ</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-xs font-semibold text-red-400 tabular-nums">{fmt(u.total_spent)} đ</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <p className="text-[10px] text-slate-400">Hiển thị tối đa 50 người dùng có số dư &gt; 0</p>
        </div>
      </div>
    </div>
  );
}

/* ── Finance Summary ── */
function FinanceSummary({ fs, onCardClick }) {
  if (!fs) return null;
  const cards = [
    { id: 'total', label: 'Tổng số dư hệ thống', sub: 'Tất cả ví', value: fs.currentBalances?.total ?? 0, icon: PiggyBank, color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
    { id: 'main', label: 'Ví Traffic (Buyer)', sub: `${fs.breakdown?.buyer?.count ?? 0} buyer`, value: fs.currentBalances?.main ?? 0, icon: Wallet, color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd', clickable: true },
    { id: 'earning', label: 'Ví Thu nhập (Worker)', sub: `${fs.breakdown?.worker?.count ?? 0} worker`, value: fs.currentBalances?.earning ?? 0, icon: Banknote, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', clickable: true },
    { id: 'commission', label: 'Ví Hoa hồng', sub: 'Referral', value: fs.currentBalances?.commission ?? 0, icon: TrendingUp, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', clickable: true },
    { id: 'spent', label: 'Buyer đã chi campaign', sub: 'Tổng khấu trừ', value: fs.totalSpent?.campaign ?? 0, icon: ShoppingCart, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
    { id: 'withdrawn', label: 'Tổng đã rút', sub: `Worker + HH`, value: fs.totalWithdrawn?.total ?? 0, icon: ArrowDownRight, color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
    { id: 'pendingW', label: 'Chờ duyệt rút', sub: `${fs.pending?.withdrawWorker?.count ?? 0} lệnh`, value: fs.pending?.withdrawWorker?.amount ?? 0, icon: Clock, color: '#f97316', bg: '#fff7ed', border: '#fed7aa', badge: fs.pending?.withdrawWorker?.count > 0 },
    { id: 'pendingD', label: 'Chờ duyệt nạp', sub: `${fs.pending?.deposit?.count ?? 0} đơn`, value: fs.pending?.deposit?.amount ?? 0, icon: CreditCard, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', badge: fs.pending?.deposit?.count > 0 },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <PiggyBank size={14} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800">Tổng hợp tài chính hệ thống</h3>
            <p className="text-[10px] text-slate-400 font-medium">Click vào ví để xem danh sách user sắp xếp theo số dư</p>
          </div>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.id}
              onClick={c.clickable ? () => onCardClick(c.id) : undefined}
              className={`relative rounded-xl border p-3.5 transition-all duration-200 group ${c.clickable ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : 'hover:shadow-md'}`}
              style={{ borderColor: c.border, background: c.bg }}>
              <div className="flex items-start justify-between mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${c.color}18` }}>
                  <Icon size={15} style={{ color: c.color }} />
                </div>
                <div className="flex items-center gap-1">
                  {c.badge && <span className="inline-flex px-1.5 py-0.5 text-[8px] font-black bg-red-500 text-white rounded-full animate-pulse">PENDING</span>}
                  {c.clickable && <ChevronRight size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />}
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight mb-1">{c.label}</p>
              <p className="text-lg font-black tabular-nums leading-none" style={{ color: c.color }}>
                {fmt(c.value)}<span className="text-[10px] font-bold ml-0.5 opacity-60">đ</span>
              </p>
              <p className="text-[9px] text-slate-400 mt-1 truncate">{c.sub}</p>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-1">
        {[
          { label: 'Worker đã kiếm:', val: fs.totalWorkerEarned },
          { label: 'Hoa hồng đã trả:', val: fs.totalCommissionPaid },
          { label: 'Buyer đã nạp:', val: fs.totalDeposited },
        ].map(r => (
          <span key={r.label} className="text-[10px] text-slate-500">
            {r.label} <strong className="text-slate-700 tabular-nums">{fmt(r.val ?? 0)} đ</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Top 10 Table ── */
function TopTable({ title, icon: Icon, color, data, loading, columns, month, onMonthChange }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100"
        style={{ background: `linear-gradient(135deg, ${color}12, transparent)` }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
            <Icon size={14} style={{ color }} />
          </div>
          <div>
            <span className="text-sm font-black text-slate-800">{title}</span>
            <p className="text-[10px] text-slate-400">Tháng {month?.slice(5)}/{month?.slice(0,4)}</p>
          </div>
        </div>
        <input type="month" value={month} onChange={e => onMonthChange(e.target.value)}
          className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-400 focus:border-transparent transition" />
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data.length ? (
          <div className="py-10 text-center text-slate-400 text-xs">Không có dữ liệu tháng này</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50">
              <tr>
                {columns.map((c, i) => (
                  <th key={c.key} className="px-4 py-2.5 font-bold text-[10px] text-slate-400 uppercase tracking-wider"
                    style={{ textAlign: i === 0 ? 'center' : i === 1 ? 'left' : 'right', width: i === 0 ? 36 : 'auto' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((row, i) => (
                <tr key={row.id} className={`hover:bg-slate-50/60 transition-colors ${i < 3 ? 'bg-amber-50/20' : ''}`}>
                  <td className="px-4 py-2.5 text-center">
                    {i < 3
                      ? <span className="text-sm">{RANK_LABELS[i]}</span>
                      : <span className="text-[10px] font-bold text-slate-300">{i + 1}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-slate-800 leading-tight">{row.name}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{row.email}</p>
                  </td>
                  {columns.slice(2).map(c => (
                    <td key={c.key} className="px-4 py-2.5 text-right tabular-nums">
                      <span className="font-black" style={{ color: c.color || '#334155' }}>{fmt(row[c.key])}</span>
                      <span className="text-[9px] text-slate-400 ml-0.5">{c.suffix || 'đ'}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Main ── */
export default function AdminDashboard() {
  usePageTitle('Admin - Tổng quan');
  const [data, setData] = useState(null);
  const [finSummary, setFinSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Top tables
  const [buyerMonth, setBuyerMonth] = useState(currentMonth());
  const [workerMonth, setWorkerMonth] = useState(currentMonth());
  const [topBuyers, setTopBuyers] = useState([]);
  const [topWorkers, setTopWorkers] = useState([]);
  const [topBuyersLoading, setTopBuyersLoading] = useState(true);
  const [topWorkersLoading, setTopWorkersLoading] = useState(true);

  // Wallet ranking modal
  const [rankingModal, setRankingModal] = useState(null); // 'main' | 'earning' | 'commission'

  const fetchTopBuyers = useCallback((month) => {
    setTopBuyersLoading(true);
    api.get(`/admin/finance/top-buyers?month=${month}`)
      .then(r => setTopBuyers(r.data || []))
      .catch(() => setTopBuyers([]))
      .finally(() => setTopBuyersLoading(false));
  }, []);

  const fetchTopWorkers = useCallback((month) => {
    setTopWorkersLoading(true);
    api.get(`/admin/finance/top-workers?month=${month}`)
      .then(r => setTopWorkers(r.data || []))
      .catch(() => setTopWorkers([]))
      .finally(() => setTopWorkersLoading(false));
  }, []);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    Promise.all([
      api.get(`/admin/overview?${params}`),
      api.get('/admin/transactions?limit=10').catch(() => ({ transactions: [] })),
      api.get('/admin/finance/summary').catch(() => null),
    ]).then(([ov, tx, fs]) => {
      setData(ov);
      setTransactions(tx.transactions || []);
      setFinSummary(fs);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [fromDate, toDate]);
  useEffect(() => { fetchTopBuyers(buyerMonth); }, [buyerMonth, fetchTopBuyers]);
  useEffect(() => { fetchTopWorkers(workerMonth); }, [workerMonth, fetchTopWorkers]);

  const applyPreset = (p) => { const r = p.getRange(); setFromDate(r.from); setToDate(r.to); };

  // Không block — hiển thị skeleton inline

  const o = data?.overview || {};
  const chart = data?.dailyStats || [];
  const dateLabel = fromDate && toDate
    ? `${new Date(fromDate).toLocaleDateString('vi-VN')} – ${new Date(toDate).toLocaleDateString('vi-VN')}`
    : fromDate ? `Từ ${new Date(fromDate).toLocaleDateString('vi-VN')}`
      : toDate ? `Đến ${new Date(toDate).toLocaleDateString('vi-VN')}` : 'Toàn bộ';

  const stats = [
    { label: 'Tổng người dùng',  value: fmt(o.totalUsers),      color: '#6366f1', bg: '#eef2ff', border: '#e0e7ff' },
    { label: 'Mới trong tuần',   value: fmt(o.newUsersWeek),    color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc' },
    { label: 'Tổng chiến dịch',  value: fmt(o.totalCampaigns),  color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
    { label: 'Đang chạy',        value: fmt(o.runningCampaigns),color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
    { label: 'Tổng nạp',         value: `${fmt(o.totalDeposits)} đ`, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
    { label: 'Chờ duyệt nạp',   value: fmt(o.pendingDeposits), color: '#ef4444', bg: '#fef2f2', border: '#fecaca', badge: o.pendingDeposits > 0 ? `${o.pendingDeposits}` : null },
    { label: 'Tổng rút/chi',    value: `${fmt(o.totalRevenue)} đ`, color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
    { label: 'Tickets mở',       value: fmt(o.pendingTickets),  color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3' },
  ];
  const iconMap = [Users, UserPlus, Megaphone, Play, Wallet, Clock, TrendingUp, LifeBuoy];

  return (
    <div className="space-y-5">
      {/* Date filter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Từ ngày</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
            </div>
            <span className="text-slate-300 mt-5">→</span>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Đến ngày</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
            </div>
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${fromDate === p.getRange().from && toDate === p.getRange().to ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loading ? (
        <div className="space-y-5">
          <SkStatGrid count={8} cols="grid-cols-2 lg:grid-cols-4" />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({length:8}).map((_,i)=><Sk key={i} className="h-20 rounded-xl" />)}
            </div>
          </div>
          <SkChart height="h-64" />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s, i) => {
              const Icon = iconMap[i];
              return (
                <div key={s.label} className="bg-white rounded-2xl border p-4 hover:shadow-md transition-all duration-200" style={{ borderColor: s.border }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                      <Icon size={15} style={{ color: s.color }} />
                    </div>
                  </div>
                  <p className="text-xl font-black text-slate-900 tabular-nums leading-none">{s.value}</p>
                  {s.badge && <span className="inline-flex items-center mt-2 px-2 py-0.5 text-[9px] font-bold bg-red-100 text-red-600 rounded-full animate-pulse">{s.badge} chờ duyệt</span>}
                </div>
              );
            })}
          </div>


          {/* Finance Summary */}
          <FinanceSummary fs={finSummary} onCardClick={(type) => setRankingModal(type)} />

          {/* Top 10 Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <TopTable
              title="Top Buyer nạp nhiều nhất"
              icon={Trophy}
              color="#0ea5e9"
              data={topBuyers}
              loading={topBuyersLoading}
              month={buyerMonth}
              onMonthChange={setBuyerMonth}
              columns={[
                { key: 'rank', label: '#' },
                { key: 'name', label: 'Buyer' },
                { key: 'month_deposit', label: 'Nạp tháng', color: '#0ea5e9' },
                { key: 'current_balance', label: 'Số dư', color: '#10b981' },
              ]}
            />
            <TopTable
              title="Top Worker doanh thu cao nhất"
              icon={Medal}
              color="#10b981"
              data={topWorkers}
              loading={topWorkersLoading}
              month={workerMonth}
              onMonthChange={setWorkerMonth}
              columns={[
                { key: 'rank', label: '#' },
                { key: 'name', label: 'Worker' },
                { key: 'month_earning', label: 'Kiếm tháng', color: '#10b981' },
                { key: 'month_tasks', label: 'Tasks', color: '#8b5cf6', suffix: '' },
              ]}
            />
          </div>

          {/* Revenue chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">
              Biểu đồ giao dịch {fromDate || toDate ? dateLabel : '14 ngày gần nhất'}
            </h3>
            <div className="h-64">
              {chart.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <div className="text-center">
                    <Calendar size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-semibold">Không có dữ liệu trong khoảng thời gian này</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="fillAdmin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v?.slice(5)} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v) => `${fmt(v)} đ`} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Area type="monotone" dataKey="total" name="Tổng GD" stroke="#6366f1" fill="url(#fillAdmin)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <span className="text-sm font-bold text-slate-700">Giao dịch gần đây</span>
              <a href="/admin/transactions" className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                Xem tất cả <ArrowUpRight size={12} />
              </a>
            </div>
            {transactions.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400 text-sm">Chưa có giao dịch nào</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Người dùng', 'Loại', 'Số tiền', 'Trạng thái', 'Thời gian'].map((h, i) => (
                        <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                          style={{ textAlign: i === 2 || i === 4 ? 'right' : i === 3 ? 'center' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {transactions.map(t => {
                      const isIn = ['deposit', 'referral', 'commission', 'earning'].includes(t.type);
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-bold text-slate-800 text-xs">{t.user_name || '—'}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{t.user_email || ''}</p>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${isIn ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                <ArrowUpRight size={9} className={isIn ? 'text-emerald-500' : 'text-red-400'} style={{ transform: isIn ? 'rotate(180deg)' : 'none' }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-600">{TX_TYPE_LABEL[t.type] || t.type}</span>
                            </div>
                          </td>
                          <td className={`px-5 py-3 text-right font-black text-xs ${isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isIn ? '+' : '-'}{fmt(t.amount)} đ
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${t.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : t.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'completed' ? 'bg-emerald-500' : t.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
                              {t.status === 'completed' ? 'Thành công' : t.status === 'pending' ? 'Đang xử lý' : 'Từ chối'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-[10px] text-slate-400 tabular-nums">{fmtDateTime(t.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Wallet Ranking Modal */}
      {rankingModal && rankingModal !== 'total' && rankingModal !== 'spent' && rankingModal !== 'withdrawn' && rankingModal !== 'pendingW' && rankingModal !== 'pendingD' && (
        <WalletRankingModal
          walletType={rankingModal}
          title={{ main: 'Ví Traffic — Xếp hạng số dư Buyer', earning: 'Ví Thu nhập — Xếp hạng số dư Worker', commission: 'Ví Hoa hồng — Xếp hạng số dư' }[rankingModal]}
          onClose={() => setRankingModal(null)}
        />
      )}
    </div>
  );
}
