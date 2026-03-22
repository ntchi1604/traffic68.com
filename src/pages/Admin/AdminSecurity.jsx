import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Shield, Search, RefreshCw, X, Eye, Copy, Check,
  ChevronLeft, ChevronRight, ArrowLeft, User,
} from 'lucide-react';
import api from '../../lib/api';

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins}p trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h trước`;
  return `${Math.floor(hrs / 24)}d trước`;
};

const fmtMoney = (v) => Number(v || 0).toLocaleString('vi-VN') + 'đ';

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

const STATUS_MAP = {
  completed: { label: 'Hoàn thành', cls: 'bg-green-100 text-green-700' },
  expired: { label: 'Hết hạn', cls: 'bg-slate-100 text-slate-500' },
  pending: { label: 'Đang chờ', cls: 'bg-amber-100 text-amber-700' },
  step1: { label: 'Bước 1', cls: 'bg-blue-100 text-blue-700' },
  step2: { label: 'Bước 2', cls: 'bg-blue-100 text-blue-700' },
  step3: { label: 'Bước 3', cls: 'bg-purple-100 text-purple-700' },
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

/* ─── Task Detail Modal ─── */
function TaskDetailModal({ task, onClose }) {
  const catNames = { interaction: 'Tương tác bắt buộc', mouse: 'Chuột', scroll: 'Cuộn trang', click: 'Click', device: 'Thiết bị' };
  const d = task.security_detail || {};
  const assessments = d.assessments || [];
  const grouped = {};
  assessments.forEach(a => { if (!grouped[a.cat]) grouped[a.cat] = []; grouped[a.cat].push(a); });

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(task.user_agent || '');
  const bd = d.botDetection || {};
  const probes = d.probes || {};

  const detailItems = [];
  const bScore = d.behaviorScore ?? d.score;
  if (bScore !== undefined) detailItems.push({ label: 'Điểm hành vi', value: `${bScore} / 70`, danger: bScore >= 70, warn: bScore > 0 && bScore < 70 });
  if (bd.bot !== undefined) detailItems.push({ label: 'CreepJS Bot', value: bd.bot ? 'Có' : 'Không', danger: !!bd.bot });
  if (bd.totalLied !== undefined) {
    detailItems.push({ label: 'Tổng giả mạo', value: bd.totalLied, danger: bd.totalLied > 0 });
    if (bd.liedSections?.length > 0) detailItems.push({ label: 'Mục giả mạo', value: bd.liedSections.join(', '), danger: true });
  }
  if (probes.webdriver) detailItems.push({ label: 'Webdriver', value: 'Có', danger: true });
  if (probes.selenium) detailItems.push({ label: 'Selenium', value: 'Có', danger: true });
  if (probes.cdc) detailItems.push({ label: 'CDP', value: 'Có', danger: true });
  if (probes.pluginCount !== undefined) detailItems.push({ label: 'Plugins', value: probes.pluginCount, warn: probes.pluginCount === 0 && !isMobile });
  if (d.screen) detailItems.push({ label: 'Màn hình', value: `${d.screen.w}×${d.screen.h}` });
  if (d.countdownTime) detailItems.push({ label: 'Countdown', value: `${d.countdownTime}s` });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className={`px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0 ${task.bot_detected ? 'bg-red-50' : task.status === 'completed' ? 'bg-green-50' : 'bg-slate-50'}`}>
          <div>
            <h3 className="text-sm font-black text-slate-800">Task #{task.id}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(task.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition"><X size={16} className="text-slate-500" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2 text-xs items-center">
            <span className={`px-2.5 py-1 rounded-lg font-bold ${isMobile ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
              {isMobile ? '📱 Mobile' : '🖥️ Desktop'}
            </span>
            <span className={`px-2.5 py-1 rounded-lg font-bold ${(STATUS_MAP[task.status] || {}).cls || 'bg-slate-100 text-slate-600'}`}>
              {(STATUS_MAP[task.status] || {}).label || task.status}
            </span>
            {task.bot_detected ? (
              <span className="px-2.5 py-1 rounded-lg font-bold bg-red-100 text-red-700">🚫 BOT</span>
            ) : null}
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-mono text-slate-700">{task.ip_address}</span>
            <CopyId text={task.visitor_id} />
          </div>

          {/* Task info */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Keyword</span><span className="font-bold text-slate-700 text-right max-w-[60%] truncate">{task.keyword || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">URL đích</span><span className="font-bold text-slate-700 text-right max-w-[60%] truncate">{task.target_url || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Chiến dịch</span><span className="font-bold text-slate-700">{task.campaign_name || `#${task.campaign_id}`}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Thu nhập</span><span className="font-bold text-green-700">{fmtMoney(task.earning)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Thời gian trên trang</span><span className="font-bold text-slate-700">{task.time_on_site ? `${task.time_on_site}s` : '—'}</span></div>
          </div>

          {/* Browser checks */}
          {detailItems.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Kiểm tra trình duyệt</p>
              <div className="space-y-1">
                {detailItems.map((item, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] ${item.danger ? 'bg-red-50' : item.warn ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <span className={`font-medium ${item.danger ? 'text-red-700' : item.warn ? 'text-amber-700' : 'text-slate-600'}`}>{item.label}</span>
                    <span className={`font-bold ${item.danger ? 'text-red-800' : item.warn ? 'text-amber-800' : 'text-slate-800'}`}>{String(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Behavior assessments */}
          {Object.keys(grouped).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Phân tích hành vi</p>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="mb-2">
                  <p className="text-[11px] font-bold text-slate-600 mb-1">{catNames[cat] || cat}</p>
                  <div className="space-y-0.5">
                    {items.map((a, i) => (
                      <div key={i} className={`px-3 py-1.5 rounded-lg text-[10px] border ${a.flagged ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                        <span className={`font-semibold ${a.flagged ? 'text-red-700' : 'text-green-700'}`}>{a.note}</span>
                        <span className="text-[9px] text-slate-400 ml-2">({String(a.value)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!detailItems.length && !Object.keys(grouped).length && (
            <div className="bg-slate-50 rounded-lg p-4 text-center text-xs text-slate-400">
              Chưa có dữ liệu đánh giá bảo mật cho task này
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

/* ─── User Tasks View ─── */
const REASON_VI = {
  completed: 'Task OK', creep_detected: 'Fingerprint giả', automation_probes: 'Automation',
  mouse_bot: 'Hành vi bot', bot_ua: 'UA bot', bot_behavior: 'Hành vi', suspicious: 'Nghi ngờ',
  probe_warning: 'Browser probe', ip_rate_limit: 'Rate limit',
};

function UserTasksView({ user, onBack }) {
  const [tab, setTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const limit = 30;

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/security/user/${user.worker_id}/tasks?page=${page}&limit=${limit}`)
      .then(d => { setTasks(d.tasks || []); setTotal(d.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.worker_id, page]);

  useEffect(() => {
    if (tab === 'events' && events.length === 0) {
      setEventsLoading(true);
      api.get(`/admin/security/user/${user.worker_id}/events`)
        .then(d => setEvents(d.events || []))
        .catch(console.error)
        .finally(() => setEventsLoading(false));
    }
  }, [tab, user.worker_id]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition">
          <ArrowLeft size={16} className="text-slate-600" />
        </button>
        <div>
          <h2 className="text-base font-black text-slate-900">{user.worker_name || 'Khách (không đăng nhập)'}</h2>
          <p className="text-xs text-slate-500">{user.worker_email || user.ips?.[0] || ''} · {total} task</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2">
        {[
          ['Tổng', user.total_tasks, 'text-slate-800'],
          ['Hoàn thành', user.completed, 'text-green-600'],
          ['Blocked', user.blocked, 'text-red-600'],
          ['Cảnh báo', user.security_events, 'text-amber-600'],
          ['Thu nhập', fmtMoney(user.total_earning), 'text-emerald-600'],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-[9px] text-slate-400 font-bold uppercase">{l}</p>
            <p className={`text-lg font-black ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[['tasks', `Tasks (${total})`], ['events', `Cảnh báo (${user.security_events || 0})`]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${tab === key ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Thời gian</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Nguồn</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Trạng thái</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">IP</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Keyword</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Earning</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Đánh giá</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400">Đang tải...</td></tr>
                ) : tasks.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400">Chưa có task nào</td></tr>
                ) : tasks.map(t => {
                  const st = STATUS_MAP[t.status] || { label: t.status, cls: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={t.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition ${t.bot_detected ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(t.created_at)}</td>
                      <td className="px-4 py-3">
                        {t.worker_link_id
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700">Gateway{t.gateway_slug ? ` /${t.gateway_slug}` : ''}</span>
                          : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">Vượt link</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{t.ip_address}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-[150px] truncate">{t.keyword || '—'}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{t.earning ? fmtMoney(t.earning) : '—'}</td>
                      <td className="px-4 py-3">
                        {t.bot_detected
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">BOT</span>
                          : t.status === 'completed'
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">Sạch</span>
                          : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedTask(t)}
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
            <span className="text-[11px] text-slate-500">Trang {page} / {totalPages}</span>
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
      )}

      {tab === 'events' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {eventsLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Đang tải...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">Không có cảnh báo nào</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map(ev => {
                let details = {};
                try { details = JSON.parse(ev.details || '{}'); } catch {}
                const isBlocked = ['creep_detected', 'automation_probes', 'mouse_bot', 'bot_ua', 'bot_behavior'].includes(ev.reason);
                const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ev.user_agent || '');
                return (
                  <div key={ev.id} className={`px-4 py-3 ${isBlocked ? 'bg-red-50/30' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isBlocked ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {REASON_VI[ev.reason] || ev.reason}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ev.source === 'widget' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                          {ev.source === 'widget' ? 'Script nhúng' : ev.source === 'vuotlink' ? 'Vượt link' : ev.source}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isMobile ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-500'}`}>
                          {isMobile ? '📱' : '🖥️'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">{ev.ip_address}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{fmtDate(ev.created_at)}</span>
                    </div>
                    {/* Show key details inline */}
                    {(details.totalLied > 0 || details.liedSections || details.probeWarnings || details.mobileToleranceApplied) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {details.totalLied > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">Lied: {details.totalLied}</span>}
                        {(details.liedSections || []).map((s, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">{s}</span>
                        ))}
                        {(details.probeWarnings || []).map((w, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600">{w}</span>
                        ))}
                        {details.mobileToleranceApplied && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-50 text-cyan-600">Mobile tolerance ✓</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}

/* ─── Main Page ─── */
export default function AdminSecurity() {
  usePageTitle('Admin - Anti Cheat');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      const data = await api.get(`/admin/security/users?${params.toString()}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / limit) || 1;

  if (selectedUser) {
    return <UserTasksView user={selectedUser} onBack={() => setSelectedUser(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Anti Cheat</h1>
          <p className="text-xs text-slate-500">{total} user</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm tên user, email, hoặc IP..."
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
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">User</th>
                <th className="text-center px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Tổng</th>
                <th className="text-center px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">OK</th>
                <th className="text-center px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Blocked</th>
                <th className="text-center px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Cảnh báo</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">IP</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Hoạt động</th>
                <th className="text-center px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">Đang tải...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">Chưa có dữ liệu</td></tr>
              ) : users.map((u, i) => {
                const hasIssue = u.blocked > 0 || u.security_events > 0;
                return (
                  <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50/50 transition ${hasIssue ? 'bg-red-50/20' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${hasIssue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {u.worker_name ? u.worker_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{u.worker_name || 'Khách'}</p>
                          <p className="text-[10px] text-slate-400">{u.worker_email || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">{u.total_tasks}</td>
                    <td className="px-4 py-3 text-center font-bold text-green-600">{u.completed}</td>
                    <td className="px-4 py-3 text-center">
                      {u.blocked > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{u.blocked}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.security_events > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{u.security_events}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.ips.slice(0, 2).map((ip, j) => (
                          <span key={j} className="font-mono text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">{ip}</span>
                        ))}
                        {u.ips.length > 2 && <span className="text-[10px] text-slate-400">+{u.ips.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">{timeAgo(u.last_activity)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedUser(u)}
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
          <span className="text-[11px] text-slate-500">Trang {page} / {totalPages} ({total} user)</span>
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
    </div>
  );
}
