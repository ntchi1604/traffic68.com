import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Clock, CheckCircle, MessageSquare, Send, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../lib/api';

const STATUS_MAP = {
  open:        { label: 'Mở',        cls: 'bg-amber-100 text-amber-700', icon: Clock },
  in_progress: { label: 'Đang xử lý', cls: 'bg-blue-100 text-indigo-700', icon: Clock },
  resolved:    { label: 'Đã xử lý',   cls: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed:      { label: 'Đã đóng',    cls: 'bg-slate-100 text-slate-500', icon: CheckCircle },
};

function ReplyModal({ ticket, onClose, onDone }) {
  const [reply, setReply] = useState(ticket.admin_reply || '');
  const [status, setStatus] = useState('resolved');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.put(`/agency-admin/tickets/${ticket.id}`, {
        reply,
        admin_reply: reply,
        status,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err.message);
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
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{ticket.description || ticket.message}</p>
          </div>
        </div>

        {/* Existing reply */}
        {ticket.admin_reply && (
          <div className="px-6 pt-3">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-[10px] font-bold text-blue-400 mb-1">Phản hồi trước:</p>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{ticket.admin_reply}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Phản hồi</label>
            <textarea value={reply} onChange={e => setReply(e.target.value)}
              rows={4} placeholder="Nhập phản hồi cho khách hàng..."
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              required />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cập nhật trạng thái</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'resolved', label: 'Đã xử lý', cls: 'bg-green-500 text-white' },
                { value: 'in_progress', label: 'Đang xử lý', cls: 'bg-indigo-500 text-white' },
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

          {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

          <button type="submit" disabled={loading || !reply.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
            <Send size={16} /> {loading ? 'Đang gửi...' : 'Gửi phản hồi'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AgencyAdminTickets() {
  usePageTitle('Đại lý - Hỗ trợ');
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [replyTicket, setReplyTicket] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchTickets = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    api.get(`/agency-admin/tickets?${params}`)
      .then(data => {
        setTickets(data.tickets || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(); }, [statusFilter, page]);

  const updateTicket = async (id, status) => {
    try {
      await api.put(`/agency-admin/tickets/${id}`, { status });
      fetchTickets();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const FILTERS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chưa xử lý' },
    { key: 'resolved', label: 'Đã xử lý' },
    { key: 'closed', label: 'Đã đóng' },
  ];

  const visibleTickets = tickets.filter(t => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return t.status === 'open' || t.status === 'in_progress';
    return t.status === statusFilter;
  });

  const countFor = (key) => {
    if (key === 'all') return total || tickets.length;
    if (key === 'pending') return tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    return tickets.filter(t => t.status === key).length;
  };

  return (
    <div className="space-y-5">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => { setStatusFilter(f.key); setPage(1); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              statusFilter === f.key
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {f.label}
            <span className={`px-1.5 py-0.5 text-[10px] font-black rounded-full ${
              statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>{countFor(f.key)}</span>
          </button>
        ))}
      </div>

      {/* Tickets table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">ID</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">User</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Tiêu đề</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Nội dung</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-500">Trạng thái</th>
                <th className="px-5 py-3 text-right font-semibold text-slate-500">Ngày tạo</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : visibleTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
                    Không có ticket nào
                  </td>
                </tr>
              ) : visibleTickets.map(t => {
                const st = STATUS_MAP[t.status] || STATUS_MAP.open;
                return (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">#{t.id}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800 text-xs">{t.user_name || '—'}</p>
                      <p className="text-[10px] text-slate-400">{t.user_email || ''}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-700 max-w-[200px] truncate">{t.subject}</td>
                    <td className="px-5 py-3 text-slate-500 max-w-[250px] truncate">{t.description || t.message}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full ${st.cls}`}>
                        <st.icon size={10} /> {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-slate-400">
                      {new Date(t.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setReplyTicket(t)}
                          className="px-2.5 py-1.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-indigo-700 rounded-lg transition flex items-center gap-1">
                          <MessageSquare size={12} /> Phản hồi
                        </button>
                        {t.status === 'open' && (
                          <button onClick={() => updateTicket(t.id, 'resolved')}
                            className="px-2.5 py-1.5 text-xs font-bold bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition">
                            Xử lý
                          </button>
                        )}
                        {t.status !== 'closed' && (
                          <button onClick={() => updateTicket(t.id, 'closed')}
                            className="px-2.5 py-1.5 text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition">
                            Đóng
                          </button>
                        )}
                        {t.status !== 'open' && (
                          <button onClick={() => updateTicket(t.id, 'open')}
                            className="px-2.5 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition">
                            Mở lại
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Trang <span className="font-bold text-slate-700">{page}</span> / {totalPages}

            <span className="text-slate-400 ml-1">({total} ticket)</span>
          </p>
          <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1">
              <ChevronLeft size={14} /> Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, [])
              .map((p, i) => p === '...'
                ? <span key={`d${i}`} className="px-1 text-slate-400 text-xs">...</span>
                : <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs font-bold rounded-lg transition ${page === p ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}>
                    {p}
                  </button>
              )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1">
              Sau <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

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
