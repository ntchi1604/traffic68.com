import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import { User, Lock, Mail, Phone, Save, Camera, Check, Eye, EyeOff, Shield } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

export default function UserProfileAndAccountSettings() {
  usePageTitle('Hồ sơ & Tài khoản');
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
        avatar: u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}&background=6366f1&color=FFFFFF`,
      });
    }).catch(err => {
      console.error('Failed to load profile:', err);
      setError('Không thể tải thông tin hồ sơ');
    }).finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await api.put('/users/profile', { name: formData.name, phone: formData.phone });
      toast.success('Đã cập nhật hồ sơ thành công!');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('Mật khẩu mới và xác nhận mật khẩu không khớp!');
      return;
    }
    if (passwordForm.new.length < 8) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự!');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await api.put('/users/password', { currentPassword: passwordForm.current, newPassword: passwordForm.new });
      toast.success('Đổi mật khẩu thành công!');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formPayload = new FormData();
    formPayload.append('avatar', file);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formPayload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      setFormData(prev => ({ ...prev, avatar: data.avatarUrl }));
      toast.success('Đã cập nhật ảnh đại diện');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { key: 'profile', label: 'Hồ sơ cá nhân', icon: User },
    { key: 'password', label: 'Mật khẩu', icon: Lock },
  ];

  const inputStyle = "w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all";

  return (
    <div className="space-y-5 w-full min-w-0 pb-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/buyer/dashboard' },
        { label: 'Hồ sơ & Tài khoản' },
      ]} />

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-lg transition-all ${
              activeTab === t.key
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit}>
            {/* Avatar section */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-5">
              <div className="relative">
                <img src={formData.avatar} alt="Avatar"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200" />
                <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}>
                  <Camera size={14} className="text-white" />
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
              </div>
              <div>
                <p className="text-base font-black text-slate-900">{formData.name || 'Chưa cập nhật'}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formData.email}</p>
              </div>
            </div>

            {/* Form fields */}
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Họ và tên</label>
                <input id="name" name="name" value={formData.name} onChange={handleChange} className={inputStyle} required />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Email</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input id="email" name="email" type="email" value={formData.email} readOnly
                      className={`${inputStyle} pl-10 bg-slate-50 text-slate-500 cursor-not-allowed`} />
                  </div>
                  <span className="inline-flex items-center gap-1 px-3 py-2.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl shrink-0">
                    <Check size={12} /> Đã xác minh
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Số điện thoại</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange}
                      className={`${inputStyle} pl-10`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button type="submit" disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                <Save size={14} />
                {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Shield size={16} className="text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Bảo mật tài khoản</p>
              <p className="text-[11px] text-slate-400">Đổi mật khẩu đăng nhập</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="p-6 space-y-5">
            {['current', 'new', 'confirm'].map((field, i) => (
              <div key={field}>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">
                  {['Mật khẩu hiện tại', 'Mật khẩu mới', 'Xác nhận mật khẩu mới'][i]}
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id={field} name={field}
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm[field]}
                    onChange={handlePasswordChange}
                    className={`${inputStyle} pl-10 pr-12`}
                    required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {field === 'new' && <p className="text-[10px] text-slate-400 mt-1.5">Tối thiểu 8 ký tự, bao gồm chữ cái và số</p>}
              </div>
            ))}

            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                <Lock size={14} />
                {isSubmitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}