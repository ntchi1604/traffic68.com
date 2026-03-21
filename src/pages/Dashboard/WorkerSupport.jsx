import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { HelpCircle, MessageCircle, Send, Clock, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';

export default function WorkerSupport() {
  usePageTitle('Hỗ trợ');
  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchTickets = () => {
    api.get('/support/tickets')
      .then(d => { setTickets(d.tickets || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setMsg(null);
    try {
      await api.post('/support/tickets', { subject, description: message, priority: 'medium' });
      setMsg({ type: 'success', text: 'Gửi yêu cầu thành công!' });
      setSubject('');
      setMessage('');
      fetchTickets();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Có lỗi xảy ra' });
    }
    setSending(false);
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Hỗ trợ' }]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Hỗ trợ kỹ thuật</h1>
        <p className="text-slate-500 text-sm mt-1">Gửi yêu cầu hỗ trợ hoặc báo cáo lỗi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MessageCircle size={18} className="text-blue-500" /> Tạo yêu cầu mới
          </h2>
          {msg && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-semibold ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tiêu đề *</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="VD: Không nhận được thu nhập..." required
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nội dung *</label>
              <textarea rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Mô tả chi tiết vấn đề của bạn..." required
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
            </div>
            <button type="submit" disabled={sending} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-lg transition text-sm disabled:opacity-50">
              <Send size={14} /> {sending ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <HelpCircle size={18} className="text-orange-500" /> Yêu cầu của bạn
          </h2>
          {loading ? (
            <p className="py-8 text-center text-slate-400 text-sm">Đang tải...</p>
          ) : tickets.length === 0 ? (
            <p className="py-8 text-center text-slate-400 text-sm">Chưa có yêu cầu nào</p>
          ) : (
            <div className="space-y-3">
              {tickets.map(t => (
                <div key={t.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-slate-700">{t.subject}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.status === 'resolved' ? 'bg-green-50 text-green-600' : t.status === 'closed' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>
                      {t.status === 'resolved' || t.status === 'closed' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                      {t.status === 'resolved' ? 'Đã xử lý' : t.status === 'closed' ? 'Đã đóng' : 'Đang chờ'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  {t.admin_reply && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                      <p className="text-[10px] font-bold text-blue-600 mb-0.5">Phản hồi từ admin:</p>
                      <p className="text-xs text-slate-700">{t.admin_reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
