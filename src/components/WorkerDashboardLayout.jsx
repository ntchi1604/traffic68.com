import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import WorkerSidebar from './WorkerSidebar';
import api from '../lib/api';

export default function WorkerDashboardLayout() {
  const navigate = useNavigate();
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
        </div>
      )}
    </>
  );
}
