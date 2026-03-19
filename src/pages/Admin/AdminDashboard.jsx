import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Users, Megaphone, TrendingUp, Wallet, Eye, LifeBuoy, UserPlus, Play, Clock, Calendar, Filter } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../lib/api';

function StatCard({ icon: Icon, label, value, color, bg, badge }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-black text-slate-900 mt-0.5">{value}</p>
      </div>
      {badge && <span className="px-2 py-1 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full animate-pulse">{badge}</span>}
    </div>
  );
}

const fmt = (n) => (n || 0).toLocaleString('vi-VN');

/* Date helpers */
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

export default function AdminDashboard() {
  usePageTitle('Admin - Tổng quan');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);

    api.get(`/admin/overview?${params}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [fromDate, toDate]);

  const applyPreset = (p) => {
    setFromDate(p.from);
    setToDate(p.to);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
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
    { icon: Users, label: 'Tổng người dùng', value: fmt(o.totalUsers), color: 'text-blue-600', bg: 'bg-blue-50' },
    { icon: UserPlus, label: 'Mới trong tuần', value: fmt(o.newUsersWeek), color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { icon: Megaphone, label: 'Tổng chiến dịch', value: fmt(o.totalCampaigns), color: 'text-purple-600', bg: 'bg-purple-50' },
    { icon: Play, label: 'Đang chạy', value: fmt(o.runningCampaigns), color: 'text-green-600', bg: 'bg-green-50' },
    { icon: Wallet, label: 'Tổng nạp', value: `${fmt(o.totalDeposits)} đ`, color: 'text-orange-600', bg: 'bg-orange-50' },
    { icon: Clock, label: 'Chờ duyệt nạp', value: fmt(o.pendingDeposits), color: 'text-amber-600', bg: 'bg-amber-50', badge: o.pendingDeposits > 0 ? `${o.pendingDeposits}` : null },
    { icon: TrendingUp, label: 'Tổng rút/chi', value: `${fmt(o.totalRevenue)} đ`, color: 'text-red-600', bg: 'bg-red-50' },
    { icon: LifeBuoy, label: 'Tickets đang mở', value: fmt(o.pendingTickets), color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Tổng quan hệ thống</h1>
        </div>
      </div>

      {/* Date filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
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
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(s => <StatCard key={s.label} {...s} />)}
          </div>

          {/* Revenue chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">
              Biểu đồ giao dịch {fromDate || toDate ? dateLabel : '14 ngày gần nhất'}
            </h3>
            <div className="h-64">
              {chart.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <div className="text-center">
                    <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">Không có dữ liệu trong khoảng thời gian này</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="fillAdmin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v) => `${fmt(v)} đ`} />
                    <Area type="monotone" dataKey="total" name="Tổng GD" stroke="#f97316" fill="url(#fillAdmin)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
