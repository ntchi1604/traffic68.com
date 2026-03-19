import { MapPin, Mail, Phone, Facebook, Linkedin, Star } from 'lucide-react';

const services = ['Traffic SEO', 'Traffic Ads', 'Traffic CRO'];
const resources = ['Blog', 'Hướng dẫn', 'FAQ'];
const legal = ['Điều khoản', 'Bảo mật'];

const contact = [
  { icon: MapPin, text: 'Địa chỉ cụ thể tại Hà Nội' },
  { icon: Mail,   text: 'contact@traffic68.com' },
  { icon: Phone,  text: '0989 759 050' },
  { icon: Phone,  text: '06533 06 339' },
  { icon: Phone,  text: '0692 6 563 558' },
];

function ZaloIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5 fill-current">
      <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm-1.3 28.6c-4.6-.4-8.4-3.1-10-6.9l2.7-1.1c1.1 2.7 3.9 4.7 7 5l.3 3zm2.6.1V29.5c4.2-.4 7.4-3.9 7.4-8.1 0-4.5-3.6-8.1-8.1-8.1S16.5 16.9 16.5 21.4c0 1.5.4 2.9 1.1 4.1l-2.6 1c-.9-1.5-1.4-3.3-1.4-5.1 0-5.8 4.7-10.5 10.5-10.5S34.6 15.6 34.6 21.4c0 5.5-4.2 10-9.6 10.5l-.7.8z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer id="lien-he" className="bg-[#1e3a8a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-10">

          {/* Col 1 — Brand */}
          <div className="md:col-span-1">
            <a href="#" className="flex items-center gap-2 mb-4">
              <img src="/traffic68_com.gif" alt="traffic68.com" className="h-14 sm:h-16 w-auto object-contain" />
            </a>
            <p className="text-gray-300 text-xs leading-relaxed">
              Giải pháp traffic user thật hàng đầu Việt Nam. An toàn, hiệu quả, cam kết kết quả.
            </p>
          </div>

          {/* Col 2 — Dịch vụ */}
          <div>
            <h4 className="text-[#f97316] font-bold text-sm uppercase tracking-wider mb-4">Dịch Vụ</h4>
            <ul className="space-y-2.5">
              {services.map((s) => (
                <li key={s}>
                  <a href="#" className="text-gray-300 hover:text-white text-sm transition-colors">{s}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Tài nguyên */}
          <div>
            <h4 className="text-[#f97316] font-bold text-sm uppercase tracking-wider mb-4">Tài Nguyên</h4>
            <ul className="space-y-2.5">
              {resources.map((r) => (
                <li key={r}>
                  <a href="#" className="text-gray-300 hover:text-white text-sm transition-colors">{r}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Liên hệ */}
          <div>
            <h4 className="text-[#f97316] font-bold text-sm uppercase tracking-wider mb-4">Liên Hệ</h4>
            <ul className="space-y-2.5">
              {contact.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2">
                  <Icon className="w-3.5 h-3.5 text-[#f97316] shrink-0 mt-0.5" />
                  <span className="text-gray-300 text-xs leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 5 — Pháp lý & Socials */}
          <div>
            <h4 className="text-[#f97316] font-bold text-sm uppercase tracking-wider mb-4">Pháp Lý</h4>
            <ul className="space-y-2.5 mb-6">
              {legal.map((l) => (
                <li key={l}>
                  <a href="#" className="text-gray-300 hover:text-white text-sm transition-colors">{l}</a>
                </li>
              ))}
            </ul>
            <div className="flex gap-2.5">
              {[
                { Icon: Facebook, href: '#', label: 'Facebook' },
                { Icon: ZaloIcon, href: '#', label: 'Zalo' },
                { Icon: Linkedin, href: '#', label: 'LinkedIn' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-[#f97316] text-white flex items-center justify-center transition-colors"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-xs">© 2024 traffic68.com. Tất cả quyền được bảo lưu.</p>

          <div className="flex items-center gap-4">
            {/* Trustpilot badge */}
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
              <div className="w-5 h-5 rounded bg-[#00b67a] flex items-center justify-center">
                <Star className="w-3 h-3 text-white fill-current" />
              </div>
              <div>
                <p className="text-white text-[10px] font-black leading-none">Trustpilot</p>
                <p className="text-[#00b67a] text-[9px]">Verified</p>
              </div>
            </div>

            {/* Google Partner badge */}
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
              <span className="text-base font-black" style={{ color: '#4285F4' }}>G</span>
              <div>
                <p className="text-white text-[10px] font-black leading-none">Google</p>
                <p className="text-blue-300 text-[9px]">Partner</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
