import { useState, useEffect, useRef, useMemo } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import {
  Copy, Check, RefreshCw, Play,
  Code2, Sliders, Info,
  Pin, MessageSquare,
  Crosshair, Settings2,
  Plus, Trash2, Globe,
} from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';

/* ────────────────────────────────────────────────────────── */
/*  Static data                                               */
/* ────────────────────────────────────────────────────────── */

const THEMES = [
  { id: 'default', label: 'Default', desc: 'Sáng, tối giản', preview: { modal: '#fff', text: '#0f172a', accent: '#f97316', ring: '#f1f5f9' } },
  { id: 'dark', label: 'Dark', desc: 'Tối, chuyên nghiệp', preview: { modal: '#0f172a', text: '#f1f5f9', accent: '#f97316', ring: '#1e293b' } },
  { id: 'minimal', label: 'Minimal', desc: 'Viền đen, thuần khiết', preview: { modal: '#fff', text: '#111827', accent: '#111827', ring: '#e5e7eb' } },
  { id: 'glass', label: 'Glass', desc: 'Glassmorphism', preview: { modal: 'rgba(255,255,255,0.15)', text: '#fff', accent: '#fff', ring: 'rgba(255,255,255,0.15)' }, dark: true },
];

const INSERT_MODES = [
  { id: 'before', label: 'Trước', arrow: '↑', desc: 'Chèn nút phía trên phần tử' },
  { id: 'after', label: 'Sau', arrow: '↓', desc: 'Chèn nút phía dưới phần tử' },
  { id: 'prepend', label: 'Đầu', arrow: '↱', desc: 'Chèn nút đầu tiên bên trong phần tử' },
  { id: 'append', label: 'Cuối', arrow: '↳', desc: 'Chèn nút cuối cùng bên trong phần tử' },
];

const ALIGNS = [
  { id: 'top-left', label: 'Trái', arrow: '←' },
  { id: 'center', label: 'Giữa', arrow: '·' },
  { id: 'top-right', label: 'Phải', arrow: '→' },
];

const DEFAULT_CFG = {
  /* Vị trí chèn */
  insertTarget: '.footer',
  insertMode: 'after',
  insertId: 'API_SEO_TRAFFIC68',
  insertStyle: '',
  align: 'center',
  padX: 0,
  padY: 12,
  /* Button */
  buttonText: 'Lấy Mã',
  buttonColor: '#e53935',
  textColor: '#ffffff',
  borderRadius: 20,
  fontSize: 13,
  shadow: true,
  icon: '🎁',
  iconUrl: '',
  iconBg: '#ffffff',
  iconSize: 20,
  /* Popup */
  theme: 'default',
  waitTime: 30,
  title: 'Mã của bạn! 🎉',
  message: 'Sao chép mã bên dưới để sử dụng.',
  countdownText: 'Vui lòng chờ {s} giây...',
  successText: 'Nhấn để sao chép!',
  brandName: 'Traffic68',
  brandUrl: 'https://traffic68.com',
  brandLogo: '',
  customCSS: '',
};

/* 4 tabs — no duplication */
const TABS = [
  { key: 'button', label: 'Nút', Icon: Sliders },
  { key: 'position', label: 'Nhúng', Icon: Pin },
  { key: 'popup', label: 'Popup', Icon: MessageSquare },
  { key: 'embed', label: 'Embed', Icon: Code2 },
];

/* ────────────────────────────────────────────────────────── */
/*  Helpers                                                   */
/* ────────────────────────────────────────────────────────── */
function fmt(str, secs) { return str.replace('{s}', secs); }

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); };
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition">
      {done ? <><Check size={12} />Đã chép!</> : <><Copy size={12} />Sao chép</>}
    </button>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Live preview                                              */
/* ────────────────────────────────────────────────────────── */
const ALIGN_FLEX = {
  'top-left': 'flex-start', 'bottom-left': 'flex-start',
  'top-right': 'flex-end', 'bottom-right': 'flex-end',
  'center': 'center',
};

