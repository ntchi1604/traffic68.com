import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Save, Check, Settings2 } from 'lucide-react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

const SETTINGS_FIELDS = [
  {
    key: 'views_per_ip',
    label: 'Giới hạn lượt xem / IP',
    description: 'Số lần tối đa 1 IP có thể vượt link trong 1 ngày',
    type: 'number',
    defaultValue: '5',
    min: 1, max: 100,
  },
  {
    key: 'vuotlink_min_time',
    label: 'Thời gian tối thiểu (giây)',
    description: 'Thời gian tối thiểu worker phải ở trên trang trước khi nhập code',
    type: 'number',
    defaultValue: '30',
    min: 5, max: 600,
  },
  {
    key: 'vuotlink_cooldown',
    label: 'Thời gian chờ giữa các task (giây)',
    description: 'Khoảng thời gian tối thiểu giữa 2 lần vượt link của 1 worker',
    type: 'number',
    defaultValue: '0',
    min: 0, max: 3600,
  },
  {
    key: 'vuotlink_max_daily_tasks',
    label: 'Số task tối đa / worker / ngày',
    description: 'Giới hạn số nhiệm vụ mỗi worker có thể làm trong 1 ngày (0 = không giới hạn)',
    type: 'number',
    defaultValue: '0',
    min: 0, max: 9999,
  },
  {
    key: 'discount_code',
    label: 'Mã giảm giá Buyer',
    description: 'Mã giảm giá áp dụng khi buyer tạo chiến dịch',
    type: 'text',
    defaultValue: '',
  },
  {
    key: 'discount_percent',
    label: 'Phần trăm giảm giá (%)',
    description: 'Phần trăm giảm giá khi nhập đúng mã',
    type: 'number',
    defaultValue: '0',
    min: 0, max: 100,
  },
  {
    key: 'discount_label',
    label: 'Thông báo giảm giá',
    description: 'Dòng chữ hiển thị cho buyer khi có chương trình giảm giá',
    type: 'text',
    defaultValue: '',
  },
  {
    key: 'discount_enabled',
    label: 'Bật giảm giá',
    description: 'Bật/tắt chương trình giảm giá cho buyer',
    type: 'toggle',
    defaultValue: '0',
  },
];

export default function AdminConfig() {
  usePageTitle('Admin - Cấu hình');
  const toast = useToast();
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/admin/settings/site')
      .then(d => {
        const c = d.config || {};
        // Fill defaults
        SETTINGS_FIELDS.forEach(f => {
          if (c[f.key] === undefined) c[f.key] = f.defaultValue;
        });
        setConfig(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateField = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = {};
      SETTINGS_FIELDS.forEach(f => {
        settings[f.key] = config[f.key] ?? f.defaultValue;
      });
      await api.put('/admin/settings/site', { settings });
      toast.success('Cấu hình đã được lưu');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Cấu hình hệ thống</h1>
          <p className="text-sm text-slate-500 mt-1">Cài đặt Vượt Link, giảm giá và các thông số hệ thống</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition ${saved
            ? 'bg-green-100 text-green-700'
            : 'bg-orange-500 hover:bg-orange-600 text-white'} disabled:opacity-50`}>
          {saved ? <><Check size={16} /> Đã lưu</> : <><Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}</>}
        </button>
      </div>

      {/* Vuot Link Settings */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Settings2 size={16} className="text-blue-500" />
          <h2 className="font-bold text-slate-800">Cài đặt Vượt Link</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {SETTINGS_FIELDS.filter(f => f.key.startsWith('vuotlink') || f.key === 'views_per_ip').map(field => (
            <div key={field.key} className="px-6 py-4 flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-700">{field.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{field.description}</p>
              </div>
              <div className="shrink-0 w-32">
                <input
                  type={field.type}
                  min={field.min}
                  max={field.max}
                  value={config[field.key] || ''}
                  onChange={e => updateField(field.key, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Discount Settings */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Settings2 size={16} className="text-amber-500" />
          <h2 className="font-bold text-slate-800">Giảm giá Buyer</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {SETTINGS_FIELDS.filter(f => f.key.startsWith('discount')).map(field => (
            <div key={field.key} className="px-6 py-4 flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-700">{field.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{field.description}</p>
              </div>
              <div className="shrink-0 w-48">
                {field.type === 'toggle' ? (
                  <button
                    onClick={() => updateField(field.key, config[field.key] === '1' ? '0' : '1')}
                    className={`relative w-12 h-6 rounded-full transition-colors ${config[field.key] === '1' ? 'bg-green-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config[field.key] === '1' ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                ) : (
                  <input
                    type={field.type}
                    min={field.min}
                    max={field.max}
                    value={config[field.key] || ''}
                    onChange={e => updateField(field.key, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
