export const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const longDateline = (d = new Date()) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export function daysUntil(iso: string, now = Date.now()) {
  return Math.ceil((new Date(iso).getTime() - now) / 86400_000);
}

export function expiryPhrase(iso: string) {
  const d = daysUntil(iso);
  if (d <= 0) return 'Expires today';
  if (d === 1) return 'Expires tomorrow';
  if (d <= 7) return `Expires ${new Date(iso).toLocaleDateString('en-US', { weekday: 'long' })}, ${shortDate(iso)}`;
  return `Expires ${shortDate(iso)}`;
}

export const isUrgent = (iso: string) => daysUntil(iso) <= 3;

export function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
