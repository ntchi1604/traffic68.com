import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Tag } from 'lucide-react';
import Footer from '../components/Footer';
import BottomCTA from '../components/BottomCTA';
import { formatMoney as fmt } from '../lib/format';

/* ── Static styling per traffic type ── */
const TYPE_STYLE = {
  google_search: { bg: 'bg-blue-50', border: 'border-blue-100', icon: '/google_icon.png', title: 'GOOGLE SEARCH TRAFFIC' },
  social: { bg: 'bg-pink-50', border: 'border-pink-100', icon: '/social_icons.png', title: 'SOCIAL TRAFFIC' },
  direct: { bg: 'bg-green-50', border: 'border-green-100', icon: '/direct_icon.png', title: 'DIRECT TRAFFIC' },
};

const faqs = [
  { q: 'Tôi có thể nâng cấp gói bất cứ lúc nào không?', a: 'Có, bạn có thể nâng hoặc hạ gói bất cứ lúc nào. Phần dư sẽ được tính theo tỷ lệ ngày.' },
  { q: 'Có hợp đồng ràng buộc dài hạn không?', a: 'Không. Tất cả gói đều thanh toán theo tháng, hủy bất cứ lúc nào không mất phí.' },
  { q: 'Chính sách hoàn tiền như thế nào?', a: 'Cam kết hoàn tiền 100% trong 30 ngày nếu traffic không đạt chỉ số đã thỏa thuận.' },
  { q: 'Traffic có ảnh hưởng đến Google Analytics không?', a: 'Có. Traffic sẽ hiển thị trong Google Analytics như người dùng thực tế vì đây là user thật.' },
];

export default function BangGia() {
  usePageTitle('Bảng giá');

  const [cards, setCards] = useState([]);
  const [config, setConfig] = useState({ discount_code: 'SALE_ALL_40', discount_percent: '40', discount_label: '', discount_enabled: 'true' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pricing')
      .then(r => r.json())
      .then(data => {
        if (data.config) setConfig(c => ({ ...c, ...data.config }));

        // Group tiers by traffic_type
        const grouped = {};
        (data.tiers || []).forEach(t => {
          if (!grouped[t.traffic_type]) grouped[t.traffic_type] = [];
          grouped[t.traffic_type].push(t);
        });

        // Convert to card format
        const order = ['google_search', 'social', 'direct'];
        const result = order
          .filter(type => grouped[type])
          .map(type => {
            const style = TYPE_STYLE[type] || { bg: 'bg-gray-50', border: 'border-gray-100', icon: '', title: type };
            return {
              ...style,
              tiers: grouped[type].map(t => ({
                dur: t.duration,
                v1: t.v1_price,
                d1: t.v1_discount,
                v2: t.v2_price,
                d2: t.v2_discount,
              })),
            };
          });
        setCards(result);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const discountEnabled = config.discount_enabled === 'true';
  const discountPercent = config.discount_percent || '40';

  return (
    <>
      {/* Hero */}
      <div className="hero-bg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 uppercase leading-tight">
            Bảng Giá <span className="text-[#f97316]">Dịch Vụ</span>
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Bảng giá chi tiết theo loại traffic và thời lượng.
          </p>
        </div>
      </div>

      {/* Pricing cards */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Discount banner — only show when enabled */}
          {discountEnabled && (
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-red-500 to-orange-500 text-white
                              rounded-2xl px-6 py-3 shadow-lg shadow-red-200/40">
                <Tag size={18} />
                <div className="text-left">
                  <p className="text-sm font-black">{config.discount_label || `Giảm giá ${discountPercent}%`}</p>
                  <p className="text-xs opacity-80">
                    Trong lúc tạo chiến dịch mới add mã giảm giá <strong className="bg-white/20 px-1.5 py-0.5 rounded">{config.discount_code}</strong>.
                  </p>
                </div>
                <span className="text-2xl font-black">Giảm {discountPercent}%</span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            /* 3 cards */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cards.map(({ bg, border, icon, title, tiers }) => (
                <div
                  key={title}
                  className={`${bg} border ${border} rounded-2xl p-6 flex flex-col transition-all hover:shadow-lg hover:-translate-y-1`}
                >
                  <img src={icon} alt={title} className="w-20 h-20 object-contain mx-auto mb-3" />
                  <h3 className="text-center text-base font-black text-[#1e3a5f] uppercase tracking-wide mb-5">
                    {title}
                  </h3>

                  <div className="space-y-4 flex-1">
                    {tiers.map(({ dur, v1, d1, v2, d2 }) => (
                      <div key={dur} className="bg-white/60 rounded-xl p-3 border border-gray-100/80">
                        <p className="text-sm text-gray-700 mb-1.5">
                          - <strong>Gói {dur}:</strong>{' '}
                          <span className="text-gray-500">[Thời gian: <strong>{dur}</strong>]</span>
                        </p>

                        {/* Version 1 */}
                        <div className="flex items-start gap-1.5 mb-1">
                          <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                          <span className="text-sm">
                            Version 1 (2 bước){' '}
                            <span className="text-[10px] font-bold text-white bg-orange-500 px-1.5 py-0.5 rounded">Best</span>
                            :{' '}
                            {discountEnabled ? (
                              <>
                                <span className="line-through text-gray-400">{fmt(v1)} VNĐ</span>{' '}
                                <strong>{fmt(d1)} VNĐ</strong>{' '}
                                <span className="text-red-500 font-bold text-xs">(-{discountPercent}%)</span>
                              </>
                            ) : (
                              <strong>{fmt(v1)} VNĐ</strong>
                            )}
                          </span>
                        </div>

                        {/* Version 2 */}
                        <p className="text-sm text-gray-600 ml-5">
                          Version 2 (1 bước):{' '}
                          {discountEnabled ? (
                            <>
                              <span className="line-through text-gray-400">{fmt(v2)} VNĐ</span>{' '}
                              <strong>{fmt(d2)} VNĐ</strong>{' '}
                              <span className="text-red-500 font-bold text-xs">(-{discountPercent}%)</span>
                            </>
                          ) : (
                            <strong>{fmt(v2)} VNĐ</strong>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Link
                    to="/dang-ky"
                    className="mt-5 flex items-center justify-center gap-2 bg-[#f97316] hover:bg-[#ea580c]
                               text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md shadow-orange-200
                               transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    MUA GÓI <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-sm text-gray-400 mt-8">
            ✓ Không hợp đồng dài hạn &nbsp;·&nbsp; ✓ Hủy bất cứ lúc nào &nbsp;·&nbsp; ✓ Hoàn tiền 100%
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#1e3a8a]">CÂU HỎI VỀ GIÁ</h2>
            <div className="w-16 h-1 bg-[#f97316] mx-auto mt-4 rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {faqs.map(({ q, a }) => (
              <div key={q} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <h4 className="font-bold text-[#1e3a8a] text-sm mb-2">{q}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <BottomCTA />
      <Footer />
    </>
  );
}
