import { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import { Save, Store, ExternalLink } from 'lucide-react';
import api from '../../lib/api';

export default function AgencyDashboard() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState(null);

  useEffect(() => {
    fetchAgency();
  }, []);

  const fetchAgency = async () => {
    try {
      setLoading(true);
      const data = await api.get('/agencies/my');
      setAgency(data || {});
    } catch (error) {
      toast.error('Lỗi tải thông tin đại lý');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Store className="text-indigo-600" /> Cấu hình Web Con
          </h1>
          <p className="text-slate-500 mt-1">
            Tạo và cấu hình tên miền riêng cho đại lý của bạn.
          </p>
        </div>
        {agency?.domain && (
          <a href={`https://${agency.domain}/agency-admin`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
            Đến trang quản lý <ExternalLink size={14} />
          </a>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <AgencySettings agency={agency} onUpdate={fetchAgency} />
      </div>
    </div>
  );
}

function AgencySettings({ agency, onUpdate }) {
  const toast = useToast();
  const [form, setForm] = useState({
    domain: agency?.domain || '',
    name: agency?.name || '',
    logo_url: agency?.logo_url || '',
    primary_color: agency?.primary_color || '#3b82f6',
    bank_name: agency?.bank_name || '',
    bank_account_name: agency?.bank_account_name || '',
    bank_account_number: agency?.bank_account_number || '',
    contact_email: agency?.contact_email || '',
    contact_phone: agency?.contact_phone || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.domain) {
      return toast.error('Vui lòng nhập tên miền');
    }
    try {
      setSaving(true);
      await api.post('/agencies/setup', form);
      toast.success('Đã lưu cấu hình đại lý');
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Lỗi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2 border-b pb-2">Thông tin Website</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên miền (Domain) *</label>
            <input
              type="text"
              value={form.domain}
              onChange={e => setForm({...form, domain: e.target.value})}
              placeholder="VD: mytraffic.com (không có https://)"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Trỏ A record của tên miền này về IP máy chủ của Traffic68.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên thương hiệu</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              placeholder="VD: MyTraffic"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
            <input
              type="text"
              value={form.logo_url}
              onChange={e => setForm({...form, logo_url: e.target.value})}
              placeholder="Link ảnh logo"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Màu chủ đạo</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.primary_color}
                onChange={e => setForm({...form, primary_color: e.target.value})}
                className="h-10 w-20 cursor-pointer border rounded-lg"
              />
              <input
                type="text"
                value={form.primary_color}
                onChange={e => setForm({...form, primary_color: e.target.value})}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email liên hệ</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={e => setForm({...form, contact_email: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hotline</label>
            <input
              type="text"
              value={form.contact_phone}
              onChange={e => setForm({...form, contact_phone: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2 border-b pb-2">Thông tin Thanh toán</h3>
          <p className="text-sm text-slate-600 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
            Thông tin này sẽ hiển thị ở trang Nạp tiền của Buyer trên web con của bạn. Khách hàng sẽ chuyển khoản trực tiếp cho bạn.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ngân hàng</label>
            <input
              type="text"
              value={form.bank_name}
              onChange={e => setForm({...form, bank_name: e.target.value})}
              placeholder="VD: Vietcombank"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên chủ tài khoản</label>
            <input
              type="text"
              value={form.bank_account_name}
              onChange={e => setForm({...form, bank_account_name: e.target.value})}
              placeholder="VD: NGUYEN VAN A"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Số tài khoản</label>
            <input
              type="text"
              value={form.bank_account_number}
              onChange={e => setForm({...form, bank_account_number: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
          Lưu cấu hình
        </button>
      </div>
    </form>
  );
}
