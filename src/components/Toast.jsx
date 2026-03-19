import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: { bg: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-500', text: 'text-emerald-800' },
  error: { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', text: 'text-red-800' },
  warning: { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-500', text: 'text-amber-800' },
  info: { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-500', text: 'text-blue-800' },
};

function Toast({ toast, onRemove }) {
  const color = COLORS[toast.type] || COLORS.info;
  const Icon = ICONS[toast.type] || Info;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm
        ${color.bg} animate-slide-in-right min-w-[300px] max-w-[420px]`}
      style={{ animation: 'slideInRight 0.3s ease-out, fadeOut 0.3s ease-in forwards', animationDelay: `0s, ${(toast.duration || 3000) - 300}ms` }}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color.icon}`} />
      <div className="flex-1 min-w-0">
        {toast.title && <p className={`text-sm font-bold ${color.text}`}>{toast.title}</p>}
        <p className={`text-sm ${color.text} ${toast.title ? 'opacity-80' : 'font-medium'}`}>{toast.message}</p>
      </div>
      <button onClick={() => onRemove(toast.id)} className="shrink-0 text-gray-400 hover:text-gray-600 transition">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const removeToast = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', title, message, duration = 3500 }) => {
    const id = ++toastIdCounter;
    const toast = { id, type, title, message, duration };
    setToasts(prev => [...prev, toast]);
    timers.current[id] = setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  const toast = useCallback({
    success: (message, title) => addToast({ type: 'success', message, title }),
    error: (message, title) => addToast({ type: 'error', message, title }),
    warning: (message, title) => addToast({ type: 'warning', message, title }),
    info: (message, title) => addToast({ type: 'info', message, title }),
  }, [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
