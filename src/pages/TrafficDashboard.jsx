import { useState, useEffect, useRef } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  Wallet, Plus, TrendingUp, Zap, CreditCard, ArrowUpRight, ArrowDownLeft,
  BarChart2, CheckCircle2, ChevronRight, Target, RefreshCw,
  MousePointerClick, Globe, Activity, Sparkles, Eye, Timer,
  Gift, ShoppingCart, ArrowDownCircle, Bell, X,
} from 'lucide-react';
import { formatMoney as fmt, fmtDateTime } from '../lib/format';
import api from '../lib/api';

/* ───────────────────────────────────────────── animated counter */
function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = Date.now();
    const to = Number(value) || 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(to * ease));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <>{fmt(display)}</>;
}

/* ───────────────────────────────────────────── campaign status badge */
function CampaignBadge({ status }) {
  const map = {
    running:   { label: 'Đang chạy',  cls: 'text-emerald-700 bg-emerald-50  ring-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
    paused:    { label: 'Tạm dừng',   cls: 'text-amber-700  bg-amber-50   ring-amber-200',    dot: 'bg-amber-400' },
    completed: { label: 'Hoàn thành', cls: 'text-slate-600  bg-slate-100  ring-slate-200',    dot: 'bg-slate-400' },
    draft:     { label: 'Bản nháp',   cls: 'text-indigo-700   bg-blue-50    ring-blue-200',     dot: 'bg-blue-400' },
  };
  const cfg = map[status] || map.paused;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ring-1 ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/* ───────────────────────────────────────────── custom tooltip */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs font-bold text-slate-500 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}{p.name === 'Chi phí' ? ' đ' : ''}
        </p>
      ))}
    </div>
  );
}

