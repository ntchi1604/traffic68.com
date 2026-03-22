import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { DollarSign, Wallet, TrendingUp, CheckCircle, Info, Zap } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

const TYPE_LABELS = {
  google_search: { label: 'Google Search Traffic', color: 'bg-blue-100 text-blue-700' },
  social: { label: 'Social Traffic', color: 'bg-pink-100 text-pink-700' },
  direct: { label: 'Direct Traffic', color: 'bg-green-100 text-green-700' },
};

export default function WorkerPricing() {
  usePageTitle('Bảng giá');
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/worker-pricing')
      .then(r => r.json())
      .then(data => setTiers(data.tiers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group by traffic_type
  const grouped = {};
  tiers.forEach(t => {
    if (!grouped[t.traffic_type]) grouped[t.traffic_type] = [];
    grouped[t.traffic_type].push(t);
  });

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Bảng giá' },
      ]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Bảng giá thu nhập</h1>
        <p className="text-slate-500 text-sm mt-1">Số tiền bạn nhận được mỗi lượt vượt link hoàn thành</p>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 50%)' }} />
        <div className="relative">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Zap size={20} /> Cách kiếm tiền
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Tạo link kiếm tiền', desc: 'Nhập URL → hệ thống tạo link /vuot-link/xxxxx' },
              { step: '2', title: 'Chia sẻ link', desc: 'Đăng lên MXH, diễn đàn, blog...' },
              { step: '3', title: 'Nhận tiền', desc: 'Mỗi lượt hoàn thành → nhận CPC bên dưới' },
            ].map(s => (
              <div key={s.step} className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2 font-black text-lg">{s.step}</div>
                <h3 className="font-bold text-sm mb-1">{s.title}</h3>
                <p className="text-green-100 text-xs">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Tables */}
      {Object.entries(grouped).map(([type, items]) => {
        const typeInfo = TYPE_LABELS[type] || { label: type, color: 'bg-gray-100 text-gray-700' };
        return (
          <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <DollarSign size={18} className="text-emerald-500" />
              <span className={`px-3 py-1 text-xs font-bold rounded-full ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Thời gian chiến dịch</th>
                    <th className="px-5 py-3 text-left font-semibold text-emerald-600">V1 — Thu nhập / lượt</th>
                    <th className="px-5 py-3 text-left font-semibold text-emerald-600">V2 — Thu nhập / lượt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-bold text-slate-700">{t.duration}</td>
                      <td className="px-5 py-3 font-bold text-emerald-700">{fmt(t.v1_price)} đ</td>
                      <td className="px-5 py-3 font-bold text-emerald-700">{fmt(t.v2_price)} đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Rút tiền tối thiểu', value: '50.000 đ' },
          { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Thanh toán', value: '1-3 ngày' },
          { icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Phương thức', value: 'Bank / Momo' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
              <k.icon size={20} className={k.color} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">{k.label}</p>
              <p className="text-lg font-black text-slate-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-800 space-y-1">
          <p className="font-bold">Lưu ý</p>
          <p>• Thu nhập tự động cộng vào ví khi visitor hoàn thành vượt link</p>
          <p>• CPC tùy thuộc vào thời gian và version chiến dịch</p>
          <p>• Bảng giá có thể thay đổi, vui lòng kiểm tra thường xuyên</p>
        </div>
      </div>
    </div>
  );
}
