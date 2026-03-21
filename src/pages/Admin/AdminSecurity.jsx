import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Shield, Search, RefreshCw, X, Eye, Copy, Check,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '../../lib/api';

const timeAgo = (dateStr) => {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
};
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const WARNING_VI = {
  'linear_movement': 'Di chuột thẳng tuyệt đối',
  'constant_velocity': 'Tốc độ chuột không đổi',
  'no_micro_jitter': 'Không có rung lắc tay nhỏ',
  'fake_timestamps': 'Thời gian di chuột giả mạo',
  'regular_intervals': 'Thời gian giữa các điểm chuột đều như máy',
  'no_hover_before_click': 'Click ngay không rê chuột qua vùng xung quanh',
  'constant_dwell_time': 'Nhấn giữ phím đều nhau',
  'constant_flight_time': 'Gõ phím đều nhau',
  'no_typos': 'Gõ nhiều nhưng không có lỗi chính tả',
  'no_scroll_pauses': 'Cuộn trang liên tục không dừng đọc',
  'uniform_scroll_speed': 'Tốc độ cuộn trang đều',
  'raf_unstable': 'Trình duyệt không render ổn định',
  'zero_screen': 'Không có màn hình',
  'vm_screen': 'Độ phân giải giống máy ảo',
  'exact_center_clicks': 'Click chính xác vào tâm nút',
  'zero_plugins': 'Trình duyệt không có plugin',
  'zero_rtt': 'Độ trễ mạng bằng 0',
  'zero_languages': 'Không có ngôn ngữ trong trình duyệt',
};

function CopyId({ text }) {
  const [copied, setCopied] = useState(false);
  if (!text || text === 'null') return <span className="text-slate-400">—</span>;
  const short = text.length > 12 ? text.slice(0, 6) + '…' + text.slice(-4) : text;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
      {short}
      <button
        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="p-0.5 rounded hover:bg-slate-200 transition"
        title="Sao chép"
      >
        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400" />}
      </button>
    </span>
  );
}

