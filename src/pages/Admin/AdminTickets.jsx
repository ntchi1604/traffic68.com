import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { CheckCircle, Clock, XCircle, Send, MessageSquare, X } from 'lucide-react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

const STATUS_MAP = {
  open:        { label: 'Mở',       cls: 'bg-amber-100 text-amber-700', icon: Clock },
  in_progress: { label: 'Đang xử lý', cls: 'bg-blue-100 text-blue-700', icon: Clock },
  resolved:    { label: 'Đã xử lý', cls: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed:      { label: 'Đã đóng',  cls: 'bg-slate-100 text-slate-500', icon: CheckCircle },
};

function ReplyModal({ ticket, onClose, onDone }) {
  const [reply, setReply] = useState(ticket.admin_reply || '');
  const [status, setStatus] = useState('resolved');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setLoading(true);
    try {
      await api.put(`/admin/tickets/${ticket.id}`, { reply, status });
      onDone();
      onClose();
    } catch (err) {
      // error handled by caller
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">Phản hồi ticket</h3>
            <p className="text-xs text-slate-500">#{ticket.id} — {ticket.subject}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Original message */}
        <div className="px-6 pt-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 mb-1">Nội dung từ {ticket.user_name || ticket.user_email}:</p>
            <p className="text-sm text-slate-700">{ticket.description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Phản hồi</label>
            <textarea value={reply} onChange={e => setReply(e.target.value)}
              rows={4} placeholder="Nhập phản hồi cho khách hàng..."
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cập nhật trạng thái</label>
            <div className="flex gap-2">
              {[
                { value: 'resolved', label: 'Đã xử lý', cls: 'bg-green-500 text-white' },
                { value: 'in_progress', label: 'Đang xử lý', cls: 'bg-blue-500 text-white' },
                { value: 'closed', label: 'Đóng', cls: 'bg-slate-500 text-white' },
              ].map(s => (
                <button key={s.value} type="button" onClick={() => setStatus(s.value)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
                    status === s.value ? s.cls : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading || !reply.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
            <Send size={16} /> {loading ? 'Đang gửi...' : 'Gửi phản hồi'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminTickets({ defaultRole = 'all' }) {
  usePageTitle('Admin - Hỗ trợ');
  const toast = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyTicket, setReplyTicket] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState(defaultRole);

  const fetchTickets = () => {
    setLoading(true);
    api.get('/admin/tickets')
      .then(data => setTickets(data.tickets || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(); }, []);

  const updateTicket = async (id, status) => {
    try {
      await api.put(`/admin/tickets/${id}`, { status });
      fetchTickets();
    } catch (err) { toast.error(err.message); }
  };

  const FILTERS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chưa xử lý' },
    { key: 'resolved', label: 'Đã xử lý' },
    { key: 'closed', label: 'Đóng' },
  ];

  const filteredTickets = tickets.filter(t => {
    // Role filter
    if (roleFilter !== 'all' && (t.role || 'worker') !== roleFilter) return false;
    // Status filter
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return t.status === 'open' || t.status === 'in_progress';
    if (statusFilter === 'resolved') return t.status === 'resolved';
    if (statusFilter === 'closed') return t.status === 'closed';
    return true;
  });

  const countFor = (key) => {
    if (key === 'all') return tickets.length;
    if (key === 'pending') return tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    if (key === 'resolved') return tickets.filter(t => t.status === 'resolved').length;
    if (key === 'closed') return tickets.filter(t => t.status === 'closed').length;
    return 0;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">
          {defaultRole === 'buyer' ? '🛒 Hỗ trợ Buyer' : defaultRole === 'worker' ? '👷 Hỗ trợ Worker' : 'Hỗ trợ khách hàng'}
        </h1>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => {
          const count = countFor(f.key);
          return (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                statusFilter === f.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {f.label}
              <span className={`px-1.5 py-0.5 text-[10px] font-black rounded-full ${
                statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
            Không có ticket nào
          </div>
        ) : filteredTickets.map(t => {
          const st = STATUS_MAP[t.status] || STATUS_MAP.open;
          return (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${(t.role || 'worker') === 'buyer' ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'}`}>
                      {(t.role || 'worker') === 'buyer' ? '🛒 Buyer' : '👷 Worker'}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${st.cls}`}>{st.label}</span>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full
                      ${t.priority === 'high' ? 'bg-red-100 text-red-700' :
                        t.priority === 'low' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                      {t.priority === 'high' ? 'Cao' : t.priority === 'low' ? 'Thấp' : 'Trung bình'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800">{t.subject}</h3>
                  <p className="text-sm text-slate-500 mt-1">{t.description}</p>

                  {/* Admin reply display */}
                  {t.admin_reply && (
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-blue-400 mb-1">Phản hồi admin — {t.replied_at ? new Date(t.replied_at).toLocaleString('vi-VN') : ''}</p>
                      <p className="text-sm text-blue-800">{t.admin_reply}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span>{t.user_name || t.user_email}</span>
                    <span>{new Date(t.created_at).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => setReplyTicket(t)}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition flex items-center gap-1">
                    <MessageSquare size={12} /> Phản hồi
                  </button>
                  {t.status === 'open' && (
                    <>
                      <button onClick={() => updateTicket(t.id, 'resolved')}
                        className="px-3 py-1.5 text-xs font-bold bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition">
                        Xử lý
                      </button>
                      <button onClick={() => updateTicket(t.id, 'closed')}
                        className="px-3 py-1.5 text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition">
                        Đóng
                      </button>
                    </>
                  )}
                  {t.status !== 'open' && (
                    <button onClick={() => updateTicket(t.id, 'open')}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition">
                      Mở lại
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply Modal */}
      {replyTicket && (
        <ReplyModal
          ticket={replyTicket}
          onClose={() => setReplyTicket(null)}
          onDone={fetchTickets}
        />
      )}
    </div>
  );
}
