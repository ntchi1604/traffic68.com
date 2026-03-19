import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import Sidebar from './Sidebar';
import { WalletProvider } from '../context/WalletContext';
import { Settings, Sun, Moon, Monitor } from 'lucide-react';

const THEMES = [
  { id: 'light', label: 'Sáng', Icon: Sun },
  { id: 'dark', label: 'Tối', Icon: Moon },
  { id: 'system', label: 'Hệ thống', Icon: Monitor },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');
  const popRef = useRef(null);

  // Apply theme
  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.remove('dark');
    }
    // Cleanup: remove dark class when leaving dashboard
    return () => root.classList.remove('dark');
  }, [theme]);

  // Close popup on outside click
  useEffect(() => {
    function handleClick(e) {
      if (popRef.current && !popRef.current.contains(e.target)) {
        setThemeOpen(false);
      }
    }
    if (themeOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [themeOpen]);

  return (
    <WalletProvider>
      <div className="min-h-screen bg-slate-50 overflow-x-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:ml-64">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-4 sm:p-6">
            <Outlet />
          </main>
        </div>

        {/* ── Floating Settings Button ── */}
        <div ref={popRef} className="fixed bottom-6 right-6 z-50">
          {themeOpen && (
            <div className="absolute bottom-14 right-0 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700
                            p-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
              <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-3 py-1.5">Giao diện</p>
              {THEMES.map(t => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setThemeOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
                                ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <t.Icon size={16} className={active ? 'text-blue-500' : 'text-gray-400 dark:text-slate-500'} />
                    {t.label}
                    {active && <span className="ml-auto text-blue-500 text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setThemeOpen(p => !p)}
            className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all
                        hover:scale-110 active:scale-95
                        ${themeOpen
                ? 'bg-blue-600 text-white shadow-blue-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:shadow-xl'}`}
          >
            <Settings size={20} className={themeOpen ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
          </button>
        </div>
      </div>
    </WalletProvider>
  );
}
