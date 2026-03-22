import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { EyeOff, Eye, Search, Copy, ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import { formatMoney as fmt } from '../../lib/format';

const BASE = window.location.origin;

export default function HiddenLinks() {
  usePageTitle('Liên kết ẩn');
  const [links, setLinks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/shortlink/links/hidden');
      setLinks(data.links || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const unhideLink = async (id) => {
    try {
      await api.put(`/shortlink/links/${id}/unhide`);
      setLinks(prev => prev.filter(l => l.id !== id));
      showToast('Đã hiện lại link');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const copyLink = (slug) => {
    navigator.clipboard.writeText(`${BASE}/vuot-link/${slug}`);
    setCopied(slug); setTimeout(() => setCopied(null), 1500);
  };

  const filtered = links.filter(l =>
    (l.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.destination_url || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.slug || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full min-w-0">
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', background: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#BBF7D0'}`, color: toast.type === 'error' ? '#DC2626' : '#16A34A' }}>
          {toast.msg}
        </div>
      )}

      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Liên kết ẩn' }]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Liên kết ẩn</h1>
        <p className="text-sm text-slate-500 mt-1">Các link đã ẩn — bạn có thể hiện lại bất cứ lúc nào</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <EyeOff size={48} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 font-medium">Không có liên kết ẩn</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-3 px-4 font-medium text-xs uppercase tracking-wider">Tiêu đề / URL đích</th>
                  <th className="py-3 px-4 font-medium text-xs uppercase tracking-wider">Link chia sẻ</th>
                  <th className="py-3 px-4 font-medium text-xs uppercase tracking-wider text-center">Lượt vào</th>
                  <th className="py-3 px-4 font-medium text-xs uppercase tracking-wider text-center">Hoàn thành</th>
                  <th className="py-3 px-4 font-medium text-xs uppercase tracking-wider text-right">Thu nhập</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 max-w-[200px]">
                      <p className="font-semibold text-slate-700 text-xs truncate">{l.title || '—'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{l.destination_url}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400 font-bold text-xs">/vuot-link/{l.slug}</span>
                        <button onClick={() => copyLink(l.slug)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${copied === l.slug ? 'bg-green-50 border-green-200 text-green-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                          {copied === l.slug ? '✔' : 'Copy'}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-400 text-xs">{fmt(l.click_count)}</td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-400 text-xs">{fmt(l.completed_count)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-400 text-xs">{fmt(l.earning)} đ</td>
                    <td className="py-3 px-4">
                      <button onClick={() => unhideLink(l.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
                        <Eye size={11} /> Hiện
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
