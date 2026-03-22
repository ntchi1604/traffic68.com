import { useState, useEffect, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, Play, Pause, CheckCircle, ExternalLink, MoreVertical, Pencil, X, Plus, Trash2, Upload } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const STATUS_MAP = {
  running: { label: 'Đang chạy', cls: 'bg-green-100 text-green-700' },
  paused: { label: 'Tạm dừng', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Hoàn thành', cls: 'bg-blue-100 text-blue-700' },
};

const parseJsonArray = (val) => {
  if (!val) return [''];
  try { const a = JSON.parse(val); if (Array.isArray(a)) return a.length ? a : ['']; } catch {}
  return [val];
};

/* ── Edit Modal ── */
function EditCampaignModal({ campaign, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(campaign.name || '');
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
      await api.put(`/admin/campaigns/${campaign.id}`, {
        name,
        keyword: JSON.stringify(kws.length ? kws : [campaign.keyword || '']),
        url: u[0] || campaign.url,
        url2: JSON.stringify(u.slice(1)),
        dailyViews: Number(dailyViews),
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
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={18} className="text-slate-500" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Tên chiến dịch</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>

          {/* Keywords */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Từ khóa</label>
            <div className="space-y-2">
              {keywords.map((kw, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={kw} onChange={e => updateItem(setKeywords, i, e.target.value)} placeholder={`Từ khóa ${i+1}`} className={inputCls} />
                  {keywords.length > 1 && <button onClick={() => removeItem(setKeywords, i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={16} /></button>}
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setKeywords)} className="mt-1.5 flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition"><Plus size={14} /> Thêm</button>
          </div>

          {/* URLs */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">URL đích</label>
            <div className="space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input type="url" value={u} onChange={e => updateItem(setUrls, i, e.target.value)} placeholder={i === 0 ? 'URL chính' : `URL ${i+1}`} className={inputCls} />
                  {urls.length > 1 && <button onClick={() => removeItem(setUrls, i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={16} /></button>}
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setUrls)} className="mt-1.5 flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition"><Plus size={14} /> Thêm</button>
          </div>

          {/* Images */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Hình ảnh</label>
            <div className="space-y-3">
              {imageUrls.map((img, i) => (
                <div key={i}>
                  {img && <img src={img} alt="" className="w-full h-28 object-cover rounded-xl border border-slate-200 mb-1.5" onError={e => e.target.style.display='none'} />}
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-3 py-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition group">
                      <Upload size={14} className={`text-slate-400 group-hover:text-blue-500 ${uploadingIdx === i ? 'animate-spin' : ''}`} />
                      <span className="text-xs text-slate-500">{uploadingIdx === i ? 'Đang upload...' : img ? 'Thay ảnh' : 'Chọn ảnh'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, i)} />
                    </label>
                    {imageUrls.length > 1 && (
                      <button onClick={() => removeItem(setImageUrls, i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setImageUrls)} className="mt-1.5 flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition"><Plus size={14} /> Thêm ảnh</button>
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

/* ── Main ── */
export default function AdminCampaigns() {
  usePageTitle('Admin - Chiến dịch');
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      requestAnimationFrame(() => {
        if (menuRef.current && !menuRef.current.contains(e.target)) {
          setOpenMenuId(null);
        }
      });
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
      toast.success(`Đã cập nhật trạng thái: ${STATUS_MAP[status]?.label || status}`);
      setOpenMenuId(null);
      fetchCampaigns();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Quản lý chiến dịch</h1>
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-visible">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400">Không có chiến dịch nào</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
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
                  {campaigns.map(c => {
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
                          <div className="relative flex justify-center" ref={openMenuId === c.id ? menuRef : null}>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMenuId === c.id && (
                              <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[180px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                                <button
                                  onClick={() => { setOpenMenuId(null); setEditingCampaign(c); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition text-left"
                                >
                                  <Pencil size={14} className="text-blue-500" /> Sửa chiến dịch
                                </button>
                                {c.status !== 'running' && (
                                  <button
                                    onClick={() => updateStatus(c.id, 'running')}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-green-50 hover:text-green-700 transition text-left"
                                  >
                                    <Play size={14} className="text-green-500" /> Chạy chiến dịch
                                  </button>
                                )}
                                {c.status === 'running' && (
                                  <button
                                    onClick={() => updateStatus(c.id, 'paused')}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition text-left"
                                  >
                                    <Pause size={14} className="text-amber-500" /> Tạm dừng
                                  </button>
                                )}
                                {c.status !== 'completed' && (
                                  <button
                                    onClick={() => updateStatus(c.id, 'completed')}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition text-left"
                                  >
                                    <CheckCircle size={14} className="text-blue-500" /> Hoàn thành
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {campaigns.map(c => {
                const st = STATUS_MAP[c.status] || { label: c.status, cls: 'bg-gray-100 text-gray-700' };
                return (
                  <div key={c.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">{c.name}</p>
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate">
                          {c.url?.slice(0, 35)} <ExternalLink size={10} className="shrink-0" />
                        </a>
                      </div>
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{c.user_name || '—'}</span>
                      <span>·</span>
                      <span className="text-slate-400">{c.user_email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs">
                        <span className="font-bold text-emerald-600">{fmt(c.budget)} đ</span>
                        <span className="text-slate-500">{fmt(c.views_done)}/{fmt(c.total_views)} views</span>
                        <span className="text-slate-400">{new Date(c.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <div className="relative" ref={openMenuId === c.id ? menuRef : null}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === c.id && (
                          <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[180px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                            <button onClick={() => { setOpenMenuId(null); setEditingCampaign(c); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 text-left">
                              <Pencil size={14} className="text-blue-500" /> Sửa
                            </button>
                            {c.status !== 'running' && (
                              <button onClick={() => updateStatus(c.id, 'running')}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-green-50 text-left">
                                <Play size={14} className="text-green-500" /> Chạy
                              </button>
                            )}
                            {c.status === 'running' && (
                              <button onClick={() => updateStatus(c.id, 'paused')}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-amber-50 text-left">
                                <Pause size={14} className="text-amber-500" /> Dừng
                              </button>
                            )}
                            {c.status !== 'completed' && (
                              <button onClick={() => updateStatus(c.id, 'completed')}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 text-left">
                                <CheckCircle size={14} className="text-blue-500" /> Xong
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

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
