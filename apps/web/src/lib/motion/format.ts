/**
 * Motion and counter formatting utilities in Vietnamese locale.
 */

const vndFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

export function formatVND(value: number): string {
  const rounded = Math.round(value);
  return `${vndFormatter.format(rounded)} đ`;
}

export function formatPercent(value: number, decimals = 0): string {
  const formatted = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${formatted}%`;
}

