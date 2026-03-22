import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Save, Edit3, X, DollarSign, Percent } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const TYPE_LABELS = {
  google_search: { label: 'Google Search Traffic', color: 'bg-blue-100 text-blue-700' },
  social: { label: 'Social Traffic', color: 'bg-pink-100 text-pink-700' },
  direct: { label: 'Direct Traffic', color: 'bg-green-100 text-green-700' },
};

export default function AdminWorkerPricing() {
  usePageTitle('Admin - Bảng giá');
  const toast = useToast();
  const [tiers, setTiers] = useState([]);
  const [buyerTiers, setBuyerTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [profitPct, setProfitPct] = useState('');
  const [applying, setApplying] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/worker-pricing'),
      api.get('/admin/pricing'),
    ]).then(([wp, bp]) => {
      setTiers(wp.tiers || []);
      setBuyerTiers(bp.tiers || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const startEdit = (tier) => {
    setEditingId(tier.id);
    setEditForm({ v1_price: tier.v1_price, v2_price: tier.v2_price });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      await api.put(`/admin/worker-pricing/${id}`, {
        v1_price: editForm.v1_price,
        v2_price: editForm.v2_price,
      });
      toast.success('Đã cập nhật giá worker');
      setEditingId(null);
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
          // Use discount price (final price) if available, otherwise base price
          const buyerV1 = bt.v1_discount > 0 ? bt.v1_discount : bt.v1_price;
          const buyerV2 = bt.v2_discount > 0 ? bt.v2_discount : bt.v2_price;
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

  // Build buyer price map for comparison
  const buyerMap = {};
  buyerTiers.forEach(b => { buyerMap[`${b.traffic_type}_${b.duration}`] = b; });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Bảng giá</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tiers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
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
              Nhập % lãi mong muốn → giá worker = giá buyer (sau giảm giá) × (100 - lãi)%.
              Ví dụ: lãi 50% → worker nhận 50% giá buyer đã áp dụng.
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

          {/* Pricing Tables */}
          {Object.entries(grouped).map(([type, items]) => {
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
                        <th className="px-5 py-3 text-left font-semibold text-slate-400">Buyer V1</th>
                        <th className="px-5 py-3 text-left font-semibold text-emerald-600">Worker V1</th>
                        <th className="px-5 py-3 text-left font-semibold text-slate-400">Buyer V2</th>
                        <th className="px-5 py-3 text-left font-semibold text-emerald-600">Worker V2</th>
                        <th className="px-5 py-3 text-center font-semibold text-slate-500">Sửa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map(tier => {
                        const isEditing = editingId === tier.id;
                        const buyer = buyerMap[`${tier.traffic_type}_${tier.duration}`];
                        return (
                          <tr key={tier.id} className={isEditing ? 'bg-emerald-50/50' : 'hover:bg-slate-50/70'}>
                            <td className="px-5 py-3 font-bold text-slate-700">{tier.duration}</td>
                            <td className="px-5 py-3 text-slate-400 text-xs">{buyer ? fmt(buyer.v1_discount > 0 ? buyer.v1_discount : buyer.v1_price) + ' đ' : '—'}</td>

                            {isEditing ? (
                              <>
                                <td className="px-5 py-2">
                                  <input type="number" value={editForm.v1_price}
                                    onChange={e => setEditForm(f => ({ ...f, v1_price: Number(e.target.value) || 0 }))}
                                    className="w-20 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                                </td>
                                <td className="px-5 py-3 text-slate-400 text-xs">{buyer ? fmt(buyer.v2_discount > 0 ? buyer.v2_discount : buyer.v2_price) + ' đ' : '—'}</td>
                                <td className="px-5 py-2">
                                  <input type="number" value={editForm.v2_price}
                                    onChange={e => setEditForm(f => ({ ...f, v2_price: Number(e.target.value) || 0 }))}
                                    className="w-20 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                                </td>
                                <td className="px-5 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => saveEdit(tier.id)} disabled={saving}
                                      className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition" title="Lưu">
                                      <Save size={15} />
                                    </button>
                                    <button onClick={cancelEdit}
                                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 transition" title="Hủy">
                                      <X size={15} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-5 py-3 text-emerald-700 font-bold">{fmt(tier.v1_price)} đ</td>
                                <td className="px-5 py-3 text-slate-400 text-xs">{buyer ? fmt(buyer.v2_discount > 0 ? buyer.v2_discount : buyer.v2_price) + ' đ' : '—'}</td>
                                <td className="px-5 py-3 text-emerald-700 font-bold">{fmt(tier.v2_price)} đ</td>
                                <td className="px-5 py-3">
                                  <div className="flex items-center justify-center">
                                    <button onClick={() => startEdit(tier)}
                                      className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition" title="Sửa">
                                      <Edit3 size={15} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
