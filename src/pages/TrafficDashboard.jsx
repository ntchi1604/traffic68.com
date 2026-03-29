import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Plus, TrendingUp, Zap, CreditCard, ArrowUpRight, ArrowDownLeft,
  BarChart2, CheckCircle2, Clock, ChevronRight, PauseCircle,
  Activity, Target, RefreshCw,
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { formatMoney as fmt, fmtDateTime } from '../lib/format';
import api from '../lib/api';

/* ── Status Badge ── */
function CampaignBadge({ status }) {
  const map = {
    running:   { label: 'Đang chạy',  cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
    paused:    { label: 'Tạm dừng',   cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',   dot: 'bg-amber-400'   },
    completed: { label: 'Hoàn thành', cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',  dot: 'bg-slate-400'   },
    draft:     { label: 'Bản nháp',   cls: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200',      dot: 'bg-blue-400'    },
  };
  const cfg = map[status] || map.paused;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/* ── Stat Card ── */
function StatCard({ label, value, sub, icon: Icon, accent, trend }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <TrendingUp size={12} />
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}

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
    <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
      <RefreshCw size={20} className="animate-spin" />
      <span className="text-sm font-medium">Đang tải dữ liệu...</span>
    </div>
  );

  const ov = overview || {};
  const totalBudget  = campaigns.reduce((s, c) => s + Number(c.budget || 0), 0);
  const totalSpent   = campaigns.reduce((s, c) => s + Number(c.views_done || 0) * Number(c.cpc || 0), 0);
  const budgetUsedPct = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;

  const runningCamps   = campaigns.filter(c => c.status === 'running');
  const completedCamps = campaigns.filter(c => {
    const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
    return isDone || c.status === 'completed';
  });
  const pausedCamps = campaigns.filter(c => {
    const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
    return !isDone && c.status === 'paused';
  });

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/buyer/dashboard' }, { label: 'Tổng quan' }]} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tổng quan</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý chiến dịch và theo dõi ngân sách</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/buyer/dashboard/finance/deposit')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-50 hover:shadow-sm transition-all"
          >
            <CreditCard size={15} /> Nạp tiền
          </button>
          <button
            onClick={() => navigate('/buyer/dashboard/campaigns/create')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 transition-all"
          >
            <Plus size={15} /> Tạo chiến dịch
          </button>
        </div>
      </div>

      {/* ── Balance + Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Balance Card - spans full or featured */}
        <div className="sm:col-span-2 xl:col-span-2 bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Số dư khả dụng</p>
              <p className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                {fmt(ov.mainBalance || 0)}
                <span className="text-xl text-slate-400 font-bold ml-1">đ</span>
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Tổng chi tiêu: <span className="font-bold text-slate-700">{fmt(ov.totalSpent || 0)} đ</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Wallet size={22} className="text-white" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100">
            <button onClick={() => navigate('/buyer/dashboard/finance/deposit')}
              className="flex-1 py-2.5 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5">
              <CreditCard size={14} /> Nạp tiền
            </button>
            <button onClick={() => navigate('/buyer/dashboard/finance/history')}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5">
              <Activity size={14} /> Lịch sử
            </button>
          </div>
        </div>

        <StatCard
          label="Tổng chiến dịch"
          value={campaigns.length}
          sub={`${runningCamps.length} đang chạy`}
          icon={BarChart2}
          accent="bg-blue-500"
        />
        <StatCard
          label="Hoàn thành"
          value={completedCamps.length}
          sub={`${pausedCamps.length} tạm dừng`}
          icon={CheckCircle2}
          accent="bg-emerald-500"
        />
      </div>

      {/* ── Budget Overview + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Budget */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Ngân sách tổng quan</h2>
              <p className="text-sm text-slate-400 mt-0.5">Tỷ lệ chi tiêu trên tất cả chiến dịch</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-slate-900">{budgetUsedPct}<span className="text-base text-slate-400 font-semibold">%</span></p>
              <p className="text-xs text-slate-400">đã sử dụng</p>
            </div>
          </div>

          {/* Total progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${budgetUsedPct}%`,
                background: budgetUsedPct >= 90 ? '#ef4444' : budgetUsedPct >= 70 ? '#f59e0b' : '#6366f1',
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-5">
            <span>Đã chi: <span className="font-bold text-slate-700">{fmt(totalSpent)} đ</span></span>
            <span>Tổng ngân sách: <span className="font-bold text-slate-700">{fmt(totalBudget)} đ</span></span>
          </div>

          {/* Per-campaign breakdown */}
          {campaigns.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Theo chiến dịch</p>
              {campaigns.slice(0, 5).map(c => {
                const spent = Number(c.views_done || 0) * Number(c.cpc || 0);
                const budget = Number(c.budget || 1);
                const pct = Math.min(Math.round((spent / budget) * 100), 100);
                const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
                const effStatus = isDone ? 'completed' : c.status;
                const barColor = effStatus === 'completed' ? '#10b981' : effStatus === 'running' ? '#6366f1' : '#f59e0b';
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <p className="text-xs font-medium text-slate-700 truncate w-32 sm:w-44 shrink-0">{c.name}</p>
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                    <span className="text-xs font-bold text-slate-500 w-9 text-right shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thao tác nhanh</p>
          {[
            { label: 'Tạo chiến dịch mới', desc: 'Bắt đầu chiến dịch traffic', icon: Plus, to: '/buyer/dashboard/campaigns/create', accent: 'bg-indigo-600' },
            { label: 'Xem báo cáo', desc: 'Phân tích chi tiết lưu lượng', icon: TrendingUp, to: '/buyer/dashboard/reports', accent: 'bg-violet-600' },
            { label: 'Nạp tiền vào ví', desc: 'Bổ sung ngân sách chiến dịch', icon: CreditCard, to: '/buyer/dashboard/finance/deposit', accent: 'bg-emerald-600' },
            { label: 'Quản lý chiến dịch', desc: 'Xem và chỉnh sửa chiến dịch', icon: Target, to: '/buyer/dashboard/campaigns', accent: 'bg-amber-500' },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 hover:shadow-md hover:border-slate-300 transition-all text-left group w-full"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${a.accent}`}>
                <a.icon size={16} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{a.label}</p>
                <p className="text-xs text-slate-400 truncate">{a.desc}</p>
              </div>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Campaign Status Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng chiến dịch', value: campaigns.length, icon: BarChart2, cls: 'text-slate-600 bg-slate-100' },
          { label: 'Đang chạy',       value: runningCamps.length,   icon: Zap,         cls: 'text-emerald-600 bg-emerald-50' },
          { label: 'Tạm dừng',        value: pausedCamps.length,    icon: PauseCircle, cls: 'text-amber-600 bg-amber-50' },
          { label: 'Hoàn thành',      value: completedCamps.length, icon: CheckCircle2, cls: 'text-blue-600 bg-blue-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 hover:shadow-sm transition">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${k.cls}`}>
              <k.icon size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{k.label}</p>
              <p className="text-xl font-black text-slate-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Recent Campaigns Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Chiến dịch gần đây</h3>
          <button
            onClick={() => navigate('/buyer/dashboard/campaigns')}
            className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 flex items-center gap-1 transition-colors"
          >
            Xem tất cả <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Chiến dịch</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tiến độ</th>
                <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ngân sách</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {campaigns.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">
                  <Target size={32} className="mx-auto mb-2 opacity-20" />
                  Chưa có chiến dịch nào
                </td></tr>
              ) : campaigns.slice(0, 5).map(c => {
                const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
                const effStatus = isDone ? 'completed' : c.status;
                const pct = Number(c.total_views) > 0
                  ? Math.min(Math.round((Number(c.views_done) / Number(c.total_views)) * 100), 100)
                  : 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800 truncate max-w-[200px]">{c.name}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[200px] mt-0.5">{c.url}</p>
                    </td>
                    <td className="px-6 py-4">
                      <CampaignBadge status={effStatus} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: effStatus === 'completed' ? '#10b981' : effStatus === 'running' ? '#6366f1' : '#f59e0b',
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600 w-10 text-right">
                          {fmt(c.views_done)}<span className="text-slate-400 font-normal">/{fmt(c.total_views)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800">{fmt(c.budget)} đ</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Giao dịch gần đây</h3>
            <button
              onClick={() => navigate('/buyer/dashboard/finance/history')}
              className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 flex items-center gap-1 transition-colors"
            >
              Xem tất cả <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {transactions.slice(0, 6).map(t => {
              const isIn = ['deposit', 'referral', 'commission'].includes(t.type);
              const typeLabel = {
                deposit: 'Nạp tiền',
                withdraw: 'Rút tiền',
                campaign_charge: 'Chi phí chiến dịch',
                commission: 'Hoa hồng',
                referral: 'Giới thiệu',
              }[t.type] || t.type;
              const statusCfg = {
                completed: { cls: 'text-emerald-600', label: 'Thành công' },
                pending:   { cls: 'text-amber-500', label: 'Đang xử lý' },
              }[t.status] || { cls: 'text-red-500', label: 'Từ chối' };

              return (
                <div key={t.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isIn ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {isIn
                        ? <ArrowDownLeft size={16} className="text-emerald-600" />
                        : <ArrowUpRight size={16} className="text-red-500" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{typeLabel}</p>
                      <p className="text-xs text-slate-400">{fmtDateTime(t.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isIn ? '+' : '-'}{fmt(t.amount)} đ
                    </p>
                    <p className={`text-xs font-medium ${statusCfg.cls}`}>{statusCfg.label}</p>
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
