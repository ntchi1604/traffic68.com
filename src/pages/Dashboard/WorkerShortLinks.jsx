import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import { Link2, Plus, Copy, Trash2, ExternalLink, Search, TrendingUp, MousePointer, Wallet, Zap } from 'lucide-react';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const BASE = window.location.origin;

const TYPE_LABEL = { google_search: 'Google Search', social: 'Social', direct: 'Direct' };
const TYPE_COLOR = { google_search: '#3B82F6', social: '#8B5CF6', direct: '#10B981' };

export default function WorkerShortLinks() {
  usePageTitle('Link rút gọn của tôi');

  const [tab, setTab] = useState('links'); // 'links' | 'campaigns'
  const [links, setLinks] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null); // campaign_id being created
  const [copied, setCopied] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const loadLinks = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([
        api.get('/shortlink/links'),
        api.get('/shortlink/stats'),
      ]);
      setLinks(l.links || []);
      setStats(s || {});
    } catch (e) { console.error(e); }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const data = await api.get(`/shortlink/campaigns?search=${encodeURIComponent(search)}`);
      setCampaigns(data.campaigns || []);
    } catch (e) { console.error(e); }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadLinks(), loadCampaigns()]).finally(() => setLoading(false));
  }, [loadLinks, loadCampaigns]);

  const createLink = async (campaign_id) => {
    setCreating(campaign_id);
    try {
      const data = await api.post('/shortlink/create', { campaign_id });
      showToast(data.existing ? 'Bạn đã có link cho campaign này!' : 'Tạo link thành công!');
      await loadLinks();
      setTab('links');
    } catch (e) {
      showToast(e.message || 'Lỗi tạo link', 'error');
    } finally {
      setCreating(null);
    }
  };

  const deleteLink = async (id) => {
    if (!confirm('Xóa link này?')) return;
    try {
      await api.delete(`/shortlink/links/${id}`);
      setLinks(prev => prev.filter(l => l.id !== id));
      showToast('Đã xóa link');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const copyLink = (slug) => {
    navigator.clipboard.writeText(`${BASE}/v/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  };

  const kpis = [
    { label: 'Tổng link', value: stats.total_links || 0, icon: Link2, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Tổng click', value: fmt(stats.total_clicks || 0), icon: MousePointer, color: '#8B5CF6', bg: '#F5F3FF' },
    { label: 'Thu nhập', value: `${fmt(stats.total_earning || 0)} đ`, icon: Wallet, color: '#10B981', bg: '#ECFDF5' },
    { label: 'Hôm nay', value: `${fmt(stats.today_earning || 0)} đ`, icon: Zap, color: '#F97316', bg: '#FFF7ED' },
  ];

  return (
    <div style={{ padding: '0 0 40px', fontFamily: 'Inter, sans-serif' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
          color: toast.type === 'error' ? '#DC2626' : '#16A34A',
          padding: '10px 18px', borderRadius: 12, fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}>
          {toast.msg}
        </div>
      )}

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>Link rút gọn</h1>
      <p style={{ color: '#64748B', fontSize: 14, marginBottom: 20 }}>
        Tạo link rút gọn từ campaign, chia sẻ và kiếm tiền mỗi click
      </p>

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 16, maxWidth: 320 }}>
        {[['links', 'Link của tôi', links.length], ['campaigns', 'Chọn campaign', campaigns.length]].map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, transition: 'all .15s',
            background: tab === key ? '#fff' : 'transparent',
            color: tab === key ? '#0F172A' : '#94A3B8',
            boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
          }}>
            {label} {count > 0 && <span style={{ background: tab === key ? '#3B82F6' : '#CBD5E1', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', marginLeft: 4 }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Tab: My Links */}
      {tab === 'links' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94A3B8' }}>Đang tải...</div>
          ) : links.length === 0 ? (
            <div style={{ padding: '56px 0', textAlign: 'center' }}>
              <Link2 size={40} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}>Chưa có link nào</p>
              <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>Chọn campaign để tạo link rút gọn đầu tiên</p>
              <button onClick={() => setTab('campaigns')} style={{
                padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: '#3B82F6', color: '#fff', fontWeight: 700, fontSize: 13,
              }}>
                Chọn campaign
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#F8FAFC' }}>
                <tr>
                  {['Campaign', 'Link rút gọn', 'Clicks', 'Thu nhập', 'CPC', 'Hành động'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontWeight: 700, color: '#1E293B', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.campaign_name}</p>
                      <span style={{ fontSize: 10, background: TYPE_COLOR[l.traffic_type] + '20', color: TYPE_COLOR[l.traffic_type], borderRadius: 6, padding: '1px 6px', fontWeight: 700 }}>
                        {TYPE_LABEL[l.traffic_type] || l.traffic_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace', color: '#3B82F6', fontWeight: 700, fontSize: 13 }}>/v/{l.slug}</span>
                        <button onClick={() => copyLink(l.slug)} title="Copy" style={{
                          padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: copied === l.slug ? '#F0FDF4' : '#F8FAFC',
                          cursor: 'pointer', color: copied === l.slug ? '#16A34A' : '#64748B', fontSize: 11, fontWeight: 700,
                        }}>
                          {copied === l.slug ? '✓' : <Copy size={12} />}
                        </button>
                        <a href={`/v/${l.slug}`} target="_blank" rel="noreferrer" style={{ color: '#94A3B8' }}><ExternalLink size={12} /></a>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MousePointer size={13} style={{ color: '#8B5CF6' }} />
                        <span style={{ fontWeight: 700, color: '#1E293B' }}>{fmt(l.click_count)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#10B981' }}>+{fmt(l.earning)} đ</td>
                    <td style={{ padding: '12px 16px', color: '#F97316', fontWeight: 700 }}>{fmt(l.cpc)} đ</td>
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
      )}

      {/* Tab: Campaigns */}
      {tab === 'campaigns' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 14, maxWidth: 360 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm campaign..."
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {loading ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>Đang tải...</div>
            ) : campaigns.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                Không có campaign nào đang chạy
              </div>
            ) : campaigns.map(c => {
              const pct = Math.min(Math.round((c.views_done / Math.max(c.total_views, 1)) * 100), 100);
              const hasLink = c.my_links > 0;
              return (
                <div key={c.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8F0', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, color: '#1E293B', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.url}</p>
                    </div>
                    <span style={{ background: TYPE_COLOR[c.traffic_type] + '20', color: TYPE_COLOR[c.traffic_type], borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                      {TYPE_LABEL[c.traffic_type] || c.traffic_type}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
                      <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 2 }}>CPC</p>
                      <p style={{ fontSize: 16, fontWeight: 900, color: '#F97316' }}>{fmt(c.cpc)} đ</p>
                    </div>
                    <div style={{ flex: 1, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
                      <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 2 }}>Tiến độ</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>{pct}%</p>
                    </div>
                    {c.keyword && (
                      <div style={{ flex: 2, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
                        <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 2 }}>Từ khóa</p>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.keyword}</p>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 5, background: '#E2E8F0', borderRadius: 99 }}>
                    <div style={{ height: 5, borderRadius: 99, background: '#3B82F6', width: `${pct}%` }} />
                  </div>

                  <button
                    onClick={() => createLink(c.id)}
                    disabled={creating === c.id}
                    style={{
                      width: '100%', padding: '9px 0', borderRadius: 10, border: 'none', cursor: creating === c.id ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .15s',
                      background: hasLink ? '#F0FDF4' : '#3B82F6',
                      color: hasLink ? '#16A34A' : '#fff',
                      opacity: creating === c.id ? 0.7 : 1,
                    }}
                  >
                    {creating === c.id ? 'Đang tạo...' : hasLink ? '✓ Đã có link' : <><Plus size={14} /> Tạo link rút gọn</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
