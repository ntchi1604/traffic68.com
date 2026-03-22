import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import {
  Eye, TrendingUp, TrendingDown, Wallet, CalendarDays,
  Globe, Smartphone, RefreshCw, Zap, Clock, BarChart2, Monitor, Minus,
} from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { formatMoney as fmt, fmtDay, fmtDate } from '../../lib/format';
import api from '../../lib/api';

const SOURCE_LABELS = { google_search: 'Google Search', social: 'Social Traffic', direct: 'Direct Traffic' };
const SOURCE_COLORS = { google_search: '#3B82F6', social: '#8B5CF6', direct: '#10B981' };
const PERIODS = [
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: '90d', label: '90 ngày' },
];



const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <p style={{ fontWeight: 700, color: '#334155', marginBottom: 6, fontSize: 13 }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 2 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#64748b' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: '#1e293b' }}>{Number(p.value).toLocaleString('vi-VN')}</span>
        </div>
      ))}
    </div>
  );
};

function getTrend(data) {
  if (data.length < 4) return { dir: 'stable', pct: 0 };
  const mid = Math.floor(data.length / 2);
  const a = data.slice(0, mid).reduce((s, t) => s + Number(t.views || 0), 0);
  const b = data.slice(mid).reduce((s, t) => s + Number(t.views || 0), 0);
  if (a === 0) return { dir: 'stable', pct: 0 };
  const pct = Math.round(((b - a) / a) * 100);
  return { dir: pct > 5 ? 'up' : pct < -5 ? 'down' : 'stable', pct: Math.abs(pct) };
}

