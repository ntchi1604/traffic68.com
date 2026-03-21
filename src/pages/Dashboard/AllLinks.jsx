import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { Link2, Eye, TrendingUp, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

function StatusBadge({ status }) {
  const map = {
    completed: { label: 'Hoàn thành', cls: 'bg-emerald-50 text-emerald-600' },
    pending: { label: 'Đang chờ', cls: 'bg-amber-50 text-amber-600' },
    expired: { label: 'Hết hạn', cls: 'bg-slate-100 text-slate-500' },
    failed: { label: 'Thất bại', cls: 'bg-red-50 text-red-500' },
  };
  const c = map[status] || map.pending;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.cls}`}>{c.label}</span>;
}

export default function AllLinks() {
  usePageTitle('Tất cả nhiệm vụ');
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const limit = 20;

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, status: filter });
      const d = await api.get(`/vuot-link/worker/tasks?${params}`);
      setTasks(d.tasks || []);
      setTotal(d.total || 0);
      setStats(d.stats || {});
    } catch { }
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Tất cả nhiệm vụ' }]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tất cả nhiệm vụ</h1>
        <p className="text-slate-500 text-sm mt-1">Quản lý tất cả nhiệm vụ vượt link của bạn</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Link2 size={20} className="text-blue-600" /></div>
          <div><p className="text-xs text-slate-400 font-medium">Tổng nhiệm vụ</p><p className="text-xl font-black text-slate-900">{fmt(stats.total)}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><Eye size={20} className="text-green-600" /></div>
          <div><p className="text-xs text-slate-400 font-medium">Đã hoàn thành</p><p className="text-xl font-black text-slate-900">{fmt(stats.completed)}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><TrendingUp size={20} className="text-orange-600" /></div>
          <div><p className="text-xs text-slate-400 font-medium">Tổng thu nhập</p><p className="text-xl font-black text-slate-900">{fmt(stats.totalEarnings)} đ</p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex gap-2">
            {[['all', 'Tất cả'], ['completed', 'Hoàn thành'], ['pending', 'Đang chờ'], ['expired', 'Hết hạn']].map(([val, label]) => (
              <button key={val} onClick={() => { setFilter(val); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filter === val ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-3 font-medium text-xs uppercase tracking-wider">Chiến dịch</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider">Từ khóa</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Trạng thái</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">Thu nhập</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Đang tải...</td></tr>
              ) : tasks.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Không có nhiệm vụ nào</td></tr>
              ) : tasks.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 pr-4 max-w-[200px]">
                    <p className="text-slate-700 font-medium text-xs truncate">{t.campaign_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{t.campaign_url}</p>
                  </td>
                  <td className="py-3 text-xs text-slate-600">{t.keyword || '—'}</td>
                  <td className="py-3 text-center"><StatusBadge status={t.status} /></td>
                  <td className="py-3 text-right font-bold text-green-600 text-xs">{fmt(t.earning)} đ</td>
                  <td className="py-3 text-right text-slate-400 text-xs">
                    {t.completed_at ? new Date(t.completed_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : new Date(t.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">Trang {page}/{totalPages} ({fmt(total)} nhiệm vụ)</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
