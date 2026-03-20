import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Link } from 'react-router-dom';
import { CheckCircle2, Tag, ArrowRight } from 'lucide-react';
import { formatMoney as fmt } from '../../lib/format';

const TYPE_STYLE = {
  google_search: { bg: 'bg-blue-50', border: 'border-blue-100', icon: '/google_icon.png', title: 'GOOGLE SEARCH TRAFFIC' },
  social: { bg: 'bg-pink-50', border: 'border-pink-100', icon: '/social_icons.png', title: 'SOCIAL TRAFFIC' },
  direct: { bg: 'bg-green-50', border: 'border-green-100', icon: '/direct_icon.png', title: 'DIRECT TRAFFIC' },
};

export default function UserPricing() {
  usePageTitle('Bảng giá');
  const [cards, setCards] = useState([]);
  const [config, setConfig] = useState({ discount_code: '', discount_percent: '0', discount_enabled: 'false' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pricing')
      .then(r => r.json())
      .then(data => {
        if (data.config) setConfig(c => ({ ...c, ...data.config }));
        const grouped = {};
        (data.tiers || []).forEach(t => {
          if (!grouped[t.traffic_type]) grouped[t.traffic_type] = [];
          grouped[t.traffic_type].push(t);
        });
        const order = ['google_search', 'social', 'direct'];
        setCards(order.filter(type => grouped[type]).map(type => ({
          ...(TYPE_STYLE[type] || {}),
          tiers: grouped[type].map(t => ({ dur: t.duration, v1: t.v1_price, d1: t.v1_discount, v2: t.v2_price, d2: t.v2_discount })),
        })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const discountEnabled = config.discount_enabled === 'true';
  const pct = config.discount_percent || '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">Bảng giá dịch vụ</h1>
        <Link to="/buyer/dashboard/campaigns/create"
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition">
          Tạo chiến dịch <ArrowRight size={14} />
        </Link>
      </div>

      {/* Discount banner */}
      {discountEnabled && (
        <div className="flex items-center gap-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl px-5 py-3">
          <Tag size={18} />
          <div className="flex-1">
            <p className="text-sm font-black">{config.discount_label || `Giảm giá ${pct}%`}</p>
            <p className="text-xs opacity-80">
              Nhập mã <strong className="bg-white/20 px-1.5 py-0.5 rounded font-mono">{config.discount_code}</strong> khi tạo chiến dịch.
            </p>
          </div>
          <span className="text-2xl font-black">-{pct}%</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {cards.map(({ bg, border, icon, title, tiers }) => (
            <div key={title} className={`${bg} border ${border} rounded-2xl p-5 flex flex-col`}>
              <img src={icon} alt={title} className="w-16 h-16 object-contain mx-auto mb-2" />
              <h3 className="text-center text-sm font-black text-[#1e3a5f] uppercase tracking-wide mb-4">{title}</h3>

              <div className="space-y-3 flex-1">
                {tiers.map(({ dur, v1, d1, v2, d2 }) => (
                  <div key={dur} className="bg-white/70 rounded-xl p-3 border border-gray-100/80">
                    <p className="text-sm font-bold text-gray-700 mb-1.5">Gói {dur}</p>

                    <div className="flex items-start gap-1.5 mb-1">
                      <CheckCircle2 size={13} className="text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">
                        V1 (2 bước){' '}
                        <span className="text-[10px] font-bold text-white bg-orange-500 px-1 py-0.5 rounded">Best</span>
                        :{' '}
                        {discountEnabled ? (
                          <>
                            <span className="line-through text-gray-400">{fmt(v1)}</span>{' '}
                            <strong className="text-green-600">{fmt(d1)} VNĐ</strong>
                          </>
                        ) : (
                          <strong>{fmt(v1)} VNĐ</strong>
                        )}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 ml-5">
                      V2 (1 bước):{' '}
                      {discountEnabled ? (
                        <>
                          <span className="line-through text-gray-400">{fmt(v2)}</span>{' '}
                          <strong className="text-green-600">{fmt(d2)} VNĐ</strong>
                        </>
                      ) : (
                        <strong>{fmt(v2)} VNĐ</strong>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
