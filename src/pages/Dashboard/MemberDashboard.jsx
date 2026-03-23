import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Eye, TrendingUp, Zap, Wallet } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xl">
      <p className="text-sm font-bold text-slate-800">{fmt(payload[0].value)} đ</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    completed: { label: 'Hoàn thành', bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-500/20' },
    pending: { label: 'Chờ duyệt', bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-500/20' },
    failed: { label: 'Thất bại', bg: 'bg-red-50', text: 'text-red-500', ring: 'ring-red-500/20' },
    expired: { label: 'Hết hạn', bg: 'bg-slate-50', text: 'text-slate-500', ring: 'ring-slate-500/20' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text} ring-1 ${c.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'completed' ? 'bg-emerald-500' : status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
      {c.label}
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

  const chartData = (data?.chart || []).map(c => ({
    day: new Date(c.day).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    value: Number(c.earn),
  }));

  const statCards = [
    { label: 'Nhiệm vụ hoàn thành hôm nay', value: `${data?.today?.tasks || 0} views`, subtext: fmt(data?.today?.earnings || 0) + ' đ', Icon: Eye, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', accentGradient: 'from-blue-500 to-blue-600' },
    { label: 'Tổng số nhiệm vụ đã làm', value: `${data?.total?.tasks || 0} views`, subtext: fmt(data?.total?.earnings || 0) + ' đ', Icon: TrendingUp, iconBg: 'bg-green-100', iconColor: 'text-green-600', accentGradient: 'from-green-500 to-green-600' },
    { label: 'View còn lại trong ngày', value: `${fmt(data?.remainingDailyViews || 0)} views`, subtext: `${data?.pending || 0} nhiệm vụ đang xử lý`, Icon: Zap, iconBg: 'bg-orange-100', iconColor: 'text-orange-600', accentGradient: 'from-orange-400 to-orange-500' },
    { label: 'Thu nhập khả dụng', value: fmt(data?.balance || 0) + ' đ', subtext: 'Ví thu nhập', Icon: Wallet, iconBg: 'bg-purple-100', iconColor: 'text-purple-600', accentGradient: 'from-purple-500 to-purple-600' },
  ];

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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 min-w-0">
        {statCards.map(({ label, value, subtext, Icon, iconBg, iconColor, accentGradient }, i) => (
          <div key={i} className="group relative bg-white rounded-xl border border-slate-200/80 p-5 flex items-start gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon size={22} className={iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{value}</p>
              <p className="text-xs text-slate-400 mt-1">{subtext}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Earnings Chart */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-6 min-w-0">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Thu nhập 7 ngày qua</h2>
        {chartData.length > 0 ? (
          <div className="h-64 sm:h-72 w-full overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="orangeGradientFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F97316" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis width={50} tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#F97316" fill="url(#orangeGradientFill)" strokeWidth={2.5} dot={{ r: 4, fill: '#F97316', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">Chưa có dữ liệu thu nhập</div>
        )}
      </div>

      {/* Recent Tasks */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 min-w-0">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-blue-500 rounded-full" />Chi tiết nhiệm vụ gần đây
        </h3>
        <div className="overflow-x-auto w-full min-w-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-2.5 font-medium text-xs uppercase tracking-wider">Tên chiến dịch</th>
                <th className="py-2.5 font-medium text-xs uppercase tracking-wider">Trạng thái</th>
                <th className="py-2.5 font-medium text-xs uppercase tracking-wider text-right">Thu nhập</th>
                <th className="py-2.5 font-medium text-xs uppercase tracking-wider text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent || []).length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">Chưa có nhiệm vụ nào</td></tr>
              ) : data.recent.map(task => (
                <tr key={task.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-medium text-slate-700 text-xs">{task.campaign_name}</td>
                  <td className="py-3"><StatusBadge status={task.status} /></td>
                  <td className="py-3 text-right font-bold text-slate-800 text-xs">{fmt(task.earning)} đ</td>
                  <td className="py-3 text-right text-slate-400 text-xs">
                    {task.completed_at ? new Date(task.completed_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
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
