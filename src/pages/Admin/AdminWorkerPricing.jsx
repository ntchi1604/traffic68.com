import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Save, Edit3, X, DollarSign } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const TYPE_LABELS = {
  google_search: { label: 'Google Search Traffic', color: 'bg-blue-100 text-blue-700' },
  social: { label: 'Social Traffic', color: 'bg-pink-100 text-pink-700' },
  direct: { label: 'Direct Traffic', color: 'bg-green-100 text-green-700' },
};

export default function AdminWorkerPricing() {
  usePageTitle('Admin - Bảng giá Worker');
  const toast = useToast();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    api.get('/admin/worker-pricing')
      .then(data => setTiers(data.tiers || []))
      .catch(console.error)
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

  // Group tiers by traffic_type
  const grouped = {};
  tiers.forEach(t => {
    if (!grouped[t.traffic_type]) grouped[t.traffic_type] = [];
    grouped[t.traffic_type].push(t);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Bảng giá Worker</h1>
        <p className="text-sm text-slate-500 mt-1">Giá CPC mà worker nhận được mỗi lượt vượt link hoàn thành. Tách biệt với giá buyer.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tiers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500">Chưa có dữ liệu bảng giá worker. Restart server để seed từ bảng giá buyer.</p>
        </div>
      ) : (
        <>
          {/* Info banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
            <strong>💡 Lưu ý:</strong> Đây là giá worker <strong>nhận</strong> khi hoàn thành vượt link, không phải giá buyer trả.
            V1 = campaign version 1, V2 = campaign version 2.
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
                  <span className="text-xs text-slate-400">Worker CPC</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[500px] w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold text-slate-500">Thời gian</th>
                        <th className="px-5 py-3 text-left font-semibold text-slate-500">V1 CPC (đ)</th>
                        <th className="px-5 py-3 text-left font-semibold text-slate-500">V2 CPC (đ)</th>
                        <th className="px-5 py-3 text-center font-semibold text-slate-500">Sửa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map(tier => {
                        const isEditing = editingId === tier.id;
                        return (
                          <tr key={tier.id} className={isEditing ? 'bg-emerald-50/50' : 'hover:bg-slate-50/70'}>
                            <td className="px-5 py-3 font-bold text-slate-700">{tier.duration}</td>

                            {isEditing ? (
                              <>
                                <td className="px-5 py-2">
                                  <input type="number" value={editForm.v1_price}
                                    onChange={e => setEditForm(f => ({ ...f, v1_price: Number(e.target.value) || 0 }))}
                                    className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                                </td>
                                <td className="px-5 py-2">
                                  <input type="number" value={editForm.v2_price}
                                    onChange={e => setEditForm(f => ({ ...f, v2_price: Number(e.target.value) || 0 }))}
                                    className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
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
