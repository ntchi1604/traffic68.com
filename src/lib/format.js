const VN_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Format number with Vietnamese style: 10.000
 */
export function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Format number with Vietnamese style + currency: 10.000đ
 */
export function formatVND(n) {
  return formatMoney(n) + 'đ';
}

/**
 * Format date → dd/MM/yyyy  (Vietnam timezone)
 */
export function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('vi-VN', {
    timeZone: VN_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format date → dd/MM  (short, for charts — Vietnam timezone)
 */
export function fmtDay(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('vi-VN', {
    timeZone: VN_TZ,
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * Format datetime → dd/MM/yyyy HH:mm  (Vietnam timezone)
 */
export function fmtDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleString('vi-VN', {
    timeZone: VN_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
