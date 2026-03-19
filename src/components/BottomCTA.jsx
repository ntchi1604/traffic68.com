import { Rocket, ArrowRight } from 'lucide-react';

export default function BottomCTA() {
  return (
    <section className="py-20 cloud-bg relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-4xl sm:text-5xl font-black text-[#1e3a8a] mb-6 leading-tight">
          SẴN SÀNG TĂNG TRƯỞNG<br />
          <span className="text-[#f97316]">WEBSITE CỦA BẠN?</span>
        </h2>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          Nhận tư vấn miễn phí từ chuyên gia trong vòng 5 phút. Không cam kết, không ràng buộc.
        </p>
        <a
          href="#"
          className="gradient-btn text-white text-lg font-black px-10 py-5 rounded-2xl shadow-xl inline-flex items-center gap-3"
          id="bottom-cta-btn"
        >
          NHẬN TƯ VẤN MIỄN PHÍ NGAY
          <ArrowRight className="w-6 h-6" />
        </a>
        <p className="mt-4 text-sm text-gray-400">✓ Miễn phí · ✓ Không spam · ✓ Phản hồi trong 30 phút</p>
      </div>
    </section>
  );
}
