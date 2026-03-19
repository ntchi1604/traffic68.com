import { useState, useEffect, useMemo } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { Eye, Pause, Play, Edit, Trash2 } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

export default function CampaignList() {
  usePageTitle('Quản lý chiến dịch');
  const navigate = useNavigate();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = () => {
    setLoading(true);
    api.get('/campaigns').then((data) => {
      setCampaigns(data.campaigns || []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const filteredCampaigns = useMemo(() => {
    let list = campaigns;
    if (filter !== 'all') {
      list = list.filter(c => c.status === filter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.url.toLowerCase().includes(q));
    }
    return list;
  }, [campaigns, filter, search]);

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'running' ? 'paused' : 'running';
    try {
      await api.put(`/campaigns/${id}/status`, { status: newStatus });
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chiến dịch này?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (err) { toast.error(err.message); }
  };



  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Chiến dịch', to: '/dashboard/campaigns' },
        { label: 'Quản lý chiến dịch' },
      ]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Quản lý chiến dịch</h1>
        <button
          onClick={() => navigate('/dashboard/campaigns/create')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Tạo chiến dịch mới
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm chiến dịch..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Tất cả', color: 'blue' },
            { key: 'running', label: 'Đang chạy', color: 'green' },
            { key: 'paused', label: 'Tạm dừng', color: 'amber' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                filter === key ? `bg-${color}-600 text-white` : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tên chiến dịch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">URL đích</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ngân sách</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">CPC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Views</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-sm text-slate-500">
                    Không có chiến dịch nào
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{c.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600 truncate max-w-xs">{c.url}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{fmt(c.budget)} ₫</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{fmt(c.cpc)} ₫</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{fmt(c.views_done)}/{fmt(c.total_views)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        c.status === 'running' ? 'bg-green-100 text-green-800' :
                        c.status === 'paused' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {c.status === 'running' ? 'Đang chạy' : c.status === 'paused' ? 'Tạm dừng' : 'Hoàn tất'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(c.id, c.status)}
                          className={`p-1 rounded-full ${
                            c.status === 'running'
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={c.status === 'running' ? 'Tạm dừng' : 'Chạy lại'}
                        >
                          {c.status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}