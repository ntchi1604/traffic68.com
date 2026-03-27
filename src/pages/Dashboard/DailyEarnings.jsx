import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Calendar, DollarSign, Eye, Zap } from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

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

export default function DailyEarnings() {
  usePageTitle('Thu nhập theo ngày');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    api.get(`/vuot-link/worker/earnings?days=${days}`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  // Sắp xếp tăng dần (cũ → mới) cho chart
  const chartData = (data?.daily || [])
    .slice()
    .reverse()
    .map(d => ({
      date: new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      views: Number(d.tasks || 0),
      earn: Number(d.earnings || 0),
    }));

  const totalViews = (data?.daily || []).reduce((s, d) => s + Number(d.tasks || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Thu nhập theo ngày' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Thu nhập theo ngày</h1>
          <p className="text-slate-400 text-sm mt-1">Thống kê chi tiết views & thu nhập hàng ngày</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${days === d ? 'bg-green-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {d} ngày
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
            <DollarSign size={18} className="text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-semibold uppercase">Hôm nay</p>
            <p className="text-lg font-black text-green-600 truncate">{fmt(data?.today)} đ</p>
            <p className="text-[11px] text-slate-400">{data?.todayTasks || 0} views</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-semibold uppercase">Tổng {days} ngày</p>
            <p className="text-lg font-black text-slate-900 truncate">{fmt(data?.summary?.total)} đ</p>
            <p className="text-[11px] text-slate-400">{fmt(data?.summary?.tasks)} views</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <Calendar size={18} className="text-orange-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-semibold uppercase">TB / ngày</p>
            <p className="text-lg font-black text-slate-900 truncate">{fmt(data?.summary?.avgDaily)} đ</p>
            <p className="text-[11px] text-slate-400">{(data?.daily || []).length} ngày có data</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
            <Eye size={18} className="text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-semibold uppercase">Tổng views</p>
            <p className="text-lg font-black text-slate-900 truncate">{fmt(totalViews)}</p>
            <p className="text-[11px] text-slate-400">trong {days} ngày</p>
          </div>
        </div>
      </div>

      {/* Chart views + earn */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Biểu đồ Views & Thu nhập</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400 inline-block" /> Views</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> Thu nhập</span>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: 0, right: 20, top: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="views" orientation="left"
                  tick={{ fill: '#60a5fa', fontSize: 11 }} axisLine={false} tickLine={false} width={36}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                />
                <YAxis
                  yAxisId="earn" orientation="right"
                  tick={{ fill: '#22c55e', fontSize: 11 }} axisLine={false} tickLine={false} width={50}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar yAxisId="views" dataKey="views" name="Views" fill="url(#barGradBlue)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line yAxisId="earn" type="monotone" dataKey="earn" name="Thu nhập" stroke="#22c55e" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Zap size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">Chưa có dữ liệu thu nhập</p>
          </div>
        )}
      </div>

      {/* Bảng chi tiết theo ngày */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-green-500 rounded-full" />
          Chi tiết theo ngày
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ngày</th>
                <th className="py-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Views</th>
                <th className="py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Thu nhập</th>
                <th className="py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">TB/view</th>
              </tr>
            </thead>
            <tbody>
              {(data?.daily || []).length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-slate-400 text-sm">Chưa có dữ liệu</td></tr>
              ) : data.daily.map(d => (
                <tr key={d.date} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-semibold text-slate-700 text-xs">
                    {new Date(d.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="py-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">
                      <Eye size={10} /> {d.tasks}
                    </span>
                  </td>
                  <td className="py-3 text-right font-bold text-green-600 text-xs">{fmt(d.earnings)} đ</td>
                  <td className="py-3 text-right text-slate-400 text-xs">
                    {d.tasks > 0 ? `${fmt(Math.round(Number(d.earnings) / d.tasks))} đ` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {(data?.daily || []).length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                  <td className="py-3 text-xs font-bold text-slate-600">Tổng cộng</td>
                  <td className="py-3 text-center text-xs font-bold text-blue-600">{fmt(totalViews)}</td>
                  <td className="py-3 text-right text-xs font-bold text-green-600">{fmt(data?.summary?.total)} đ</td>
                  <td className="py-3 text-right text-xs text-slate-400">
                    {totalViews > 0 ? `${fmt(Math.round(Number(data?.summary?.total) / totalViews))} đ` : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
