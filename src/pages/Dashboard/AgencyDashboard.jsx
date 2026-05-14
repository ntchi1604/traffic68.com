import { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import { Save, Users, Settings, DollarSign, CreditCard, Check, X, Store } from 'lucide-react';
import api from '../../lib/api';

export default function AgencyDashboard() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('settings');
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

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Đang tải...</div>;
  }

  const tabs = [
    { id: 'settings', label: 'Cấu hình Web Con', icon: Settings },
    { id: 'prices', label: 'Bảng giá bán lẻ', icon: DollarSign },
    { id: 'buyers', label: 'Quản lý Buyer', icon: Users },
    { id: 'transactions', label: 'Duyệt nạp tiền', icon: CreditCard },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Store className="text-indigo-600" /> Quản lý Đại lý (White-label)
        </h1>
        <p className="text-slate-500 mt-1">
          Cấu hình tên miền riêng, quản lý khách hàng và duyệt giao dịch nạp tiền.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'settings' && <AgencySettings agency={agency} onUpdate={fetchAgency} />}
          {activeTab === 'prices' && <AgencyPrices agency={agency} />}
          {activeTab === 'buyers' && <AgencyBuyers agency={agency} />}
          {activeTab === 'transactions' && <AgencyTransactions agency={agency} />}
        </div>
      </div>
    </div>
  );
}

