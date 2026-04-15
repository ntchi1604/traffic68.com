import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import WorkerSidebar from './WorkerSidebar';
import api from '../lib/api';
import { Link2 } from 'lucide-react';

/** Decode JWT payload mà không cần thư viện — chỉ để kiểm tra local nhanh */
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function WorkerDashboardLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // ── Auth guard ──
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/dang-nhap');
      return;
    }

    // Decode JWT local ngay lập tức (không cần API) để kiểm tra hết hạn
    const payload = decodeJwtPayload(token);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/dang-nhap');
      return;
    }

    // Kiểm tra cached user trong localStorage — nếu có, render ngay
    const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
    if (cachedUser) {
      if (cachedUser.role !== 'admin' && cachedUser.service_type !== 'shortlink') {
        navigate('/buyer/dashboard');
        return;
      }
      setAuthChecked(true);
    }

    // Verify server ngầm (background) — không block UI
    api.get('/auth/me')
      .then((data) => {
        const user = data.user;
        localStorage.setItem('user', JSON.stringify(user));
        if (user.role !== 'admin' && user.service_type !== 'shortlink') {
          navigate('/buyer/dashboard');
          return;
        }
        setAuthChecked(true);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/dang-nhap');
      });
  }, [navigate]);

  // Always light mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Hide FAB on AllLinks page (already has create form there)
  const showFab = !pathname.includes('/links');

  return (
    <>
      {!authChecked ? (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="min-h-screen bg-slate-50 overflow-x-hidden">
          <WorkerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="lg:ml-64">
            <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

            <main className="p-4 sm:p-6">
              <Outlet />
            </main>
          </div>

          {/* Floating Action Button — Tạo Link */}
          {showFab && (
            <button
              onClick={() => navigate('/worker/dashboard/links')}
              className="fixed bottom-6 right-6 z-50 flex items-center gap-2
                         text-white font-bold text-sm px-5 py-3.5 rounded-full
                         shadow-lg hover:shadow-xl
                         hover:-translate-y-0.5 active:translate-y-0
                         transition-all duration-200 group"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}
            >
              <Link2 size={18} className="group-hover:rotate-45 transition-transform duration-300" />
              <span>Tạo Link</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
