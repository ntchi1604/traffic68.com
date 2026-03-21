import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import WorkerSidebar from './WorkerSidebar';
import api from '../lib/api';
import { Link2 } from 'lucide-react';

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
    api.get('/auth/me')
      .then((data) => {
        const user = data.user;
        // Only shortlink workers and admins can access worker dashboard
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
                         bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
                         text-white font-bold text-sm px-5 py-3.5 rounded-full
                         shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40
                         hover:-translate-y-0.5 active:translate-y-0
                         transition-all duration-200 group"
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
