import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../lib/api';

export default function UserReferral() {
  usePageTitle('Giới thiệu bạn bè');
  const [data, setData] = useState({ referralCode: '', referrals: [], commissionPercent: null, totalCommission: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const location = useLocation();
  const isWorker = location.pathname.startsWith('/worker');

  useEffect(() => {
    const ctx = isWorker ? 'worker' : 'buyer';
    api.get(`/users/referrals?context=${ctx}`).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [isWorker]);

  const refLink = `${window.location.origin}/dang-ky?ref=${data.referralCode}`;
  const pct = data.commissionPercent;

  const copyLink = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalComm = data.totalCommission || 0;
  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Giới thiệu bạn bè</h1>
      </div>

      {/* Promo Banner */}
      {pct && <div className="relative overflow-hidden rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-6">
        <div className="relative z-10">
          <p className="text-lg font-black text-slate-900 leading-snug">
            Tạo cơ hội kiếm thêm thu nhập với{' '}
            <span className="text-orange-600 text-2xl">{pct}%</span>{' '}
            {isWorker ? 'tổng thu nhập' : 'tổng nạp'} của người được giới thiệu
          </p>
          {isWorker ? (
            <p className="text-sm text-slate-500 mt-2">
              Chia sẻ link cho bạn bè → Họ đăng ký và làm nhiệm vụ vượt link → Mỗi khi họ nhận thu nhập, bạn tự động nhận <span className="font-bold text-slate-700">{pct}%</span> hoa hồng vào ví
            </p>
          ) : (
            <p className="text-sm text-slate-500 mt-2">
              Chia sẻ link cho bạn bè → Họ đăng ký và nạp tiền mua traffic → Mỗi khi họ nạp tiền, bạn tự động nhận <span className="font-bold text-slate-700">{pct}%</span> hoa hồng vào ví
            </p>
          )}
        </div>
        <div className="absolute -right-4 -top-4 w-32 h-32 bg-orange-200/30 rounded-full blur-2xl" />
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-amber-200/20 rounded-full blur-3xl" />
      </div>}

      {/* Referral Link */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Link giới thiệu của bạn</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 font-mono text-sm text-slate-700 truncate">
            {loading ? '...' : refLink}
          </div>
          <button onClick={copyLink}
            className={`px-4 py-3 rounded-lg font-bold text-sm transition flex items-center gap-2 shrink-0 ${copied ? 'bg-green-500 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}>
            {copied ? <><Check size={16} /> Đã chép</> : <><Copy size={16} /> Sao chép</>}
          </button>
        </div>
        <p className="text-slate-400 text-xs mt-2">Mã giới thiệu: <span className="font-mono font-bold text-slate-600">{data.referralCode || '...'}</span></p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase">Tổng giới thiệu</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{data.referrals.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase">Tổng hoa hồng</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{fmt(totalComm)}<span className="text-sm font-semibold text-slate-400 ml-1">đ</span></p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-sm">Danh sách người được giới thiệu</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : data.referrals.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 font-medium">Chưa có ai đăng ký qua link của bạn</p>
            <p className="text-slate-400 text-sm mt-1">Chia sẻ link giới thiệu để bắt đầu nhận thưởng</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Người dùng</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Hoa hồng</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Trạng thái</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Ngày tham gia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.referrals.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800">{r.name || r.email}</p>
                      <p className="text-xs text-slate-400">{r.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      {r.commissionEarned > 0 ? (
                        <div>
                          <p className="font-bold text-amber-600 text-sm">{fmt(r.commissionEarned)}<span className="text-xs font-normal text-slate-400 ml-0.5">đ</span></p>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
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
