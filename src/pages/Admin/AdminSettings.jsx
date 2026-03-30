import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Save, Eye, EyeOff, Mail, User, Lock, CheckCircle } from 'lucide-react';
import api from '../../lib/api';

export default function AdminSettings() {
  usePageTitle('Admin - Cài đặt');
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [infoMsg, setInfoMsg] = useState('');
  const [infoErr, setInfoErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    api.get('/auth/me')
      .then(data => {
        setAdmin(data.user);
        setEmail(data.user.email || '');
        setUsername(data.user.username || '');
        setName(data.user.name || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    setInfoErr('');
    setInfoMsg('');
    setSavingInfo(true);
    try {
      const res = await api.put('/admin/settings/info', { email, username, name });
      setInfoMsg(res.message || 'Cập nhật thành công');
      // Update localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.email = email;
      user.name = name;
      localStorage.setItem('user', JSON.stringify(user));
    } catch (err) {
      setInfoErr(err.message);
    } finally {
      setSavingInfo(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwErr('');
    setPwMsg('');
    if (newPassword.length < 6) {
      setPwErr('Mật khẩu mới phải ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr('Mật khẩu xác nhận không khớp');
      return;
    }
    setSavingPw(true);
    try {
      const res = await api.put('/admin/settings/password', {
        currentPassword,
        newPassword,
      });
      setPwMsg(res.message || 'Đổi mật khẩu thành công');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwErr(err.message);
    } finally {
      setSavingPw(false);
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
      <div>
        <h1 className="text-2xl font-black text-slate-900">Cài đặt Admin</h1>
        <p className="text-sm text-slate-500 mt-1">Quản lý thông tin tài khoản quản trị</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ── Info Section ── */}
      <form onSubmit={handleUpdateInfo} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <User size={18} className="text-indigo-500" /> Thông tin tài khoản
        </h2>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tên hiển thị</label>
          <div className="relative">
            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Tên hiển thị"
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tên đăng nhập (Username)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">@</span>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="username"
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>

        {infoErr && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{infoErr}</div>}
        {infoMsg && (
          <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium flex items-center gap-2">
            <CheckCircle size={16} /> {infoMsg}
          </div>
        )}

        <button type="submit" disabled={savingInfo}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
          <Save size={16} /> {savingInfo ? 'Đang lưu...' : 'Lưu thông tin'}
        </button>
      </form>

      {/* ── Password Section ── */}
      <form onSubmit={handleUpdatePassword} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Lock size={18} className="text-indigo-500" /> Đổi mật khẩu
        </h2>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mật khẩu hiện tại</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type={showCurrent ? 'text' : 'password'} value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mật khẩu mới</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type={showNew ? 'text' : 'password'} value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            <button type="button" onClick={() => setShowNew(!showNew)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Xác nhận mật khẩu mới</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>

        {pwErr && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{pwErr}</div>}
        {pwMsg && (
          <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium flex items-center gap-2">
            <CheckCircle size={16} /> {pwMsg}
          </div>
        )}

        <button type="submit" disabled={savingPw}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
          <Lock size={16} /> {savingPw ? 'Đang lưu...' : 'Đổi mật khẩu'}
        </button>
      </form>
      </div>
    </div>
  );
}
