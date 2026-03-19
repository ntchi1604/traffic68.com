import { TrendingUp } from 'lucide-react';

const cases = [
  {
    growth: '+150%',
    label: 'Tăng Organic Traffic',
    industry: 'Thương mại điện tử',
    desc: 'Website bán lẻ tăng từ 2.000 lên 5.000 lượt/ngày sau 3 tháng, doanh thu tăng 120%.',
    bars: [20, 35, 45, 60, 75, 90, 100],
  },
  {
    growth: '+500%',
    label: 'Tăng Lượt Xem',
    industry: 'Blog Tin Tức',
    desc: 'Từ 500 người đọc/ngày lên 3.000 sau 60 ngày, 12 từ khóa vào top 3 Google.',
    bars: [10, 20, 30, 50, 70, 85, 100],
  },
  {
    growth: '+280%',
    label: 'Tăng Chuyển Đổi',
    industry: 'Dịch vụ B2B',
    desc: 'Lead chất lượng cao tăng 280%, chi phí mỗi lead giảm 45% so với quảng cáo PPC.',
    bars: [30, 45, 55, 65, 78, 88, 100],
  },
];

export default function CaseStudies() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-4 py-1.5 rounded-full mb-3 tracking-widest uppercase">Thực tế</span>
          <h2 className="text-4xl font-black text-[#1e3a8a]">KẾT QUẢ CHIẾN DỊCH THỰC TẾ</h2>
          <div className="w-16 h-1 bg-[#f97316] mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cases.map(({ growth, label, industry, desc, bars }) => (
            <div key={growth} className="card-hover bg-white rounded-2xl p-6 shadow-md border border-gray-100 overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-5xl font-black text-green-500">{growth}</p>
                  <p className="text-sm font-bold text-[#1e3a8a] mt-1">{label}</p>
                  <span className="text-xs text-orange-500 font-semibold bg-orange-50 px-2 py-0.5 rounded-full">{industry}</span>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>

              {/* Chart */}
              <div className="flex items-end gap-1 h-20 mb-4 bg-gray-50 rounded-xl p-2">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h}%`,
                      background: i === bars.length - 1
                        ? 'linear-gradient(to top, #10b981, #34d399)'
                        : 'linear-gradient(to top, #d1fae5, #a7f3d0)',
                    }}
                  />
                ))}
              </div>

              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>

              <div className="mt-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-gray-400">Kết quả đã xác minh</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
