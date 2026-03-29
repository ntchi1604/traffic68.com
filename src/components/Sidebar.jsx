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

const activeStyle = {
  background: 'linear-gradient(90deg, rgba(99,102,241,0.20) 0%, rgba(99,102,241,0.05) 100%)',
  borderLeft: '2px solid #6366f1',
  color: '#a5b4fc',
};

function SideLink({ to, icon: Icon, children, end = false, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative group"
      style={({ isActive }) =>
        isActive
          ? activeStyle
          : { color: '#64748b' }
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={15}
            className="flex-shrink-0 transition-colors"
            style={{ color: isActive ? '#818cf8' : '#475569' }}
          />
          <span
            style={{ color: isActive ? '#c7d2fe' : '#94a3b8' }}
            className="transition-colors group-hover:text-slate-200"
          >
            {children}
          </span>
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ children, icon: Icon, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors group"
      style={{ color: '#334155' }}
    >
      <div className="flex items-center gap-2">
        <Icon size={12} style={{ color: '#334155' }} />
        <span className="group-hover:text-slate-400 transition-colors">{children}</span>
      </div>
      <ChevronDown
        size={12}
        style={{ color: '#334155' }}
        className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
      />
    </button>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const [isCampaignOpen, setIsCampaignOpen] = useState(true);
  const [isReportOpen,   setIsReportOpen]   = useState(true);
  const [isFinanceOpen,  setIsFinanceOpen]  = useState(true);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
        style={{
          background: 'linear-gradient(180deg, #0d1520 0%, #111827 100%)',
          borderRight: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center px-5 py-5 relative flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Glow behind logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full blur-2xl opacity-20"
              style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
          </div>
          <img
            src="/traffic68_com.gif"
            alt="Traffic68"
            className="h-14 sm:h-16 w-auto mx-auto relative z-10"
          />
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg absolute right-4 transition-colors"
            style={{ color: '#475569' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5 scrollbar-thin">

          {/* Dashboard */}
          <div className="mb-2">
            <SideLink to="/buyer/dashboard" end icon={LayoutDashboard} onClick={onClose}>
              Tổng quan
            </SideLink>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 12px' }} />

          {/* Campaigns */}
          <div className="pt-1">
            <SectionLabel icon={Megaphone} open={isCampaignOpen} onToggle={() => setIsCampaignOpen(p => !p)}>
              Chiến dịch
            </SectionLabel>
            {isCampaignOpen && (
              <div className="ml-1 mt-0.5 space-y-0.5">
                <SideLink to="/buyer/dashboard/campaigns/create" icon={PlusCircle} onClick={onClose}>
                  Tạo chiến dịch
                </SideLink>
                <SideLink to="/buyer/dashboard/campaigns" end icon={List} onClick={onClose}>
                  Quản lý chiến dịch
                </SideLink>
              </div>
            )}
          </div>

          {/* Reports */}
          <div className="pt-1">
            <SectionLabel icon={BarChart3} open={isReportOpen} onToggle={() => setIsReportOpen(p => !p)}>
              Báo cáo & Thống kê
            </SectionLabel>
            {isReportOpen && (
              <div className="ml-1 mt-0.5 space-y-0.5">
                <SideLink to="/buyer/dashboard/reports" icon={TrendingUp} onClick={onClose}>
                  Theo dõi traffic
                </SideLink>
              </div>
            )}
          </div>

          {/* Finance */}
          <div className="pt-1">
            <SectionLabel icon={Wallet} open={isFinanceOpen} onToggle={() => setIsFinanceOpen(p => !p)}>
              Tài chính
            </SectionLabel>
            {isFinanceOpen && (
              <div className="ml-1 mt-0.5 space-y-0.5">
                <SideLink to="/buyer/dashboard/finance/deposit" icon={CreditCard} onClick={onClose}>
                  Nạp tiền
                </SideLink>
                <SideLink to="/buyer/dashboard/finance/transactions" icon={History} onClick={onClose}>
                  Lịch sử giao dịch
                </SideLink>
              </div>
            )}
          </div>

          {/* Separator */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '8px 12px' }} />

          {/* Other */}
          <div className="space-y-0.5">
            <SideLink to="/buyer/dashboard/referral" icon={Gift} onClick={onClose}>
              Giới thiệu bạn bè
            </SideLink>
            <SideLink to="/buyer/dashboard/pricing" icon={DollarSign} onClick={onClose}>
              Bảng giá
            </SideLink>
            <SideLink to="/buyer/dashboard/profile" icon={UserCircle} onClick={onClose}>
              Hồ sơ của tôi
            </SideLink>
            <SideLink to="/buyer/dashboard/support" icon={HelpCircle} onClick={onClose}>
              Hỗ trợ
            </SideLink>
          </div>

          {/* Tools */}
          <div className="pt-1">
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#1e293b' }}>
              Công cụ
            </p>
            <div className="space-y-0.5">
              <SideLink to="/buyer/dashboard/script" icon={Code2} onClick={onClose}>
                Script nút lấy mã
              </SideLink>
              <SideLink to="/buyer/dashboard/api" icon={Terminal} onClick={onClose}>
                Buyer API
              </SideLink>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.06)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#334155' }}>Traffic68</p>
            <p className="text-[10px]" style={{ color: '#1e293b' }}>© 2025 · Nền tảng mua traffic SEO</p>
          </div>
        </div>
      </aside>
    </>
  );
}