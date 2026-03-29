import { useState, useEffect, useRef } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  Wallet, Plus, TrendingUp, Zap, CreditCard, ArrowUpRight, ArrowDownLeft,
  BarChart2, CheckCircle2, PauseCircle, ChevronRight, Target, RefreshCw,
  MousePointerClick, Globe, Activity, Sparkles, Eye, Timer,
} from 'lucide-react';
import { formatMoney as fmt, fmtDateTime } from '../lib/format';
import api from '../lib/api';

/* ─────────────────────────────────────────────
   Animated counter
───────────────────────────────────────────── */
function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = Date.now();
    const from = 0;
    const to = Number(value) || 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * ease));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <>{fmt(display)}</>;
}

/* ─────────────────────────────────────────────
   Campaign status badge
───────────────────────────────────────────── */
function CampaignBadge({ status }) {
  const map = {
    running:   { label: 'Đang chạy',  cls: 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/20', dot: 'bg-emerald-400 animate-pulse' },
    paused:    { label: 'Tạm dừng',   cls: 'text-amber-400  bg-amber-400/10  ring-amber-400/20',    dot: 'bg-amber-400' },
    completed: { label: 'Hoàn thành', cls: 'text-slate-400  bg-slate-400/10  ring-slate-400/20',    dot: 'bg-slate-400' },
    draft:     { label: 'Bản nháp',   cls: 'text-blue-400   bg-blue-400/10   ring-blue-400/20',     dot: 'bg-blue-400' },
  };
  const cfg = map[status] || map.paused;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ring-1 ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────────
   Custom Chart Tooltip
───────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e2a3a] border border-white/10 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm">
      <p className="text-xs font-bold text-slate-400 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {p.name}: {p.name === 'Views' ? `${fmt(p.value)}` : `${fmt(p.value)} đ`}
        </p>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Transaction type icon
───────────────────────────────────────────── */
function TxIcon({ type }) {
  const isIn = ['deposit', 'referral', 'commission'].includes(type);
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
      isIn ? 'bg-emerald-400/15' : 'bg-slate-400/10'
    }`}>
      {isIn
        ? <ArrowDownLeft size={16} className="text-emerald-400" />
        : <ArrowUpRight  size={16} className="text-slate-400" />
      }
    </div>
  );
}

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, gradient, glow, delay = 0 }) {
  return (
    <div
      className="relative group overflow-hidden rounded-2xl p-5 border border-white/8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-default"
      style={{
        background: 'linear-gradient(135deg, #151f2e 0%, #1a2537 100%)',
        animationDelay: `${delay}ms`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04)`,
      }}
    >
      {/* Glow */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 blur-2xl group-hover:opacity-30 transition-opacity duration-500 pointer-events-none"
        style={{ background: glow }}
      />
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: gradient }}
      >
        <Icon size={18} className="text-white" />
      </div>
      {/* Value */}
      <p className="text-2xl font-black text-white tabular-nums tracking-tight leading-none">
        <AnimatedNumber value={value} />
        {label.includes('đ') || label.toLowerCase().includes('tiền') || label.toLowerCase().includes('ngân') ? (
          <span className="text-sm text-slate-400 font-semibold ml-1">đ</span>
        ) : null}
      </p>
      <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-2 border-t border-white/5 pt-2">{sub}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Dashboard
