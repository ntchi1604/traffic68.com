import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Save, DollarSign, CheckCircle, AlertCircle, Info } from 'lucide-react';
import api from '../../lib/api';

const TYPE_LABELS = {
  google_search: { label: 'Google Search Traffic', color: 'bg-blue-100 text-indigo-700' },
  direct:        { label: 'Direct Traffic',        color: 'bg-green-100 text-green-700' },
  social:        { label: 'Social Traffic',        color: 'bg-pink-100 text-pink-700' },
};
const TYPE_ORDER = ['google_search', 'direct', 'social'];

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

export default function AgencyAdminPricing() {
  usePageTitle('Đại lý - Bảng giá');
  const [prices, setPrices] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [editedPrices, setEditedPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const fetchData = () => {
    setLoading(true);
    api.get('/agency-admin/pricing')
      .then(data => {
        setPrices(data.prices || []);
        setDefaults(data.defaults || []);
        setEditedPrices({});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  // Build a lookup for defaults: key = `${traffic_type}_${duration}`
  const defaultMap = {};
  defaults.forEach(d => {
    defaultMap[`${d.traffic_type}_${d.duration}`] = d;
  });

  // Build a lookup for current agency prices
  const priceMap = {};
  prices.forEach(p => {
    priceMap[`${p.traffic_type}_${p.duration}`] = p;
  });

  // All unique combos from defaults (canonical source)
  const allCombos = defaults.map(d => ({
    traffic_type: d.traffic_type,
    duration: d.duration,
    key: `${d.traffic_type}_${d.duration}`,
  }));

  // Get edited or saved value
  const getVal = (key, field) => {
    if (editedPrices[key] && editedPrices[key][field] !== undefined) {
      return editedPrices[key][field];
    }
    const p = priceMap[key];
    if (p && p[field] !== null && p[field] !== undefined && p[field] !== '') {
      return p[field];
    }
    return '';
  };

  const updatePrice = (key, field, value) => {
    setEditedPrices(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const hasChanges = Object.keys(editedPrices).length > 0;

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      // Build payload: only send rows that have values
      const payload = allCombos.map(c => {
        const v1 = getVal(c.key, 'v1_price');
        const v2 = getVal(c.key, 'v2_price');
        return {
          traffic_type: c.traffic_type,
          duration: c.duration,
          v1_price: v1 === '' ? null : Number(v1),
          v2_price: v2 === '' ? null : Number(v2),
        };
      });

      await api.post('/agency-admin/pricing', { prices: payload });
      setMsg('Lưu bảng giá thành công!');
      fetchData();
    } catch (error) {
      setErr(error.message);
    } finally {
      setSaving(false);
    }
  };

  // Group combos by traffic_type
  const grouped = {};
  allCombos.forEach(c => {
    if (!grouped[c.traffic_type]) grouped[c.traffic_type] = [];
    grouped[c.traffic_type].push(c);
  });

  const inputCls = "w-28 px-2.5 py-2 text-sm font-semibold border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Bảng giá đại lý</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý giá bán lẻ cho buyer trên web đại lý</p>
        </div>
        <button onClick={handleSave} disabled={saving || !hasChanges}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
          <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu bảng giá'}
        </button>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          Giá bán lẻ cho buyer trên web đại lý. Để trống để dùng giá mặc định từ hệ thống.
        </p>
      </div>

      {msg && (
        <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium flex items-center gap-2">
          <CheckCircle size={16} /> {msg}
        </div>
      )}
      {err && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
          <AlertCircle size={16} /> {err}
        </div>
      )}

      {/* Pricing tables grouped by traffic_type */}
      {TYPE_ORDER.filter(type => grouped[type]).map(type => {
        const typeInfo = TYPE_LABELS[type] || { label: type, color: 'bg-gray-100 text-gray-700' };
        const items = grouped[type].sort((a, b) => parseInt(a.duration) - parseInt(b.duration));

        return (
          <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <DollarSign size={18} className="text-indigo-500" />
              <span className={`px-3 py-1 text-xs font-bold rounded-full ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Loại traffic</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-500">Thời gian</th>
                    <th className="px-5 py-3 text-center font-semibold text-slate-500">V1 Giá (đ)</th>
                    <th className="px-5 py-3 text-center font-semibold text-slate-500">V2 Giá (đ)</th>
                    <th className="px-5 py-3 text-center font-semibold text-slate-400">Mặc định V1</th>
                    <th className="px-5 py-3 text-center font-semibold text-slate-400">Mặc định V2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(c => {
                    const def = defaultMap[c.key];
                    const v1 = getVal(c.key, 'v1_price');
                    const v2 = getVal(c.key, 'v2_price');
                    const isChanged = editedPrices[c.key] !== undefined;

                    return (
                      <tr key={c.key} className={isChanged ? 'bg-orange-50/50' : 'hover:bg-slate-50/70'}>
                        <td className="px-5 py-3 font-semibold text-slate-600 capitalize">
                          {c.traffic_type.replace('_', ' ')}
                        </td>
                        <td className="px-5 py-3 font-bold text-slate-700">{c.duration}</td>
                        <td className="px-5 py-2 text-center">
                          <input type="number" value={v1}
                            onChange={e => updatePrice(c.key, 'v1_price', e.target.value)}
                            placeholder={def?.v1_price != null ? String(def.v1_price) : ''}
                            className={`${inputCls} ${isChanged ? 'border-orange-300 bg-orange-50' : ''}`} />
                        </td>
                        <td className="px-5 py-2 text-center">
                          <input type="number" value={v2}
                            onChange={e => updatePrice(c.key, 'v2_price', e.target.value)}
                            placeholder={def?.v2_price != null ? String(def.v2_price) : ''}
                            className={`${inputCls} ${isChanged ? 'border-orange-300 bg-orange-50' : ''}`} />
                        </td>
                        <td className="px-5 py-3 text-center text-slate-400 text-xs font-medium">
                          {def?.v1_price != null ? `${fmt(def.v1_price)} đ` : '—'}
                        </td>
                        <td className="px-5 py-3 text-center text-slate-400 text-xs font-medium">
                          {def?.v2_price != null ? `${fmt(def.v2_price)} đ` : '—'}
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
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl shadow-2xl shadow-green-500/30 transition disabled:opacity-50 text-base">
            <Save size={18} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      )}
    </div>
  );
}
