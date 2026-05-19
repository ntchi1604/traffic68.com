import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Save, Eye, EyeOff, Lock, CheckCircle, User } from 'lucide-react';
import api from '../../lib/api';

export default function AgencyAdminSettings() {
  usePageTitle('Đại lý - Cài đặt');
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    api.get('/auth/me')
      .then(data => {
        setAdmin(data.user);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwErr('');
    setPwMsg('');

    if (newPassword.length < 6) {
      setPwErr('Mat khau moi phai it nhat 6 ky tu');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr('Mat khau xac nhan khong khop');
      return;
    }

    setSavingPw(true);
    try {
      const res = await api.put('/agency-admin/settings/password', {
        currentPassword,
        newPassword,
      });
      setPwMsg(res.message || 'Doi mat khau thanh cong!');
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
        <h1 className="text-2xl font-black text-slate-900">Cai dat tai khoan</h1>
        <p className="text-sm text-slate-500 mt-1">Quan ly thong tin tai khoan quan tri dai ly</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Profile Info (read-only) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <User size={18} className="text-indigo-500" /> Thong tin tai khoan
          </h2>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Ho ten</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={admin?.name || ''} readOnly
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Email</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
              <input type="text" value={admin?.email || ''} readOnly
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              Vai tro: <span className="font-bold text-slate-600 capitalize">{admin?.agency_role || 'admin'}</span>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <form onSubmit={handleUpdatePassword} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Lock size={18} className="text-indigo-500" /> Doi mat khau
          </h2>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mat khau hien tai</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type={showCurrent ? 'text' : 'password'} value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mat khau moi</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type={showNew ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Toi thieu 6 ky tu"
                className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Xac nhan mat khau moi</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Nhap lai mat khau moi"
                className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
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
            <Save size={16} /> {savingPw ? 'Dang luu...' : 'Doi mat khau'}
          </button>
        </form>
      </div>
    </div>
  );
}
