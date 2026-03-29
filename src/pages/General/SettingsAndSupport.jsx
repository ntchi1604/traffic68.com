import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Send, Phone, Mail, Clock, CheckCircle, AlertCircle, MessageSquare, Headphones } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

const STATUS_MAP = {
  open:        { label: 'Đang chờ',      color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  in_progress: { label: 'Đang xử lý',   color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  resolved:    { label: 'Đã giải quyết', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  closed:      { label: 'Đã đóng',       color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' },
};

const PRIORITY_MAP = {
  low:    { label: 'Thấp',       color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  medium: { label: 'Trung bình', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  high:   { label: 'Cao',        color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
};

export default function SettingsAndSupport() {
  usePageTitle('Hỗ trợ');
  const toast = useToast();
  const [ticketData, setTicketData] = useState({ subject: '', description: '', priority: 'medium' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const fetchTickets = () => {
    setLoadingTickets(true);
    api.get('/support/tickets')
      .then(data => setTickets(data.tickets || []))
      .catch(console.error)
      .finally(() => setLoadingTickets(false));
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleTicketChange = (e) => {
    const { name, value } = e.target;
    setTicketData(prev => ({ ...prev, [name]: value }));
  };

  const submitTicket = async (e) => {
    e.preventDefault();
    if (!ticketData.subject || !ticketData.description) return;
    setIsSubmitting(true);
    try {
      const data = await api.post('/support/tickets', ticketData);
      toast.success(`Ticket #${data.ticketId} đã được tạo`);
      setTicketData({ subject: '', description: '', priority: 'medium' });
      fetchTickets();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const contacts = [
    { icon: Phone, label: 'Hotline', value: '1900 1234', sub: '7:00 - 22:00 hàng ngày', color: '#6366f1', bg: '#eef2ff' },
    { icon: Mail, label: 'Email', value: 'support@traffic68.com', href: 'mailto:support@traffic68.com', color: '#8b5cf6', bg: '#f5f3ff' },
    { icon: MessageSquare, label: 'Telegram', value: '@traffic68_support', href: 'https://t.me/traffic68_support', color: '#06b6d4', bg: '#ecfeff' },
    { icon: MessageSquare, label: 'Telegram nhóm', value: 'Traffic68 Group', href: 'https://t.me/traffic68_group', sub: 'Hỗ trợ nhanh nhất', color: '#10b981', bg: '#ecfdf5' },
  ];

  const inputStyle = "w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all";

  return (
    <div className="space-y-5 w-full min-w-0 pb-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/buyer/dashboard' },
        { label: 'Hỗ trợ' },
      ]} />

      {/* ── Contact channels ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {contacts.map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-all duration-200">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: c.bg }}>
              <c.icon size={16} style={{ color: c.color }} />
            </div>
            <p className="text-xs font-bold text-slate-800 mb-0.5">{c.label}</p>
            {c.href ? (
              <a href={c.href} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold hover:underline" style={{ color: c.color }}>{c.value}</a>
            ) : (
              <p className="text-xs font-semibold" style={{ color: c.color }}>{c.value}</p>
            )}
            {c.sub && <p className="text-[10px] text-slate-400 mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Ticket History ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-indigo-500" />
            <span className="text-sm font-bold text-slate-700">Lịch sử yêu cầu hỗ trợ</span>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{tickets.length}</span>
          </div>
        </div>

        {loadingTickets ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Headphones size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">Chưa có yêu cầu hỗ trợ nào</p>
            <p className="text-xs text-slate-400">Gửi yêu cầu đầu tiên ở form bên dưới</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map(t => {
              const st = STATUS_MAP[t.status] || STATUS_MAP.open;
              const pr = PRIORITY_MAP[t.priority] || PRIORITY_MAP.medium;
              return (
                <div key={t.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-xs font-bold text-slate-800">{t.subject}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                          style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                          {st.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                          style={{ background: pr.bg, color: pr.color, border: `1px solid ${pr.border}` }}>
                          {pr.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{t.description}</p>

                      {t.admin_reply && (
                        <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                          <p className="text-[9px] font-bold text-indigo-400 mb-1">
                            💬 Admin {t.replied_at ? `— ${new Date(t.replied_at).toLocaleString('vi-VN')}` : ''}
                          </p>
                          <p className="text-[11px] text-indigo-800">{t.admin_reply}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                      {new Date(t.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── New ticket form ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Send size={14} className="text-indigo-500" />
          <span className="text-sm font-bold text-slate-700">Gửi yêu cầu hỗ trợ mới</span>
        </div>

        <form onSubmit={submitTicket} className="p-6 space-y-5">
          <div>
            <label htmlFor="subject" className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Chủ đề</label>
            <input id="subject" name="subject" value={ticketData.subject} onChange={handleTicketChange}
              className={inputStyle} placeholder="Nhập chủ đề hỗ trợ..." required />
          </div>

          <div>
            <label htmlFor="description" className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Mô tả vấn đề</label>
            <textarea id="description" name="description" value={ticketData.description} onChange={handleTicketChange}
              rows={5} className={`${inputStyle} resize-y`}
              placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải..." required />
          </div>

          <div>
            <label htmlFor="priority" className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Mức độ ưu tiên</label>
            <select id="priority" name="priority" value={ticketData.priority} onChange={handleTicketChange}
              className={inputStyle}>
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
            </select>
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
              <Send size={14} />
              {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}