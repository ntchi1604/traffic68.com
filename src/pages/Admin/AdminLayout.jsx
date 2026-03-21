import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Megaphone, Receipt, LifeBuoy,
  ChevronLeft, Shield, Settings, Menu, X, DollarSign, Fingerprint, LogOut,
  ChevronDown, Briefcase, HardHat, Gift,
} from 'lucide-react';
import api from '../../lib/api';

const BUYER_NAV = [
  { to: '/admin',              icon: LayoutDashboard, label: 'Tổng quan',    end: true },
  { to: '/admin/users',        icon: Users,           label: 'Người dùng' },
  { to: '/admin/campaigns',    icon: Megaphone,       label: 'Chiến dịch' },
  { to: '/admin/transactions', icon: Receipt,         label: 'Giao dịch' },
  { to: '/admin/pricing',      icon: DollarSign,      label: 'Bảng giá' },
  { to: '/admin/tickets',      icon: LifeBuoy,        label: 'Hỗ trợ' },
  { to: '/admin/referrals/buyers', icon: Gift,          label: 'Referral Buyer' },
];

const WORKER_NAV = [
  { to: '/admin/referrals/workers', icon: Gift,         label: 'Referral Worker' },
];

const SYSTEM_NAV = [
  { to: '/admin/security',     icon: Fingerprint,     label: 'Bảo mật' },
  { to: '/admin/settings',     icon: Settings,        label: 'Cài đặt' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [buyerOpen, setBuyerOpen] = useState(true);
  const [workerOpen, setWorkerOpen] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/dang-nhap');
      return;
    }
    api.get('/auth/me').then(data => {
      if (data.user?.role !== 'admin') {
        navigate('/dang-nhap');
        return;
      }
      setAdmin(data.user);
      setLoading(false);
    }).catch(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/dang-nhap');
    });
  }, [navigate]);

  const closeSidebar = () => setSidebarOpen(false);

  const NavItem = ({ to, icon: Icon, label, end }) => (
    <NavLink key={to} to={to} end={end} onClick={closeSidebar}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
         ${isActive
           ? 'bg-slate-800 text-white'
           : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'}`}
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );

  if (loading || !admin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={closeSidebar} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex items-center justify-center px-5 py-5 border-b border-slate-800 relative">
          <div className="flex items-center justify-center w-full">
            <img src="/traffic68_com.gif" alt="Traffic68" className="h-14 sm:h-16 w-auto mx-auto" />
          </div>
          <button onClick={closeSidebar} className="lg:hidden p-2 hover:bg-slate-800 rounded-lg absolute right-4">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Buyer Section */}
          <button onClick={() => setBuyerOpen(!buyerOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200">
            <div className="flex items-center gap-2"><Briefcase className="w-4 h-4" /> Quản lý Buyer</div>
            <ChevronDown className={`w-4 h-4 transition-transform ${buyerOpen ? '' : '-rotate-90'}`} />
          </button>
          {buyerOpen && BUYER_NAV.map(item => <NavItem key={item.to} {...item} />)}

          {/* Worker Section */}
          <div className="mt-2">
            <button onClick={() => setWorkerOpen(!workerOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200">
              <div className="flex items-center gap-2"><HardHat className="w-4 h-4" /> Quản lý Worker</div>
              <ChevronDown className={`w-4 h-4 transition-transform ${workerOpen ? '' : '-rotate-90'}`} />
            </button>
            {workerOpen && WORKER_NAV.map(item => <NavItem key={item.to} {...item} />)}
          </div>

          {/* System */}
          <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
            {SYSTEM_NAV.map(item => <NavItem key={item.to} {...item} />)}
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-white/10 space-y-2 shrink-0">
          <button onClick={() => { closeSidebar(); navigate('/buyer/dashboard'); }}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white transition">
            <ChevronLeft size={18} /> Buyer Dashboard
          </button>
          <button onClick={() => { closeSidebar(); navigate('/worker/dashboard'); }}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white transition">
            <ChevronLeft size={18} /> Worker Dashboard
          </button>
          <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/dang-nhap'); }}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition">
            <LogOut size={18} /> Đăng xuất
          </button>
          <div className="flex items-center gap-3 px-4 py-2">
            {admin?.avatar_url ? (
              <img src={admin.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0">
                {admin?.name?.charAt(0) || 'A'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{admin?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{admin?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 h-screen overflow-y-auto">
        {/* Mobile header */}
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg">
            <Menu size={20} className="text-slate-700" />
          </button>
          <img src="/traffic68_com.gif" alt="Traffic68" className="h-8 w-auto" />
          {admin?.avatar_url ? (
            <img src={admin.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-black">
              {admin?.name?.charAt(0) || 'A'}
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
