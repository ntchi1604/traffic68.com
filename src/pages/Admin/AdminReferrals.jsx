import { useState, useEffect, useCallback } from 'react';
import { Users, Search, ChevronDown, ChevronRight, Gift, Percent, Save, Check } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../lib/api';

export default function AdminReferrals({ type = 'buyers' }) {
  const label = type === 'workers' ? 'Worker' : 'Buyer';
  usePageTitle(`Admin - Referral ${label}`);

  const [data, setData] = useState({ referrers: [], totalReferred: 0, totalReferrers: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [commission, setCommission] = useState('');
  const [commSaving, setCommSaving] = useState(false);
  const [commSaved, setCommSaved] = useState(false);

  const settingKey = type === 'workers' ? 'referral_commission_worker' : 'referral_commission_buyer';

  useEffect(() => {
    api.get('/admin/settings').then(d => {
      const settings = d.settings || {};
      setCommission(settings[settingKey] || '10');
    }).catch(() => {});
  }, [settingKey]);

  const saveCommission = async () => {
    setCommSaving(true);
    try {
      await api.put('/admin/settings', { settings: { [settingKey]: commission } });
      setCommSaved(true);
      setTimeout(() => setCommSaved(false), 2000);
    } catch { }
    setCommSaving(false);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const d = await api.get(`/admin/referrals/${type}?${params}`);
      setData(d);
    } catch { }
    setLoading(false);
  }, [type, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
          <Gift size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Referral {label}</h1>
          <p className="text-sm text-slate-500">Quản lý giới thiệu {type === 'workers' ? 'worker' : 'buyer'}</p>
        </div>
      </div>

      {/* Commission + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Percent size={14} className="text-amber-600" />
            <p className="text-xs text-slate-500 font-semibold uppercase">Hoa hồng {label}</p>
          </div>
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
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase">Tổng người giới thiệu</p>
          <p className="text-3xl font-black text-violet-600 mt-1">{data.totalReferrers}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase">Tổng được giới thiệu</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{data.totalReferred}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, mã referral..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
        </div>
      </div>

      {/* Referrer list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Đang tải...</div>
        ) : data.referrers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="font-medium">Chưa có referral nào</p>
          </div>
        ) : (
          <div>
            {data.referrers.map(ref => (
              <div key={ref.id} className="border-b border-slate-100 last:border-0">
                <button onClick={() => toggle(ref.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {(ref.name || ref.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{ref.name || ref.email}</p>
                      <p className="text-xs text-slate-400">{ref.email} • Mã: <span className="font-mono text-violet-600">{ref.referral_code}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-bold">
                      {ref.ref_count} người
                    </span>
                    {expanded[ref.id] ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                  </div>
                </button>
                {expanded[ref.id] && ref.referred && (
                  <div className="bg-slate-50/50 px-5 pb-4">
                    <table className="w-full">
                      <thead>
                        <tr className="text-[10px] font-bold text-slate-500 uppercase">
                          <th className="text-left py-2 px-3">Người dùng</th>
                          <th className="text-left py-2 px-3">Loại</th>
                          <th className="text-left py-2 px-3">Trạng thái</th>
                          <th className="text-left py-2 px-3">Ngày tham gia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ref.referred.map(r => (
                          <tr key={r.id} className="border-t border-slate-100">
                            <td className="py-2 px-3">
                              <p className="text-sm font-semibold text-slate-700">{r.name || r.email}</p>
                              <p className="text-xs text-slate-400">{r.email}</p>
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.service_type === 'worker' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                                {r.service_type === 'worker' ? 'Worker' : 'Buyer'}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {r.status === 'active' ? 'Hoạt động' : r.status || 'Chưa xác minh'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-slate-500">
                              {new Date(r.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
