import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, X, Key, Wallet, Shield, ShieldOff, UserCheck, UserX, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';
import { formatMoney as fmt } from '../../lib/format';

/* ── Change Password Modal ── */
function ChangePasswordModal({ user, onClose, onDone }) {
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!newPassword || newPassword.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự'); return; }
    setLoading(true);
    try {
      await api.post(`/agency-admin/buyers/${user.id}/change-password`, { newPassword });
      onDone();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">Đổi mật khẩu</h3>
            <p className="text-xs text-slate-500">{user.name} — {user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mật khẩu mới</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Ít nhất 6 ký tự..."
                autoFocus
                className="w-full px-4 py-3 pr-11 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
            {loading ? 'Đang xử lý...' : 'Xác nhận đổi mật khẩu'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Balance Adjustment Modal ── */
function BalanceModal({ user, onClose, onDone }) {
  const [type, setType] = useState('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const num = Number(amount);
    if (!num || num <= 0) { setError('Số tiền phải lớn hơn 0'); return; }
    setLoading(true);
    try {
      await api.post(`/agency-admin/buyers/${user.id}/balance`, { amount: num, type, note });
      onDone();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">Điều chỉnh số dư</h3>
            <p className="text-xs text-slate-500">{user.name} — {user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Số dư hiện tại: <strong className="text-indigo-600">{fmt(user.balance)} đ</strong>
          </p>
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại</label>
            <div className="flex gap-2">
              <button onClick={() => setType('add')}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${type === 'add' ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                + Cộng tiền
              </button>
              <button onClick={() => setType('subtract')}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${type === 'subtract' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                - Trừ tiền
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số tiền</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ghi chú</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="Lý do điều chỉnh..."
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <button onClick={handleSubmit} disabled={loading}
            className={`w-full py-2.5 text-white text-sm font-bold rounded-xl transition disabled:opacity-50 ${type === 'add' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
            {loading ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function AgencyAdminBuyers() {
  usePageTitle('Đại lý - Quản lý Buyer');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const [pwModal, setPwModal] = useState(null);
  const [balModal, setBalModal] = useState(null);

  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
  const isOwner = currentUser?.agency_role === 'owner';

  const fetchData = (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (search) params.set('search', search);
    api.get(`/agency-admin/buyers?${params}`)
      .then(data => { setUsers(data.users || []); setTotal(data.total || 0); setPage(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(1); }, [search]);

  const toggleStatus = async (u) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/agency-admin/buyers/${u.id}`, { status: newStatus, name: u.name });
      fetchData(page);
    } catch (err) { console.error(err.message); }
  };

  const toggleAdmin = async (u) => {
    const newRole = u.agency_role === 'admin' ? null : 'admin';
    try {
      await api.put(`/agency-admin/buyers/${u.id}/role`, { agency_role: newRole });
      fetchData(page);
    } catch (err) { console.error(err.message); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên, email, username..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition">Tìm kiếm</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition">
              <X size={16} />
            </button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <p className="font-semibold">Không tìm thấy người dùng nào</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['ID', 'Tên', 'Email', 'Username', 'Số dư', 'Campaigns', 'Tổng nạp', 'Trạng thái', 'Vai trò', 'Hành động'].map(h => (
                  <th key={h} className="px-5 py-3 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3 text-xs text-slate-500 font-mono">{u.id}</td>
                  <td className="px-5 py-3 font-semibold text-slate-800 text-xs">{u.name}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{u.email}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{u.username}</td>
                  <td className="px-5 py-3 text-xs font-bold text-indigo-600 tabular-nums whitespace-nowrap">{fmt(u.balance)} đ</td>
                  <td className="px-5 py-3 text-xs text-slate-600 tabular-nums">{u.campaigns ?? 0}</td>
                  <td className="px-5 py-3 text-xs font-bold text-green-600 tabular-nums whitespace-nowrap">{fmt(u.total_deposit)} đ</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                      u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {u.status === 'active' ? 'Hoạt động' : 'Tạm ngưng'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {u.agency_role === 'admin' && (
                      <span className="px-2 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-700">Admin</span>
                    )}
                    {u.agency_role === 'owner' && (
                      <span className="px-2 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700">Owner</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      <button onClick={() => toggleStatus(u)} title={u.status === 'active' ? 'Tạm ngưng' : 'Kích hoạt'}
                        className={`p-1.5 rounded-lg transition ${u.status === 'active' ? 'hover:bg-red-50 text-red-500' : 'hover:bg-green-50 text-green-500'}`}>
                        {u.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      <button onClick={() => setPwModal(u)} title="Đổi mật khẩu"
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition">
                        <Key size={16} />
                      </button>
                      <button onClick={() => setBalModal(u)} title="Điều chỉnh số dư"
                        className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition">
                        <Wallet size={16} />
                      </button>
                      {isOwner && u.agency_role !== 'owner' && (
                        <button onClick={() => toggleAdmin(u)} title={u.agency_role === 'admin' ? 'Gỡ quyền Admin' : 'Gán quyền Admin'}
                          className={`p-1.5 rounded-lg transition ${u.agency_role === 'admin' ? 'hover:bg-red-50 text-red-500' : 'hover:bg-purple-50 text-purple-600'}`}>
                          {u.agency_role === 'admin' ? <ShieldOff size={16} /> : <Shield size={16} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            Trang <span className="font-bold text-slate-700">{page}</span> / {totalPages}
            <span className="ml-2 text-slate-400">({total} người dùng)</span>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => fetchData(page - 1)} disabled={page === 1}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              &lsaquo; Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, [])
              .map((p, i) => p === '...' ? (
                <span key={`d${i}`} className="px-1 text-slate-400 text-xs">&hellip;</span>
              ) : (
                <button key={p} onClick={() => fetchData(p)}
                  className={`w-8 h-8 text-xs font-bold rounded-lg transition ${
                    page === p ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 border border-slate-200 text-slate-600'
                  }`}>{p}</button>
              ))
            }
            <button onClick={() => fetchData(page + 1)} disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              Sau &rsaquo;
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {pwModal && <ChangePasswordModal user={pwModal} onClose={() => setPwModal(null)} onDone={() => fetchData(page)} />}
      {balModal && <BalanceModal user={balModal} onClose={() => setBalModal(null)} onDone={() => fetchData(page)} />}
    </div>
  );
}
