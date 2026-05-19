import { useState, useEffect } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Search, X, Pause, Play, CheckCircle, ExternalLink } from 'lucide-react';
import api from '../../lib/api';

const STATUS_COLORS = {
  running:   { cls: 'bg-green-100 text-green-700',  label: 'Dang chay' },
  paused:    { cls: 'bg-yellow-100 text-yellow-700', label: 'Tam dung' },
  completed: { cls: 'bg-blue-100 text-blue-700',     label: 'Hoan thanh' },
  pending:   { cls: 'bg-gray-100 text-gray-600',     label: 'Cho duyet' },
};

const STATUS_FILTERS = [
  { value: '',          label: 'Tat ca' },
  { value: 'running',   label: 'Dang chay' },
  { value: 'paused',    label: 'Tam dung' },
  { value: 'completed', label: 'Hoan thanh' },
  { value: 'pending',   label: 'Cho duyet' },
];

export default function AgencyAdminCampaigns() {
  usePageTitle('Agency Admin - Chien dich');
  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const fetchData = (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    api.get(`/agency-admin/campaigns?${params}`)
      .then(data => { setCampaigns(data.campaigns || []); setTotal(data.total || 0); setPage(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(1); }, [search, statusFilter]);

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/agency-admin/campaigns/${id}/status`, { status });
      fetchData(page);
    } catch (err) { console.error(err.message); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Tim theo ten, URL, keyword..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition">Tim kiem</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition">
              <X size={14} />
            </button>
          )}
        </form>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Trang thai:</span>
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                statusFilter === f.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="font-semibold">Khong co chien dich nao</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['ID', 'Ten / URL', 'Keyword', 'Nguoi dung', 'Loai traffic', 'Luot xem', 'Trang thai', 'Hom nay', 'Hanh dong'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map(c => {
                const st = STATUS_COLORS[c.status] || STATUS_COLORS.pending;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{c.id}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-semibold text-slate-800 text-xs truncate">{c.name || c.url}</p>
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-indigo-500 hover:underline flex items-center gap-0.5 truncate">
                          {c.url} <ExternalLink size={9} />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[120px] truncate">{c.keyword || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-700">{c.user_name || '—'}</p>
                      <p className="text-[10px] text-slate-400">{c.user_email || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{c.traffic_type || '—'}</td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      <span className="font-bold text-slate-700">{c.views_done ?? 0}</span>
                      <span className="text-slate-400"> / {c.views_total ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-indigo-600 tabular-nums">{c.views_today ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {c.status === 'running' && (
                          <button onClick={() => changeStatus(c.id, 'paused')} title="Tam dung"
                            className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600 transition">
                            <Pause size={14} />
                          </button>
                        )}
                        {(c.status === 'paused' || c.status === 'pending') && (
                          <button onClick={() => changeStatus(c.id, 'running')} title="Chay lai"
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition">
                            <Play size={14} />
                          </button>
                        )}
                        {c.status !== 'completed' && (
                          <button onClick={() => changeStatus(c.id, 'completed')} title="Hoan thanh"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition">
                            <CheckCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-5 py-3 shadow-sm">
          <p className="text-xs text-slate-500">
            Trang <span className="font-bold text-slate-700">{page}</span> / {totalPages}
            <span className="ml-2 text-slate-400">({total} chien dich)</span>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => fetchData(page - 1)} disabled={page === 1}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              &lsaquo; Truoc
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, [])
              .map((p, i) => p === '...' ? (
                <span key={`d${i}`} className="px-1 text-slate-400 text-xs">&hellip;</span>
              ) : (
                <button key={p} onClick={() => fetchData(p)}
                  className={`w-8 h-8 text-xs font-bold rounded-lg transition ${
                    page === p ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 border border-slate-200 text-slate-600'
                  }`}>{p}</button>
              ))
            }
            <button onClick={() => fetchData(page + 1)} disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              Sau &rsaquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
