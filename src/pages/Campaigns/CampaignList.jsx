import { useState, useEffect, useMemo, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, Pencil, X, Upload, Plus, Zap, Trash2 } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

/* ── helpers ── */
const parseJsonArray = (val) => {
  if (!val) return [''];
  try { const a = JSON.parse(val); if (Array.isArray(a)) return a.length ? a : ['']; } catch {}
  return [val];
};

/* ── Edit Modal ── */
function EditCampaignModal({ campaign, onClose, onSaved }) {
  const toast = useToast();
  const [dailyViews, setDailyViews] = useState(campaign.daily_views || 500);
  const [keywords, setKeywords] = useState(() => parseJsonArray(campaign.keyword));
  const [urls, setUrls] = useState(() => {
    const main = campaign.url || '';
    const extras = parseJsonArray(campaign.url2);
    return main ? [main, ...extras.filter(u => u && u !== main)] : [''];
  });
  const [imageUrls, setImageUrls] = useState(() => {
    const imgs = parseJsonArray(campaign.image1_url);
    const img2 = campaign.image2_url;
    if (img2 && !imgs.includes(img2)) imgs.push(img2);
    return imgs.filter(Boolean).length ? imgs.filter(Boolean) : [''];
  });
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(-1);

  const addItem = (setter) => setter(prev => [...prev, '']);
  const removeItem = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (setter, idx, val) => setter(prev => prev.map((v, i) => i === idx ? val : v));

  const handleImageUpload = async (e, idx) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingIdx(idx);
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
      updateItem(setImageUrls, idx, data.imageUrl);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingIdx(-1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const kws = keywords.filter(k => k.trim());
      const u = urls.filter(u => u.trim());
      const imgs = imageUrls.filter(u => u.trim());
      await api.put(`/campaigns/${campaign.id}`, {
        dailyViews: Number(dailyViews),
        keyword: JSON.stringify(kws.length ? kws : [campaign.keyword || '']),
        url: u[0] || campaign.url,
        url2: JSON.stringify(u.slice(1)),
        image1_url: imgs.length ? JSON.stringify(imgs) : null,
        image2_url: null,
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

  const inputCls = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-slate-800">Sửa chiến dịch</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Tên chiến dịch</label>
            <p className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">{campaign.name}</p>
          </div>

          {/* Keywords */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Từ khóa</label>
            <div className="space-y-2">
              {keywords.map((kw, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={kw} onChange={e => updateItem(setKeywords, i, e.target.value)}
                    placeholder={`Từ khóa ${i + 1}`} className={inputCls} />
                  {keywords.length > 1 && (
                    <button onClick={() => removeItem(setKeywords, i)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={16} /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setKeywords)}
              className="mt-1.5 flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition">
              <Plus size={14} /> Thêm từ khóa
            </button>
          </div>

          {/* URLs */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">URL đích</label>
            <div className="space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input type="url" value={u} onChange={e => updateItem(setUrls, i, e.target.value)}
                    placeholder={i === 0 ? 'URL chính' : `URL ${i + 1}`} className={inputCls} />
                  {urls.length > 1 && (
                    <button onClick={() => removeItem(setUrls, i)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={16} /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setUrls)}
              className="mt-1.5 flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition">
              <Plus size={14} /> Thêm URL
            </button>
          </div>

          {/* Images */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Hình ảnh</label>
            <div className="space-y-3">
              {imageUrls.map((img, i) => (
                <div key={i}>
                  {img && <img src={img} alt="" className="w-full h-24 object-cover rounded-xl border border-slate-200 mb-1.5" onError={e => e.target.style.display='none'} />}
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-3 py-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition group">
                      <Upload size={14} className={`text-slate-400 group-hover:text-blue-500 ${uploadingIdx === i ? 'animate-spin' : ''}`} />
                      <span className="text-xs text-slate-500">{uploadingIdx === i ? 'Đang upload...' : img ? 'Thay ảnh' : 'Chọn ảnh'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, i)} />
                    </label>
                    {imageUrls.length > 1 && (
                      <button onClick={() => removeItem(setImageUrls, i)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setImageUrls)}
              className="mt-1.5 flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition">
              <Plus size={14} /> Thêm ảnh
            </button>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Số lượng view/ngày</label>
            <input type="number" min="1" value={dailyViews} onChange={e => setDailyViews(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ── Main component ── */

/* ── Main component ── */
export default function CampaignList() {
  usePageTitle('Quản lý chiến dịch');
  const navigate = useNavigate();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState(null);

  const fetchCampaigns = () => {
    setLoading(true);
    api.get('/campaigns').then(d => setCampaigns(d.campaigns || []))
      .catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { fetchCampaigns(); }, []);

  const filtered = useMemo(() => {
    let list = campaigns;
    if (filter !== 'all') {
      list = list.filter(c => {
        const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
        return (isDone ? 'completed' : c.status) === filter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.url || '').toLowerCase().includes(q) ||
        (c.keyword || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [campaigns, filter, search]);

  const handleToggle = async (c) => {
    const newStatus = c.status === 'running' ? 'paused' : 'running';
    try {
      await api.put(`/campaigns/${c.id}/status`, { status: newStatus });
      setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: newStatus } : x));
      toast.success(newStatus === 'running' ? 'Đã chạy lại chiến dịch' : 'Đã tạm dừng chiến dịch');
    } catch (err) { toast.error(err.message); }
  };

  const SOURCE_LABEL = { google_search: 'Google Search', social: 'Social', direct: 'Direct' };
  const FILTERS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'running', label: 'Đang chạy' },
    { key: 'paused', label: 'Tạm dừng' },
    { key: 'completed', label: 'Hoàn thành' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/buyer/dashboard' }, { label: 'Quản lý chiến dịch' }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý chiến dịch</h1>
          <p className="text-sm text-slate-500 mt-0.5">{campaigns.length} chiến dịch · Cài đặt và điều phối</p>
        </div>
        <button
          onClick={() => navigate('/buyer/dashboard/campaigns/create')}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-sm"
        >
          <Plus size={16} /> Tạo chiến dịch mới
        </button>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên, URL, từ khóa..."
          className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${filter === f.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 flex flex-col items-center gap-3">
          <Zap size={40} className="text-slate-200" />
          <p className="text-slate-400 font-medium">Không có chiến dịch nào</p>
          <button
            onClick={() => navigate('/buyer/dashboard/campaigns/create')}
            className="mt-2 px-4 py-2 text-sm font-bold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition"
          >
            Tạo chiến dịch đầu tiên
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(c => {
            const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
            const effStatus = isDone ? 'completed' : c.status;
            const pct = Number(c.total_views) > 0
              ? Math.min(Math.round(Number(c.views_done) / Number(c.total_views) * 100), 100)
              : 0;
            const badge = {
              running:   { label: 'Đang chạy',  cls: 'bg-green-100 text-green-700',    dot: 'bg-green-500' },
              paused:    { label: 'Tạm dừng',   cls: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-400' },
              completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
            }[effStatus] || { label: effStatus, cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
            const barColor = effStatus === 'completed' ? '#10b981' : effStatus === 'running' ? '#3b82f6' : '#f59e0b';

            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow flex flex-col gap-4">

                {/* Top */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 text-base leading-tight truncate">{c.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{c.url}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${badge.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} ${effStatus === 'running' ? 'animate-pulse' : ''}`} />
                    {badge.label}
                  </span>
                </div>

                {/* Config grid */}
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 font-medium mb-0.5">Nguồn traffic</p>
                    <p className="text-slate-800 font-semibold">{SOURCE_LABEL[c.traffic_type] || c.traffic_type || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 font-medium mb-0.5">Từ khóa</p>
                    <p className="text-slate-800 font-semibold truncate">{c.keyword || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 font-medium mb-0.5">CPC</p>
                    <p className="text-slate-800 font-semibold">{fmt(c.cpc)} đ</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 font-medium mb-0.5">View/ngày</p>
                    <p className="text-slate-800 font-semibold">{fmt(c.daily_views)}</p>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Tiến độ</span>
                    <span className="font-bold text-slate-700">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Ngân sách: {fmt(c.budget)} đ</span>
                    <span>Tạo: {c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span>
                  </div>
                </div>

                {/* Actions */}
                {effStatus !== 'completed' && (
                  <div className="flex gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => setEditingCampaign(c)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                    >
                      <Pencil size={13} /> Chỉnh sửa
                    </button>
                    <button
                      onClick={() => handleToggle(c)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition ${
                        c.status === 'running'
                          ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                          : 'text-green-700 bg-green-50 hover:bg-green-100'
                      }`}
                    >
                      {c.status === 'running'
                        ? <><Pause size={13} /> Tạm dừng</>
                        : <><Play size={13} /> Chạy lại</>}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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