import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import api from '../../lib/api';
import { formatMoney } from '../../lib/format';

export default function TransactionHistory() {
  usePageTitle('Lịch sử giao dịch');
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/finance/transactions')
      .then(data => setTransactions(data.transactions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  const getTypeLabel = (type) => {
    const map = { deposit: 'Nạp tiền', withdraw: 'Rút/Chi', commission: 'Hoa hồng', refund: 'Hoàn tiền' };
    return map[type] || type;
  };

  const getMethodLabel = (method) => {
    const map = { credit_card: 'Thẻ tín dụng', bank_transfer: 'Chuyển khoản', momo: 'MoMo', system: 'Hệ thống', zalopay: 'ZaloPay', transfer: 'Chuyển ví' };
    return map[method] || method;
  };

  const fmt = (n) => formatMoney(n);

  const totalDeposit = transactions
    .filter(t => (t.type === 'deposit' || t.type === 'commission') && t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalWithdraw = transactions
    .filter(t => t.type === 'withdraw' && t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Tài chính' },
        { label: 'Lịch sử giao dịch' },
      ]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900">Lịch sử giao dịch</h1>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'deposit', label: 'Nạp tiền' },
            { key: 'withdraw', label: 'Chi phí' },
            { key: 'commission', label: 'Hoa hồng' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border-l-4 border-l-green-400 border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <ArrowDownCircle size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Tổng nạp</p>
            <p className="text-lg font-black text-green-600">+{fmt(totalDeposit)} ₫</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-l-red-400 border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <ArrowUpCircle size={20} className="text-red-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Tổng chi</p>
            <p className="text-lg font-black text-red-600">-{fmt(totalWithdraw)} ₫</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-l-blue-400 border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Wallet size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Chênh lệch</p>
            <p className="text-lg font-black text-blue-600">{fmt(totalDeposit - totalWithdraw)} ₫</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mã GD</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Loại</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Phương thức</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Số tiền</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trạng thái</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Thời gian</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredTransactions.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">Không có giao dịch nào</td></tr>
            ) : (
              filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">{t.ref_code}</td>
                  <td className="px-6 py-4 text-sm font-medium">{getTypeLabel(t.type)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{getMethodLabel(t.method)}</td>
                  <td className={`px-6 py-4 text-sm font-bold ${
                    t.type === 'deposit' || t.type === 'commission' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {t.type === 'deposit' || t.type === 'commission' ? '+' : '-'}{fmt(t.amount)} ₫
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      t.status === 'completed' ? 'bg-green-100 text-green-800' :
                      t.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {t.status === 'completed' ? 'Hoàn tất' : t.status === 'pending' ? 'Đang xử lý' : 'Thất bại'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(t.created_at).toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}