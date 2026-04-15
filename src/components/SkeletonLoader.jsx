/**
 * SkeletonLoader — shared skeleton components dùng chung toàn dự án
 * Thay thế pattern `if (loading) return <Spinner>` bằng skeleton trong layout
 */

/* ── Block cơ bản ── */
export function Sk({ className = '', style }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} style={style} />;
}

/* ── Dòng text ── */
export function SkText({ w = 'w-32', h = 'h-4', className = '' }) {
  return <Sk className={`${w} ${h} ${className}`} />;
}

/* ── Hàng trong bảng — n dòng ── */
export function SkTableRows({ rows = 5, cols = 4 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} className="border-b border-slate-50">
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="py-3 px-3">
          <Sk className={`h-4 ${j === 0 ? 'w-32' : j === cols - 1 ? 'w-20 ml-auto' : 'w-24'}`} />
        </td>
      ))}
    </tr>
  ));
}

/* ── Card stat (icon + 2 dòng text) ── */
export function SkStatCard({ border = 'border-slate-100' }) {
  return (
    <div className={`bg-white rounded-xl border ${border} p-5 flex items-start gap-4`}>
      <Sk className="w-11 h-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <Sk className="h-3 w-20" />
        <Sk className="h-6 w-28" />
        <Sk className="h-3 w-36" />
      </div>
    </div>
  );
}

/* ── Grid stat cards ── */
export function SkStatGrid({ count = 4, cols = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4' }) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => <SkStatCard key={i} />)}
    </div>
  );
}

/* ── Bảng đầy đủ với header ── */
export function SkTable({ rows = 8, cols = 4, headers = [] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
      {/* Toolbar slot */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
        <Sk className="h-8 w-48 rounded-lg" />
        <Sk className="h-8 w-24 rounded-lg" />
        <div className="ml-auto"><Sk className="h-8 w-28 rounded-lg" /></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {(headers.length ? headers : Array.from({ length: cols })).map((h, i) => (
                <th key={i} className="py-3 px-3 text-left">
                  <Sk className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SkTableRows rows={rows} cols={cols} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Chart placeholder ── */
export function SkChart({ height = 'h-64' }) {
  return (
    <div className={`${height} flex items-end gap-2 px-4 pb-4`}>
      {[55, 80, 45, 90, 65, 70, 85, 60, 75, 50].map((h, i) => (
        <Sk key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/* ── Page skeleton hoàn chỉnh: stats + table ── */
export function SkPage({ statCount = 4, tableRows = 8, tableCols = 4 }) {
  return (
    <div className="space-y-5 w-full min-w-0">
      <SkStatGrid count={statCount} />
      <SkTable rows={tableRows} cols={tableCols} />
    </div>
  );
}
