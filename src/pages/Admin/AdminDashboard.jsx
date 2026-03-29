import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Users, Megaphone, TrendingUp, Wallet, LifeBuoy, UserPlus, Play, Clock, Calendar, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../lib/api';
import { formatMoney as fmt, fmtDateTime } from '../../lib/format';

const localDate = (d = new Date()) => d.toLocaleDateString('en-CA');
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };

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

export default function AdminDashboard() {
  usePageTitle('Admin - Tổng quan');
  const [data, setData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);

    Promise.all([
      api.get(`/admin/overview?${params}`),
      api.get('/admin/transactions?limit=10').catch(() => ({ transactions: [] })),
    ]).then(([ov, tx]) => {
      setData(ov);
      setTransactions(tx.transactions || []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [fromDate, toDate]);

  const applyPreset = (p) => {
    const range = p.getRange();
    setFromDate(range.from);
    setToDate(range.to);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const o = data?.overview || {};
  const chart = data?.dailyStats || [];

  const dateLabel = fromDate && toDate
    ? `${new Date(fromDate).toLocaleDateString('vi-VN')} – ${new Date(toDate).toLocaleDateString('vi-VN')}`
    : fromDate ? `Từ ${new Date(fromDate).toLocaleDateString('vi-VN')}`
      : toDate ? `Đến ${new Date(toDate).toLocaleDateString('vi-VN')}`
        : 'Toàn bộ';

  const stats = [
    { label: 'Tổng người dùng', value: fmt(o.totalUsers), color: '#6366f1', bg: '#eef2ff', border: '#e0e7ff' },
    { label: 'Mới trong tuần', value: fmt(o.newUsersWeek), color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc' },
    { label: 'Tổng chiến dịch', value: fmt(o.totalCampaigns), color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
    { label: 'Đang chạy', value: fmt(o.runningCampaigns), color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
    { label: 'Tổng nạp', value: `${fmt(o.totalDeposits)} đ`, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
    { label: 'Chờ duyệt nạp', value: fmt(o.pendingDeposits), color: '#ef4444', bg: '#fef2f2', border: '#fecaca', badge: o.pendingDeposits > 0 ? `${o.pendingDeposits}` : null },
    { label: 'Tổng rút/chi', value: `${fmt(o.totalRevenue)} đ`, color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
    { label: 'Tickets mở', value: fmt(o.pendingTickets), color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3' },
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
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  fromDate === (p.getRange().from) && toDate === (p.getRange().to)
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
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
                  {s.badge && (
                    <span className="inline-flex items-center mt-2 px-2 py-0.5 text-[9px] font-bold bg-red-100 text-red-600 rounded-full animate-pulse">{s.badge} chờ duyệt</span>
                  )}
                </div>
              );
            })}
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
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              t.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                              t.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                              'bg-red-50 text-red-600 border border-red-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                t.status === 'completed' ? 'bg-emerald-500' : t.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                              }`} />
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
    </div>
  );
}
