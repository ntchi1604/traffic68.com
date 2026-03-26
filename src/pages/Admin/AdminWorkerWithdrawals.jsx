import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

export default function AdminWorkerWithdrawals() {
  usePageTitle('Admin - Rút tiền Worker');
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [processingBatch, setProcessingBatch] = useState(false);

  const fetch = () => {
    setLoading(true);
    api.get(`/admin/worker-withdrawals?status=${filter}`)
      .then(d => { setRows(d.withdrawals || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [filter]);

  const handleAction = async (id, action) => {
    if (action === 'reject' && !await toast.confirm('Từ chối yêu cầu rút tiền này?')) return;
    try {
      const privateKey = localStorage.getItem('web3_hot_wallet_pk') || '';
      await api.put(`/admin/worker-withdrawals/${id}`, { action, privateKey });
      toast.success(action === 'approve' ? 'Đã duyệt' : 'Đã từ chối');
      fetch();
    } catch (err) { toast.error(err.message); }
  };

  const handleBulkAction = async (action) => {
    const text = action === 'approve' ? 'Duyệt tất cả' : 'Từ chối tất cả';
    if (!await toast.confirm(`Xác nhận ${text.toLowerCase()} ${rows.length} yêu cầu?`)) return;
    setProcessingBatch(true);
    try {
      const privateKey = localStorage.getItem('web3_hot_wallet_pk') || '';
      const { ids } = await api.put('/admin/worker-withdrawals/bulk', { 
        action, 
        ids: rows.map(r => r.id),
        privateKey
      });
      toast.success(`Đã xử lý ${ids.length} yêu cầu`);
      fetch();
    } catch (err) {
      toast.error(err.message || 'Lỗi xử lý hàng loạt');
    } finally {
      setProcessingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Rút tiền</h1>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          {[['pending', 'Chờ duyệt'], ['completed', 'Đã duyệt'], ['rejected', 'Từ chối'], ['all', 'Tất cả']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} disabled={processingBatch}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition ${filter === v ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:opacity-50`}>{l}</button>
          ))}
        </div>

        {filter === 'pending' && rows.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('approve')} disabled={processingBatch}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              {processingBatch ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
              {processingBatch ? 'Đang xử lý...' : `Duyệt tất cả (${rows.length})`}
            </button>
            <button
              onClick={() => handleBulkAction('reject')} disabled={processingBatch}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              <XCircle size={14} />
              Từ chối tất cả
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">Mã</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">Worker</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Số tiền</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">Thông tin TK</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-500">Trạng thái</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Ngày</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-500">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Không có yêu cầu</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.ref_code}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 text-xs">{r.user_name || '—'}</p>
                    <p className="text-[10px] text-slate-400">{r.user_email || ''}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800 text-xs">{fmt(r.amount)} đ</td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-[260px]">
                    {(() => {
                      const parts = (r.note || '').split(' | Nguồn: ');
                      const txMatch = (r.note || '').match(/TxHash:\s*(0x[a-fA-F0-9]+)/);
                      return (
                        <>
                          <p className="truncate font-medium">{parts[0] || '—'}</p>
                          {parts[1] && <p className="text-[10px] text-blue-600 mt-0.5 truncate">Nguồn: {parts[1].split(' | ')[0]}</p>}
                          {txMatch && (
                            <a href={`https://bscscan.com/tx/${txMatch[1]}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1 text-[10px] text-amber-600 hover:text-amber-700 font-mono">
                              <svg width="10" height="10" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#F3BA2F"/></svg>
                              {txMatch[1].slice(0, 10)}...{txMatch[1].slice(-6)} ↗
                            </a>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                      ${r.status === 'completed' ? 'bg-green-50 text-green-600' : r.status === 'rejected' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
                      {r.status === 'completed' ? <CheckCircle2 size={10} /> : r.status === 'rejected' ? <XCircle size={10} /> : <Clock size={10} />}
                      {r.status === 'completed' ? 'Đã duyệt' : r.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 text-xs">
                    {new Date(r.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.status === 'pending' ? (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleAction(r.id, 'approve')}
                          className="px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold rounded-lg transition">Duyệt</button>
                        <button onClick={() => handleAction(r.id, 'reject')}
                          className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg transition">Từ chối</button>
                      </div>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
