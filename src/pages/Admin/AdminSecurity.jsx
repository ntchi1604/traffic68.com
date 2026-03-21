import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Shield, Fingerprint, Bot, MousePointer2, Eye, AlertTriangle,
  CheckCircle2, XCircle, Clock, RefreshCw, Search, ChevronDown,
  Monitor, Smartphone, Globe, TrendingUp, Users, Activity,
  MessageSquare, Save, X, Info,
} from 'lucide-react';
import api from '../../lib/api';

/* ── Helpers ── */
const fmt = (n) => (n ?? 0).toLocaleString('vi-VN');
const pct = (n) => `${(n ?? 0).toFixed(1)}%`;
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

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
          <Icon size={20} className={color} />
        </div>
        <span className="text-xs text-slate-500 font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

/* ── Risk Badge ── */
function RiskBadge({ level }) {
  const cfg = {
    safe: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: '✅ An toàn' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: '⚠️ Cảnh báo' },
    danger: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: '🤖 Bot' },
    blocked: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', label: '🚫 Đã chặn' },
  };
  const c = cfg[level] || cfg.safe;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
}

/* ── Copy ID (truncated + copy button) ── */
function CopyId({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-slate-300">—</span>;
  const short = value.length > 12 ? value.substring(0, 12) + '...' : value;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs font-mono text-slate-500 truncate max-w-[90px]" title={value}>{short}</span>
      <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}>
        {copied ? '✓' : 'Copy'}
      </button>
    </span>
  );
}

/* ── Warning/key Vietnamese translations ── */
const WARNING_VI = {
  // Mouse dynamics
  'linear_movement': 'Di chuột thẳng tuyệt đối (không có đường cong tự nhiên)',
  'constant_velocity': 'Tốc độ chuột không đổi — thiếu gia tốc/giảm tốc',
  'no_micro_jitter': 'Không có rung lắc tay nhỏ (micro-variations)',
  'fake_timestamps': 'Thời gian di chuột giả mạo',
  'regular_intervals': 'Thời gian giữa các điểm chuột đều như máy',
  'no_hover_before_click': 'Click ngay không rê chuột qua vùng xung quanh',
  // Keystroke dynamics
  'constant_dwell_time': 'Nhấn giữ phím đều nhau (Dwell Time cố định)',
  'constant_flight_time': 'Gõ phím đều nhau (Flight Time cố định)',
  'no_typos': 'Gõ nhiều nhưng không có lỗi chính tả (Backspace)',
  // Scroll patterns
  'no_scroll_pauses': 'Cuộn trang liên tục không dừng đọc',
  'uniform_scroll_speed': 'Tốc độ cuộn trang đều — không tự nhiên',
  // Focus & visibility
  'raf_unstable': 'Trình duyệt không render ổn định (headless)',
  'zero_screen': 'Không có màn hình (headless)',
  'vm_screen': 'Độ phân giải giống máy ảo',
  // Click positions
  'exact_center_clicks': 'Click chính xác vào tâm nút (element.click())',
  // Probes
  'zero_plugins': 'Trình duyệt không có plugin (headless)',
  'zero_rtt': 'Độ trễ mạng bằng 0 (bot)',
  'zero_languages': 'Không có ngôn ngữ trong trình duyệt',
  'no_chrome_runtime': 'Thiếu Chrome Runtime (giả mạo Chrome)',
  'repeat_device': 'Thiết bị lặp lại nhiều lần',
};
const KEY_VI = {
  webdriver: 'Webdriver (tự động hóa)', cdc: 'Chrome DevTools Protocol', selenium: 'Selenium',
  pluginCount: 'Số plugin trình duyệt', langCount: 'Số ngôn ngữ', hasChrome: 'Là trình duyệt Chrome',
  hasChromeRuntime: 'Có Chrome Runtime', notifPerm: 'Quyền thông báo', rtt: 'Độ trễ mạng (ms)',
  score: 'Điểm hành vi', reasons: 'Lý do phát hiện', count: 'Số lần truy cập',
  probeWarnings: 'Cảnh báo từ hệ thống', behaviorScore: 'Điểm phân tích hành vi',
  mousePoints: 'Số điểm chuột ghi nhận', countdownTime: 'Thời gian đếm ngược',
  screen: 'Màn hình', warnings: 'Cảnh báo',
  totalLied: 'Số mục giả mạo', liedSections: 'Các mục bị giả mạo',
  bot: 'Phát hiện bot', totalLied: 'Tổng mục giả mạo',
};

function parseWarning(w) {
  const m = w.match(/^(\w+)\((.+)\)$/);
  if (m) {
    const base = WARNING_VI[m[1]] || m[1];
    return { label: base, value: m[2] };
  }
  return { label: WARNING_VI[w] || w, value: null };
}

