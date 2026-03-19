import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Send, Phone, Mail, Clock, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import api from '../../lib/api';

const STATUS_MAP = {
  open:        { label: 'Đang chờ',    cls: 'bg-amber-100 text-amber-700', icon: Clock },
  in_progress: { label: 'Đang xử lý', cls: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  resolved:    { label: 'Đã giải quyết', cls: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed:      { label: 'Đã đóng',     cls: 'bg-slate-100 text-slate-500', icon: CheckCircle },
};

const PRIORITY_MAP = {
  low:    { label: 'Thấp',       cls: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Trung bình', cls: 'bg-blue-100 text-blue-700' },
  high:   { label: 'Cao',        cls: 'bg-red-100 text-red-700' },
};

export default function SettingsAndSupport() {
  usePageTitle('Hỗ trợ');
  const [ticketData, setTicketData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
  });
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
      alert(`Gửi yêu cầu hỗ trợ thành công! Ticket #${data.ticketId}`);
      setTicketData({ subject: '', description: '', priority: 'medium' });
      fetchTickets();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Hỗ trợ' },
      ]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Hỗ trợ</h1>
      </div>

      {/* Contact channels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-3">
          <div className="flex-shrink-0 p-2.5 bg-blue-100 rounded-xl">
            <Phone className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Hotline</p>
            <p className="text-sm text-slate-500">1900 1234</p>
            <p className="text-xs text-slate-400">7:00 - 22:00 hàng ngày</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-3">
          <div className="flex-shrink-0 p-2.5 bg-blue-100 rounded-xl">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Email</p>
            <a href="mailto:support@traffic68.com" className="text-sm text-blue-600 hover:underline">support@traffic68.com</a>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-3">
          <div className="flex-shrink-0 p-2.5 bg-sky-100 rounded-xl">
            <MessageSquare className="w-5 h-5 text-sky-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Telegram</p>
            <a href="https://t.me/traffic68_support" target="_blank" rel="noopener noreferrer" className="text-sm text-sky-600 hover:underline">
              @traffic68_support
            </a>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-3">
          <div className="flex-shrink-0 p-2.5 bg-sky-100 rounded-xl">
            <MessageSquare className="w-5 h-5 text-sky-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Telegram nhóm</p>
            <a href="https://t.me/traffic68_group" target="_blank" rel="noopener noreferrer" className="text-sm text-sky-600 hover:underline">
              Traffic68 Group
            </a>
            <p className="text-xs text-slate-400 mt-0.5">Hỗ trợ nhanh nhất</p>
          </div>
        </div>
      </div>

      {/* Ticket History */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock size={18} className="text-blue-500" /> Lịch sử yêu cầu hỗ trợ
          </h2>
          <span className="text-xs text-slate-400">{tickets.length} ticket</span>
        </div>

        {loadingTickets ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Chưa có yêu cầu hỗ trợ nào</p>
            <p className="text-xs mt-1">Gửi yêu cầu đầu tiên ở form bên dưới</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map(t => {
              const st = STATUS_MAP[t.status] || STATUS_MAP.open;
              const pr = PRIORITY_MAP[t.priority] || PRIORITY_MAP.medium;
              const StIcon = st.icon;
              return (
                <div key={t.id} className="px-6 py-4 hover:bg-slate-50/50 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 text-sm">{t.subject}</p>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${st.cls} flex items-center gap-1`}>
                          <StIcon size={10} /> {st.label}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${pr.cls}`}>
                          {pr.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>

                      {/* Admin reply */}
                      {t.admin_reply && (
                        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-blue-400 mb-1">
                            💬 Phản hồi từ Admin {t.replied_at ? `— ${new Date(t.replied_at).toLocaleString('vi-VN')}` : ''}
                          </p>
                          <p className="text-xs text-blue-800">{t.admin_reply}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 shrink-0">
                      {new Date(t.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Gửi yêu cầu hỗ trợ mới</h2>

        <form onSubmit={submitTicket} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="subject" className="text-sm font-medium text-slate-700">Chủ đề</label>
            <input id="subject" name="subject" value={ticketData.subject} onChange={handleTicketChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nhập chủ đề hỗ trợ..." required />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-slate-700">Mô tả vấn đề</label>
            <textarea id="description" name="description" value={ticketData.description} onChange={handleTicketChange}
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải..." required></textarea>
          </div>

          <div className="space-y-2">
            <label htmlFor="priority" className="text-sm font-medium text-slate-700">Mức độ ưu tiên</label>
            <select id="priority" name="priority" value={ticketData.priority} onChange={handleTicketChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={isSubmitting}
              className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
              <Send className="w-4 h-4 ml-1.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}