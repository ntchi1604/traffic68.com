import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Search, CheckCircle2, XCircle, Clock, X, ShieldCheck,
  Globe, ChevronDown, ChevronLeft, ChevronRight, ExternalLink,
  RefreshCw, Users, AlertTriangle,
} from 'lucide-react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

/* ─── Status config ─── */
const STATUS = {
  pending:  { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700 border-amber-200',  icon: Clock,         dot: 'bg-amber-400' },
  approved: { label: 'Đã duyệt',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, dot: 'bg-emerald-400' },
  rejected: { label: 'Từ chối',   cls: 'bg-red-100 text-red-700 border-red-200',         icon: XCircle,       dot: 'bg-red-400' },
};

/* ─── Stat Card ─── */
function StatCard({ label, value, icon: Icon, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[130px] flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-150 text-left
        ${active
          ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
          : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm'}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-slate-800">{value ?? '—'}</p>
        <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
      </div>
    </button>
  );
}

/* ─── Approval Modal ─── */
function ApprovalModal({ user, onClose, onDone }) {
  const [groups,         setGroups]         = useState([]);
  const [selectedGroup,  setSelectedGroup]  = useState('');
  const [rejectReason,   setRejectReason]   = useState('');
  const [mode,           setMode]           = useState(user.source_status === 'approved' ? 'reject' : 'approve');
  const [loading,        setLoading]        = useState(false);

  useEffect(() => {
    api.get('/admin/pricing-groups').then(d => {
      const g = d.groups || [];
      setGroups(g);
      const cur = g.find(x => x.id === user.pricing_group_id);
      setSelectedGroup(String(cur?.id || g[0]?.id || ''));
    }).catch(() => {});
  }, [user.pricing_group_id]);

  const handle = async () => {
    setLoading(true);
    try {
      if (mode === 'approve') {
        await api.put(`/admin/users/${user.id}/approve-source`, {
          pricing_group_id: selectedGroup ? Number(selectedGroup) : undefined,
        });
        onDone('approved', user);
      } else {
        await api.put(`/admin/users/${user.id}/reject-source`, { reason: rejectReason });
        onDone('rejected', user);
      }
      onClose();
    } catch (err) { alert(err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">Xét duyệt nguồn</h3>
            <p className="text-xs text-slate-500 mt-0.5">{user.name} · {user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Source URL box */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
              <Globe size={12} /> Nguồn worker cung cấp:
            </p>
            {user.source_url ? (
              <div className="space-y-1">
                <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{user.source_url}</p>
                {user.source_url.startsWith('http') && (
                  <a href={user.source_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1">
                    <ExternalLink size={11} /> Mở link
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Chưa điền nguồn</p>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {[
              { key: 'approve', label: 'Duyệt',   icon: CheckCircle2, active: 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' },
              { key: 'reject',  label: 'Từ chối', icon: XCircle,       active: 'bg-red-500 text-white shadow-lg shadow-red-200' },
            ].map(({ key, label, icon: Icon, active }) => (
              <button key={key} onClick={() => setMode(key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition
                  ${mode === key ? active : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {/* Approve: group select */}
          {mode === 'approve' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Gán vào nhóm giá</label>
              <div className="relative">
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Reject: reason */}
          {mode === 'reject' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Lý do từ chối (tuỳ chọn)</label>
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="VD: Nguồn không hợp lệ, không rõ ràng..."
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-transparent" />
            </div>
          )}

          <button onClick={handle} disabled={loading}
            className={`w-full py-3 rounded-xl text-sm font-black transition disabled:opacity-50
              ${mode === 'approve'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-100'}`}>
            {loading
              ? 'Đang xử lý...'
              : mode === 'approve'
                ? `✅ Duyệt & gán nhóm "${groups.find(g => String(g.id) === selectedGroup)?.name || ''}"`
                : '❌ Xác nhận từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
const LIMIT = 25;

export default function AdminSourceApproval() {
  usePageTitle('Admin – Xét duyệt nguồn');
  const toast = useToast();

  const [stats,        setStats]        = useState(null);
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState('pending');
  const [page,         setPage]         = useState(1);
  const [total,        setTotal]        = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);

  /* Fetch stats */
  const fetchStats = useCallback(async () => {
    try {
      const d = await api.get('/admin/source-approval/stats');
      setStats(d);
    } catch (_) {}
  }, []);

  /* Fetch list with server-side filter */
  const fetchUsers = useCallback(async (q = '', p = 1, f = filter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: q,
        limit: LIMIT,
        page: p,
        service_type: 'shortlink',
        source_status: f,
        has_source: 1,   // chỉ hiện worker đã gửi source_url
      });
      const data = await api.get(`/admin/users?${params}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPage(p);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUsers(search, 1, filter); }, [filter]); // eslint-disable-line

  const handleSearch = (e) => { e.preventDefault(); fetchUsers(search, 1, filter); };

  const handleDone = (result, user) => {
    toast.success(result === 'approved'
      ? `✅ Đã duyệt nguồn ${user.name}`
      : `❌ Đã từ chối ${user.name}`);
    fetchStats();
    fetchUsers(search, page, filter);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">

      {/* ═══ Header ═══ */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck size={24} className="text-indigo-500" />
            Xét duyệt nguồn
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Duyệt nguồn traffic worker · tích hợp gán nhóm giá khi duyệt
          </p>
        </div>
        <button onClick={() => { fetchStats(); fetchUsers(search, page, filter); }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition">
          <RefreshCw size={13} /> Làm mới
        </button>
      </div>

      {/* ═══ Stats Cards ═══ */}
      <div className="flex flex-wrap gap-3">
        <StatCard label="Chờ duyệt" value={stats?.pending}
          icon={Clock} color="bg-amber-400"
          active={filter === 'pending'} onClick={() => setFilter('pending')} />
        <StatCard label="Đã duyệt" value={stats?.approved}
          icon={CheckCircle2} color="bg-emerald-500"
          active={filter === 'approved'} onClick={() => setFilter('approved')} />
        <StatCard label="Từ chối" value={stats?.rejected}
          icon={XCircle} color="bg-red-500"
          active={filter === 'rejected'} onClick={() => setFilter('rejected')} />
        <StatCard label="Tổng worker" value={stats?.total}
          icon={Users} color="bg-indigo-500"
          active={filter === 'all'} onClick={() => setFilter('all')} />
      </div>

      {/* ═══ Search bar ═══ */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, số điện thoại..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white" />
        </div>
        <button type="submit"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition shadow-sm">
          Tìm
        </button>
      </form>

      {/* ═══ Table ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-9 h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center">
            <ShieldCheck size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 text-sm font-medium">
              {filter === 'pending' ? 'Không có worker nào chờ duyệt 🎉' : 'Không tìm thấy kết quả'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Worker</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Trạng thái</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Nguồn cung cấp</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Ngày đăng ký</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => {
                  const st = u.source_status || 'pending';
                  const cfg = STATUS[st] || STATUS.pending;
                  const Icon = cfg.icon;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">

                      {/* Worker info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                            {u.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                            {u.phone && <p className="text-xs text-slate-400">{u.phone}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>
                          <Icon size={11} /> {cfg.label}
                        </span>
                        {u.source_note && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1 max-w-[140px]" title={u.source_note}>
                            <AlertTriangle size={9} className="inline mr-0.5 text-amber-400" />
                            {u.source_note}
                          </p>
                        )}
                      </td>

                      {/* Source URL */}
                      <td className="px-5 py-3.5 max-w-xs">
                        {u.source_url ? (
                          <div>
                            <p className="text-xs text-slate-700 line-clamp-2 whitespace-pre-wrap">{u.source_url}</p>
                            {u.source_url.startsWith('http') && (
                              <a href={u.source_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline mt-0.5">
                                <ExternalLink size={10} /> Mở link
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 italic">Chưa điền</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString('vi-VN')}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-center">
                        <button onClick={() => setSelectedUser(u)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition shadow-sm
                            ${st === 'approved'
                              ? 'text-red-600 hover:bg-red-50 border border-red-200'
                              : 'text-white bg-indigo-600 hover:bg-indigo-700'}`}>
                          {st === 'approved'
                            ? <><XCircle size={12} /> Thu hồi</>
                            : <><ShieldCheck size={12} /> Xét duyệt</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Hiển thị {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} / {total} worker
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => fetchUsers(search, page - 1, filter)}
                className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition">
                <ChevronLeft size={16} className="text-slate-600" />
              </button>
              <span className="text-xs font-semibold text-slate-600 px-2">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => fetchUsers(search, page + 1, filter)}
                className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition">
                <ChevronRight size={16} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedUser && (
        <ApprovalModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
