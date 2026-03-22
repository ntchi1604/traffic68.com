import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
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

export default function AdminWorkerTasks() {
  usePageTitle('Admin - Nhiệm vụ');
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const limit = 30;

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, search, status });
      const d = await api.get(`/admin/worker-tasks?${params}`);
      setTasks(d.tasks || []);
      setTotal(d.total || 0);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [page, status]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchTasks(); };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Nhiệm vụ</h1>
        <p className="text-sm text-slate-500 mt-1">{fmt(total)} nhiệm vụ</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm worker, chiến dịch..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition">Tìm</button>
        </form>
        <div className="flex gap-2">
          {[['all', 'Tất cả'], ['completed', 'Hoàn thành'], ['pending', 'Đang chờ'], ['expired', 'Hết hạn']].map(([v, l]) => (
            <button key={v} onClick={() => { setStatus(v); setPage(1); }}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition ${status === v ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">ID</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">Worker</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">Từ khóa / Chiến dịch</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">URL</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-500">Trạng thái</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Thu nhập</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Không có nhiệm vụ</td></tr>
              ) : tasks.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-slate-400 text-xs">#{t.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 text-xs">{t.worker_name || '—'}</p>
                    <p className="text-[10px] text-slate-400">{t.worker_email || ''}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="text-xs text-slate-800 font-bold truncate">{t.keyword || '—'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{t.campaign_name}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{t.campaign_url || '—'}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-right font-bold text-green-600 text-xs">{fmt(t.earning)} đ</td>
                  <td className="px-4 py-3 text-right text-slate-400 text-xs">
                    {t.completed_at ? new Date(t.completed_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) :
                    new Date(t.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Trang {page}/{totalPages}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition"><ChevronLeft size={16} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
