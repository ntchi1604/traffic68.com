import { useState, useEffect } from 'react';
import {
  Copy, Check, Users, Gift, Sparkles, TrendingUp,
  ChevronLeft, ChevronRight, UserPlus, Link2,
  ArrowUpRight, Crown, Star, Zap, Heart,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import api from '../../lib/api';

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n);
const LIMIT = 20;

/* ── Stat Card ── */
function StatCard({ label, value, sub, Icon, color, bgLight, borderColor }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${borderColor}`, borderRadius: 18,
      padding: '20px 22px', transition: 'all .2s', cursor: 'default',
      boxShadow: '0 1px 6px rgba(15,23,42,0.04)',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(15,23,42,0.09)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(15,23,42,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: bgLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{sub}</p>}
    </div>
  );
}

/* ── Avatar with initials ── */
function Avatar({ name, email }) {
  const initials = (name || email || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899'];
  const idx = (name || email || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 12, flexShrink: 0,
      background: `linear-gradient(135deg, ${colors[idx]}cc, ${colors[idx]})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.02em',
    }}>{initials}</div>
  );
}

export default function UserReferral() {
  usePageTitle('Giới thiệu bạn bè');
  const [data, setData] = useState({ referralCode: '', referrals: [], commissionPercent: null, totalCommission: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);

  const location = useLocation();
  const isWorker = location.pathname.startsWith('/worker');
  const basePath = isWorker ? '/worker/dashboard' : '/buyer/dashboard';

  useEffect(() => {
    const ctx = isWorker ? 'worker' : 'buyer';
    api.get(`/users/referrals?context=${ctx}`).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [isWorker]);

  const refLink = `${window.location.origin}/dang-ky?ref=${data.referralCode}`;
  const pct = data.commissionPercent;
  const totalComm = data.totalCommission || 0;
  const referrals = data.referrals || [];
  const totalPages = Math.ceil(referrals.length / LIMIT);
  const pagedList = referrals.slice((page - 1) * LIMIT, page * LIMIT);

  const copyLink = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Pagination numbers
  const paginationPages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, []);

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .ref-row { transition: background .12s; }
        .ref-row:hover { background: #f8faff !important; }
        .ref-copy-btn { transition: all .15s; }
        .ref-copy-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.3) !important; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeInUp .4s ease forwards; }
        @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius: 8px; }
      `}</style>

      <Breadcrumb items={[
        { label: 'Dashboard', to: basePath },
        { label: 'Giới thiệu bạn bè' },
      ]} />

      {/* ── Page header ── */}
      <div style={{ marginBottom: 24, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
          }}>
            <Users size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Giới thiệu bạn bè</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', marginTop: 1 }}>Mời bạn bè và nhận hoa hồng tự động</p>
          </div>
        </div>
      </div>

      {/* ── Commission Promo Banner ── */}
      {pct && (
        <div className="fade-in" style={{
          background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 40%, #faf5ff 100%)',
          border: '1px solid #e0e7ff', borderRadius: 20,
          padding: '24px 28px', marginBottom: 20,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', right: 60, bottom: -30, width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Sparkles size={16} style={{ color: '#8b5cf6' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Chương trình hoa hồng</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 42, fontWeight: 900, color: '#6366f1', letterSpacing: '-0.04em', lineHeight: 1 }}>{pct}%</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#475569' }}>
                {isWorker ? 'tổng thu nhập' : 'tổng nạp tiền'} của bạn bè
              </span>
            </div>

            <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.6, maxWidth: 520 }}>
              {isWorker
                ? 'Chia sẻ → Bạn bè đăng ký & làm nhiệm vụ → Mỗi khi họ nhận thu nhập, bạn tự động nhận hoa hồng vào ví'
                : 'Chia sẻ → Bạn bè đăng ký & nạp tiền → Mỗi khi họ nạp, bạn tự động nhận hoa hồng vào ví'
              }
            </p>

            <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
              {[
                { icon: Link2, label: 'Chia sẻ link', color: '#6366f1' },
                { icon: UserPlus, label: 'Bạn bè đăng ký', color: '#8b5cf6' },
                { icon: Gift, label: 'Nhận hoa hồng', color: '#10b981' },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 9,
                    background: step.color + '1a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <step.icon size={13} style={{ color: step.color }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{step.label}</span>
                  {i < 2 && <ArrowUpRight size={12} style={{ color: '#cbd5e1', marginLeft: 4 }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Referral Link Card ── */}
      <div className="fade-in" style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18,
        padding: '20px 24px', marginBottom: 20,
        boxShadow: '0 1px 6px rgba(15,23,42,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Link2 size={14} style={{ color: '#6366f1' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Link giới thiệu của bạn</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <div style={{
            flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 12, padding: '12px 16px',
            fontFamily: 'monospace', fontSize: 13, color: '#334155',
            display: 'flex', alignItems: 'center', overflow: 'hidden',
            whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            {loading ? <span className="skeleton" style={{ width: '60%', height: 14 }} /> : refLink}
          </div>
          <button
            className="ref-copy-btn"
            onClick={copyLink}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0 20px', borderRadius: 12, border: 'none',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: copied ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', boxShadow: copied ? '0 2px 8px rgba(16,185,129,0.3)' : '0 2px 8px rgba(99,102,241,0.3)',
              flexShrink: 0, transition: 'all .2s',
            }}
          >
            {copied ? <><Check size={15} /> Đã chép</> : <><Copy size={15} /> Sao chép</>}
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
          Mã giới thiệu: <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>{data.referralCode || '...'}</span>
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard
          label="Tổng giới thiệu"
          value={referrals.length}
          sub={`${referrals.filter(r => r.status === 'active').length} đang hoạt động`}
          Icon={Users}
          color="#6366f1"
          bgLight="#eef2ff"
          borderColor="#e0e7ff"
        />
        <StatCard
          label="Tổng hoa hồng"
          value={<>{fmt(totalComm)}<span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 3 }}>₫</span></>}
          sub={pct ? `Tỷ lệ hoa hồng: ${pct}%` : ''}
          Icon={Gift}
          color="#8b5cf6"
          bgLight="#f5f3ff"
          borderColor="#ddd6fe"
        />
        <StatCard
          label="Hoa hồng TB/người"
          value={<>{fmt(referrals.length > 0 ? Math.round(totalComm / referrals.length) : 0)}<span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 3 }}>₫</span></>}
          sub="Trung bình mỗi người giới thiệu"
          Icon={TrendingUp}
          color="#06b6d4"
          bgLight="#ecfeff"
          borderColor="#a5f3fc"
        />
      </div>

      {/* ── Referral List Table ── */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20,
        overflow: 'hidden', boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
          background: '#fafbfc',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Crown size={15} style={{ color: '#6366f1' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Danh sách bạn bè</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px',
              borderRadius: 20, background: '#eef2ff', color: '#6366f1',
            }}>{referrals.length}</span>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '32px 24px' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="skeleton" style={{ width: `${50 + i * 8}%`, height: 12 }} />
                  <div className="skeleton" style={{ width: `${30 + i * 5}%`, height: 10 }} />
                </div>
                <div className="skeleton" style={{ width: 60, height: 14, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 14 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Heart size={28} style={{ color: '#cbd5e1' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#475569' }}>Chưa có bạn bè nào</p>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', marginTop: 5 }}>Chia sẻ link giới thiệu để bắt đầu nhận hoa hồng</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
                    {[
                      { label: '#', align: 'center', w: 50 },
                      { label: 'Người dùng', align: 'left' },
                      { label: 'Hoa hồng', align: 'right' },
                      { label: 'Trạng thái', align: 'center' },
                      { label: 'Ngày tham gia', align: 'right' },
                    ].map(({ label, align, w }) => (
                      <th key={label} style={{
                        padding: '11px 20px', textAlign: align, width: w,
                        fontSize: 11, fontWeight: 700, color: '#94a3b8',
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                      }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedList.map((r, i) => {
                    const isActive = r.status === 'active';
                    return (
                      <tr key={r.id} className="ref-row" style={{ borderBottom: '1px solid #f8fafc', background: '#fff' }}>
                        <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>{(page - 1) * LIMIT + i + 1}</span>
                        </td>
                        <td style={{ padding: '13px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={r.name} email={r.email} />
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{r.name || r.email}</p>
                              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{r.email}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                          {r.commissionEarned > 0 ? (
                            <span style={{ fontSize: 13, fontWeight: 900, color: '#059669' }}>
                              +{fmt(r.commissionEarned)}<span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }}>₫</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 10px', borderRadius: 30, fontSize: 11, fontWeight: 700,
                            background: isActive ? '#ecfdf5' : '#f1f5f9',
                            color: isActive ? '#059669' : '#94a3b8',
                            border: `1px solid ${isActive ? '#6ee7b7' : '#e2e8f0'}`,
                          }}>
                            <span style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: isActive ? '#10b981' : '#cbd5e1',
                            }} />
                            {isActive ? 'Hoạt động' : (r.status || 'Chưa xác minh')}
                          </span>
                        </td>
                        <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                          <span style={{ fontSize: 11, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                            {new Date(r.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden">
              {pagedList.map((r, i) => {
                const isActive = r.status === 'active';
                return (
                  <div key={r.id} className="ref-row" style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px', borderBottom: '1px solid #f8fafc', background: '#fff',
                  }}>
                    <Avatar name={r.name} email={r.email} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || r.email}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 12,
                          background: isActive ? '#ecfdf5' : '#f1f5f9',
                          color: isActive ? '#059669' : '#94a3b8',
                        }}>{isActive ? 'Hoạt động' : (r.status || 'Chưa xác minh')}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>
                          {new Date(r.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {r.commissionEarned > 0 ? (
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#059669' }}>+{fmt(r.commissionEarned)}₫</p>
                      ) : (
                        <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1' }}>—</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#fafbfc',
          }}>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Trang <strong style={{ color: '#334155' }}>{page}</strong> / <strong style={{ color: '#334155' }}>{totalPages}</strong>
              <span style={{ margin: '0 8px', color: '#cbd5e1' }}>·</span>{referrals.length} bạn bè
            </p>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                style={{
                  width: 32, height: 32, borderRadius: 10, border: '1px solid #e2e8f0',
                  background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.35 : 1,
                }}>
                <ChevronLeft size={13} style={{ color: '#64748b' }} />
              </button>
              {paginationPages.map((p, i) => p === '...'
                ? <span key={`e${i}`} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12 }}>·</span>
                : <button key={p} onClick={() => setPage(p)} style={{
                  width: 32, height: 32, borderRadius: 10, border: '1px solid',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: page === p ? '#6366f1' : '#fff',
                  color: page === p ? '#fff' : '#64748b',
                  borderColor: page === p ? '#6366f1' : '#e2e8f0',
                  boxShadow: page === p ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{p}</button>
              )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                style={{
                  width: 32, height: 32, borderRadius: 10, border: '1px solid #e2e8f0',
                  background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.35 : 1,
                }}>
                <ChevronRight size={13} style={{ color: '#64748b' }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
