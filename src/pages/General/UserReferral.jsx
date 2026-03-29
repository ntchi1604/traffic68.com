import { useState, useEffect } from 'react';
import {
  Copy, Check, Users, Gift, TrendingUp,
  ChevronLeft, ChevronRight, UserPlus, Link2,
  Heart, Share2,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import api from '../../lib/api';

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n);
const LIMIT = 20;

/* ── Avatar with initials ── */
function Avatar({ name, email }) {
  const initials = (name || email || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899'];
  const idx = (name || email || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: `linear-gradient(135deg, ${colors[idx]}cc, ${colors[idx]})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800, color: '#fff',
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

  const paginationPages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, i, arr) => { if (i > 0 && arr[i - 1] !== p - 1) acc.push('...'); acc.push(p); return acc; }, []);

  const kpis = [
    { label: 'Tỷ lệ hoa hồng', value: pct ? `${pct}%` : '—', Icon: Gift, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
    { label: 'Tổng giới thiệu', value: referrals.length, sub: `${referrals.filter(r => r.status === 'active').length} đang hoạt động`, Icon: Users, color: '#6366f1', bg: '#eef2ff', border: '#e0e7ff' },
    { label: 'Tổng hoa hồng', value: <>{fmt(totalComm)}<span className="text-xs font-semibold text-slate-400 ml-1">₫</span></>, Icon: TrendingUp, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
    { label: 'TB / người', value: <>{fmt(referrals.length > 0 ? Math.round(totalComm / referrals.length) : 0)}<span className="text-xs font-semibold text-slate-400 ml-1">₫</span></>, Icon: UserPlus, color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc' },
  ];

  return (
    <div className="space-y-5 w-full min-w-0 pb-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Breadcrumb items={[
        { label: 'Dashboard', to: basePath },
        { label: 'Giới thiệu bạn bè' },
      ]} />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-2xl border p-4 hover:shadow-md transition-all duration-200"
            style={{ borderColor: k.border }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.Icon size={15} style={{ color: k.color }} />
              </div>
            </div>
            <p className="text-xl font-black text-slate-900 tabular-nums leading-none">{k.value}</p>
            {k.sub && <p className="text-[11px] text-slate-400 mt-2">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Referral Link ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Share2 size={14} className="text-indigo-500" />
          <span className="text-xs font-bold text-slate-700">Link giới thiệu của bạn</span>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ml-auto">
            {data.referralCode || '...'}
          </span>
        </div>
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono text-xs text-slate-600 flex items-center overflow-hidden">
            {loading
              ? <div className="h-3 w-3/5 bg-slate-200 rounded animate-pulse" />
              : <span className="truncate">{refLink}</span>
            }
          </div>
          <button onClick={copyLink}
            className="flex items-center gap-2 px-5 rounded-xl text-xs font-bold text-white transition-all duration-200 hover:-translate-y-0.5 shrink-0"
            style={{
              background: copied ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: copied ? '0 4px 14px rgba(16,185,129,0.3)' : '0 4px 14px rgba(99,102,241,0.25)',
            }}>
            {copied ? <><Check size={14} /> Đã chép</> : <><Copy size={14} /> Sao chép</>}
          </button>
        </div>
        {pct && (
          <div className="mt-3 flex items-center gap-6 flex-wrap">
            {[
              { icon: Link2, text: 'Chia sẻ link', color: '#6366f1' },
              { icon: UserPlus, text: 'Bạn bè đăng ký', color: '#8b5cf6' },
              { icon: Gift, text: 'Nhận hoa hồng', color: '#10b981' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-slate-500">
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: s.color + '15' }}>
                  <s.icon size={11} style={{ color: s.color }} />
                </div>
                <span className="font-semibold">{s.text}</span>
                {i < 2 && <span className="text-slate-300 ml-1">→</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Referral List ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-indigo-500" />
            <span className="text-sm font-bold text-slate-700">Danh sách bạn bè</span>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{referrals.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/5 bg-slate-100 rounded animate-pulse" />
                  <div className="h-2 w-1/4 bg-slate-50 rounded animate-pulse" />
                </div>
                <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Heart size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">Chưa có bạn bè nào</p>
            <p className="text-xs text-slate-400">Chia sẻ link giới thiệu để bắt đầu nhận hoa hồng</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['#', 'Người dùng', 'Hoa hồng', 'Trạng thái', 'Ngày tham gia'].map((h, i) => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                        style={{ textAlign: i === 0 ? 'center' : i >= 2 ? 'right' : 'left', ...(i === 3 && { textAlign: 'center' }) }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedList.map((r, i) => {
                    const isActive = r.status === 'active';
                    return (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 text-center">
                          <span className="text-[10px] font-bold text-slate-300">{(page - 1) * LIMIT + i + 1}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.name} email={r.email} />
                            <div>
                              <p className="text-xs font-bold text-slate-800">{r.name || r.email}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{r.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {r.commissionEarned > 0 ? (
                            <span className="text-xs font-black text-emerald-600">+{fmt(r.commissionEarned)}<span className="text-[10px] text-slate-400 ml-0.5">₫</span></span>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            {isActive ? 'Hoạt động' : (r.status || 'Chưa xác minh')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-[10px] text-slate-400 tabular-nums">
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
            <div className="md:hidden divide-y divide-slate-50">
              {pagedList.map(r => {
                const isActive = r.status === 'active';
                return (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                    <Avatar name={r.name} email={r.email} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{r.name || r.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                          {isActive ? 'Hoạt động' : (r.status || 'Chưa xác minh')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(r.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {r.commissionEarned > 0 ? (
                        <p className="text-xs font-black text-emerald-600">+{fmt(r.commissionEarned)}₫</p>
                      ) : (
                        <p className="text-[10px] text-slate-300">—</p>
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[11px] text-slate-400">
              Trang <strong className="text-slate-600">{page}</strong> / <strong className="text-slate-600">{totalPages}</strong>
              <span className="mx-1.5 text-slate-300">·</span>{referrals.length} bạn bè
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-slate-50 transition">
                <ChevronLeft size={12} className="text-slate-500" />
              </button>
              {paginationPages.map((p, i) => p === '...'
                ? <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-slate-300 text-[10px]">·</span>
                : <button key={p} onClick={() => setPage(p)} className="w-7 h-7 rounded-lg border text-[11px] font-bold flex items-center justify-center transition"
                  style={{
                    background: page === p ? '#6366f1' : '#fff',
                    color: page === p ? '#fff' : '#64748b',
                    borderColor: page === p ? '#6366f1' : '#e2e8f0',
                  }}>{p}</button>
              )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-slate-50 transition">
                <ChevronRight size={12} className="text-slate-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
