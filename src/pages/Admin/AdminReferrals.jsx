import { useState, useEffect, useCallback } from 'react';
import { Search, Save, Check, Users, UserPlus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

const LIMIT = 20;

export default function AdminReferrals({ type = 'buyers' }) {
  const label = type === 'workers' ? 'Worker' : 'Buyer';
  usePageTitle('Admin - Referral');
  const toast = useToast();

  const [data, setData] = useState({ referrers: [], totalReferred: 0, totalReferrers: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [commission, setCommission] = useState('');
  const [commSaving, setCommSaving] = useState(false);
  const [commSaved, setCommSaved] = useState(false);

  // Detail modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [referredList, setReferredList] = useState([]);

  const settingKey = type === 'workers' ? 'referral_commission_worker' : 'referral_commission_buyer';

  useEffect(() => {
    api.get('/admin/settings/site').then(d => {
      const config = d.config || {};
      setCommission(config[settingKey] || '5');
    }).catch(() => { });
  }, [settingKey]);

  const saveCommission = async () => {
    setCommSaving(true);
    try {
      await api.put('/admin/settings/site', { settings: { [settingKey]: commission } });
      setCommSaved(true);
      setTimeout(() => setCommSaved(false), 2000);
    } catch { }
    setCommSaving(false);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      const d = await api.get(`/admin/referrals/${type}?${params}`);
      setData(d);
    } catch { }
    setLoading(false);
  }, [type, search, page]);

  // Reset về trang 1 khi search thay đổi
  useEffect(() => { setPage(1); }, [search, type]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (user) => {
    setSelectedUser(user);
    if (user.ref_count > 0) {
      setDetailLoading(true);
      try {
        const d = await api.get(`/admin/referrals/${type}/${user.id}`);
        setReferredList(d.referred || []);
      } catch { setReferredList([]); }
      setDetailLoading(false);
    } else {
      setReferredList([]);
    }
  };

  const closeDetail = () => { setSelectedUser(null); setReferredList([]); };

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / LIMIT));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Referral</h1>
      </div>

      {/* Commission + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase mb-2">Hoa hồng {label}</p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number" min="0" max="100" step="0.5"
                value={commission}
                onChange={e => setCommission(e.target.value)}
                className="w-full pr-8 pl-3 py-2 border border-slate-200 rounded-lg text-lg font-black text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
            </div>
            <button onClick={saveCommission} disabled={commSaving}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 shrink-0 ${commSaved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
              {commSaved ? <><Check size={14} /> Đã lưu</> : <><Save size={14} /> Lưu</>}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {type === 'workers'
              ? <>Ví dụ: {commission || 5}% → worker ref kiếm 100.000đ = <strong className="text-amber-600">{Math.floor(100000 * Number(commission || 5) / 100).toLocaleString('vi-VN')}đ</strong> hoa hồng cho người giới thiệu</>
              : <>Ví dụ: {commission || 5}% → nạp 1.000.000đ = <strong className="text-amber-600">{Math.floor(1000000 * Number(commission || 5) / 100).toLocaleString('vi-VN')}đ</strong> hoa hồng</>
            }
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase">Người giới thiệu</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{data.totalReferrers}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase">Được giới thiệu</p>
          <p className="text-3xl font-black text-green-600 mt-1">{data.totalReferred}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên, email, mã referral..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : data.referrers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="font-medium">Không tìm thấy người dùng</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-slate-500">Người dùng</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-500">Mã giới thiệu</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-500">Được giới thiệu bởi</th>
                  <th className="px-5 py-3 text-center font-semibold text-slate-500">Số người ref</th>
                  <th className="px-5 py-3 text-center font-semibold text-slate-500">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.referrers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800 text-sm">{u.name || u.email}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{u.referral_code || '—'}</span>
                    </td>
                    <td className="px-5 py-3">
                      {u.referred_by_name ? (
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{u.referred_by_name}</p>
                          <p className="text-[10px] text-slate-400">{u.referred_by_email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {u.ref_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold">
                          <UserPlus size={12} /> {u.ref_count}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => openDetail(u)}
                        className="px-3 py-1.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition">
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && data.total > LIMIT && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Trang <span className="font-bold text-slate-700">{page}</span> / {totalPages}
              <span className="ml-2 text-slate-400">({data.total} người dùng)</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={15} className="text-slate-600" />
              </button>
              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && arr[i - 1] !== p - 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) => p === '...' ? (
                  <span key={`dots-${i}`} className="px-1 text-slate-400 text-xs">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs font-bold rounded-lg transition ${page === p ? 'bg-orange-500 text-white' : 'hover:bg-white border border-slate-200 text-slate-600'}`}
                  >
                    {p}
                  </button>
                ))
              }
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={15} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeDetail}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-900">{selectedUser.name || selectedUser.email}</h3>
                <p className="text-xs text-slate-400">{selectedUser.email} · Mã: <span className="font-mono text-blue-600">{selectedUser.referral_code}</span></p>
                {selectedUser.referred_by_name && (
                  <p className="text-xs text-slate-500 mt-1">
                    Được giới thiệu bởi: <strong className="text-amber-600">{selectedUser.referred_by_name}</strong>
                  </p>
                )}
              </div>
              <button onClick={closeDetail} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-green-600" />
                <h4 className="font-bold text-slate-800 text-sm">
                  Danh sách đã giới thiệu ({selectedUser.ref_count})
                </h4>
              </div>

              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : referredList.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Users size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Chưa giới thiệu ai</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {referredList.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{r.name || r.email}</p>
                          <p className="text-[11px] text-slate-400">{r.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                          {r.status === 'active' ? 'Hoạt động' : r.status || '—'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(r.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
