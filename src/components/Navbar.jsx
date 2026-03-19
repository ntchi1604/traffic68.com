import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';

const links = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Dịch vụ',   to: '/dich-vu' },
  { label: 'Bảng giá',  to: '/bang-gia' },
  { label: 'FAQ',        to: '/faq' },
  { label: 'Blog',       to: '/blog' },
  { label: 'Liên hệ',   to: '/lien-he' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-gray-50 border-b border-gray-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 shrink-0">
          <img src="/traffic68_com.gif" alt="traffic68.com" className="h-14 sm:h-16 w-auto object-contain" />
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-8">
          {links.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `text-[13.5px] font-medium relative nav-link transition-colors duration-200 ${
                  isActive ? 'text-blue-700' : 'text-slate-600 hover:text-blue-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Desktop Auth + CTA */}
        <div className="hidden lg:flex items-center gap-1">
          <Link to="/dang-nhap" className="text-[13px] font-semibold text-slate-500 hover:text-blue-700 transition-colors px-2">
            Đăng nhập
          </Link>
          <span className="text-gray-300 text-sm">/</span>
          <Link to="/dang-ky" className="text-[13px] font-semibold text-slate-500 hover:text-blue-700 transition-colors px-2">
            Đăng ký
          </Link>
          <Link
            to="/dang-ky"
            id="nav-cta-btn"
            className="orange-btn text-white text-sm font-bold px-6 py-2 rounded-md shadow ml-3"
          >
            NHẬN TƯ VẤN NGAY
          </Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-gray-100 transition-colors">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="lg:hidden bg-white border-t border-gray-100 px-4 pb-5 pt-3 space-y-1">
          {links.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between py-2.5 px-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:text-blue-700 hover:bg-gray-50'
                }`
              }
            >
              {label}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </NavLink>
          ))}
          <div className="pt-3 space-y-2 border-t border-gray-100 mt-2">
            <div className="flex gap-3">
              <Link to="/dang-nhap" onClick={() => setOpen(false)} className="flex-1 text-center text-sm font-medium text-slate-600 border border-gray-200 py-2.5 rounded-xl hover:border-orange-400 transition-colors">Đăng nhập</Link>
              <Link to="/dang-ky" onClick={() => setOpen(false)} className="flex-1 text-center text-sm font-medium text-slate-600 border border-gray-200 py-2.5 rounded-xl hover:border-orange-400 transition-colors">Đăng ký</Link>
            </div>
            <Link to="/dang-ky" onClick={() => setOpen(false)} className="block orange-btn text-white text-sm font-bold px-5 py-3 rounded-xl text-center shadow-md">
              NHẬN TƯ VẤN NGAY
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