function DetailModal({ event: ev, onClose }) {
  const catNames = { mouse: '🖱️ Chuột', keyboard: '⌨️ Bàn phím', scroll: '📜 Cuộn trang', focus: '👁️ Hiển thị', click: '🎯 Click' };
  const reasonLabels = {
    creep_detected: 'Giả mạo trình duyệt',
    automation_probes: 'Sử dụng công cụ tự động hóa',
    mouse_bot: 'Hành vi không tự nhiên — bot',
    bot_ua: 'User-Agent bot/crawler',
    suspicious: 'Có dấu hiệu đáng ngờ',
    probe_warning: 'Phát hiện dấu hiệu tự động hóa',
  };
  const isBlocked = ['creep_detected', 'automation_probes', 'mouse_bot', 'bot_ua', 'zero_screen', 'ip_rate_limit'].includes(ev.reason);

  let detailItems = [];
  let assessments = [];
  try {
    const d = JSON.parse(ev.details || '{}');
    if (d.assessments && Array.isArray(d.assessments)) assessments = d.assessments;

    const bScore = d.behaviorScore ?? d.score;
    if (bScore !== undefined) {
      detailItems.push({ label: 'Điểm hành vi tổng', value: `${bScore} / 70 (ngưỡng chặn)`, danger: bScore >= 70, warn: bScore > 0 && bScore < 70 });
    }

    const bd = d.botDetection || (d.totalLied !== undefined ? d : null);
    if (bd) {
      if (bd.totalLied !== undefined) {
        detailItems.push({ label: 'Tổng mục giả mạo', value: bd.totalLied, danger: bd.totalLied > 0 });
        if (bd.liedSections?.length > 0) detailItems.push({ label: 'Các mục bị giả mạo', value: (Array.isArray(bd.liedSections) ? bd.liedSections : []).join(', '), danger: true });
      }
      if (bd.bot !== undefined) detailItems.push({ label: 'Bot', value: bd.bot ? 'Có' : 'Không', danger: !!bd.bot });
      if (bd.headless != null) detailItems.push({ label: 'Headless', value: bd.headless ? 'Có' : 'Không', danger: !!bd.headless });
      if (bd.stealth != null) detailItems.push({ label: 'Stealth mode', value: bd.stealth ? 'Có' : 'Không', danger: !!bd.stealth });
      if (bd.creepError) detailItems.push({ label: 'Xác minh trình duyệt', value: 'Không load được', warn: true });
      if (bd.creepTimeout) detailItems.push({ label: 'Xác minh trình duyệt', value: 'Quá thời gian', warn: true });
    }

    const probes = d.probes || {};
    if (probes.webdriver) detailItems.push({ label: 'Webdriver', value: 'Có', danger: true });
    if (probes.selenium) detailItems.push({ label: 'Selenium', value: 'Có', danger: true });
    if (probes.cdc) detailItems.push({ label: 'Chrome DevTools Protocol', value: 'Có', danger: true });
    if (probes.pluginCount !== undefined) detailItems.push({ label: 'Plugin trình duyệt', value: probes.pluginCount, warn: probes.pluginCount === 0 });
    if (probes.rtt !== undefined) detailItems.push({ label: 'RTT', value: `${probes.rtt}ms`, warn: probes.rtt === 0 });

    if (d.screen) detailItems.push({ label: 'Màn hình', value: `${d.screen.w}×${d.screen.h} (${d.screen.dpr || 1}x)` });
    if (d.countdownTime) detailItems.push({ label: 'Đếm ngược', value: `${d.countdownTime}s` });

    if (d.probeWarnings && Array.isArray(d.probeWarnings)) {
      d.probeWarnings.forEach(w => detailItems.push({ label: WARNING_VI[w] || w, value: 'Phát hiện', warn: true }));
    }

    if (!d.assessments && !d.botDetection && d.totalLied === undefined && !d.probeWarnings) {
      Object.entries(d).forEach(([k, v]) => {
        if (['behaviorScore', 'score', 'assessments', 'botDetection', 'probes', 'screen', 'countdownTime', 'warnings'].includes(k)) return;
        if (v === undefined || v === null || v === '') return;
        let val = v;
        if (typeof v === 'boolean') val = v ? 'Có' : 'Không';
        else if (Array.isArray(v)) val = v.map(i => WARNING_VI[i] || i).join(', ');
        else if (typeof v === 'object') val = JSON.stringify(v);
        detailItems.push({ label: k, value: String(val) });
      });
    }
  } catch { detailItems.push({ label: 'Dữ liệu thô', value: ev.details }); }

  const grouped = {};
  assessments.forEach(a => { if (!grouped[a.cat]) grouped[a.cat] = []; grouped[a.cat].push(a); });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className={`px-6 py-4 rounded-t-2xl flex items-center justify-between ${isBlocked ? 'bg-red-50' : 'bg-amber-50'}`}>
          <div>
            <h3 className="text-sm font-black text-slate-800">Chi tiết bảo mật</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(ev.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition"><X size={16} className="text-slate-500" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className={`p-3 rounded-xl border text-sm font-semibold ${isBlocked ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            {isBlocked ? '🚫 ' : '⚠️ '}{reasonLabels[ev.reason] || ev.reason}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Nguồn</p>
              <p className="font-semibold text-slate-700">{ev.source === 'widget' ? 'Script nhúng' : ev.source === 'vuotlink' ? 'Vượt link' : ev.source}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">IP</p>
              <p className="font-mono font-semibold text-slate-700">{ev.ip_address}</p>
            </div>
            <div className="col-span-2 bg-slate-50 rounded-lg p-3">
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Mã thiết bị</p>
              <p className="font-mono text-slate-700 text-[11px] break-all">{ev.visitor_id || '—'}</p>
            </div>
          </div>

          {detailItems.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Đánh giá hệ thống</p>
              <div className="space-y-1.5">
                {detailItems.map((item, i) => (
                  <div key={i} className={`flex items-start justify-between px-3 py-2 rounded-lg text-xs ${item.danger ? 'bg-red-50' : item.warn ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <span className={`font-medium ${item.danger ? 'text-red-700' : item.warn ? 'text-amber-700' : 'text-slate-600'}`}>
                      {item.danger ? '🔴 ' : item.warn ? '🟡 ' : '⚪ '}{item.label}
                    </span>
                    <span className={`font-bold text-right max-w-[50%] break-all ${item.danger ? 'text-red-800' : item.warn ? 'text-amber-800' : 'text-slate-800'}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(grouped).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Phân tích hành vi chi tiết</p>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-bold text-slate-700 mb-1.5">{catNames[cat] || cat}</p>
                  <div className="space-y-1">
                    {items.map((a, i) => (
                      <div key={i} className={`px-3 py-2 rounded-lg text-[11px] border ${a.flagged ? 'bg-red-50 border-red-200' : a.flagged === false ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`font-semibold ${a.flagged ? 'text-red-700' : a.flagged === false ? 'text-green-700' : 'text-slate-600'}`}>
                          {a.flagged ? '🔴' : a.flagged === false ? '🟢' : 'ℹ️'} {a.note}
                        </span>
                        <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                          <span>Giá trị: <b className="text-slate-700">{String(a.value)}</b></span>
                          {a.threshold && <span>Ngưỡng: <b className="text-slate-700">{a.threshold}</b></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition">Đóng</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSecurity() {
  usePageTitle('Admin - Bảo mật');
  const [securityLogs, setSecurityLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detailEvent, setDetailEvent] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const limit = 30;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/security', { params: { search, page, limit } });
      console.log('[Security] API response:', data);
      setSecurityLogs(data.securityLogs || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (ev) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/admin/security/${ev.id}`);
      setDetailEvent(data.event);
    } catch (e) {
      setDetailEvent({ ...ev, details: '{}' });
    }
    setDetailLoading(false);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Bảo mật & Chống Bot</h1>
            <p className="text-xs text-slate-500">{total.toLocaleString('vi-VN')} sự kiện (7 ngày gần nhất)</p>
          </div>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm IP hoặc Mã thiết bị..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Thời gian</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Nguồn</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Loại</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Địa chỉ IP</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Mã thiết bị</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Kết quả</th>
                <th className="text-center px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">Đang tải...</td></tr>
              ) : securityLogs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">Chưa có sự kiện bảo mật nào</td></tr>
              ) : securityLogs.map(ev => {
                const reasonLabels = {
                  creep_detected: '🔴 Giả mạo', automation_probes: '🔴 Tự động hóa',
                  mouse_bot: '🔴 Bot hành vi', bot_ua: '🔴 Bot UA',
                  suspicious: '🟡 Đáng ngờ', probe_warning: '🟡 Probe',
                  ip_rate_limit: '🔴 Rate limit', zero_screen: '🔴 Headless',
                };
                const sourceVi = { vuotlink: 'Vượt link', widget: 'Script nhúng' };
                const isBlocked = ['creep_detected', 'automation_probes', 'mouse_bot', 'bot_ua', 'zero_screen', 'ip_rate_limit'].includes(ev.reason);
                return (
                  <tr key={ev.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition ${isBlocked ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{timeAgo(ev.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ev.source === 'widget' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                        {sourceVi[ev.source] || ev.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold ${isBlocked ? 'text-red-700' : 'text-amber-700'}`}>
                        {reasonLabels[ev.reason] || ev.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{ev.ip_address}</td>
                    <td className="px-4 py-3"><CopyId text={ev.visitor_id} /></td>
                    <td className="px-4 py-3">
                      {isBlocked
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">🚫 Đã chặn</span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">⚠️ Cảnh báo</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openDetail(ev)}
                        className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition text-[11px] font-bold"
                      >
                        <Eye size={12} className="inline mr-1" />Xem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-[11px] text-slate-500">Trang {page} / {totalPages} ({total.toLocaleString('vi-VN')} sự kiện)</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {detailLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl text-sm text-slate-600 font-semibold">Đang tải chi tiết...</div>
        </div>
      )}
      {detailEvent && <DetailModal event={detailEvent} onClose={() => setDetailEvent(null)} />}
    </div>
  );
}
