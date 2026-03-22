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

const SOURCE_LABEL_MAP = { google_search: 'Google Search', social: 'Social', direct: 'Direct' };

function CampaignDetailModal({ campaign: c, detail, onClose }) {
  if (!c) return null;
  const done  = Number(c.views_done || 0);
  const total = Number(c.total_views || 1);
  const pct   = Math.min(Math.round((done / total) * 100), 100);
  const spent = done * Number(c.cpc || 0);
  const eff   = detail?.totalViews > 0 ? Math.round((detail.totalClicks / detail.totalViews) * 100) : 0;

  const deviceData = [
    { name: 'Desktop', value: detail?.desktop || 0, color: '#3B82F6' },
    { name: 'Mobile',  value: detail?.mobile  || 0, color: '#8B5CF6' },
    { name: 'Tablet',  value: detail?.tablet  || 0, color: '#F59E0B' },
  ].filter(d => d.value > 0);

  const dailyData = (detail?.rows || []).map(r => ({
    date: fmtDay(r.date),
    'Hoàn thành': Number(r.clicks || 0),
    'Nhận task':  Number(r.views  || 0),
  }));

  const kpis = [
    { label: 'Hoàn thành',  value: fmt(detail?.totalClicks || 0), sub: `/ ${fmt(detail?.totalViews || 0)} nhận task`, color: '#10B981', bg: '#ECFDF5' },
    { label: 'Chi phí',     value: `${fmt(spent)} đ`,             sub: `CPC: ${fmt(c.cpc)} đ`,                       color: '#F97316', bg: '#FFF7ED' },
    { label: 'Hiệu suất',   value: `${eff}%`,                     sub: 'hoàn thành / nhận task',                    color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Unique IPs',  value: fmt(detail?.uniqueIps || 0),   sub: 'IP khác nhau',                              color: '#8B5CF6', bg: '#F5F3FF' },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 860, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Chi tiết chiến dịch</p>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0 }}>{c.name}</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{c.url}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f1f5f9', cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Progress bar */}
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: '#64748b' }}>Tiến độ</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{fmt(done)} / {fmt(total)} views ({pct}%)</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99 }}>
              <div style={{ height: 8, borderRadius: 99, background: pct >= 100 ? '#10b981' : '#3b82f6', width: `${pct}%`, transition: 'width 0.5s ease' }} />
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {!detail ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>Đang tải dữ liệu...</div>
            ) : kpis.map(k => (
              <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: k.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0 }}>{k.value}</p>
                <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{k.sub}</p>
              </div>
            ))}
          </div>

          {detail && <>
            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: dailyData.length > 0 ? '1.6fr 1fr' : '1fr', gap: 16 }}>
              {dailyData.length > 0 && (
                <div style={{ background: '#f8fafc', borderRadius: 14, padding: '16px 16px 8px' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 12 }}>Hoàn thành theo ngày</p>
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gDet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#10B981" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={28} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="Hoàn thành" stroke="#10B981" fill="url(#gDet)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#10B981' }} />
                        <Area type="monotone" dataKey="Nhận task"  stroke="#3B82F6" fill="none" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {deviceData.length > 0 && (
                <div style={{ background: '#f8fafc', borderRadius: 14, padding: '16px 16px 8px' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Thiết bị</p>
                  <div style={{ height: 140 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={deviceData} cx="50%" cy="50%" innerRadius={40} outerRadius={62} dataKey="value" paddingAngle={3}>
                          {deviceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={v => [v.toLocaleString('vi-VN'), '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingBottom: 8 }}>
                    {deviceData.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#475569' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                        {d.name}: {d.value.toLocaleString('vi-VN')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { label: 'Nguồn traffic',   value: SOURCE_LABEL_MAP[c.traffic_type] || c.traffic_type || '—' },
                { label: 'Từ khóa',         value: c.keyword || '—' },
                { label: 'Thời gian xem',   value: c.time_on_site ? `${c.time_on_site}s` : '—' },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{item.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>{item.value}</p>
                </div>
              ))}
            </div>
          </>}
        </div>
      </div>
    </div>
  );
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
  const [expandedId, setExpandedId] = useState(null);   // campId of open modal
  const [campDetails, setCampDetails] = useState({});    // { [campId]: detail }
  const [modalCamp, setModalCamp] = useState(null);      // full campaign object for open modal

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

  const openDetail = async (camp) => {
    setModalCamp(camp);
    setExpandedId(camp.id);
    if (campDetails[camp.id]) return;
    try {
      const data = await api.get(`/reports/traffic?campaignId=${camp.id}&period=${range}`);
      const rows = data.traffic || [];
      const bd   = data.byDevice || [];
      const totalClicks = rows.reduce((s, t) => s + Number(t.clicks || 0), 0);
      const totalViews  = rows.reduce((s, t) => s + Number(t.views  || 0), 0);
      const uniqueIps   = rows.reduce((s, t) => s + Number(t.unique_ips || 0), 0);
      const mobile  = bd.find(x => x.name === 'Mobile')?.value  || 0;
      const desktop = bd.find(x => x.name === 'Desktop')?.value || 0;
      const tablet  = bd.find(x => x.name === 'Tablet')?.value  || 0;
      setCampDetails(prev => ({ ...prev, [camp.id]: { totalClicks, totalViews, uniqueIps, mobile, desktop, tablet, rows } }));
    } catch { }
  };

  const closeDetail = () => { setExpandedId(null); setModalCamp(null); };

  // "View" = lượt vượt link hoàn thành = cột `clicks` trong traffic_logs
  const totalCompleted = traffic.reduce((s, t) => s + Number(t.clicks || 0), 0);
  const avgPerDay  = traffic.length > 0 ? Math.round(totalCompleted / traffic.length) : 0;
  const peakDay    = traffic.reduce((best, t) => Number(t.clicks || 0) > Number(best?.clicks || 0) ? t : best, null);
  const trend      = getTrend(traffic);
  const deviceTotal = byDevice.reduce((s, x) => s + x.value, 0);
  const chartData  = traffic.map(t => ({ date: fmtDay(t.date), 'Lượt xem': Number(t.clicks || 0) }));

  // Campaigns to show in progress: exclude completed > 24h
  const visibleCampaigns = campaigns.filter(c => {
    const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
    const effStatus = (isDone || c.status === 'completed') ? 'completed' : c.status;
    if (effStatus !== 'completed') return true;
    return isWithin24h(c.updated_at);
  });

  const kpis = [
    { label: 'Tổng lượt xem', value: fmt(totalCompleted), sub: `đã hoàn thành trong ${range === '7d' ? '7' : range === '30d' ? '30' : '90'} ngày`, icon: Eye, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
    { label: 'Trung bình / ngày', value: fmt(avgPerDay), sub: 'hoàn thành/ngày', icon: BarChart2, color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
    { label: 'Chiến dịch đang chạy', value: overview.runningCampaigns || 0, sub: `/ ${overview.totalCampaigns || 0} chiến dịch`, icon: Zap, color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
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
          <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full font-medium">Tổng {fmt(totalCompleted)} views</span>
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
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleCampaigns.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Chưa có chiến dịch nào</td></tr>
              ) : visibleCampaigns.map(c => {
                const done  = Number(c.views_done || 0);
                const total = Number(c.total_views || 1);
                const isCompleted = done >= total || c.status === 'completed';
                const pct = Math.min(Math.round((done / total) * 100), 100);
                const effStatus = isCompleted ? 'completed' : c.status;
                const badge = { running: { label: 'Đang chạy', cls: 'bg-green-100 text-green-700' }, paused: { label: 'Tạm dừng', cls: 'bg-amber-100 text-amber-700' }, completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' } }[effStatus] || { label: effStatus, cls: 'bg-slate-100 text-slate-600' };
                const barColor = effStatus === 'completed' ? '#10B981' : effStatus === 'running' ? '#3B82F6' : '#F59E0B';
                const isExpanded = expandedId === c.id;
                const det = campDetails[c.id];
                return (
                  <>
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
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => openDetail(c)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 transition">
                          Xem
                        </button>
                      </td>
                    </tr>
                  </>
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
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Hoàn thành</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Unique IPs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {traffic.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400">Không có dữ liệu</td></tr>
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
                    <td className="px-6 py-3 text-right font-semibold text-emerald-600">{fmt(t.clicks)}</td>
                    <td className="px-6 py-3 text-right text-slate-500">{fmt(t.unique_ips)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <CampaignDetailModal
        campaign={modalCamp}
        detail={modalCamp ? campDetails[modalCamp.id] : null}
        onClose={closeDetail}
      />
    </div>
  );
}