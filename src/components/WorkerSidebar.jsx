import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Link2, BarChart3, Wallet, UserCircle,
  ChevronDown, X, Code2, List, EyeOff, TrendingUp,
  CreditCard, History, HelpCircle, DollarSign, Gift,
} from 'lucide-react';

const linkBase = 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150';

export default function WorkerSidebar({ isOpen, onClose }) {
  const [isLinksOpen, setIsLinksOpen] = useState(true);
  const [isEarningsOpen, setIsEarningsOpen] = useState(true);
  const [isFinanceOpen, setIsFinanceOpen] = useState(true);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
        style={{
          background: 'linear-gradient(180deg, #f8faff 0%, #f1f5f9 100%)',
          borderRight: '1px solid #e2e8f0',
          boxShadow: '2px 0 12px 0 rgba(99,102,241,0.06)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center px-5 py-5 relative flex-shrink-0 border-b border-slate-100">
          <img src="/traffic68_com.gif" alt="Traffic68" className="h-14 sm:h-16 w-auto mx-auto" />
          <button onClick={onClose} className="lg:hidden p-2 rounded-lg absolute right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {/* Dashboard */}
          <NavLink to="/worker/dashboard" end onClick={onClose}
            className={({ isActive }) => `${linkBase} ${isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            {({ isActive }) => (<><LayoutDashboard size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} /> Tổng quan</>)}
          </NavLink>

          <div className="h-px bg-slate-100 my-2 mx-1" />

          {/* ── Quản lý liên kết ── */}
          <div>
            <button type="button" onClick={() => setIsLinksOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
              <div className="flex items-center gap-2"><Link2 size={11} /> Quản lý liên kết</div>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isLinksOpen ? '' : '-rotate-90'}`} />
            </button>
            {isLinksOpen && (
              <div className="ml-1 mt-0.5 space-y-0.5">
                {[
                  { to: '/worker/dashboard/links', icon: List, label: 'Tất cả liên kết', end: true },
                  { to: '/worker/dashboard/links/hidden', icon: EyeOff, label: 'Liên kết ẩn' },
                ].map(({ to, icon: Icon, label, end }) => (
                  <NavLink key={to} to={to} end={end} onClick={onClose}
                    className={({ isActive }) => `${linkBase} ${isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                    {({ isActive }) => (<><Icon size={15} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />{label}</>)}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* ── Thống kê thu nhập ── */}
          <div>
            <button type="button" onClick={() => setIsEarningsOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
              <div className="flex items-center gap-2"><BarChart3 size={11} /> Thống kê thu nhập</div>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isEarningsOpen ? '' : '-rotate-90'}`} />
            </button>
            {isEarningsOpen && (
              <div className="ml-1 mt-0.5 space-y-0.5">
                <NavLink to="/worker/dashboard/earnings" onClick={onClose}
                  className={({ isActive }) => `${linkBase} ${isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                  {({ isActive }) => (<><TrendingUp size={15} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />Thu nhập theo ngày</>)}
                </NavLink>
              </div>
            )}
          </div>

          {/* ── Tài chính ── */}
          <div>
            <button type="button" onClick={() => setIsFinanceOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
              <div className="flex items-center gap-2"><Wallet size={11} /> Tài chính</div>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isFinanceOpen ? '' : '-rotate-90'}`} />
            </button>
            {isFinanceOpen && (
              <div className="ml-1 mt-0.5 space-y-0.5">
                {[
                  { to: '/worker/dashboard/withdraw', icon: CreditCard, label: 'Rút tiền' },
                  { to: '/worker/dashboard/transactions', icon: History, label: 'Lịch sử giao dịch' },
                ].map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} onClick={onClose}
                    className={({ isActive }) => `${linkBase} ${isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                    {({ isActive }) => (<><Icon size={15} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />{label}</>)}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-100 my-2 mx-1" />

          {/* Other */}
          {[
            { to: '/worker/dashboard/referral', icon: Gift, label: 'Giới thiệu bạn bè' },
            { to: '/worker/dashboard/pricing', icon: DollarSign, label: 'Bảng giá' },
            { to: '/worker/dashboard/profile', icon: UserCircle, label: 'Hồ sơ của tôi' },
            { to: '/worker/dashboard/support', icon: HelpCircle, label: 'Hỗ trợ' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={onClose}
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              {({ isActive }) => (<><Icon size={16} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />{label}</>)}
            </NavLink>
          ))}

          {/* Tools */}
          <div className="pt-1">
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Công cụ</p>
            <NavLink to="/worker/dashboard/api" onClick={onClose}
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              {({ isActive }) => (<><Code2 size={16} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />API</>)}
            </NavLink>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 flex-shrink-0 border-t border-slate-100">
          <div className="px-3 py-2 rounded-lg bg-slate-50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Traffic68</p>
            <p className="text-[10px] text-slate-300">© 2025 · Nền tảng kiếm tiền online</p>
          </div>
        </div>
      </aside>
    </>
  );
}
