import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Users, Megaphone, Play, Wallet, Clock, LifeBuoy, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../lib/api';
import { formatMoney as fmt } from '../../lib/format';

const localDate = (d = new Date()) => d.toLocaleDateString('en-CA');
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };

const PRESETS = [
  { label: 'Hom nay', getRange: () => ({ from: localDate(), to: localDate() }) },
  { label: '7 ngay',  getRange: () => ({ from: daysAgo(6),  to: localDate() }) },
  { label: '30 ngay', getRange: () => ({ from: daysAgo(29), to: localDate() }) },
  { label: 'Tat ca',  getRange: () => ({ from: '', to: '' }) },
];

export default function AgencyAdminDashboard() {
  usePageTitle('Agency Admin - Tong quan');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    api.get(`/agency-admin/overview?${params}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [fromDate, toDate]);

  const applyPreset = (p) => { const r = p.getRange(); setFromDate(r.from); setToDate(r.to); };

  const o = data?.overview || {};
  const chart = data?.dailyStats || [];

  const stats = [
    { label: 'Tong Buyer',         value: fmt(o.totalBuyers),       icon: Users,     color: '#6366f1', bg: '#eef2ff', border: '#e0e7ff' },
    { label: 'Tong chien dich',    value: fmt(o.totalCampaigns),    icon: Megaphone, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
    { label: 'Dang chay',          value: fmt(o.runningCampaigns),  icon: Play,      color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
    { label: 'Tong nap',           value: `${fmt(o.totalDeposits)} d`, icon: Wallet, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
    { label: 'Cho duyet nap',      value: fmt(o.pendingDeposits),   icon: Clock,     color: '#ef4444', bg: '#fef2f2', border: '#fecaca', badge: o.pendingDeposits > 0 },
    { label: 'Ticket mo',          value: fmt(o.openTickets),       icon: LifeBuoy,  color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3' },
  ];

  return (
    <div className="space-y-5">
      {/* Date filter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tu ngay</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
            </div>
            <span className="text-slate-300 mt-5">&rarr;</span>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Den ngay</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
            </div>
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  fromDate === p.getRange().from && toDate === p.getRange().to
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white rounded-2xl border p-4 hover:shadow-md transition-all duration-200" style={{ borderColor: s.border }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                      <Icon size={15} style={{ color: s.color }} />
                    </div>
                  </div>
                  <p className="text-xl font-black text-slate-900 tabular-nums leading-none">{s.value}</p>
                  {s.badge && (
                    <span className="inline-flex items-center mt-2 px-2 py-0.5 text-[9px] font-bold bg-red-100 text-red-600 rounded-full animate-pulse">
                      Cho duyet
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Area chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Bieu do giao dich theo ngay</h3>
            <div className="h-64">
              {chart.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <div className="text-center">
                    <Calendar size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-semibold">Khong co du lieu trong khoang thoi gian nay</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="fillAgency" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v?.slice(5)} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                    <Tooltip formatter={(v) => `${fmt(v)} d`} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Area type="monotone" dataKey="total" name="Tong GD" stroke="#6366f1" fill="url(#fillAgency)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
