import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Calendar, DollarSign, ArrowUpRight } from 'lucide-react';

const earningsData = [
  { date: '15/03', value: 12500 },
  { date: '16/03', value: 18200 },
  { date: '17/03', value: 22000 },
  { date: '18/03', value: 15800 },
  { date: '19/03', value: 28500 },
  { date: '20/03', value: 35000 },
  { date: '21/03', value: 19500 },
];

const dailyDetails = [
  { date: '21/03/2026', clicks: 156, earnings: 19500, tasks: 8, avg: 2438 },
  { date: '20/03/2026', clicks: 280, earnings: 35000, tasks: 15, avg: 2333 },
  { date: '19/03/2026', clicks: 228, earnings: 28500, tasks: 12, avg: 2375 },
  { date: '18/03/2026', clicks: 126, earnings: 15800, tasks: 7, avg: 2257 },
  { date: '17/03/2026', clicks: 176, earnings: 22000, tasks: 10, avg: 2200 },
  { date: '16/03/2026', clicks: 146, earnings: 18200, tasks: 8, avg: 2275 },
  { date: '15/03/2026', clicks: 100, earnings: 12500, tasks: 5, avg: 2500 },
];

const fmt = (n) => Number(n).toLocaleString('vi-VN');

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

  const totalEarnings = earningsData.reduce((s, d) => s + d.value, 0);
  const avgDaily = Math.round(totalEarnings / earningsData.length);
  const todayEarnings = earningsData[earningsData.length - 1].value;

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Thu nhập theo ngày' },
      ]} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Thu nhập theo ngày</h1>
        <p className="text-slate-500 text-sm mt-1">Thống kê chi tiết thu nhập hàng ngày</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <DollarSign size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Hôm nay</p>
            <p className="text-xl font-black text-green-600">{fmt(todayEarnings)} đ</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <TrendingUp size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Tổng 7 ngày</p>
            <p className="text-xl font-black text-slate-900">{fmt(totalEarnings)} đ</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Calendar size={20} className="text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Trung bình / ngày</p>
            <p className="text-xl font-black text-slate-900">{fmt(avgDaily)} đ</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Biểu đồ thu nhập</h2>
        <div className="h-64 sm:h-72 w-full overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={earningsData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
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
      </div>

      {/* Daily details table */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Chi tiết theo ngày</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-3 font-medium text-xs uppercase tracking-wider">Ngày</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Lượt click</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Nhiệm vụ</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">Thu nhập</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">TB/nhiệm vụ</th>
              </tr>
            </thead>
            <tbody>
              {dailyDetails.map(d => (
                <tr key={d.date} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-medium text-slate-700 text-xs">{d.date}</td>
                  <td className="py-3 text-center text-slate-600 text-xs">{fmt(d.clicks)}</td>
                  <td className="py-3 text-center text-slate-600 text-xs">{d.tasks}</td>
                  <td className="py-3 text-right font-bold text-green-600 text-xs">{fmt(d.earnings)} đ</td>
                  <td className="py-3 text-right text-slate-500 text-xs">{fmt(d.avg)} đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
