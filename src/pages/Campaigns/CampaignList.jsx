import { useState, useEffect, useMemo, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, Trash2, Pencil, X, Upload, MoreVertical, CheckCircle2 } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

/* ── Edit Modal ── */
function EditCampaignModal({ campaign, onClose, onSaved }) {
  const toast = useToast();
  const fileRef = useRef();
  const [dailyViews, setDailyViews] = useState(campaign.daily_views || 500);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(campaign.image1_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/campaigns/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      setImageFile(file);
      setImageUrl(data.imageUrl);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/campaigns/${campaign.id}`, {
        dailyViews: Number(dailyViews),
        image1_url: imageUrl || null,
      });
      toast.success('Cập nhật chiến dịch thành công');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Sửa chiến dịch</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Campaign name (readonly) */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Tên chiến dịch</label>
            <p className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">{campaign.name}</p>
          </div>

          {/* Daily views (editable) */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Số lượng view/ngày</label>
            <input
              type="number"
              min="1"
              value={dailyViews}
              onChange={e => setDailyViews(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                         shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Image upload (editable) */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Hình ảnh</label>
            {imageUrl && (
              <div className="mb-2 relative group">
                <img src={imageUrl} alt="Campaign" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                <button
                  onClick={() => { setImageUrl(''); setImageFile(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div
              onClick={() => fileRef.current.click()}
              className="flex items-center gap-3 border border-dashed border-slate-300 rounded-xl
                         px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition group"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center">
                <Upload size={16} className={`text-slate-400 group-hover:text-blue-500 transition ${uploading ? 'animate-spin' : ''}`} />
              </div>
              <span className="text-sm text-slate-500">
                {imageFile ? imageFile.name : uploading ? 'Đang upload...' : 'Chọn ảnh mới'}
              </span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignList() {
  usePageTitle('Quản lý chiến dịch');
  const navigate = useNavigate();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!actionMenuId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setActionMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actionMenuId]);

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
    const newStatus = currentStatus === 'force_complete' ? 'completed' : currentStatus === 'running' ? 'paused' : 'running';
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
                      <div className="relative" ref={actionMenuId === c.id ? menuRef : null}>
                        <button
                          onClick={() => setActionMenuId(actionMenuId === c.id ? null : c.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-500" />
                        </button>
                        {actionMenuId === c.id && (
                          <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                            <button
                              onClick={() => { setEditingCampaign(c); setActionMenuId(null); }}
                              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                            >
                              <Pencil size={14} className="text-blue-500" /> Chỉnh sửa
                            </button>
                            <button
                              onClick={() => { handleToggleStatus(c.id, c.status); setActionMenuId(null); }}
                              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                            >
                              {c.status === 'running'
                                ? <><Pause size={14} className="text-amber-500" /> Tạm dừng</>
                                : <><Play size={14} className="text-green-500" /> Chạy lại</>}
                            </button>
                            <button
                              onClick={() => { handleToggleStatus(c.id, 'force_complete'); setActionMenuId(null); }}
                              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                            >
                              <CheckCircle2 size={14} className="text-indigo-500" /> Hoàn thành
                            </button>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => { handleDelete(c.id); setActionMenuId(null); }}
                              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                            >
                              <Trash2 size={14} /> Xóa
                            </button>
                          </div>
                        )}
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

      {/* Edit Modal */}
      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onSaved={fetchCampaigns}
        />
      )}
    </div>
  );
}