import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Link2, Plus, Copy, Trash2, ExternalLink, MousePointer, Wallet, Zap, CheckCircle, Globe } from 'lucide-react';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const BASE = window.location.origin;

export default function WorkerShortLinks() {
  usePageTitle('Link kiếm tiền');

  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [destUrl, setDestUrl] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([api.get('/shortlink/links'), api.get('/shortlink/stats')]);
      setLinks(l.links || []);
      setStats(s || {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!destUrl.trim()) return showToast('Nhập URL đích', 'error');
    setCreating(true);
    try {
      const data = await api.post('/shortlink/create', { destination_url: destUrl.trim(), title: title.trim() || null });
      showToast('Tạo link thành công!');
      setDestUrl(''); setTitle(''); setShowForm(false);
      await load();
    } catch (e) { showToast(e.message || 'Lỗi tạo link', 'error'); }
    finally { setCreating(false); }
  };

  const deleteLink = async (id) => {
    if (!confirm('Xóa link này?')) return;
    try {
      await api.delete(`/shortlink/links/${id}`);
      setLinks(prev => prev.filter(l => l.id !== id));
      showToast('Đã xóa');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const copyLink = (slug) => {
    navigator.clipboard.writeText(`${BASE}/v/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  };

  const kpis = [
    { label: 'Tổng link', value: stats.total_links || 0, icon: Link2, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Lượt vào', value: fmt(stats.total_clicks || 0), icon: MousePointer, color: '#8B5CF6', bg: '#F5F3FF' },
    { label: 'Hoàn thành', value: fmt(stats.total_completed || 0), icon: CheckCircle, color: '#10B981', bg: '#ECFDF5' },
    { label: 'Thu nhập', value: `${fmt(stats.total_earning || 0)} đ`, icon: Wallet, color: '#F97316', bg: '#FFF7ED' },
  ];

  return (
    <div style={{ paddingBottom: 40, fontFamily: 'Inter, sans-serif' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px',
          borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          background: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
          color: toast.type === 'error' ? '#DC2626' : '#16A34A',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>Link kiếm tiền</h1>
          <p style={{ color: '#64748B', fontSize: 14 }}>
            Nhập URL bạn muốn chia sẻ → hệ thống tạo link. Người click link phải vượt link trước → bạn nhận tiền.
          </p>
        </div>
        <button onClick={() => setShowForm(p => !p)} style={{
          padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: '#3B82F6', color: '#fff', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16,
        }}>
          <Plus size={16} /> Tạo link mới
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{k.label}</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#0F172A' }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #3B82F6', padding: 20, marginBottom: 16, boxShadow: '0 0 0 3px rgba(59,130,246,0.08)' }}>
          <h3 style={{ fontWeight: 800, color: '#1E293B', marginBottom: 16, fontSize: 15 }}>Tạo link kiếm tiền mới</h3>
          <form onSubmit={create}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6 }}>
                URL đích (người dùng sẽ được chuyển tới đây sau khi hoàn thành) *
              </label>
              <input
                value={destUrl} onChange={e => setDestUrl(e.target.value)}
                placeholder="https://example.com/file-download"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6 }}>
                Tiêu đề (tùy chọn — hiển thị cho người click)
              </label>
              <input
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ví dụ: Tải xuống file XYZ"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={creating} style={{
                padding: '10px 24px', borderRadius: 10, border: 'none', cursor: creating ? 'not-allowed' : 'pointer',
                background: '#3B82F6', color: '#fff', fontWeight: 700, fontSize: 14, opacity: creating ? 0.7 : 1,
              }}>
                {creating ? 'Đang tạo...' : 'Tạo link'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{
                padding: '10px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0',
                background: '#fff', color: '#64748B', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Links table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 800, fontSize: 14, color: '#1E293B' }}>
          Danh sách link ({links.length})
        </div>
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#94A3B8' }}>Đang tải...</div>
        ) : links.length === 0 ? (
          <div style={{ padding: '56px 0', textAlign: 'center' }}>
            <Globe size={40} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}>Chưa có link nào</p>
            <p style={{ fontSize: 13, color: '#94A3B8' }}>Tạo link đầu tiên để bắt đầu kiếm tiền</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#F8FAFC' }}>
              <tr>
                {['Tiêu đề / URL đích', 'Link chia sẻ', 'Vào', 'Hoàn thành', 'Thu nhập', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                    <p style={{ fontWeight: 700, color: '#1E293B', marginBottom: 2 }}>{l.title || '—'}</p>
                    <p style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.destination_url}</p>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', color: '#3B82F6', fontWeight: 700 }}>/v/{l.slug}</span>
                      <button onClick={() => copyLink(l.slug)} style={{
                        padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0',
                        background: copied === l.slug ? '#F0FDF4' : '#F8FAFC',
                        cursor: 'pointer', color: copied === l.slug ? '#16A34A' : '#64748B', fontSize: 11, fontWeight: 700,
                      }}>
                        {copied === l.slug ? '✓' : <Copy size={12} />}
                      </button>
                      <a href={`/v/${l.slug}`} target="_blank" rel="noreferrer" style={{ color: '#94A3B8' }}>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#64748B' }}>{fmt(l.click_count)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#10B981' }}>{fmt(l.completed_count)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#F97316' }}>+{fmt(l.earning)} đ</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => deleteLink(l.id)} style={{
                      padding: '5px 10px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FEF2F2',
                      cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
                    }}>
                      <Trash2 size={12} /> Xóa
                    </button>
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
