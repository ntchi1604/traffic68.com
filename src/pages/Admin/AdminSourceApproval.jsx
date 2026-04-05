import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, CheckCircle2, XCircle, Clock, X, ShieldCheck, Globe, ChevronDown } from 'lucide-react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

const STATUS_BADGE = {
  pending:  { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Đã duyệt',  cls: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  rejected: { label: 'Từ chối',   cls: 'bg-red-100 text-red-700',      icon: XCircle },
};

/* ── Approval Modal ── */
function ApprovalModal({ user, onClose, onDone }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [mode, setMode] = useState('approve');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/admin/pricing-groups').then(d => {
      const g = d.groups || [];
      setGroups(g);
      // Pre-select current group if exists
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">Xét duyệt nguồn</h3>
            <p className="text-xs text-slate-500 mt-0.5">{user.name} — {user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Source URL */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
              <Globe size={12} /> Nguồn worker cung cấp:
            </p>
            {user.source_url ? (
              <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{user.source_url}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">Chưa điền nguồn</p>
            )}
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2">
            {[
              { key: 'approve', label: 'Duyệt',    icon: CheckCircle2, active: 'bg-green-500 text-white shadow-lg shadow-green-200' },
              { key: 'reject',  label: 'Từ chối',  icon: XCircle,       active: 'bg-red-500 text-white shadow-lg shadow-red-200' },
            ].map(({ key, label, icon: Icon, active }) => (
              <button key={key} onClick={() => setMode(key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition
                  ${mode === key ? active : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {mode === 'approve' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Gán vào plan (nhóm giá)</label>
              <div className="relative">
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

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
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200'}`}>
            {loading ? 'Đang xử lý...' : mode === 'approve'
              ? `✅ Duyệt & gán plan "${groups.find(g => String(g.id) === selectedGroup)?.name || ''}"`
              : '❌ Xác nhận từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function AdminSourceApproval() {
  usePageTitle('Admin - Xét duyệt nguồn');
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending'); // pending | all | approved | rejected
  const [selectedUser, setSelectedUser] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 30;

  const fetchUsers = useCallback(async (q = '', p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: q,
        limit: LIMIT,
        page: p,
        service_type: 'shortlink',
      });
      const data = await api.get(`/admin/users?${params}`);
      let list = data.users || [];
      // Filter by source_status on client side (or add server-side later)
      if (filter !== 'all') {
        list = list.filter(u => (u.source_status || 'pending') === filter);
      }
      setUsers(list);
      setTotal(filter === 'all' ? (data.total || 0) : list.length);
      setPage(p);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchUsers(search, 1); }, [fetchUsers]);

  const handleSearch = (e) => { e.preventDefault(); fetchUsers(search, 1); };

  const handleDone = (result, user) => {
    toast.success(result === 'approved' ? `✅ Đã duyệt nguồn ${user.name}` : `❌ Đã từ chối ${user.name}`);
    fetchUsers(search, page);
  };

  const pendingList = users.filter(u => (u.source_status || 'pending') === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Xét duyệt nguồn</h1>
          <p className="text-sm text-slate-500 mt-1">Duyệt nguồn traffic worker — kết hợp gán plan khi duyệt</p>
        </div>
        {pendingList.length > 0 && (
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-sm font-bold rounded-xl">
            <Clock size={14} /> {pendingList.length} chờ duyệt
          </span>
        )}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status filter */}
        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
          {[
            { key: 'pending',  label: 'Chờ duyệt', count: true },
            { key: 'approved', label: 'Đã duyệt' },
            { key: 'rejected', label: 'Từ chối' },
            { key: 'all',      label: 'Tất cả' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                filter === key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition">
            Tìm
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldCheck size={32} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 text-sm font-medium">Không có worker nào cần duyệt</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Worker</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Trạng thái</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Nguồn cung cấp</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Ngày đăng ký</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-500">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => {
                const st = u.source_status || 'pending';
                const badge = STATUS_BADGE[st] || STATUS_BADGE.pending;
                const BadgeIcon = badge.icon;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                      {u.phone && <p className="text-xs text-slate-400">{u.phone}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${badge.cls}`}>
                        <BadgeIcon size={11} /> {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 max-w-xs">
                      {u.source_url ? (
                        <p className="text-xs text-slate-600 line-clamp-2 whitespace-pre-wrap">{u.source_url}</p>
                      ) : (
                        <p className="text-xs text-slate-300 italic">Chưa điền</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {new Date(u.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {st !== 'approved' ? (
                        <button onClick={() => setSelectedUser(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm">
                          <ShieldCheck size={12} /> Xét duyệt
                        </button>
                      ) : (
                        <button onClick={() => setSelectedUser(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition">
                          <XCircle size={12} /> Thu hồi
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
