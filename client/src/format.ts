const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

const gbpExact = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export const money = (pence: number, exact = false): string =>
  (exact ? gbpExact : gbp).format(pence / 100);

export function longDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function dateRange(start: string | null, end: string | null): string {
  if (!start) return '—';
  if (!end || start === end) return longDate(start);

  const from = new Date(start);
  const to = new Date(end);
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();

  return sameMonth
    ? `${from.getDate()}–${to.getDate()} ${to.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
    : `${shortDate(start)} – ${shortDate(end)}`;
}

export function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  const days = Math.round((Date.now() - then) / 86_400_000);

  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 0) return `in ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = (days / 365).toFixed(days < 730 ? 0 : 1);
  return `${years} year${years === '1' ? '' : 's'} ago`;
}

export const titleCase = (value: string): string =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
