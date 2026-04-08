import { useState, useEffect, useCallback } from 'react';
import {
  Link2, Search, Trash2, Eye, EyeOff, RefreshCw,
  ExternalLink, ChevronLeft, ChevronRight, MousePointerClick,
  CheckCircle2, DollarSign, Filter, Copy, Check,
} from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';

const BASE_URL = window.location.origin;

function StatCard({ icon: Icon, label, value, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    sky:    'bg-sky-50 text-sky-600 border-sky-100',
    emerald:'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber:  'bg-amber-50 text-amber-600 border-amber-100',
    rose:   'bg-rose-50 text-rose-600 border-rose-100',
  };
  return (
    <div className={`flex items-center gap-3 p-4 rounded-2xl border ${colors[color]}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function CopySlug({ slug }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${BASE_URL}/vuot-link/${slug}`;
  const copy = () => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy link đầy đủ"
      className="inline-flex items-center gap-1 text-xs font-mono text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-2 py-0.5 transition"
    >
      {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
      {slug}
    </button>
  );
}

export default function AdminWorkerLinks() {
  const toast = useToast();

  const [links, setLinks]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const LIMIT = 50;

  // filters
  const [search, setSearch]       = useState('');
  const [hiddenFilter, setHiddenFilter] = useState('all'); // all | 0 | 1
  const [workerIdFilter, setWorkerIdFilter] = useState('');

  const [confirm, setConfirm]     = useState(null); // {id, slug}

  const fetch = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p,
        limit: LIMIT,
        ...(search && { search }),
        ...(hiddenFilter !== 'all' && { hidden: hiddenFilter }),
        ...(workerIdFilter && { workerId: workerIdFilter }),
      });
      const data = await api.get(`/admin/worker-links?${params}`);
      setLinks(data.links || []);
      setTotal(data.total || 0);
      setStats(data.stats || null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, hiddenFilter, workerIdFilter]);

  useEffect(() => { fetch(1); setPage(1); }, [search, hiddenFilter, workerIdFilter]); // eslint-disable-line
  useEffect(() => { fetch(page); }, [page]); // eslint-disable-line

  const toggleHidden = async (id) => {
    try {
      await api.put(`/admin/worker-links/${id}/toggle-hidden`);
      setLinks(prev => prev.map(l => l.id === id ? { ...l, hidden: l.hidden ? 0 : 1 } : l));
    } catch (err) { toast.error(err.message); }
  };

  const deleteLink = async (id) => {
    try {
      await api.delete(`/admin/worker-links/${id}`);
      toast.success('Đã xóa link');
      setConfirm(null);
      fetch(page);
    } catch (err) { toast.error(err.message); }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Link2 size={22} className="text-indigo-600" />
            Quản lý liên kết
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Tất cả shortlink của worker trên hệ thống</p>
        </div>
        <button
          onClick={() => fetch(page)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard icon={Link2}            label="Tổng link"     value={fmt(stats.total_links)}     color="indigo" />
          <StatCard icon={MousePointerClick} label="Lượt click"   value={fmt(stats.total_clicks)}    color="sky" />
          <StatCard icon={CheckCircle2}     label="Hoàn thành"    value={fmt(stats.total_completed)}  color="emerald" />
          <StatCard icon={DollarSign}       label="Tổng thu nhập" value={`${fmt(stats.total_earning)}đ`} color="amber" />
          <StatCard icon={EyeOff}           label="Đang ẩn"       value={fmt(stats.total_hidden)}    color="rose" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm slug, URL, tên worker, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Worker ID */}
          <input
            type="number"
            placeholder="Worker ID"
            value={workerIdFilter}
            onChange={e => setWorkerIdFilter(e.target.value)}
            className="w-32 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />

          {/* Hidden filter */}
          <div className="flex items-center gap-1 text-sm">
            <Filter size={13} className="text-slate-400" />
            {[
              { v: 'all', label: 'Tất cả' },
              { v: '0',   label: 'Đang hiện' },
              { v: '1',   label: 'Đang ẩn' },
            ].map(f => (
              <button key={f.v}
                onClick={() => setHiddenFilter(f.v)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition text-xs ${
                  hiddenFilter === f.v
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Tìm thấy <strong className="text-slate-700">{fmt(total)}</strong> liên kết
        </p>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Link / Tiêu đề</th>
                <th className="px-4 py-3 text-left">URL đích</th>
                <th className="px-4 py-3 text-left">Worker</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">Done</th>
                <th className="px-4 py-3 text-right">Thu nhập</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-center">Ngày tạo</th>
                <th className="px-4 py-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Đang tải...</span>
                    </div>
                  </td>
                </tr>
              ) : links.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Link2 size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Không có liên kết nào</p>
                  </td>
                </tr>
              ) : links.map(link => (
                <tr key={link.id} className={`hover:bg-slate-50 transition ${link.hidden ? 'opacity-50' : ''}`}>
                  {/* Link / Title */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <CopySlug slug={link.slug} />
                      {link.title && (
                        <p className="text-xs text-slate-500 truncate max-w-[160px]">{link.title}</p>
                      )}
                    </div>
                  </td>

                  {/* Destination URL */}
                  <td className="px-4 py-3 max-w-[200px]">
                    <a
                      href={link.destination_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-600 hover:text-indigo-600 flex items-center gap-1 truncate"
                    >
                      <span className="truncate">{link.destination_url}</span>
                      <ExternalLink size={10} className="flex-shrink-0" />
                    </a>
                  </td>

                  {/* Worker */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{link.worker_name || '—'}</p>
                      <p className="text-[10px] text-slate-400">{link.worker_email}</p>
                      <p className="text-[10px] text-slate-300">ID: {link.worker_id}</p>
                    </div>
                  </td>

                  {/* Clicks */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-sky-700">{fmt(link.click_count)}</span>
                  </td>

                  {/* Done */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-emerald-700">{fmt(link.completed_count)}</span>
                  </td>

                  {/* Earning */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-bold text-amber-700">{fmt(link.earning)}đ</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    {link.hidden ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                        <EyeOff size={9} /> Ẩn
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        <Eye size={9} /> Hiện
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-center text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(link.created_at).toLocaleDateString('vi-VN')}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => toggleHidden(link.id)}
                        title={link.hidden ? 'Hiện link' : 'Ẩn link'}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                      >
                        {link.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        onClick={() => setConfirm({ id: link.id, slug: link.slug })}
                        title="Xóa link"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Trang {page}/{totalPages} · {fmt(total)} link
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={pg}
                    onClick={() => setPage(pg)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                      pg === page ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-slate-800">Xóa liên kết?</p>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-5">
              <p className="text-xs font-mono text-slate-600">/vuot-link/<strong>{confirm.slug}</strong></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                Hủy
              </button>
              <button onClick={() => deleteLink(confirm.id)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
