import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar, DollarSign } from 'lucide-react';
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

  const chartData = (data?.daily || []).slice().reverse().map(d => ({
    date: new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    value: Number(d.earnings),
  }));

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
          <p className="text-slate-500 text-sm mt-1">Thống kê chi tiết thu nhập hàng ngày</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${days === d ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {d} ngày
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><DollarSign size={20} className="text-green-600" /></div>
          <div><p className="text-xs text-slate-400 font-medium">Hôm nay</p><p className="text-xl font-black text-green-600">{fmt(data?.today)} đ</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><TrendingUp size={20} className="text-blue-600" /></div>
          <div><p className="text-xs text-slate-400 font-medium">Tổng {days} ngày</p><p className="text-xl font-black text-slate-900">{fmt(data?.summary?.total)} đ</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><Calendar size={20} className="text-orange-600" /></div>
          <div><p className="text-xs text-slate-400 font-medium">Trung bình / ngày</p><p className="text-xl font-black text-slate-900">{fmt(data?.summary?.avgDaily)} đ</p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Biểu đồ thu nhập</h2>
        {chartData.length > 0 ? (
          <div className="h-64 sm:h-72 w-full overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis width={50} tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#22C55E" fill="url(#greenGradient)" strokeWidth={2.5} dot={{ r: 4, fill: '#22C55E', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">Chưa có dữ liệu thu nhập</div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Chi tiết theo ngày</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-3 font-medium text-xs uppercase tracking-wider">Ngày</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Nhiệm vụ</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">Thu nhập</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">TB/nhiệm vụ</th>
              </tr>
            </thead>
            <tbody>
              {(data?.daily || []).length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">Chưa có dữ liệu</td></tr>
              ) : data.daily.map(d => (
                <tr key={d.date} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-medium text-slate-700 text-xs">{new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                  <td className="py-3 text-center text-slate-600 text-xs">{d.tasks}</td>
                  <td className="py-3 text-right font-bold text-green-600 text-xs">{fmt(d.earnings)} đ</td>
                  <td className="py-3 text-right text-slate-500 text-xs">{d.tasks > 0 ? fmt(Math.round(Number(d.earnings) / d.tasks)) : 0} đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
