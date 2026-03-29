import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Wallet,
  UserCircle,
  ChevronDown,
  X,
  Code2,
  PlusCircle,
  List,
  TrendingUp,
  CreditCard,
  History,
  HelpCircle,
  DollarSign,
  Gift,
  Terminal,
} from 'lucide-react';

const linkBase = 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150';

export default function Sidebar({ isOpen, onClose }) {
  const [isCampaignOpen, setIsCampaignOpen] = useState(true);
  const [isReportOpen,   setIsReportOpen]   = useState(true);
  const [isFinanceOpen,  setIsFinanceOpen]  = useState(true);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col bg-white border-r border-slate-100 shadow-sm`}
      >
        {/* Logo */}
        <div className="flex items-center justify-center px-5 py-5 relative flex-shrink-0 border-b border-slate-100">
          <img
            src="/traffic68_com.gif"
            alt="Traffic68"
            className="h-14 sm:h-16 w-auto mx-auto"
          />
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg absolute right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">

          {/* Dashboard */}
          <NavLink
            to="/buyer/dashboard"
            end
            onClick={onClose}
            className={({ isActive }) =>
              `${linkBase} ${isActive
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <LayoutDashboard size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                Tổng quan
              </>
            )}
          </NavLink>

          {/* Divider */}
          <div className="h-px bg-slate-100 my-2 mx-1" />

          {/* Campaigns */}
          <div>
            <button
              type="button"
              onClick={() => setIsCampaignOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Megaphone size={11} />
                Chiến dịch
              </div>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isCampaignOpen ? '' : '-rotate-90'}`} />
            </button>
            {isCampaignOpen && (
              <div className="ml-1 mt-0.5 space-y-0.5">
                {[
                  { to: '/buyer/dashboard/campaigns/create', icon: PlusCircle, label: 'Tạo chiến dịch' },
                  { to: '/buyer/dashboard/campaigns',        icon: List,        label: 'Quản lý chiến dịch', end: true },
                ].map(({ to, icon: Icon, label, end }) => (
                  <NavLink key={to} to={to} end={end} onClick={onClose}
                    className={({ isActive }) =>
                      `${linkBase} ${isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={15} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Reports */}
          <div>
            <button
              type="button"
              onClick={() => setIsReportOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={11} />
                Báo cáo
              </div>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isReportOpen ? '' : '-rotate-90'}`} />
            </button>
            {isReportOpen && (
              <div className="ml-1 mt-0.5 space-y-0.5">
                <NavLink to="/buyer/dashboard/reports" onClick={onClose}
                  className={({ isActive }) =>
                    `${linkBase} ${isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <TrendingUp size={15} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                      Theo dõi traffic
                    </>
                  )}
                </NavLink>
              </div>
            )}
          </div>

          {/* Finance */}
          <div>
            <button
              type="button"
              onClick={() => setIsFinanceOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Wallet size={11} />
                Tài chính
              </div>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isFinanceOpen ? '' : '-rotate-90'}`} />
            </button>
            {isFinanceOpen && (
              <div className="ml-1 mt-0.5 space-y-0.5">
                {[
                  { to: '/buyer/dashboard/finance/deposit',      icon: CreditCard, label: 'Nạp tiền' },
                  { to: '/buyer/dashboard/finance/transactions', icon: History,    label: 'Lịch sử giao dịch' },
                ].map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} onClick={onClose}
                    className={({ isActive }) =>
                      `${linkBase} ${isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={15} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-100 my-2 mx-1" />

          {/* Other */}
          {[
            { to: '/buyer/dashboard/referral', icon: Gift,       label: 'Giới thiệu bạn bè' },
            { to: '/buyer/dashboard/pricing',  icon: DollarSign, label: 'Bảng giá' },
            { to: '/buyer/dashboard/profile',  icon: UserCircle, label: 'Hồ sơ của tôi' },
            { to: '/buyer/dashboard/support',  icon: HelpCircle, label: 'Hỗ trợ' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={onClose}
              className={({ isActive }) =>
                `${linkBase} ${isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          {/* Tools */}
          <div className="pt-1">
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Công cụ</p>
            {[
              { to: '/buyer/dashboard/script', icon: Code2,    label: 'Script nút lấy mã' },
              { to: '/buyer/dashboard/api',    icon: Terminal, label: 'Buyer API' },
            ].map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} onClick={onClose}
                className={({ isActive }) =>
                  `${linkBase} ${isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={16} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 flex-shrink-0 border-t border-slate-100">
          <div className="px-3 py-2 rounded-lg bg-slate-50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Traffic68</p>
            <p className="text-[10px] text-slate-300">© 2025 · Nền tảng mua traffic SEO</p>
          </div>
        </div>
      </aside>
    </>
  );
}