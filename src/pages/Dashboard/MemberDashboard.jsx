import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Eye, TrendingUp, Zap, Wallet, Gift, CheckCircle2, Clock, XCircle } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

/* ── Custom Tooltip cho chart ── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xl space-y-1">
      <p className="text-xs font-bold text-slate-500 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {p.name === 'Views' ? `${p.value} views` : `${fmt(p.value)} đ`}
        </p>
      ))}
    </div>
  );
}

/* ── Status badge ── */
function StatusBadge({ status }) {
  const cfg = {
    completed: { label: 'Hoàn thành', cls: 'bg-emerald-50 text-emerald-600 ring-emerald-500/20', Icon: CheckCircle2 },
    pending: { label: 'Đang xử lý', cls: 'bg-amber-50 text-amber-600 ring-amber-500/20', Icon: Clock },
    step1: { label: 'Bước 1', cls: 'bg-blue-50 text-blue-600 ring-blue-500/20', Icon: Clock },
    step2: { label: 'Bước 2', cls: 'bg-blue-50 text-blue-600 ring-blue-500/20', Icon: Clock },
    step3: { label: 'Bước 3', cls: 'bg-blue-50 text-blue-600 ring-blue-500/20', Icon: Clock },
    expired: { label: 'Hết hạn', cls: 'bg-slate-50 text-slate-500 ring-slate-500/20', Icon: XCircle },
    failed: { label: 'Thất bại', cls: 'bg-red-50 text-red-500 ring-red-500/20', Icon: XCircle },
  };
  const { label, cls, Icon } = cfg[status] || cfg.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${cls}`}>
      <Icon size={10} /> {label}
    </span>
  );
}

export default function MemberDashboard() {
  usePageTitle('Tổng quan');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/vuot-link/worker/stats')
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Chart: mỗi ngày có views + earn
  const chartData = (() => {
    if (!data?.chart?.length) return [];
    // Tạo map từ raw chart data
    const map = {};
    (data.chart || []).forEach(c => {
      const day = new Date(c.day).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      map[day] = { day, views: Number(c.tasks || 0), earn: Number(c.earn || 0) };
    });
    return Object.values(map);
  })();

  const statCards = [
    {
      label: 'Hôm nay', value: `${data?.today?.tasks || 0} views`,
      subtext: `Thu nhập: ${fmt(data?.today?.earnings || 0)} đ`,
      Icon: Eye, bg: 'bg-blue-50', iconColor: 'text-blue-600', border: 'border-blue-100',
      accent: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Tổng đã hoàn thành', value: `${fmt(data?.total?.tasks || 0)} views`,
      subtext: `Tổng thu nhập: ${fmt(data?.total?.earnings || 0)} đ`,
      Icon: TrendingUp, bg: 'bg-green-50', iconColor: 'text-green-600', border: 'border-green-100',
      accent: 'from-green-500 to-green-600',
    },
    {
      label: 'View khả dụng / đang xử lý', value: `${fmt(data?.remainingDailyViews || 0)} views`,
      subtext: `${data?.pending || 0} nhiệm vụ đang xử lý`,
      Icon: Zap, bg: 'bg-orange-50', iconColor: 'text-orange-600', border: 'border-orange-100',
      accent: 'from-orange-400 to-orange-500',
    },
    {
      label: 'Ví thu nhập', value: `${fmt(data?.balance || 0)} đ`,
      subtext: data?.commissionBalance != null ? `Hoa hồng: ${fmt(data.commissionBalance)} đ` : 'Số dư khả dụng',
      Icon: Wallet, bg: 'bg-purple-50', iconColor: 'text-purple-600', border: 'border-purple-100',
      accent: 'from-purple-500 to-purple-600',
    },
  ];

  if (data?.commissionBalance > 0) {
    statCards.push({
      label: 'Hoa hồng referral', value: `${fmt(data.commissionBalance)} đ`,
      subtext: 'Từ F1 vượt link',
      Icon: Gift, bg: 'bg-pink-50', iconColor: 'text-pink-600', border: 'border-pink-100',
      accent: 'from-pink-500 to-pink-600',
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Tổng quan' }]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tổng quan</h1>
        <p className="text-sm text-slate-400 mt-1">Thống kê hoạt động của bạn</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-w-0">
        {statCards.map(({ label, value, subtext, Icon, bg, iconColor, border, accent }, i) => (
          <div key={i} className={`group relative bg-white rounded-xl border ${border} p-5 flex items-start gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon size={20} className={iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
              <p className="text-xl font-black text-slate-900 mt-0.5 truncate">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{subtext}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart views + thu nhập */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-6 min-w-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Views & Thu nhập 7 ngày qua</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400 inline-block" /> Views</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block" /> Thu nhập</span>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: 0, right: 20, top: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                {/* Trục trái: views */}
                <YAxis
                  yAxisId="views"
                  orientation="left"
                  tick={{ fill: '#60a5fa', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  width={36}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                />
                {/* Trục phải: earn */}
                <YAxis
                  yAxisId="earn"
                  orientation="right"
                  tick={{ fill: '#f97316', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  width={50}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar yAxisId="views" dataKey="views" name="Views" fill="url(#barGrad)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line yAxisId="earn" type="monotone" dataKey="earn" name="Thu nhập" stroke="#f97316" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Eye size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">Chưa có dữ liệu 7 ngày qua</p>
          </div>
        )}
      </div>

      {/* Recent Tasks */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 min-w-0">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-orange-500 rounded-full" />
          Nhiệm vụ gần đây
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Chiến dịch</th>
                <th className="py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Trạng thái</th>
                <th className="py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Thu nhập</th>
                <th className="py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent || []).length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-slate-400 text-sm">Chưa có nhiệm vụ nào</td></tr>
              ) : data.recent.map(task => (
                <tr key={task.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-medium text-slate-700 text-xs max-w-[160px] truncate">{task.campaign_name}</td>
                  <td className="py-3"><StatusBadge status={task.status} /></td>
                  <td className="py-3 text-right font-bold text-slate-800 text-xs">
                    {task.earning > 0 ? `${fmt(task.earning)} đ` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-3 text-right text-slate-400 text-xs whitespace-nowrap">
                    {(task.completed_at || task.created_at)
                      ? new Date(task.completed_at || task.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
