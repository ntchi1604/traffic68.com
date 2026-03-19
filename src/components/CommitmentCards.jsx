import { Users, Shield, RefreshCw, ArrowUpRight } from 'lucide-react';

const cards = [
  {
    icon: Users,
    title: 'TRAFFIC USER THẬT',
    desc: '100% lượt truy cập từ người dùng thật, thiết bị thật — hành vi tự nhiên, không bot, không giả mạo.',
    accent: '#3b82f6',
    bgFrom: '#eff6ff',
    bgTo: '#dbeafe',
  },
  {
    icon: Shield,
    title: 'AN TOÀN SEO TUYỆT ĐỐI',
    desc: 'Tuân thủ 100% chính sách Google Webmaster. Website tuyệt đối không bị phạt hay ảnh hưởng thứ hạng.',
    accent: '#10b981',
    bgFrom: '#ecfdf5',
    bgTo: '#d1fae5',
  },
  {
    icon: RefreshCw,
    title: 'CAM KẾT HOÀN TIỀN',
    desc: 'Ký hợp đồng cam kết chỉ số rõ ràng. Hoàn tiền 100% nếu không đạt mục tiêu đã thỏa thuận.',
    accent: '#f97316',
    bgFrom: '#fff7ed',
    bgTo: '#ffedd5',
  },
  {
    icon: ArrowUpRight,
    title: 'TĂNG CHUYỂN ĐỔI (CRO)',
    desc: 'Traffic chất lượng cao cải thiện tỷ lệ chuyển đổi trực tiếp — tăng doanh thu thực, không chỉ số ảo.',
    accent: '#8b5cf6',
    bgFrom: '#f5f3ff',
    bgTo: '#ede9fe',
  },
];

export default function CommitmentCards() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block bg-gray-100 text-[#0f1e4a] text-xs font-bold px-4 py-1.5 rounded-full mb-3 tracking-widest uppercase">Cam kết của chúng tôi</span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0f1e4a]">TẠI SAO CHỌN TRAFFIC68.COM?</h2>
          <div className="w-14 h-1 bg-[#f97316] mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map(({ icon: Icon, title, desc, accent, bgFrom, bgTo }) => (
            <div
              key={title}
              className="card-hover rounded-2xl p-7 border border-gray-100 shadow-sm flex flex-col items-center text-center"
              style={{ background: `linear-gradient(145deg, ${bgFrom}, ${bgTo})` }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-md"
                style={{ background: accent + '22', border: `2px solid ${accent}33` }}
              >
                <Icon className="w-8 h-8" style={{ color: accent }} strokeWidth={2} />
              </div>
              <h3 className="font-black text-[#0f1e4a] text-sm mb-3 tracking-wide">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              <div className="mt-5 w-8 h-0.5 rounded-full" style={{ background: accent }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
