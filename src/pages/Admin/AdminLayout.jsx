import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Megaphone, Receipt, LifeBuoy,
  ChevronLeft, Shield, Settings, Settings2, Menu, X, DollarSign, LogOut,
  ChevronDown, Briefcase, HardHat, Gift, ShieldAlert, ShieldCheck, Fingerprint, Tags,
} from 'lucide-react';
import api from '../../lib/api';

const BUYER_NAV = [
  { to: '/admin/users',        icon: Users,           label: 'Người dùng' },
  { to: '/admin/campaigns',    icon: Megaphone,       label: 'Chiến dịch' },
  { to: '/admin/pricing',      icon: DollarSign,      label: 'Bảng giá' },
  { to: '/admin/tickets',      icon: LifeBuoy,        label: 'Hỗ trợ' },
  { to: '/admin/referrals/buyers', icon: Gift,         label: 'Referral' },
];

const WORKER_NAV = [
  { to: '/admin/worker-users',          icon: Users,         label: 'Người dùng' },
  { to: '/admin/source-approval',       icon: ShieldCheck,   label: 'Duyệt nguồn' },
  { to: '/admin/worker-tasks',          icon: HardHat,       label: 'Nhiệm vụ' },
  { to: '/admin/worker-withdrawals',    icon: Receipt,       label: 'Rút tiền' },
  { to: '/admin/withdrawal-addresses',  icon: Fingerprint,   label: 'Địa chỉ rút' },
  { to: '/admin/worker-pricing-groups', icon: Tags,          label: 'Nhóm giá' },
  { to: '/admin/worker-tickets',        icon: LifeBuoy,      label: 'Hỗ trợ' },
  { to: '/admin/referrals/workers',     icon: Gift,          label: 'Referral' },
  { to: '/admin/security',              icon: ShieldAlert,   label: 'Anti Cheat' },
];

const SYSTEM_NAV = [
  { to: '/admin/config',         icon: Settings2,   label: 'Cấu hình' },
  { to: '/admin/settings',       icon: Settings,    label: 'Cài đặt' },
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
    if (!token) { navigate('/dang-nhap'); return; }
    api.get('/auth/me').then(data => {
      if (data.user?.role !== 'admin') { navigate('/dang-nhap'); return; }
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
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
      `} style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)' }}>
        {/* Brand */}
        <div className="flex items-center justify-center px-5 py-5 border-b border-white/10 relative">
          <img src="/traffic68_com.gif" alt="Traffic68" className="h-12 w-auto mx-auto" />
          <button onClick={closeSidebar} className="lg:hidden p-2 hover:bg-white/10 rounded-lg absolute right-4">
            <X size={16} className="text-white/60" />
          </button>
        </div>

        {/* Admin badge */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Shield size={11} className="text-white" />
            </div>
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">Admin Panel</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <NavItem to="/admin" icon={LayoutDashboard} label="Tổng quan" end />
          <NavItem to="/admin/transactions" icon={Receipt} label="Giao dịch" />

          {/* Buyer Section */}
          <div className="mt-3">
            <button onClick={() => setBuyerOpen(!buyerOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/50 transition">
              <div className="flex items-center gap-2"><Briefcase size={10} /> Buyer</div>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${buyerOpen ? '' : '-rotate-90'}`} />
            </button>
            {buyerOpen && <div className="ml-1 space-y-0.5">{BUYER_NAV.map(item => <NavItem key={item.to} {...item} />)}</div>}
          </div>

          {/* Worker Section */}
          <div className="mt-3">
            <button onClick={() => setWorkerOpen(!workerOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/50 transition">
              <div className="flex items-center gap-2"><HardHat size={10} /> Worker</div>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${workerOpen ? '' : '-rotate-90'}`} />
            </button>
            {workerOpen && <div className="ml-1 space-y-0.5">{WORKER_NAV.map(item => <NavItem key={item.to} {...item} />)}</div>}
          </div>

          {/* System */}
          <div className="pt-3 mt-3 border-t border-white/5 space-y-0.5">
            {SYSTEM_NAV.map(item => <NavItem key={item.to} {...item} />)}
          </div>
        </nav>

        <div className="px-3 py-3 border-t border-white/10 space-y-1 shrink-0">
          <button onClick={() => { closeSidebar(); navigate('/buyer/dashboard'); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-white/40 hover:bg-white/5 hover:text-white/70 transition">
            <ChevronLeft size={14} /> Buyer Dashboard
          </button>
          <button onClick={() => { closeSidebar(); navigate('/worker/dashboard'); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-white/40 hover:bg-white/5 hover:text-white/70 transition">
            <ChevronLeft size={14} /> Worker Dashboard
          </button>
          <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/dang-nhap'); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-red-300/70 hover:bg-red-500/10 hover:text-red-300 transition">
            <LogOut size={14} /> Đăng xuất
          </button>
          <div className="flex items-center gap-3 px-3 py-2 mt-1">
            {admin?.avatar_url ? (
              <img src={admin.avatar_url} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0 ring-2 ring-white/10" />
            ) : (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-black shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {admin?.name?.charAt(0) || 'A'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{admin?.name}</p>
              <p className="text-[9px] text-white/30 truncate">{admin?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 h-screen overflow-y-auto">
        {/* Mobile header */}
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 sticky top-0 z-30 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <Menu size={20} className="text-slate-700" />
          </button>
          <img src="/traffic68_com.gif" alt="Traffic68" className="h-8 w-auto" />
          {admin?.avatar_url ? (
            <img src={admin.avatar_url} alt="" className="w-8 h-8 rounded-xl object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-black"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
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