function LivePreview({ cfg, countdown, revealed }) {
  const theme = THEMES.find(t => t.id === cfg.theme) || THEMES[0];
  const p = theme.preview;

  const btnStyle = {
    backgroundColor: cfg.buttonColor,
    color: cfg.textColor,
    borderRadius: cfg.borderRadius,
    fontSize: Math.min(cfg.fontSize, 13),
    boxShadow: cfg.shadow ? '0 4px 16px rgba(0,0,0,0.28)' : 'none',
    fontWeight: 700,
  };
  const wrapJustify = ALIGN_FLEX[cfg.align] || ALIGN_FLEX['center'] || 'center';

  const effectiveIconUrl = cfg.iconUrl || 'https://traffic68.com/lg.png';
  const iconEl = (
    <img src={effectiveIconUrl} width={cfg.iconSize} height={cfg.iconSize} alt=""
      className="object-contain flex-shrink-0"
      style={{ background: cfg.iconBg, borderRadius: 6, padding: 2 }}
      onError={e => { e.target.style.display = 'none'; }} />
  );

  const btn = (
    <div className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:scale-105 transition-transform" style={btnStyle}>
      {iconEl}
      <span>{cfg.buttonText}</span>
      {!revealed && (
        <span className="text-xs font-black px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.28)', minWidth: 24, textAlign: 'center' }}>
          {countdown}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Page mock */}
      <div className={`relative w-full rounded-2xl overflow-hidden border border-gray-200 select-none
                       ${theme.dark ? 'bg-gradient-to-br from-slate-700 to-slate-900' : 'bg-gradient-to-br from-white to-slate-100'}`}
        style={{ height: 280 }}>
        {/* Fake browser bar */}
        <div className={`flex items-center gap-1.5 px-3 py-2 border-b ${theme.dark ? 'bg-slate-800 border-slate-600' : 'bg-gray-100 border-gray-200'}`}>
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <div className={`flex-1 mx-3 h-5 rounded-md text-center text-[9px] leading-5 font-medium
                          ${theme.dark ? 'bg-slate-700 text-white/40' : 'bg-white text-gray-400 border border-gray-200'}`}>
            example.com
          </div>
        </div>
        {/* Content skeleton */}
        <div className="p-5 space-y-2">
          <div className={`h-4 rounded-md ${theme.dark ? 'bg-white/10' : 'bg-slate-200'}`} style={{ width: '65%' }} />
          <div className={`h-3 rounded ${theme.dark ? 'bg-white/5' : 'bg-slate-100'}`} style={{ width: '90%' }} />
          <div className={`h-3 rounded ${theme.dark ? 'bg-white/5' : 'bg-slate-100'}`} style={{ width: '75%' }} />
          <div className="h-1" />
          <div className={`h-3 rounded ${theme.dark ? 'bg-white/5' : 'bg-slate-100'}`} style={{ width: '60%' }} />
          <div className={`h-3 rounded ${theme.dark ? 'bg-white/5' : 'bg-slate-100'}`} style={{ width: '85%' }} />
          <div className={`h-3 rounded ${theme.dark ? 'bg-white/5' : 'bg-slate-100'}`} style={{ width: '50%' }} />
        </div>

        <div className="absolute bottom-0 left-0 right-0"
          style={{
            background: theme.dark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
            borderTop: '2px dashed',
            borderColor: theme.dark ? 'rgba(129,140,248,0.5)' : 'rgba(99,102,241,0.4)',
          }}>
          <div className="flex items-center justify-center gap-1.5 py-1">
            <Pin size={9} className={theme.dark ? 'text-indigo-300' : 'text-indigo-500'} />
            <p className="text-[9px] font-bold tracking-wide"
              style={{ color: theme.dark ? '#a5b4fc' : '#6366f1' }}>{cfg.insertTarget || '.footer'}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: wrapJustify, padding: `${cfg.padY || 0}px ${cfg.padX || 0}px` }}>
            {btn}
          </div>
        </div>
      </div>

      {/* Popup mock */}
      <div className={`rounded-2xl p-4 border text-center ${theme.dark ? 'border-white/10' : 'border-gray-200'}`}
        style={{
          background: p.modal, boxShadow: cfg.theme === 'glass' ? '0 8px 32px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.07)',
          backdropFilter: cfg.theme === 'glass' ? 'blur(20px)' : undefined
        }}>
        <p className="text-[9px] font-medium mb-2" style={{ color: theme.dark || cfg.theme === 'glass' ? 'rgba(255,255,255,0.4)' : '#94a3b8' }}>— Popup —</p>
        <div className="relative w-12 h-12 mx-auto mb-2">
          <svg className="-rotate-90" width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="18" fill="none" stroke={p.ring} strokeWidth="4" />
            <circle cx="24" cy="24" r="18" fill="none"
              stroke={cfg.theme === 'minimal' ? p.accent : cfg.buttonColor} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 18}
              strokeDashoffset={revealed ? 0 : 2 * Math.PI * 18 * (countdown / cfg.waitTime)}
              style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-sm font-black" style={{ color: p.text }}>
            {revealed ? '✓' : countdown}
          </div>
        </div>
        <p className="font-bold text-xs mb-1" style={{ color: p.text }}>{revealed ? cfg.title : 'Vui lòng chờ...'}</p>
        <p className="text-[10px] mb-2" style={{ color: theme.dark || cfg.theme === 'glass' ? 'rgba(255,255,255,0.55)' : '#64748b' }}>
          {revealed ? cfg.message : fmt(cfg.countdownText, countdown)}
        </p>
        {revealed ? (
          <div className="flex items-stretch rounded-lg overflow-hidden border text-left"
            style={{ borderColor: cfg.theme === 'minimal' ? '#111827' : cfg.theme === 'dark' ? '#334155' : cfg.theme === 'glass' ? 'rgba(255,255,255,0.3)' : '#e2e8f0' }}>
            <div className="flex-1 px-2.5 py-2 text-xs font-black font-mono" style={{ background: p.ring, color: p.text }}>AB3X9K</div>
            <div className="px-2.5 py-2 text-[10px] font-bold flex items-center" style={{ background: p.accent, color: cfg.theme === 'glass' ? '#0f172a' : '#fff' }}>COPY</div>
          </div>
        ) : (
          <div className="rounded-lg px-3 py-2 text-[10px] font-medium" style={{ background: p.ring, color: theme.dark || cfg.theme === 'glass' ? 'rgba(255,255,255,0.6)' : '#64748b' }}>
            {fmt(cfg.countdownText, countdown)}
          </div>
        )}
        {cfg.brandName && <p className="text-[9px] mt-2 opacity-40" style={{ color: p.text }}>Powered by {cfg.brandName}</p>}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  UI primitives                                             */
