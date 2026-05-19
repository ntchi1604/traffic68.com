import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Megaphone, Receipt, LifeBuoy,
  ChevronLeft, Shield, Settings, Settings2, Menu, X, DollarSign, LogOut,
} from 'lucide-react';
import api from '../../lib/api';

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

const NAV = [
  { to: '/agency-admin',              icon: LayoutDashboard, label: 'Tổng quan',      end: true },
  { to: '/agency-admin/buyers',       icon: Users,           label: 'Quản lý Buyer' },
  { to: '/agency-admin/campaigns',    icon: Megaphone,       label: 'Chiến dịch' },
  { to: '/agency-admin/transactions', icon: Receipt,         label: 'Giao dịch' },
  { to: '/agency-admin/tickets',      icon: LifeBuoy,        label: 'Hỗ trợ' },
  { to: '/agency-admin/pricing',      icon: DollarSign,      label: 'Bảng giá' },
  { to: '/agency-admin/config',       icon: Settings2,       label: 'Cấu hình' },
  { to: '/agency-admin/settings',     icon: Settings,        label: 'Cài đặt' },
];

export default function AgencyAdminLayout({ config }) {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const primaryColor = config?.primary_color || '#0ea5e9';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/dang-nhap'); return; }

    const payload = decodeJwtPayload(token);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/dang-nhap');
      return;
    }

    const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
    if (cachedUser && (cachedUser.agency_role === 'owner' || cachedUser.agency_role === 'admin')) {
      setAdmin(cachedUser);
      setLoading(false);
    }

    api.get('/auth/me').then(data => {
      const u = data.user;
      if (u?.agency_role !== 'owner' && u?.agency_role !== 'admin') {
        navigate('/buyer/dashboard');
        return;
      }
      localStorage.setItem('user', JSON.stringify(u));
      setAdmin(u);
      setLoading(false);
    }).catch(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/dang-nhap');
    });
  }, [navigate]);

  const closeSidebar = () => setSidebarOpen(false);

  const NavItem = ({ to, icon: Icon, label, end }) => (
    <NavLink to={to} end={end} onClick={closeSidebar}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150
         ${isActive
          ? 'bg-white/10 text-white shadow-sm'
          : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );

  if (loading || !admin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: '#e2e8f0', borderTopColor: primaryColor }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={closeSidebar} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `} style={{ background: `linear-gradient(180deg, ${primaryColor}dd 0%, ${primaryColor} 100%)` }}>
        {/* Brand */}
        <div className="flex items-center justify-center px-5 py-5 border-b border-white/10 relative">
          {config?.logo_url ? (
            <img src={config.logo_url} alt={config?.name} className="h-12 w-auto mx-auto" />
          ) : (
            <span className="text-white font-black text-lg">{config?.name || 'Agency Admin'}</span>
          )}
          <button onClick={closeSidebar} className="lg:hidden p-2 hover:bg-white/10 rounded-lg absolute right-4">
            <X size={16} className="text-white/60" />
          </button>
        </div>

        {/* Badge */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
              <Shield size={11} className="text-white" />
            </div>
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
              {admin.agency_role === 'owner' ? 'Chủ đại lý' : 'Quản trị viên'}
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            if (item.to === '/agency-admin/config' && admin.agency_role !== 'owner') return null;
            return <NavItem key={item.to} {...item} />;
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/10 space-y-1 shrink-0">
          <button onClick={() => { closeSidebar(); navigate('/buyer/dashboard'); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-white/40 hover:bg-white/5 hover:text-white/70 transition">
            <ChevronLeft size={14} /> Dashboard
          </button>
          <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/dang-nhap'); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-red-300/70 hover:bg-red-500/10 hover:text-red-300 transition">
            <LogOut size={14} /> Đăng xuất
          </button>
          <div className="flex items-center gap-3 px-3 py-2 mt-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-black shrink-0 bg-white/20">
              {admin?.name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{admin?.name}</p>
              <p className="text-[9px] text-white/30 truncate">{admin?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 h-screen overflow-y-auto">
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 sticky top-0 z-30 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <Menu size={20} className="text-slate-700" />
          </button>
          <span className="font-bold text-sm" style={{ color: primaryColor }}>{config?.name || 'Agency Admin'}</span>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-black" style={{ background: primaryColor }}>
            {admin?.name?.charAt(0) || 'A'}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