/* ───────────────────────────────────────────── transaction icon */
const TX_ICON_MAP = {
  deposit:    { Icon: ArrowDownCircle, bg: 'bg-emerald-50',  ring: 'ring-emerald-200', color: 'text-emerald-600' },
  commission: { Icon: Gift,            bg: 'bg-violet-50',   ring: 'ring-violet-200',  color: 'text-violet-600' },
  referral:   { Icon: Gift,            bg: 'bg-violet-50',   ring: 'ring-violet-200',  color: 'text-violet-600' },
  campaign:   { Icon: ShoppingCart,     bg: 'bg-indigo-50',   ring: 'ring-orange-200',  color: 'text-indigo-600' },
  withdraw:   { Icon: ArrowUpRight,     bg: 'bg-rose-50',     ring: 'ring-rose-200',    color: 'text-rose-500' },
};
function TxIcon({ type }) {
  const cfg = TX_ICON_MAP[type] || { Icon: Wallet, bg: 'bg-slate-100', ring: 'ring-slate-200', color: 'text-slate-500' };
  const { Icon, bg, ring, color } = cfg;
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${bg} ${ring}`}>
      <Icon size={16} className={color} />
    </div>
  );
}

/* ───────────────────────────────────────────── KPI card */
function KpiCard({ label, value, sub, icon: Icon, colorClass, bgClass, borderClass, barColor, delay = 0 }) {
  return (
    <div
      className={`group relative bg-white rounded-2xl border ${borderClass} p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${barColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className={`w-10 h-10 ${bgClass} rounded-xl flex items-center justify-center mb-3`}>
        <Icon size={18} className={colorClass} />
      </div>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${colorClass.replace('text-', 'text-').replace('-600', '-400')} mb-1`}>{label}</p>
      <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">
        <AnimatedNumber value={value} />
      </p>
      {sub && <p className="text-xs text-slate-400 mt-2 border-t border-slate-100 pt-2 leading-snug">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Dashboard
═══════════════════════════════════════════════════════════════ */
export default function TrafficDashboard() {
  usePageTitle('Tổng quan – Traffic68');
  const navigate = useNavigate();
  const [overview, setOverview]         = useState(null);
  const [campaigns, setCampaigns]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [greeting, setGreeting]         = useState('');
  const [userName, setUserName]         = useState('');
  const [currentTime, setCurrentTime]   = useState(new Date());
  const [announcement, setAnnouncement] = useState(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối');
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUserName(u.name || '');
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/reports/overview'),
      api.get('/campaigns'),
      api.get('/finance/transactions?limit=5').catch(() => ({ transactions: [] })),
      api.get('/auth/me').catch(() => ({})),
    ]).then(([ov, cp, tx, me]) => {
      setOverview(ov.overview);
      setCampaigns(cp.campaigns || []);
      setTransactions(tx.transactions || []);
      if (me?.user?.name) setUserName(me.user.name);
    }).catch(console.error).finally(() => setLoading(false));

    // Fetch buyer announcement
    fetch('/api/announcement?role=buyer')
      .then(r => r.json())
      .then(d => { if (d.enabled && d.message) setAnnouncement(d); })
      .catch(() => {});
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-80 gap-4">
      <RefreshCw size={24} className="animate-spin text-indigo-500" />
      <span className="text-sm font-medium text-slate-400 animate-pulse">Đang tải dữ liệu...</span>
    </div>
  );

  const ov = overview || {};

  const runningCamps    = campaigns.filter(c => c.status === 'running');
  const completedCamps  = campaigns.filter(c => {
    const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
    return isDone || c.status === 'completed';
  });
  const pausedCamps = campaigns.filter(c => {
    const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
    return !isDone && c.status === 'paused';
  });
  const totalBudget   = campaigns.reduce((s, c) => s + Number(c.budget || 0), 0);
  const totalSpent    = campaigns.reduce((s, c) => s + Number(c.views_done || 0) * Number(c.cpc || 0), 0);
  const totalViews    = campaigns.reduce((s, c) => s + Number(c.views_done || 0), 0);
  const budgetUsedPct = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;

  const chartData = (ov.chart || []).map(d => ({
    day: new Date(d.day).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    views: Number(d.views || 0),
    spent: Number(d.spent || 0),
  }));

  const pieData = [
    { name: 'Đang chạy', value: runningCamps.length,   color: '#6366f1' },
    { name: 'Tạm dừng',  value: pausedCamps.length,    color: '#f59e0b' },
    { name: 'Hoàn thành',value: completedCamps.length, color: '#10b981' },
  ].filter(d => d.value > 0);

  const typeLabel = {
    deposit:         'Nạp tiền',
    withdraw:        'Rút tiền',
    campaign:        'Mua traffic',
    campaign_charge: 'Mua traffic',
    commission:      'Hoa hồng',
    referral:        'Giới thiệu',
    transfer:        'Chuyển ví',
    refund:          'Hoàn tiền',
  };

  const kpis = [
    {
      label: 'Số dư ví Traffic', value: ov.mainBalance || 0,
      sub: `Đã chi tổng: ${fmt(ov.totalSpent || 0)} đ`,
      icon: Wallet,      colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-100', barColor: 'bg-gradient-to-r from-indigo-500 to-violet-500', delay: 0,
    },
    {
      label: 'Tổng views đã mua', value: totalViews,
      sub: `Từ ${campaigns.length} chiến dịch`,
      icon: Eye,         colorClass: 'text-cyan-600',   bgClass: 'bg-cyan-50',   borderClass: 'border-cyan-100',   barColor: 'bg-gradient-to-r from-cyan-400 to-blue-500',   delay: 60,
    },
    {
      label: 'Chiến dịch đang chạy', value: runningCamps.length,
      sub: `${pausedCamps.length} tạm dừng · ${completedCamps.length} hoàn thành`,
      icon: Zap,         colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-100', barColor: 'bg-gradient-to-r from-emerald-400 to-teal-500', delay: 120,
    },
    {
      label: 'Ngân sách sử dụng (%)', value: budgetUsedPct,
      sub: `${fmt(totalSpent)} / ${fmt(totalBudget)} đ`,
      icon: Activity,
      colorClass: budgetUsedPct >= 90 ? 'text-red-600' : 'text-amber-600',
      bgClass:    budgetUsedPct >= 90 ? 'bg-red-50'    : 'bg-amber-50',
      borderClass:budgetUsedPct >= 90 ? 'border-red-100': 'border-amber-100',
      barColor:   budgetUsedPct >= 90 ? 'bg-gradient-to-r from-red-400 to-orange-500' : 'bg-gradient-to-r from-amber-400 to-orange-400',
      delay: 180,
    },
  ];

  return (
    <div className="space-y-5 w-full min-w-0 pb-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Admin Announcement Banner ── */}
      {announcement && !announcementDismissed && (() => {
        const styles = {
          info:    { wrap: 'bg-blue-50 border-blue-200 text-blue-800',    icon: 'text-blue-500' },
          warning: { wrap: 'bg-amber-50 border-amber-200 text-amber-800', icon: 'text-amber-500' },
          success: { wrap: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: 'text-emerald-500' },
          error:   { wrap: 'bg-red-50 border-red-200 text-red-800',       icon: 'text-red-500' },
        };
        const s = styles[announcement.type] || styles.info;
        return (
          <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border shadow-sm ${s.wrap}`}>
            <Bell size={18} className={`${s.icon} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide mb-1 opacity-60">Thông báo từ Admin</p>
              <p className="text-sm font-semibold leading-relaxed whitespace-pre-line">{announcement.message}</p>
            </div>
            <button onClick={() => setAnnouncementDismissed(true)} className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 transition" title="Đóng">
              <X size={15} />
            </button>
          </div>
        );
      })()}

      {/* ── Quick actions ── */}
      <div className="flex items-center justify-end gap-2.5 flex-wrap">
        <button
          onClick={() => navigate('/buyer/dashboard/finance/deposit')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 transition-all duration-200 shadow-sm"
        >
          <CreditCard size={14} /> Nạp tiền
        </button>
        <button
          onClick={() => navigate('/buyer/dashboard/campaigns/create')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
        >
          <Plus size={14} /> Tạo chiến dịch
        </button>
      </div>

      {/* ══════════════════════════════════════
          KPI Cards
      ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* ══════════════════════════════════════
          Chart + Donut
      ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Area Chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Views & Chi phí</h2>
              <p className="text-xs text-slate-400 mt-0.5">7 ngày gần nhất</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />Views</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />Chi phí</span>
            </div>
          </div>

          {chartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lgViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="lgSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="views" name="Views" stroke="#6366f1" strokeWidth={2.5}
                    fill="url(#lgViews)" dot={false} activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="spent" name="Chi phí" stroke="#06b6d4" strokeWidth={2}
                    fill="url(#lgSpent)" dot={false} activeDot={{ r: 5, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-slate-300">
              <BarChart2 size={36} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">Chưa có dữ liệu 7 ngày qua</p>
              <p className="text-xs mt-1 text-slate-400">Tạo chiến dịch để bắt đầu</p>
            </div>
          )}
        </div>

        {/* Donut */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm flex flex-col">
          <h2 className="text-sm font-bold text-slate-800 mb-0.5">Phân bổ chiến dịch</h2>
          <p className="text-xs text-slate-400 mb-4">Theo trạng thái hiện tại</p>

          {campaigns.length > 0 ? (
            <>
              <div style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                      dataKey="value" strokeWidth={3} stroke="#fff" paddingAngle={3}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
                      itemStyle={{ fontWeight: 700 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 mt-2">
                {[
                  { label: 'Đang chạy',  count: runningCamps.length,   color: '#6366f1' },
                  { label: 'Tạm dừng',   count: pausedCamps.length,    color: '#f59e0b' },
                  { label: 'Hoàn thành', count: completedCamps.length, color: '#10b981' },
                ].map(({ label, count, color }) => {
                  const pct = campaigns.length > 0 ? Math.round((count / campaigns.length) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-2 text-slate-500">
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />{label}
                        </span>
                        <span className="font-bold text-slate-700 tabular-nums">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Target size={32} className="mb-3 opacity-30" />
              <p className="text-sm">Chưa có chiến dịch</p>
              <button onClick={() => navigate('/buyer/dashboard/campaigns/create')}
                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                + Tạo ngay
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          Budget + Quick actions
      ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Budget */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Ngân sách tổng</h2>
              <p className="text-xs text-slate-400 mt-0.5">Tỷ lệ chi tiêu toàn bộ chiến dịch</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-slate-900 tabular-nums">{budgetUsedPct}</span>
              <span className="text-sm text-slate-400 font-semibold ml-0.5">%</span>
            </div>
          </div>
          <div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-1000"
                style={{
                  width: `${budgetUsedPct}%`,
                  background: budgetUsedPct >= 90
                    ? 'linear-gradient(90deg,#ef4444,#f97316)'
                    : budgetUsedPct >= 70
                    ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                    : 'linear-gradient(90deg,#6366f1,#06b6d4)',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1.5">
              <span>Đã chi: <strong className="text-slate-700">{fmt(totalSpent)} đ</strong></span>
              <span>Tổng: <strong className="text-slate-700">{fmt(totalBudget)} đ</strong></span>
            </div>
          </div>

          {campaigns.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Theo chiến dịch</p>
              {campaigns.slice(0, 5).map(c => {
                const spent  = Number(c.views_done || 0) * Number(c.cpc || 0);
                const budget = Number(c.budget || 1);
                const pct    = Math.min(Math.round((spent / budget) * 100), 100);
                const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
                const effS   = isDone ? 'completed' : c.status;
                const bar    = effS === 'completed' ? '#10b981' : effS === 'running' ? '#6366f1' : '#f59e0b';
                return (
                  <div key={c.id} className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => navigate('/buyer/dashboard/campaigns')}>
                    <p className="text-xs font-medium text-slate-600 group-hover:text-slate-900 truncate w-28 sm:w-44 shrink-0 transition-colors">{c.name}</p>
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: bar }} />
                    </div>
                    <span className="text-xs font-bold text-slate-500 w-8 text-right shrink-0 tabular-nums">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-0.5 px-1">Thao tác nhanh</h2>
          <p className="text-xs text-slate-400 mb-3 px-1">Truy cập nhanh các tính năng</p>
          <div className="space-y-1">
            {[
              { label: 'Tạo chiến dịch',    desc: 'Bắt đầu traffic mới',         icon: Plus,       to: '/buyer/dashboard/campaigns/create',     gradient: 'from-indigo-500 to-violet-500',  shadow: 'shadow-indigo-200' },
              { label: 'Xem báo cáo',       desc: 'Phân tích chi tiết',           icon: TrendingUp, to: '/buyer/dashboard/reports',              gradient: 'from-violet-500 to-purple-600',  shadow: 'shadow-violet-200' },
              { label: 'Nạp tiền',          desc: 'Bổ sung ngân sách',            icon: CreditCard, to: '/buyer/dashboard/finance/deposit',      gradient: 'from-emerald-400 to-teal-500',   shadow: 'shadow-emerald-200' },
              { label: 'Quản lý campaigns', desc: 'Xem, sửa và theo dõi',         icon: Target,     to: '/buyer/dashboard/campaigns',            gradient: 'from-amber-400 to-orange-500',   shadow: 'shadow-amber-200' },
              { label: 'Theo dõi traffic',  desc: 'Monitor lưu lượng truy cập',   icon: Globe,      to: '/buyer/dashboard/reports',              gradient: 'from-cyan-400 to-blue-500',      shadow: 'shadow-cyan-200' },
              { label: 'Lịch sử giao dịch', desc: 'Xem các giao dịch tài khoản', icon: Timer,      to: '/buyer/dashboard/finance/transactions', gradient: 'from-slate-400 to-slate-600',    shadow: 'shadow-slate-200' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.to)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-150 group text-left">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${a.gradient} shadow-md ${a.shadow} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
                  <a.icon size={14} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate">{a.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{a.desc}</p>
                </div>
                <ChevronRight size={12} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          Campaigns table + Transactions
      ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Campaigns Table */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Chiến dịch gần đây</h3>
              <p className="text-xs text-slate-400 mt-0.5">{campaigns.length} chiến dịch</p>
            </div>
            <button onClick={() => navigate('/buyer/dashboard/campaigns')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
              Xem tất cả <ChevronRight size={12} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chiến dịch</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiến độ</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngân sách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaigns.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-14 text-center text-slate-400">
                    <Target size={28} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-medium">Chưa có chiến dịch nào</p>
                    <button onClick={() => navigate('/buyer/dashboard/campaigns/create')}
                      className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                      + Tạo chiến dịch đầu tiên
                    </button>
                  </td></tr>
                ) : campaigns.slice(0, 6).map(c => {
                  const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
                  const effStatus = isDone ? 'completed' : c.status;
                  const pct = Number(c.total_views) > 0
                    ? Math.min(Math.round((Number(c.views_done) / Number(c.total_views)) * 100), 100)
                    : 0;
                  const barColor = effStatus === 'completed' ? '#10b981' : effStatus === 'running' ? '#6366f1' : '#f59e0b';
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                      onClick={() => navigate('/buyer/dashboard/campaigns')}>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-800 truncate max-w-[160px] text-[13px] group-hover:text-indigo-700 transition-colors">{c.name}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[160px] mt-0.5 font-mono">{c.url}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center"><CampaignBadge status={effStatus} /></td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 w-8 text-right tabular-nums">{pct}%</span>
                        </div>
                        <p className="text-[10px] text-slate-400 text-right mt-0.5 tabular-nums">{fmt(c.views_done)}/{fmt(c.total_views)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-700 text-[13px] tabular-nums whitespace-nowrap">{fmt(c.budget)} đ</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Giao dịch gần đây</h3>
              <p className="text-xs text-slate-400 mt-0.5">5 giao dịch cuối</p>
            </div>
            <button onClick={() => navigate('/buyer/dashboard/finance/transactions')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
              Xem tất cả <ChevronRight size={12} />
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400">
              <CreditCard size={28} className="mb-2 opacity-20" />
              <p className="text-sm font-medium">Chưa có giao dịch</p>
              <button onClick={() => navigate('/buyer/dashboard/finance/deposit')}
                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                Nạp tiền ngay
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {transactions.slice(0, 5).map(t => {
                const isIn = ['deposit', 'referral', 'commission', 'refund'].includes(t.type);
                const label = typeLabel[t.type] || t.type;
                // Trích tên chiến dịch từ note (nếu có)
                const noteMatch = (t.note || '').match(/"(.+?)"/);
                const subLabel = noteMatch ? noteMatch[1] : (t.ref_code || '');
                const statusCfg = {
                  completed: { cls: 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200', icon: CheckCircle2, label: 'Thành công' },
                  pending:   { cls: 'text-amber-700 bg-amber-50 ring-1 ring-amber-200',     icon: RefreshCw,    label: 'Đang xử lý' },
                }[t.status] || { cls: 'text-red-600 bg-red-50 ring-1 ring-red-200', icon: Target, label: 'Từ chối' };
                const StIcon = statusCfg.icon;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-indigo-50/30 transition-colors cursor-default">
                    <TxIcon type={t.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-slate-800 truncate">{label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={t.note || ''}>{subLabel}</p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className={`text-[13px] font-black tabular-nums ${isIn ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIn ? '+' : '−'}{fmt(t.amount)} đ
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.cls}`}>
                        <StIcon size={9} />{statusCfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
