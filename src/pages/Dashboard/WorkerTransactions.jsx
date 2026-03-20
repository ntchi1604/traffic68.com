import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { CheckCircle2, Clock, XCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

const fmt = (n) => Number(n).toLocaleString('vi-VN');

const transactions = [
  { id: 1, type: 'earning', desc: 'Thu nhập từ traffic68.com/s/abc123', amount: 2500, status: 'completed', date: '21/03/2026 14:30' },
  { id: 2, type: 'earning', desc: 'Thu nhập từ traffic68.com/s/def456', amount: 3000, status: 'completed', date: '21/03/2026 12:15' },
  { id: 3, type: 'withdraw', desc: 'Rút tiền - Vietcombank ****5678', amount: -100000, status: 'completed', date: '20/03/2026 09:00' },
  { id: 4, type: 'earning', desc: 'Thu nhập từ traffic68.com/s/ghi789', amount: 1500, status: 'completed', date: '20/03/2026 08:45' },
  { id: 5, type: 'withdraw', desc: 'Rút tiền - MB Bank ****1234', amount: -50000, status: 'pending', date: '19/03/2026 16:20' },
  { id: 6, type: 'earning', desc: 'Thu nhập từ traffic68.com/s/jkl012', amount: 5000, status: 'completed', date: '19/03/2026 11:00' },
  { id: 7, type: 'bonus', desc: 'Thưởng hoàn thành 100 nhiệm vụ', amount: 10000, status: 'completed', date: '18/03/2026 10:00' },
];

function StatusBadge({ status }) {
  const config = {
    completed: { label: 'Hoàn thành', icon: CheckCircle2, cls: 'bg-green-50 text-green-600' },
    pending: { label: 'Đang xử lý', icon: Clock, cls: 'bg-amber-50 text-amber-600' },
    failed: { label: 'Thất bại', icon: XCircle, cls: 'bg-red-50 text-red-500' },
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

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Lịch sử giao dịch' },
      ]} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Lịch sử giao dịch</h1>
        <p className="text-slate-500 text-sm mt-1">Tất cả giao dịch thu nhập và rút tiền</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
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
              {transactions.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.amount >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      {t.amount >= 0
                        ? <ArrowDownLeft size={14} className="text-green-600" />
                        : <ArrowUpRight size={14} className="text-red-500" />
                      }
                    </div>
                  </td>
                  <td className="py-3 text-xs font-medium text-slate-700">{t.desc}</td>
                  <td className={`py-3 text-right text-xs font-bold ${t.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {t.amount >= 0 ? '+' : ''}{fmt(t.amount)} đ
                  </td>
                  <td className="py-3 text-center"><StatusBadge status={t.status} /></td>
                  <td className="py-3 text-right text-xs text-slate-400">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
