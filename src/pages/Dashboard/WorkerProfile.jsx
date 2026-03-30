// Worker Profile — giống hệt Buyer profile (tabs Hồ sơ / Mật khẩu, avatar upload, API)
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import { User, Lock, Camera, Check, Eye, EyeOff, Save } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

export default function WorkerProfile() {
  usePageTitle('Hồ sơ của tôi');
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', avatar: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/profile').then(data => {
      const u = data.user;
      setFormData({
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        avatar: u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}&background=3B82F6&color=FFFFFF`,
      });
    }).catch(() => setError('Không thể tải thông tin hồ sơ'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handlePasswordChange = (e) => setPasswordForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); setError('');
    try {
      await api.put('/users/profile', { name: formData.name, phone: formData.phone });
      toast.success('Đã cập nhật thông tin!');
    } catch (err) { setError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) { toast.error('Mật khẩu xác nhận không khớp!'); return; }
    if (passwordForm.new.length < 8) { toast.error('Mật khẩu mới phải có ít nhất 8 ký tự!'); return; }
    setIsSubmitting(true); setError('');
    try {
      await api.put('/users/password', { currentPassword: passwordForm.current, newPassword: passwordForm.new });
      toast.success('Đổi mật khẩu thành công!');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err) { setError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const payload = new FormData();
    payload.append('avatar', file);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users/avatar', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: payload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      setFormData(p => ({ ...p, avatar: data.avatarUrl }));
      toast.success('Đã cập nhật ảnh đại diện');
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const inputCls = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition";

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Hồ sơ của tôi' }]} />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">{error}</div>
      )}

      {/* Tab nav */}
      <div className="flex border-b border-slate-200">
        {[
          { key: 'profile', label: 'Hồ sơ cá nhân', icon: User },
          { key: 'password', label: 'Mật khẩu', icon: Lock },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-6">Thông tin cá nhân</h2>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col md:flex-row gap-8">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="relative">
                  <img src={formData.avatar} alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover border-2 border-slate-200 shadow-sm" />
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition shadow">
                    <Camera size={14} />
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </label>
                </div>
                <p className="text-[11px] text-slate-400">Chọn ảnh đại diện</p>
              </div>

              {/* Fields */}
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Họ và tên</label>
                  <input name="name" value={formData.name} onChange={handleChange}
                    className={inputCls} required placeholder="Nhập họ và tên" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                  <div className="flex items-center gap-2">
                    <input name="email" type="email" value={formData.email} onChange={handleChange}
                      className={inputCls} required />
                    <span className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-green-600 bg-green-50 border border-green-100 rounded-xl flex-shrink-0">
                      <Check size={12} /> Đã xác minh
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số điện thoại</label>
                  <input name="phone" type="tel" value={formData.phone} onChange={handleChange}
                    className={inputCls} placeholder="Nhập số điện thoại" />
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-200">
                    <Save size={14} />
                    {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-6">Đổi mật khẩu</h2>
          <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
            {[
              { name: 'current', label: 'Mật khẩu hiện tại' },
              { name: 'new', label: 'Mật khẩu mới', hint: 'Tối thiểu 8 ký tự' },
              { name: 'confirm', label: 'Xác nhận mật khẩu mới' },
            ].map(({ name, label, hint }) => (
              <div key={name}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
                <div className="relative">
                  <input name={name} type={showPassword ? 'text' : 'password'}
                    value={passwordForm[name]} onChange={handlePasswordChange}
                    className={inputCls} required />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
              </div>
            ))}

            <div className="pt-2">
              <button type="submit" disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50 shadow-sm shadow-indigo-200">
                <Lock size={14} />
                {isSubmitting ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
