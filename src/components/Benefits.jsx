import { Shield, TrendingUp, BarChart2, Users, Zap, Lock, Globe, Award } from 'lucide-react';

const benefits = [
  { icon: Users, title: 'Traffic User Thật 100%', desc: 'Người dùng thực tế, không bot, không giả mạo — đảm bảo an toàn tuyệt đối cho website.' },
  { icon: Shield, title: 'An Toàn Tuyệt Đối', desc: 'Tuân thủ chính sách Google, không vi phạm thuật toán, website không bị phạt.' },
  { icon: TrendingUp, title: 'Tăng Thứ Hạng SEO', desc: 'Cải thiện thứ hạng từ khóa trên Google, gia tăng vị trí top 1-3 nhanh chóng.' },
  { icon: BarChart2, title: 'Phân Tích Chuyên Sâu', desc: 'Dashboard báo cáo real-time, theo dõi mọi chỉ số traffic chi tiết theo ngày.' },
  { icon: Zap, title: 'Triển Khai Nhanh', desc: 'Bắt đầu nhận traffic trong vòng 24 giờ sau khi kích hoạt gói dịch vụ.' },
  { icon: Globe, title: 'Đa Quốc Gia', desc: 'Traffic từ hơn 50 quốc gia, nhắm mục tiêu địa lý chính xác theo yêu cầu.' },
  { icon: Lock, title: 'Bảo Mật Dữ Liệu', desc: 'Thông tin website được mã hóa SSL, tuyệt đối bảo mật và không chia sẻ bên thứ ba.' },
  { icon: Award, title: 'Cam Kết Kết Quả', desc: 'Cam kết bằng hợp đồng, hoàn tiền 100% nếu không đạt chỉ số đã thỏa thuận.' },
];

export default function Benefits() {
  return (
    <section id="dich-vu" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block bg-blue-100 text-[#1e3a8a] text-xs font-bold px-4 py-1.5 rounded-full mb-3 tracking-widest uppercase">Tại sao chọn chúng tôi</span>
          <h2 className="text-4xl font-black text-[#1e3a8a]">LỢI ÍCH CHÍNH</h2>
          <div className="w-16 h-1 bg-[#f97316] mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card-hover bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex flex-col items-center text-center">
              <div className="w-14 h-14 gradient-btn rounded-2xl flex items-center justify-center mb-4 shadow-md">
                <Icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-bold text-[#1e3a8a] text-base mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
