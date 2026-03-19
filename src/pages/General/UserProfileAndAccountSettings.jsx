import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import { User, Lock, Mail, Phone, Save, Camera, Check } from 'lucide-react';
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

  // Fetch user profile on mount
  useEffect(() => {
    api.get('/users/profile').then(data => {
      const u = data.user;
      setFormData({
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        avatar: u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}&background=3B82F6&color=FFFFFF`,
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
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Hồ sơ & Tài khoản' },
      ]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Hồ sơ & Tài khoản</h1>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
          {error}
        </div>
      )}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <User className="w-4 h-4 inline mr-1" />
          Hồ sơ cá nhân
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'password'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Lock className="w-4 h-4 inline mr-1" />
          Mật khẩu
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Thông tin cá nhân</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <img
                    src={formData.avatar}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover border-2 border-slate-200"
                  />
                  <label className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors">
                    <Camera className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-sm text-slate-500 mt-2">Chọn ảnh đại diện</p>
              </div>

              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-slate-700">
                    Họ và tên
                  </label>
                  <input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <span className="inline-flex items-center px-3 py-2 text-sm text-green-600 bg-green-50 rounded-lg">
                      <Check className="w-4 h-4 mr-1" />
                      Đã xác minh
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                    Số điện thoại
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="inline-flex items-center px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg">
                      <Check className="w-4 h-4 mr-1" />
                      Đã xác minh
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Đổi mật khẩu</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="current" className="text-sm font-medium text-slate-700">
                  Mật khẩu hiện tại
                </label>
                <div className="relative">
                  <input
                    id="current"
                    name="current"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={handlePasswordChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="new" className="text-sm font-medium text-slate-700">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    id="new"
                    name="new"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.new}
                    onChange={handlePasswordChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
                <p className="text-sm text-slate-500">Tối thiểu 8 ký tự, bao gồm chữ cái và số</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm" className="text-sm font-medium text-slate-700">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    id="confirm"
                    name="confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.confirm}
                    onChange={handlePasswordChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>

          {showSuccess && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center text-green-800">
                <Check className="w-5 h-5 mr-2" />
                Đổi mật khẩu thành công!
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}