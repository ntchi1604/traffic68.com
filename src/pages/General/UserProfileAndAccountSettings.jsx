import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import { User, Lock, Save, Camera, Check } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

export default function UserProfileAndAccountSettings() {
  usePageTitle('Hồ sơ & Tài khoản');
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', avatar: '' });
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await api.put('/users/profile', { name: formData.name, phone: formData.phone });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      toast.success('Cập nhật hồ sơ thành công!');
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
      setShowSuccess(true);
      setPasswordForm({ current: '', new: '', confirm: '' });
      setTimeout(() => setShowSuccess(false), 3000);
      toast.success('Đổi mật khẩu thành công!');
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Breadcrumb
        items={[
          { label: 'Trang chủ', href: '/buyer/dashboard' },
          { label: 'Hồ sơ của tôi' },
        ]}
      />

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'profile'
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <User size={16} />
                Thông tin hồ sơ
              </span>
              {activeTab === 'profile' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'password'
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <Lock size={16} />
                Đổi mật khẩu
              </span>
              {activeTab === 'password' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
              )}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {showSuccess && activeTab === 'profile' && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center text-emerald-700 font-bold text-sm">
                <Check className="w-5 h-5 mr-2" />
                Cập nhật hồ sơ thành công!
              </div>
            </div>
          )}

          {activeTab === 'profile' ? (
            <div className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="flex items-center gap-6 p-6 bg-slate-50/50 border-b border-slate-100">
                <div className="relative">
                  <img
                    src={formData.avatar}
                    alt="Avatar"
                    className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md"
                  />
                  <label className="absolute -bottom-1 -right-1 p-2 bg-indigo-500 rounded-xl text-white cursor-pointer hover:bg-indigo-600 transition-colors shadow-lg">
                    <Camera size={14} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{formData.name || 'Người dùng'}</h2>
                  <p className="text-sm text-slate-500">{formData.email}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-bold text-slate-700">
                      Họ và tên
                    </label>
                    <input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-bold text-slate-700">
                      Email
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        required
                      />
                      <span className="inline-flex items-center px-3 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-xl">
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Đã xác minh
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-bold text-slate-700">
                      Số điện thoại
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                      <span className="inline-flex items-center px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl">
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Đã xác minh
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Đổi mật khẩu</h2>
                <p className="text-xs text-slate-400 mt-0.5">Cập nhật mật khẩu để bảo mật tài khoản</p>
              </div>
              <form onSubmit={handlePasswordSubmit} className="p-6 space-y-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="current" className="text-sm font-bold text-slate-700">
                      Mật khẩu hiện tại
                    </label>
                    <div className="relative">
                      <input
                        id="current"
                        name="current"
                        type={showPassword ? 'text' : 'password'}
                        value={passwordForm.current}
                        onChange={handlePasswordChange}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all pr-12"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {showPassword ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="new" className="text-sm font-bold text-slate-700">
                      Mật khẩu mới
                    </label>
                    <div className="relative">
                      <input
                        id="new"
                        name="new"
                        type={showPassword ? 'text' : 'password'}
                        value={passwordForm.new}
                        onChange={handlePasswordChange}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all pr-12"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {showPassword ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">Tối thiểu 8 ký tự, bao gồm chữ cái và số</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirm" className="text-sm font-bold text-slate-700">
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="relative">
                      <input
                        id="confirm"
                        name="confirm"
                        type={showPassword ? 'text' : 'password'}
                        value={passwordForm.confirm}
                        onChange={handlePasswordChange}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all pr-12"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {showPassword ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
                  </button>
                </div>
              </form>

              {showSuccess && (
                <div className="mx-6 mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center text-emerald-700 font-bold text-sm">
                    <Check className="w-5 h-5 mr-2" />
                    Đổi mật khẩu thành công!
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}