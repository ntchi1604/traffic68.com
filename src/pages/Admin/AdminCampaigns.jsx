import { useState, useEffect, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, Play, Pause, CheckCircle, ExternalLink, MoreVertical, Pencil, X, Plus, Trash2, Upload, BarChart3 } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const STATUS_MAP = {
  running: { label: 'Đang chạy', cls: 'bg-green-100 text-green-700' },
  paused: { label: 'Tạm dừng', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Hoàn thành', cls: 'bg-blue-100 text-indigo-700' },
};

const TRAFFIC_TYPE_MAP = {
  google_search: { label: 'Google Search', cls: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  direct:        { label: 'Direct',         cls: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  social:        { label: 'Social',         cls: 'bg-pink-50 text-pink-700', dot: 'bg-pink-500' },
};

const parseJsonArray = (val) => {
  if (!val) return [''];
  try { const a = JSON.parse(val); if (Array.isArray(a)) return a.length ? a : ['']; } catch { }
  return [val];
};

/* ── Keyword Stats Panel (admin version) ── */
function KeywordStats({ campaignId }) {
  const [stats, setStats] = useState(null);
  const [daily, setDaily] = useState([]);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/admin/campaigns/${campaignId}/keyword-stats`),
      api.get(`/admin/campaigns/${campaignId}/detailed-stats`)
    ]).then(([st, dt]) => {
      setStats(st.keywords || []);
      setDaily(dt.detailed || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="text-center py-4 text-xs text-slate-400">Đang tải...</div>;
  if (!stats || stats.length === 0) return <div className="text-center py-4 text-xs text-slate-400">Chưa có dữ liệu</div>;

  const totalAll = stats.reduce((s, k) => s + Number(k.total), 0);
  const totalCompleted = stats.reduce((s, k) => s + Number(k.completed), 0);
  const totalPending = stats.reduce((s, k) => s + Number(k.pending), 0);
  const totalExpired = stats.reduce((s, k) => s + Number(k.expired), 0);
  const totalBlocked = stats.reduce((s, k) => s + Number(k.blocked), 0);
  const totalCost = stats.reduce((s, k) => s + Number(k.cost), 0);

  const exportCSV = () => {
    const BOM = '\uFEFF';
    let csv = BOM + 'Từ khóa,Tổng,Hoàn thành,Đang chờ,Hết hạn,Blocked,Chi phí (đ)\n';
    stats.forEach(kw => {
      csv += `"${kw.keyword || '(trống)'}",${kw.total},${kw.completed},${kw.pending},${kw.expired},${kw.blocked},${kw.cost}\n`;
    });
    csv += `\n"TỔNG CỘNG",${totalAll},${totalCompleted},${totalPending},${totalExpired},${totalBlocked},${totalCost}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-tu-khoa-${campaignId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left: Overall stats */}
      <div className="space-y-2 lg:w-1/3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold text-slate-500">Tổng: {totalAll} tasks · {totalCompleted} hoàn thành</p>
          <button onClick={exportCSV}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition">
            📥 Xuất CSV
          </button>
        </div>
        <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2">
          {stats.map((kw, i) => {
            const pct = totalAll > 0 ? Math.round(Number(kw.completed) / totalAll * 100) : 0;
            return (
              <div key={i} className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-bold text-slate-800 truncate flex-1">{kw.keyword || '(trống)'}</p>
                  <span className="text-xs font-bold text-emerald-600 ml-2">{Number(kw.completed)} view</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                  <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                  <span className="text-slate-500">Tổng: <b className="text-slate-700">{Number(kw.total)}</b></span>
                  <span className="text-emerald-600">Hoàn thành: <b>{Number(kw.completed)}</b></span>
                  <span className="text-amber-600">Đang chờ: <b>{Number(kw.pending)}</b></span>
                  <span className="text-slate-500">Hết hạn: <b>{Number(kw.expired)}</b></span>
                  {Number(kw.blocked) > 0 && <span className="text-red-600">Blocked: <b>{Number(kw.blocked)}</b></span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Daily Breakdowns */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Chi tiết theo ngày & từ khoá</span>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{daily.length} dòng</span>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[300px]">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 sticky top-0 shadow-sm">
              <tr>
                <th className="px-4 py-2 font-semibold text-slate-500">Ngày</th>
                <th className="px-4 py-2 font-semibold text-slate-500">Từ khoá</th>
                <th className="px-4 py-2 font-semibold text-slate-500 text-right">Hoàn thành</th>
                <th className="px-4 py-2 font-semibold text-slate-500 text-right">Chi phí</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daily.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Không có dữ liệu</td></tr>
              ) : daily.slice((page - 1) * rowsPerPage, page * rowsPerPage).map((d, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-700 whitespace-nowrap">{d.date?.slice(0, 10)}</td>
                  <td className="px-4 py-2.5 font-bold text-indigo-600 truncate max-w-[150px]" title={d.keyword}>{d.keyword || '(Trống)'}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                    {d.completed} <span className="text-slate-500 font-medium text-[10px] ml-0.5">/ {d.daily_views || d.total}</span>
                    <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{d.total} lượt nhận</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-600">{fmt(d.cost)} đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {daily.length > rowsPerPage && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-medium text-slate-500">Trang <b>{page}</b> / {Math.ceil(daily.length / rowsPerPage)}</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm text-slate-600 disabled:opacity-40 transition">
                ‹ Trước
              </button>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(daily.length / rowsPerPage), p + 1))}
                disabled={page >= Math.ceil(daily.length / rowsPerPage)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm text-slate-600 disabled:opacity-40 transition">
                Sau ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Edit Modal ── */
function EditCampaignModal({ campaign, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(campaign.name || '');
  const [dailyViews, setDailyViews] = useState(campaign.daily_views || 500);
  const [totalViews, setTotalViews] = useState(Number(campaign.total_views) || 1000);

  const [useKeywordUrls, setUseKeywordUrls] = useState(() => {
    try {
      const cfg = campaign.keyword_config ? JSON.parse(campaign.keyword_config) : null;
      return Array.isArray(cfg) && cfg.some(k => (k.url && k.url.trim()) || (k.image && k.image.trim()));
    } catch { return false; }
  });

  const [useKeywordViews, setUseKeywordViews] = useState(() => {
    try {
      const cfg = campaign.keyword_config ? JSON.parse(campaign.keyword_config) : null;
      return Array.isArray(cfg) && cfg.some(k => k.views && k.views > 0);
    } catch { return false; }
  });

  const [keywords, setKeywords] = useState(() => {
    const kwList = parseJsonArray(campaign.keyword);
    try {
      const cfg = campaign.keyword_config ? JSON.parse(campaign.keyword_config) : null;
      if (Array.isArray(cfg) && cfg.length > 0) {
        return kwList.map(kw => {
          const found = cfg.find(c => c.keyword === kw);
          return { keyword: kw, views: found ? Number(found.views) : Number(campaign.total_views) || 1000, url: found?.url || found?.domain || '', image: found?.image || '' };
        });
      }
    } catch { }
    return kwList.map(kw => ({ keyword: kw, views: Number(campaign.total_views) || 1000, url: '', image: '' }));
  });
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
  const [version, setVersion] = useState(campaign.version || 0);
  const [viewByHour, setViewByHour] = useState(campaign.view_by_hour ? true : false);

  const addItem = (setter) => setter(prev => [...prev, '']);
  const removeItem = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (setter, idx, val) => setter(prev => prev.map((v, i) => i === idx ? val : v));

  const addKeyword = () => setKeywords(prev => [...prev, { keyword: '', url: '', image: '', views: Number(campaign.total_views) || 1000 }]);
  const removeKeyword = (idx) => setKeywords(prev => prev.filter((_, i) => i !== idx));
  const updateKeywordText = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, keyword: val } : k));
  const updateKeywordUrl = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, url: val } : k));
  const updateKeywordImage = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, image: val } : k));
  const updateKeywordViews = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, views: Number(val) || 0 } : k));

  const toggleKeywordViews = () => {
    const next = !useKeywordViews;
    if (next) {
      const perKw = Math.max(1, Math.floor((Number(campaign.total_views) || 1000) / Math.max(1, keywords.length)));
      setKeywords(prev => prev.map(k => ({ ...k, views: perKw })));
    }
    setUseKeywordViews(next);
  };

  const [uploadingKwIdx, setUploadingKwIdx] = useState(-1);
  const handleKeywordImageUpload = async (e, idx) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingKwIdx(idx);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/campaigns/upload-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      updateKeywordImage(idx, data.imageUrl);
    } catch (err) { toast.error(err.message); }
    finally { setUploadingKwIdx(-1); }
  };

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
      const kws = keywords.filter(k => k.keyword.trim());
      const u = kws.map(k => k.url).filter(x => x && x.trim());
      const imgs = kws.map(k => k.image).filter(x => x && x.trim());
      const globalUrl = urls[0]?.trim();
      const globalImg = imageUrls[0]?.trim();
      const allImages = globalImg ? [globalImg, ...imgs] : imgs;
      await api.put(`/admin/campaigns/${campaign.id}`, {
        name,
        keyword: JSON.stringify(kws.length ? kws.map(k => k.keyword) : [campaign.keyword || '']),
        keyword_config: JSON.stringify(kws.length ? kws.map(k => ({
          keyword: k.keyword,
          views: useKeywordViews ? (Number(k.views) || 0) : Math.max(1, Math.floor((Number(totalViews) || 1000) / kws.length)),
          url: useKeywordUrls ? (k.url || '') : '',
          image: useKeywordUrls ? (k.image || '') : ''
        })) : []),
        url: globalUrl || u[0] || 'https://traffic68.com', // fallback
        url2: JSON.stringify([]),
        dailyViews: Number(dailyViews),
        totalViews: Number(totalViews),
        viewByHour: viewByHour ? 1 : 0,
        image1_url: allImages.length ? JSON.stringify(allImages) : null,
        image2_url: null,
        version: Number(version),
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

  const inputCls = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition";

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

          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-4">
            <h4 className="text-sm font-bold text-indigo-900 mb-1">Cấu hình URL và Hình ảnh (Mặc định dùng chung)</h4>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Mặc định: URL đích</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={urls[0] || ''}
                  onChange={e => updateItem(setUrls, 0, e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Mặc định: Hình ảnh</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Link ảnh hoặc Dán ảnh (Ctrl+V)"
                    value={imageUrls[0] || ''}
                    onChange={e => updateItem(setImageUrls, 0, e.target.value)}
                    onPaste={async e => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (let j = 0; j < items.length; j++) {
                        const item = items[j];
                        if (item.type.startsWith('image/')) {
                          e.preventDefault();
                          const file = item.getAsFile();
                          if (file) handleImageUpload({ target: { files: [file] } }, 0);
                          break;
                        }
                      }
                    }}
                    className={inputCls}
                  />
                  <label className="flex items-center justify-center p-2 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-slate-100 transition flex-shrink-0">
                    {uploadingIdx === 0 ? <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"/> : <Upload size={14} className="text-slate-500" />}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 0)} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Keywords */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-slate-600">Từ khóa tìm kiếm</label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                  <span className={`text-[11px] font-semibold transition-colors ${useKeywordUrls ? 'text-indigo-600' : 'text-slate-400'}`}>
                    Cài Link/Ảnh riêng
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useKeywordUrls}
                    onClick={() => setUseKeywordUrls(!useKeywordUrls)}
                    className={`relative inline-flex h-4 w-8 flex-shrink-0 rounded-full border-2 border-transparent cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none ${useKeywordUrls ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${useKeywordUrls ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold transition-colors ${useKeywordViews ? 'text-amber-600' : 'text-slate-400'}`}>
                    Cài view riêng/ngày
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useKeywordViews}
                    onClick={toggleKeywordViews}
                    className={`relative inline-flex h-4 w-8 flex-shrink-0 rounded-full border-2 border-transparent cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none ${useKeywordViews ? 'bg-amber-500' : 'bg-slate-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${useKeywordViews ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {keywords.map((kw, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl relative">
                  <div className="flex gap-2 items-center">
                    <input type="text" value={kw.keyword} onChange={e => updateKeywordText(i, e.target.value)} placeholder={`Từ khóa ${i + 1}`} className={inputCls + ' flex-1'} />
                    {useKeywordViews && (
                      <div className="relative w-28 flex-shrink-0">
                        <input
                          type="number" min="1" value={kw.views}
                          onChange={e => updateKeywordViews(i, e.target.value)}
                          className={inputCls + ' pr-10 text-right font-bold text-amber-900 bg-amber-50'}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 font-bold pointer-events-none">view</span>
                      </div>
                    )}
                    {keywords.length > 1 && <button onClick={() => removeKeyword(i)} className="p-2 w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-xl cursor-pointer transition flex-shrink-0 absolute -top-2 -right-2 shadow-sm z-10"><Trash2 size={13} /></button>}
                  </div>
                  {useKeywordUrls && (
                    <div className="flex gap-2 items-center mt-1">
                      <input
                        type="text" value={kw.url}
                        onChange={e => updateKeywordUrl(i, e.target.value)}
                        placeholder="URL đích riêng (Tuỳ chọn)"
                        className={inputCls + ' flex-1 text-xs py-2'}
                      />
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text" value={kw.image}
                          onChange={e => updateKeywordImage(i, e.target.value)}
                          onPaste={async e => {
                            const items = e.clipboardData?.items;
                            if (!items) return;
                            for (let j = 0; j < items.length; j++) {
                              const item = items[j];
                              if (item.type.startsWith('image/')) {
                                e.preventDefault();
                                const file = item.getAsFile();
                                if (file) handleKeywordImageUpload({ target: { files: [file] } }, i);
                                break;
                              }
                            }
                          }}
                          placeholder="Link Image riêng - Ctrl+V"
                          className={inputCls + ' flex-1 text-xs py-2'}
                        />
                        <label className="flex items-center justify-center p-2 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-slate-100 transition flex-shrink-0">
                          {uploadingKwIdx === i ? <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"/> : <Upload size={14} className="text-slate-500" />}
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleKeywordImageUpload(e, i)} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addKeyword} className="mt-2.5 flex items-center gap-1 text-xs font-bold text-indigo-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition"><Plus size={14} /> Thêm</button>
          </div>



          {/* Daily views + Total views */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-600 mb-1 block">Số view / ngày</label>
              <div className="relative">
                <input type="number" min="1" value={dailyViews} onChange={e => setDailyViews(e.target.value)} className={inputCls + ' pr-20'} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">v/ngày</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-600 mb-1 block">Tổng view mua</label>
              <div className="relative">
                <input type="number" min="1" value={totalViews} onChange={e => setTotalViews(Number(e.target.value) || 0)} className={inputCls + ' pr-14'} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">view</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Đã chạy: <strong className="text-emerald-600">{Number(campaign.views_done || 0).toLocaleString()}</strong> view</p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Chia view theo giờ</p>
              <p className="text-xs text-slate-400">Phân bố đều view trong 24h ({Math.ceil(dailyViews / 24)}/giờ)</p>
            </div>
            <button
              type="button"
              onClick={() => setViewByHour(!viewByHour)}
              className={`relative w-11 h-6 rounded-full transition-colors ${viewByHour ? 'bg-indigo-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${viewByHour ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Version</label>
            <select value={version} onChange={e => setVersion(Number(e.target.value))} className={inputCls}>
              <option value={0}>Version 2 — 1 Step</option>
              <option value={1}>Version 1 — 2 Step</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
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
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const menuRef = useRef(null);
  const LIMIT = 20;

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const fetchCampaigns = () => {
    setLoading(true);
    api.get(`/admin/campaigns?search=${search}&status=${statusFilter}&limit=200`)
      .then(data => { setCampaigns(data.campaigns || []); setPage(1); })
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

  const totalPages = Math.ceil(campaigns.length / LIMIT);
  const paged = campaigns.slice((page - 1) * LIMIT, page * LIMIT);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <form onSubmit={e => { e.preventDefault(); fetchCampaigns(); }} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm chiến dịch, URL, email..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition">Tìm</button>
        </form>
        <div className="flex gap-2">
          {['all', 'running', 'paused', 'completed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition ${statusFilter === s
                ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {s === 'all' ? 'Tất cả' : STATUS_MAP[s]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-visible">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Loại</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Chủ sở hữu</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Ngân sách</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Views</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Trạng thái</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Ngày tạo</th>
                    <th className="px-5 py-3 text-center font-semibold text-slate-500">Hành động</th>
                  </tr>
                </thead>
                {paged.map(c => {
                  const st = STATUS_MAP[c.status] || { label: c.status, cls: 'bg-gray-100 text-gray-700' };
                  const isExpanded = expandedId === c.id;
                  return (
                    <tbody key={c.id} className={`border-b border-slate-100 group hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-slate-50/30' : 'bg-white'}`}>
                      <tr className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-800">{c.name}</p>
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
                            {c.url?.slice(0, 40)} <ExternalLink size={10} />
                          </a>
                        </td>
                        <td className="px-5 py-3">
                          {(() => {
                            const tt = TRAFFIC_TYPE_MAP[c.traffic_type] || { label: c.traffic_type || '—', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold rounded-full ${tt.cls}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${tt.dot}`} />
                                {tt.label}
                              </span>
                            );
                          })()}
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
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setExpandedId(isExpanded ? null : c.id)} title="Thống kê chi tiết"
                              className={`p-1.5 rounded-lg transition shadow-sm border ${isExpanded ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-orange-100' : 'bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-800 text-slate-400'}`}>
                              <BarChart3 size={15} />
                            </button>
                            <div className="relative" ref={openMenuId === c.id ? menuRef : null}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                              >
                                <MoreVertical size={16} />
                              </button>
                              {openMenuId === c.id && (
                                <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[180px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                                  <button
                                    onClick={() => { setOpenMenuId(null); setEditingCampaign(c); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-indigo-700 transition text-left"
                                  >
                                    <Pencil size={14} className="text-indigo-500" /> Sửa chiến dịch
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
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-indigo-700 transition text-left"
                                    >
                                      <CheckCircle size={14} className="text-indigo-500" /> Hoàn thành
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0 border-t border-slate-100 bg-slate-50/80">
                            <div className="p-5 overflow-hidden shadow-inner">
                              <KeywordStats campaignId={c.id} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {paged.map(c => {
                const st = STATUS_MAP[c.status] || { label: c.status, cls: 'bg-gray-100 text-gray-700' };
                const isExpanded = expandedId === c.id;
                return (
                  <div key={c.id} className="space-y-0">
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 truncate">{c.name}</p>
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline flex items-center gap-1 truncate">
                            {c.url?.slice(0, 35)} <ExternalLink size={10} className="shrink-0" />
                          </a>
                          {(() => {
                            const tt = TRAFFIC_TYPE_MAP[c.traffic_type] || { label: c.traffic_type || '—', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
                            return (
                              <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${tt.cls}`}>
                                <span className={`w-1 h-1 rounded-full ${tt.dot}`} />
                                {tt.label}
                              </span>
                            );
                          })()}
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
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setExpandedId(isExpanded ? null : c.id)} title="Thống kê chi tiết"
                            className={`p-1.5 rounded-lg transition border ${isExpanded ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                            <BarChart3 size={14} />
                          </button>
                          <div className="relative" ref={openMenuId === c.id ? menuRef : null}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMenuId === c.id && (
                              <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[180px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                                <button onClick={() => { setOpenMenuId(null); setEditingCampaign(c); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 text-left">
                                  <Pencil size={14} className="text-indigo-500" /> Sửa
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
                                    <CheckCircle size={14} className="text-indigo-500" /> Xong
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/80 p-4">
                        <KeywordStats campaignId={c.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">Trang <span className="font-bold text-slate-700">{page}</span> / {totalPages} <span className="text-slate-400">({campaigns.length} chiến dịch)</span></p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition">‹ Trước</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, [])
              .map((p, i) => p === '...' ? <span key={`d${i}`} className="px-1 text-slate-400 text-xs">…</span> : (
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 text-xs font-bold rounded-lg transition ${page === p ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 border border-slate-200 text-slate-600'}`}>{p}</button>
              ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition">Sau ›</button>
          </div>
        </div>
      )}

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
