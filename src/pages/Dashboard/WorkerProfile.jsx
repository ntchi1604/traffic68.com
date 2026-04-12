import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import { User, Lock, Camera, Check, Eye, EyeOff, Save, ShieldCheck, Clock, XCircle, Globe, Send, Wallet, Building2, Bitcoin, CheckCircle2 } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

const SOURCE_STATUS = {
  approved: { label: 'Đã duyệt', color: 'bg-green-100 text-green-700 border-green-200', icon: ShieldCheck, desc: 'Tài khoản của bạn đã được duyệt. Bạn có thể tạo link rút gọn bình thường.' },
  pending:  { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock, desc: 'Yêu cầu của bạn đang chờ admin xem xét. Vui lòng đợi trong vòng 24 giờ.' },
  rejected: { label: 'Bị từ chối', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, desc: 'Yêu cầu xét duyệt bị từ chối. Cập nhật lại nguồn và gửi lại.' },
};

const CRYPTO_NETWORKS = ['USDT (BEP20)'];

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

  // Source approval
  const [sourceStatus, setSourceStatus] = useState('pending');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [sourceSubmitting, setSourceSubmitting] = useState(false);

  // Wallet
  const [walletMethod, setWalletMethod] = useState('bank');
  const [walletBank, setWalletBank] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [walletCrypto, setWalletCrypto] = useState({ cryptoNetwork: '', cryptoAddress: '' });
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletSaved, setWalletSaved] = useState(false); // has a saved wallet?

  useEffect(() => {
    api.get('/users/profile').then(data => {
      const u = data.user;
      setFormData({
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        avatar: u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}&background=3B82F6&color=FFFFFF`,
      });
      // Pre-load saved wallet
      if (u.withdraw_wallet) {
        const w = u.withdraw_wallet;
        setWalletMethod(w.method || 'bank');
        if (w.method === 'bank') {
          setWalletBank({ bankName: w.bankName || '', accountNumber: w.accountNumber || '', accountName: w.accountName || '' });
        } else {
          setWalletCrypto({ cryptoNetwork: w.cryptoNetwork || '', cryptoAddress: w.cryptoAddress || '' });
        }
        setWalletSaved(true);
      }
    }).catch(() => setError('Không thể tải thông tin hồ sơ'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== 'source') return;
    const token = localStorage.getItem('token') || '';
    fetch('/api/worker/source', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setSourceStatus(d.source_status || 'pending'); setSourceUrl(d.source_url || ''); setSourceNote(d.source_note || ''); })
      .catch(() => {});
  }, [activeTab]);

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

  const handleSourceSubmit = async (e) => {
    e.preventDefault();
    if (!sourceUrl.trim()) { toast.error('Vui lòng nhập URL nguồn'); return; }
    setSourceSubmitting(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/worker/source', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source_url: sourceUrl.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSourceStatus('pending');
      toast.success('Đã gửi yêu cầu xét duyệt!');
    } catch (err) { toast.error(err.message); }
    finally { setSourceSubmitting(false); }
  };

  const handleWalletSave = async (e) => {
    e.preventDefault();
    setWalletSaving(true);
    try {
      const payload = walletMethod === 'bank'
        ? { method: 'bank', ...walletBank }
        : { method: 'crypto', ...walletCrypto };
      const data = await api.put('/users/withdraw-wallet', payload);
      toast.success(data.message || 'Ví rút tiền đã lưu!');
      setWalletSaved(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWalletSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const inputCls = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition";
  const statusInfo = SOURCE_STATUS[sourceStatus] || SOURCE_STATUS.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Hồ sơ của tôi' }]} />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">{error}</div>
      )}

      {/* Tab nav */}
      <div className="flex flex-wrap border-b border-slate-200 gap-0">
        {[
          { key: 'profile',  label: 'Hồ sơ cá nhân',  icon: User },
          { key: 'wallet',   label: 'Ví rút tiền',     icon: Wallet },
          { key: 'password', label: 'Mật khẩu',        icon: Lock },
          { key: 'source',   label: 'Xét duyệt nguồn', icon: ShieldCheck },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Icon size={15} /> {label}
            {key === 'wallet' && walletSaved && (
              <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Đã lưu ví" />
            )}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-6">Thông tin cá nhân</h2>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col md:flex-row gap-8">
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
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Họ và tên</label>
                  <input name="name" value={formData.name} onChange={handleChange} className={inputCls} required placeholder="Nhập họ và tên" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                  <div className="flex items-center gap-2">
                    <input name="email" type="email" value={formData.email} onChange={handleChange} className={inputCls} required />
                    <span className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-green-600 bg-green-50 border border-green-100 rounded-xl flex-shrink-0">
                      <Check size={12} /> Đã xác minh
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số điện thoại</label>
                  <input name="phone" type="tel" value={formData.phone} onChange={handleChange} className={inputCls} placeholder="Nhập số điện thoại" />
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50 shadow-sm shadow-indigo-200">
                    <Save size={14} />
                    {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Wallet Tab */}
      {activeTab === 'wallet' && (
        <div className="space-y-4">
          {walletSaved && (
            <div className="flex items-center gap-3 p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-700">
              <CheckCircle2 size={20} className="flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Ví rút tiền đã được lưu</p>
                <p className="text-xs mt-0.5 opacity-80">Thông tin này sẽ tự động áp dụng khi bạn gửi yêu cầu rút tiền.</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Ví rút tiền</h2>
            <p className="text-xs text-slate-400 mb-5">Lưu thông tin ví để áp dụng tự động khi rút. Bạn có thể thay đổi bất cứ lúc nào.</p>

            <form onSubmit={handleWalletSave} className="space-y-5 max-w-lg">
              {/* Method picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Phương thức nhận tiền *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setWalletMethod('bank')}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition ${walletMethod === 'bank' ? 'border-indigo-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Building2 size={18} className={walletMethod === 'bank' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-sm font-semibold">Ngân hàng</span>
                  </button>
                  <button type="button" onClick={() => setWalletMethod('crypto')}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition ${walletMethod === 'crypto' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Bitcoin size={18} className={walletMethod === 'crypto' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-sm font-semibold">Crypto</span>
                  </button>
                </div>
              </div>

              {/* Bank fields */}
              {walletMethod === 'bank' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tên ngân hàng *</label>
                    <input type="text" value={walletBank.bankName}
                      onChange={e => setWalletBank(p => ({ ...p, bankName: e.target.value }))}
                      placeholder="VD: Vietcombank, MB Bank..." required
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Số tài khoản *</label>
                    <input type="text" value={walletBank.accountNumber}
                      onChange={e => setWalletBank(p => ({ ...p, accountNumber: e.target.value }))}
                      placeholder="Nhập số tài khoản" required
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tên chủ tài khoản *</label>
                    <input type="text" value={walletBank.accountName}
                      onChange={e => setWalletBank(p => ({ ...p, accountName: e.target.value }))}
                      placeholder="NGUYEN VAN A" required
                      className={inputCls} />
                    <p className="text-[10px] text-slate-400 mt-1">Nhập CHÍNH XÁC tên chủ tài khoản (viết hoa, không dấu)</p>
                  </div>
                </>
              )}

              {/* Crypto fields */}
              {walletMethod === 'crypto' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mạng / Loại coin *</label>
                    <select value={walletCrypto.cryptoNetwork}
                      onChange={e => setWalletCrypto(p => ({ ...p, cryptoNetwork: e.target.value }))}
                      required className={inputCls + ' bg-white'}>
                      <option value="">Chọn mạng...</option>
                      {CRYPTO_NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Địa chỉ ví *</label>
                    <input type="text" value={walletCrypto.cryptoAddress}
                      onChange={e => setWalletCrypto(p => ({ ...p, cryptoAddress: e.target.value }))}
                      placeholder="Nhập địa chỉ ví nhận" required
                      className={inputCls + ' font-mono text-xs'} />
                    <p className="text-[10px] text-red-500 mt-1 font-semibold">Kiểm tra kỹ địa chỉ ví và mạng. Sai địa chỉ sẽ mất tiền!</p>
                  </div>
                </>
              )}

              <button type="submit" disabled={walletSaving}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50 shadow-sm shadow-indigo-200">
                <Save size={14} />
                {walletSaving ? 'Đang lưu...' : 'Lưu ví rút tiền'}
              </button>
            </form>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
            <p className="font-bold mb-1">⚠️ Lưu ý quan trọng:</p>
            <p>• Ví được lưu ở đây sẽ tự động áp dụng cho TẤT CẢ các lần rút tiền.</p>
            <p>• Bạn không thể nhập tay thông tin ví khi rút — hãy cập nhật đúng ở đây.</p>
            <p>• Thay đổi sẽ áp dụng cho lần rút tiếp theo, <b>không ảnh hưởng lệnh đang chờ</b>.</p>
          </div>
        </div>
      )}

      {/* Source Approval Tab */}
      {activeTab === 'source' && (
        <div className="space-y-4">
          {/* Status badge */}
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${statusInfo.color}`}>
            <StatusIcon size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">{statusInfo.label}</p>
              <p className="text-xs mt-0.5 opacity-80">{statusInfo.desc}</p>
            </div>
          </div>

          {/* Submit form */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Xét duyệt nguồn traffic</h2>
            <p className="text-xs text-slate-400 mb-5">Cung cấp URL nguồn traffic bạn sử dụng để admin xem xét và duyệt tài khoản.</p>

            <form onSubmit={handleSourceSubmit} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Globe size={13} className="text-indigo-500" /> Nguồn traffic *
                </label>
                <textarea
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                  placeholder={'VD: Website cá nhân tại domain.com\nFanpage Facebook: fb.com/page\nGroup Telegram: t.me/group\n...'}
                  rows={4}
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-y min-h-[80px]"
                  disabled={sourceStatus === 'approved'}
                />
                <p className="text-[10px] text-slate-400 mt-1">Mô tả chi tiết nơi bạn chia sẻ link để admin xét duyệt (có thể nhiều dòng)</p>
              </div>

              {sourceStatus !== 'approved' && (
                <button type="submit" disabled={sourceSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50 shadow-sm shadow-indigo-200">
                  <Send size={14} />
                  {sourceSubmitting ? 'Đang gửi...' : (sourceStatus === 'rejected' ? 'Gửi lại yêu cầu' : 'Gửi yêu cầu xét duyệt')}
                </button>
              )}

              {sourceStatus === 'approved' && (
                <p className="text-xs text-green-600 font-semibold">✅ Tài khoản đã được duyệt — bạn có thể tạo link rút gọn bình thường.</p>
              )}
            </form>
          </div>

          {/* Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700 mb-2">Lưu ý:</p>
            <p>• Chưa được duyệt → không thể tạo link rút gọn hoặc dùng API.</p>
            <p>• Admin sẽ xem xét trong vòng 24 giờ.</p>
            <p>• Nếu bị từ chối, bạn có thể cập nhật nguồn và gửi lại.</p>
          </div>
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