───────────────────────────────────────────── */
export default function TrafficDashboard() {
  usePageTitle('Dashboard – Traffic68');
  const navigate = useNavigate();
  const [overview, setOverview]         = useState(null);
  const [campaigns, setCampaigns]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [greeting, setGreeting]         = useState('');
  const [userName, setUserName]         = useState('');
  const [currentTime, setCurrentTime]   = useState(new Date());

  // Greeting
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Chào buổi sáng');
    else if (h < 18) setGreeting('Chào buổi chiều');
    else setGreeting('Chào buổi tối');
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUserName(u.name || '');
  }, []);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Data
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
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-80 gap-4">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-indigo-500/30 rounded-full" />
        <div className="w-12 h-12 border-2 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin absolute inset-0" />
      </div>
      <span className="text-sm font-medium text-slate-400 animate-pulse">Đang tải dữ liệu...</span>
    </div>
  );

  const ov = overview || {};

  // Compute campaign stats
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

  // Chart data from overview (last 7 days)
  const chartData = (ov.chart || []).map(d => ({
    day: new Date(d.day).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    views: Number(d.views || 0),
    spent: Number(d.spent || 0),
  }));

  // Donut pie data for campaign status distribution
  const pieData = [
    { name: 'Đang chạy', value: runningCamps.length, color: '#6366f1' },
    { name: 'Tạm dừng',  value: pausedCamps.length,  color: '#f59e0b' },
    { name: 'Hoàn thành',value: completedCamps.length,color: '#10b981' },
  ].filter(d => d.value > 0);

  const typeLabel = {
    deposit:         'Nạp tiền',
    withdraw:        'Rút tiền',
    campaign_charge: 'Chi phí chiến dịch',
    commission:      'Hoa hồng',
    referral:        'Giới thiệu',
  };

  const kpis = [
    {
      label: 'Số dư ví Traffic',
      value: ov.mainBalance || 0,
      sub: `Đã chi tổng: ${fmt(ov.totalSpent || 0)} đ`,
      icon: Wallet,
      gradient: 'linear-gradient(135deg, #6366f1, #818cf8)',
      glow: '#6366f1',
      delay: 0,
    },
    {
      label: 'Tổng views đã mua',
      value: totalViews,
      sub: `Từ ${campaigns.length} chiến dịch`,
      icon: Eye,
      gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
      glow: '#06b6d4',
      delay: 60,
    },
    {
      label: 'Chiến dịch đang chạy',
      value: runningCamps.length,
      sub: `${pausedCamps.length} tạm dừng · ${completedCamps.length} hoàn thành`,
      icon: Zap,
      gradient: 'linear-gradient(135deg, #10b981, #34d399)',
      glow: '#10b981',
      delay: 120,
    },
    {
      label: 'Ngân sách đã chi (%)',
      value: budgetUsedPct,
      sub: `${fmt(totalSpent)} / ${fmt(totalBudget)} đ`,
      icon: Activity,
      gradient: budgetUsedPct >= 90
        ? 'linear-gradient(135deg, #ef4444, #f87171)'
        : 'linear-gradient(135deg, #f59e0b, #fbbf24)',
      glow: budgetUsedPct >= 90 ? '#ef4444' : '#f59e0b',
      delay: 180,
    },
  ];

  return (
    <div
      className="min-h-full space-y-6 w-full min-w-0 pb-8"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ══════════════════════════════════════
          Hero Header
      ══════════════════════════════════════ */}
      <div
        className="relative rounded-2xl overflow-hidden p-6 sm:p-8"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          boxShadow: '0 25px 50px -12px rgba(99, 102, 241, 0.25)',
        }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10 blur-3xl"
            style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }} />
          <div className="absolute -bottom-10 left-1/3 w-48 h-48 rounded-full opacity-8 blur-3xl"
            style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />
          {/* Grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Traffic68 Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {greeting}{userName ? `, ${userName.split(' ').pop()}` : ''}! 👋
            </h1>
            <p className="text-sm text-slate-400 mt-1.5">
              {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}
              <span className="text-slate-300 font-mono font-semibold tabular-nums">
                {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => navigate('/buyer/dashboard/finance/deposit')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border border-white/15 hover:border-white/30 hover:bg-white/10 text-slate-200"
            >
              <CreditCard size={15} />
              Nạp tiền
            </button>
            <button
              onClick={() => navigate('/buyer/dashboard/campaigns/create')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 text-white shadow-lg hover:shadow-indigo-500/40 hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}
            >
              <Plus size={15} />
              Tạo chiến dịch
            </button>
          </div>
        </div>

        {/* Quick stats bar */}
        <div className="relative mt-6 grid grid-cols-3 gap-3 pt-5 border-t border-white/8">
          {[
            { label: 'Campaigns', value: campaigns.length, icon: Target },
            { label: 'Đang chạy',  value: runningCamps.length, icon: Zap },
            { label: 'Hôm nay',   value: `${fmt(ov.todayViews || 0)} views`, icon: MousePointerClick, raw: true },
          ].map(({ label, value, icon: Icon, raw }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-slate-300" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-white tabular-nums">
                  {raw ? value : <AnimatedNumber value={value} />}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          KPI Cards Row
      ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* ══════════════════════════════════════
          Area Chart + Donut
      ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Area chart */}
        <div
          className="xl:col-span-2 rounded-2xl p-5 sm:p-6 border border-white/6"
          style={{ background: 'linear-gradient(135deg, #151f2e 0%, #1a2537 100%)' }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-white">Views & Chi phí</h2>
              <p className="text-xs text-slate-500 mt-0.5">7 ngày gần nhất</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                Views
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                Chi phí
              </span>
            </div>
          </div>

          {chartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="views" name="Views" stroke="#6366f1" strokeWidth={2}
                    fill="url(#gViews)" dot={false} activeDot={{ r: 5, fill: '#6366f1', stroke: '#151f2e', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="spent" name="Chi phí" stroke="#06b6d4" strokeWidth={2}
                    fill="url(#gSpent)" dot={false} activeDot={{ r: 5, fill: '#06b6d4', stroke: '#151f2e', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-slate-600">
              <BarChart2 size={36} className="mb-3 opacity-40" />
              <p className="text-sm">Chưa có dữ liệu 7 ngày qua</p>
              <p className="text-xs mt-1 opacity-60">Tạo chiến dịch đầu tiên để xem thống kê</p>
            </div>
          )}
        </div>

        {/* Donut + Campaign Status */}
        <div
          className="rounded-2xl p-5 sm:p-6 border border-white/6 flex flex-col"
          style={{ background: 'linear-gradient(135deg, #151f2e 0%, #1a2537 100%)' }}
        >
          <h2 className="text-sm font-bold text-white mb-1">Phân bổ chiến dịch</h2>
          <p className="text-xs text-slate-500 mb-4">Theo trạng thái hiện tại</p>

          {campaigns.length > 0 ? (
            <>
              <div className="flex items-center justify-center" style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={62}
                      dataKey="value" strokeWidth={0} paddingAngle={3}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: '#94a3b8' }}
                      itemStyle={{ color: '#fff', fontWeight: 700 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3 mt-2">
                {[
                  { label: 'Đang chạy',  count: runningCamps.length,   color: '#6366f1' },
                  { label: 'Tạm dừng',   count: pausedCamps.length,    color: '#f59e0b' },
                  { label: 'Hoàn thành', count: completedCamps.length, color: '#10b981' },
                ].map(({ label, count, color }) => {
                  const pct = campaigns.length > 0 ? Math.round((count / campaigns.length) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-2 text-slate-400">
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          {label}
                        </span>
                        <span className="font-bold text-white tabular-nums">{count} <span className="text-slate-500 font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
              <Target size={32} className="mb-3 opacity-40" />
              <p className="text-sm text-center">Chưa có chiến dịch</p>
              <button
                onClick={() => navigate('/buyer/dashboard/campaigns/create')}
                className="mt-3 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Tạo ngay
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          Budget breakdown + Quick actions
      ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Budget breakdown */}
        <div
          className="lg:col-span-2 rounded-2xl p-5 sm:p-6 border border-white/6 space-y-5"
          style={{ background: 'linear-gradient(135deg, #151f2e 0%, #1a2537 100%)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Ngân sách tổng</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tỷ lệ chi tiêu toàn bộ chiến dịch</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-white tabular-nums">{budgetUsedPct}</span>
              <span className="text-sm text-slate-400 font-semibold ml-0.5">%</span>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all duration-1000"
                style={{
                  width: `${budgetUsedPct}%`,
                  background: budgetUsedPct >= 90
                    ? 'linear-gradient(90deg, #ef4444, #f97316)'
                    : budgetUsedPct >= 70
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #6366f1, #06b6d4)',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Đã chi: <strong className="text-slate-300">{fmt(totalSpent)} đ</strong></span>
              <span>Tổng: <strong className="text-slate-300">{fmt(totalBudget)} đ</strong></span>
            </div>
          </div>

          {/* Per-campaign breakdown */}
          {campaigns.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-white/5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Theo chiến dịch</p>
              {campaigns.slice(0, 5).map(c => {
                const spent  = Number(c.views_done || 0) * Number(c.cpc || 0);
                const budget = Number(c.budget || 1);
                const pct    = Math.min(Math.round((spent / budget) * 100), 100);
                const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
                const effS   = isDone ? 'completed' : c.status;
                const bar    = effS === 'completed' ? '#10b981' : effS === 'running' ? '#6366f1' : '#f59e0b';
                return (
                  <div key={c.id} className="flex items-center gap-3 group cursor-pointer"
                    onClick={() => navigate('/buyer/dashboard/campaigns')}>
                    <p className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors truncate w-28 sm:w-44 shrink-0">{c.name}</p>
                    <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: bar }} />
                    </div>
                    <span className="text-xs font-bold text-slate-400 w-8 text-right shrink-0 tabular-nums">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div
          className="rounded-2xl p-5 border border-white/6 flex flex-col gap-3"
          style={{ background: 'linear-gradient(135deg, #151f2e 0%, #1a2537 100%)' }}
        >
          <div className="mb-1">
            <h2 className="text-sm font-bold text-white">Thao tác nhanh</h2>
            <p className="text-xs text-slate-500 mt-0.5">Truy cập nhanh các tính năng</p>
          </div>
          {[
            { label: 'Tạo chiến dịch',    desc: 'Bắt đầu chiến dịch traffic mới',  icon: Plus,          to: '/buyer/dashboard/campaigns/create', grad: 'linear-gradient(135deg,#6366f1,#818cf8)' },
            { label: 'Xem báo cáo',       desc: 'Phân tích chi tiết lưu lượng',    icon: TrendingUp,    to: '/buyer/dashboard/reports',          grad: 'linear-gradient(135deg,#8b5cf6,#a78bfa)' },
            { label: 'Nạp tiền ngay',     desc: 'Bổ sung ngân sách chiến dịch',    icon: CreditCard,    to: '/buyer/dashboard/finance/deposit',  grad: 'linear-gradient(135deg,#10b981,#34d399)' },
            { label: 'Quản lý chiến dịch',desc: 'Xem, sửa và theo dõi chiến dịch', icon: Target,        to: '/buyer/dashboard/campaigns',        grad: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
            { label: 'Theo dõi traffic',  desc: 'Monitor lưu lượng realtime',       icon: Globe,         to: '/buyer/dashboard/reports',          grad: 'linear-gradient(135deg,#06b6d4,#22d3ee)' },
            { label: 'Lịch sử giao dịch', desc: 'Xem tất cả giao dịch tài khoản',  icon: Timer,         to: '/buyer/dashboard/finance/transactions', grad: 'linear-gradient(135deg,#64748b,#94a3b8)' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.to)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 border border-white/5 hover:border-white/15 hover:bg-white/5 group w-full"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.grad }}>
                <a.icon size={14} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition-colors">{a.label}</p>
                <p className="text-[10px] text-slate-500 truncate">{a.desc}</p>
              </div>
              <ChevronRight size={12} className="text-slate-600 group-hover:text-slate-400 transition shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          Campaigns Table + Transactions
      ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Campaigns Table */}
        <div
          className="xl:col-span-3 rounded-2xl border border-white/6 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #151f2e 0%, #1a2537 100%)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
            <div>
              <h3 className="text-sm font-bold text-white">Chiến dịch gần đây</h3>
              <p className="text-xs text-slate-500 mt-0.5">{campaigns.length} chiến dịch</p>
            </div>
            <button onClick={() => navigate('/buyer/dashboard/campaigns')}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
              Xem tất cả <ChevronRight size={12} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chiến dịch</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trạng thái</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tiến độ</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ngân sách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {campaigns.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-14 text-center text-slate-600">
                    <Target size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Chưa có chiến dịch nào</p>
                    <button onClick={() => navigate('/buyer/dashboard/campaigns/create')}
                      className="mt-3 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                      + Tạo chiến dịch đầu tiên
                    </button>
                  </td></tr>
                ) : campaigns.slice(0, 6).map(c => {
                  const isDone   = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
                  const effStatus = isDone ? 'completed' : c.status;
                  const pct      = Number(c.total_views) > 0
                    ? Math.min(Math.round((Number(c.views_done) / Number(c.total_views)) * 100), 100)
                    : 0;
                  const barColor = effStatus === 'completed' ? '#10b981' : effStatus === 'running' ? '#6366f1' : '#f59e0b';
                  return (
                    <tr key={c.id} className="hover:bg-white/3 transition-colors cursor-pointer group"
                      onClick={() => navigate('/buyer/dashboard/campaigns')}>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-200 group-hover:text-white truncate max-w-[160px] text-[13px] transition-colors">{c.name}</p>
                        <p className="text-[10px] text-slate-600 truncate max-w-[160px] mt-0.5 font-mono">{c.url}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <CampaignBadge status={effStatus} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
                        </div>
                        <p className="text-[10px] text-slate-600 text-right mt-0.5 tabular-nums">
                          {fmt(c.views_done)}/{fmt(c.total_views)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-200 text-[13px] tabular-nums whitespace-nowrap">
                        {fmt(c.budget)} đ
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions */}
        <div
          className="xl:col-span-2 rounded-2xl border border-white/6 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #151f2e 0%, #1a2537 100%)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
            <div>
              <h3 className="text-sm font-bold text-white">Giao dịch gần đây</h3>
              <p className="text-xs text-slate-500 mt-0.5">5 giao dịch cuối</p>
            </div>
            <button onClick={() => navigate('/buyer/dashboard/finance/transactions')}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
              Xem tất cả <ChevronRight size={12} />
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-600">
              <CreditCard size={28} className="mb-2 opacity-30" />
              <p className="text-sm font-medium">Chưa có giao dịch</p>
              <button onClick={() => navigate('/buyer/dashboard/finance/deposit')}
                className="mt-3 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                Nạp tiền ngay
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/4">
              {transactions.slice(0, 6).map(t => {
                const isIn = ['deposit', 'referral', 'commission'].includes(t.type);
                const label = typeLabel[t.type] || t.type;
                const statusCfg = {
                  completed: { cls: 'text-emerald-400 bg-emerald-400/10', label: 'Thành công' },
                  pending:   { cls: 'text-amber-400 bg-amber-400/10',     label: 'Đang xử lý' },
                }[t.status] || { cls: 'text-red-400 bg-red-400/10', label: 'Từ chối' };

                return (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors">
                    <TxIcon type={t.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-200 truncate">{label}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{fmtDateTime(t.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-black tabular-nums ${isIn ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {isIn ? '+' : '-'}{fmt(t.amount)} đ
                      </p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusCfg.cls}`}>
                        {statusCfg.label}
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
