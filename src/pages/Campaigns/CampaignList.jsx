import { useState, useEffect, useMemo } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  Pause, Play, Pencil, X, Upload, Plus, Zap, Trash2, BarChart3,
  Search, RefreshCw, Target, ChevronRight, Download,
  TrendingUp, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

/* ── helpers ── */
const parseJsonArray = (val) => {
  if (!val) return [''];
  try { const a = JSON.parse(val); if (Array.isArray(a)) return a.length ? a : ['']; } catch { }
  return [val];
};

/* ── Status badge ── */
function StatusBadge({ status }) {
  const cfg = {
    running: { label: 'Đang chạy', cls: 'text-emerald-700 bg-emerald-50 ring-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
    paused: { label: 'Tạm dừng', cls: 'text-amber-700  bg-amber-50   ring-amber-200', dot: 'bg-amber-400' },
    completed: { label: 'Hoàn thành', cls: 'text-indigo-700 bg-indigo-50  ring-indigo-200', dot: 'bg-indigo-500' },
    draft: { label: 'Bản nháp', cls: 'text-slate-600  bg-slate-100  ring-slate-200', dot: 'bg-slate-400' },
  }[status] || { label: status, cls: 'text-slate-600 bg-slate-100 ring-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/* ── Traffic type badge ── */
function TrafficBadge({ type }) {
  const map = {
    google_search: { label: 'Google Search', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
    direct: { label: 'Direct', cls: 'text-violet-700 bg-violet-50 border-violet-200' },
    social: { label: 'Social', cls: 'text-pink-700 bg-pink-50 border-pink-200' },
  };
  const cfg = map[type] || { label: type, cls: 'text-slate-600 bg-slate-100 border-slate-200' };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.cls} uppercase tracking-wide`}>
      {cfg.label}
    </span>
  );
}

/* ── Keyword Stats Panel ── */
function KeywordStats({ campaignId }) {
  const [stats, setStats] = useState(null);
  const [daily, setDaily] = useState([]);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/campaigns/${campaignId}/keyword-stats`),
      api.get(`/reports/detailed?campaignId=${campaignId}&period=all`),
    ]).then(([st, dt]) => {
      setStats(st.keywords || []);
      setDaily(dt.detailed || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return (
    <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
      <RefreshCw size={14} className="animate-spin" />
      <span className="text-xs font-medium">Đang tải...</span>
    </div>
  );
  if (!stats || stats.length === 0) return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
      <BarChart3 size={24} className="mb-2 opacity-30" />
      <p className="text-xs">Chưa có dữ liệu từ khóa</p>
    </div>
  );

  const totalAll = stats.reduce((s, k) => s + Number(k.total), 0);
  const totalCompleted = stats.reduce((s, k) => s + Number(k.completed), 0);
  const totalCost = stats.reduce((s, k) => s + Number(k.cost), 0);

  const exportCSV = () => {
    const BOM = '\uFEFF';
    let csv = BOM + 'Từ khóa,Tổng,Hoàn thành,Đang chờ,Hết hạn,Blocked,Chi phí (đ)\n';
    stats.forEach(kw => {
      csv += `"${kw.keyword || '(trống)'}",${kw.total},${kw.completed},${kw.pending},${kw.expired},${kw.blocked},${kw.cost}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tu-khoa-${campaignId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Tổng tasks', value: totalAll, color: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'Hoàn thành', value: totalCompleted, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Chi phí (đ)', value: fmt(totalCost), color: 'text-indigo-700', bg: 'bg-indigo-50', raw: true },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3`}>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold mb-0.5">{s.label}</p>
            <p className={`text-lg font-black tabular-nums ${s.color}`}>{s.raw ? s.value : s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Keyword list */}
        <div className="lg:w-2/5 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Theo từ khóa</p>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition">
              <Download size={11} /> Xuất CSV
            </button>
          </div>
          <div className="max-h-[260px] overflow-y-auto pr-1 space-y-2">
            {stats.map((kw, i) => {
              const pct = totalAll > 0 ? Math.round(Number(kw.completed) / totalAll * 100) : 0;
              return (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-sm transition">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold text-slate-800 truncate flex-1">{kw.keyword || '(trống)'}</p>
                    <span className="text-xs font-black text-emerald-600 ml-2 tabular-nums">{Number(kw.completed)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                    <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                    <span className="text-slate-500">Tổng: <b className="text-slate-700">{Number(kw.total)}</b></span>
                    <span className="text-amber-600">Chờ: <b>{Number(kw.pending)}</b></span>
                    <span className="text-slate-400">Hết hạn: <b>{Number(kw.expired)}</b></span>
                    {Number(kw.blocked) > 0 && <span className="text-red-600">Blocked: <b>{Number(kw.blocked)}</b></span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily breakdown */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Chi tiết theo ngày</span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{daily.length} dòng</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[260px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80 sticky top-0">
                <tr>
                  {['Ngày', 'Từ khoá', 'Hoàn thành', 'Chi phí'].map(h => (
                    <th key={h} className="px-4 py-2.5 font-bold text-slate-500 text-left last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {daily.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Không có dữ liệu</td></tr>
                ) : daily.slice((page - 1) * rowsPerPage, page * rowsPerPage).map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-600 font-medium whitespace-nowrap">{d.date?.slice(0, 10)}</td>
                    <td className="px-4 py-2.5 font-semibold text-indigo-600 truncate max-w-[130px]">{d.keyword || '(Trống)'}</td>
                    <td className="px-4 py-2.5 font-bold text-emerald-600 tabular-nums">
                      {d.completed}<span className="text-slate-400 font-medium text-[10px] ml-0.5">/{d.daily_views || d.total}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-700 tabular-nums">{fmt(d.cost)} đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {daily.length > rowsPerPage && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50">
              <span className="text-[10px] text-slate-500">Trang <b>{page}</b>/{Math.ceil(daily.length / rowsPerPage)}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 bg-white hover:bg-slate-50 rounded-lg disabled:opacity-40 transition">‹</button>
                <button onClick={() => setPage(p => Math.min(Math.ceil(daily.length / rowsPerPage), p + 1))} disabled={page >= Math.ceil(daily.length / rowsPerPage)}
                  className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 bg-white hover:bg-slate-50 rounded-lg disabled:opacity-40 transition">›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Toggle switch (reused in modal) ── */
function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 rounded-full border-2 border-transparent cursor-pointer
                  transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

/* ── Edit Modal ── */
function EditCampaignModal({ campaign, onClose, onSaved }) {
  const toast = useToast();
  const [dailyViews, setDailyViews] = useState(campaign.daily_views || 500);

  // Parse existing keyword_config or build from keyword list
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
        // merge: use keyword_config views, fill missing from kwList
        return kwList.map(kw => {
          const found = cfg.find(c => c.keyword === kw);
          return { keyword: kw, views: found ? Number(found.views) : Number(campaign.total_views) || 1000, domain: found?.domain || '', image: found?.image || '' };
        });
      }
    } catch { }
    return kwList.map(kw => ({ keyword: kw, views: Number(campaign.total_views) || 1000, domain: '', image: '' }));
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

  const keywordTotal = keywords.reduce((s, k) => s + (Number(k.views) || 0), 0);

  const addKeyword = () => setKeywords(prev => [...prev, {
    keyword: '',
    domain: '',
    image: '',
    views: useKeywordViews ? Math.max(1, Math.floor(keywordTotal / (prev.length + 1))) : (Number(campaign.total_views) || 1000),
  }]);
  const removeKeyword = (idx) => setKeywords(prev => prev.filter((_, i) => i !== idx));
  const updateKeywordText = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, keyword: val } : k));
  const updateKeywordDomain = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, domain: val } : k));
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

  const addUrlItem    = () => setUrls(prev => [...prev, '']);
  const removeUrlItem = (idx) => setUrls(prev => prev.filter((_, i) => i !== idx));
  const updateUrlItem = (idx, val) => setUrls(prev => prev.map((v, i) => i === idx ? val : v));

  const addImgItem    = () => setImageUrls(prev => [...prev, '']);
  const removeImgItem = (idx) => setImageUrls(prev => prev.filter((_, i) => i !== idx));
  const updateImgItem = (idx, val) => setImageUrls(prev => prev.map((v, i) => i === idx ? val : v));

  const handleImageUpload = async (e, idx) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingIdx(idx);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/campaigns/upload-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      updateImgItem(idx, data.imageUrl);
    } catch (err) { toast.error(err.message); }
    finally { setUploadingIdx(-1); }
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const validKws = keywords.filter(k => k.keyword.trim());
      const u   = urls.filter(u => u.trim());
      const imgs = imageUrls.filter(u => u.trim());
      const computedTotal = useKeywordViews
        ? validKws.reduce((s, k) => s + (Number(k.views) || 0), 0)
        : Number(campaign.total_views);
      const keywordConfig = useKeywordViews
        ? validKws.map(k => ({ keyword: k.keyword, views: Number(k.views) || 0, domain: k.domain || '', image: k.image || '' }))
        : validKws.map(k => ({ keyword: k.keyword, views: computedTotal, domain: k.domain || '', image: k.image || '' }));

      await api.put(`/campaigns/${campaign.id}`, {
        dailyViews:     Number(dailyViews),
        keyword:        JSON.stringify(validKws.map(k => k.keyword)),
        keyword_config: JSON.stringify(keywordConfig),
        totalViews:     computedTotal,
        url:            u[0] || campaign.url,
        url2:           JSON.stringify(u.slice(1)),
        image1_url:     imgs.length ? JSON.stringify(imgs) : null,
        image2_url:     null,
      });
      toast.success('Cập nhật chiến dịch thành công');
      onSaved(); onClose();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const input = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition hover:border-slate-300";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 bg-white z-10 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900">Sửa chiến dịch</h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[320px]">{campaign.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Campaign name (read-only) */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Tên chiến dịch</label>
            <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium">{campaign.name}</div>
          </div>

          {/* Keywords with per-keyword traffic config */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Từ khóa</label>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold transition-colors ${useKeywordViews ? 'text-amber-600' : 'text-slate-400'}`}>
                  Config traffic / từ khóa
                </span>
                <ToggleSwitch checked={useKeywordViews} onChange={toggleKeywordViews} />
              </div>
            </div>

            {useKeywordViews && (
              <div className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <BarChart3 size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  <strong>Chế độ phân bổ traffic theo từ khóa.</strong> Mỗi từ khóa nhận đúng số view đã cấu hình.
                  Tổng view mới = tổng của tất cả từ khóa.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {keywords.map((kw, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl relative">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text" value={kw.keyword}
                      onChange={e => updateKeywordText(i, e.target.value)}
                      placeholder={`Từ khóa ${i + 1}`}
                      className={input + ' flex-1'}
                    />
                    {useKeywordViews && (
                      <div className="relative w-36 flex-shrink-0">
                        <input
                          type="number" min="1"
                          value={kw.views}
                          onChange={e => updateKeywordViews(i, e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border-2 border-amber-300 rounded-xl bg-amber-50
                                     focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500
                                     transition pr-12 font-black text-amber-900 text-right"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 font-bold pointer-events-none">view</span>
                      </div>
                    )}
                    {keywords.length > 1 && (
                      <button onClick={() => removeKeyword(i)} className="p-2 w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-xl transition flex-shrink-0 absolute -top-2 -right-2 shadow-sm z-10">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="text" value={kw.domain}
                      onChange={e => updateKeywordDomain(i, e.target.value)}
                      placeholder="Domain gợi ý (Tuỳ chọn)"
                      className={input + ' flex-1 text-xs'}
                    />
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text" value={kw.image}
                        onChange={e => updateKeywordImage(i, e.target.value)}
                        placeholder="Link Image (Tuỳ chọn)"
                        className={input + ' flex-1 text-xs'}
                      />
                      <label className="flex items-center justify-center p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition flex-shrink-0">
                        {uploadingKwIdx === i ? <RefreshCw size={14} className="animate-spin text-slate-400" /> : <Upload size={14} className="text-slate-500" />}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleKeywordImageUpload(e, i)} />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {useKeywordViews && (
              <div className="mt-2.5 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <BarChart3 size={12} className="text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-600">Tổng view (tất cả từ khóa)</span>
                </div>
                <span className="text-sm font-black text-indigo-700 tabular-nums">
                  {keywordTotal.toLocaleString()} <span className="text-xs font-semibold text-indigo-400">view</span>
                </span>
              </div>
            )}

            <button onClick={addKeyword} className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition">
              <Plus size={13} /> Thêm từ khóa
            </button>
          </div>

          {/* URLs */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">URL đích</label>
            <div className="space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input type="url" value={u} onChange={e => updateUrlItem(i, e.target.value)}
                    placeholder={i === 0 ? 'URL chính' : `URL ${i + 1}`} className={input} />
                  {urls.length > 1 && (
                    <button onClick={() => removeUrlItem(i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addUrlItem} className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition">
              <Plus size={13} /> Thêm URL
            </button>
          </div>

          {/* Images */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Hình ảnh</label>
            <div className="space-y-2">
              {imageUrls.map((img, i) => (
                <div key={i}>
                  {img && <img src={img} alt="" className="w-full h-24 object-cover rounded-xl border border-slate-200 mb-2" onError={e => e.target.style.display = 'none'} />}
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl px-3 py-2 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 transition group">
                      <Upload size={13} className={`text-slate-400 group-hover:text-indigo-500 transition ${uploadingIdx === i ? 'animate-spin' : ''}`} />
                      <span className="text-xs text-slate-500 group-hover:text-indigo-600 transition">{uploadingIdx === i ? 'Đang upload...' : img ? 'Thay ảnh' : 'Chọn ảnh'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, i)} />
                    </label>
                    {imageUrls.length > 1 && (
                      <button onClick={() => removeImgItem(i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={15} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addImgItem} className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition">
              <Plus size={13} /> Thêm ảnh
            </button>
          </div>

          {/* Daily views */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Số view / ngày</label>
            <div className="relative">
              <input type="number" min="1" value={dailyViews} onChange={e => setDailyViews(e.target.value)} className={input + ' pr-24'} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md">view/ngày</span>
            </div>
          </div>

          {/* Total views info */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs font-bold text-slate-500 mb-1">Thông tin tổng view</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Hiện tại đã thực hiện</span>
              <span className="text-xs font-bold text-emerald-600">{Number(campaign.views_done || 0).toLocaleString()} / {Number(campaign.total_views || 0).toLocaleString()} view</span>
            </div>
            {useKeywordViews && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500">Tổng view mới (theo từ khóa)</span>
                <span className="text-xs font-black text-indigo-600">{keywordTotal.toLocaleString()} view</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl transition shadow-md shadow-indigo-200 disabled:opacity-50 active:scale-95">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══ Main component ══════════════════════════════════════════════ */
export default function CampaignList() {
  usePageTitle('Quản lý chiến dịch');
  const navigate = useNavigate();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

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

  const totalPages = Math.ceil(filtered.length / LIMIT);
  const pagedList = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  const handleToggle = async (c) => {
    const newStatus = c.status === 'running' ? 'paused' : 'running';
    try {
      await api.put(`/campaigns/${c.id}/status`, { status: newStatus });
      setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: newStatus } : x));
      toast.success(newStatus === 'running' ? 'Đã chạy lại chiến dịch' : 'Đã tạm dừng chiến dịch');
    } catch (err) { toast.error(err.message); }
  };

  /* counts */
  const counts = {
    all: campaigns.length,
    running: campaigns.filter(c => c.status === 'running' && !(Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0)).length,
    paused: campaigns.filter(c => c.status === 'paused' && !(Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0)).length,
    completed: campaigns.filter(c => Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0 || c.status === 'completed').length,
  };

  const FILTERS = [
    { key: 'all', label: 'Tất cả', icon: Target },
    { key: 'running', label: 'Đang chạy', icon: Zap },
    { key: 'paused', label: 'Tạm dừng', icon: Clock },
    { key: 'completed', label: 'Hoàn thành', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-5 w-full min-w-0 pb-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Breadcrumb items={[{ label: 'Dashboard', to: '/buyer/dashboard' }, { label: 'Quản lý chiến dịch' }]} />

      <div className="flex justify-end">
        <button
          onClick={() => navigate('/buyer/dashboard/campaigns/create')}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
        >
          <Plus size={15} /> Tạo chiến dịch mới
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng chiến dịch', value: counts.all, icon: Target, iconBg: 'bg-slate-100', iconCl: 'text-slate-600' },
          { label: 'Đang chạy', value: counts.running, icon: Zap, iconBg: 'bg-emerald-100', iconCl: 'text-emerald-600' },
          { label: 'Tạm dừng', value: counts.paused, icon: Clock, iconBg: 'bg-amber-100', iconCl: 'text-amber-600' },
          { label: 'Hoàn thành', value: counts.completed, icon: CheckCircle2, iconBg: 'bg-indigo-100', iconCl: 'text-indigo-600' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-slate-200/80 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
                <Icon size={16} className={s.iconCl} />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{s.value}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-wide">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên, URL, từ khóa..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition hover:border-slate-300"
          />
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
          {FILTERS.map(f => {
            const Icon = f.icon;
            return (
              <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${filter === f.key
                  ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Icon size={11} />
                <span className="hidden sm:inline">{f.label}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'
                  }`}>{counts[f.key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Campaign Table ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <RefreshCw size={24} className="animate-spin text-indigo-400" />
          <span className="text-sm font-medium animate-pulse">Đang tải chiến dịch...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-2">
            <Target size={28} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-semibold">Không có chiến dịch nào</p>
          <p className="text-sm text-slate-400">{search ? `Không tìm thấy kết quả cho "${search}"` : 'Bắt đầu bằng cách tạo chiến dịch đầu tiên'}</p>
          <button
            onClick={() => navigate('/buyer/dashboard/campaigns/create')}
            className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition"
          >
            <Plus size={14} /> Tạo chiến dịch
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Chiến dịch', 'Trạng thái', 'Tổng tiến độ', 'Ngân sách', 'Hành động'].map((h, i) => (
                    <th key={h} className={`px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest ${i >= 2 ? 'text-right' : 'text-left'
                      } ${i === 4 ? 'text-center w-28' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              {pagedList.map(c => {
                const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
                const effStatus = isDone ? 'completed' : c.status;
                const pct = Number(c.total_views) > 0
                  ? Math.min(Math.round(Number(c.views_done) / Number(c.total_views) * 100), 100) : 0;
                const barColor = effStatus === 'completed' ? '#6366f1' : effStatus === 'running' ? '#10b981' : '#f59e0b';
                const isExpanded = expandedId === c.id;

                const keywords = (() => {
                  try { return JSON.parse(c.keyword); } catch { return [c.keyword || '']; }
                })();

                return (
                  <tbody key={c.id} className={`border-b border-slate-100 last:border-0 group transition-colors ${isExpanded ? 'bg-indigo-50/20' : 'hover:bg-slate-50/60'}`}>
                    <tr>
                      {/* Campaign info */}
                      <td className="px-5 py-4">
                        <div className="max-w-[260px]">
                          <p className="font-bold text-slate-900 text-[13px] leading-tight truncate group-hover:text-indigo-700 transition-colors cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                            {c.name}
                          </p>
                          <a href={c.url} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-indigo-500 hover:text-indigo-700 hover:underline truncate block mt-0.5 font-mono">
                            {c.url}
                          </a>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <TrafficBadge type={c.traffic_type} />
                            {keywords.slice(0, 2).map((kw, i) => (
                              <span key={i} className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md font-medium truncate max-w-[100px]">{kw}</span>
                            ))}
                            {keywords.length > 2 && (
                              <span className="text-[10px] text-slate-400">+{keywords.length - 2}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 align-top pt-5">
                        <StatusBadge status={effStatus} />
                      </td>

                      {/* Progress */}
                      <td className="px-5 py-4 text-right align-top pt-5">
                        <div className="flex flex-col items-end w-36 ml-auto">
                          <div className="flex justify-between w-full mb-1.5">
                            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{fmt(c.views_done)}<span className="text-slate-300">/{fmt(c.total_views)}</span></span>
                            <span className="text-[12px] font-black tabular-nums" style={{ color: barColor }}>{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">Max {fmt(c.daily_views)}/ngày</p>
                        </div>
                      </td>

                      {/* Budget */}
                      <td className="px-5 py-4 text-right align-top pt-5 whitespace-nowrap">
                        <p className="text-[13px] font-black text-slate-800 tabular-nums">{fmt(c.budget)} <span className="text-[10px] font-bold text-slate-400">đ</span></p>
                        <p className="text-[11px] text-slate-400 mt-0.5">CPC: {fmt(c.cpc)} đ</p>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-center align-top pt-4">
                        <div className="flex items-center justify-center gap-1.5 sm:opacity-60 group-hover:opacity-100 transition-opacity">
                          {/* Stats toggle */}
                          <button onClick={() => setExpandedId(isExpanded ? null : c.id)} title="Thống kê từ khóa"
                            className={`p-2 rounded-xl transition border ${isExpanded
                              ? 'bg-indigo-100 border-indigo-200 text-indigo-700'
                              : 'bg-white border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 text-slate-400'}`}>
                            <BarChart3 size={14} />
                          </button>

                          {effStatus !== 'completed' && (
                            <>
                              {/* Edit */}
                              <button onClick={() => setEditingCampaign(c)} title="Chỉnh sửa"
                                className="p-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-400 hover:text-slate-700 rounded-xl transition">
                                <Pencil size={14} />
                              </button>

                              {/* Pause / Resume */}
                              <button onClick={() => handleToggle(c)} title={c.status === 'running' ? 'Tạm dừng' : 'Chạy lại'}
                                className={`p-2 rounded-xl transition border ${c.status === 'running'
                                  ? 'bg-white border-slate-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 text-slate-400'
                                  : 'bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 text-slate-400'}`}>
                                {c.status === 'running' ? <Pause size={14} /> : <Play size={14} />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded stats row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="p-0 border-t border-indigo-100">
                          <div className="px-5 py-5"
                            style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f5f3ff 100%)' }}>
                            <div className="flex items-center gap-2 mb-4">
                              <TrendingUp size={14} className="text-indigo-500" />
                              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Thống kê chi tiết – {c.name}</span>
                            </div>
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
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl px-5 py-3 shadow-sm">
          <p className="text-xs text-slate-500">
            Trang <span className="font-bold text-slate-800">{page}</span> / {totalPages}
            <span className="text-slate-400 ml-1">({filtered.length} chiến dịch)</span>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition">‹ Trước</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, [])
              .map((p, i) => p === '...'
                ? <span key={`d${i}`} className="px-1.5 text-slate-400 text-xs">…</span>
                : <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 text-xs font-bold rounded-xl transition ${page === p ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'hover:bg-slate-50 border border-slate-200 text-slate-600'}`}>{p}</button>
              )
            }
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition">Sau ›</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCampaign && (
        <EditCampaignModal campaign={editingCampaign} onClose={() => setEditingCampaign(null)} onSaved={fetchCampaigns} />
      )}
    </div>
  );
}