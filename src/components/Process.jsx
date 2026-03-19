import { Search, Users, MousePointer, BarChart2, ChevronRight } from 'lucide-react';

const steps = [
  {
    icon: Search,
    color: '#3b82f6',
    bg: '#eff6ff',
    title: 'PHÂN TÍCH WEBSITE',
    desc: 'Phân tích từ khóa, đối thủ và chân dung khách hàng lý tưởng.',
  },
  {
    icon: Users,
    color: '#f97316',
    bg: '#fff7ed',
    title: 'KÍCH HOẠT HỆ THỐNG USER THẬT',
    desc: 'Phân bổ traffic từ mạng lưới hàng ngàn user thật, đã được xác minh.',
  },
  {
    icon: MousePointer,
    color: '#10b981',
    bg: '#ecfdf5',
    title: 'TRUY CẬP TỰ NHIÊN & TƯƠNG TÁC',
    desc: 'User truy cập từ tìm kiếm Google, link xã hội, và thực hiện hành vi thật trên trang.',
  },
  {
    icon: BarChart2,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    title: 'BÁO CÁO CHI TIẾT & TỐI ƯU',
    desc: 'Báo cáo thời gian thực, chi tiết nguồn traffic, hành vi user, và điều chỉnh chiến lược.',
  },
];

export default function Process() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black">
            <span className="text-[#1e3a8a]">LÀM THẾ NÀO </span>
            <span className="text-[#f97316]">traffic68.com </span>
            <span className="text-[#1e3a8a]">MANG LẠI HIỆU QUẢ THỰC?</span>
          </h2>
          <div className="w-16 h-1 bg-[#f97316] mx-auto mt-4 rounded-full" />
        </div>

        <div className="flex flex-col md:flex-row items-stretch justify-center gap-0">
          {steps.map(({ icon: Icon, color, bg, title, desc }, idx) => (
            <div key={title} className="flex flex-col md:flex-row items-center flex-1 min-w-0">
              <div className="card-hover flex flex-col items-center text-center px-5 py-7 rounded-2xl border border-gray-100 bg-white shadow-sm flex-1 mx-1 my-3 md:my-0 w-full">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 shadow-sm"
                  style={{ background: bg, border: `2px solid ${color}22` }}
                >
                  <Icon className="w-10 h-10" style={{ color }} strokeWidth={1.6} />
                </div>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black mb-3 shadow"
                  style={{ background: color }}
                >
                  {idx + 1}
                </div>
                <h3 className="font-black text-[#1e3a8a] text-sm uppercase tracking-wide leading-snug mb-2">
                  {title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>

              {idx < steps.length - 1 && (
                <ChevronRight className="hidden md:block w-7 h-7 text-[#f97316] shrink-0 mx-0.5" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
