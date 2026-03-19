import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, UserCog, Trash2, Shield, Ban, Plus, Minus, X, Wallet } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';



/* ── Balance Modal ── */
function BalanceModal({ user, onClose, onDone }) {
  const [type, setType] = useState('add');
  const [amount, setAmount] = useState('');
  const [walletType, setWalletType] = useState('main');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const QUICK_AMOUNTS = [50000, 100000, 500000, 1000000, 5000000, 10000000];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Nhập số tiền hợp lệ');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post(`/admin/users/${user.id}/balance`, {
        amount: Number(amount),
        type,
        walletType,
        note: note || undefined,
      });
      setSuccess(res.message + ` — Số dư mới: ${fmt(res.newBalance)} đ`);
      setTimeout(() => { onDone(); onClose(); }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">Quản lý số dư</h3>
            <p className="text-xs text-slate-500">{user.name} — {user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setType('add')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all
                ${type === 'add'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              <Plus size={16} /> Cộng tiền
            </button>
            <button type="button" onClick={() => setType('subtract')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all
                ${type === 'subtract'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              <Minus size={16} /> Trừ tiền
            </button>
          </div>

          {/* Wallet type */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại ví</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setWalletType('main')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border-2
                  ${walletType === 'main'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                💰 Ví Traffic
              </button>
              <button type="button" onClick={() => setWalletType('commission')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border-2
                  ${walletType === 'commission'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                🎁 Ví Hoa hồng
              </button>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số tiền (VNĐ)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Nhập số tiền..."
              min="1"
              className="w-full px-4 py-3 text-lg font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_AMOUNTS.map(a => (
                <button key={a} type="button" onClick={() => setAmount(String(a))}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition
                    ${Number(amount) === a
                      ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {fmt(a)}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ghi chú (tuỳ chọn)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Lý do cộng/trừ tiền..."
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          {/* Preview */}
          {amount && Number(amount) > 0 && (
            <div className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-2
              ${type === 'add' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <Wallet size={16} />
              {type === 'add' ? 'Cộng' : 'Trừ'} {fmt(Number(amount))} đ vào {walletType === 'main' ? 'Ví Traffic' : 'Ví Hoa hồng'} của {user.name}
            </div>
          )}

          {/* Error / Success */}
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}
          {success && <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium">✓ {success}</div>}

          {/* Submit */}
          <button type="submit" disabled={loading || !!success}
            className={`w-full py-3 rounded-xl text-sm font-black transition-all
              ${type === 'add'
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200'}
              disabled:opacity-50 disabled:cursor-not-allowed`}>
            {loading ? 'Đang xử lý...' : success ? '✓ Hoàn tất' : `Xác nhận ${type === 'add' ? 'cộng' : 'trừ'} tiền`}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function AdminUsers() {
  usePageTitle('Admin - Người dùng');
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [balanceUser, setBalanceUser] = useState(null);

  const fetchUsers = (q = '') => {
    setLoading(true);
    api.get(`/admin/users?search=${q}&limit=50`)
      .then(data => setUsers(data.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(search);
  };

  const updateUser = async (id, updates) => {
    try {
      await api.put(`/admin/users/${id}`, updates);
      fetchUsers(search);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteUser = async (id, name) => {
    if (!confirm(`Xóa người dùng "${name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      fetchUsers(search);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quản lý người dùng</h1>
          <p className="text-sm text-slate-500 mt-1">{users.length} người dùng</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, SĐT..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
        </div>
        <button type="submit" className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition">
          Tìm kiếm
        </button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">ID</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Người dùng</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">SĐT</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Role</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Số dư</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Chiến dịch</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Trạng thái</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500">Ngày tạo</th>
              <th className="px-5 py-3 text-center font-semibold text-slate-500">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/70">
                <td className="px-5 py-3 font-mono text-slate-500">#{u.id}</td>
                <td className="px-5 py-3">
                  <p className="font-semibold text-slate-800">{u.name}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                  {u.username && <p className="text-[10px] text-blue-500 font-medium">@{u.username}</p>}
                </td>
                <td className="px-5 py-3 text-slate-600">{u.phone || '—'}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 text-xs font-bold rounded-full
                    ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {u.role === 'admin' ? '🛡 Admin' : 'User'}
                  </span>
                </td>
                <td className="px-5 py-3 font-semibold text-slate-700">{fmt(u.total_balance)} đ</td>
                <td className="px-5 py-3 text-center text-slate-600">{u.campaign_count}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 text-xs font-bold rounded-full
                    ${u.status === 'active' ? 'bg-green-100 text-green-700' :
                      u.status === 'banned' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                    {u.status === 'active' ? '✓ Active' : u.status === 'banned' ? '✕ Banned' : u.status || 'Active'}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs">{new Date(u.created_at).toLocaleString('vi-VN')}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {/* Balance +/- */}
                    <button onClick={() => setBalanceUser(u)} title="Cộng/Trừ tiền"
                      className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition">
                      <Wallet size={15} />
                    </button>
                    {u.role !== 'admin' && (
                      <button onClick={() => updateUser(u.id, { role: 'admin' })}
                        title="Thăng Admin"
                        className="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition">
                        <Shield size={15} />
                      </button>
                    )}
                    {u.role === 'admin' && (
                      <button onClick={() => updateUser(u.id, { role: 'user' })}
                        title="Hạ User"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                        <UserCog size={15} />
                      </button>
                    )}
                    <button onClick={() => updateUser(u.id, { status: u.status === 'banned' ? 'active' : 'banned' })}
                      title={u.status === 'banned' ? 'Bỏ ban' : 'Ban'}
                      className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition">
                      <Ban size={15} />
                    </button>
                    <button onClick={() => deleteUser(u.id, u.name)}
                      title="Xóa"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {/* Balance Modal */}
      {balanceUser && (
        <BalanceModal
          user={balanceUser}
          onClose={() => setBalanceUser(null)}
          onDone={() => fetchUsers(search)}
        />
      )}
    </div>
  );
}
