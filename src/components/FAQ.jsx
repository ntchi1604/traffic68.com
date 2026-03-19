import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'Traffic từ traffic68.com có phải người thật không?',
    a: '100% user thật, truy cập từ thiết bị thật (desktop, mobile), hành vi tự nhiên, thời gian xem trang phù hợp. Không có bất kỳ bot hay phần mềm giả mạo nào.',
  },
  {
    q: 'Website tôi có bị Google phạt không?',
    a: 'Không. Chúng tôi tuân thủ chính sách Google Webmaster. Traffic hoạt động như người dùng bình thường, không vi phạm bất kỳ thuật toán nào của Google.',
  },
  {
    q: 'Tôi cần chuẩn bị gì trước khi đăng ký?',
    a: 'Chỉ cần URL website và mục tiêu traffic (từ khóa, địa lý, ngành hàng). Chuyên gia sẽ tư vấn gói phù hợp và thiết lập chiến dịch cho bạn.',
  },
  {
    q: 'Bao lâu thì thấy kết quả?',
    a: 'Traffic bắt đầu chạy trong 24h sau khi kích hoạt. Kết quả SEO thường thấy rõ sau 2-4 tuần. Thứ hạng Google cải thiện trong 1-3 tháng.',
  },
  {
    q: 'traffic68.com có cam kết kết quả không?',
    a: 'Có. Chúng tôi ký hợp đồng cam kết chỉ số traffic, hoàn tiền 100% nếu không đạt mục tiêu đã thỏa thuận trong thời gian quy định.',
  },
  {
    q: 'Tôi có thể theo dõi traffic thực tế không?',
    a: 'Có. Bạn có thể xác minh qua Google Analytics, Google Search Console và dashboard riêng của traffic68.com với dữ liệu real-time 24/7.',
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        id={`faq-${q.substring(0, 20).replace(/\s+/g, '-')}`}
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

export default function FAQ() {
  return (
    <section id="faq" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block bg-blue-100 text-[#1e3a8a] text-xs font-bold px-4 py-1.5 rounded-full mb-3 tracking-widest uppercase">FAQ</span>
          <h2 className="text-4xl font-black text-[#1e3a8a]">CÂU HỎI THƯỜNG GẶP</h2>
          <div className="w-16 h-1 bg-[#f97316] mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {faqs.map((faq) => (
            <FaqItem key={faq.q} {...faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
