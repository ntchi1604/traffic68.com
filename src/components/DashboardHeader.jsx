import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wallet, Gift, ChevronDown } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';
import api, { getUser, clearAuth } from '../lib/api';
import { formatMoney as fmt } from '../lib/format';

export default function DashboardHeader({ onMenuClick }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dashPrefix = pathname.startsWith('/worker') ? '/worker/dashboard' : '/buyer/dashboard';
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState(getUser() || { name: '', email: '' });
  const [wallets, setWallets] = useState({ main: 0, commission: 0, earning: 0 });
  const isWorker = pathname.startsWith('/worker');
  const profileRef = useRef(null);

  // Fetch wallets + user from API
  useEffect(() => {
    api.get('/finance').then((data) => {
      setWallets({
        main: data.wallets?.main?.balance || 0,
        commission: data.wallets?.commission?.balance || 0,
        earning: data.wallets?.earning?.balance || 0,
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
    <header style={{ background: '#0d1520', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="sticky top-0 z-30">
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">

        {/* Left: hamburger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg flex-shrink-0 transition-colors"
          style={{ color: '#64748b' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Right: wallets + bell + profile */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">

          {/* ── Ví chính ── */}
          <button
            onClick={() => navigate(isWorker ? '/worker/dashboard/withdraw' : '/buyer/dashboard/finance/deposit')}
            className="hidden sm:flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl transition-all border"
            style={{
              background: isWorker ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
              borderColor: isWorker ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)',
              color: isWorker ? '#34d399' : '#818cf8',
            }}
            title={isWorker ? 'Ví Earning – thu nhập vượt link' : 'Ví Traffic – dùng để mua traffic'}
          >
            <Wallet size={14} className="flex-shrink-0" />
            <span className="hidden md:inline font-medium" style={{ color: '#64748b' }}>{isWorker ? 'Ví Earning' : 'Ví Traffic'}</span>
            <span className="font-black">{fmt(isWorker ? wallets.earning : wallets.main)}</span>
            <span className="font-normal" style={{ color: '#475569' }}>đ</span>
          </button>

          {/* ── Ví hoa hồng ── */}
          <button
            onClick={() => navigate(isWorker ? '/worker/dashboard/transactions' : '/buyer/dashboard/finance/transactions')}
            className="hidden sm:flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl transition-all border"
            style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}
            title="Ví Hoa Hồng – nhận khi giới thiệu thành viên"
          >
            <Gift size={14} className="flex-shrink-0" />
            <span className="hidden md:inline font-medium" style={{ color: '#64748b' }}>Hoa hồng</span>
            <span className="font-black">{fmt(wallets.commission)}</span>
            <span className="font-normal" style={{ color: '#475569' }}>đ</span>
          </button>

          {/* Bell */}
          <NotificationDropdown isWorker={isWorker} />

          {/* Profile */}
          <div className="relative pl-2 sm:pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }} ref={profileRef}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-2 text-sm transition-colors"
              style={{ color: '#94a3b8' }}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0`}
                style={user.avatar_url ? {} : { background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <span className="hidden sm:inline font-medium" style={{ color: '#cbd5e1' }}>{user.name || 'User'}</span>
              <ChevronDown size={14} className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 mt-2 w-52 rounded-xl shadow-2xl py-1.5 z-50 border"
                style={{ background: '#131d2b', borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="font-bold text-sm" style={{ color: '#e2e8f0' }}>{user.name || 'User'}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{user.email || 'Đang hoạt động'}</p>
                </div>

                <div className="px-4 py-2 space-y-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1" style={{ color: '#475569' }}><Wallet size={11} /> {isWorker ? 'Ví Earning' : 'Ví Traffic'}</span>
                    <span className="font-bold" style={{ color: isWorker ? '#34d399' : '#818cf8' }}>{fmt(isWorker ? wallets.earning : wallets.main)} đ</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1" style={{ color: '#475569' }}><Gift size={11} /> Hoa hồng</span>
                    <span className="font-bold" style={{ color: '#fbbf24' }}>{fmt(wallets.commission)} đ</span>
                  </div>
                </div>

                <a href={`${dashPrefix}/profile`} className="block px-4 py-2 text-sm transition" style={{ color: '#94a3b8' }}
                  onMouseEnter={e => e.target.style.color = '#e2e8f0'}
                  onMouseLeave={e => e.target.style.color = '#94a3b8'}
                >Hồ sơ của tôi</a>
                <a href={`${dashPrefix}/profile?tab=password`} className="block px-4 py-2 text-sm transition" style={{ color: '#94a3b8' }}
                  onMouseEnter={e => e.target.style.color = '#e2e8f0'}
                  onMouseLeave={e => e.target.style.color = '#94a3b8'}
                >Cài đặt tài khoản</a>
                {user.role === 'admin' && (
                  <a href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition" style={{ color: '#fb923c' }}
                  >🛡️ Admin Panel</a>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm font-medium transition"
                  style={{ color: '#f87171' }}
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
