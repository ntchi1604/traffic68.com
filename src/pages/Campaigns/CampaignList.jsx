import { useState, useEffect, useMemo, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, Pencil, X, Upload, Plus, Zap, Trash2, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
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

/* ── Keyword Stats Panel ── */
function KeywordStats({ campaignId }) {
  const [stats, setStats] = useState(null);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/campaigns/${campaignId}/keyword-stats`),
      api.get(`/reports/detailed?campaignId=${campaignId}&period=30d`)
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
              ) : daily.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-700 whitespace-nowrap">{d.date?.slice(0, 10)}</td>
                  <td className="px-4 py-2.5 font-bold text-indigo-600 truncate max-w-[150px]">{d.keyword || '(Trống)'}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                    {d.completed} <span className="text-slate-400 font-medium text-[10px]">/ {d.total}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-600">{fmt(d.cost)} đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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
            <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }}
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Chiến dịch</th>
                  <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Trạng thái</th>
                  <th className="px-5 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Nay / Qua</th>
                  <th className="px-5 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Tổng tiến độ</th>
                  <th className="px-5 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Ngân sách</th>
                  <th className="px-5 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest w-24">Hành động</th>
                </tr>
              </thead>
              {pagedList.map(c => {
                const isDone = Number(c.views_done) >= Number(c.total_views) && Number(c.total_views) > 0;
                const effStatus = isDone ? 'completed' : c.status;
                const pct = Number(c.total_views) > 0
                  ? Math.min(Math.round(Number(c.views_done) / Number(c.total_views) * 100), 100)
                  : 0;
                const badge = {
                  running:   { label: 'Đang chạy',  cls: 'bg-green-100 text-green-700 border-green-200',    dot: 'bg-green-500' },
                  paused:    { label: 'Tạm dừng',   cls: 'bg-amber-100 text-amber-700 border-amber-200',    dot: 'bg-amber-400' },
                  completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
                }[effStatus] || { label: effStatus, cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
                const barColor = effStatus === 'completed' ? '#10b981' : effStatus === 'running' ? '#3b82f6' : '#f59e0b';
                const isExpanded = expandedId === c.id;

                return (
                  <tbody key={c.id} className={`border-b border-slate-100 group hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-slate-50/30' : 'bg-white'}`}>
                    <tr>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5 max-w-[280px]">
                          <p className="font-bold text-slate-900 leading-tight truncate" title={c.name}>{c.name}</p>
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-blue-500 hover:text-blue-700 hover:underline truncate" title={c.url}>{c.url}</a>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[9px] font-bold text-indigo-700 uppercase tracking-wider">{SOURCE_LABEL[c.traffic_type] || c.traffic_type}</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold text-slate-600 max-w-[150px] truncate" title={c.keyword}>{c.keyword || 'Không có từ khoá'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top pt-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wide font-bold border ${badge.cls} flex-shrink-0`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} ${effStatus === 'running' ? 'animate-pulse' : ''}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right align-top pt-5 whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <p className="text-sm font-black text-blue-600">{fmt(c.views_today || 0)} <span className="text-slate-400 font-medium text-xs">/ {fmt(c.views_yesterday || 0)}</span></p>
                          <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase">Max {fmt(c.daily_views)}/ngày</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right align-top pt-5">
                        <div className="flex flex-col items-end w-36 ml-auto">
                          <div className="flex justify-between w-full mb-1.5">
                            <span className="text-[11px] font-bold text-slate-800">{fmt(c.views_done)}<span className="text-slate-400 font-medium">/{fmt(c.total_views)}</span></span>
                            <span className="text-[11px] font-black" style={{color: barColor}}>{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right align-top pt-5 whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <p className="text-sm font-black text-slate-800">{fmt(c.budget)} <span className="text-[10px] text-slate-500 font-bold position-relative -top-1">đ</span></p>
                          <p className="text-[10px] font-semibold text-slate-500 mt-1">CPC: {fmt(c.cpc)} đ</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center align-top pt-4">
                        <div className="flex items-center justify-end gap-1.5 sm:opacity-50 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setExpandedId(isExpanded ? null : c.id)} title="Thống kê từ khóa"
                            className={`p-2 rounded-xl transition shadow-sm border ${isExpanded ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-blue-100' : 'bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-800 text-slate-500'}`}>
                            <BarChart3 size={15} />
                          </button>
                          {effStatus !== 'completed' && (
                            <>
                              <button onClick={() => setEditingCampaign(c)} title="Chỉnh sửa"
                                className="p-2 bg-white border border-slate-200 shadow-sm hover:shadow hover:bg-slate-50 text-slate-600 rounded-xl transition">
                                <Pencil size={15} />
                              </button>
                              <button onClick={() => handleToggle(c)} title={c.status === 'running' ? 'Tạm dừng' : 'Chạy lại'}
                                className={`p-2 shadow-sm rounded-xl transition border ${c.status === 'running' ? 'bg-white border-slate-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 text-slate-500' : 'bg-white border-slate-200 hover:bg-green-50 hover:border-green-200 hover:text-green-600 text-slate-500'}`}>
                                {c.status === 'running' ? <Pause size={15} /> : <Play size={15} />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="p-0 border-t border-slate-100 bg-slate-50/80">
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
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-5 py-3 shadow-sm">
          <p className="text-xs text-slate-500">Trang <span className="font-bold text-slate-700">{page}</span> / {totalPages} <span className="text-slate-400">({filtered.length} chiến dịch)</span></p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition">‹ Trước</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc, p, i, arr) => { if (i > 0 && arr[i-1] !== p-1) acc.push('...'); acc.push(p); return acc; }, [])
              .map((p, i) => p === '...' ? <span key={`d${i}`} className="px-1 text-slate-400 text-xs">…</span> : (
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 text-xs font-bold rounded-lg transition ${page===p ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 border border-slate-200 text-slate-600'}`}>{p}</button>
              ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition">Sau ›</button>
          </div>
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