import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Shield, Search, RefreshCw, X, Eye, Copy, Check,
  ChevronLeft, ChevronRight, ArrowLeft, AlertTriangle,
} from 'lucide-react';
import api from '../../lib/api';

/* ─── Helpers ─── */
const fmt = d => d ? new Date(d).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const ago = d => {
  if (!d) return '—';
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'vừa xong'; if (m < 60) return `${m}p trước`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h trước`;
  return `${Math.floor(h / 24)}d trước`;
};
const money = v => Number(v || 0).toLocaleString('vi-VN') + 'đ';
const isMobileUA = ua => /Mobi|Android|iPhone|iPad|iPod/i.test(ua || '');

const REASON_VI = {
  creep_detected: 'Fingerprint giả', automation_probes: 'Automation',
  mouse_bot: 'Hành vi bot', bot_ua: 'UA bot', bot_behavior: 'Hành vi',
  suspicious: 'Nghi ngờ', probe_warning: 'Browser probe', ip_rate_limit: 'Rate limit',
};

const ST = {
  completed: { l: 'Hoàn thành', c: 'bg-emerald-100 text-emerald-700' },
  expired:   { l: 'Hết hạn',    c: 'bg-slate-100 text-slate-500' },
  pending:   { l: 'Đang chờ',   c: 'bg-amber-100 text-amber-700' },
  step1:     { l: 'Bước 1',     c: 'bg-blue-100 text-blue-700' },
  step2:     { l: 'Bước 2',     c: 'bg-blue-100 text-blue-700' },
  step3:     { l: 'Bước 3',     c: 'bg-violet-100 text-violet-700' },
};

/* ─── Task Detail Modal ─── */
function TaskModal({ task: t, onClose }) {
  if (!t) return null;
  const sd = t.security_detail || {};
  const bd = sd.botDetection || {};
  const pr = sd.probes || {};
  const dl = sd.detectionLog || [];
  const bh = sd.behavioral || {};
  const mobile = isMobileUA(t.user_agent);
  const st = ST[t.status] || { l: t.status, c: 'bg-slate-100 text-slate-600' };

  // Build info cards
  const checks = [];
  if (bd.bot !== undefined)       checks.push({ k: 'CreepJS Bot', v: bd.bot ? 'Có' : 'Không', bad: !!bd.bot });
  if (bd.totalLied !== undefined) checks.push({ k: 'Tổng giả mạo', v: bd.totalLied, bad: bd.totalLied > 0 });
  if (bd.liedSections?.length)    checks.push({ k: 'Mục giả mạo', v: bd.liedSections.join(', '), bad: true });
  if (pr.webdriver)    checks.push({ k: 'Webdriver', v: 'Phát hiện', bad: true });
  if (pr.selenium)     checks.push({ k: 'Selenium', v: 'Phát hiện', bad: true });
  if (pr.cdc)          checks.push({ k: 'CDP', v: 'Phát hiện', bad: true });
  if (pr.pluginCount !== undefined) checks.push({ k: 'Plugins', v: pr.pluginCount, bad: pr.pluginCount === 0 && !mobile });

  // Behavior assessments
  const assessments = sd.assessments || (bh.assessments) || [];
  const grouped = {};
  assessments.forEach(a => { if (!grouped[a.cat]) grouped[a.cat] = []; grouped[a.cat].push(a); });
  const catNames = { interaction: 'Tương tác', mouse: 'Chuột', touch: 'Touch', scroll: 'Cuộn trang', click: 'Click', tap: 'Tap', device: 'Thiết bị' };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-5 py-4 rounded-t-2xl flex items-center justify-between ${t.bot_detected ? 'bg-red-50' : t.status === 'completed' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-slate-800">Task #{t.id}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.c}`}>{st.l}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${mobile ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                {mobile ? '📱 Mobile' : '🖥️ Desktop'}
              </span>
              {t.bot_detected ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">🚫 BOT</span> : null}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{fmt(t.created_at)} · {t.ip_address}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60"><X size={16} className="text-slate-500" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4 text-xs">
          {/* Task info */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            {[
              ['Nguồn', t.worker_link_id ? `Gateway /${t.gateway_slug || ''}` : 'Vượt link'],
              ['Keyword', t.keyword],
              ['URL đích', t.target_url],
              ['Chiến dịch', t.campaign_name || `#${t.campaign_id}`],
              ['Thu nhập', money(t.earning)],
              ['Thời gian trang', t.time_on_site ? `${t.time_on_site}s` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-slate-400 shrink-0">{k}</span>
                <span className="font-semibold text-slate-700 text-right truncate max-w-[65%]">{v || '—'}</span>
              </div>
            ))}
          </div>

          {/* Detection log */}
          {dl.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Detection Log</p>
              <div className="flex flex-wrap gap-1">
                {dl.map((d, i) => <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">{d}</span>)}
              </div>
            </div>
          )}

          {/* Browser checks */}
          {checks.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Kiểm tra trình duyệt</p>
              <div className="space-y-1">
                {checks.map((c, i) => (
                  <div key={i} className={`flex justify-between px-3 py-1.5 rounded-lg ${c.bad ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <span className={c.bad ? 'text-red-700 font-medium' : 'text-slate-600'}>{c.k}</span>
                    <span className={`font-bold ${c.bad ? 'text-red-800' : 'text-slate-800'}`}>{String(c.v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Behavior assessments */}
          {Object.keys(grouped).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Phân tích hành vi</p>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="mb-2">
                  <p className="text-[11px] font-bold text-slate-600 mb-0.5">{catNames[cat] || cat}</p>
                  {items.map((a, i) => (
                    <div key={i} className={`px-3 py-1 rounded-lg text-[10px] mb-0.5 ${a.flagged ? 'bg-red-50 text-red-700' : 'bg-emerald-50/50 text-emerald-700'}`}>
                      <span className="font-semibold">{a.note}</span>
                      <span className="text-slate-400 ml-1">({String(a.value)})</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {!checks.length && !Object.keys(grouped).length && !dl.length && (
            <p className="text-center text-slate-400 py-6">Chưa có dữ liệu đánh giá bảo mật</p>
          )}
        </div>

        <div className="px-5 py-3 border-t">
          <button onClick={onClose} className="w-full py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Đóng</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Pagination ─── */
function Pager({ page, total, limit, onChange }) {
  const pages = Math.ceil(total / limit) || 1;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs">
      <span className="text-slate-500">Trang {page}/{pages} ({total})</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-white"><ChevronLeft size={14} /></button>
        <button onClick={() => onChange(page + 1)} disabled={page >= pages} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-white"><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

/* ─── User Detail View ─── */
function UserDetail({ user: u, onBack }) {
  const [tab, setTab] = useState('tasks');
  const [tasks, setTasks] = useState([]); const [taskTotal, setTaskTotal] = useState(0);
  const [events, setEvents] = useState([]); const [eventsLoaded, setEventsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [taskPage, setTaskPage] = useState(1);
  const [modal, setModal] = useState(null);
  const LIMIT = 50;

  // Load tasks
  useEffect(() => {
    setLoading(true);
    api.get(`/admin/security/user/${u.id}/tasks?page=${taskPage}&limit=${LIMIT}`)
      .then(d => { setTasks(d.tasks || []); setTaskTotal(d.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [u.id, taskPage]);

  // Load events on tab switch
  useEffect(() => {
    if (tab === 'events' && !eventsLoaded) {
      api.get(`/admin/security/user/${u.id}/events`)
        .then(d => { setEvents(d.events || []); setEventsLoaded(true); })
        .catch(console.error);
    }
  }, [tab, u.id, eventsLoaded]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
          <ArrowLeft size={16} className="text-slate-600" />
        </button>
        <div>
          <h2 className="text-base font-black text-slate-900">{u.name || 'User'}</h2>
          <p className="text-xs text-slate-500">{u.email} · {taskTotal} task tổng cộng</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          ['Tổng', u.total, 'text-slate-800'],
          ['Hoàn thành', u.ok, 'text-emerald-600'],
          ['Blocked', u.blocked, 'text-red-600'],
          ['Cảnh báo', u.events, 'text-amber-600'],
          ['Thu nhập', money(u.earned), 'text-emerald-600'],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-[9px] text-slate-400 font-bold uppercase">{l}</p>
            <p className={`text-lg font-black ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[['tasks', `Tasks (${taskTotal})`], ['events', `Cảnh báo (${u.events})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${tab === k ? 'bg-violet-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >{l}</button>
        ))}
      </div>

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Thời gian','Nguồn','Trạng thái','IP','Keyword','Earning','Đánh giá',''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">Đang tải...</td></tr>
                ) : tasks.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">Không có task</td></tr>
                ) : tasks.map(t => {
                  const s = ST[t.status] || { l: t.status, c: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={t.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${t.bot_detected ? 'bg-red-50/20' : ''}`}>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmt(t.created_at)}</td>
                      <td className="px-3 py-2.5">
                        {t.worker_link_id
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700">GW{t.gateway_slug ? ` /${t.gateway_slug}` : ''}</span>
                          : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">VL</span>
                        }
                      </td>
                      <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.c}`}>{s.l}</span></td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[10px]">{t.ip_address}</td>
                      <td className="px-3 py-2.5 text-slate-700 max-w-[120px] truncate">{t.keyword || '—'}</td>
                      <td className="px-3 py-2.5 font-bold text-emerald-700">{t.earning ? money(t.earning) : '—'}</td>
                      <td className="px-3 py-2.5">
                        {t.bot_detected
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">BOT</span>
                          : t.status === 'completed'
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setModal(t)} className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-[10px] font-bold">
                          <Eye size={11} className="inline mr-0.5" />Xem
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={taskPage} total={taskTotal} limit={LIMIT} onChange={setTaskPage} />
        </div>
      )}

      {/* Events Tab */}
      {tab === 'events' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {!eventsLoaded ? (
            <p className="text-center py-10 text-slate-400 text-xs">Đang tải...</p>
          ) : events.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-xs">Không có cảnh báo</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map(ev => {
                let det = {};
                try { det = JSON.parse(ev.details || '{}'); } catch {}
                const blocked = ['creep_detected','automation_probes','mouse_bot','bot_ua','bot_behavior'].includes(ev.reason);
                const mob = isMobileUA(ev.user_agent);
                return (
                  <div key={ev.id} className={`px-4 py-3 ${blocked ? 'bg-red-50/30' : ''}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${blocked ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {REASON_VI[ev.reason] || ev.reason}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ev.source === 'widget' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                          {ev.source === 'widget' ? 'Script' : ev.source === 'vuotlink' ? 'VL' : ev.source}
                        </span>
                        <span className="text-[10px]">{mob ? '📱' : '🖥️'}</span>
                        <span className="font-mono text-[10px] text-slate-400">{ev.ip_address}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{fmt(ev.created_at)}</span>
                    </div>
                    {(det.totalLied > 0 || det.liedSections?.length || det.probeWarnings?.length) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {det.totalLied > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">Lied: {det.totalLied}</span>}
                        {(det.liedSections || []).map((s, i) => <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">{s}</span>)}
                        {(det.probeWarnings || []).map((w, i) => <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600">{w}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modal && <TaskModal task={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                  */
/* ═══════════════════════════════════════════════════════════ */
export default function AdminSecurity() {
  usePageTitle('Admin - Anti Cheat');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: LIMIT });
      if (search) p.set('search', search);
      const d = await api.get(`/admin/security/users?${p}`);
      setUsers(d.users || []); setTotal(d.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  if (detail) return <UserDetail user={detail} onBack={() => { setDetail(null); load(); }} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Shield size={20} className="text-violet-600" /> Anti Cheat
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} user</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Tìm tên, email, hoặc IP..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['User','Tổng','OK','Blocked','Cảnh báo','IP','Hoạt động',''].map(h => (
                  <th key={h} className={`px-3 py-2.5 font-bold text-slate-500 uppercase text-[10px] ${h === 'User' || h === 'IP' || h === 'Hoạt động' ? 'text-left' : 'text-center'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Đang tải...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Chưa có dữ liệu</td></tr>
              ) : users.map(u => {
                const danger = u.blocked > 0 || u.events > 0;
                return (
                  <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${danger ? 'bg-red-50/15' : ''}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${danger ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {(u.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{u.name || 'N/A'}</p>
                          <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-slate-700">{u.total}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-600">{u.ok}</td>
                    <td className="px-3 py-2.5 text-center">
                      {u.blocked > 0 ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{u.blocked}</span> : <span className="text-slate-300">0</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {u.events > 0 ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{u.events}</span> : <span className="text-slate-300">0</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-0.5">
                        {u.ips.slice(0, 2).map((ip, j) => <span key={j} className="font-mono text-[9px] text-slate-500 bg-slate-50 px-1 py-0.5 rounded">{ip}</span>)}
                        {u.ips.length > 2 && <span className="text-[9px] text-slate-400">+{u.ips.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{ago(u.last_at)}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setDetail(u)} className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-[10px] font-bold">
                        <Eye size={11} className="inline mr-0.5" />Xem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </div>
    </div>
  );
}
