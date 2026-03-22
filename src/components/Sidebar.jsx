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
} from 'lucide-react';

const linkBase =
  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors';

export default function Sidebar({ isOpen, onClose }) {
  const [isCampaignOpen, setIsCampaignOpen] = useState(true);
  const [isReportOpen, setIsReportOpen] = useState(true);
  const [isFinanceOpen, setIsFinanceOpen] = useState(true);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-slate-900 text-slate-300 z-50 transform transition-transform lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-center px-5 py-5 border-b border-slate-800 relative">
          <div className="flex items-center justify-center w-full">
            <img
              src="/traffic68_com.gif"
              alt="Traffic68"
              className="h-14 sm:h-16 w-auto mx-auto"
            />
          </div>
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-slate-800 rounded-lg absolute right-4">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          <NavLink
            to="/buyer/dashboard"
            end
            className={({ isActive }) =>
              `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            Tổng quan
          </NavLink>

          {/* ── Chiến dịch ── */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setIsCampaignOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
            >
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4" />
                Quản lý Chiến dịch
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isCampaignOpen ? '' : '-rotate-90'}`} />
            </button>
            {isCampaignOpen && (
              <div className="ml-2 space-y-1">
                <NavLink to="/buyer/dashboard/campaigns/create"
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
                  <PlusCircle className="w-4 h-4" />
                  Tạo Chiến dịch
                </NavLink>
                <NavLink to="/buyer/dashboard/campaigns" end
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
                  <List className="w-4 h-4" />
                  Xem Chiến dịch
                </NavLink>
              </div>
            )}
          </div>

          {/* ── Báo cáo ── */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setIsReportOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Báo cáo
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isReportOpen ? '' : '-rotate-90'}`} />
            </button>
            {isReportOpen && (
              <div className="ml-2 space-y-1">
                <NavLink to="/buyer/dashboard/reports"
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
                  <TrendingUp className="w-4 h-4" />
                  Theo dõi Traffic
                </NavLink>
              </div>
            )}
          </div>

          {/* ── Tài chính ── */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setIsFinanceOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Tài chính
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isFinanceOpen ? '' : '-rotate-90'}`} />
            </button>
            {isFinanceOpen && (
              <div className="ml-2 space-y-1">
                <NavLink to="/buyer/dashboard/finance/deposit"
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
                  <CreditCard className="w-4 h-4" />
                  Nạp tiền
                </NavLink>
                <NavLink to="/buyer/dashboard/finance/transactions"
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
                  <History className="w-4 h-4" />
                  Lịch sử giao dịch
                </NavLink>
              </div>
            )}
          </div>

          {/* ── Bottom ── */}
          <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
            <NavLink to="/buyer/dashboard/referral"
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
              <Gift className="w-5 h-5" />
              Giới thiệu bạn bè
            </NavLink>
            <NavLink to="/buyer/dashboard/pricing"
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
              <DollarSign className="w-5 h-5" />
              Bảng giá
            </NavLink>
            <NavLink to="/buyer/dashboard/profile"
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
              <UserCircle className="w-5 h-5" />
              Hồ sơ của tôi
            </NavLink>
            <NavLink to="/buyer/dashboard/support"
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
              <HelpCircle className="w-5 h-5" />
              Hỗ trợ
            </NavLink>
          </div>

          {/* ── Công cụ ── */}
          <div className="mt-2">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Công cụ</p>
            <NavLink to="/buyer/dashboard/script"
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
              <Code2 className="w-5 h-5" />
              Script Nút Lấy Mã
            </NavLink>
          </div>
        </nav>
      </aside>
    </>
  );
}