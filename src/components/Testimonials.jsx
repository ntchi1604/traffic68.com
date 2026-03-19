import { Star } from 'lucide-react';

const testimonials = [
  {
    quote: '"Tăng trưởng traffic 300% chỉ sau 1 tháng. Rất hài lòng!"',
    name: 'Chị Lan',
    role: 'CEO ABC E-Commerce',
    initials: 'CL',
    color: 'from-pink-400 to-rose-500',
  },
  {
    quote: '"An toàn SEO tuyệt đối, website lên top bền vững."',
    name: 'Anh Đức',
    role: 'Founder XYZ Tech',
    initials: 'AĐ',
    color: 'from-blue-500 to-blue-700',
  },
  {
    quote: '"Hệ thống user thật, tỷ lệ chuyển đổi tăng đáng kể."',
    name: 'Anh Minh',
    role: 'Marketing Manager',
    initials: 'AM',
    color: 'from-orange-400 to-orange-600',
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5 mb-3">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-[#1e3a8a]">
            KHÁCH HÀNG NÓI GÌ VỀ CHÚNG TÔI?
          </h2>
          <div className="w-16 h-1 bg-[#f97316] mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map(({ quote, name, role, initials, color }) => (
            <div
              key={name}
              className="card-hover bg-white rounded-2xl shadow-md p-6 flex flex-col border border-gray-100"
            >
              <Stars />
              <p className="text-gray-600 text-sm leading-relaxed italic flex-1 mb-6">{quote}</p>
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md`}
                >
                  {initials}
                </div>
                <div>
                  <p className="font-bold text-[#1e3a8a] text-sm">{name}</p>
                  <p className="text-xs text-gray-400">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