function isWithin24h(dateStr) {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

export default function TrafficTracking() {
  usePageTitle('Theo dõi lưu lượng');
  const [range, setRange] = useState('7d');
  const [traffic, setTraffic] = useState([]);
  const [bySource, setBySource] = useState([]);
  const [byDevice, setByDevice] = useState([]);
  const [overview, setOverview] = useState({});
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/reports/traffic?period=${range}`),
      api.get('/reports/overview'),
      api.get('/campaigns'),
    ]).then(([tr, ov, cp]) => {
      setTraffic(tr.traffic || []);
      setBySource(tr.bySource || []);
      setByDevice(tr.byDevice || []);
      setOverview(ov.overview || {});
      setCampaigns(cp.campaigns || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [range, refreshKey]);

  const totalViews = traffic.reduce((s, t) => s + Number(t.views || 0), 0);
  const avgPerDay  = traffic.length > 0 ? Math.round(totalViews / traffic.length) : 0;
  const peakDay    = traffic.reduce((best, t) => Number(t.views || 0) > Number(best?.views || 0) ? t : best, null);
  const trend      = getTrend(traffic);
  const deviceTotal = byDevice.reduce((s, x) => s + x.value, 0);
  const chartData  = traffic.map(t => ({ date: fmtDay(t.date), 'Lượt xem': Number(t.views || 0) }));

  // Campaigns to show in progress: exclude completed > 24h
  const visibleCampaigns = campaigns.filter(c => {
    const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
    const effStatus = (isDone || c.status === 'completed') ? 'completed' : c.status;
    if (effStatus !== 'completed') return true;
    return isWithin24h(c.updated_at);
  });

  const kpis = [
    { label: 'Tổng lượt xem', value: fmt(totalViews), sub: `trong ${range === '7d' ? '7' : range === '30d' ? '30' : '90'} ngày`, icon: Eye, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
    { label: 'Trung bình / ngày', value: fmt(avgPerDay), sub: 'views/ngày', icon: BarChart2, color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
    { label: 'Chiến dịch đang chạy', value: overview.runningCampaigns || 0, sub: `/ ${overview.totalCampaigns || 0} chiến dịch`, icon: Zap, color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
    { label: 'Số dư ví', value: `${fmt(overview.mainBalance || 0)} đ`, sub: 'khả dụng', icon: Wallet, color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/buyer/dashboard' }, { label: 'Theo dõi lưu lượng' }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Theo dõi lưu lượng</h1>
          <p className="text-sm text-slate-500 mt-0.5">Phân tích chi tiết traffic theo chiến dịch của bạn</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setRange(p.key)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${range === p.key ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => setRefreshKey(k => k + 1)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPI */}
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

      {/* Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0"><Clock size={18} className="text-amber-500" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Ngày đông nhất</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{peakDay ? fmtDate(peakDay.date) : '—'}</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">{peakDay ? `${fmt(peakDay.views)} lượt xem` : 'Chưa có dữ liệu'}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${trend.dir === 'up' ? 'bg-green-50' : trend.dir === 'down' ? 'bg-red-50' : 'bg-slate-100'}`}>
            {trend.dir === 'up' ? <TrendingUp size={18} className="text-green-500" /> : trend.dir === 'down' ? <TrendingDown size={18} className="text-red-500" /> : <Minus size={18} className="text-slate-400" />}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Xu hướng traffic</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{trend.dir === 'up' ? `+${trend.pct}%` : trend.dir === 'down' ? `-${trend.pct}%` : 'Ổn định'}</p>
            <p className={`text-xs font-medium mt-0.5 ${trend.dir === 'up' ? 'text-green-600' : trend.dir === 'down' ? 'text-red-500' : 'text-slate-400'}`}>
              {trend.dir === 'up' ? 'Đang tăng' : trend.dir === 'down' ? 'Đang giảm' : 'Không đổi'} nửa kỳ sau
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0"><CalendarDays size={18} className="text-blue-500" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Ngày có dữ liệu</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{traffic.filter(t => t.views > 0).length} ngày</p>
            <p className="text-xs text-blue-600 font-medium mt-0.5">/ {traffic.length} ngày trong kỳ</p>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Lượt xem theo ngày</h2>
            <p className="text-xs text-slate-500 mt-0.5">Biểu đồ lưu lượng truy cập link</p>
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full font-medium">Tổng {fmt(totalViews)} views</span>
        </div>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={36} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Lượt xem" stroke="#3B82F6" fill="url(#gViews)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#3B82F6' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Campaign Progress */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-slate-800">Tiến độ chiến dịch</h3>
          </div>
          <span className="text-xs text-slate-400">{visibleCampaigns.length} chiến dịch</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Chiến dịch</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tiến độ</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Views</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Ngân sách</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleCampaigns.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Chưa có chiến dịch nào</td></tr>
              ) : visibleCampaigns.map(c => {
                const done  = Number(c.views_done || 0);
                const total = Number(c.total_views || 1);
                const isCompleted = done >= total || c.status === 'completed';
                const pct = Math.min(Math.round((done / total) * 100), 100);
                const effStatus = isCompleted ? 'completed' : c.status;
                const badge = { running: { label: 'Đang chạy', cls: 'bg-green-100 text-green-700' }, paused: { label: 'Tạm dừng', cls: 'bg-amber-100 text-amber-700' }, completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' } }[effStatus] || { label: effStatus, cls: 'bg-slate-100 text-slate-600' };
                const barColor = effStatus === 'completed' ? '#10B981' : effStatus === 'running' ? '#3B82F6' : '#F59E0B';
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800 truncate max-w-[180px]">{c.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{c.url}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-6 py-4 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 flex-shrink-0">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-slate-800">{fmt(done)}</span>
                      <span className="text-slate-400 text-xs">/{fmt(total)}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-800">{fmt(c.budget)} đ</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Device + Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4"><Smartphone size={16} className="text-blue-500" /><h3 className="text-sm font-bold text-slate-800">Traffic theo thiết bị</h3></div>
          {byDevice.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center gap-2 text-center">
              <Monitor size={32} className="text-slate-200" />
              <p className="text-sm text-slate-400">Sẽ hiển thị khi có lưu lượng mới</p>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="h-40 flex-shrink-0" style={{ width: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byDevice} dataKey="value" innerRadius={44} outerRadius={66} paddingAngle={3}>
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
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} /><span className="text-slate-600 font-medium">{item.name}</span></div>
                        <span className="font-bold text-slate-800">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4"><Globe size={16} className="text-purple-500" /><h3 className="text-sm font-bold text-slate-800">Traffic theo nguồn</h3></div>
          {bySource.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center gap-2 text-center">
              <Globe size={32} className="text-slate-200" />
              <p className="text-sm text-slate-400">Chưa có dữ liệu nguồn</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySource.map(s => ({ name: SOURCE_LABELS[s.source] || s.source, views: s.views }))} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
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
              <div className="space-y-2 pt-1">
                {bySource.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: SOURCE_COLORS[s.source] || '#3B82F6' }} />
                      <span className="text-sm text-slate-700 font-medium">{SOURCE_LABELS[s.source] || s.source}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{fmt(s.views)} views</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Daily Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2"><CalendarDays size={16} className="text-slate-500" /><h3 className="text-sm font-bold text-slate-800">Chi tiết theo ngày</h3></div>
          <span className="text-xs text-slate-400">{traffic.length} ngày</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Ngày</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Lượt xem</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Mã thành công</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Tỷ lệ</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Unique IPs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {traffic.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Không có dữ liệu</td></tr>
              ) : [...traffic].reverse().map(t => {
                const rate = t.views > 0 ? Math.round((t.clicks / t.views) * 100) : 0;
                const isPeak = peakDay && t.date === peakDay.date;
                return (
                  <tr key={t.date} className={`hover:bg-slate-50 transition-colors ${isPeak ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{fmtDate(t.date)}</span>
                        {isPeak && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">PEAK</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-slate-700">{fmt(t.views)}</td>
                    <td className="px-6 py-3 text-right text-emerald-600 font-semibold">{fmt(t.clicks)}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${rate >= 80 ? 'bg-green-100 text-green-700' : rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{rate}%</span>
                    </td>
                    <td className="px-6 py-3 text-right text-slate-500">{fmt(t.unique_ips)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}