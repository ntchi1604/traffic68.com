// Worker Profile — re-exports the shared profile component with worker breadcrumb
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { useState } from 'react';
import { UserCircle, Mail, Phone, Lock, Camera } from 'lucide-react';
import { getUser } from '../../lib/api';

export default function WorkerProfile() {
  usePageTitle('Hồ sơ của tôi');
  const user = getUser() || { name: '', email: '', phone: '' };
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Hồ sơ của tôi' },
      ]} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Hồ sơ của tôi</h1>
        <p className="text-slate-500 text-sm mt-1">Quản lý thông tin cá nhân</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 flex flex-col items-center">
          <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-black mb-4">
            {(user.name || 'U')[0].toUpperCase()}
          </div>
          <p className="text-lg font-bold text-slate-900">{user.name || 'User'}</p>
          <p className="text-sm text-slate-400">{user.email}</p>
          <button className="flex items-center gap-2 mt-4 px-4 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition">
            <Camera size={14} /> Đổi ảnh đại diện
          </button>
        </div>

        {/* Form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Thông tin cá nhân</h2>
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Họ và tên</label>
              <div className="relative">
                <UserCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số điện thoại</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
            </div>
            <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg transition text-sm">
              Lưu thay đổi
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
