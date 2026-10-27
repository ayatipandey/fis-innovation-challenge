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

export const points = (n: number, unit = 'points') => `${Math.round(n).toLocaleString('en-US')} ${n === 1 ? unit.replace(/s$/, '') : unit}`;

/** "1 h 42 min" until a time, for holds. */
export function countdown(iso: string, now = Date.now()) {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const min = Math.ceil(ms / 60_000);
  if (min >= 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
  return `${min} min`;
}

export const timeOfDay = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
