import { useState, useEffect, useCallback, useRef } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, UserCog, Trash2, Shield, Ban, Plus, Minus, X, Wallet, Briefcase, HardHat, MoreVertical } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

/* ── Balance Modal ── */
function BalanceModal({ user, isWorkerPage, onClose, onDone }) {
  const [type, setType] = useState('add');
  const [amount, setAmount] = useState('');
  const isWorker = isWorkerPage || user.service_type === 'shortlink';
  const [walletType, setWalletType] = useState(isWorker ? 'earning' : 'main');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const QUICK_AMOUNTS = [50000, 100000, 500000, 1000000, 5000000, 10000000];
  const WALLET_OPTIONS = isWorker
    ? [
      { key: 'earning', label: 'Ví Thu nhập', color: 'green' },
      { key: 'commission', label: 'Ví Hoa hồng', color: 'orange' },
    ]
    : [
      { key: 'main', label: 'Ví Traffic', color: 'blue' },
      { key: 'commission', label: 'Ví Hoa hồng', color: 'orange' },
    ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setError('Nhập số tiền hợp lệ'); return; }
    setError(''); setLoading(true);
    try {
      const res = await api.post(`/admin/users/${user.id}/balance`, { amount: Number(amount), type, walletType, note: note || undefined });
      setSuccess(res.message + ` — Số dư mới: ${fmt(res.newBalance)} đ`);
      setTimeout(() => { onDone(); onClose(); }, 1500);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">Quản lý số dư</h3>
            <p className="text-xs text-slate-500">{user.name} — {user.email}</p>
            <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isWorker ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              {isWorker ? <><HardHat size={10} /> Worker</> : <><Briefcase size={10} /> Buyer</>}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={18} className="text-slate-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex gap-2">
            <button type="button" onClick={() => setType('add')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all
                ${type === 'add' ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              <Plus size={16} /> Cộng tiền
            </button>
            <button type="button" onClick={() => setType('subtract')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all
                ${type === 'subtract' ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              <Minus size={16} /> Trừ tiền
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại ví</label>
            <div className="flex gap-2">
              {WALLET_OPTIONS.map(w => (
                <button key={w.key} type="button" onClick={() => setWalletType(w.key)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border-2
                    ${walletType === w.key
                      ? `border-${w.color}-500 bg-${w.color}-50 text-${w.color}-700`
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  style={walletType === w.key ? { borderColor: w.color === 'green' ? '#22c55e' : w.color === 'blue' ? '#3b82f6' : '#f97316', backgroundColor: w.color === 'green' ? '#f0fdf4' : w.color === 'blue' ? '#eff6ff' : '#fff7ed' } : {}}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số tiền (VNĐ)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Nhập số tiền..." min="1"
              className="w-full px-4 py-3 text-lg font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_AMOUNTS.map(a => (
                <button key={a} type="button" onClick={() => setAmount(String(a))}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${Number(amount) === a ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {fmt(a)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ghi chú (tuỳ chọn)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Lý do cộng/trừ tiền..."
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          {amount && Number(amount) > 0 && (
            <div className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${type === 'add' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <Wallet size={16} />
              {type === 'add' ? 'Cộng' : 'Trừ'} {fmt(Number(amount))} đ vào {WALLET_OPTIONS.find(w => w.key === walletType)?.label || walletType} của {user.name}
            </div>
          )}

          {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}
          {success && <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium">{success}</div>}

          <button type="submit" disabled={loading || !!success}
            className={`w-full py-3 rounded-xl text-sm font-black transition-all
              ${type === 'add' ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200' : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200'}
              disabled:opacity-50 disabled:cursor-not-allowed`}>
            {loading ? 'Đang xử lý...' : success ? 'Hoàn tất' : `Xác nhận ${type === 'add' ? 'cộng' : 'trừ'} tiền`}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function AdminUsers({ type }) {
  const isWorker = type === 'workers';
  usePageTitle('Admin - Quản lý');
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [balanceUser, setBalanceUser] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchUsers = useCallback((q = '') => {
    setLoading(true);
    const serviceType = isWorker ? 'shortlink' : 'traffic';
    const roleParam = isWorker ? '&include_admin=1' : '';
    api.get(`/admin/users?search=${q}&limit=50&service_type=${serviceType}${roleParam}`)
      .then(data => setUsers(data.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isWorker]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e) => { e.preventDefault(); fetchUsers(search); };

  const updateUser = async (id, updates) => {
    try { await api.put(`/admin/users/${id}`, updates); fetchUsers(search); }
    catch (err) { toast.error(err.message); }
  };

  const deleteUser = async (id, name) => {
    if (!await toast.confirm(`Xóa người dùng "${name}"? Hành động này không thể hoàn tác.`)) return;
    try { await api.delete(`/admin/users/${id}`); fetchUsers(search); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Quản lý
          </h1>
          <p className="text-sm text-slate-500 mt-1">{users.length} {isWorker ? 'worker' : 'buyer'}</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên, email, SĐT..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
        </div>
        <button type="submit" className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition">Tìm kiếm</button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-visible">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">ID</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Người dùng</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">SĐT</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Role</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Số dư</th>
                {isWorker ? (
                  <>
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Nhiệm vụ</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Thu nhập</th>
                  </>
                ) : (
                  <th className="px-5 py-3 text-left font-semibold text-slate-500">Chiến dịch</th>
                )}
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Trạng thái</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Ngày tạo</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-500">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr><td colSpan={isWorker ? 10 : 9} className="py-12 text-center text-slate-400">Không có người dùng</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-mono text-slate-500">#{u.id}</td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                    {u.username && <p className="text-[10px] text-blue-500 font-medium">@{u.username}</p>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{u.phone || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {u.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {isWorker ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-emerald-600">{fmt(u.earning_balance)} đ</p>
                        <p className="text-[10px] text-slate-400">{fmt(u.commission_balance)} đ</p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-emerald-600">{fmt(u.main_balance)} đ</p>
                        <p className="text-[10px] text-slate-400">{fmt(u.commission_balance)} đ</p>
                      </div>
                    )}
                  </td>
                  {isWorker ? (
                    <>
                      <td className="px-5 py-3 text-center text-slate-600 font-semibold">{u.task_count}</td>
                      <td className="px-5 py-3 font-semibold text-green-600 text-xs">{fmt(u.total_earning)} đ</td>
                    </>
                  ) : (
                    <td className="px-5 py-3 text-center text-slate-600">{u.campaign_count}</td>
                  )}
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full
                    ${u.status === 'active' ? 'bg-green-100 text-green-700' :
                        u.status === 'banned' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {u.status === 'active' ? 'Active' : u.status === 'banned' ? 'Banned' : u.status || 'Active'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{new Date(u.created_at).toLocaleString('vi-VN')}</td>
                  <td className="px-5 py-3">
                    <div className="relative flex justify-center" ref={openMenuId === u.id ? menuRef : null}>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openMenuId === u.id && (
                        <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[170px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                          <button
                            onClick={() => { setBalanceUser(u); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left"
                          >
                            <Wallet size={14} className="text-emerald-500" /> Cộng / Trừ tiền
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => { updateUser(u.id, { role: 'admin' }); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left"
                            >
                              <Shield size={14} className="text-orange-500" /> Thăng lên Admin
                            </button>
                          )}
                          {u.role === 'admin' && (
                            <button
                              onClick={() => { updateUser(u.id, { role: 'user' }); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left"
                            >
                              <UserCog size={14} className="text-slate-500" /> Hạ xuống User
                            </button>
                          )}
                          <button
                            onClick={() => { updateUser(u.id, { status: u.status === 'banned' ? 'active' : 'banned' }); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition text-left"
                          >
                            <Ban size={14} className="text-amber-500" /> {u.status === 'banned' ? 'Bỏ ban' : 'Ban tài khoản'}
                          </button>
                          <div className="border-t border-slate-100 my-1" />
                          <button
                            onClick={() => { deleteUser(u.id, u.name); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition text-left"
                          >
                            <Trash2 size={14} /> Xóa người dùng
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {balanceUser && <BalanceModal user={balanceUser} isWorkerPage={isWorker} onClose={() => setBalanceUser(null)} onDone={() => fetchUsers(search)} />}
    </div>
  );
}