/* ── Detail Modal ── */
function DetailModal({ event: ev, onClose }) {
  const reasonLabels = {
    creep_detected: 'Giả mạo trình duyệt',
    creep_warning: 'Nghi ngờ giả mạo trình duyệt',
    botd_detected: 'Phát hiện bot tự động',
    automation_probes: 'Sử dụng công cụ tự động hóa (Selenium, Webdriver...)',
    mouse_bot: 'Hành vi chuột không tự nhiên — giả lập bằng bot',
    bot_ua: 'User-Agent thuộc trình duyệt bot/crawler',
    zero_screen: 'Không có màn hình — chạy headless (không giao diện)',
    ip_rate_limit: 'IP truy cập quá nhiều lần trong thời gian ngắn',
    suspicious: 'Có nhiều dấu hiệu đáng ngờ nhưng chưa đủ chặn',
    probe_warning: 'Phát hiện dấu hiệu tự động hóa nhẹ',
  };
  const sourceVi = { vuotlink: 'Trang vượt link', widget: 'Script nhúng trên web' };
  const isBlocked = ['creep_detected', 'botd_detected', 'automation_probes', 'mouse_bot', 'bot_ua', 'zero_screen', 'ip_rate_limit'].includes(ev.reason);

  let detailItems = [];
  try {
    const d = JSON.parse(ev.details || '{}');
    if (d.totalLied !== undefined) {
      detailItems.push({ label: 'Tổng mục giả mạo', value: d.totalLied, danger: d.totalLied > 0 });
      if (d.liedSections?.length > 0) {
        detailItems.push({ label: 'Các mục bị giả mạo', value: d.liedSections.join(', '), danger: true });
      }
      if (d.headless != null) detailItems.push({ label: 'Headless', value: d.headless ? 'Có' : 'Không', danger: !!d.headless });
      if (d.stealth != null) detailItems.push({ label: 'Stealth mode', value: d.stealth ? 'Có' : 'Không', danger: !!d.stealth });
    } else if (d.warnings) {
      d.warnings.forEach(w => {
        const parsed = parseWarning(w);
        detailItems.push({ label: parsed.label, value: parsed.value || 'Phát hiện', danger: false, warn: true });
      });
      if (d.mouseScore) detailItems.push({ label: 'Điểm nguy cơ chuột', value: `${d.mouseScore}/100`, danger: d.mouseScore >= 50 });
      if (d.mousePoints != null) detailItems.push({ label: 'Số điểm chuột', value: d.mousePoints });
      if (d.clicks != null) detailItems.push({ label: 'Số lần nhấp', value: d.clicks });
      if (d.scrolls != null) detailItems.push({ label: 'Số lần cuộn', value: d.scrolls });
      if (d.keys != null) detailItems.push({ label: 'Số phím bấm', value: d.keys });
      if (d.loadTime) detailItems.push({ label: 'Thời gian tải trang', value: `${d.loadTime}ms`, warn: d.loadTime < 2000 });
      if (d.screen) detailItems.push({ label: 'Màn hình', value: `${d.screen.w}×${d.screen.h} (${d.screen.dpr || 1}x)` });
    } else {
      Object.entries(d).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        const label = KEY_VI[k] || k;
        let val = v;
        if (typeof v === 'boolean') val = v ? 'Có' : 'Không';
        else if (Array.isArray(v)) val = v.map(i => WARNING_VI[i] || i).join(', ');
        else if (typeof v === 'object') val = JSON.stringify(v);
        detailItems.push({ label, value: String(val), danger: (k === 'webdriver' || k === 'cdc' || k === 'selenium') && v === true });
      });
    }
  } catch { detailItems.push({ label: 'Dữ liệu thô', value: ev.details }); }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-6 py-4 rounded-t-2xl flex items-center justify-between ${isBlocked ? 'bg-red-50' : 'bg-amber-50'}`}>
          <div>
            <h3 className="text-sm font-black text-slate-800">Chi tiết sự kiện bảo mật</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{timeAgo(ev.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Summary */}
          <div className={`p-3 rounded-xl border text-sm font-semibold ${isBlocked ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            {isBlocked ? '🚫 ' : '⚠️ '}{reasonLabels[ev.reason] || ev.reason}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Nguồn</p>
              <p className="font-semibold text-slate-700">{sourceVi[ev.source] || ev.source}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Địa chỉ IP</p>
              <p className="font-mono font-semibold text-slate-700">{ev.ip_address}</p>
            </div>
            <div className="col-span-2 bg-slate-50 rounded-lg p-3">
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Mã thiết bị</p>
              <p className="font-mono text-slate-700 text-[11px] break-all">{ev.visitor_id || '—'}</p>
            </div>
            {ev.user_agent && (
              <div className="col-span-2 bg-slate-50 rounded-lg p-3">
                <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Trình duyệt</p>
                <p className="text-slate-600 text-[10px] break-all leading-relaxed">{ev.user_agent}</p>
              </div>
            )}
          </div>

          {/* Detail items */}
          {detailItems.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Đánh giá chi tiết</p>
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
        </div>

        <div className="px-6 py-3 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function AdminSecurity() {
  usePageTitle('Admin - Bảo mật');
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [tab, setTab] = useState('tasks'); // 'tasks' or 'events'
  const [topDevices, setTopDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, blocked, warning, passed
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [detailEvent, setDetailEvent] = useState(null); // security event detail modal

  const saveNote = async (taskId) => {
    try {
      await api.put(`/admin/security/tasks/${taskId}/note`, { note: noteText });
      setLogs(prev => prev.map(l => l.id === taskId ? { ...l, admin_note: noteText || null } : l));
    } catch (err) {
      console.error('Save note error:', err);
    }
    setEditingNote(null);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', 20);
      if (filter !== 'all') params.set('filter', filter);
      if (search) params.set('search', search);

      const data = await api.get(`/admin/security?${params}`);
      setStats(data.stats);
      setLogs(data.logs || []);
      setSecurityLogs(data.securityLogs || []);
      setTopDevices(data.topDevices || []);
    } catch (err) {
      console.error('Security fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const s = stats || {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Shield size={24} className="text-orange-500" /> Bảo mật & Chống Bot
          </h1>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition">
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* Stats Grid */}
      {loading && !stats ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Eye} label="Tổng task (24h)" value={fmt(s.totalTasks24h)} sub={`${fmt(s.completedTasks24h)} hoàn thành`} color="text-blue-600" bg="bg-blue-50" />
            <StatCard icon={XCircle} label="Bị chặn (24h)" value={fmt(s.blockedTasks24h)} color="text-red-600" bg="bg-red-50" />
            <StatCard icon={Fingerprint} label="Thiết bị duy nhất" value={fmt(s.uniqueDevices24h)} color="text-purple-600" bg="bg-purple-50" />
            <StatCard icon={Bot} label="Bot phát hiện" value={fmt(s.botDetected24h)} color="text-amber-600" bg="bg-amber-50" />
          </div>

          {/* Top Devices Abusing */}
          {topDevices.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <h3 className="text-sm font-bold text-slate-800">Top thiết bị hoạt động nhiều (24h)</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {topDevices.map((d, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 transition">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-black text-slate-500">
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-slate-700 truncate">{d.visitor_id}</p>
                      <p className="text-[10px] text-slate-400">{d.ip_count} IP · {d.completed} hoàn thành · {d.total} tổng</p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">{d.total} task</p>
                      {d.total >= 5 && <RiskBadge level="danger" />}
                      {d.total >= 3 && d.total < 5 && <RiskBadge level="warning" />}
                      {d.total < 3 && <RiskBadge level="safe" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter & Search */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5">
                {[
                  { key: 'all', label: 'Tất cả', icon: Eye },
                  { key: 'blocked', label: 'Bị chặn', icon: XCircle },
                  { key: 'warning', label: 'Cảnh báo', icon: AlertTriangle },
                  { key: 'passed', label: 'Qua', icon: CheckCircle2 },
                ].map(f => (
                  <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition ${filter === f.key
                      ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    <f.icon size={12} /> {f.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-w-[200px] relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Tìm IP hoặc Mã thiết bị..." value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          {/* Tab switcher: Tasks vs Security Events */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={() => setTab('tasks')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition ${tab === 'tasks' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  <Activity size={12} /> Task ({logs.length})
                </button>
                <button onClick={() => setTab('events')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition ${tab === 'events' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  <Shield size={12} /> Sự kiện bảo mật ({securityLogs.length})
                </button>
              </div>
            </div>
            {tab === 'tasks' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Địa chỉ IP</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Mã thiết bị</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Trạng thái</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Phát hiện Bot</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Chuột</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Đánh giá</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Thời gian</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase min-w-[160px]">Ghi chú</th>

                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {logs.map(log => {
                      // Derive risk level
                      let risk = 'safe';
                      if (log.status === 'blocked' || log.status === 'expired') risk = 'blocked';
                      else if (log.bot_detected) risk = 'danger';
                      else if (log.mouse_score >= 30) risk = 'warning';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 text-xs font-mono text-slate-600">#{log.id}</td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-700">{log.ip_address}</td>
                          <td className="px-4 py-3">
                            <CopyId value={log.visitor_id} />
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${log.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                              log.status === 'pending' ? 'bg-blue-50 text-blue-700' :
                                log.status === 'expired' ? 'bg-slate-100 text-slate-500' :
                                  log.status?.startsWith('step') ? 'bg-cyan-50 text-cyan-700' :
                                    'bg-red-50 text-red-700'
                              }`}>
                              {{ completed: 'Hoàn thành', pending: 'Chờ xử lý', expired: 'Hết hạn', blocked: 'Đã chặn', step1: 'Bước 1', step2: 'Bước 2', step3: 'Bước 3' }[log.status] || log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {log.bot_detected ? (
                              <span className="text-red-500 text-xs font-bold">🤖 Bot</span>
                            ) : (
                              <span className="text-emerald-500 text-xs">✓ OK</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {log.mouse_points ?? '—'} điểm
                            {log.mouse_score > 0 && (
                              <span className="ml-1 text-amber-500 font-bold">(nguy cơ: {log.mouse_score})</span>
                            )}
                          </td>
                          <td className="px-4 py-3"><RiskBadge level={risk} /></td>
                          <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(log.created_at)}</td>
                          <td className="px-4 py-3">
                            {editingNote === log.id ? (
                              <div className="flex gap-1">
                                <input
                                  type="text" value={noteText}
                                  onChange={e => setNoteText(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveNote(log.id); if (e.key === 'Escape') setEditingNote(null); }}
                                  autoFocus
                                  className="w-full px-2 py-1 text-xs border border-orange-300 rounded-md focus:ring-1 focus:ring-orange-500 focus:outline-none"
                                  placeholder="Nhập ghi chú..."
                                />
                                <button onClick={() => saveNote(log.id)} className="px-2 py-1 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition">
                                  <Save size={12} />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingNote(log.id); setNoteText(log.admin_note || ''); }}
                                className={`text-left text-xs px-2 py-1 rounded-md transition w-full ${log.admin_note
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200 font-medium'
                                  : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                                  }`}>
                                {log.admin_note || '+ Thêm ghi chú'}
                              </button>
                            )}
                          </td>

                        </tr>
                      );
                    })}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-slate-400 text-sm">
                          Không có dữ liệu
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Security Events Table (when tab === 'events') */}
            {tab === 'events' && (
              <>
                <table className="w-full text-left">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Nguồn</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Lý do</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Địa chỉ IP</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Mã thiết bị</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Chi tiết</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Kết quả</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {securityLogs.map(ev => {
                      const reasonColors = {
                        creep_detected: 'bg-red-100 text-red-700',
                        creep_warning: 'bg-amber-100 text-amber-700',
                        botd_detected: 'bg-red-100 text-red-700',
                        automation_probes: 'bg-red-100 text-red-700',
                        mouse_bot: 'bg-red-100 text-red-700',
                        bot_ua: 'bg-red-100 text-red-700',
                        zero_screen: 'bg-red-100 text-red-700',
                        ip_rate_limit: 'bg-orange-100 text-orange-700',
                        suspicious: 'bg-amber-100 text-amber-700',
                        probe_warning: 'bg-amber-100 text-amber-700',
                      };
                      const reasonLabels = {
                        creep_detected: '🕵️ Giả mạo trình duyệt',
                        creep_warning: '⚠️ Nghi giả mạo trình duyệt',
                        botd_detected: '🤖 Phát hiện bot tự động',
                        automation_probes: '🤖 Công cụ tự động hóa',
                        mouse_bot: '🖱️ Chuột giả lập (bot)',
                        bot_ua: '🤖 Trình duyệt bot',
                        zero_screen: '📵 Không có màn hình (headless)',
                        ip_rate_limit: '⚡ Quá giới hạn truy cập',
                        suspicious: '⚠️ Hành vi đáng ngờ',
                        probe_warning: '⚠️ Cảnh báo tự động hóa',
                      };
                      const isBlocked = ['creep_detected', 'botd_detected', 'automation_probes', 'mouse_bot', 'bot_ua', 'zero_screen', 'ip_rate_limit'].includes(ev.reason);
                      return (
                        <tr key={ev.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${ev.source === 'vuotlink' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                              {ev.source === 'vuotlink' ? 'Vượt link' : ev.source === 'widget' ? 'Nhúng script' : ev.source}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${reasonColors[ev.reason] || 'bg-slate-100 text-slate-600'}`}>
                              {reasonLabels[ev.reason] || ev.reason}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-700">{ev.ip_address}</td>
                          <td className="px-4 py-3">
                            <CopyId value={ev.visitor_id} />
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => setDetailEvent(ev)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
                              <Info size={11} /> Xem chi tiết
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <RiskBadge level={isBlocked ? 'blocked' : 'warning'} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(ev.created_at)}</td>
                        </tr>
                      );
                    })}
                    {securityLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                          Chưa có sự kiện bảo mật nào
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}

            {/* Detail Modal */}
            {detailEvent && <DetailModal event={detailEvent} onClose={() => setDetailEvent(null)} />}

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition">
                ← Trước
              </button>
              <span className="text-xs text-slate-500 font-medium">Trang {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={(tab === 'tasks' ? logs.length : securityLogs.length) < 20}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition">
                Sau →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
