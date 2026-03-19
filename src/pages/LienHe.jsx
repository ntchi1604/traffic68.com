import { useState } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { MapPin, Mail, Phone, MessageCircle, Clock, CheckCircle2, Send } from 'lucide-react';
import Footer from '../components/Footer';

const contactInfo = [
  { icon: MapPin, label: 'Địa chỉ', value: 'Hà Nội, Việt Nam', sub: 'Làm việc: T2 – T7, 8:00 – 18:00' },
  { icon: Mail, label: 'Email', value: 'contact@traffic68.com', sub: 'Phản hồi trong 30 phút' },
  { icon: Phone, label: 'Hotline', value: '0989 759 050', sub: '06533 06 339 · 0692 6 563 558' },
  { icon: MessageCircle, label: 'Live Chat', value: 'Zalo / Telegram', sub: 'Hỗ trợ 24/7 real-time' },
];

const reasons = [
  '100% Traffic user thật, không bot',
  'Cam kết hoàn tiền nếu không đạt KPI',
  'Hỗ trợ chuyên gia 24/7',
  'Báo cáo minh bạch, real-time',
];

export default function LienHe() {
  usePageTitle('Liên hệ');
  const [form, setForm] = useState({ name: '', email: '', phone: '', service: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <>
      <div className="hero-bg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 uppercase">
            Liên Hệ <span className="text-[#f97316]">Với Chúng Tôi</span>
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Nhận tư vấn miễn phí từ chuyên gia trong vòng 5 phút. Không cam kết, không ràng buộc.
          </p>
        </div>
      </div>

      <section className="py-6 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {contactInfo.map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="card-hover flex items-start gap-4 bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <div className="w-11 h-11 gradient-btn rounded-xl flex items-center justify-center shrink-0 shadow-md">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">{label}</p>
                  <p className="font-bold text-[#1e3a8a] text-sm">{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
                <h2 className="text-2xl font-black text-[#1e3a8a] mb-1">Gửi Yêu Cầu Tư Vấn</h2>
                <p className="text-gray-500 text-sm mb-7">Điền thông tin bên dưới – chuyên gia sẽ liên hệ trong 30 phút.</p>

                {sent ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-xl font-black text-[#1e3a8a] mb-2">Gửi thành công!</h3>
                    <p className="text-gray-500 text-sm">Chuyên gia sẽ liên hệ với bạn trong vòng 30 phút.</p>
                    <button onClick={() => setSent(false)} className="mt-6 text-sm text-[#f97316] font-semibold hover:underline">Gửi yêu cầu khác</button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Họ và tên *</label>
                        <input required name="name" value={form.name} onChange={handleChange} placeholder="Nguyễn Văn A" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email *</label>
                        <input required type="email" name="email" value={form.email} onChange={handleChange} placeholder="email@example.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Số điện thoại</label>
                        <input name="phone" value={form.phone} onChange={handleChange} placeholder="0912 345 678" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Dịch vụ quan tâm</label>
                        <select name="service" value={form.service} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] bg-white transition">
                          <option value="">Chọn dịch vụ...</option>
                          <option>Traffic SEO</option>
                          <option>Traffic Ads</option>
                          <option>Traffic CRO</option>
                          <option>Tư vấn tổng thể</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nội dung yêu cầu *</label>
                      <textarea required name="message" value={form.message} onChange={handleChange} rows={5} placeholder="Mô tả mục tiêu traffic, URL website và yêu cầu cụ thể của bạn..." className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition resize-none" />
                    </div>
                    <button type="submit" className="w-full orange-btn text-white font-black py-4 rounded-xl shadow-lg flex items-center justify-center gap-2.5 text-sm">
                      <Send className="w-4 h-4" /> GỬI YÊU CẦU TƯ VẤN
                    </button>
                    <p className="text-center text-xs text-gray-400">✓ Miễn phí · ✓ Không spam · ✓ Bảo mật 100%</p>
                  </form>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#1e3a8a] rounded-2xl p-7 text-white">
                <h3 className="text-lg font-black mb-4">Tại Sao Chọn Chúng Tôi?</h3>
                <ul className="space-y-3">
                  {reasons.map((r) => (
                    <li key={r} className="flex items-start gap-2.5 text-sm text-white/80">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <h3 className="text-base font-black text-[#1e3a8a] mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#f97316]" /> Thời Gian Làm Việc
                </h3>
                <ul className="space-y-2.5 text-sm">
                  {[
                    { day: 'Thứ 2 – Thứ 6', time: '8:00 – 18:00' },
                    { day: 'Thứ 7', time: '8:00 – 12:00' },
                    { day: 'Chủ nhật', time: 'Chat 24/7' },
                  ].map(({ day, time }) => (
                    <li key={day} className="flex justify-between">
                      <span className="text-gray-600">{day}</span>
                      <span className="font-semibold text-[#1e3a8a]">{time}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 text-center">
                <p className="text-[#1e3a8a] font-black text-base mb-1">Cần hỗ trợ khẩn cấp?</p>
                <p className="text-sm text-gray-500 mb-4">Gọi hotline 24/7 để được hỗ trợ ngay</p>
                <a href="tel:0989759050" className="orange-btn text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md inline-flex items-center gap-2">
                  <Phone className="w-4 h-4" /> 0989 759 050
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
