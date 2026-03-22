import { useState, useEffect, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, Play, Pause, CheckCircle, ExternalLink, MoreVertical, Pencil, X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const STATUS_MAP = {
  running: { label: 'Äang cháº¡y', cls: 'bg-green-100 text-green-700' },
  paused: { label: 'Táº¡m dá»«ng', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'HoÃ n thÃ nh', cls: 'bg-blue-100 text-blue-700' },
};

const parseJsonArray = (val) => {
  if (!val) return [''];
  try { const a = JSON.parse(val); if (Array.isArray(a)) return a.length ? a : ['']; } catch {}
  return [val];
};

/* â”€â”€ Edit Modal â”€â”€ */
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

  const addItem = (setter) => setter(prev => [...prev, '']);
  const removeItem = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (setter, idx, val) => setter(prev => prev.map((v, i) => i === idx ? val : v));

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
      toast.success('Cáº­p nháº­t chiáº¿n dá»‹ch thÃ nh cÃ´ng');
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
          <h3 className="text-lg font-bold text-slate-800">Sá»­a chiáº¿n dá»‹ch</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={18} className="text-slate-500" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">TÃªn chiáº¿n dá»‹ch</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>

          {/* Keywords */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Tá»« khÃ³a</label>
            <div className="space-y-2">
              {keywords.map((kw, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={kw} onChange={e => updateItem(setKeywords, i, e.target.value)} placeholder={`Tá»« khÃ³a ${i+1}`} className={inputCls} />
                  {keywords.length > 1 && <button onClick={() => removeItem(setKeywords, i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={16} /></button>}
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setKeywords)} className="mt-1.5 flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition"><Plus size={14} /> ThÃªm</button>
          </div>

          {/* URLs */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">URL Ä‘Ã­ch</label>
            <div className="space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input type="url" value={u} onChange={e => updateItem(setUrls, i, e.target.value)} placeholder={i === 0 ? 'URL chÃ­nh' : `URL ${i+1}`} className={inputCls} />
                  {urls.length > 1 && <button onClick={() => removeItem(setUrls, i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={16} /></button>}
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setUrls)} className="mt-1.5 flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition"><Plus size={14} /> ThÃªm</button>
          </div>

          {/* Images */}
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Link áº£nh</label>
            <div className="space-y-2">
              {imageUrls.map((img, i) => (
                <div key={i}>
                  <div className="flex gap-2">
                    <input type="url" value={img} onChange={e => updateItem(setImageUrls, i, e.target.value)} placeholder={`Link áº£nh ${i+1}`} className={inputCls} />
                    {imageUrls.length > 1 && <button onClick={() => removeItem(setImageUrls, i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={16} /></button>}
                  </div>
                  {img && <img src={img} alt="" className="mt-1 w-full h-24 object-cover rounded-xl border border-slate-200" onError={e => e.target.style.display='none'} />}
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setImageUrls)} className="mt-1.5 flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition"><Plus size={14} /> ThÃªm</button>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Sá»‘ lÆ°á»£ng view/ngÃ y</label>
            <input type="number" min="1" value={dailyViews} onChange={e => setDailyViews(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Há»§y</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
            {saving ? 'Äang lÆ°u...' : 'LÆ°u thay Ä‘á»•i'}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function AdminCampaigns() {
  usePageTitle('Admin - Chiáº¿n dá»‹ch');
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
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
      toast.success(`ÄÃ£ cáº­p nháº­t tráº¡ng thÃ¡i: ${STATUS_MAP[status]?.label || status}`);
      setOpenMenuId(null);
      fetchCampaigns();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Quáº£n lÃ½ chiáº¿n dá»‹ch</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <form onSubmit={e => { e.preventDefault(); fetchCampaigns(); }} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="TÃ¬m chiáº¿n dá»‹ch, URL, email..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition">TÃ¬m</button>
        </form>
        <div className="flex gap-2">
          {['all', 'running', 'paused', 'completed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition ${statusFilter === s
                ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {s === 'all' ? 'Táº¥t cáº£' : STATUS_MAP[s]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-visible">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Chiáº¿n dá»‹ch</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Chá»§ sá»Ÿ há»¯u</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">NgÃ¢n sÃ¡ch</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Views</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Tráº¡ng thÃ¡i</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">NgÃ y táº¡o</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-500">HÃ nh Ä‘á»™ng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">KhÃ´ng cÃ³ chiáº¿n dá»‹ch nÃ o</td></tr>
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
                      <p className="text-slate-700 font-medium">{c.user_name || 'â€”'}</p>
                      <p className="text-xs text-slate-400">{c.user_email}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{fmt(c.budget)} Ä‘</td>
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
                              <Pencil size={14} className="text-blue-500" /> Sá»­a chiáº¿n dá»‹ch
                            </button>
                            {c.status !== 'running' && (
                              <button
                                onClick={() => updateStatus(c.id, 'running')}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-green-50 hover:text-green-700 transition text-left"
                              >
                                <Play size={14} className="text-green-500" /> Cháº¡y chiáº¿n dá»‹ch
                              </button>
                            )}
                            {c.status === 'running' && (
                              <button
                                onClick={() => updateStatus(c.id, 'paused')}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition text-left"
                              >
                                <Pause size={14} className="text-amber-500" /> Táº¡m dá»«ng
                              </button>
                            )}
                            {c.status !== 'completed' && (
                              <button
                                onClick={() => updateStatus(c.id, 'completed')}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition text-left"
                              >
                                <CheckCircle size={14} className="text-blue-500" /> HoÃ n thÃ nh
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
