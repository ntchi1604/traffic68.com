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
  return dt.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const WARNING_VI = {
  'linear_movement': 'Di chuột thẳng tuyệt đối',
  'constant_velocity': 'Tốc độ chuột không đổi',
  'no_micro_jitter': 'Không có rung lắc tay nhỏ',
  'fake_timestamps': 'Thời gian di chuột giả mạo',
  'regular_intervals': 'Thời gian giữa các điểm chuột đều như máy',
  'no_hover_before_click': 'Click ngay không rê chuột qua vùng xung quanh',
  'no_scroll_pauses': 'Cuộn trang liên tục không dừng đọc',
  'uniform_scroll_speed': 'Tốc độ cuộn trang đều',
  'jump_scroll': 'Nhảy cóc trang bất thường',
  'exact_center_clicks': 'Click chính xác vào tâm nút',
  'no_interaction': 'Không có tương tác bắt buộc (click/scroll)',
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
  const catNames = { interaction: 'Tương tác bắt buộc', mouse: 'Chuột', scroll: 'Cuộn trang', click: 'Click' };
  const [ipData, setIpData] = useState(null);
  const [ipLoading, setIpLoading] = useState(true);
  useEffect(() => {
    if (ev.ip_address) {
      api.get(`/admin/security/ip/${ev.ip_address}`).then(d => { setIpData(d); setIpLoading(false); }).catch(() => setIpLoading(false));
    } else { setIpLoading(false); }
  }, [ev.ip_address]);
  const reasonLabels = {
    completed: 'Task hoàn thành',
    creep_detected: 'Giả mạo trình duyệt',
    automation_probes: 'Sử dụng công cụ tự động hóa',
    mouse_bot: 'Hành vi không tự nhiên — bot',
    bot_ua: 'User-Agent bot/crawler',
    bot_behavior: 'Phát hiện hành vi bot tự động',
    suspicious: 'Có dấu hiệu đáng ngờ',
    probe_warning: 'Phát hiện dấu hiệu tự động hóa',
  };
  const isBlocked = ['creep_detected', 'automation_probes', 'mouse_bot', 'bot_ua', 'zero_screen', 'ip_rate_limit', 'bot_behavior'].includes(ev.reason);

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
      if (bd.bot !== undefined) detailItems.push({ label: 'Bot', value: bd.bot ? 'Có' : 'Không', danger: !!bd.bot });
      if (bd.totalLied !== undefined) {
        detailItems.push({ label: 'Tổng mục giả mạo', value: bd.totalLied, danger: bd.totalLied > 0 });
        if (bd.liedSections?.length > 0) detailItems.push({ label: 'Các mục bị giả mạo', value: (Array.isArray(bd.liedSections) ? bd.liedSections : []).join(', '), danger: true });
      }
      if (bd.stealth != null) detailItems.push({ label: 'Stealth mode', value: bd.stealth ? 'Có' : 'Không', danger: !!bd.stealth });
      if (bd.creepError) detailItems.push({ label: 'CreepJS', value: 'Không load được (cross-domain)', warn: true });
      if (bd.creepTimeout) detailItems.push({ label: 'CreepJS', value: 'Quá thời gian', warn: true });
    }

    const probes = d.probes || {};
    if (probes.webdriver) detailItems.push({ label: 'Webdriver', value: 'Có', danger: true });
    if (probes.selenium) detailItems.push({ label: 'Selenium', value: 'Có', danger: true });
    if (probes.cdc) detailItems.push({ label: 'Chrome DevTools Protocol', value: 'Có', danger: true });
    if (probes.pluginCount !== undefined) detailItems.push({ label: 'Số plugin trình duyệt', value: probes.pluginCount, warn: probes.pluginCount === 0 });
    if (probes.langCount !== undefined) detailItems.push({ label: 'Số ngôn ngữ', value: probes.langCount, warn: probes.langCount === 0 });
    if (probes.rtt !== undefined) detailItems.push({ label: 'Độ trễ mạng (RTT)', value: `${probes.rtt}ms`, warn: probes.rtt === 0 });

    if (d.screen) detailItems.push({ label: 'Màn hình', value: `${d.screen.w}×${d.screen.h} (${d.screen.dpr || 1}x)` });
    if (d.countdownTime) detailItems.push({ label: 'Thời gian đếm ngược', value: `${d.countdownTime}s` });

    if (d.probeWarnings && Array.isArray(d.probeWarnings)) {
      d.probeWarnings.forEach(w => detailItems.push({ label: WARNING_VI[w] || w, value: 'Phát hiện', warn: true }));
    }

    if (d.warnings && Array.isArray(d.warnings)) {
      d.warnings.forEach(w => {
        const parts = w.match(/^(.+?)\((.+)\)$/);
        if (parts) {
          const warnMap = { repeat_device: 'Thiết bị lặp lại' };
          detailItems.push({ label: warnMap[parts[1]] || parts[1], value: `${parts[2]} lần`, warn: true });
        } else {
          detailItems.push({ label: WARNING_VI[w] || w, value: 'Phát hiện', warn: true });
        }
      });
    }

    if (!d.assessments && !d.botDetection && d.totalLied === undefined && !d.probeWarnings && !d.warnings) {
      Object.entries(d).forEach(([k, v]) => {
        if (['behaviorScore', 'score', 'assessments', 'botDetection', 'probes', 'screen', 'countdownTime'].includes(k)) return;
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

  const rc = ipData ? ({ high: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', bar: 'bg-red-500' }, medium: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', bar: 'bg-amber-500' }, low: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', bar: 'bg-green-500' } }[ipData.riskLevel] || {}) : {};
  const sevColors = { high: 'bg-red-100 text-red-700 border-red-200', medium: 'bg-amber-100 text-amber-700 border-amber-200', info: 'bg-blue-100 text-blue-700 border-blue-200' };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className={`px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0 ${isBlocked ? 'bg-red-50' : 'bg-green-50'}`}>
          <div>
            <h3 className="text-sm font-black text-slate-800">Đánh giá chi tiết</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(ev.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition"><X size={16} className="text-slate-500" /></button>
        </div>
        <div className="overflow-y-auto flex-1">

        {/* Summary row */}
        <div className="px-6 py-4 space-y-3 border-b border-slate-100">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`px-2.5 py-1 rounded-lg font-bold ${ev.source === 'widget' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
              {ev.source === 'widget' ? 'Script nhúng' : ev.source === 'vuotlink' ? 'Vượt link' : ev.source}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-mono text-slate-700">{ev.ip_address}</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-mono text-slate-600 text-[10px] max-w-[200px] truncate">{ev.visitor_id || '—'}</span>
          </div>

          {/* Conclusion */}
          {(() => {
            let d2 = {};
            try { d2 = JSON.parse(ev.details || '{}'); } catch { }
            const bd2 = d2.botDetection || (d2.totalLied !== undefined ? d2 : null);
            const creepLied2 = bd2 && bd2.totalLied > 0;
            const creepBot2 = bd2 && bd2.bot === true;
            const probes2 = d2.probes || {};
            const hasAuto2 = probes2.webdriver || probes2.selenium || probes2.cdc;
            const fc2 = (d2.assessments || []).filter(a => a.flagged).length;
            const tc2 = (d2.assessments || []).length;
            const isBot2 = isBlocked || creepBot2 || creepLied2 || hasAuto2 || fc2 > 0;
            const badges = [];
            if (fc2 > 0) badges.push(`${fc2}/${tc2} bất thường`);
            if (creepLied2) badges.push(`Giả mạo ${bd2.totalLied} mục`);
            if (hasAuto2) badges.push('Automation');
            return (
              <div className={`p-3 rounded-xl border-2 flex items-center justify-between ${isBot2 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                <div>
                  <p className={`text-sm font-black ${isBot2 ? 'text-red-800' : 'text-green-800'}`}>{isBot2 ? '🚫 BOT' : '✅ Người dùng thật'}</p>
                  {badges.length > 0 && <p className="text-[10px] text-red-600 mt-0.5">{badges.join(' • ')}</p>}
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isBot2 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {reasonLabels[ev.reason] || ev.reason}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* LEFT: IP Analysis */}
          <div className="px-6 py-4 space-y-3 lg:border-r border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Phân tích IP</p>
            {ipLoading ? (
              <div className="text-center py-6 text-xs text-slate-400">Đang phân tích...</div>
            ) : !ipData ? (
              <div className="text-center py-6 text-xs text-slate-400">Không thể phân tích</div>
            ) : (
              <div className="space-y-3">
                <div className={`p-3 rounded-xl border-2 ${rc.bg} ${rc.border}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-black ${rc.text}`}>{ipData.riskLevel === 'high' ? 'RỦI RO CAO' : ipData.riskLevel === 'medium' ? 'RỦI RO TB' : 'RỦI RO THẤP'}</span>
                    <span className={`text-lg font-black ${rc.text}`}>{ipData.riskScore}</span>
                  </div>
                  <div className="w-full bg-white/60 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${rc.bar}`} style={{ width: `${Math.min(ipData.riskScore, 100)}%` }} />
                  </div>
                </div>

                {ipData.risks.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ipData.risks.map((r, i) => (
                      <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sevColors[r.severity] || sevColors.info}`}>{r.label}</span>
                    ))}
                  </div>
                )}

                {ipData.geo && (
                  <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-slate-400">Địa điểm</span><span className="font-bold text-slate-700">{ipData.geo.city || '—'}, {ipData.geo.country}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">ISP</span><span className="font-bold text-slate-700 text-right max-w-[65%] truncate">{ipData.geo.isp}</span></div>
                    <div className="flex gap-1.5 pt-1.5 border-t border-slate-200">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ipData.geo.proxy ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>VPN {ipData.geo.proxy ? '✓' : '✕'}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ipData.geo.hosting ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>DC {ipData.geo.hosting ? '✓' : '✕'}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ipData.geo.mobile ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>Mobile {ipData.geo.mobile ? '✓' : '✕'}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-1.5">
                  {[['Tổng', ipData.stats.total, 'text-slate-800'], ['OK', ipData.stats.completed, 'text-green-600'], ['Hạn', ipData.stats.expired, 'text-amber-600'], ['Bot', ipData.stats.botDetected, 'text-red-600']].map(([l, v, c]) => (
                    <div key={l} className="bg-slate-50 rounded-lg p-1.5 text-center">
                      <p className="text-[8px] text-slate-400 font-bold uppercase">{l}</p>
                      <p className={`text-base font-black ${c}`}>{v || 0}</p>
                    </div>
                  ))}
                </div>

                {ipData.workers.length > 0 && (
                  <div className="bg-slate-50 rounded-lg overflow-hidden">
                    <p className="text-[9px] font-bold text-slate-400 uppercase px-3 pt-2">Workers ({ipData.stats.uniqueWorkers})</p>
                    {ipData.workers.slice(0,3).map((w, i) => (
                      <div key={i} className="flex justify-between px-3 py-1 border-b border-slate-100 last:border-0 text-[11px]">
                        <span className="text-slate-700">{w.name || w.email}</span>
                        <span className="font-bold text-slate-500">{w.task_count}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-slate-50 rounded-lg p-2.5 text-[10px] text-slate-500">
                  Sự kiện: <b className="text-slate-700">{ipData.securityEvents.total}</b> · Chặn: <b className="text-red-600">{ipData.securityEvents.blocked}</b> · All-time: <b className="text-slate-700">{ipData.allTime?.total || 0}</b> tasks
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Browser + Behavior */}
          <div className="px-6 py-4 space-y-3">
            {detailItems.filter(it => !['Headless'].includes(it.label)).length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Kiểm tra trình duyệt</p>
                <div className="space-y-1">
                  {detailItems.filter(it => !['Headless'].includes(it.label)).map((item, i) => (
                    <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] ${item.danger ? 'bg-red-50' : item.warn ? 'bg-amber-50' : 'bg-slate-50'}`}>
                      <span className={`font-medium ${item.danger ? 'text-red-700' : item.warn ? 'text-amber-700' : 'text-slate-600'}`}>{item.label}</span>
                      <span className={`font-bold ${item.danger ? 'text-red-800' : item.warn ? 'text-amber-800' : 'text-slate-800'}`}>{String(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const validCats = ['interaction', 'mouse', 'scroll', 'click'];
              const filteredGrouped = Object.fromEntries(Object.entries(grouped).filter(([cat]) => validCats.includes(cat)));
              return Object.keys(filteredGrouped).length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Phân tích hành vi</p>
                  {Object.entries(filteredGrouped).map(([cat, items]) => (
                    <div key={cat} className="mb-2">
                      <p className="text-[11px] font-bold text-slate-600 mb-1">{catNames[cat] || cat}</p>
                      <div className="space-y-0.5">
                        {items.map((a, i) => (
                          <div key={i} className={`px-3 py-1.5 rounded-lg text-[10px] border ${a.flagged ? 'bg-red-50 border-red-200' : a.flagged === false ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                            <span className={`font-semibold ${a.flagged ? 'text-red-700' : a.flagged === false ? 'text-green-700' : 'text-slate-500'}`}>{a.note}</span>
                            <span className="text-[9px] text-slate-400 ml-2">({String(a.value)})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-[11px] text-slate-400">Chưa có phân tích hành vi</p>
                </div>
              );
            })()}
          </div>
        </div>

          <div className="px-6 py-3 border-t border-slate-100">
            <button onClick={onClose} className="w-full py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition">Đóng</button>
          </div>
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
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      const data = await api.get(`/admin/security?${params.toString()}`);
      setSecurityLogs(data.securityLogs || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (ev) => {
    setDetailLoading(true);
    try {
      const data = await api.get(`/admin/security/${ev.id}`);
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
        <div>
          <h1 className="text-xl font-black text-slate-900">Anti Cheat</h1>
          <p className="text-xs text-slate-500">{total.toLocaleString('vi-VN')} sự kiện (7 ngày gần nhất)</p>
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
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Phát hiện</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Địa chỉ IP</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Mã thiết bị</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Đánh giá</th>
                <th className="text-center px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">Đang tải...</td></tr>
              ) : securityLogs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">Chưa có sự kiện bảo mật nào</td></tr>
              ) : securityLogs.map(ev => {
                const detectMethods = {
                  completed: { label: 'Task OK', cls: 'bg-green-100 text-green-700' },
                  creep_detected: { label: 'Fingerprint', cls: 'bg-red-100 text-red-700' },
                  automation_probes: { label: 'Automation', cls: 'bg-red-100 text-red-700' },
                  mouse_bot: { label: 'Hành vi', cls: 'bg-orange-100 text-orange-700' },
                  bot_ua: { label: 'User-Agent', cls: 'bg-red-100 text-red-700' },
                  bot_behavior: { label: 'Hành vi', cls: 'bg-orange-100 text-orange-700' },
                  suspicious: { label: 'Hành vi', cls: 'bg-amber-100 text-amber-700' },
                  probe_warning: { label: 'Browser', cls: 'bg-violet-100 text-violet-700' },
                  ip_rate_limit: { label: 'Rate limit', cls: 'bg-rose-100 text-rose-700' },
                };
                const dm = detectMethods[ev.reason] || { label: ev.reason, cls: 'bg-slate-100 text-slate-600' };
                const sourceVi = { vuotlink: 'Vượt link', widget: 'Script nhúng' };
                return (
                  <tr key={ev.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition ${ev.is_bot ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{fmtDate(ev.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ev.source === 'widget' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                        {sourceVi[ev.source] || ev.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${dm.cls}`}>
                        {dm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-700 text-xs">{ev.ip_address}</span>
                    </td>
                    <td className="px-4 py-3"><CopyId text={ev.visitor_id} /></td>
                    <td className="px-4 py-3">
                      {ev.is_bot
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">BOT</span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">Sạch</span>
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
