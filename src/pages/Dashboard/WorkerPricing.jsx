import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { DollarSign, Zap, Star, Crown } from 'lucide-react';

const tiers = [
  {
    name: 'Cơ bản',
    icon: Zap,
    rate: '50 đ / click',
    color: 'border-blue-200 bg-blue-50',
    iconColor: 'text-blue-600',
    features: ['Tối đa 50 link', 'Báo cáo cơ bản', 'Rút tiền từ 50.000 đ', 'Hỗ trợ email'],
  },
  {
    name: 'Nâng cao',
    icon: Star,
    rate: '80 đ / click',
    color: 'border-orange-200 bg-orange-50',
    iconColor: 'text-orange-600',
    badge: 'Phổ biến',
    features: ['Tối đa 200 link', 'Báo cáo chi tiết', 'Rút tiền từ 30.000 đ', 'API truy cập', 'Hỗ trợ ưu tiên'],
  },
  {
    name: 'VIP',
    icon: Crown,
    rate: '120 đ / click',
    color: 'border-purple-200 bg-purple-50',
    iconColor: 'text-purple-600',
    features: ['Link không giới hạn', 'Thống kê real-time', 'Rút tiền không giới hạn', 'API đầy đủ', 'Hỗ trợ 24/7', 'Custom domain'],
  },
];

export default function WorkerPricing() {
  usePageTitle('Bảng giá');

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Bảng giá' },
      ]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Bảng giá thành viên</h1>
        <p className="text-slate-500 text-sm mt-1">Chọn gói phù hợp để tối ưu thu nhập</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map(t => (
          <div key={t.name} className={`relative bg-white rounded-xl border-2 ${t.color} p-6 hover:shadow-lg transition-shadow`}>
            {t.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full">{t.badge}</span>
            )}
            <div className="flex items-center gap-3 mb-4">
              <t.icon size={24} className={t.iconColor} />
              <h3 className="text-lg font-bold text-slate-900">{t.name}</h3>
            </div>
            <p className="text-2xl font-black text-slate-900 mb-4">{t.rate}</p>
            <ul className="space-y-2 mb-6">
              {t.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <DollarSign size={12} className="text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button className="w-full py-2.5 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition">
              Chọn gói
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
