import { useState, useEffect, useMemo } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  Pause, Play, Pencil, X, Upload, Plus, Zap, Trash2, BarChart3,
  Search, RefreshCw, Target, ChevronRight, Download, Globe,
  TrendingUp, Clock, CheckCircle2, AlertCircle, RotateCcw,
} from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';
import { exportToExcel } from '../../lib/exportExcel';
import { SkTableRows } from '../../components/SkeletonLoader';

/* ── helpers ── */
const parseJsonArray = (val) => {
  if (!val) return [''];
  try { const a = JSON.parse(val); if (Array.isArray(a)) return a.length ? a : ['']; } catch { }
  return [val];
};

/* ── Status badge ── */
function StatusBadge({ status, pauseReason }) {
  const cfg = {
    running: { label: 'Đang chạy', cls: 'text-emerald-700 bg-emerald-50 ring-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
    paused: { label: 'Tạm dừng', cls: 'text-amber-700  bg-amber-50   ring-amber-200', dot: 'bg-amber-400' },
    completed: { label: 'Hoàn thành', cls: 'text-indigo-700 bg-indigo-50  ring-indigo-200', dot: 'bg-indigo-500' },
    draft: { label: 'Bản nháp', cls: 'text-slate-600  bg-slate-100  ring-slate-200', dot: 'bg-slate-400' },
  }[status] || { label: status, cls: 'text-slate-600 bg-slate-100 ring-slate-200', dot: 'bg-slate-400' };
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${cfg.cls}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </span>
      {pauseReason && (
        <span className="inline-flex items-start gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title={pauseReason}>
          <AlertCircle size={9} className="flex-shrink-0 mt-0.5" />
          <span>{pauseReason}</span>
        </span>
      )}
    </div>
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
function KeywordStats({ campaignId, trafficType }) {
  const [stats, setStats] = useState(null);
  const [daily, setDaily] = useState([]);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [exportingXlsx, setExportingXlsx] = useState(false);

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

  const exportExcel = async () => {
    if (exportingXlsx) return;
    setExportingXlsx(true);
    try {
      const data = await api.get(`/reports/tasks/export?campaignId=${campaignId}&period=all`);
      const rows = data.tasks || [];
      exportToExcel({
        filename: `buyer_tasks_${campaignId}_${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'Dữ liệu task',
        headers: ['STT', 'ID', 'Keyword', 'IP', 'Quốc gia', 'Thành phố', 'Thiết bị', 'User Agent', 'Chi tiêu', 'Thời gian tạo', 'Hoàn thành lúc'],
        colTypes: ['n', 'n', 's', 's', 's', 's', 's', 's', 'n', 's', 's'],
        rows: rows.map(r => [
          r.stt, r.id, r.keyword, r.ip, r.country, r.city, r.device,
          r.userAgent || '',
          r.spending,
          r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '',
          r.completedAt ? new Date(r.completedAt).toLocaleString('vi-VN') : '',
        ]),
      });
    } catch (err) {
      console.error('Export Excel error:', err);
      alert('Xuất Excel thất bại: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setExportingXlsx(false);
    }
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
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {trafficType === 'social' ? 'Theo URL Social' : 'Theo từ khóa'}
            </p>
            <button onClick={exportExcel} disabled={exportingXlsx}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border transition ${exportingXlsx
                  ? 'text-emerald-400 bg-emerald-50 border-emerald-100 cursor-not-allowed'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 cursor-pointer'
                }`}>
              <Download size={11} />{exportingXlsx ? ' Đang xuất...' : ' Xuất Excel'}
            </button>
          </div>
          <div className="max-h-[260px] overflow-y-auto pr-1 space-y-2">
            {stats.map((kw, i) => {
              const pct = totalAll > 0 ? Math.round(Number(kw.completed) / totalAll * 100) : 0;
              const isValidUrl = (v) => { try { return v && v !== '[]' && new URL(v) && true; } catch { return false; } };
              const displayLabel = trafficType === 'direct'
                ? (isValidUrl(kw.keyword) ? kw.keyword : '—')
                : (kw.keyword && kw.keyword !== '[]' ? kw.keyword : '(trống)');
              return (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-sm transition">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold text-slate-800 truncate flex-1" title={kw.keyword}>
                      {(trafficType === 'direct' || trafficType === 'social') && isValidUrl(kw.keyword)
                        ? <a href={kw.keyword} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">{displayLabel}</a>
                        : displayLabel
                      }
                    </p>
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
                  {['Ngày', trafficType === 'direct' ? 'URL' : trafficType === 'social' ? 'URL Social' : 'Từ khoá', 'Hoàn thành', 'Chi phí'].map(h => (
                    <th key={h} className="px-4 py-2.5 font-bold text-slate-500 text-left last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {daily.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Không có dữ liệu</td></tr>
                ) : daily.slice((page - 1) * rowsPerPage, page * rowsPerPage).map((d, i) => {
                  const isValidUrl = (v) => { try { return v && v !== '[]' && new URL(v) && true; } catch { return false; } };
                  const kwDisplay = (d.keyword && d.keyword !== '[]') ? d.keyword : null;
                  return (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-600 font-medium whitespace-nowrap">{d.date?.slice(0, 10)}</td>
                      {(trafficType === 'direct' || trafficType === 'social')
                        ? <td className="px-4 py-2.5 font-semibold text-violet-600 truncate max-w-[160px]" title={kwDisplay || ''}>
                          {isValidUrl(kwDisplay)
                            ? <a href={kwDisplay} target="_blank" rel="noopener noreferrer" className="hover:underline">{kwDisplay}</a>
                            : '—'}
                        </td>
                        : <td className="px-4 py-2.5 font-semibold text-indigo-600 truncate max-w-[130px]">{kwDisplay || '(Trống)'}</td>
                      }
                      <td className="px-4 py-2.5 font-bold text-emerald-600 tabular-nums">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {d.completed}
                            <span className="text-slate-400 font-medium text-[10px] ml-0.5">
                              / {Number(d.keyword_views) > 0 ? Number(d.keyword_views).toLocaleString() : '∞'}
                            </span>
                          </span>
                          {Number(d.daily_views) > 0 && (
                            <span className="text-[10px] text-sky-500 font-medium">
                              {Number(d.daily_views).toLocaleString()} lượt/ngày
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-700 tabular-nums">{fmt(d.cost)} đ</td>
                    </tr>
                  );
                })}
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
  const isDirect = campaign.traffic_type === 'direct';
  const [dailyViews, setDailyViews] = useState(campaign.daily_views != null ? Number(campaign.daily_views) : 0);
  const [useDirectDailyLimit, setUseDirectDailyLimit] = useState(() => isDirect && Number(campaign.daily_views) > 0);
  const toggleDirectDailyLimit = () => {
    setUseDirectDailyLimit(v => {
      if (v) { setDailyViews(0); setViewByHour(false); }
      return !v;
    });
  };
  const [note, setNote] = useState(campaign.note || '');

  const [useKeywordDailyViews, setUseKeywordDailyViews] = useState(() => {
    try {
      const cfg = campaign.keyword_config ? JSON.parse(campaign.keyword_config) : null;
      return Array.isArray(cfg) && cfg.some(k => Number(k.daily_views) > 0);
    } catch { return false; }
  });

  const [useKeywordUrls, setUseKeywordUrls] = useState(() => {
    try {
      const cfg = campaign.keyword_config ? JSON.parse(campaign.keyword_config) : null;
      return Array.isArray(cfg) && cfg.some(k => (k.url && k.url.trim()) || (k.image && k.image.trim()));
    } catch { return false; }
  });

  const [keywords, setKeywords] = useState(() => {
    const kwList = parseJsonArray(campaign.keyword);
    try {
      const cfg = campaign.keyword_config ? JSON.parse(campaign.keyword_config) : null;
      if (Array.isArray(cfg) && cfg.length > 0) {
        return kwList.map(kw => {
          const found = cfg.find(c => c.keyword === kw);
          return {
            keyword: kw,
            views: found ? Number(found.views) : Number(campaign.total_views) || 1000,
            daily_views: found ? Number(found.daily_views) || 0 : 0,
            url: found?.url || found?.domain || '',
            images: found?.images ? (Array.isArray(found.images) ? found.images : [found.images]) : (found?.image ? [found.image] : ['']),
            device: found?.device || 'both',
            mobilePct: found?.mobilePct ?? 50,
          };
        });
      }
    } catch { }
    return kwList.map(kw => ({ keyword: kw, views: Number(campaign.total_views) || 1000, daily_views: 0, url: '', images: [''], device: 'both', mobilePct: 50 }));
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
  const [viewByHour, setViewByHour] = useState(!!campaign.view_by_hour);

  // Device targeting
  const [selectedDevices, setSelectedDevices] = useState(() => {
    const dev = (campaign.device || 'desktop,mobile').toLowerCase();
    return {
      desktop: dev.includes('desktop'),
      mobile: dev.includes('mobile'),
    };
  });
  const toggleDevice = (d) => setSelectedDevices(prev => ({
    ...prev,
    [d]: !prev[d],
  }));

  const addKeyword = () => setKeywords(prev => [...prev, {
    keyword: '', url: '', images: [''], daily_views: 0, views: Number(campaign.total_views) || 1000,
    device: 'both', mobilePct: 50,
  }]);
  const removeKeyword = (idx) => setKeywords(prev => prev.filter((_, i) => i !== idx));
  const updateKeywordText = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, keyword: val } : k));
  const updateKeywordUrl = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, url: val } : k));
  const updateKeywordImage = (kwIdx, imgIdx, val) => setKeywords(prev => prev.map((k, i) => {
    if (i !== kwIdx) return k;
    const newImages = [...(k.images || [''])];
    newImages[imgIdx] = val;
    return { ...k, images: newImages };
  }));
  const addKeywordImage = (kwIdx) => setKeywords(prev => prev.map((k, i) => i === kwIdx ? { ...k, images: [...(k.images || ['']), ''] } : k));
  const removeKeywordImage = (kwIdx, imgIdx) => setKeywords(prev => prev.map((k, i) => {
    if (i !== kwIdx) return k;
    return { ...k, images: (k.images || ['']).filter((_, j) => j !== imgIdx) };
  }));
  const updateKeywordDailyViews = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, daily_views: Number(val) || 0 } : k));
  const updateKeywordViews = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, views: Number(val) || 0 } : k));
  const toggleKeywordDailyViews = () => {
    if (useKeywordDailyViews) setKeywords(prev => prev.map(k => ({ ...k, daily_views: 0 })));
    setUseKeywordDailyViews(v => !v);
  };

  const updateKeywordDevice = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, device: val } : k));
  const updateKeywordMobilePct = (idx, val) => setKeywords(prev => prev.map((k, i) => i === idx ? { ...k, mobilePct: Math.min(100, Math.max(0, Number(val) || 0)) } : k));

  const addUrlItem = () => setUrls(prev => [...prev, '']);
  const removeUrlItem = (idx) => setUrls(prev => prev.filter((_, i) => i !== idx));
  const updateUrlItem = (idx, val) => setUrls(prev => prev.map((v, i) => i === idx ? val : v));

  const addImgItem = () => setImageUrls(prev => [...prev, '']);
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
  const [uploadingKwImgIdx, setUploadingKwImgIdx] = useState(-1);
  const handleKeywordImageUpload = async (e, kwIdx, imgIdx) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingKwIdx(kwIdx);
    setUploadingKwImgIdx(imgIdx);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/campaigns/upload-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      updateKeywordImage(kwIdx, imgIdx, data.imageUrl);
    } catch (err) { toast.error(err.message); }
    finally { setUploadingKwIdx(-1); setUploadingKwImgIdx(-1); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validKws = keywords.filter(k => k.keyword.trim());
      const u = validKws.map(k => k.url).filter(x => x && x.trim());
      const allKeywordImages = validKws.flatMap(k =>
        (k.images || []).filter(img => img && img.trim())
      );
      const globalImg = imageUrls[0]?.trim();
      const allImages = globalImg ? [globalImg, ...allKeywordImages] : allKeywordImages;

      // computedTotal = tổng views từng keyword (không cho nhập tay)
      const computedTotal = isDirect
        ? (Number(keywords[0]?.views) || Number(campaign.total_views))
        : (validKws.reduce((s, k) => s + (Number(k.views) || 0), 0) || Number(campaign.total_views));

      const keywordConfig = validKws.map(k => ({
        keyword: k.keyword,
        views: Number(k.views) || Math.max(1, Math.floor(computedTotal / Math.max(1, validKws.length))),
        daily_views: Number(k.daily_views) || 0,
        url: k.url || '',
        images: (k.images || []).filter(img => img && img.trim()),
        device: k.device || 'both',
        mobilePct: k.mobilePct ?? 50,
      }));

      const kwDailySum = keywordConfig.reduce((s, k) => s + (Number(k.daily_views) || 0), 0);
      const finalDailyViews = isDirect
        ? (useDirectDailyLimit ? Number(dailyViews) || 0 : 0)
        : useKeywordDailyViews ? kwDailySum : (Number(dailyViews) || 0);

      const finalUrl = urls[0]?.trim() || '';
      const finalKeyword = isDirect
        ? JSON.stringify([finalUrl])
        : JSON.stringify(validKws.map(k => k.keyword));
      const finalKeywordConfig = isDirect
        ? JSON.stringify([{ keyword: finalUrl, views: computedTotal, daily_views: finalDailyViews, url: finalUrl, images: [] }])
        : JSON.stringify(keywordConfig);

      await api.put(`/campaigns/${campaign.id}`, {
        dailyViews: finalDailyViews,
        viewByHour: viewByHour ? 1 : 0,
        keyword: finalKeyword,
        keyword_config: finalKeywordConfig,
        totalViews: computedTotal,
        total_views: computedTotal,
        url: finalUrl || u[0] || '',
        url2: JSON.stringify([]),
        image1_url: allImages.length ? JSON.stringify(allImages) : null,
        image2_url: null,
        note: note || null,
        device: 'desktop,mobile',
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

          {/* Direct: chỉ URL đích — Non-direct: URL mặc định + Ảnh + Keywords */}
          {isDirect ? (
            /* ── Direct: URL đích + view tổng + view/ngày (inline toggle giống Search) ── */
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">URL đích</label>
                <input
                  type="text"
                  value={urls[0] || ''}
                  onChange={e => setUrls([e.target.value])}
                  placeholder="https://example.com"
                  className={input}
                />
                <p className="mt-1 text-xs text-slate-400">Visitor sẽ truy cập trực tiếp vào URL này</p>
              </div>

              {/* Tổng view + View/ngày — 2 cột, toggle inline giống Search */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Tổng view</label>
                  <div className="relative">
                    <input
                      type="number" min="1"
                      value={keywords[0]?.views || 0}
                      onChange={e => updateKeywordViews(0, e.target.value)}
                      className={input + ' pr-14'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-amber-500 font-bold pointer-events-none">view</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Đã chạy: <strong className="text-emerald-600">{Number(campaign.views_done || 0).toLocaleString()}</strong> view</p>
                </div>
                <div>
                  {/* Label + toggle nhỏ inline — giống Search "View/ngày riêng" */}
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">View / ngày</label>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-semibold transition-colors ${useDirectDailyLimit ? 'text-sky-600' : 'text-slate-400'}`}>
                        {useDirectDailyLimit ? 'Bật' : 'Tắt'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={useDirectDailyLimit}
                        onClick={toggleDirectDailyLimit}
                        className={`relative inline-flex h-4 w-8 flex-shrink-0 rounded-full border-2 border-transparent cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none ${useDirectDailyLimit ? 'bg-sky-500' : 'bg-slate-200'}`}
                      >
                        <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${useDirectDailyLimit ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                  {useDirectDailyLimit ? (
                    <div className="relative">
                      <input
                        type="number" min="1"
                        value={dailyViews || ''}
                        onChange={e => setDailyViews(Number(e.target.value) || 0)}
                        placeholder="Số view/ngày..."
                        className={input + ' pr-20'}
                        autoFocus
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sky-600 font-bold bg-sky-50 px-1.5 py-0.5 rounded pointer-events-none">view/ngày</span>
                    </div>
                  ) : (
                    <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-400 font-medium">
                      Không giới hạn
                    </div>
                  )}
                </div>
              </div>

              {/* Chia view theo giờ — chỉ hiện khi daily ON và có giá trị */}
              {useDirectDailyLimit && Number(dailyViews) > 0 && (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs font-bold text-slate-700">Chia view theo giờ</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Phân bổ đều trong 24h (~{Math.ceil(Number(dailyViews) / 24).toLocaleString()} view/giờ)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewByHour(v => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${viewByHour ? 'bg-indigo-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${viewByHour ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── Non-direct: URL mặc định + Ảnh ── */
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">URL đích (mặc định)</label>
                <input
                  type="text"
                  value={urls[0] || ''}
                  onChange={e => setUrls([e.target.value])}
                  placeholder="https://example.com"
                  className={input}
                />
                <p className="mt-1 text-xs text-slate-400">URL mặc định khi từ khóa không có URL riêng</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Ảnh chiến dịch (mặc định)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={imageUrls[0] || ''}
                    onChange={e => setImageUrls([e.target.value])}
                    placeholder="https://... hoặc Ctrl+V dán ảnh"
                    onPaste={async e => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (let j = 0; j < items.length; j++) {
                        const item = items[j];
                        if (item.type.startsWith('image/')) {
                          e.preventDefault();
                          const file = item.getAsFile();
                          if (!file) return;
                          setUploadingIdx(0);
                          try {
                            const fd = new FormData();
                            fd.append('image', file);
                            const token = localStorage.getItem('token');
                            const res = await fetch('/api/campaigns/upload-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Upload thất bại');
                            setImageUrls([data.imageUrl]);
                          } catch (err) { toast.error(err.message); }
                          finally { setUploadingIdx(-1); }
                          break;
                        }
                      }
                    }}
                    className={input + ' flex-1'}
                  />
                  <label className="flex items-center justify-center p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition flex-shrink-0">
                    {uploadingIdx === 0 ? <RefreshCw size={14} className="animate-spin text-slate-400" /> : <Upload size={14} className="text-slate-500" />}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 0)} />
                  </label>
                </div>
                {imageUrls[0] && (
                  <img src={imageUrls[0]} alt="preview" className="mt-2 h-16 w-auto rounded-lg border border-slate-200 object-cover" />
                )}
                <p className="mt-1 text-xs text-slate-400">Ảnh mặc định khi từ khóa không có ảnh riêng</p>
              </div>
            </div>
          )}

          {/* Keywords — chỉ hiện với non-direct */}
          {!isDirect && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Từ khóa tìm kiếm</label>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold transition-colors ${useKeywordDailyViews ? 'text-sky-600' : 'text-slate-400'}`}>
                    View/ngày riêng
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useKeywordDailyViews}
                    onClick={toggleKeywordDailyViews}
                    className={`relative inline-flex h-4 w-8 flex-shrink-0 rounded-full border-2 border-transparent cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none ${useKeywordDailyViews ? 'bg-sky-500' : 'bg-slate-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${useKeywordDailyViews ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {/* Info box + Quick-apply views */}
              {(() => {
                const allocDV = keywords.reduce((s, k) => s + (Number(k.daily_views) || 0), 0);
                const totalViewsPreview = keywords.filter(k => k.keyword.trim()).reduce((s, k) => s + (Number(k.views) || 0), 0);
                const hasAny = allocDV > 0;
                const unsetCount = keywords.filter(k => !(Number(k.daily_views) > 0)).length;
                const effectiveGlobal = Number(dailyViews) || 0;
                const autoPerKw = (hasAny && unsetCount > 0 && effectiveGlobal > 0)
                  ? Math.floor(Math.max(0, effectiveGlobal - allocDV) / unsetCount)
                  : 0;
                return (
                  <div className="mb-3 space-y-2">
                    {/* Quick apply views to all keywords */}
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <span className="text-[11px] font-bold text-amber-700 whitespace-nowrap">Apply tất cả:</span>
                      <input
                        type="number" min="1"
                        placeholder="Số view/keyword..."
                        className="flex-1 px-2 py-1 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30 text-amber-900 font-bold"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const v = Number(e.target.value);
                            if (v > 0) { keywords.forEach((_, i) => updateKeywordViews(i, v)); e.target.value = ''; }
                          }
                        }}
                      />
                      <span className="text-[10px] text-amber-500 font-medium whitespace-nowrap">view/kw → Enter</span>
                    </div>
                    <div className="flex items-start gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2.5">
                      <BarChart3 size={13} className="text-sky-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-sky-700">
                        <strong>Tổng view:</strong> <b className="text-amber-600">{totalViewsPreview.toLocaleString()}</b> view
                        {' · '}<strong>View/ngày:</strong> Để <b>0</b> = không giới hạn
                        {unsetCount > 0 && autoPerKw > 0 && (
                          <> ({autoPerKw.toLocaleString()}/ngày ÷ {unsetCount} từ khóa)</>
                        )}.
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3">
                {keywords.map((kw, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl relative">
                    {/* Row 1: keyword + views + daily_views + delete */}
                    <div className="flex gap-2 items-center">
                      <input
                        type="text" value={kw.keyword}
                        onChange={e => updateKeywordText(i, e.target.value)}
                        placeholder={`Từ khóa ${i + 1}`}
                        className={input + ' flex-1'}
                      />
                      <div className="relative w-24 flex-shrink-0">
                        <input
                          type="number" min="1"
                          value={kw.views || 0}
                          onChange={e => updateKeywordViews(i, e.target.value)}
                          className="w-full px-2 py-2.5 text-sm border border-amber-200 rounded-xl bg-amber-50
                                   focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400
                                   transition pr-10 text-right text-amber-900 font-bold"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 font-bold pointer-events-none">view</span>
                      </div>
                      {useKeywordDailyViews && (
                        <div className="relative w-24 flex-shrink-0">
                          <input
                            type="number" min="0"
                            value={kw.daily_views || 0}
                            onChange={e => updateKeywordDailyViews(i, e.target.value)}
                            className="w-full px-2 py-2.5 text-sm border border-sky-200 rounded-xl bg-sky-50
                                     focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400
                                     transition pr-12 text-right text-sky-900 font-bold"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sky-500 font-bold pointer-events-none">/ngày</span>
                        </div>
                      )}
                      {keywords.length > 1 && (
                        <button onClick={() => removeKeyword(i)} className="p-2 w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-xl transition flex-shrink-0 absolute -top-2 -right-2 shadow-sm z-10">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    {/* Row 2: URL + Images (always shown) */}
                    <div className="flex gap-2 items-start">
                      <input
                        type="text" value={kw.url}
                        onChange={e => updateKeywordUrl(i, e.target.value)}
                        placeholder="URL đích riêng (Tuỳ chọn)"
                        className={input + ' flex-1 text-xs'}
                      />
                      <div className="flex-1 space-y-2">
                        {(kw.images || ['']).map((img, imgIdx) => (
                          <div key={imgIdx} className="flex gap-2">
                            <input
                              type="text" value={img}
                              onChange={e => updateKeywordImage(i, imgIdx, e.target.value)}
                              onPaste={async e => {
                                const items = e.clipboardData?.items;
                                if (!items) return;
                                for (let j = 0; j < items.length; j++) {
                                  const item = items[j];
                                  if (item.type.startsWith('image/')) {
                                    e.preventDefault();
                                    const file = item.getAsFile();
                                    if (file) handleKeywordImageUpload({ target: { files: [file] } }, i, imgIdx);
                                    break;
                                  }
                                }
                              }}
                              placeholder={`Link Image ${imgIdx + 1} - Ctrl+V dán ảnh`}
                              className={input + ' flex-1 text-xs'}
                            />
                            <label className="flex items-center justify-center p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition flex-shrink-0">
                              {uploadingKwIdx === i && uploadingKwImgIdx === imgIdx ? <RefreshCw size={14} className="animate-spin text-slate-400" /> : <Upload size={14} className="text-slate-500" />}
                              <input type="file" accept="image/*" className="hidden" onChange={e => handleKeywordImageUpload(e, i, imgIdx)} />
                            </label>
                            {(kw.images || []).length > 1 && (
                              <button type="button" onClick={() => removeKeywordImage(i, imgIdx)}
                                className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex-shrink-0">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => addKeywordImage(i)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                          <Plus size={14} /> Thêm ảnh
                        </button>
                      </div>
                    </div>
                    {/* Device targeting per keyword */}
                    <div className="flex items-center gap-2 mt-1 p-2 bg-teal-50 border border-teal-100 rounded-lg">
                      <span className="text-[10px] font-bold text-teal-700 whitespace-nowrap">Thiết bị:</span>
                      {[
                        { value: 'both', label: 'Cả hai' },
                        { value: 'desktop', label: 'PC' },
                        { value: 'mobile', label: 'Mobi' },
                      ].map(d => {
                        const active = (kw.device || 'both') === d.value;
                        return (
                          <button key={d.value} type="button"
                            onClick={() => updateKeywordDevice(i, d.value)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all ${active
                              ? 'border-teal-500 bg-teal-200 text-teal-900'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-teal-300'}`}>
                            {d.label}
                          </button>
                        );
                      })}
                      {(kw.device === 'both' || !kw.device) && (
                        <>
                          <input
                            type="range" min="0" max="100" step="5"
                            value={kw.mobilePct ?? 50}
                            onChange={e => updateKeywordMobilePct(i, e.target.value)}
                            className="flex-1 accent-teal-600 h-1"
                            style={{ minWidth: 60 }}
                          />
                          <span className="text-[10px] font-black text-teal-800 bg-white border border-teal-200 px-1.5 py-0.5 rounded tabular-nums whitespace-nowrap">
                            M:{kw.mobilePct ?? 50}% P:{100 - (kw.mobilePct ?? 50)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addKeyword} className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition">
                <Plus size={13} /> Thêm từ khóa
              </button>
            </div>
          )}{/* end !isDirect keywords */}

          {/* Daily views + Tổng view preview — chỉ cho non-direct (direct có preview riêng ở trên) */}
          {!isDirect && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">View / ngày (tổng)</label>
                {useKeywordDailyViews ? (
                  <>
                    {(() => {
                      const kwSum = keywords.filter(k => k.keyword.trim()).reduce((s, k) => s + (Number(k.daily_views) || 0), 0);
                      return (
                        <div className="px-3.5 py-2.5 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between">
                          {kwSum > 0
                            ? <span className="text-base font-black text-sky-700 tabular-nums">{kwSum.toLocaleString()}</span>
                            : <span className="text-base font-black text-slate-400">∞</span>
                          }
                          <span className="text-xs text-sky-500 font-bold">{kwSum > 0 ? 'view/ngày' : 'không giới hạn'}</span>
                        </div>
                      );
                    })()}
                    <p className="mt-1 text-xs text-slate-400">Tính từ từng từ khóa</p>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <input type="number" min="0" value={dailyViews} onChange={e => setDailyViews(e.target.value)} className={input + ' pr-24'} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md">view/ngày</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">0 = không giới hạn (chung toàn camp)</p>
                  </>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Tổng view</label>
                {(() => {
                  const preview = keywords.filter(k => k.keyword.trim()).reduce((s, k) => s + (Number(k.views) || 0), 0) || Number(campaign.total_views);
                  return (
                    <div className="px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                      <span className="text-base font-black text-amber-700 tabular-nums">{preview.toLocaleString()}</span>
                      <span className="text-xs text-amber-500 font-bold">view</span>
                    </div>
                  );
                })()}
                <p className="mt-1 text-xs text-slate-400">Đã chạy: <strong className="text-emerald-600">{Number(campaign.views_done || 0).toLocaleString()}</strong> view · Tổng tính từ các từ khóa</p>
              </div>
            </div>
          )}

          {/* Chia view theo giờ — chỉ hiện cho non-direct (direct có toggle riêng ở trên) */}
          {!isDirect && (() => {
            const kwDailySum = keywords.reduce((s, k) => s + (Number(k.daily_views) || 0), 0);
            const effectiveDaily = kwDailySum > 0 ? kwDailySum : Number(dailyViews);
            if (effectiveDaily <= 0) return null;
            return (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-slate-700">Chia view theo giờ</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Phân bổ đều trong 24h (~{Math.ceil(effectiveDaily / 24).toLocaleString()} view/giờ)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewByHour(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${viewByHour ? 'bg-indigo-500' : 'bg-slate-300'
                    }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${viewByHour ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                </button>
              </div>
            );
          })()}




          {/* Ghi chú */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Ghi chú (tùy chọn)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Ghi chú nội bộ cho chiến dịch..."
              className={input + ' resize-none'}
            />
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

/* ── Renew Modal ── */
function RenewModal({ campaign, onClose, onRenewed }) {
  const toast = useToast();
  const [extraViews, setExtraViews] = useState(1000);
  const [renewing, setRenewing] = useState(false);
  const cpc = Number(campaign.cpc) || 0;
  const cost = Math.round(extraViews * cpc);

  const handleRenew = async () => {
    if (!extraViews || extraViews <= 0) return;
    setRenewing(true);
    try {
      await api.post(`/campaigns/${campaign.id}/renew`, { extraViews });
      toast.success(`Gia hạn thành công! Đã thêm ${extraViews.toLocaleString()} view.`);
      onRenewed();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRenewing(false);
    }
  };

  const presets = [500, 1000, 2000, 5000, 10000];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <RotateCcw size={15} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Gia hạn chiến dịch</h3>
              <p className="text-xs text-slate-400 truncate max-w-[260px]">{campaign.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Campaign info */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wide mb-0.5">Đã hoàn thành</p>
              <p className="text-sm font-black text-indigo-800">{Number(campaign.views_done || 0).toLocaleString()} / {Number(campaign.total_views || 0).toLocaleString()} view</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Đơn giá CPC</p>
              <p className="text-sm font-black text-slate-700">{fmt(cpc)} đ/view</p>
            </div>
          </div>

          {/* Quick presets */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chọn nhanh số view gia hạn</p>
            <div className="flex flex-wrap gap-2">
              {presets.map(v => (
                <button key={v} onClick={() => setExtraViews(v)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${extraViews === v
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}>
                  {v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Custom input */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Hoặc nhập số view tùy chỉnh</label>
            <div className="relative">
              <input
                type="number" min="100" step="100"
                value={extraViews}
                onChange={e => setExtraViews(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md">view</span>
            </div>
          </div>

          {/* Cost preview */}
          <div className={`rounded-xl px-4 py-3.5 border transition-all ${cost > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
            }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Chi phí gia hạn</p>
                <p className={`text-xl font-black tabular-nums mt-0.5 ${cost > 0 ? 'text-emerald-700' : 'text-slate-400'
                  }`}>{cost > 0 ? `${fmt(cost)} đ` : '—'}</p>
              </div>
              {cost > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-medium">Sau gia hạn: tổng view</p>
                  <p className="text-sm font-black text-slate-700">{(Number(campaign.total_views) + extraViews).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Hủy</button>
          <button onClick={handleRenew} disabled={renewing || cost <= 0}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl transition shadow-md shadow-indigo-200 disabled:opacity-50 active:scale-95">
            <RotateCcw size={14} className={renewing ? 'animate-spin' : ''} />
            {renewing ? 'Đang gia hạn...' : `Gia hạn – ${fmt(cost)} đ`}
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
  const [renewingCampaign, setRenewingCampaign] = useState(null);
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
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Chiến dịch', 'Trạng thái', 'Tổng tiến độ', 'Ngân sách', 'Hành động'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody><SkTableRows rows={6} cols={5} /></tbody>
            </table>
          </div>
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
                const keywords = (() => {
                  try { return JSON.parse(c.keyword); } catch { return [c.keyword || '']; }
                })();

                // Tính total_views thực = tổng views từng keyword trong keyword_config
                const totalViewsReal = (() => {
                  try {
                    const cfg = c.keyword_config ? JSON.parse(c.keyword_config) : null;
                    if (Array.isArray(cfg) && cfg.length > 0) {
                      const sum = cfg.reduce((s, k) => s + (Number(k.views) || 0), 0);
                      if (sum > 0) return sum;
                    }
                  } catch { }
                  return Number(c.total_views) || 0;
                })();

                const isDone = Number(c.views_done) >= totalViewsReal && totalViewsReal > 0;
                const effStatus = isDone ? 'completed' : c.status;
                const isExpanded = expandedId === c.id;
                const pct = totalViewsReal > 0
                  ? Math.min(Math.round(Number(c.views_done) / totalViewsReal * 100), 100) : 0;
                const barColor = effStatus === 'completed' ? '#6366f1' : effStatus === 'running' ? '#10b981' : '#f59e0b';

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
                          {c.note && (
                            <p className="text-[11px] text-slate-500 mt-1 italic truncate max-w-[240px]" title={c.note}>
                              📝 {c.note}
                            </p>
                          )}
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
                        <StatusBadge status={effStatus} pauseReason={effStatus === 'paused' ? c.pause_reason : null} />
                      </td>

                      {/* Progress */}
                      <td className="px-5 py-4 text-right align-top pt-5">
                        <div className="flex flex-col items-end w-36 ml-auto">
                          <div className="flex justify-between w-full mb-1.5">
                            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{fmt(c.views_done)}<span className="text-slate-300">/{fmt(totalViewsReal)}</span></span>
                            <span className="text-[12px] font-black tabular-nums" style={{ color: barColor }}>{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          {/* daily_views thực = tổng daily_views từng keyword trong keyword_config */}
                          {(() => {
                            const dailyViewsReal = (() => {
                              try {
                                const cfg = c.keyword_config ? JSON.parse(c.keyword_config) : null;
                                if (Array.isArray(cfg) && cfg.length > 0) {
                                  const sum = cfg.reduce((s, k) => s + (Number(k.daily_views) || 0), 0);
                                  if (sum > 0) return sum;
                                }
                              } catch { }
                              return Number(c.daily_views) || 0;
                            })();
                            return dailyViewsReal > 0 ? (
                              <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                Hôm nay: <span className="text-indigo-600 font-bold">{fmt(c.views_today || 0)}</span>/{fmt(dailyViewsReal)}/ngày
                              </p>
                            ) : (c.views_today > 0 ? (
                              <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                Hôm nay: <span className="font-semibold">{fmt(c.views_today)}</span> view
                              </p>
                            ) : null);
                          })()}
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

                          {effStatus === 'completed' ? (
                            /* Gia hạn — chỉ hiện khi completed */
                            <button onClick={() => setRenewingCampaign(c)} title="Gia hạn chiến dịch"
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300">
                              <RotateCcw size={13} />
                              <span className="hidden sm:inline">Gia hạn</span>
                            </button>
                          ) : (
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
                            <KeywordStats campaignId={c.id} trafficType={c.traffic_type} campaignUrl={c.url} />
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

      {/* Renew Modal */}
      {renewingCampaign && (
        <RenewModal campaign={renewingCampaign} onClose={() => setRenewingCampaign(null)} onRenewed={fetchCampaigns} />
      )}
    </div>
  );
}