import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { Link2, Copy, EyeOff, ExternalLink, MousePointer, Wallet, CheckCircle, Globe, Plus, X, Check, Globe2 } from 'lucide-react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { formatMoney as fmt } from '../../lib/format';

const BASE = window.location.origin;

export default function AllLinks() {
  usePageTitle('Tất cả liên kết');
  const toast = useToast();

  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [destUrl, setDestUrl] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [copied, setCopied] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([api.get('/shortlink/links'), api.get('/shortlink/stats')]);
      setLinks(l.links || []);
      setStats(s || {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPanel = () => { setDestUrl(''); setTitle(''); setFormErr(''); setPanelOpen(true); };
  const closePanel = () => setPanelOpen(false);

  const create = async (e) => {
    e.preventDefault(); setFormErr('');
    if (!destUrl.trim()) return setFormErr('Vui lòng nhập URL đích');
    try { new URL(destUrl.trim()); } catch { return setFormErr('URL không hợp lệ'); }
    setCreating(true);
    try {
      await api.post('/shortlink/create', { destination_url: destUrl.trim(), title: title.trim() || null });
      toast.success('Tạo link thành công!');
      closePanel(); await load();
    } catch (e) { setFormErr(e.message || 'Lỗi tạo link'); }
    finally { setCreating(false); }
  };

  const hideLink = async (id) => {
    if (!await toast.confirm('Ẩn link này?')) return;
    try { await api.put(`/shortlink/links/${id}/hide`); setLinks(prev => prev.filter(l => l.id !== id)); toast.success('Đã ẩn link'); }
    catch (e) { toast.error(e.message); }
  };

  const copyLink = (slug) => {
    navigator.clipboard.writeText(`${BASE}/vuot-link/${slug}`);
    setCopied(slug); setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Slide-in panel overlay */}
      {panelOpen && <div onClick={closePanel} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000]" />}
      <div className="fixed top-0 right-0 bottom-0 w-[380px] z-[1001] bg-white shadow-2xl flex flex-col"
        style={{ transform: panelOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-[17px] text-slate-900">Tạo link kiếm tiền</h3>
            <p className="text-xs text-slate-400 mt-0.5">Người click phải vượt link → bạn nhận tiền</p>
          </div>
          <button onClick={closePanel} className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition">
            <X size={15} className="text-slate-500" />
          </button>
        </div>
        <form onSubmit={create} className="p-6 flex-1 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">URL đích <span className="text-red-400">*</span></label>
            <p className="text-[11px] text-slate-400 mb-2">Người dùng được chuyển đến đây sau khi hoàn thành</p>
            <div className="relative">
              <Globe2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={destUrl} onChange={e => setDestUrl(e.target.value)} autoFocus
                placeholder="https://example.com/noi-dung"
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 ${formErr && !destUrl ? 'border-red-300' : 'border-slate-200'}`}
                required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Tiêu đề <span className="text-[11px] text-slate-400 font-normal">(tùy chọn)</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Tải xuống file XYZ"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          {formErr && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-semibold">{formErr}</div>}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
            <p className="text-xs font-bold text-blue-700 mb-2">💡 Cách hoạt động</p>
            <ul className="text-xs text-blue-600 space-y-1 list-disc pl-4">
              <li>Hệ thống tạo link <strong>/vuot-link/xxxxxxx</strong></li>
              <li>Người click phải vượt link trước</li>
              <li>Hoàn thành → redirect đến URL của bạn</li>
              <li>Bạn nhận <strong>CPC</strong> mỗi lượt hoàn thành</li>
            </ul>
          </div>
          <div className="mt-auto flex gap-2.5">
            <button type="submit" disabled={creating}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 transition disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#3B82F6,#2563EB)' }}>
              {creating ? 'Đang tạo...' : <><Plus size={15} /> Tạo link</>}
            </button>
            <button type="button" onClick={closePanel}
              className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">
              Hủy
            </button>
          </div>
        </form>
      </div>

      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Tất cả liên kết' }]} />

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tất cả liên kết</h1>
        <button onClick={openPanel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white flex-shrink-0 transition hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#3B82F6,#2563EB)', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
          <Plus size={15} /> Tạo link mới
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng link', value: stats.total_links || 0, icon: Link2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Lượt vào', value: fmt(stats.total_clicks || 0), icon: MousePointer, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Hoàn thành', value: fmt(stats.total_completed || 0), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Thu nhập', value: `${fmt(stats.total_earning || 0)} đ`, icon: Wallet, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${k.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <k.icon size={18} className={k.color} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">{k.label}</p>
              <p className="text-xl font-black text-slate-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-slate-800 text-sm">Danh sách link ({links.length})</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Đang tải...</div>
        ) : links.length === 0 ? (
          <div className="py-16 text-center">
            <Globe size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-600 mb-1">Chưa có link nào</p>
            <p className="text-sm text-slate-400 mb-4">Tạo link đầu tiên để bắt đầu kiếm tiền</p>
            <button onClick={openPanel} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white" style={{ background: '#3B82F6' }}>
              <Plus size={14} /> Tạo link ngay
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="py-3 px-5 text-left font-semibold text-[11px] uppercase tracking-wider text-slate-400">Tiêu đề / URL đích</th>
                  <th className="py-3 px-4 text-left font-semibold text-[11px] uppercase tracking-wider text-slate-400">Link chia sẻ</th>
                  <th className="py-3 px-4 text-center font-semibold text-[11px] uppercase tracking-wider text-slate-400">Lượt vào</th>
                  <th className="py-3 px-4 text-center font-semibold text-[11px] uppercase tracking-wider text-slate-400">Hoàn thành</th>
                  <th className="py-3 px-4 text-right font-semibold text-[11px] uppercase tracking-wider text-slate-400">Thu nhập</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-blue-50/20 transition-colors group">

                    {/* Tiêu đề */}
                    <td className="py-4 px-5 max-w-[200px]">
                      <p className="font-semibold text-slate-700 text-xs truncate">
                        {l.title || <span className="text-slate-300 italic font-normal">Không có tiêu đề</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{l.destination_url}</p>
                    </td>

                    {/* Link chia sẻ — redesigned pill */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        {/* Pill */}
                        <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg px-2.5 py-1.5 min-w-0 flex-1 max-w-[160px]">
                          <Link2 size={11} className="text-blue-400 flex-shrink-0" />
                          <span className="font-mono text-blue-700 font-bold text-[11px] truncate">
                            /vuot-link/<span className="text-indigo-600">{l.slug}</span>
                          </span>
                        </div>
                        {/* Copy */}
                        <button
                          onClick={() => copyLink(l.slug)}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all duration-200 flex-shrink-0 ${
                            copied === l.slug
                              ? 'bg-green-50 border-green-200 text-green-600 scale-95'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 hover:scale-105'
                          }`}
                        >
                          {copied === l.slug ? <><Check size={10} /> Đã copy!</> : <><Copy size={10} /> Copy</>}
                        </button>
                        {/* Open tab */}
                        <a href={`/vuot-link/${l.slug}`} target="_blank" rel="noreferrer"
                          className="w-6 h-6 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition flex-shrink-0">
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </td>

                    {/* Lượt vào */}
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-xs font-bold text-slate-600">
                        <MousePointer size={9} className="text-slate-400" /> {fmt(l.click_count)}
                      </span>
                    </td>

                    {/* Hoàn thành */}
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full text-xs font-bold text-emerald-600">
                        <CheckCircle size={9} /> {fmt(l.completed_count)}
                      </span>
                    </td>

                    {/* Thu nhập */}
                    <td className="py-4 px-4 text-right">
                      <span className="text-sm font-black text-orange-500">+{fmt(l.earning)} đ</span>
                    </td>

                    {/* Ẩn — chỉ hiện khi hover */}
                    <td className="py-4 px-4">
                      <button onClick={() => hideLink(l.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 border border-transparent hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-all opacity-0 group-hover:opacity-100">
                        <EyeOff size={11} /> Ẩn
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
