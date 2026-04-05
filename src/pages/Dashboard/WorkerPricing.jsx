import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { CheckCircle2, Tag } from 'lucide-react';
import { formatMoney as fmt } from '../../lib/format';

const TYPE_STYLE = {
  google_search: { bg: 'bg-blue-50', border: 'border-blue-100', icon: '/google_icon.png', title: 'GOOGLE SEARCH TRAFFIC' },
  social: { bg: 'bg-pink-50', border: 'border-pink-100', icon: '/social_icons.png', title: 'SOCIAL TRAFFIC' },
  direct: { bg: 'bg-green-50', border: 'border-green-100', icon: '/direct_icon.png', title: 'DIRECT TRAFFIC' },
};

export default function WorkerPricing() {
  usePageTitle('Bảng giá thu nhập');
  const [cards, setCards] = useState([]);
  const [groupName, setGroupName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    fetch('/api/worker-pricing/my', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        setGroupName(data.groupName || null);
        const grouped = {};
        (data.tiers || []).forEach(t => {
          if (!grouped[t.traffic_type]) grouped[t.traffic_type] = [];
          grouped[t.traffic_type].push(t);
        });
        const order = ['google_search', 'social', 'direct'];
        setCards(order.filter(type => grouped[type]).map(type => ({
          ...(TYPE_STYLE[type] || {}),
          tiers: grouped[type].map(t => ({ dur: t.duration, v1: t.v1_price, v2: t.v2_price })),
        })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Bảng giá thu nhập' },
      ]} />
      <div>
        <h1 className="text-2xl font-black text-slate-900">Bảng giá thu nhập</h1>
        <p className="text-sm text-slate-500 mt-1">Số tiền bạn nhận được mỗi lượt vượt link hoàn thành</p>
      </div>

      {/* Group badge */}
      {groupName && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-semibold text-indigo-700">
          <Tag size={15} className="text-indigo-500" />
          Nhóm giá: <strong>{groupName}</strong>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {cards.map(({ bg, border, icon, title, tiers }) => (
            <div key={title} className={`${bg} border ${border} rounded-2xl p-5 flex flex-col`}>
              <img src={icon} alt={title} className="w-16 h-16 object-contain mx-auto mb-2" />
              <h3 className="text-center text-sm font-black text-[#1e3a5f] uppercase tracking-wide mb-4">{title}</h3>

              <div className="space-y-3 flex-1">
                {tiers.map(({ dur, v1, v2 }) => (
                  <div key={dur} className="bg-white/70 rounded-xl p-3 border border-gray-100/80">
                    <p className="text-sm font-bold text-gray-700 mb-1.5">Gói {dur}</p>

                    <div className="flex items-start gap-1.5 mb-1">
                      <CheckCircle2 size={13} className="text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">
                        V1 (2 bước): <strong className="text-emerald-600">{fmt(v1)} VNĐ</strong>
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 size={13} className="text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">
                        V2 (1 bước): <strong className="text-emerald-600">{fmt(v2)} VNĐ</strong>
                      </span>
                    </div>
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
