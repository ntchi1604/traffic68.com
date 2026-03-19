import { Shield, TrendingUp, Headphones } from 'lucide-react';

const metrics = [
  { icon: Shield, color: 'text-blue-500', bg: 'bg-blue-50', label: 'An toàn & Bảo mật', desc: 'Top 1-3 Google trong 60-90 ngày' },
  { icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50', label: 'Tăng SEO bền vững', desc: 'Time on Page, đọc & tương tác' },
  { icon: Headphones, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Hỗ trợ chuyên nghiệp', desc: 'Traffic bền vững, không nhận tạo' },
];

const partners = ['Taboola', 'Teads', 'Criteo', 'Outbrain', 'AdRoll', 'The Trade Desk'];

export default function TrustBar() {
  return (
    <section className="py-16 bg-gray-50 border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Metrics row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto mb-14">
          {metrics.map(({ icon: Icon, color, bg, label, desc }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
              <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
                <Icon size={20} className={color} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1e3a5f]">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Partner logos */}
        <div className="text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.25em] mb-6">
            Được tin tưởng & chứng nhận bởi
          </p>
          <div className="flex items-center justify-center gap-8 sm:gap-12 flex-wrap opacity-30">
            {partners.map(name => (
              <span key={name} className="text-lg sm:text-xl font-black text-gray-600 tracking-wider">
                {name}
              </span>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
