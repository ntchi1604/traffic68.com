import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import {
  ArrowDownCircle, ArrowUpCircle, Wallet, Gift,
  ChevronLeft, ChevronRight, RefreshCw, CheckCircle2,
  Clock, XCircle, ArrowLeftRight, TrendingUp, TrendingDown,
  BarChart3, SlidersHorizontal, Activity, Sparkles,
} from 'lucide-react';
import api from '../../lib/api';
import { formatMoney } from '../../lib/format';

const fmt = (n) => formatMoney(n);
const LIMIT = 20;

/* ─── Config maps ─── */
const TYPE_META = {
  deposit:    { label: 'Nạp tiền',    Icon: ArrowDownCircle, color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7' },
  withdraw:   { label: 'Rút tiền',    Icon: ArrowUpCircle,   color: '#f43f5e', bg: '#fff1f2', border: '#fda4af' },
  campaign:   { label: 'Mua Traffic', Icon: TrendingUp,      color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' },
  commission: { label: 'Hoa hồng',   Icon: Gift,            color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd' },
  refund:     { label: 'Hoàn tiền',  Icon: RefreshCw,       color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd' },
  transfer:   { label: 'Chuyển ví',  Icon: ArrowLeftRight,  color: '#06b6d4', bg: '#ecfeff', border: '#67e8f9' },
};
const METHOD_LABEL = {
  credit_card: 'Thẻ tín dụng', bank_transfer: 'Chuyển khoản',
  momo: 'MoMo', system: 'Hệ thống', zalopay: 'ZaloPay',
  transfer: 'Chuyển ví', bep20: 'USDT BEP20', trc20: 'USDT TRC20',
};
const STATUS_META = {
  completed: { label: 'Hoàn tất',    color: '#059669', bg: '#ecfdf5', border: '#6ee7b7', Icon: CheckCircle2 },
  pending:   { label: 'Đang xử lý', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', Icon: Clock },
  failed:    { label: 'Thất bại',   color: '#e11d48', bg: '#fff1f2', border: '#fda4af', Icon: XCircle },
};
const FILTERS = [
  { key: 'all',        label: 'Tất cả',    Icon: Activity },
  { key: 'deposit',    label: 'Nạp tiền',  Icon: ArrowDownCircle },
  { key: 'campaign',   label: 'Traffic',   Icon: TrendingUp },
  { key: 'commission', label: 'Hoa hồng', Icon: Gift },
  { key: 'withdraw',   label: 'Rút tiền',  Icon: ArrowUpCircle },
];

/* ─── Date group ─── */
function dateGroup(dateStr) {
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const dt = new Date(d); dt.setHours(0, 0, 0, 0);
  if (dt.getTime() === today.getTime()) return 'Hôm nay';
  if (dt.getTime() === yesterday.getTime()) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, Icon, color, positive }) {
  const sign = positive === true ? '+' : positive === false ? '−' : '';
  const textColor = positive === true ? '#059669' : positive === false ? '#e11d48' : '#0f172a';
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 20,
      padding: '20px 22px',
      boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
      transition: 'box-shadow .2s, transform .2s',
      cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(15,23,42,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 8px rgba(15,23,42,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p style={{ fontSize: 22, fontWeight: 900, color: textColor, letterSpacing: '-0.03em', margin: 0, lineHeight: 1 }}>
        {sign}{fmt(value)}<span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginLeft: 3 }}>₫</span>
      </p>
      {sub && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{sub}</p>}
    </div>
  );
}

/* ─── Pagination ─── */
function Pagination({ page, total, onPage }) {
  if (total <= LIMIT) return null;
  const totalPages = Math.ceil(total / LIMIT);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && arr[i - 1] !== p - 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  const btnBase = {
    width: 32, height: 32, borderRadius: 10, border: '1px solid #e2e8f0',
    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#64748b',
    transition: 'all .15s',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
        Trang <strong style={{ color: '#334155' }}>{page}</strong> / <strong style={{ color: '#334155' }}>{totalPages}</strong>
        <span style={{ margin: '0 8px', color: '#cbd5e1' }}>·</span>{total} giao dịch
      </p>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          style={{ ...btnBase, opacity: page === 1 ? 0.35 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
          <ChevronLeft size={13} />
        </button>
        {pages.map((p, i) => p === '...'
          ? <span key={`e${i}`} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12 }}>·</span>
          : <button key={p} onClick={() => onPage(p)} style={{
            ...btnBase,
            background: page === p ? '#6366f1' : '#fff',
            color: page === p ? '#fff' : '#64748b',
            borderColor: page === p ? '#6366f1' : '#e2e8f0',
            boxShadow: page === p ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
          }}>{p}</button>
        )}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages}
          style={{ ...btnBase, opacity: page >= totalPages ? 0.35 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function TransactionHistory() {
  usePageTitle('Lịch sử giao dịch');
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ deposit: 0, commission: 0, campaign: 0, withdraw: 0 });

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (filter !== 'all') params.set('type', filter);
      const d = await api.get(`/finance/transactions?${params}`);
      setTransactions(d.transactions || []);
      setTotal(d.total || 0);
      setPage(p);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    api.get('/finance/summary').then(d => {
      setSummary({
        deposit:    Number(d.deposit    || 0),
        commission: Number(d.commission || 0),
        campaign:   Number(d.campaign   || 0),
        withdraw:   Number(d.withdraw   || 0),
      });
    }).catch(() => {});
  }, []);


  useEffect(() => { fetchData(1); }, [fetchData]);

  const net = summary.deposit + summary.commission - summary.campaign - summary.withdraw;

  const grouped = transactions.reduce((acc, t) => {
    const g = dateGroup(t.created_at);
    if (!acc[g]) acc[g] = [];
    acc[g].push(t);
    return acc;
  }, {});

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .txn-filter-btn { transition: all .15s ease; }
        .txn-filter-btn:hover { transform: translateY(-1px); }
        .txn-row { transition: background .12s ease; }
        .txn-row:hover { background: #f8faff !important; }
        .txn-row:hover .txn-ref { color: #475569 !important; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }

        @keyframes shimmer {
          0% { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 8px;
        }

        .stat-card-inner { transition: box-shadow .2s, transform .2s; }
        .stat-card-inner:hover { box-shadow: 0 10px 32px rgba(99,102,241,0.13) !important; transform: translateY(-3px); }
      `}</style>

      <Breadcrumb items={[
        { label: 'Dashboard', to: '/buyer/dashboard' },
        { label: 'Tài chính', to: '/buyer/dashboard/finance/deposit' },
        { label: 'Lịch sử giao dịch' },
      ]} />






      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="stat-card-inner" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 6px rgba(15,23,42,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Đã nạp</span>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownCircle size={15} style={{ color: '#10b981' }} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#059669', letterSpacing: '-0.03em' }}>+{fmt(summary.deposit)}<span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 2 }}>₫</span></p>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Đã hoàn tất</p>
        </div>
        <div className="stat-card-inner" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 6px rgba(15,23,42,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Hoa hồng</span>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={15} style={{ color: '#8b5cf6' }} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#7c3aed', letterSpacing: '-0.03em' }}>+{fmt(summary.commission)}<span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 2 }}>₫</span></p>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Từ giới thiệu</p>
        </div>
        <div className="stat-card-inner" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 6px rgba(15,23,42,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Đã chi</span>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpCircle size={15} style={{ color: '#f43f5e' }} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#e11d48', letterSpacing: '-0.03em' }}>−{fmt(summary.campaign + summary.withdraw)}<span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 2 }}>₫</span></p>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Traffic + rút tiền</p>
        </div>
        <div className="stat-card-inner" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 6px rgba(15,23,42,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{net >= 0 ? 'Lợi nhuận' : 'Thâm hụt'}</span>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: net >= 0 ? '#ecfdf5' : '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {net >= 0 ? <TrendingUp size={15} style={{ color: '#10b981' }} /> : <TrendingDown size={15} style={{ color: '#f43f5e' }} />}
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: net >= 0 ? '#059669' : '#e11d48', letterSpacing: '-0.03em' }}>{net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}<span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 2 }}>₫</span></p>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Số dư ròng</p>
        </div>
      </div>

      {/* ── Transaction Table Card ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(15,23,42,0.06)' }}>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
          background: '#fafbfc', flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={15} style={{ color: '#6366f1' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Lọc giao dịch</span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {FILTERS.map(({ key, label, Icon: FIcon }) => {
              const sel = filter === key;
              return (
                <button
                  key={key}
                  className="txn-filter-btn"
                  onClick={() => setFilter(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px', borderRadius: 10, border: '1px solid',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: sel ? '#6366f1' : '#fff',
                    color: sel ? '#fff' : '#64748b',
                    borderColor: sel ? '#6366f1' : '#e2e8f0',
                    boxShadow: sel ? '0 2px 8px rgba(99,102,241,0.25)' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <FIcon size={12} />
                  {label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => fetchData(page)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 10, border: '1px solid #e2e8f0',
              background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8faff'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} style={{ color: loading ? '#6366f1' : '#94a3b8' }} />
            Làm mới
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '48px 24px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: i < 5 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div className="skeleton" style={{ width: `${55 + i * 7}%`, height: 12 }} />
                  <div className="skeleton" style={{ width: `${30 + i * 5}%`, height: 10 }} />
                </div>
                <div className="skeleton" style={{ width: 70, height: 16, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 24px', gap: 16 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 24, background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BarChart3 size={30} style={{ color: '#cbd5e1' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#475569' }}>Chưa có giao dịch nào</p>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', marginTop: 6 }}>Thử đổi bộ lọc hoặc nạp tiền để bắt đầu</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
                    {[
                      { label: 'Mã giao dịch', align: 'left' },
                      { label: 'Loại', align: 'left' },
                      { label: 'Phương thức', align: 'left' },
                      { label: 'Số tiền', align: 'right' },
                      { label: 'Trạng thái', align: 'center' },
                      { label: 'Thời gian', align: 'right' },
                    ].map(({ label, align }) => (
                      <th key={label} style={{
                        padding: '11px 20px', textAlign: align,
                        fontSize: 11, fontWeight: 700, color: '#94a3b8',
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        whiteSpace: 'nowrap',
                      }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, idx) => {
                    const tp = TYPE_META[t.type] || { label: t.type, Icon: Wallet, color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' };
                    const st = STATUS_META[t.status] || STATUS_META.failed;
                    const isPos = t.type === 'deposit' || t.type === 'commission';
                    const TpIcon = tp.Icon;
                    const StIcon = st.Icon;
                    return (
                      <tr key={t.id} className="txn-row" style={{ borderBottom: idx < transactions.length - 1 ? '1px solid #f8fafc' : 'none', background: '#fff' }}>
                        <td style={{ padding: '13px 20px' }}>
                          <span className="txn-ref" style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', transition: 'color .12s' }}>
                            {t.ref_code || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '13px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 10,
                              background: tp.bg,
                              border: `1px solid ${tp.border}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              <TpIcon size={14} style={{ color: tp.color }} />
                            </div>
                            <span style={{
                              fontSize: 12, fontWeight: 700, padding: '3px 10px',
                              borderRadius: 30, background: tp.bg,
                              color: tp.color, border: `1px solid ${tp.border}`,
                            }}>{tp.label}</span>
                          </div>
                        </td>
                        <td style={{ padding: '13px 20px' }}>
                          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                            {METHOD_LABEL[t.method] || t.method || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                          <span style={{
                            fontSize: 14, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                            color: isPos ? '#059669' : '#e11d48',
                            letterSpacing: '-0.02em',
                          }}>
                            {isPos ? '+' : '−'}{fmt(t.amount)}
                            <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2, fontWeight: 700 }}>₫</span>
                          </span>
                        </td>
                        <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 10px', borderRadius: 30, fontSize: 11, fontWeight: 700,
                            background: st.bg, color: st.color,
                            border: `1px solid ${st.border}`,
                          }}>
                            <StIcon size={10} />
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                          <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {new Date(t.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: grouped by date */}
            <div className="md:hidden">
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <div style={{ padding: '10px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{date}</span>
                  </div>
                  {items.map((t, idx) => {
                    const tp = TYPE_META[t.type] || { label: t.type, Icon: Wallet, color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' };
                    const st = STATUS_META[t.status] || STATUS_META.failed;
                    const isPos = t.type === 'deposit' || t.type === 'commission';
                    const TpIcon = tp.Icon;
                    return (
                      <div key={t.id} className="txn-row" style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 20px',
                        borderBottom: idx < items.length - 1 ? '1px solid #f8fafc' : 'none',
                        background: '#fff',
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 13,
                          background: tp.bg, border: `1px solid ${tp.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <TpIcon size={17} style={{ color: tp.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: tp.bg, color: tp.color, border: `1px solid ${tp.border}` }}>{tp.label}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 10, fontFamily: 'monospace', color: '#94a3b8', marginBottom: 2 }}>{t.ref_code || '—'}</p>
                          <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>{METHOD_LABEL[t.method] || t.method}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: isPos ? '#059669' : '#e11d48', letterSpacing: '-0.02em' }}>
                            {isPos ? '+' : '−'}{fmt(t.amount)}₫
                          </p>
                          <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                            {new Date(t.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        <Pagination page={page} total={total} onPage={fetchData} />
      </div>
    </div>
  );
}