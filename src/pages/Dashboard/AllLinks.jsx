import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { Link2, Copy, EyeOff, ExternalLink, MousePointer, Wallet, CheckCircle, Globe, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { formatMoney as fmt } from '../../lib/format';

const BASE = window.location.origin;

export default function AllLinks() {
  usePageTitle('Tất cả liên kết');
  const navigate = useNavigate();

  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [destUrl, setDestUrl] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [copied, setCopied] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2500);
  };

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
      showToast('Tạo link thành công!');
      closePanel(); await load();
    } catch (e) { setFormErr(e.message || 'Lỗi tạo link'); }
    finally { setCreating(false); }
  };

  const hideLink = async (id) => {
    if (!confirm('Ẩn link này?')) return;
    try { await api.put(`/shortlink/links/${id}/hide`); setLinks(prev => prev.filter(l => l.id !== id)); showToast('Đã ẩn link'); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const copyLink = (slug) => {
    navigator.clipboard.writeText(`${BASE}/vuot-link/${slug}`);
    setCopied(slug); setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', background: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#BBF7D0'}`, color: toast.type === 'error' ? '#DC2626' : '#16A34A' }}>
          {toast.msg}
        </div>
      )}

      {/* Right-side panel overlay */}
      {panelOpen && <div onClick={closePanel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 1001, background: '#fff', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)', transform: panelOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: 17, color: '#0F172A', margin: 0 }}>Tạo link kiếm tiền</h3>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>Người click phải vượt link → bạn nhận tiền</p>
          </div>
          <button onClick={closePanel} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color="#64748B" />
          </button>
        </div>
        <form onSubmit={create} style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>URL đích <span style={{ color: '#EF4444' }}>*</span></label>
            <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>Người dùng được chuyển đến đây sau khi hoàn thành</p>
            <input value={destUrl} onChange={e => setDestUrl(e.target.value)} autoFocus placeholder="https://example.com/noi-dung"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${formErr && !destUrl ? '#FCA5A5' : '#E2E8F0'}`, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Tiêu đề <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>(tùy chọn)</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Tải xuống file XYZ"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {formErr && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', fontWeight: 600 }}>{formErr}</div>}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 700, marginBottom: 4 }}>💡 Cách hoạt động</p>
            <ul style={{ fontSize: 12, color: '#3B82F6', margin: 0, padding: '0 0 0 16px', lineHeight: 1.7 }}>
              <li>Hệ thống tạo link <strong>/vuot-link/xxxxxxx</strong></li>
              <li>Người click phải vượt link trước</li>
              <li>Hoàn thành → redirect đến URL của bạn</li>
              <li>Bạn nhận <strong>CPC</strong> mỗi lượt hoàn thành</li>
            </ul>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
            <button type="submit" disabled={creating} style={{ flex: 1, padding: '12px 0', borderRadius: 11, border: 'none', background: creating ? '#93C5FD' : 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: creating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {creating ? 'Đang tạo...' : <><Plus size={15} /> Tạo link</>}
            </button>
            <button type="button" onClick={closePanel} style={{ padding: '12px 18px', borderRadius: 11, border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Hủy</button>
          </div>
        </form>
      </div>

      <Breadcrumb items={[{ label: 'Dashboard', to: '/worker/dashboard' }, { label: 'Tất cả liên kết' }]} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tất cả liên kết</h1>
        </div>
        <button onClick={openPanel} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#3B82F6,#2563EB)', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
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
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-3 px-5 font-medium text-xs uppercase tracking-wider">Tiêu đề / URL đích</th>
                  <th className="py-3 px-4 font-medium text-xs uppercase tracking-wider">Link chia sẻ</th>
                  <th className="py-3 px-4 font-medium text-xs uppercase tracking-wider text-center">Lượt vào</th>
                  <th className="py-3 px-4 font-medium text-xs uppercase tracking-wider text-center">Hoàn thành</th>
                  <th className="py-3 px-4 font-medium text-xs uppercase tracking-wider text-right">Thu nhập</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-5 max-w-[200px]">
                      <p className="font-semibold text-slate-700 text-xs truncate">{l.title || '—'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{l.destination_url}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-blue-600 font-bold text-xs">/vuot-link/{l.slug}</span>
                        <button onClick={() => copyLink(l.slug)} className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${copied === l.slug ? 'bg-green-50 border-green-200 text-green-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                          {copied === l.slug ? '✔' : 'Copy'}
                        </button>
                        <a href={`/vuot-link/${l.slug}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors"><ExternalLink size={12} /></a>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-600 text-xs">{fmt(l.click_count)}</td>
                    <td className="py-3 px-4 text-center font-semibold text-emerald-600 text-xs">{fmt(l.completed_count)}</td>
                    <td className="py-3 px-4 text-right font-bold text-orange-500 text-xs">+{fmt(l.earning)} đ</td>
                    <td className="py-3 px-4">
                      <button onClick={() => hideLink(l.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors">
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
