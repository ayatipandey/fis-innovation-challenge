import type { CategoryId, Habits, Purchase } from './types.js';

const DAY = 86400_000;

/** Derives visit rate, typical spend, time-of-day pattern and spend velocity from purchases. */
export function computeHabits(purchases: Purchase[], now = new Date()): Habits {
  if (!purchases.length) return { visitsPerWeek: {}, typicalSpend: {}, hourShare: {}, spendVelocity: {}, source: 'none' };
  // Several programs could report the same visit, so visits are de-duplicated.
  const seen = new Set<string>();
  const unique = purchases.filter((p) => {
    const key = `${p.merchantId}|${p.at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const first = Math.min(...unique.map((p) => new Date(p.at).getTime()));
  const weeks = Math.max(1, (now.getTime() - first) / (7 * DAY));
  const byCat = new Map<CategoryId, Purchase[]>();
  for (const p of unique) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);

  const h: Habits = { visitsPerWeek: {}, typicalSpend: {}, hourShare: {}, spendVelocity: {}, source: 'linked_history' };
  for (const [cat, list] of byCat) {
    h.visitsPerWeek[cat] = Math.round((list.length / weeks) * 10) / 10;
    const amounts = list.map((p) => p.amount).sort((a, b) => a - b);
    h.typicalSpend[cat] = Math.round(amounts[Math.floor(amounts.length / 2)] * 100) / 100;
    const hours = new Array(24).fill(0);
    for (const p of list) hours[new Date(p.at).getHours()] += 1;
    h.hourShare[cat] = hours.map((n) => Math.round((n / list.length) * 1000) / 1000);
    const t = now.getTime();
    const recent = list.filter((p) => t - new Date(p.at).getTime() <= 14 * DAY).reduce((n, p) => n + p.amount, 0);
    const prior = list.filter((p) => { const age = t - new Date(p.at).getTime(); return age > 14 * DAY && age <= 28 * DAY; }).reduce((n, p) => n + p.amount, 0);
    h.spendVelocity[cat] = prior > 0 ? Math.round((recent / prior) * 100) / 100 : recent > 0 ? 1.5 : 1;
  }
  return h;
}
