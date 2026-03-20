import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Link2,
  BarChart3,
  Wallet,
  UserCircle,
  ChevronDown,
  X,
  Code2,
  List,
  EyeOff,
  TrendingUp,
  CreditCard,
  History,
  HelpCircle,
  DollarSign,
} from 'lucide-react';

const linkBase =
  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors';

export default function WorkerSidebar({ isOpen, onClose }) {
  const [isLinksOpen, setIsLinksOpen] = useState(true);
  const [isEarningsOpen, setIsEarningsOpen] = useState(true);
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

        <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 90px)' }}>
          <NavLink
            to="/worker/dashboard"
            end
            className={({ isActive }) =>
              `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            Tổng quan
          </NavLink>

          {/* ── Quản lý liên kết ── */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setIsLinksOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
            >
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Quản lý liên kết
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isLinksOpen ? '' : '-rotate-90'}`} />
            </button>
            {isLinksOpen && (
              <div className="ml-2 space-y-1">
                <NavLink to="/worker/dashboard/links"
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
                  <List className="w-4 h-4" />
                  Tất cả liên kết
                </NavLink>
                <NavLink to="/worker/dashboard/links/hidden"
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
                  <EyeOff className="w-4 h-4" />
                  Liên kết ẩn
                </NavLink>
              </div>
            )}
          </div>

          {/* ── Thống kê thu nhập ── */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setIsEarningsOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Thống kê thu nhập
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isEarningsOpen ? '' : '-rotate-90'}`} />
            </button>
            {isEarningsOpen && (
              <div className="ml-2 space-y-1">
                <NavLink to="/worker/dashboard/earnings"
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
                  <TrendingUp className="w-4 h-4" />
                  Thu nhập theo ngày
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
                <NavLink to="/worker/dashboard/withdraw"
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
                  <CreditCard className="w-4 h-4" />
                  Rút tiền
                </NavLink>
                <NavLink to="/worker/dashboard/transactions"
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
                  <History className="w-4 h-4" />
                  Lịch sử giao dịch
                </NavLink>
              </div>
            )}
          </div>

          {/* ── Bottom ── */}
          <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
            <NavLink to="/worker/dashboard/pricing"
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
              <DollarSign className="w-5 h-5" />
              Bảng giá
            </NavLink>
            <NavLink to="/worker/dashboard/profile"
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
              <UserCircle className="w-5 h-5" />
              Hồ sơ của tôi
            </NavLink>
            <NavLink to="/worker/dashboard/support"
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
              <HelpCircle className="w-5 h-5" />
              Hỗ trợ
            </NavLink>
          </div>

          {/* ── Công cụ ── */}
          <div className="mt-2">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Công cụ</p>
            <NavLink to="/worker/dashboard/api"
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`}>
              <Code2 className="w-5 h-5" />
              API
            </NavLink>
          </div>
        </nav>
      </aside>
    </>
  );
}
