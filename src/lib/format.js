/**
 * Format number with Vietnamese style: 10.000đ
 * Uses "." as thousand separator
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
