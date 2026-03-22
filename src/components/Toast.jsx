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

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Xác nhận</h3>
            <p className="text-sm text-slate-600 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">
            Hủy
          </button>
          <button onClick={onConfirm}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
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

  const confirmFn = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmState({
        message,
        onConfirm: () => { setConfirmState(null); resolve(true); },
        onCancel: () => { setConfirmState(null); resolve(false); },
      });
    });
  }, []);

  const toast = useCallback({
    success: (message, title) => addToast({ type: 'success', message, title }),
    error: (message, title) => addToast({ type: 'error', message, title }),
    warning: (message, title) => addToast({ type: 'warning', message, title }),
    info: (message, title) => addToast({ type: 'info', message, title }),
    confirm: confirmFn,
  }, [addToast, confirmFn]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Confirm dialog */}
      {confirmState && <ConfirmDialog {...confirmState} />}
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
