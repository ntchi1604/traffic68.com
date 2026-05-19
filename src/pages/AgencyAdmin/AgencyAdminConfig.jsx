import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Save, Check, Settings2, Palette, Building2, Phone,
  Globe, CheckCircle, AlertCircle,
} from 'lucide-react';
import api from '../../lib/api';

export default function AgencyAdminConfig() {
  usePageTitle('Đại lý - Cấu hình');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [config, setConfig] = useState({
    domain: '',
    name: '',
    logo_url: '',
    primary_color: '#0ea5e9',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    contact_email: '',
    contact_phone: '',
  });

  useEffect(() => {
    api.get('/agency-admin/config')
      .then(data => {
        const a = data || {};
        setConfig({
          domain: a.domain || '',
          name: a.name || '',
          logo_url: a.logo_url || '',
          primary_color: a.primary_color || '#0ea5e9',
          bank_name: a.bank_name || '',
          bank_account_name: a.bank_account_name || '',
          bank_account_number: a.bank_account_number || '',
          contact_email: a.contact_email || '',
          contact_phone: a.contact_phone || '',
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateField = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      const { domain, ...payload } = config;
      await api.put('/agency-admin/config', payload);
      setMsg('Lưu cấu hình thành công!');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setErr(error.message);
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-2xl font-black text-slate-900">Cấu hình đại lý</h1>
          <p className="text-sm text-slate-500 mt-1">Thương hiệu, ngân hàng và thông tin liên hệ</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition ${saved
            ? 'bg-green-100 text-green-700'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'} disabled:opacity-50`}>
          {saved ? <><Check size={16} /> Đã lưu</> : <><Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}</>}
        </button>
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

      <form onSubmit={handleSave} className="space-y-6">

        {/* Domain (read-only) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-indigo-500" />
            <h2 className="font-bold text-slate-800">Tên miền</h2>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Domain (không thể thay đổi)</label>
            <input type="text" value={config.domain} readOnly
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-indigo-500" />
            <h2 className="font-bold text-slate-800">Thương hiệu</h2>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tên đại lý</label>
            <input type="text" value={config.name} onChange={e => updateField('name', e.target.value)}
              placeholder="Tên đại lý của bạn"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">URL Logo</label>
            <input type="text" value={config.logo_url} onChange={e => updateField('logo_url', e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            {config.logo_url && (
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 inline-block">
                <img src={config.logo_url} alt="Logo preview" className="h-12 w-auto"
                  onError={e => { e.target.style.display = 'none'; }} />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Màu chủ đạo</label>
            <div className="flex items-center gap-3">
              <input type="color" value={config.primary_color}
                onChange={e => updateField('primary_color', e.target.value)}
                className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer p-1" />
              <input type="text" value={config.primary_color}
                onChange={e => updateField('primary_color', e.target.value)}
                placeholder="#0ea5e9"
                className="w-40 px-4 py-3 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              <div className="w-20 h-10 rounded-lg" style={{ backgroundColor: config.primary_color }} />
            </div>
          </div>
        </div>

        {/* Bank info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-indigo-500" />
            <h2 className="font-bold text-slate-800">Thông tin ngân hàng</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tên ngân hàng</label>
              <input type="text" value={config.bank_name} onChange={e => updateField('bank_name', e.target.value)}
                placeholder="VD: Techcombank, Vietcombank..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Chủ tài khoản</label>
              <input type="text" value={config.bank_account_name} onChange={e => updateField('bank_account_name', e.target.value)}
                placeholder="NGUYEN VAN A"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số tài khoản</label>
            <input type="text" value={config.bank_account_number} onChange={e => updateField('bank_account_number', e.target.value)}
              placeholder="0123456789"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Phone size={18} className="text-indigo-500" />
            <h2 className="font-bold text-slate-800">Liên hệ</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email liên hệ</label>
              <input type="email" value={config.contact_email} onChange={e => updateField('contact_email', e.target.value)}
                placeholder="support@agency.com"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số điện thoại</label>
              <input type="tel" value={config.contact_phone} onChange={e => updateField('contact_phone', e.target.value)}
                placeholder="0912 345 678"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          </div>
        </div>

        {/* Bottom save button */}
        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition ${saved
              ? 'bg-green-100 text-green-700'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'} disabled:opacity-50`}>
            {saved ? <><Check size={16} /> Đã lưu</> : <><Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
