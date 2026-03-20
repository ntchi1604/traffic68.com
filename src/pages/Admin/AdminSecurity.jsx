import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Shield, Fingerprint, Bot, MousePointer2, Eye, AlertTriangle,
  CheckCircle2, XCircle, Clock, RefreshCw, Search, ChevronDown,
  Monitor, Smartphone, Globe, TrendingUp, Users, Activity,
  ExternalLink, Video,
} from 'lucide-react';

const CLARITY_PROJECT = 'vyua2zk5dc';
const clarityUrl = (visitorId) =>
  `https://clarity.microsoft.com/project/${CLARITY_PROJECT}/recordings?CustomUserId=${encodeURIComponent(visitorId)}`;
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

/* ── Main ── */
export default function AdminSecurity() {
  usePageTitle('Admin - Bảo mật');
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [topDevices, setTopDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, blocked, warning, passed
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

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
          <p className="text-xs text-slate-500 mt-1">Đánh giá từ FingerprintJS, BotD, Behavioral Analysis</p>
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
            <StatCard icon={XCircle} label="Bị chặn (24h)" value={fmt(s.blockedTasks24h)} sub={pct(s.blockRate)} color="text-red-600" bg="bg-red-50" />
            <StatCard icon={Fingerprint} label="Thiết bị duy nhất" value={fmt(s.uniqueDevices24h)} sub="visitor_id khác nhau" color="text-purple-600" bg="bg-purple-50" />
            <StatCard icon={Bot} label="Bot phát hiện" value={fmt(s.botDetected24h)} sub="BotD + Behavioral" color="text-amber-600" bg="bg-amber-50" />
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
                    <a href={clarityUrl(d.visitor_id)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition">
                      <Video size={12} /> Xem video
                    </a>
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
                <input type="text" placeholder="Tìm IP hoặc visitor_id..." value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          {/* Task Logs Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Activity size={16} className="text-slate-400" /> Lịch sử task gần đây
              </h3>
              <span className="text-xs text-slate-400">{logs.length} results</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">ID</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">IP</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Visitor ID</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">BotD</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Mouse</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Đánh giá</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Thời gian</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Video</th>
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
                        <td className="px-4 py-3 text-xs font-mono text-slate-500 max-w-[100px] truncate">
                          {log.visitor_id ? `${log.visitor_id.substring(0, 12)}...` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            log.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                            log.status === 'pending' ? 'bg-blue-50 text-blue-700' :
                            log.status === 'expired' ? 'bg-slate-100 text-slate-500' :
                            log.status?.startsWith('step') ? 'bg-cyan-50 text-cyan-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {log.status}
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
                          {log.mouse_points ?? '—'} pts
                          {log.mouse_score > 0 && (
                            <span className="ml-1 text-amber-500 font-bold">({log.mouse_score})</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><RiskBadge level={risk} /></td>
                        <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(log.created_at)}</td>
                        <td className="px-4 py-3">
                          {log.visitor_id ? (
                            <a href={clarityUrl(log.visitor_id)} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition">
                              <Video size={10} /> Xem
                            </a>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
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

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition">
                ← Trước
              </button>
              <span className="text-xs text-slate-500 font-medium">Trang {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 20}
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
