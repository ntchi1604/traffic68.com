import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { ArrowDownCircle, ArrowUpCircle, Wallet, Gift, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../lib/api';
import { formatMoney } from '../../lib/format';

const fmt = (n) => formatMoney(n);
const LIMIT = 20;

const TYPE_MAP = {
  deposit:    { label: 'Nạp tiền',    cls: 'bg-green-100 text-green-700' },
  withdraw:   { label: 'Rút/Chi',     cls: 'bg-red-100 text-red-700' },
  campaign:   { label: 'Mua Traffic', cls: 'bg-orange-100 text-orange-700' },
  commission: { label: 'Hoa hồng',   cls: 'bg-blue-100 text-blue-700' },
  refund:     { label: 'Hoàn tiền',   cls: 'bg-purple-100 text-purple-700' },
};
const METHOD_MAP = {
  credit_card: 'Thẻ tín dụng', bank_transfer: 'Chuyển khoản',
  momo: 'MoMo', system: 'Hệ thống', zalopay: 'ZaloPay', transfer: 'Chuyển ví',
};

function Pagination({ page, total, onPage }) {
  if (total <= LIMIT) return null;
  const totalPages = Math.ceil(total / LIMIT);
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
      <p className="text-xs text-slate-500">
        Trang <span className="font-bold text-slate-700">{page}</span> / {totalPages}
        <span className="ml-2 text-slate-400">({total} giao dịch)</span>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition">
          <ChevronLeft size={14} className="text-slate-600" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, [])
          .map((p, i) => p === '...' ? (
            <span key={`d${i}`} className="px-1 text-slate-400 text-xs">…</span>
          ) : (
            <button key={p} onClick={() => onPage(p)}
              className={`w-7 h-7 text-xs font-bold rounded-lg transition ${page === p ? 'bg-blue-600 text-white' : 'hover:bg-white border border-slate-200 text-slate-600'}`}>
              {p}
            </button>
          ))}
        <button onClick={() => onPage(page + 1)} disabled={page >= Math.ceil(total / LIMIT)}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition">
          <ChevronRight size={14} className="text-slate-600" />
        </button>
      </div>
    </div>
  );
}

export default function TransactionHistory() {
  usePageTitle('Lịch sử giao dịch');
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  // Summary totals (từ toàn bộ, không bị limit page)
  const [summary, setSummary] = useState({ deposit: 0, commission: 0, withdraw: 0 });

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (filter !== 'all') {
        if (filter === 'commission') params.set('type', 'commission');
        else params.set('type', filter);
      }
      const d = await api.get(`/finance/transactions?${params}`);
      setTransactions(d.transactions || []);
      setTotal(d.total || 0);
      setPage(p);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filter]);

  // Lấy summary tổng (không phân trang)
  useEffect(() => {
    api.get('/finance/transactions?limit=1000&page=1')
      .then(d => {
        const all = d.transactions || [];
        setSummary({
          deposit: all.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0),
          commission: all.filter(t => t.type === 'commission' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0),
          withdraw: all.filter(t => (t.type === 'withdraw' || t.type === 'campaign') && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0),
        });
      }).catch(() => {});
  }, []);

  useEffect(() => { fetchData(1); }, [fetchData]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/buyer/dashboard' },
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
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filter === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border-l-4 border-l-green-400 border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <ArrowDownCircle size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Tổng nạp</p>
            <p className="text-lg font-black text-green-600">+{fmt(summary.deposit)} ₫</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-l-orange-400 border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <Gift size={20} className="text-orange-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Hoa hồng</p>
            <p className="text-lg font-black text-orange-600">+{fmt(summary.commission)} ₫</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-l-red-400 border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <ArrowUpCircle size={20} className="text-red-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Tổng chi</p>
            <p className="text-lg font-black text-red-600">-{fmt(summary.withdraw)} ₫</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-l-blue-400 border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Wallet size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Chênh lệch</p>
            <p className="text-lg font-black text-blue-600">{fmt(summary.deposit - summary.withdraw)} ₫</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Mã GD</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Loại</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Phương thức</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Số tiền</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Trạng thái</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">Không có giao dịch nào</td></tr>
                ) : transactions.map(t => {
                  const tp = TYPE_MAP[t.type] || { label: t.type, cls: 'bg-gray-100 text-gray-700' };
                  const isPos = t.type === 'deposit' || t.type === 'commission';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-400">{t.ref_code}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${tp.cls}`}>{tp.label}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{METHOD_MAP[t.method] || t.method}</td>
                      <td className={`px-5 py-3.5 text-right text-sm font-bold ${isPos ? 'text-green-600' : 'text-red-600'}`}>
                        {isPos ? '+' : '-'}{fmt(t.amount)} ₫
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          t.status === 'completed' ? 'bg-green-100 text-green-700' :
                          t.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {t.status === 'completed' ? 'Hoàn tất' : t.status === 'pending' ? 'Đang xử lý' : 'Thất bại'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-400 whitespace-nowrap">
                        {new Date(t.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} total={total} onPage={fetchData} />
      </div>
    </div>
  );
}