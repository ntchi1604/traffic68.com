import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { EyeOff, Search } from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

export default function HiddenLinks() {
  usePageTitle('Liên kết ẩn');
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/vuot-link/worker/tasks?status=expired')
      .then(d => { setTasks(d.tasks || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = tasks.filter(t =>
    (t.campaign_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.keyword || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Liên kết ẩn' }]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Liên kết ẩn</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <EyeOff size={48} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 font-medium">Không có liên kết ẩn</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-3 font-medium text-xs uppercase tracking-wider">Chiến dịch</th>
                  <th className="py-3 font-medium text-xs uppercase tracking-wider">Từ khóa</th>
                  <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">Thu nhập</th>
                  <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 pr-4 max-w-[200px]">
                      <span className="text-slate-500 truncate text-xs block">{t.campaign_name}</span>
                    </td>
                    <td className="py-3 text-xs text-slate-400">{t.keyword || '—'}</td>
                    <td className="py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">Hết hạn</span>
                    </td>
                    <td className="py-3 text-right font-bold text-slate-400 text-xs">{fmt(t.earning)} đ</td>
                    <td className="py-3 text-right text-slate-400 text-xs">
                      {new Date(t.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
