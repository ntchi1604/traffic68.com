import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, AreaChart, Area
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
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xl space-y-1">
      <p className="text-xs font-bold text-slate-500 mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">
            {p.name === 'Chi phí' ? `${Number(p.value).toLocaleString('vi-VN')} đ` : Number(p.value).toLocaleString('vi-VN')}
          </span>
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

function CampaignDetailModal({ campaign: c, onClose }) {
  const [mRange, setMRange] = useState('7d');
  const [detail, setDetail] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [dailyKws, setDailyKws] = useState([]);
  const [fetchingTasks, setFetchingTasks] = useState(false);

  useEffect(() => {
    if (!c) return;
    setDetail(null);
    setTasks([]);
    setFetchingTasks(true);
    Promise.all([
      api.get(`/reports/traffic?campaignId=${c.id}&period=${mRange}`),
      api.get(`/reports/tasks?campaignId=${c.id}&period=${mRange}`),
      api.get(`/reports/detailed?campaignId=${c.id}&period=${mRange}`)
    ]).then(([tr, tk, dt]) => {
      const rows = tr.traffic || [];
      const bd = tr.byDevice || [];
      const totalClicks = rows.reduce((s, t) => s + Number(t.clicks || 0), 0);
      const totalViews = rows.reduce((s, t) => s + Number(t.views || 0), 0);
      const uniqueIps = rows.reduce((s, t) => s + Number(t.unique_ips || 0), 0);
      const mobile = bd.find(x => x.name === 'Mobile')?.value || 0;
      const desktop = bd.find(x => x.name === 'Desktop')?.value || 0;
      const tablet = bd.find(x => x.name === 'Tablet')?.value || 0;
      setDetail({ totalClicks, totalViews, uniqueIps, mobile, desktop, tablet, rows });
      setTasks(tk.tasks || []);
      setDailyKws(dt.detailed || []);
    }).catch(console.error).finally(() => setFetchingTasks(false));
  }, [c, mRange]);

  if (!c) return null;
  const done = Number(c.views_done || 0);
  const total = Number(c.total_views || 1);
  const pct = Math.min(Math.round((done / total) * 100), 100);
  const spent = done * Number(c.cpc || 0);
  const eff = detail?.totalViews > 0 ? Math.round((detail.totalClicks / detail.totalViews) * 100) : 0;

  const deviceData = [
    { name: 'Desktop', value: detail?.desktop || 0, color: '#3B82F6' },
    { name: 'Mobile', value: detail?.mobile || 0, color: '#8B5CF6' },
    { name: 'Tablet', value: detail?.tablet || 0, color: '#F59E0B' },
  ].filter(d => d.value > 0);

  const dailyData = (detail?.rows || []).map(r => ({
    date: fmtDay(r.date),
    'Hoàn thành': Number(r.clicks || 0),
    'Nhận task': Number(r.views || 0),
  }));

  const kpis = [
    { label: 'Hoàn thành', value: fmt(detail?.totalClicks || 0), sub: `/ ${fmt(detail?.totalViews || 0)} nhận task`, color: '#10B981', bg: '#ECFDF5' },
    { label: 'Chi phí', value: `${fmt(spent)} đ`, sub: `CPC: ${fmt(c.cpc)} đ`, color: '#F97316', bg: '#FFF7ED' },
    { label: 'Hiệu suất', value: `${eff}%`, sub: 'hoàn thành / nhận task', color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Unique IPs', value: fmt(detail?.uniqueIps || 0), sub: 'IP khác nhau', color: '#8B5CF6', bg: '#F5F3FF' },
  ];

  const uaShort = ua => {
    if (!ua) return '—';
    if (/mobile|android/i.test(ua)) return 'Mobile Browser';
    if (/iphone|ipad/i.test(ua)) return 'iOS Browser';
    if (/chrome/i.test(ua)) return 'Chrome';
    if (/firefox/i.test(ua)) return 'Firefox';
    if (/safari/i.test(ua)) return 'Safari';
    return ua.slice(0, 40);
  };

  const exportCSV = () => {
    const csvRows = [];
    csvRows.push(['=== THÔNG TIN CHIẾN DỊCH ===']);
    csvRows.push(['Tên', c.name]);
    csvRows.push(['URL', c.url]);
    csvRows.push(['Nguồn traffic', SOURCE_LABEL_MAP[c.traffic_type] || c.traffic_type || '']);
    csvRows.push(['Từ khóa', (() => { try { const a = JSON.parse(c.keyword); if (Array.isArray(a)) return a.join(', '); } catch { } return c.keyword || ''; })()]);
    csvRows.push(['Thời gian xem', c.time_on_site ? `${c.time_on_site}s` : '']);
    csvRows.push(['CPC', `${c.cpc} đ`]);
    csvRows.push(['Ngân sách', `${c.budget} đ`]);
    csvRows.push(['Tiến độ', `${done}/${total} (${pct}%)`]);
    csvRows.push([]);
    csvRows.push(['=== THỐNG KÊ TỔNG HỢP ===']);
    csvRows.push(['Hoàn thành', detail?.totalClicks || 0]);
    csvRows.push(['Nhận task', detail?.totalViews || 0]);
    csvRows.push(['Hiệu suất', `${eff}%`]);
    csvRows.push(['Chi phí đã dùng', `${spent} đ`]);
    csvRows.push(['Unique IPs', detail?.uniqueIps || 0]);
    csvRows.push([]);
    if (deviceData.length > 0) {
      csvRows.push(['=== THIẾT BỊ ===']);
      csvRows.push(['Thiết bị', 'Lượt']);
      deviceData.forEach(d => csvRows.push([d.name, d.value]));
      csvRows.push([]);
    }
    if (dailyData.length > 0) {
      csvRows.push(['=== CHI TIẾT THEO NGÀY ===']);
      csvRows.push(['Ngày', 'Hoàn thành', 'Nhận task']);
      dailyData.forEach(r => csvRows.push([r.date, r['Hoàn thành'], r['Nhận task']]));
      csvRows.push([]);
    }
    if (tasks.length > 0) {
      csvRows.push(['=== LỊCH SỬ HOÀN THÀNH ===']);
      csvRows.push(['Thời gian', 'IP', 'Country', 'User Agent', 'Thời gian xem (s)']);
      tasks.forEach(t => csvRows.push([
        t.completed_at ? new Date(t.completed_at).toLocaleString('vi-VN') : '',
        t.ip_address || '',
        t.ip_country || '—',
        t.user_agent || '',
        t.time_on_site || '',
      ]));
    }
    const csv = csvRows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_${c.id}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PERIODS = [{ key: '7d', label: '7 ngày' }, { key: '30d', label: '30 ngày' }, { key: '90d', label: '90 ngày' }];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Chi tiết chiến dịch</p>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>{c.name}</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{c.url}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Period selector */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3, gap: 2 }}>
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setMRange(p.key)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                    background: mRange === p.key ? '#fff' : 'transparent',
                    color: mRange === p.key ? '#0f172a' : '#94a3b8',
                    boxShadow: mRange === p.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  }}>{p.label}</button>
              ))}
            </div>
            {detail && (
              <button onClick={exportCSV}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#475569' }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                ⬇ Xuất CSV
              </button>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f1f5f9', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Progress */}
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: '#64748b' }}>Tiến độ tổng</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{fmt(done)} / {fmt(total)} views ({pct}%)</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99 }}>
              <div style={{ height: 8, borderRadius: 99, background: pct >= 100 ? '#10b981' : '#3b82f6', width: `${pct}%`, transition: 'width 0.5s ease' }} />
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {fetchingTasks && !detail ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>Đang tải dữ liệu...</div>
            ) : kpis.map(k => (
              <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: k.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</p>
                <p style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0 }}>{k.value}</p>
                <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{k.sub}</p>
              </div>
            ))}
          </div>

          {detail && <>
            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: dailyData.length > 0 ? '1.6fr 1fr' : '1fr', gap: 14 }}>
              {dailyData.length > 0 && (
                <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 14px 6px' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 10 }}>Hoàn thành theo ngày</p>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gDet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={28} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="Hoàn thành" stroke="#10B981" fill="url(#gDet)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#10B981' }} />
                        <Area type="monotone" dataKey="Nhận task" stroke="#3B82F6" fill="none" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {deviceData.length > 0 && (
                <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 14px 8px' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Thiết bị</p>
                  <div style={{ height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={deviceData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                          {deviceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={v => [v.toLocaleString('vi-VN'), '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingBottom: 4 }}>
                    {deviceData.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                        {d.name}: {d.value.toLocaleString('vi-VN')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info row */}
            {(() => {
              const parseArr = (val) => {
                if (!val) return [];
                try { const a = JSON.parse(val); if (Array.isArray(a)) return a.filter(Boolean); } catch { }
                return val ? [val] : [];
              };
              const keywords = parseArr(c.keyword);
              const urls2 = parseArr(c.url2);
              const allUrls = [c.url, ...urls2].filter(Boolean);
              const images = [...parseArr(c.image1_url), ...(c.image2_url ? parseArr(c.image2_url) : [])].filter(Boolean);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Nguồn + TG xem */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Nguồn traffic</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>{SOURCE_LABEL_MAP[c.traffic_type] || c.traffic_type || '—'}</p>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Thời gian xem</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>{c.time_on_site ? `${c.time_on_site}s` : '—'}</p>
                    </div>
                  </div>

                  {/* Keywords */}
                  {keywords.length > 0 && (
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Từ khóa ({keywords.length})</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {keywords.map((kw, i) => (
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dbeafe', color: '#1e40af', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 8 }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* URLs */}
                  {allUrls.length > 0 && (
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>URL đích ({allUrls.length})</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {allUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all', fontWeight: 500 }} onMouseEnter={e => e.target.style.textDecoration = 'underline'} onMouseLeave={e => e.target.style.textDecoration = 'none'}>
                            {i === 0 ? '🔗 ' : '↳ '}{url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Images */}
                  {images.length > 0 && (
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Hình ảnh ({images.length})</p>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, 1fr)`, gap: 8 }}>
                        {images.map((img, i) => (
                          <img key={i} src={img} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }} onError={e => e.target.style.display = 'none'} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Daily Keywords table */}
            {dailyKws.length > 0 && (
              <div style={{ borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', margin: 0 }}>Chi tiết theo ngày / từ khoá</p>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{dailyKws.length} dòng</span>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 240, overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {['Ngày', 'Từ khoá', 'Hoàn thành', 'Chi phí'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Ngày' || h === 'Từ khoá' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dailyKws.map((d, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '7px 12px', color: '#475569', whiteSpace: 'nowrap', fontWeight: 600 }}>{d.date?.slice(0, 10)}</td>
                          <td style={{ padding: '7px 12px', color: '#4338ca', fontWeight: 700, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.keyword}>{d.keyword || '(Trống)'}</td>
                          <td style={{ padding: '7px 12px', color: '#059669', textAlign: 'right', fontWeight: 700 }}>{fmt(d.completed)} <span style={{ color: '#cbd5e1', fontWeight: 500 }}>/ {fmt(d.total)}</span></td>
                          <td style={{ padding: '7px 12px', color: '#475569', textAlign: 'right', fontWeight: 600 }}>{fmt(d.cost)} đ</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tasks table */}
            {tasks.length > 0 && (
              <div style={{ borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', margin: 0 }}>Lịch sử hoàn thành</p>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{tasks.length} lượt</span>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 240, overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {['Thời gian', 'IP', 'Country', 'User Agent', 'TG xem'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '7px 12px', color: '#475569', whiteSpace: 'nowrap' }}>
                            {t.completed_at ? new Date(t.completed_at).toLocaleString('vi-VN') : '—'}
                          </td>
                          <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#334155', whiteSpace: 'nowrap' }}>{t.ip_address || '—'}</td>
                          <td style={{ padding: '7px 12px', color: '#64748b' }}>{t.ip_country || '—'}</td>
                          <td style={{ padding: '7px 12px', color: '#64748b', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.user_agent}>
                            {uaShort(t.user_agent)}
                          </td>
                          <td style={{ padding: '7px 12px', color: '#64748b', textAlign: 'center' }}>{t.time_on_site ? `${t.time_on_site}s` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
  const [totalCost, setTotalCost] = useState(0);
  const [bySource, setBySource] = useState([]);
  const [byDevice, setByDevice] = useState([]);
  const [overview, setOverview] = useState({});
  const [campaigns, setCampaigns] = useState([]);
  const [detailed, setDetailed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [modalCamp, setModalCamp] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/reports/traffic?period=${range}`),
      api.get('/reports/overview'),
      api.get('/campaigns'),
    ]).then(([tr, ov, cp]) => {
      setTraffic(tr.traffic || []);
      setTotalCost(tr.totalCost || 0);
      setBySource(tr.bySource || []);
      setByDevice(tr.byDevice || []);
      setOverview(ov.overview || {});
      setCampaigns(cp.campaigns || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [range, refreshKey]);

  const openDetail = (camp) => { setModalCamp(camp); setExpandedId(camp.id); };
  const closeDetail = () => { setExpandedId(null); setModalCamp(null); };

  // "View" = lượt vượt link hoàn thành = cột `clicks` trong traffic_logs
  const totalCompleted = traffic.reduce((s, t) => s + Number(t.clicks || 0), 0);
  const avgPerDay = traffic.length > 0 ? Math.round(totalCompleted / traffic.length) : 0;
  const peakDay = traffic.reduce((best, t) => Number(t.clicks || 0) > Number(best?.clicks || 0) ? t : best, null);
  const trend = getTrend(traffic);
  const deviceTotal = byDevice.reduce((s, x) => s + x.value, 0);
  const chartData = traffic.map(t => ({
    date: fmtDay(t.date),
    'Lượt hoàn thành': Number(t.clicks || 0),
    'Chi phí': Math.round(Number(t.cost || 0)),
  }));


  // Campaigns to show in progress: exclude completed > 24h
  const visibleCampaigns = campaigns.filter(c => {
    const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
    const effStatus = (isDone || c.status === 'completed') ? 'completed' : c.status;
    if (effStatus !== 'completed') return true;
    return isWithin24h(c.updated_at);
  });

  const kpis = [
    { label: 'Tổng hoàn thành', value: fmt(totalCompleted), sub: `trong ${range === '7d' ? '7' : range === '30d' ? '30' : '90'} ngày`, icon: Eye, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
    { label: 'Chi phí đã dùng', value: `${fmt(totalCost)} đ`, sub: 'Tổng chi phí traffic', icon: Wallet, color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
    { label: 'Trung bình / ngày', value: fmt(avgPerDay), sub: 'hoàn thành/ngày', icon: BarChart2, color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
    { label: 'Chiến dịch đang chạy', value: overview.runningCampaigns || 0, sub: `/ ${overview.totalCampaigns || 0} chiến dịch`, icon: Zap, color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
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
            <p className="text-xs text-amber-600 font-medium mt-0.5">{peakDay ? `${fmt(peakDay.clicks)} lượt hoàn thành` : 'Chưa có dữ liệu'}</p>
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
            <p className="text-lg font-black text-slate-900 mt-0.5">{traffic.filter(t => Number(t.clicks) > 0).length} ngày</p>
            <p className="text-xs text-blue-600 font-medium mt-0.5">/ {traffic.length} ngày trong kỳ</p>
          </div>
        </div>
      </div>

      {/* Main Chart — Dual axis */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Lượt hoàn thành & Chi phí theo ngày</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Hoàn thành</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block" /> Chi phí</span>
            <span className="text-slate-400 bg-slate-100 px-2 py-1 rounded-full font-medium">
              Tổng: {fmt(totalCompleted)} views · {fmt(totalCost)} đ
            </span>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: 0, right: 20, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="views" orientation="left"
                  tick={{ fontSize: 11, fill: '#3B82F6' }} axisLine={false} tickLine={false} width={36}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                <YAxis yAxisId="cost" orientation="right"
                  tick={{ fontSize: 11, fill: '#F97316' }} axisLine={false} tickLine={false} width={52}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="views" dataKey="Lượt hoàn thành" fill="url(#gViews)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line yAxisId="cost" type="monotone" dataKey="Chi phí" stroke="#F97316" strokeWidth={2.5}
                  dot={{ r: 3, fill: '#F97316', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#F97316', stroke: '#fff', strokeWidth: 2 }} />
              </ComposedChart>
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
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Nay/Qua</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Tổng Views</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Ngân sách</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleCampaigns.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">Chưa có chiến dịch nào</td></tr>
              ) : visibleCampaigns.map(c => {
                const done = Number(c.views_done || 0);
                const total = Number(c.total_views || 1);
                const isCompleted = done >= total || c.status === 'completed';
                const pct = Math.min(Math.round((done / total) * 100), 100);
                const effStatus = isCompleted ? 'completed' : c.status;
                const badge = { running: { label: 'Đang chạy', cls: 'bg-green-100 text-green-700' }, paused: { label: 'Tạm dừng', cls: 'bg-amber-100 text-amber-700' }, completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' } }[effStatus] || { label: effStatus, cls: 'bg-slate-100 text-slate-600' };
                const barColor = effStatus === 'completed' ? '#10B981' : effStatus === 'running' ? '#3B82F6' : '#F59E0B';
                const isExpanded = expandedId === c.id;
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
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="font-bold text-blue-600">{fmt(c.views_today || 0)}</span> <span className="text-slate-400 text-xs">/ {fmt(c.views_yesterday || 0)}</span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
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
                  <BarChart data={bySource.map(s => ({ name: SOURCE_LABELS[s.source] || s.source, 'Hoàn thành': Number(s.clicks || 0) }))} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={32} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Hoàn thành" name="Hoàn thành" radius={[6, 6, 0, 0]}>
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
                    <span className="text-xs font-semibold text-slate-700">{fmt(s.clicks || 0)} hoàn thành</span>
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Ngày</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Hoàn thành</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Chi phí</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Unique IPs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {traffic.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400">Không có dữ liệu</td></tr>
              ) : [...traffic].reverse().map(t => {
                const isPeak = peakDay && t.date === peakDay.date;
                return (
                  <tr key={t.date} className={`hover:bg-slate-50 transition-colors ${isPeak ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{fmtDate(t.date)}</span>
                        {isPeak && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">PEAK</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-blue-600">{fmt(t.clicks)}</td>
                    <td className="px-6 py-3 text-right font-semibold text-orange-500">{fmt(Math.round(t.cost || 0))} đ</td>
                    <td className="px-6 py-3 text-right text-slate-400">{fmt(t.unique_ips)}</td>
                  </tr>
                );
              })}
              {traffic.length > 0 && (
                <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                  <td className="px-6 py-3 text-xs font-bold text-slate-600">Tổng cộng</td>
                  <td className="px-6 py-3 text-right text-xs font-black text-blue-600">{fmt(totalCompleted)}</td>
                  <td className="px-6 py-3 text-right text-xs font-black text-orange-500">{fmt(Math.round(totalCost))} đ</td>
                  <td className="px-6 py-3 text-right text-xs font-bold text-slate-400">{fmt(traffic.reduce((s, t) => s + Number(t.unique_ips || 0), 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <CampaignDetailModal
        campaign={modalCamp}
        onClose={closeDetail}
      />
    </div>
  );
}