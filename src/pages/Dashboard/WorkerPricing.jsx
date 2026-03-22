import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { DollarSign, Wallet, TrendingUp, Zap, CheckCircle, Info } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

export default function WorkerPricing() {
  usePageTitle('Bảng giá');
  const [workerCpc, setWorkerCpc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pricing')
      .then(r => r.json())
      .then(data => {
        const cfg = data.config || {};
        const cpc = parseFloat(cfg.worker_cpc);
        setWorkerCpc(cpc > 0 ? cpc : null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

      {/* Hero CPC Card */}
      <div className="bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 50%)' }} />
        <div className="relative text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
            <DollarSign size={32} className="text-white" />
          </div>
          <p className="text-green-200 text-sm font-medium mb-2">Thu nhập mỗi lượt hoàn thành</p>
          <p className="text-5xl font-black tracking-tight mb-1">
            {workerCpc ? fmt(workerCpc) : '—'} <span className="text-green-300 text-3xl">đ</span>
          </p>
          <p className="text-green-200 text-sm">/mỗi lượt vượt link thành công</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <Zap size={20} className="text-orange-500" />
          Cách kiếm tiền
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: '1',
              color: '#3B82F6',
              bg: '#EFF6FF',
              title: 'Tạo link kiếm tiền',
              desc: 'Nhập URL bạn muốn chia sẻ → hệ thống tạo link /vuot-link/xxxxx',
            },
            {
              step: '2',
              color: '#F97316',
              bg: '#FFF7ED',
              title: 'Chia sẻ link',
              desc: 'Chia sẻ link bạn tạo lên mạng xã hội, diễn đàn, blog...',
            },
            {
              step: '3',
              color: '#22C55E',
              bg: '#F0FDF4',
              title: 'Nhận tiền',
              desc: `Mỗi người hoàn thành vượt link → bạn nhận ${workerCpc ? fmt(workerCpc) + ' đ' : 'CPC'}`,
            },
          ].map(s => (
            <div key={s.step} className="rounded-xl border border-slate-200 p-5 text-center hover:shadow-md transition-shadow">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <span style={{ color: s.color, fontSize: 18, fontWeight: 900 }}>{s.step}</span>
              </div>
              <h3 className="font-bold text-slate-800 text-sm mb-2">{s.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
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
          <p>• Thu nhập được tính tự động khi người dùng hoàn thành vượt link</p>
          <p>• Mức CPC có thể được admin điều chỉnh</p>
          <p>• Thu nhập sẽ cộng ngay vào ví, bạn có thể rút bất kỳ lúc nào</p>
        </div>
      </div>
    </div>
  );
}
