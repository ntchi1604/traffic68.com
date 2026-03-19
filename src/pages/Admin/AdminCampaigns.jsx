import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, Play, Pause, CheckCircle, ExternalLink } from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => (n || 0).toLocaleString('vi-VN');

const STATUS_MAP = {
  running:   { label: 'Đang chạy', cls: 'bg-green-100 text-green-700' },
  paused:    { label: 'Tạm dừng',  cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Hoàn thành', cls: 'bg-blue-100 text-blue-700' },
};

export default function AdminCampaigns() {
  usePageTitle('Admin - Chiến dịch');
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = () => {
    setLoading(true);
    api.get(`/admin/campaigns?search=${search}&status=${statusFilter}&limit=50`)
      .then(data => setCampaigns(data.campaigns || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCampaigns(); }, [statusFilter]);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/admin/campaigns/${id}`, { status });
      fetchCampaigns();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Quản lý chiến dịch</h1>
        <p className="text-sm text-slate-500 mt-1">Tất cả chiến dịch trên hệ thống</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <form onSubmit={e => { e.preventDefault(); fetchCampaigns(); }} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm chiến dịch, URL, email..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition">Tìm</button>
        </form>
        <div className="flex gap-2">
          {['all', 'running', 'paused', 'completed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition ${statusFilter === s
                ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {s === 'all' ? 'Tất cả' : STATUS_MAP[s]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Chiến dịch</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Chủ sở hữu</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Ngân sách</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Views</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Trạng thái</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Ngày tạo</th>
              <th className="px-5 py-3 text-center font-semibold text-slate-500">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">Không có chiến dịch nào</td></tr>
            ) : campaigns.map(c => {
              const st = STATUS_MAP[c.status] || { label: c.status, cls: 'bg-gray-100 text-gray-700' };
              return (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-800">{c.name}</p>
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      {c.url?.slice(0, 40)} <ExternalLink size={10} />
                    </a>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-slate-700 font-medium">{c.user_name || '—'}</p>
                    <p className="text-xs text-slate-400">{c.user_email}</p>
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-700">{fmt(c.budget)} đ</td>
                  <td className="px-5 py-3 text-slate-600">{fmt(c.views_done)}/{fmt(c.total_views)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{new Date(c.created_at).toLocaleString('vi-VN')}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {c.status !== 'running' && (
                        <button onClick={() => updateStatus(c.id, 'running')} title="Chạy"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition">
                          <Play size={15} />
                        </button>
                      )}
                      {c.status === 'running' && (
                        <button onClick={() => updateStatus(c.id, 'paused')} title="Tạm dừng"
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition">
                          <Pause size={15} />
                        </button>
                      )}
                      <button onClick={() => updateStatus(c.id, 'completed')} title="Hoàn thành"
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition">
                        <CheckCircle size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