function AgencySettings({ agency, onUpdate }) {
  const { addToast } = useToast();
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
      return addToast({ type: 'error', message: 'Vui lòng nhập tên miền' });
    }
    try {
      setSaving(true);
      await api.post('/agencies/setup', form);
      addToast({ type: 'success', message: 'Đã lưu cấu hình đại lý' });
      onUpdate();
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || 'Lỗi lưu cấu hình' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
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

function AgencyPrices({ agency }) {
  const { addToast } = useToast();
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Mẫu bảng giá mặc định
  const defaultTypes = [
    { type: 'google_search', duration: '60s', name: 'Google Search 60s' },
    { type: 'google_search', duration: '120s', name: 'Google Search 120s' },
    { type: 'direct', duration: '60s', name: 'Direct 60s' },
  ];

  useEffect(() => {
    if (!agency?.id) {
      setLoading(false);
      return;
    }
    fetchPrices();
  }, [agency]);

  const fetchPrices = async () => {
    try {
      const data = await api.get('/agencies/prices');
      
      // Merge với default
      const merged = defaultTypes.map(def => {
        const found = data.find(d => d.traffic_type === def.type && d.duration === def.duration);
        return found ? { ...def, v1_price: found.v1_price, v2_price: found.v2_price } : { ...def, v1_price: 1500, v2_price: 2000 };
      });
      setPrices(merged);
    } catch (error) {
      addToast({ type: 'error', message: 'Lỗi tải bảng giá' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = prices.map(p => ({
        traffic_type: p.type,
        duration: p.duration,
        v1_price: Number(p.v1_price),
        v2_price: Number(p.v2_price)
      }));
      await api.post('/agencies/prices', { prices: payload });
      addToast({ type: 'success', message: 'Đã cập nhật bảng giá bán lẻ' });
    } catch (error) {
      addToast({ type: 'error', message: 'Lỗi cập nhật bảng giá' });
    } finally {
      setSaving(false);
    }
  };

  const updatePrice = (index, field, value) => {
    const newPrices = [...prices];
    newPrices[index][field] = value;
    setPrices(newPrices);
  };

  if (!agency?.id) {
    return <div className="text-slate-500">Vui lòng cấu hình và lưu thông tin đại lý trước.</div>;
  }

  if (loading) return <div>Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 text-amber-800 p-4 rounded-lg border border-amber-200">
        <p className="font-medium">Lưu ý về Bảng giá bán lẻ</p>
        <p className="text-sm mt-1">
          Bảng giá này áp dụng cho khách hàng (Buyer) đăng ký qua web con của bạn. 
          Khi khách hàng tạo chiến dịch, hệ thống sẽ trừ tiền khách hàng theo giá này, và trừ tiền của <b>chính bạn</b> (Đại lý) theo giá gốc của hệ thống.
          Đảm bảo bạn nhập giá cao hơn giá hệ thống để có lợi nhuận.
        </p>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Loại hình</th>
              <th className="px-4 py-3 font-semibold w-40">Giá V1 (đ)</th>
              <th className="px-4 py-3 font-semibold w-40">Giá V2 (đ)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prices.map((p, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3">
                  <input 
                    type="number" 
                    value={p.v1_price} 
                    onChange={e => updatePrice(idx, 'v1_price', e.target.value)}
                    className="w-full px-3 py-1.5 border rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <input 
                    type="number" 
                    value={p.v2_price} 
                    onChange={e => updatePrice(idx, 'v2_price', e.target.value)}
                    className="w-full px-3 py-1.5 border rounded"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
          Lưu bảng giá
        </button>
      </div>
    </div>
  );
}

function AgencyBuyers({ agency }) {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (agency?.id) {
      fetchBuyers();
    } else {
      setLoading(false);
    }
  }, [agency]);

  const fetchBuyers = async () => {
    try {
      const data = await api.get('/agencies/buyers');
      setBuyers(data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  if (!agency?.id) return <div className="text-slate-500">Vui lòng cấu hình đại lý trước.</div>;
  if (loading) return <div>Đang tải...</div>;

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Danh sách Khách hàng ({buyers.length})</h3>
      </div>
      
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">ID</th>
              <th className="px-4 py-3 font-semibold">Tên</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Ngày đăng ký</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {buyers.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-4 py-8 text-center text-slate-500">Chưa có khách hàng nào</td>
              </tr>
            ) : (
              buyers.map(b => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">#{b.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{b.name || b.username}</td>
                  <td className="px-4 py-3 text-slate-600">{b.email}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(b.created_at).toLocaleString('vi-VN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgencyTransactions({ agency }) {
  const { addToast } = useToast();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    if (agency?.id) {
      fetchTxs();
    } else {
      setLoading(false);
    }
  }, [agency]);

  const fetchTxs = async () => {
    try {
      const data = await api.get('/agencies/transactions');
      setTxs(data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ${action === 'approve' ? 'duyệt' : 'từ chối'} giao dịch này?`)) return;
    
    try {
      setProcessing(id);
      await api.post(`/agencies/transactions/${id}/${action}`);
      addToast({ type: 'success', message: 'Xử lý thành công' });
      fetchTxs();
    } catch (error) {
      addToast({ type: 'error', message: 'Lỗi xử lý' });
    } finally {
      setProcessing(null);
    }
  };

  if (!agency?.id) return <div className="text-slate-500">Vui lòng cấu hình đại lý trước.</div>;
  if (loading) return <div>Đang tải...</div>;

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Yêu cầu nạp tiền</h3>
        <p className="text-sm text-slate-500">Duyệt hoặc từ chối các yêu cầu nạp tiền từ khách hàng.</p>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Mã GD</th>
              <th className="px-4 py-3 font-semibold">Khách hàng</th>
              <th className="px-4 py-3 font-semibold text-right">Số tiền</th>
              <th className="px-4 py-3 font-semibold text-center">Trạng thái</th>
              <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {txs.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-slate-500">Không có giao dịch nào</td>
              </tr>
            ) : (
              txs.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-500">{t.ref_code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{t.username}</div>
                    <div className="text-xs text-slate-500">{t.email}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">
                    +{Number(t.amount).toLocaleString('vi-VN')} đ
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.status === 'pending' && <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-medium">Chờ duyệt</span>}
                    {t.status === 'success' && <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-medium">Thành công</span>}
                    {t.status === 'failed' && <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-medium">Bị từ chối</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(t.id, 'approve')}
                          disabled={processing === t.id}
                          className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
                          title="Duyệt"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => handleAction(t.id, 'reject')}
                          disabled={processing === t.id}
                          className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                          title="Từ chối"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
