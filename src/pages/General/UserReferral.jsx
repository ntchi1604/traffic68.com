import { useState, useEffect } from 'react';
import { Users, Copy, Check, Gift, Share2 } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../lib/api';

export default function UserReferral() {
  usePageTitle('Giới thiệu bạn bè');
  const [data, setData] = useState({ referralCode: '', referrals: [] });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/users/referrals').then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const refLink = `${window.location.origin}/dang-ky?ref=${data.referralCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
          <Gift size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Giới thiệu bạn bè</h1>
          <p className="text-sm text-slate-500">Chia sẻ link và nhận thưởng khi bạn bè đăng ký</p>
        </div>
      </div>

      {/* Referral Link Card */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl p-6 mb-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Share2 size={18} />
          <span className="font-bold text-sm">Link giới thiệu của bạn</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/20 backdrop-blur rounded-xl px-4 py-3 font-mono text-sm truncate">
            {loading ? '...' : refLink}
          </div>
          <button onClick={copyLink}
            className="px-4 py-3 bg-white text-violet-700 rounded-xl font-bold text-sm hover:bg-violet-50 transition flex items-center gap-2 shrink-0">
            {copied ? <><Check size={16} /> Đã sao chép</> : <><Copy size={16} /> Sao chép</>}
          </button>
        </div>
        <p className="text-violet-200 text-xs mt-3">Mã giới thiệu: <span className="font-mono font-bold text-white">{data.referralCode || '...'}</span></p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase">Tổng người giới thiệu</p>
          <p className="text-3xl font-black text-violet-600 mt-1">{data.referrals.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase">Đang hoạt động</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">
            {data.referrals.filter(r => r.status === 'active').length}
          </p>
        </div>
      </div>

      {/* Referral List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users size={18} className="text-violet-600" />
          <h2 className="font-bold text-slate-800">Danh sách người được giới thiệu</h2>
        </div>
        {loading ? (
          <div className="text-center py-12 text-slate-400">Đang tải...</div>
        ) : data.referrals.length === 0 ? (
          <div className="text-center py-12">
            <Gift size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 font-medium">Chưa có ai đăng ký qua link của bạn</p>
            <p className="text-slate-400 text-sm mt-1">Chia sẻ link giới thiệu để bắt đầu nhận thưởng!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">#</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Người dùng</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Loại</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Trạng thái</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Ngày tham gia</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map((r, i) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 text-slate-400 text-sm">{i + 1}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-sm text-slate-800">{r.name || r.email}</p>
                      <p className="text-xs text-slate-400">{r.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.service_type === 'worker' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                        {r.service_type === 'worker' ? 'Worker' : 'Buyer'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.status === 'active' ? 'Hoạt động' : r.status || 'Chưa xác minh'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
