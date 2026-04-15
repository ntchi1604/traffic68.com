import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import Sidebar from './Sidebar';
import { WalletProvider } from '../context/WalletContext';
import api from '../lib/api';

/** Decode JWT payload mà không cần thư viện — chỉ để kiểm tra local nhanh */
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function DashboardLayout() {
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
      if (cachedUser.role !== 'admin' && cachedUser.service_type === 'shortlink') {
        navigate('/worker/dashboard');
        return;
      }
      setAuthChecked(true);
    }

    // Verify server ngầm (background) — không block UI
    api.get('/auth/me')
      .then((data) => {
        const user = data.user;
        localStorage.setItem('user', JSON.stringify(user));
        if (user.role !== 'admin' && user.service_type === 'shortlink') {
          navigate('/worker/dashboard');
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
    <WalletProvider>
      {!authChecked ? (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="min-h-screen overflow-x-hidden" style={{ background: '#f5f7ff' }}>
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="lg:ml-64">
            <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

            <main className="p-4 sm:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      )}
    </WalletProvider>
  );
}
