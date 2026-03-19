import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { ChevronDown, Eye, TrendingUp, Zap, Wallet } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { formatMoney as fmt } from '../lib/format';
import api from '../lib/api';

const deviceTraffic = [
  { name: 'Mobile', value: 58, color: '#3B82F6' },
  { name: 'Desktop', value: 28, color: '#F97316' },
  { name: 'Tablet', value: 14, color: '#FACC15' },
];

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const STAT_CARDS = [
  { key: 'todayViews', label: 'Lưu lượng hôm nay', suffix: ' views', Icon: Eye, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', border: 'border-blue-200' },
  { key: 'totalViews', label: 'Tổng lượt xem', suffix: ' views', Icon: TrendingUp, iconBg: 'bg-green-100', iconColor: 'text-green-600', border: 'border-green-200' },
  { key: 'runningCampaigns', label: 'Chiến dịch đang chạy', suffix: '', Icon: Zap, iconBg: 'bg-orange-100', iconColor: 'text-orange-600', border: 'border-orange-200' },
  { key: 'mainBalance', label: 'Số dư ví', suffix: ' ₫', Icon: Wallet, iconBg: 'bg-purple-100', iconColor: 'text-purple-600', border: 'border-purple-200' },
];

export default function TrafficDashboard() {
  usePageTitle('Tổng quan');
  const [overview, setOverview] = useState(null);
  const [traffic, setTraffic] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/overview'),
      api.get('/reports/traffic?period=7d'),
      api.get('/campaigns'),
    ]).then(([ov, tr, cp]) => {
      setOverview(ov.overview);
      // Map traffic data for chart
      setTraffic(
        (tr.traffic || []).map((t) => ({
          day: DAYS[new Date(t.date).getDay()],
          visitors: t.views,
          clicks: t.clicks,
        }))
      );
      setCampaigns(cp.campaigns || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const ov = overview || {};

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Tổng quan' },
      ]} />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 min-w-0">
        {STAT_CARDS.map(({ key, label, suffix, Icon, iconBg, iconColor, border }) => (
          <div key={key} className={`bg-white rounded-xl border-l-4 ${border} border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow`}>
            <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon size={22} className={iconColor} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{fmt(ov[key] || 0)}{suffix}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Lưu lượng truy cập 7 ngày qua</h2>
        </div>
        <div className="h-60 sm:h-72 w-full overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={traffic} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="blueFillMain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="orangeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 12 }} />
              <YAxis width={38} tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
              <Tooltip />
              <Area type="monotone" dataKey="visitors" name="Views" stroke="#2563EB" fill="url(#blueFillMain)" strokeWidth={2} />
              <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#F97316" fill="url(#orangeFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Báo cáo Traffic chi tiết</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Lưu lượng truy cập hàng ngày</h3>
            <div className="h-48 sm:h-52 w-full overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={traffic} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="blueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 11 }} />
                  <YAxis width={32} tick={{ fill: '#64748B', fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
                  <Tooltip />
                  <Area type="monotone" dataKey="visitors" name="Views" stroke="#3B82F6" fill="url(#blueFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Traffic theo thiết bị</h3>
            <div className="h-48 sm:h-52 flex items-center justify-center w-full overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deviceTraffic} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {deviceTraffic.map((item) => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {deviceTraffic.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </div>
                  <span className="font-medium text-slate-800">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Traffic theo nguồn</h3>
            <div className="h-48 sm:h-52 w-full overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={traffic} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 10 }} />
                  <YAxis width={28} tick={{ fill: '#64748B', fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="visitors" name="Views" radius={[8, 8, 0, 0]} fill="#2563EB" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 min-w-0">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Chiến dịch gần đây</h2>
        <div className="overflow-x-auto w-full min-w-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 font-medium">Chiến dịch</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium">Nguồn</th>
                <th className="py-3 font-medium">Views</th>
                <th className="py-3 font-medium">Ngân sách</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.slice(0, 5).map((c) => (
                <tr key={c.id} className="border-b border-slate-100 text-slate-700">
                  <td className="py-4 font-medium text-slate-900">{c.name}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      c.status === 'running' ? 'bg-green-100 text-green-600' :
                      c.status === 'paused' ? 'bg-orange-100 text-orange-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {c.status === 'running' ? 'Đang chạy' : c.status === 'paused' ? 'Tạm dừng' : 'Hoàn tất'}
                    </span>
                  </td>
                  <td className="py-4">{c.traffic_type || 'google_search'}</td>
                  <td className="py-4">{fmt(c.views_done)}/{fmt(c.total_views)}</td>
                  <td className="py-4 font-medium text-slate-900">{fmt(c.budget)} ₫</td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Chưa có chiến dịch nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
