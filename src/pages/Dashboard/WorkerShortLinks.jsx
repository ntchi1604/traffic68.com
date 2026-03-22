import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Link2, Plus, Copy, Trash2, ExternalLink, MousePointer, Wallet, CheckCircle, Globe, X, Globe2 } from 'lucide-react';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const BASE = window.location.origin;

export default function WorkerShortLinks() {
  usePageTitle('Link kiáº¿m tiá»n');

  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [destUrl, setDestUrl] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [toast, setToast] = useState(null);
  const [formErr, setFormErr] = useState('');

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

  const openPanel = () => { setDestUrl(''); setTitle(''); setFormErr(''); setPanelOpen(true); };
  const closePanel = () => setPanelOpen(false);

  const create = async (e) => {
    e.preventDefault();
    setFormErr('');
    if (!destUrl.trim()) return setFormErr('Vui lÃ²ng nháº­p URL Ä‘Ã­ch');
    try { new URL(destUrl.trim()); } catch { return setFormErr('URL khÃ´ng há»£p lá»‡'); }
    setCreating(true);
    try {
      await api.post('/shortlink/create', { destination_url: destUrl.trim(), title: title.trim() || null });
      showToast('Táº¡o link thÃ nh cÃ´ng!');
      closePanel();
      await load();
    } catch (e) { setFormErr(e.message || 'Lá»—i táº¡o link'); }
    finally { setCreating(false); }
  };

  const deleteLink = async (id) => {
    if (!confirm('XÃ³a link nÃ y?')) return;
    try {
      await api.delete(`/shortlink/links/${id}`);
      setLinks(prev => prev.filter(l => l.id !== id));
      showToast('ÄÃ£ xÃ³a');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const copyLink = (slug) => {
    navigator.clipboard.writeText(`${BASE}/vuot-link/${slug}`);
    setCopied(slug); setTimeout(() => setCopied(null), 1500);
  };

  const kpis = [
    { label: 'Tá»•ng link', value: stats.total_links || 0, icon: Link2, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'LÆ°á»£t vÃ o', value: fmt(stats.total_clicks || 0), icon: MousePointer, color: '#8B5CF6', bg: '#F5F3FF' },
    { label: 'HoÃ n thÃ nh', value: fmt(stats.total_completed || 0), icon: CheckCircle, color: '#10B981', bg: '#ECFDF5' },
    { label: 'Thu nháº­p', value: `${fmt(stats.total_earning || 0)} Ä‘`, icon: Wallet, color: '#F97316', bg: '#FFF7ED' },
  ];

  return (
    <div style={{ paddingBottom: 40, fontFamily: 'Inter, sans-serif' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px',
          borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          background: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
          color: toast.type === 'error' ? '#DC2626' : '#16A34A',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Right-side panel overlay */}
      {panelOpen && (
        <div
          onClick={closePanel}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000, backdropFilter: 'blur(2px)' }}
        />
      )}
      {/* Slide-in panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 1001,
        background: '#fff', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
        transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Panel header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: 17, color: '#0F172A', margin: 0 }}>Táº¡o link kiáº¿m tiá»n</h3>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>NgÆ°á»i click link pháº£i vÆ°á»£t link trÆ°á»›c â†’ báº¡n nháº­n tiá»n</p>
          </div>
          <button onClick={closePanel} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color="#64748B" />
          </button>
        </div>

        {/* Panel body */}
        <form onSubmit={create} style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              URL Ä‘Ã­ch <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>NgÆ°á»i dÃ¹ng sáº½ Ä‘Æ°á»£c chuyá»ƒn Ä‘áº¿n Ä‘Ã¢y sau khi hoÃ n thÃ nh</p>
            <div style={{ position: 'relative' }}>
              <Globe2 size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                value={destUrl} onChange={e => setDestUrl(e.target.value)} autoFocus
                placeholder="https://example.com/noi-dung"
                style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 10, border: `1.5px solid ${formErr && !destUrl ? '#FCA5A5' : '#E2E8F0'}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#1E293B' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              TiÃªu Ä‘á» <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>(tÃ¹y chá»n â€” hiá»ƒn thá»‹ cho ngÆ°á»i click)</span>
            </label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="VÃ­ dá»¥: Táº£i xuá»‘ng file XYZ"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#1E293B' }}
            />
          </div>

          {formErr && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
              {formErr}
            </div>
          )}

          {/* Info box */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 700, marginBottom: 4 }}>ðŸ’¡ CÃ¡ch hoáº¡t Ä‘á»™ng</p>
            <ul style={{ fontSize: 12, color: '#3B82F6', margin: 0, padding: '0 0 0 16px', lineHeight: 1.7 }}>
              <li>Há»‡ thá»‘ng táº¡o link <strong>/v/xxxxxxx</strong></li>
              <li>Chia sáº» link â†’ ngÆ°á»i dÃ¹ng click</li>
              <li>Há» pháº£i vÆ°á»£t link (nháº­p code) trÆ°á»›c</li>
              <li>HoÃ n thÃ nh â†’ há» Ä‘Æ°á»£c chuyá»ƒn Ä‘áº¿n URL cá»§a báº¡n</li>
              <li>Báº¡n nháº­n <strong>CPC</strong> cho má»—i lÆ°á»£t hoÃ n thÃ nh</li>
            </ul>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
            <button type="submit" disabled={creating} style={{
              flex: 1, padding: '12px 0', borderRadius: 11, border: 'none',
              background: creating ? '#93C5FD' : 'linear-gradient(135deg,#3B82F6,#2563EB)',
              color: '#fff', fontWeight: 700, fontSize: 14, cursor: creating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {creating ? 'Äang táº¡o...' : <><Plus size={15} /> Táº¡o link</>}
            </button>
            <button type="button" onClick={closePanel} style={{
              padding: '12px 18px', borderRadius: 11, border: '1.5px solid #E2E8F0',
              background: '#fff', color: '#64748B', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
              Há»§y
            </button>
          </div>
        </form>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', marginBottom: 2 }}>Link kiáº¿m tiá»n</h1>
          <p style={{ color: '#64748B', fontSize: 13 }}>Nháº­p URL báº¡n muá»‘n chia sáº» â€” há»‡ thá»‘ng táº¡o link. NgÆ°á»i click link pháº£i vÆ°á»£t link trÆ°á»›c â†’ báº¡n nháº­n tiá»n.</p>
        </div>
        <button onClick={openPanel} style={{
          padding: '10px 18px', borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0, marginLeft: 16,
          background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
        }}>
          <Plus size={16} /> Táº¡o link má»›i
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={17} style={{ color: k.color }} />
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{k.label}</p>
              <p style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Links table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#1E293B' }}>Táº¥t cáº£ liÃªn káº¿t ({links.length})</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Äang táº£i...</div>
        ) : links.length === 0 ? (
          <div style={{ padding: '56px 0', textAlign: 'center' }}>
            <Globe size={40} style={{ color: '#CBD5E1', display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}>ChÆ°a cÃ³ link nÃ o</p>
            <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>Táº¡o link Ä‘áº§u tiÃªn Ä‘á»ƒ báº¯t Ä‘áº§u kiáº¿m tiá»n</p>
            <button onClick={openPanel} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#3B82F6', color: '#fff', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Táº¡o link ngay
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#F8FAFC' }}>
              <tr>
                {['TiÃªu Ä‘á» / URL Ä‘Ã­ch', 'Link chia sáº»', 'VÃ o', 'HoÃ n thÃ nh', 'Thu nháº­p', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '12px 16px', maxWidth: 200 }}>
                    <p style={{ fontWeight: 700, color: '#1E293B', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title || 'â€”'}</p>
                    <p style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{l.destination_url}</p>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', color: '#3B82F6', fontWeight: 700 }}>/v/{l.slug}</span>
                      <button onClick={() => copyLink(l.slug)} title="Copy link" style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: copied === l.slug ? '#F0FDF4' : '#F8FAFC', cursor: 'pointer', color: copied === l.slug ? '#16A34A' : '#64748B', fontSize: 11, fontWeight: 700 }}>
                        {copied === l.slug ? 'âœ“' : <Copy size={12} />}
                      </button>
                      <a href={`/vuot-link/${l.slug}`} target="_blank" rel="noreferrer" style={{ color: '#94A3B8' }}><ExternalLink size={12} /></a>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#64748B' }}>{fmt(l.click_count)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#10B981' }}>{fmt(l.completed_count)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#F97316' }}>+{fmt(l.earning)} Ä‘</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => deleteLink(l.id)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                      <Trash2 size={12} /> XÃ³a
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

