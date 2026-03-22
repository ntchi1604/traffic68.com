import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import {
  Eye, MousePointer, TrendingUp, Wallet, CalendarDays,
  Globe, Monitor, Smartphone, RefreshCw,
} from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const SOURCE_LABELS = { google_search: 'Google Search', social: 'Social Traffic', direct: 'Direct Traffic' };
const SOURCE_COLORS = { google_search: '#3B82F6', social: '#8B5CF6', direct: '#10B981' };

const PERIODS = [
  { key: '7d',  label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: '90d', label: '90 ngày' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <p style={{ fontWeight: 700, color: '#334155', marginBottom: 6, fontSize: 13 }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', marginBottom: 2 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span>{p.name}:</span>
          <span style={{ fontWeight: 700, color: '#1e293b' }}>{Number(p.value).toLocaleString('vi-VN')}</span>
        </div>
      ))}
    </div>
  );
};

export default function TrafficTracking() {
  usePageTitle('Theo dõi lưu lượng');
  const [range, setRange] = useState('7d');
  const [traffic, setTraffic] = useState([]);
  const [bySource, setBySource] = useState([]);
  const [byDevice, setByDevice] = useState([]);
  const [overview, setOverview] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/reports/traffic?period=${range}`),
      api.get('/reports/overview'),
    ]).then(([tr, ov]) => {
      setTraffic(tr.traffic || []);
      setBySource(tr.bySource || []);
      setByDevice(tr.byDevice || []);
      setOverview(ov.overview || {});
    }).catch(console.error).finally(() => setLoading(false));
  }, [range, refreshKey]);

  const totalViews  = traffic.reduce((s, t) => s + Number(t.views  || 0), 0);
  const totalClicks = traffic.reduce((s, t) => s + Number(t.clicks || 0), 0);
  const totalUnique = traffic.reduce((s, t) => s + Number(t.unique_ips || 0), 0);
  const convRate    = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0.0';

  const kpis = [
    {
      label: 'Tổng lượt xem', value: fmt(totalViews), sub: 'link visits',
      icon: Eye, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE',
    },
    {
      label: 'Mã lấy thành công', value: fmt(totalClicks), sub: 'completed',
      icon: MousePointer, color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0',
    },
    {
      label: 'Tỷ lệ hoàn thành', value: `${convRate}%`, sub: 'conversion',
      icon: TrendingUp, color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE',
    },
    {
      label: 'Số dư ví', value: `${fmt(overview.mainBalance || 0)} đ`, sub: 'available',
      icon: Wallet, color: '#F97316', bg: '#FFF7ED', border: '#FED7AA',
    },
  ];

  const chartData = traffic.map(t => ({
    date: t.date?.slice(5), // MM-DD
    'Lượt xem': Number(t.views  || 0),
    'Mã thành công': Number(t.clicks || 0),
  }));

  const deviceTotal = byDevice.reduce((s, x) => s + x.value, 0);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/buyer/dashboard' },
        { label: 'Theo dõi lưu lượng' },
      ]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Theo dõi lưu lượng</h1>
          <p className="text-sm text-slate-500 mt-0.5">Thống kê chi tiết lưu lượng tất cả chiến dịch của bạn</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setRange(p.key)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  range === p.key
                    ? 'bg-white text-blue-600 shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            title="Làm mới"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-2xl border p-5 flex items-start gap-4 hover:shadow-md transition-shadow" style={{ borderColor: k.border }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: k.bg }}>
              <k.icon size={20} style={{ color: k.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 truncate">{k.label}</p>
              <p className="text-xl font-black text-slate-900 mt-0.5 leading-tight">{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Lượt xem & Mã thành công theo ngày</h2>
            <p className="text-xs text-slate-500 mt-0.5">So sánh lượt truy cập và số mã lấy thành công</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              <span className="text-slate-500">Lượt xem</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="text-slate-500">Mã thành công</span>
            </div>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={36} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Lượt xem"    stroke="#3B82F6" fill="url(#gViews)"  strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="Mã thành công" stroke="#10B981" fill="url(#gClicks)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom Row: Device + Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* By Device */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone size={16} className="text-blue-500" />
            <h3 className="text-sm font-bold text-slate-800">Traffic theo thiết bị</h3>
          </div>
          {byDevice.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-center">
              <Monitor size={36} className="text-slate-200" />
              <p className="text-sm font-medium text-slate-400">Chưa có dữ liệu thiết bị</p>
              <p className="text-xs text-slate-400">Sẽ hiển thị khi có lưu lượng mới</p>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="h-44 flex-shrink-0" style={{ width: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byDevice} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={3}>
                      {byDevice.map(item => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip formatter={v => `${v} views`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {byDevice.map(item => {
                  const pct = deviceTotal > 0 ? Math.round(item.value / deviceTotal * 100) : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                          <span className="text-slate-600 font-medium">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-800">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* By Source */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-purple-500" />
            <h3 className="text-sm font-bold text-slate-800">Traffic theo nguồn</h3>
          </div>
          {bySource.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-center">
              <Globe size={36} className="text-slate-200" />
              <p className="text-sm font-medium text-slate-400">Chưa có dữ liệu nguồn</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySource.map(s => ({ name: SOURCE_LABELS[s.source] || s.source, views: s.views, clicks: s.clicks }))} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={32} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="views" name="Lượt xem" radius={[6, 6, 0, 0]}>
                      {bySource.map((s, i) => <Cell key={i} fill={SOURCE_COLORS[s.source] || '#3B82F6'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {bySource.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: SOURCE_COLORS[s.source] || '#3B82F6' }} />
                      <span className="text-sm text-slate-700 font-medium">{SOURCE_LABELS[s.source] || s.source}</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-slate-400">{fmt(s.views)} views</span>
                      <span className="text-emerald-600 font-semibold">{fmt(s.clicks)} mã</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Chi tiết theo ngày</h3>
          </div>
          <span className="text-xs text-slate-400">{traffic.length} ngày</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide">Ngày</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide">Lượt xem</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide">Mã thành công</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide">Tỷ lệ</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide">Unique IPs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {traffic.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">Không có dữ liệu trong khoảng thời gian này</td></tr>
              ) : (
                [...traffic].reverse().map(t => {
                  const rate = t.views > 0 ? ((t.clicks / t.views) * 100).toFixed(0) : 0;
                  return (
                    <tr key={t.date} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-semibold text-slate-800">{t.date}</td>
                      <td className="px-6 py-3 text-right text-slate-700">{fmt(t.views)}</td>
                      <td className="px-6 py-3 text-right">
                        <span className="text-emerald-600 font-semibold">{fmt(t.clicks)}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${rate >= 80 ? 'bg-green-100 text-green-700' : rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                          {rate}%
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-slate-500">{fmt(t.unique_ips)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}