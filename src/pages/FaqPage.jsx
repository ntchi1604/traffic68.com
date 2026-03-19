import { useState } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';
import Footer from '../components/Footer';
import BottomCTA from '../components/BottomCTA';

const categories = ['Tất cả', 'Traffic & SEO', 'Thanh toán', 'Kỹ thuật', 'Chính sách'];

const faqs = [
  {
    category: 'Traffic & SEO',
    q: 'Traffic từ traffic68.com có phải người thật không?',
    a: '100% user thật, truy cập từ thiết bị thật (desktop, mobile), hành vi tự nhiên, thời gian xem trang phù hợp. Không có bất kỳ bot hay phần mềm giả mạo nào.',
  },
  {
    category: 'Traffic & SEO',
    q: 'Website tôi có bị Google phạt không?',
    a: 'Không. Chúng tôi tuân thủ chính sách Google Webmaster. Traffic hoạt động như người dùng bình thường, không vi phạm bất kỳ thuật toán nào của Google.',
  },
  {
    category: 'Traffic & SEO',
    q: 'Bao lâu thì thấy kết quả SEO rõ rệt?',
    a: 'Traffic bắt đầu chạy trong 24h sau khi kích hoạt. Kết quả SEO thường thấy rõ sau 2–4 tuần. Thứ hạng Google cải thiện trong 1–3 tháng.',
  },
  {
    category: 'Traffic & SEO',
    q: 'Tôi có thể nhắm mục tiêu địa lý cụ thể không?',
    a: 'Có. Chúng tôi hỗ trợ nhắm mục tiêu theo quốc gia, tỉnh/thành phố, thậm chí theo bán kính địa lý từ gói Pro trở lên.',
  },
  {
    category: 'Traffic & SEO',
    q: 'Traffic có ảnh hưởng đến Google Analytics không?',
    a: 'Có. Vì đây là user thật nên sẽ hiển thị trong Google Analytics như người dùng thực tế. Bạn có thể xác minh trong GA và Google Search Console.',
  },
  {
    category: 'Thanh toán',
    q: 'Các phương thức thanh toán được chấp nhận?',
    a: 'Chúng tôi chấp nhận: Chuyển khoản ngân hàng, thẻ Visa/Mastercard, USDT/USDC, Momo, ZaloPay và PayPal.',
  },
  {
    category: 'Thanh toán',
    q: 'Chính sách hoàn tiền như thế nào?',
    a: 'Cam kết hoàn tiền 100% trong 30 ngày nếu traffic không đạt chỉ số đã thỏa thuận trong hợp đồng. Không hỏi thêm câu hỏi nào.',
  },
  {
    category: 'Thanh toán',
    q: 'Tôi có phải ký hợp đồng dài hạn không?',
    a: 'Không. Tất cả gói đều thanh toán theo tháng, không ràng buộc. Bạn có thể hủy hoặc nâng cấp bất cứ lúc nào.',
  },
  {
    category: 'Kỹ thuật',
    q: 'Tôi cần chuẩn bị gì trước khi đăng ký?',
    a: 'Chỉ cần URL website và mục tiêu traffic (từ khóa, địa lý, ngành hàng). Chuyên gia sẽ tư vấn gói phù hợp và thiết lập chiến dịch cho bạn.',
  },
  {
    category: 'Kỹ thuật',
    q: 'Tôi có thể theo dõi traffic thực tế không?',
    a: 'Có. Bạn có thể xác minh qua Google Analytics, Google Search Console và dashboard riêng của traffic68.com với dữ liệu real-time 24/7.',
  },
  {
    category: 'Kỹ thuật',
    q: 'Có hỗ trợ API không?',
    a: 'Có. Gói Enterprise có hỗ trợ REST API đầy đủ để tích hợp với hệ thống nội bộ của bạn. Tài liệu API chi tiết sẽ được cung cấp sau khi đăng ký.',
  },
  {
    category: 'Chính sách',
    q: 'traffic68.com có cam kết kết quả không?',
    a: 'Có. Chúng tôi ký hợp đồng cam kết chỉ số traffic, hoàn tiền 100% nếu không đạt mục tiêu đã thỏa thuận trong thời gian quy định.',
  },
  {
    category: 'Chính sách',
    q: 'Dữ liệu website của tôi có được bảo mật không?',
    a: 'Tuyệt đối. Tất cả thông tin được mã hóa SSL 256-bit, không chia sẻ với bên thứ ba theo chính sách bảo mật GDPR.',
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-[#1e3a8a] text-sm leading-snug">{q}</span>
        <ChevronDown className={`w-5 h-5 text-[#f97316] shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`faq-answer ${open ? 'open' : ''}`}>
        <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export default function FaqPage() {
  usePageTitle('Câu hỏi thường gặp');
  const [active, setActive] = useState('Tất cả');
  const [query, setQuery] = useState('');

  const filtered = faqs.filter((f) => {
    const matchCat = active === 'Tất cả' || f.category === active;
    const matchQ = f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <>
      <div className="hero-bg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 uppercase">
            Câu Hỏi <span className="text-[#f97316]">Thường Gặp</span>
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
            Tìm câu trả lời nhanh chóng cho mọi thắc mắc về dịch vụ traffic của chúng tôi.
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm câu hỏi..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white text-sm text-gray-700 border-0 shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>
      </div>

      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${active === cat ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1e3a8a] hover:text-[#1e3a8a]'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Không tìm thấy câu hỏi phù hợp.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((faq) => (
                <FaqItem key={faq.q} {...faq} />
              ))}
            </div>
          )}

          <div className="mt-14 bg-[#1e3a8a] rounded-2xl p-8 text-center">
            <h3 className="text-xl font-black text-white mb-2">Không tìm thấy câu trả lời?</h3>
            <p className="text-white/70 text-sm mb-5">Đội ngũ hỗ trợ của chúng tôi luôn sẵn sàng 24/7</p>
            <a href="/lien-he" className="inline-flex items-center gap-2 orange-btn text-white font-bold px-6 py-3 rounded-xl shadow-lg text-sm">
              Liên hệ hỗ trợ ngay
            </a>
          </div>
        </div>
      </section>

      <BottomCTA />
      <Footer />
    </>
  );
}
