import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Save, DollarSign, Percent } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const TYPE_LABELS = {
  google_search: { label: 'Google Search Traffic', color: 'bg-blue-100 text-blue-700' },
  social: { label: 'Social Traffic', color: 'bg-pink-100 text-pink-700' },
  direct: { label: 'Direct Traffic', color: 'bg-green-100 text-green-700' },
};
const TYPE_ORDER = ['google_search', 'direct', 'social'];

export default function AdminWorkerPricing() {
  usePageTitle('Admin - Bảng giá Worker');
  const toast = useToast();
  const [tiers, setTiers] = useState([]);
  const [buyerTiers, setBuyerTiers] = useState([]);
  const [editedTiers, setEditedTiers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profitPct, setProfitPct] = useState('');
  const [applying, setApplying] = useState(false);
  const [isDiscountEnabled, setIsDiscountEnabled] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/worker-pricing'),
      api.get('/admin/pricing'),
      api.get('/admin/settings/site')
    ]).then(([wp, bp, settings]) => {
      setTiers(wp.tiers || []);
      setBuyerTiers(bp.tiers || []);
      setEditedTiers({});
      setIsDiscountEnabled(settings?.config?.discount_enabled === 'true');
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const getVal = (tier, field) => {
    if (editedTiers[tier.id] && editedTiers[tier.id][field] !== undefined) {
      return editedTiers[tier.id][field];
    }
    return tier[field];
  };

  const updateTier = (id, field, value) => {
    setEditedTiers(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: Number(value) || 0 },
    }));
  };

  const hasChanges = Object.keys(editedTiers).length > 0;

  const saveAll = async () => {
    const changedIds = Object.keys(editedTiers);
    if (changedIds.length === 0) return toast.info('Không có thay đổi');

    setSaving(true);
    try {
      for (const id of changedIds) {
        const tier = tiers.find(t => t.id === Number(id));
        const v1 = editedTiers[id].v1_price ?? tier.v1_price;
        const v2 = editedTiers[id].v2_price ?? tier.v2_price;
        await api.put(`/admin/worker-pricing/${id}`, { v1_price: v1, v2_price: v2 });
      }
      toast.success(`Đã lưu ${changedIds.length} mục`);
      fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  // Apply profit margin: worker gets (100 - profitPct)% of buyer price
  const applyProfitMargin = async () => {
    const pct = Number(profitPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('Phần trăm lãi phải từ 0 đến 100');
      return;
    }
    setApplying(true);
    try {
      const workerRate = (100 - pct) / 100;
      for (const wt of tiers) {
        const bt = buyerTiers.find(b => b.traffic_type === wt.traffic_type && b.duration === wt.duration);
        if (bt) {
          const buyerV1 = (isDiscountEnabled && bt.v1_discount > 0) ? bt.v1_discount : bt.v1_price;
          const buyerV2 = (isDiscountEnabled && bt.v2_discount > 0) ? bt.v2_discount : bt.v2_price;
          const v1 = Math.round(buyerV1 * workerRate);
          const v2 = Math.round(buyerV2 * workerRate);
          await api.put(`/admin/worker-pricing/${wt.id}`, { v1_price: v1, v2_price: v2 });
        }
      }
      toast.success(`Đã áp dụng lãi ${pct}% — Worker nhận ${100 - pct}% giá buyer`);
      fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setApplying(false); }
  };

  // Group tiers by traffic_type
  const grouped = {};
  tiers.forEach(t => {
    if (!grouped[t.traffic_type]) grouped[t.traffic_type] = [];
    grouped[t.traffic_type].push(t);
  });

  const buyerMap = {};
  buyerTiers.forEach(b => { buyerMap[`${b.traffic_type}_${b.duration}`] = b; });

  const inputCls = "w-28 px-2.5 py-2 text-sm font-semibold border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Bảng giá Worker</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Profit margin calculator */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Percent size={16} className="text-emerald-600" />
              </div>
              <h2 className="font-bold text-slate-800">Tính giá theo % lãi</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Nhập % lãi mong muốn → giá worker = giá buyer (đã đối chiếu cài đặt giảm giá) × (100 - lãi)%.
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-[200px]">
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">% Lãi</label>
                <div className="relative">
                  <input type="number" value={profitPct} onChange={e => setProfitPct(e.target.value)}
                    placeholder="50" min="0" max="100" step="1"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-10" />
                  <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              {profitPct && Number(profitPct) >= 0 && Number(profitPct) <= 100 && (
                <p className="text-xs text-slate-500 pb-3">
                  Worker nhận <strong className="text-emerald-600">{100 - Number(profitPct)}%</strong> giá buyer
                </p>
              )}
              <button onClick={applyProfitMargin} disabled={applying || !profitPct}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                <Save size={14} /> {applying ? 'Đang áp dụng...' : 'Áp dụng tất cả'}
              </button>
            </div>
          </div>

          {/* Pricing Tables (all editable inline) */}
          {Object.entries(grouped).sort((a, b) => (TYPE_ORDER.indexOf(a[0]) === -1 ? 99 : TYPE_ORDER.indexOf(a[0])) - (TYPE_ORDER.indexOf(b[0]) === -1 ? 99 : TYPE_ORDER.indexOf(b[0]))).map(([type, items]) => {
            const typeInfo = TYPE_LABELS[type] || { label: type, color: 'bg-gray-100 text-gray-700' };
            return (
              <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <DollarSign size={18} className="text-emerald-500" />
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[600px] w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold text-slate-500">Thời gian</th>
                        <th className="px-5 py-3 text-center font-semibold text-slate-400">Buyer V1</th>
                        <th className="px-5 py-3 text-center font-semibold text-emerald-600">Worker V1</th>
                        <th className="px-5 py-3 text-center font-semibold text-slate-400">Buyer V2</th>
                        <th className="px-5 py-3 text-center font-semibold text-emerald-600">Worker V2</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map(tier => {
                        const v1 = getVal(tier, 'v1_price');
                        const v2 = getVal(tier, 'v2_price');
                        const isChanged = editedTiers[tier.id] !== undefined;
                        const buyer = buyerMap[`${tier.traffic_type}_${tier.duration}`];
                        return (
                          <tr key={tier.id} className={isChanged ? 'bg-emerald-50/50' : 'hover:bg-slate-50/70'}>
                            <td className="px-5 py-3 font-bold text-slate-700">{tier.duration}</td>
                            <td className="px-5 py-3 text-center text-slate-400 text-xs">
                              {buyer ? fmt((isDiscountEnabled && buyer.v1_discount > 0) ? buyer.v1_discount : buyer.v1_price) + ' đ' : '—'}
                            </td>
                            <td className="px-5 py-2 text-center">
                              <input type="number" value={v1}
                                onChange={e => updateTier(tier.id, 'v1_price', e.target.value)}
                                className={`${inputCls} ${isChanged ? 'border-emerald-300 bg-emerald-50' : ''}`} />
                            </td>
                            <td className="px-5 py-3 text-center text-slate-400 text-xs">
                              {buyer ? fmt((isDiscountEnabled && buyer.v2_discount > 0) ? buyer.v2_discount : buyer.v2_price) + ' đ' : '—'}
                            </td>
                            <td className="px-5 py-2 text-center">
                              <input type="number" value={v2}
                                onChange={e => updateTier(tier.id, 'v2_price', e.target.value)}
                                className={`${inputCls} ${isChanged ? 'border-emerald-300 bg-emerald-50' : ''}`} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Floating save button */}
          {hasChanges && (
            <div className="sticky bottom-4 flex justify-center">
              <button onClick={saveAll} disabled={saving}
                className="flex items-center gap-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-2xl shadow-emerald-500/30 transition disabled:opacity-50 text-base">
                <Save size={18} /> {saving ? 'Đang lưu...' : `Lưu ${Object.keys(editedTiers).length} thay đổi`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
