import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Save, Edit3, X, DollarSign, Tag, Percent } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const TYPE_LABELS = {
  google_search: { label: 'Google Search Traffic', color: 'bg-blue-100 text-blue-700' },
  social: { label: 'Social Traffic', color: 'bg-pink-100 text-pink-700' },
  direct: { label: 'Direct Traffic', color: 'bg-green-100 text-green-700' },
};

export default function AdminPricing() {
  usePageTitle('Admin - Bảng giá');
  const toast = useToast();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Discount settings
  const [config, setConfig] = useState({ discount_code: '', discount_percent: '', discount_label: '' });
  const [configSaving, setConfigSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/pricing'),
      api.get('/admin/settings/site'),
    ]).then(([pricingData, settingsData]) => {
      setTiers(pricingData.tiers || []);
      if (settingsData.config) setConfig(settingsData.config);
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  // ── Pricing tier editing ──
  const startEdit = (tier) => {
    setEditingId(tier.id);
    setEditForm({
      v1_price: tier.v1_price,
      v1_discount: tier.v1_discount,
      v2_price: tier.v2_price,
      v2_discount: tier.v2_discount,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      await api.put(`/admin/pricing/${id}`, editForm);
      toast.success('Đã cập nhật giá thành công');
      setEditingId(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setField = (key, value) => {
    setEditForm(f => ({ ...f, [key]: Number(value) || 0 }));
  };

  // ── Save discount settings ──
  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      await api.put('/admin/settings/site', { settings: config });
      toast.success('Đã cập nhật cài đặt giảm giá');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfigSaving(false);
    }
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
        <h1 className="text-2xl font-black text-slate-900">Quản lý bảng giá</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Discount Settings Card ── */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Tag size={16} className="text-red-500" />
              </div>
              <h2 className="font-bold text-slate-800">Cài đặt giảm giá</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Mã giảm giá</label>
                <input type="text" value={config.discount_code || ''}
                  onChange={e => setConfig(c => ({ ...c, discount_code: e.target.value }))}
                  placeholder="SALE_ALL_40"
                  className="w-full px-3 py-2.5 text-sm font-mono font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Phần trăm giảm (%)</label>
                <div className="relative">
                  <input type="number" value={config.discount_percent || ''}
                    onChange={e => setConfig(c => ({ ...c, discount_percent: e.target.value }))}
                    placeholder="40"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent pr-10" />
                  <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Tiêu đề hiển thị</label>
                <input type="text" value={config.discount_label || ''}
                  onChange={e => setConfig(c => ({ ...c, discount_label: e.target.value }))}
                  placeholder="Khai trương hệ thống - Giảm giá 40%"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button onClick={saveConfig} disabled={configSaving}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                <Save size={14} /> {configSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
              {config.discount_code && (
                <span className="text-xs text-slate-400">
                  Mã hiện tại: <strong className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-mono">{config.discount_code}</strong>
                  {' '}— Giảm <strong className="text-red-500">{config.discount_percent}%</strong>
                </span>
              )}
            </div>
          </div>

          {/* ── Pricing Tables ── */}
          {Object.entries(grouped).map(([type, items]) => {
            const typeInfo = TYPE_LABELS[type] || { label: type, color: 'bg-gray-100 text-gray-700' };
            return (
              <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <DollarSign size={18} className="text-orange-500" />
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                </div>

                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold text-slate-500">Thời gian</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-500">V1 Giá gốc</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-500">V1 Sau giảm</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-500">V2 Giá gốc</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-500">V2 Sau giảm</th>
                      <th className="px-5 py-3 text-center font-semibold text-slate-500">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(tier => {
                      const isEditing = editingId === tier.id;
                      return (
                        <tr key={tier.id} className={`${isEditing ? 'bg-orange-50/50' : 'hover:bg-slate-50/70'}`}>
                          <td className="px-5 py-3 font-bold text-slate-700">{tier.duration}</td>

                          {isEditing ? (
                            <>
                              <td className="px-5 py-2">
                                <input type="number" value={editForm.v1_price}
                                  onChange={e => setField('v1_price', e.target.value)}
                                  className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                              </td>
                              <td className="px-5 py-2">
                                <input type="number" value={editForm.v1_discount}
                                  onChange={e => setField('v1_discount', e.target.value)}
                                  className="w-24 px-2 py-1.5 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-orange-50" />
                              </td>
                              <td className="px-5 py-2">
                                <input type="number" value={editForm.v2_price}
                                  onChange={e => setField('v2_price', e.target.value)}
                                  className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                              </td>
                              <td className="px-5 py-2">
                                <input type="number" value={editForm.v2_discount}
                                  onChange={e => setField('v2_discount', e.target.value)}
                                  className="w-24 px-2 py-1.5 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-orange-50" />
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
                              <td className="px-5 py-3 text-slate-600">{fmt(tier.v1_price)} đ</td>
                              <td className="px-5 py-3 font-bold text-green-600">{fmt(tier.v1_discount)} đ</td>
                              <td className="px-5 py-3 text-slate-600">{fmt(tier.v2_price)} đ</td>
                              <td className="px-5 py-3 font-bold text-green-600">{fmt(tier.v2_discount)} đ</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center justify-center">
                                  <button onClick={() => startEdit(tier)}
                                    className="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition" title="Sửa">
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
            );
          })}
        </>
      )}
    </div>
  );
}
