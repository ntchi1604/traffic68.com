import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Gift, ChevronDown } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';
import api, { getUser, clearAuth } from '../lib/api';
import { formatMoney as fmt } from '../lib/format';

export default function DashboardHeader({ onMenuClick }) {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState(getUser() || { name: '', email: '' });
  const [wallets, setWallets] = useState({ main: 0, commission: 0 });
  const profileRef = useRef(null);

  // Fetch wallets + user from API
  useEffect(() => {
    api.get('/finance').then((data) => {
      setWallets({
        main: data.wallets?.main?.balance || 0,
        commission: data.wallets?.commission?.balance || 0,
      });
    }).catch(() => {});

    api.get('/auth/me').then((data) => {
      if (data.user) setUser(data.user);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  const handleLogout = () => {
    clearAuth();
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('theme');
    navigate('/dang-nhap');
  };


  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').slice(-2).toUpperCase();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">

        {/* Left: hamburger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg flex-shrink-0"
        >
          <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Right: wallets + bell + profile */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">

          {/* ── Ví chính ── */}
          <button
            onClick={() => navigate('/buyer/dashboard/finance/deposit')}
            className="hidden sm:flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200
                       text-blue-700 text-xs font-bold px-3 py-2 rounded-xl transition-all"
            title="Ví Traffic – dùng để mua traffic"
          >
            <Wallet size={14} className="text-blue-500 flex-shrink-0" />
            <span className="hidden md:inline text-slate-500 font-medium">Ví Traffic</span>
            <span className="font-black">{fmt(wallets.main)}</span>
            <span className="text-slate-400 font-normal">đ</span>
          </button>

          {/* ── Ví hoa hồng ── */}
          <button
            onClick={() => navigate('/buyer/dashboard/finance/transactions')}
            className="hidden sm:flex items-center gap-2 bg-orange-50 hover:bg-orange-100 border border-orange-200
                       text-orange-700 text-xs font-bold px-3 py-2 rounded-xl transition-all"
            title="Ví Hoa Hồng – nhận khi giới thiệu thành viên"
          >
            <Gift size={14} className="text-orange-500 flex-shrink-0" />
            <span className="hidden md:inline text-slate-500 font-medium">Hoa hồng</span>
            <span className="font-black">{fmt(wallets.commission)}</span>
            <span className="text-slate-400 font-normal">đ</span>
          </button>

          {/* Bell */}
          <NotificationDropdown />

          {/* Profile */}
          <div className="relative border-l border-slate-200 pl-2 sm:pl-3" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0 ${user.avatar_url ? '' : 'bg-blue-600'}`}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <span className="hidden sm:inline font-medium">{user.name || 'User'}</span>
              <ChevronDown size={14} className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="font-bold text-slate-800 text-sm">{user.name || 'User'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user.email || 'Đang hoạt động'}</p>
                </div>

                {/* Mini wallet info in dropdown */}
                <div className="px-4 py-2 border-b border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-500"><Wallet size={11} /> Ví Traffic</span>
                    <span className="font-bold text-blue-600">{fmt(wallets.main)} đ</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-500"><Gift size={11} /> Hoa hồng</span>
                    <span className="font-bold text-orange-500">{fmt(wallets.commission)} đ</span>
                  </div>
                </div>

                <a href="/buyer/dashboard/profile" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">Hồ sơ của tôi</a>
                <a href="/buyer/dashboard/profile?tab=password" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">Cài đặt tài khoản</a>
                {user.role === 'admin' && (
                  <a href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 transition font-semibold">
                    🛡️ Admin Panel
                  </a>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition font-medium"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
