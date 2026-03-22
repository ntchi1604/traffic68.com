import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Plus, TrendingUp, Zap, CreditCard, ArrowUpRight,
  BarChart2, CheckCircle2, Clock, AlertCircle, ChevronRight,
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { formatMoney as fmt, fmtDateTime } from '../lib/format';
import api from '../lib/api';

export default function TrafficDashboard() {
  usePageTitle('Tổng quan');
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/overview'),
      api.get('/campaigns'),
      api.get('/finance/transactions?limit=6').catch(() => ({ transactions: [] })),
    ]).then(([ov, cp, tx]) => {
      setOverview(ov.overview);
      setCampaigns(cp.campaigns || []);
      setTransactions(tx.transactions || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const ov = overview || {};
  const totalBudget  = campaigns.reduce((s, c) => s + Number(c.budget || 0), 0);
  const totalSpent   = campaigns.reduce((s, c) => s + Number(c.views_done || 0) * Number(c.cpc || 0), 0);
  const budgetUsedPct = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;

  const runningCamps  = campaigns.filter(c => c.status === 'running');
  const completedCamps = campaigns.filter(c => {
    const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
    return isDone || c.status === 'completed';
  });
  const pausedCamps  = campaigns.filter(c => {
    const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
    return !isDone && c.status === 'paused';
  });

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/buyer/dashboard' }, { label: 'Tổng quan' }]} />

      {/* Welcome + Balance Hero */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 50%)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1">Số dư khả dụng</p>
            <p className="text-4xl font-black tracking-tight">{fmt(ov.mainBalance || 0)} <span className="text-blue-300 text-2xl">đ</span></p>
            <p className="text-blue-200 text-xs mt-2">Tổng chi tiêu: <span className="text-white font-bold">{fmt(ov.totalSpent || 0)} đ</span></p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/buyer/dashboard/finance/deposit')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-700 font-bold text-sm rounded-xl hover:bg-blue-50 transition"
            >
              <CreditCard size={16} /> Nạp tiền
            </button>
            <button
              onClick={() => navigate('/buyer/dashboard/campaigns/create')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/40 border border-blue-400/50 text-white font-bold text-sm rounded-xl hover:bg-blue-500/60 transition"
            >
              <Plus size={16} /> Tạo chiến dịch
            </button>
          </div>
        </div>
      </div>

      {/* Campaign Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tổng chiến dịch', value: campaigns.length, icon: BarChart2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Đang chạy', value: runningCamps.length, icon: Zap, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'Tạm dừng', value: pausedCamps.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Hoàn thành', value: completedCamps.length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-2xl border ${k.border} p-5 flex items-center gap-4 hover:shadow-sm transition`}>
            <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
              <k.icon size={18} className={k.color} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">{k.label}</p>
              <p className="text-2xl font-black text-slate-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Budget Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Ngân sách tổng</h2>
            <p className="text-sm text-slate-500 mt-0.5">Tỷ lệ chi tiêu trên toàn bộ chiến dịch</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-slate-900">{budgetUsedPct}%</p>
            <p className="text-xs text-slate-400">đã sử dụng</p>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{
              width: `${budgetUsedPct}%`,
              background: budgetUsedPct >= 90 ? '#ef4444' : budgetUsedPct >= 70 ? '#f59e0b' : '#3b82f6',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Đã chi: <span className="font-bold text-slate-800">{fmt(totalSpent)} đ</span></span>
          <span className="text-slate-500">Tổng ngân sách: <span className="font-bold text-slate-800">{fmt(totalBudget)} đ</span></span>
        </div>

        {/* Per-campaign budget breakdown */}
        {campaigns.length > 0 && (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Theo chiến dịch</p>
            {campaigns.slice(0, 5).map(c => {
              const spent = Number(c.views_done || 0) * Number(c.cpc || 0);
              const budget = Number(c.budget || 1);
              const pct = Math.min(Math.round((spent / budget) * 100), 100);
              const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
              const effStatus = isDone ? 'completed' : c.status;
              const barColor = effStatus === 'completed' ? '#10b981' : effStatus === 'running' ? '#3b82f6' : '#f59e0b';
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="min-w-0 w-32 sm:w-40">
                    <p className="text-xs font-medium text-slate-700 truncate">{c.name}</p>
                  </div>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 flex-shrink-0 w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Tạo chiến dịch mới', desc: 'Bắt đầu chiến dịch traffic mới', icon: Plus, color: '#3b82f6', bg: '#eff6ff', to: '/buyer/dashboard/campaigns/create' },
          { label: 'Xem báo cáo traffic', desc: 'Phân tích chi tiết lưu lượng', icon: TrendingUp, color: '#8b5cf6', bg: '#f5f3ff', to: '/buyer/dashboard/reports' },
          { label: 'Nạp tiền vào ví', desc: 'Bổ sung ngân sách chiến dịch', icon: CreditCard, color: '#10b981', bg: '#ecfdf5', to: '/buyer/dashboard/finance/deposit' },
        ].map(a => (
          <button
            key={a.label}
            onClick={() => navigate(a.to)}
            className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md hover:border-slate-300 transition text-left group w-full"
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.bg }}>
              <a.icon size={20} style={{ color: a.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{a.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{a.desc}</p>
            </div>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Recent Campaigns (management focus) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Chiến dịch gần đây</h3>
          <button onClick={() => navigate('/buyer/dashboard/campaigns')} className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
            Xem tất cả <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Chiến dịch</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Views</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Ngân sách</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {campaigns.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-sm">Chưa có chiến dịch nào</td></tr>
              ) : campaigns.slice(0, 5).map(c => {
                const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
                const effStatus = isDone ? 'completed' : c.status;
                const badge = {
                  running:   'bg-green-100 text-green-700',
                  paused:    'bg-amber-100 text-amber-700',
                  completed: 'bg-emerald-100 text-emerald-700',
                }[effStatus] || 'bg-slate-100 text-slate-600';
                const label = { running: 'Đang chạy', paused: 'Tạm dừng', completed: 'Hoàn thành' }[effStatus] || effStatus;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800 truncate max-w-[200px]">{c.name}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[200px]">{c.url}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${badge}`}>{label}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-700 font-medium">
                      {fmt(c.views_done)}<span className="text-slate-400 text-xs">/{fmt(c.total_views)}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-800">{fmt(c.budget)} đ</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Giao dịch gần đây</h3>
            <button onClick={() => navigate('/buyer/dashboard/finance/history')} className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
              Xem tất cả <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {transactions.slice(0, 6).map(t => {
              const isIn  = ['deposit', 'referral', 'commission'].includes(t.type);
              const typeLabel = { deposit: 'Nạp tiền', withdraw: 'Rút tiền', campaign_charge: 'Chi phí campaign', commission: 'Hoa hồng', referral: 'Giới thiệu' }[t.type] || t.type;
              const statusColor = t.status === 'completed' ? 'text-emerald-600' : t.status === 'pending' ? 'text-amber-600' : 'text-red-500';
              return (
                <div key={t.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isIn ? 'bg-green-100' : 'bg-red-50'}`}>
                      <ArrowUpRight size={14} className={isIn ? 'text-green-600 rotate-180' : 'text-red-500'} style={{ transform: isIn ? 'rotate(180deg)' : 'none' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{typeLabel}</p>
                      <p className="text-xs text-slate-400">{fmtDateTime(t.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${isIn ? 'text-green-600' : 'text-red-500'}`}>
                      {isIn ? '+' : '-'}{fmt(t.amount)} đ
                    </p>
                    <p className={`text-xs font-medium ${statusColor}`}>
                      {t.status === 'completed' ? 'Thành công' : t.status === 'pending' ? 'Đang xử lý' : 'Từ chối'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
