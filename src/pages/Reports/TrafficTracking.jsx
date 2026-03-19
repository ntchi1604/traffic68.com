import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Users, DollarSign, MousePointer } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import api from '../../lib/api';

const pieData = [
  { name: 'Google Search', value: 0, color: '#3b82f6' },
  { name: 'Direct',        value: 0, color: '#10b981' },
  { name: 'Backlink',      value: 0, color: '#f59e0b' },
];

import { formatMoney as fmt } from '../../lib/format';

export default function TrafficTracking() {
  usePageTitle('Theo dõi lưu lượng');
  const [range, setRange] = useState('7d');
  const [traffic, setTraffic] = useState([]);
  const [bySource, setBySource] = useState([]);
  const [overview, setOverview] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/reports/traffic?period=${range}`),
      api.get('/reports/overview'),
    ]).then(([tr, ov]) => {
      setTraffic(tr.traffic || []);
      setBySource(tr.bySource || []);
      setOverview(ov.overview || {});
    }).catch(console.error).finally(() => setLoading(false));
  }, [range]);

  const totalViews = traffic.reduce((s, t) => s + t.views, 0);
  const totalClicks = traffic.reduce((s, t) => s + t.clicks, 0);

  const sourcePie = bySource.map((s, i) => ({
    name: s.source === 'google_search' ? 'Google Search' : s.source === 'direct' ? 'Direct' : 'Backlink',
    value: s.views,
    color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i % 4],
  }));

  const stats = [
    { label: 'Tổng lượt xem', value: fmt(totalViews), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Tổng clicks', value: fmt(totalClicks), icon: MousePointer, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Chiến dịch', value: overview.runningCampaigns || 0, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Số dư ví', value: `${fmt(overview.mainBalance)} đ`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Báo cáo', to: '/dashboard/reports' },
        { label: 'Theo dõi lưu lượng' },
      ]} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Theo dõi lưu lượng</h1>
        <select
          value={range}
          onChange={e => setRange(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="7d">7 ngày</option>
          <option value="30d">30 ngày</option>
          <option value="90d">90 ngày</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Views & Clicks theo ngày</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={traffic}>
                <defs>
                  <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="views" name="Views" stroke="#3B82F6" fill="url(#fillViews)" strokeWidth={2} />
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#F97316" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Theo nguồn traffic</h3>
          <div className="h-52 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourcePie} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {sourcePie.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {sourcePie.map(s => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-slate-600">{s.name}</span>
                </div>
                <span className="font-medium text-slate-800">{fmt(s.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Ngày</th>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Views</th>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Clicks</th>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Unique IPs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {traffic.map(t => (
              <tr key={t.date} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-900">{t.date}</td>
                <td className="px-6 py-3 text-slate-700">{fmt(t.views)}</td>
                <td className="px-6 py-3 text-slate-700">{fmt(t.clicks)}</td>
                <td className="px-6 py-3 text-slate-700">{fmt(t.unique_ips)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}