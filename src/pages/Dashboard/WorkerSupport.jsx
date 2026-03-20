import { useState } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { HelpCircle, MessageCircle, Send, Clock, CheckCircle2 } from 'lucide-react';

const tickets = [
  { id: 1, subject: 'Không nhận được tiền rút', status: 'open', date: '20/03/2026' },
  { id: 2, subject: 'Link bị lỗi không đếm click', status: 'resolved', date: '18/03/2026' },
];

export default function WorkerSupport() {
  usePageTitle('Hỗ trợ');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Hỗ trợ' },
      ]} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Hỗ trợ kỹ thuật</h1>
        <p className="text-slate-500 text-sm mt-1">Gửi yêu cầu hỗ trợ hoặc báo cáo lỗi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New ticket */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MessageCircle size={18} className="text-blue-500" />
            Tạo yêu cầu mới
          </h2>
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tiêu đề *</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="VD: Không nhận được thu nhập..." className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nội dung *</label>
              <textarea rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Mô tả chi tiết vấn đề của bạn..." className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
            </div>
            <button type="button" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-lg transition text-sm">
              <Send size={14} /> Gửi yêu cầu
            </button>
          </form>
        </div>

        {/* Existing tickets */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <HelpCircle size={18} className="text-orange-500" />
            Yêu cầu của bạn
          </h2>
          {tickets.length === 0 ? (
            <p className="py-8 text-center text-slate-400 text-sm">Chưa có yêu cầu nào</p>
          ) : (
            <div className="space-y-3">
              {tickets.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{t.subject}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t.date}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.status === 'resolved' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                    {t.status === 'resolved' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                    {t.status === 'resolved' ? 'Đã xử lý' : 'Đang chờ'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
