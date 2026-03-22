import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { CheckCircle2, Clock, XCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

function StatusBadge({ status }) {
  const config = {
    completed: { label: 'Hoàn thành', icon: CheckCircle2, cls: 'bg-green-50 text-green-600' },
    pending: { label: 'Đang xử lý', icon: Clock, cls: 'bg-amber-50 text-amber-600' },
    failed: { label: 'Thất bại', icon: XCircle, cls: 'bg-red-50 text-red-500' },
    rejected: { label: 'Từ chối', icon: XCircle, cls: 'bg-red-50 text-red-500' },
  };
  const c = config[status] || config.completed;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.cls}`}>
      <Icon size={10} /> {c.label}
    </span>
  );
}

export default function WorkerTransactions() {
  usePageTitle('Lịch sử giao dịch');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const params = new URLSearchParams({ scope: 'worker' });
    if (filter !== 'all') params.set('type', filter);
    api.get(`/finance/transactions?${params}`)
      .then(d => { setTransactions(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Lịch sử giao dịch' }]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Lịch sử giao dịch</h1>
        <p className="text-slate-500 text-sm mt-1">Tất cả giao dịch thu nhập và rút tiền</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
        <div className="flex gap-2 mb-4">
          {[['all', 'Tất cả'], ['deposit', 'Nạp tiền'], ['withdraw', 'Rút tiền']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filter === val ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-3 font-medium text-xs uppercase tracking-wider">Loại</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider">Mô tả</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">Số tiền</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Trạng thái</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Đang tải...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Chưa có giao dịch nào</td></tr>
              ) : transactions.map(t => {
                const formatNote = (note) => {
                  if (!note) return null;
                  // Clean old "Gateway link /v/xxxxx task #123" → "task #123"
                  let cleaned = note.replace(/Gateway link \/v\/\w+\s*/g, '');
                  // Clean old "Vượt link task" → "task"
                  cleaned = cleaned.replace(/Vượt link\s*/g, '');
                  // Strip emojis
                  cleaned = cleaned.replace(/[\u{1F300}-\u{1FAF8}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '');
                  return cleaned.trim() || note;
                };
                const rawDesc = t.note || (t.type === 'withdraw' ? `Rút tiền (${t.ref_code})` : t.type === 'deposit' ? `Nạp tiền (${t.ref_code})` : t.ref_code);
                // Use enriched keyword/campaign if available
                const desc = t.keyword ? `${t.keyword} - ${t.campaign_name || ''}` : formatNote(rawDesc);
                const isPositive = t.type === 'deposit' || t.type === 'earning' || t.type === 'bonus' || t.type === 'commission';
                return (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
                        {isPositive ? <ArrowDownLeft size={14} className="text-green-600" /> : <ArrowUpRight size={14} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="py-3 text-xs font-medium text-slate-700 max-w-[250px]">
                      <p className="truncate">{desc}</p>
                    </td>
                    <td className={`py-3 text-right text-xs font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                      {isPositive ? '+' : '-'}{fmt(t.amount)} đ
                    </td>
                    <td className="py-3 text-center"><StatusBadge status={t.status} /></td>
                    <td className="py-3 text-right text-xs text-slate-400">
                      {new Date(t.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
