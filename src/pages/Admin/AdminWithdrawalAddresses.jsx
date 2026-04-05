import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { AlertTriangle, Building2, Bitcoin, RefreshCw, Search, Copy, CheckCircle2, TrendingDown, Clock } from 'lucide-react';
import api from '../../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

export default function AdminWithdrawalAddresses() {
  usePageTitle('Admin - Địa chỉ rút tiền');

  const [addresses, setAddresses] = useState([]);
  const [total, setTotal] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [totalDuplicateWithdrawn, setTotalDuplicateWithdrawn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedAddr, setCopiedAddr] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (duplicatesOnly) params.set('duplicates_only', '1');
      const d = await api.get(`/admin/withdrawal-addresses?${params}`);
      setAddresses(d.addresses || []);
      setTotal(d.total || 0);
      setDuplicateCount(d.duplicateCount || 0);
      setTotalDuplicateWithdrawn(d.totalDuplicateWithdrawn || 0);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [duplicatesOnly]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAddr(text);
      setTimeout(() => setCopiedAddr(null), 2000);
    });
  };

  const filtered = search
    ? addresses.filter(a =>
      a.address.toLowerCase().includes(search.toLowerCase()) ||
      a.users.some(u =>
        u.user_email?.toLowerCase().includes(search.toLowerCase()) ||
        u.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.display_info?.toLowerCase().includes(search.toLowerCase())
      )
    )
    : addresses;

  const duplicates = filtered.filter(a => a.is_duplicate);
  const singles = filtered.filter(a => !a.is_duplicate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Địa chỉ rút tiền</h1>
          <p className="text-sm text-slate-500 mt-1">Theo dõi địa chỉ ngân hàng & crypto — phát hiện tài khoản dùng chung</p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase">Tổng địa chỉ</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{total}</p>
        </div>
        <div className={`rounded-xl border p-5 ${duplicateCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs font-semibold uppercase flex items-center gap-1 ${duplicateCount > 0 ? 'text-red-500' : 'text-slate-500'}`}>
            {duplicateCount > 0 && <AlertTriangle size={12} />}
            Địa chỉ trùng lặp
          </p>
          <p className={`text-3xl font-black mt-1 ${duplicateCount > 0 ? 'text-red-600' : 'text-slate-300'}`}>{duplicateCount}</p>
          {duplicateCount > 0 && <p className="text-[11px] text-red-400 mt-1">⚠ Nhiều TK dùng chung địa chỉ</p>}
        </div>
        <div className={`rounded-xl border p-5 ${totalDuplicateWithdrawn > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs font-semibold uppercase flex items-center gap-1 ${totalDuplicateWithdrawn > 0 ? 'text-orange-600' : 'text-slate-500'}`}>
            <TrendingDown size={12} /> Đã rút (trùng)
          </p>
          <p className={`text-xl font-black mt-1 ${totalDuplicateWithdrawn > 0 ? 'text-orange-700' : 'text-slate-300'}`}>
            {fmt(totalDuplicateWithdrawn)}đ
          </p>
          <p className="text-[11px] text-orange-400 mt-1">Tổng đã duyệt từ địa chỉ trùng</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase">Địa chỉ duy nhất</p>
          <p className="text-3xl font-black text-green-600 mt-1">{total - duplicateCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm địa chỉ, email, tên..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setDuplicatesOnly(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition border ${duplicatesOnly ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'}`}
        >
          <AlertTriangle size={14} />
          {duplicatesOnly ? 'Đang lọc: Trùng lặp' : 'Chỉ xem trùng lặp'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <p className="font-medium">Không có dữ liệu địa chỉ rút tiền</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Duplicate addresses — highlighted */}
          {duplicates.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-black text-red-600">
                <AlertTriangle size={16} /> Địa chỉ trùng lặp ({duplicates.length})
              </h2>
              {duplicates.map((item) => (
                <AddressCard key={item.address} item={item} isDuplicate copiedAddr={copiedAddr} onCopy={copyToClipboard} />
              ))}
            </div>
          )}

          {/* Normal addresses */}
          {!duplicatesOnly && singles.length > 0 && (
            <div className="space-y-3">
              {duplicates.length > 0 && (
                <h2 className="text-sm font-bold text-slate-500 pt-2">Địa chỉ thông thường ({singles.length})</h2>
              )}
              {singles.map((item) => (
                <AddressCard key={item.address} item={item} isDuplicate={false} copiedAddr={copiedAddr} onCopy={copyToClipboard} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddressCard({ item, isDuplicate, copiedAddr, onCopy }) {
  const isCopied = copiedAddr === item.address;
  const isCrypto = item.method === 'crypto';
  const groupTotal = item.group_total_withdrawn || 0;

  return (
    <div className={`rounded-xl border p-4 ${isDuplicate ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {isCrypto
            ? <Bitcoin size={16} className={isDuplicate ? 'text-red-500 shrink-0' : 'text-amber-500 shrink-0'} />
            : <Building2 size={16} className={isDuplicate ? 'text-red-500 shrink-0' : 'text-indigo-500 shrink-0'} />
          }
          <span className={`font-mono text-sm font-bold truncate ${isDuplicate ? 'text-red-700' : 'text-slate-700'}`}>
            {item.address}
          </span>
          <button onClick={() => onCopy(item.address)}
            className="shrink-0 p-1 rounded hover:bg-slate-100 transition text-slate-400 hover:text-slate-600">
            {isCopied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isCrypto ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {isCrypto ? 'Crypto' : 'Bank'}
          </span>
          {isDuplicate && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 flex items-center gap-1">
              <AlertTriangle size={9} /> {item.count} tài khoản
            </span>
          )}
          {isDuplicate && groupTotal > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 flex items-center gap-1">
              <TrendingDown size={9} /> Nhóm đã rút: {fmt(groupTotal)}đ
            </span>
          )}
        </div>
      </div>

      {/* Users using this address */}
      <div className="mt-3 space-y-2">
        {item.users.map((u, i) => (
          <div key={u.user_id} className={`rounded-lg px-3 py-2.5 text-xs ${isDuplicate ? 'bg-red-100/60' : 'bg-slate-50'}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Left: user info */}
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isDuplicate ? 'bg-red-200 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{u.user_name || u.user_email}</p>
                  <p className="text-slate-400 truncate">{u.user_email}</p>
                </div>
              </div>
              {/* Right: withdrawal stats */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                {u.total_withdrawn_completed > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold text-[10px]">
                    <CheckCircle2 size={9} /> Đã duyệt: {fmt(u.total_withdrawn_completed)}đ
                  </span>
                )}
                {u.total_withdrawn_pending > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold text-[10px]">
                    <Clock size={9} /> Chờ: {fmt(u.total_withdrawn_pending)}đ
                  </span>
                )}
                {u.withdraw_count > 0 && (
                  <span className="text-slate-400 text-[10px]">{u.withdraw_count} lần rút</span>
                )}
              </div>
            </div>
            {/* Account detail + last used date */}
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-black/5">
              <p className="text-slate-500 truncate max-w-[200px]" title={u.display_info}>{u.display_info}</p>
              <p className="text-slate-400 text-[10px] shrink-0">{new Date(u.last_used).toLocaleDateString('vi-VN')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