/* ────────────────────────────────────────────────────────── */
function Label({ children }) {
  return <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">{children}</p>;
}
function Field({ label, hint, children }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
function TextInput({ value, onChange, placeholder, mono }) {
  return (
    <input type="text" value={value} onChange={onChange} placeholder={placeholder}
      className={`w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white
                  ${mono ? 'font-mono' : ''}`} />
  );
}
function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
        onClick={() => onChange(!checked)}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </div>
      <span className="text-sm text-gray-700 font-medium">{label}</span>
    </label>
  );
}
function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{children}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Main page                                                 */
/* ────────────────────────────────────────────────────────── */
export default function ScriptGenerator() {
  usePageTitle('Tạo Script');
  const toast = useToast();
  const navigate = useNavigate();

  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [tab, setTab] = useState('button');
  const [countdown, setCountdown] = useState(DEFAULT_CFG.waitTime);
  const [revealed, setRevealed] = useState(false);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  // Multi-widget state
  const [widgets, setWidgets] = useState([]);           // all widgets from API
  const [activeWidgetId, setActiveWidgetId] = useState(null); // currently selected widget id
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  // Compute active widget from list
  const activeWidget = widgets.find(w => w.id === activeWidgetId);
  const token = activeWidget?.token || '';

  useEffect(() => {
    setCountdown(cfg.waitTime); setRevealed(false);
    setRunning(false); clearInterval(timerRef.current);
  }, [cfg.waitTime]);

  const startPreview = () => {
    clearInterval(timerRef.current);
    let rem = cfg.waitTime;
    setCountdown(rem); setRevealed(false); setRunning(true);
    timerRef.current = setInterval(() => {
      rem -= 1; setCountdown(rem);
      if (rem <= 0) { clearInterval(timerRef.current); setRevealed(true); setRunning(false); }
    }, 1000);
  };

  // Load all widgets on mount
  useEffect(() => {
    (async () => {
      try {
        const api = (await import('../../lib/api')).default;
        const data = await api.get('/widgets/my');
        const list = data?.widgets || [];
        setWidgets(list);
        if (list.length > 0) {
          setActiveWidgetId(list[0].id);
          setCfg(c => ({ ...c, ...list[0].config }));
        }
      } catch { /* not logged in */ }
      setLoading(false);
    })();
  }, []);

  // When switching active widget, load its config
  const selectWidget = (id) => {
    const w = widgets.find(w => w.id === id);
    if (w) {
      setActiveWidgetId(id);
      setCfg(c => ({ ...DEFAULT_CFG, ...w.config }));
    }
  };

  // Create new widget
  const createWidget = async () => {
    if (!newWebsiteUrl.trim()) {
      toast.error('Vui lòng nhập URL website trước.');
      return;
    }
    setCreating(true);
    try {
      const api = (await import('../../lib/api')).default;
      // Extract domain for widget name
      let domain = newWebsiteUrl.trim();
      try { domain = new URL(domain.startsWith('http') ? domain : 'https://' + domain).hostname; } catch { }
      const data = await api.post('/widgets', {
        name: domain,
        website_url: newWebsiteUrl.trim(),
        config: DEFAULT_CFG,
      });
      const newW = data.widget;
      const entry = { id: newW.id, token: newW.token, name: newW.name, website_url: newW.website_url || newWebsiteUrl.trim(), config: newW.config, is_active: newW.is_active };
      setWidgets(prev => [...prev, entry]);
      setActiveWidgetId(newW.id);
      setCfg({ ...DEFAULT_CFG, ...newW.config });
      setShowNewForm(false);
      setNewWebsiteUrl('');
      toast.success('Đã tạo widget mới!');
    } catch (err) {
      toast.error(err.message || 'Lỗi tạo widget');
    }
    setCreating(false);
  };

  // Save current widget config
  const saveWidget = async () => {
    if (!activeWidgetId) {
      // Auto-create
      return createWidget();
    }
    setSaving(true);
    try {
      const api = (await import('../../lib/api')).default;
      const data = await api.put(`/widgets/${activeWidgetId}`, {
        name: cfg.buttonText || 'Nút mặc định',
        config: cfg,
      });
      const updated = data.widget;
      setWidgets(prev => prev.map(w => w.id === activeWidgetId ? { ...w, name: updated.name, config: updated.config, token: updated.token } : w));
      toast.success('Đã lưu script thành công!', 'Lưu thành công');
    } catch (err) {
      toast.error(err.message || 'Lỗi lưu widget');
    } finally {
      setSaving(false);
    }
  };

  // Delete widget
  const deleteWidget = async (id) => {
    if (!confirm('Xoá widget này? Mã nhúng sẽ ngừng hoạt động.')) return;
    setDeleting(id);
    try {
      const api = (await import('../../lib/api')).default;
      await api.delete(`/widgets/${id}`);
      setWidgets(prev => prev.filter(w => w.id !== id));
      if (activeWidgetId === id) {
        const remaining = widgets.filter(w => w.id !== id);
        if (remaining.length > 0) {
          selectWidget(remaining[0].id);
        } else {
          setActiveWidgetId(null);
          setCfg(DEFAULT_CFG);
        }
      }
      toast.success('Đã xoá widget');
    } catch (err) {
      toast.error(err.message || 'Lỗi xoá');
    }
    setDeleting(null);
  };

  /* Embed code — token-based (secure) */
  const embedCode = useMemo(() => {
    if (!token) return '// Nhấn "Lưu Script" hoặc tạo mới để lấy mã nhúng';
    return [
      `<script src="${window.location.origin}/api_seo_traffic68.js" data-token="${token}" async><\/script>`,
    ].join('\n');
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/buyer/dashboard' },
        { label: 'Script Nút Lấy Mã' },
      ]} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Script Nút Lấy Mã</h1>
          <p className="text-sm text-gray-500 mt-1">Mỗi website cần 1 widget riêng với insertTarget phù hợp</p>
        </div>
      </div>

      {/* ══ Widget selector bar ══════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Globe size={15} className="text-blue-500" />
            Widget của bạn ({widgets.length})
          </h3>
          <button onClick={() => setShowNewForm(f => !f)} disabled={creating || widgets.length >= 10}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                       text-white text-xs font-bold rounded-xl transition active:scale-95">
            <Plus size={13} />
            {showNewForm ? 'Huỷ' : 'Thêm Widget'}
          </button>
        </div>

        {/* New widget form — inline */}
        {showNewForm && (
          <div className="flex items-center gap-2 mb-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <Globe size={15} className="text-blue-500 flex-shrink-0" />
            <input
              type="url"
              value={newWebsiteUrl}
              onChange={e => setNewWebsiteUrl(e.target.value)}
              placeholder="Nhập URL website (VD: https://example.com)"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              onKeyDown={e => e.key === 'Enter' && createWidget()}
              autoFocus
            />
            <button onClick={createWidget} disabled={creating || !newWebsiteUrl.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold rounded-lg transition whitespace-nowrap">
              {creating ? 'Đang tạo...' : 'Tạo'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-6 text-center text-sm text-gray-400">Đang tải...</div>
        ) : widgets.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <Code2 size={24} className="text-blue-500" />
            </div>
            <p className="text-sm font-bold text-gray-700 mb-1">Chưa có widget nào</p>
            <p className="text-xs text-gray-400 mb-3">Nhấn "Thêm Widget" và nhập URL website để bắt đầu</p>
            {!showNewForm && (
              <button onClick={() => setShowNewForm(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition">
                <Plus size={14} className="inline mr-1" />Thêm Widget
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {widgets.map(w => {
              const isActive = w.id === activeWidgetId;
              return (
                <div key={w.id}
                  onClick={() => selectWidget(w.id)}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                    ${isActive
                      ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                  {/* Color dot */}
                  <div className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: w.config?.buttonColor || '#f97316' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{w.website_url || w.name || 'Nút mặc định'}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">{w.config?.insertTarget || '.footer'}</p>
                  </div>
                  {isActive && <span className="text-blue-500 text-sm font-bold flex-shrink-0">✓</span>}
                  {/* Delete btn */}
                  <button
                    onClick={e => { e.stopPropagation(); deleteWidget(w.id); }}
                    disabled={deleting === w.id}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0"
                    title="Xoá widget">
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Only show config panel when a widget is selected */}
      {activeWidgetId && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* ══ Config panel (3/5) ══════════════════════════════ */}
          <div className="xl:col-span-3 space-y-4">

            {/* Tab bar — 4 tabs only */}
            <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
              {TABS.map(({ key, label, Icon }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all
                              ${tab === key
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700'}`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {/* ─────────────────────────────────────────────────── */}
            {/* TAB 1: Nút — appearance only, NO position          */}
            {/* ─────────────────────────────────────────────────── */}
            {tab === 'button' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Text nút">
                    <TextInput value={cfg.buttonText} onChange={e => set('buttonText', e.target.value)} placeholder="Lấy Mã" />
                  </Field>
                  <Field label={`Cỡ chữ — ${cfg.fontSize}px`}>
                    <input type="range" min="0" max="13" value={cfg.fontSize}
                      onChange={e => set('fontSize', +e.target.value)}
                      className="w-full accent-blue-500 cursor-pointer mt-2" />
                  </Field>
                </div>

                {/* Màu — inline compact */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <input type="color" value={cfg.buttonColor} onChange={e => set('buttonColor', e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Màu nền nút</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="color" value={cfg.textColor} onChange={e => set('textColor', e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Màu chữ nút</span>
                  </div>
                </div>

                <Field label={`Border radius — ${cfg.borderRadius}px`}>
                  <input type="range" min="0" max="20" value={cfg.borderRadius}
                    onChange={e => set('borderRadius', +e.target.value)}
                    className="w-full accent-blue-500 cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>Vuông</span><span>Pill</span></div>
                </Field>

                <Toggle checked={cfg.shadow} onChange={v => set('shadow', v)} label="Hiệu ứng đổ bóng" />

                {/* Icon section — compact card */}
                <SectionTitle>Icon / Logo nút</SectionTitle>
                <Field label="URL ảnh logo"
                  hint="Để trống sẽ dùng logo mặc định — dùng chung icon nút + logo popup">
                  <TextInput value={cfg.iconUrl} onChange={e => { set('iconUrl', e.target.value); set('brandLogo', e.target.value); }}
                    mono />
                </Field>

                <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-3">
                  <img
                    src={cfg.iconUrl || '/lg.png'} alt="icon"
                    className="w-11 h-11 object-contain rounded-lg p-1 flex-shrink-0"
                    style={{ background: cfg.iconBg !== 'transparent' ? cfg.iconBg : '#f3f4f6', border: '1px solid #e5e7eb' }}
                    onError={e => { e.target.src = '/lg.png'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">
                      {cfg.iconUrl ? 'Ảnh tùy chỉnh' : 'Logo mặc định'}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <Toggle
                          checked={cfg.iconBg !== 'transparent'}
                          onChange={v => set('iconBg', v ? '#ffffff' : 'transparent')}
                          label="Nền"
                        />
                        {cfg.iconBg !== 'transparent' && (
                          <input type="color"
                            value={cfg.iconBg.startsWith('rgba') ? '#ffffff' : cfg.iconBg}
                            onChange={e => set('iconBg', e.target.value)}
                            className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                        )}
                      </div>
                    </div>
                  </div>
                  {cfg.iconUrl && (
                    <button onClick={() => set('iconUrl', '')}
                      className="text-xs text-red-400 hover:text-red-600 font-semibold flex-shrink-0">✕</button>
                  )}
                </div>

                <Field label={`Kích thước icon — ${cfg.iconSize}px`}>
                  <input type="range" min="14" max="40" value={cfg.iconSize}
                    onChange={e => set('iconSize', +e.target.value)}
                    className="w-full accent-blue-500 cursor-pointer" />
                </Field>
              </div>
            )}

            {/* ── TAB 2: Nhúng ─────────────────────────────────── */}
            {tab === 'position' && (
              <div className="space-y-4">

                {/* ── 1. Phần tử tham chiếu ── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Crosshair size={14} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Phần tử tham chiếu</h3>
                      <p className="text-[11px] text-gray-400">CSS selector — script sẽ tìm phần tử này trên trang khách</p>
                    </div>
                  </div>
                  <input type="text" value={cfg.insertTarget}
                    onChange={e => set('insertTarget', e.target.value)}
                    placeholder=".footer · #sidebar · header · .cta-section"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                               focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition font-mono bg-white" />
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
                    <Info size={13} className="mt-0.5 flex-shrink-0" />
                    <span><strong>Mỗi website khác nhau</strong> thường có insertTarget khác nhau. Hãy tạo widget riêng cho mỗi website.</span>
                  </div>
                </div>

                {/* ── 2. Vị trí chèn ── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                      <Pin size={14} className="text-violet-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Vị trí chèn</h3>
                      <p className="text-[11px] text-gray-400">Div mới sẽ xuất hiện ở đâu so với phần tử tham chiếu?</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {INSERT_MODES.map(m => {
                      const sel = cfg.insertMode === m.id;
                      return (
                        <button key={m.id} type="button" onClick={() => set('insertMode', m.id)}
                          className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all
                            ${sel ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm' : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}>
                          <span className="text-base font-bold leading-none">{m.arrow}</span>
                          <span className="text-[11px] font-semibold">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-violet-500 font-medium mt-1">
                    {INSERT_MODES.find(m => m.id === cfg.insertMode)?.arrow}{' '}
                    <strong>{INSERT_MODES.find(m => m.id === cfg.insertMode)?.label}</strong>
                    {' — '}{INSERT_MODES.find(m => m.id === cfg.insertMode)?.desc}
                  </p>
                </div>

                {/* ── 3. Căn chỉnh + Padding ── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">↔</div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Căn chỉnh & khoảng cách</h3>
                      <p className="text-[11px] text-gray-400">Nút hiển thị inline, tự chiếm không gian trong div mới</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {ALIGNS.map(a => (
                      <button key={a.id} type="button" onClick={() => set('align', a.id)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-bold transition-all
                          ${cfg.align === a.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                        <span className="text-sm">{a.arrow}</span> {a.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label={`Padding ngang — ${cfg.padX}px`}>
                      <input type="range" min="0" max="60" value={cfg.padX}
                        onChange={e => set('padX', +e.target.value)} className="w-full accent-emerald-500 cursor-pointer" />
                    </Field>
                    <Field label={`Padding dọc — ${cfg.padY}px`}>
                      <input type="range" min="0" max="60" value={cfg.padY}
                        onChange={e => set('padY', +e.target.value)} className="w-full accent-emerald-500 cursor-pointer" />
                    </Field>
                  </div>
                </div>

                {/* ── 4. Nâng cao ── */}
                <details className="bg-white rounded-2xl border border-gray-200 shadow-sm group">
                  <summary className="flex items-center gap-2 p-5 cursor-pointer select-none">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Settings2 size={14} className="text-gray-500" />
                    </div>
                    <span className="text-sm font-bold text-gray-600">Nâng cao</span>
                    <span className="ml-auto text-gray-300 text-xs group-open:rotate-90 transition-transform">▶</span>
                  </summary>
                  <div className="px-5 pb-5 grid grid-cols-2 gap-4 -mt-1">
                    <Field label="ID container" hint="Mặc định: laynut-auto-container">
                      <TextInput value={cfg.insertId} onChange={e => set('insertId', e.target.value)}
                        placeholder="laynut-auto-container" mono />
                    </Field>
                    <Field label="CSS cho container" hint="VD: background:#f5f5f5;">
                      <TextInput value={cfg.insertStyle} onChange={e => set('insertStyle', e.target.value)}
                        placeholder="padding:20px;" mono />
                    </Field>
                  </div>
                </details>
              </div>
            )}

            {/* ─────────────────────────────────────────────────── */}
            {/* TAB 3: Popup — theme + brand + content             */}
            {/* ─────────────────────────────────────────────────── */}
            {tab === 'popup' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">

                {/* Theme */}
                <Field label="Kiểu giao diện popup" hint="Ảnh hưởng màu sắc toàn bộ cửa sổ popup">
                  <div className="grid grid-cols-2 gap-3">
                    {THEMES.map(th => {
                      const sel = cfg.theme === th.id;
                      return (
                        <button key={th.id} type="button" onClick={() => set('theme', th.id)}
                          className={`relative p-4 rounded-2xl border-2 text-left transition-all
                                      ${sel ? 'border-blue-500 shadow-sm scale-[1.02]' : 'border-gray-200 hover:border-gray-300'}`}>
                          {sel && <span className="absolute top-2 right-2 text-blue-500 text-sm">✓</span>}
                          <div className="rounded-xl p-3 mb-2.5"
                            style={{
                              background: th.preview.modal, border: th.id === 'glass' ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e5e7eb',
                              backdropFilter: th.id === 'glass' ? 'blur(10px)' : undefined
                            }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-5 h-5 rounded-full" style={{ background: th.preview.accent, opacity: 0.9 }} />
                              <div className="h-2 rounded flex-1" style={{ background: th.preview.text, opacity: 0.15 }} />
                            </div>
                            <div className="h-1.5 rounded w-3/4 mb-1" style={{ background: th.preview.text, opacity: 0.1 }} />
                            <div className="flex gap-1">
                              <div className="flex-1 h-5 rounded" style={{ background: th.preview.ring, border: `1px solid ${th.preview.text}22` }} />
                              <div className="w-10 h-5 rounded text-[7px] font-bold flex items-center justify-center"
                                style={{ background: th.preview.accent, color: th.id === 'glass' ? '#0f172a' : '#fff' }}>COPY</div>
                            </div>
                          </div>
                          <p className="font-bold text-gray-900 text-sm">{th.label}</p>
                          <p className="text-xs text-gray-400">{th.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            )}

            {/* ─────────────────────────────────────────────────── */}
            {/* TAB 4: Embed — custom CSS + generated code          */}
            {/* ─────────────────────────────────────────────────── */}
            {tab === 'embed' && (
              <div className="space-y-4">

                {/* Custom CSS */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-700">
                    <Info size={13} className="mt-0.5 flex-shrink-0" />
                    <span>Ghi đè CSS mặc định. Selector chính: <code className="bg-blue-100 px-1 rounded font-mono">#laynut-btn</code> và <code className="bg-blue-100 px-1 rounded font-mono">#laynut-modal</code>.</span>
                  </div>
                  <Field label="Custom CSS" hint="Được chèn sau toàn bộ style mặc định">
                    <textarea rows={6} value={cfg.customCSS} onChange={e => set('customCSS', e.target.value)}
                      placeholder={`/* Ví dụ */\n#laynut-btn {\n  border: 2px solid rgba(255,255,255,0.4);\n}`}
                      className="w-full px-3 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none
                                 focus:ring-2 focus:ring-blue-500 transition resize-y font-mono leading-relaxed bg-white" />
                  </Field>
                </div>

                {/* Generated code */}
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-xs text-blue-700">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  Dán đoạn code này trước thẻ <code className="font-mono bg-blue-100 px-1 rounded">&lt;/body&gt;</code>
                </div>

                <div className="relative">
                  <pre className="bg-slate-900 text-green-400 rounded-2xl p-5 text-xs overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap break-all">
                    {embedCode}
                  </pre>
                  <div className="absolute top-3 right-3">
                    <CopyButton text={embedCode} />
                  </div>
                </div>

                {/* Info about current widget */}
                {activeWidget && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-800 text-sm mb-2">Widget hiện tại</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400">Token:</span>
                        <span className="ml-2 font-mono text-blue-600 font-bold">{token}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Insert target:</span>
                        <span className="ml-2 font-mono text-orange-600 font-bold">{cfg.insertTarget}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ Preview panel (2/5) ═════════════════════════════ */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 text-sm">Xem trước trực tiếp</h2>
                <button onClick={startPreview} disabled={running}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600
                             disabled:bg-orange-300 text-white text-xs font-bold rounded-xl transition active:scale-95">
                  {running
                    ? <><RefreshCw size={12} className="animate-spin" />{countdown}s</>
                    : <><Play size={12} />Chạy thử</>}
                </button>
              </div>
              <LivePreview cfg={cfg} countdown={countdown} revealed={revealed} />
              {!running && !revealed && (
                <p className="text-center text-xs text-gray-400 mt-3">
                  Nhấn <strong className="text-orange-500">Chạy thử</strong> để xem countdown
                </p>
              )}

              {/* Quick save button in preview panel */}
              {activeWidgetId && (
                <button onClick={saveWidget} disabled={saving}
                  className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50">
                  {saving ? 'Đang lưu...' : '💾 Lưu Script'}
                </button>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
