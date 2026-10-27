// Turns a balance into ranked ways to spend it. "70 points" becomes
// "7 × $2 off" or "1 × $15 off a $20 order", and the planner ranks them by
// what the member actually gets: value, any extra spending a minimum needs,
// how many visits it takes, and whether points would expire first.
//
// Score = total value
//       − 25% of extra spend a minimum forces above the member's usual spend
//       − $0.15 friction per visit
//       − value of expiring points the plan can't use in time

import type { Habits, PointExpiry, RewardOption, UsePlan } from './types.js';
import { merchantById } from './demo-data.js';

const MAX_TIMES = 12;
const DAY = 86400_000;

const money = (n: number) => `$${n.toFixed(2)}`;

function categoryOf(o: RewardOption) {
  return merchantById(o.merchantIds[0] ?? null)?.category ?? null;
}

interface PlanInput {
  programId: string;
  options: RewardOption[];
  available: number;
  expiries: PointExpiry[];
  habits: Habits;
  unit: string;
  now?: Date;
}

export function planBalance(input: PlanInput): UsePlan[] {
  const { options, available, habits, unit } = input;
  const now = input.now ?? new Date();
  const affordable = options.filter((o) => o.cost <= available);
  if (!affordable.length) return [];

  const candidates: { steps: { o: RewardOption; times: number }[]; label: string }[] = [];

  // One plan per reward, repeated as many times as the balance allows.
  for (const o of affordable) {
    const times = Math.min(MAX_TIMES, Math.floor(available / o.cost));
    candidates.push({ steps: [{ o, times }], label: times > 1 ? `${times} × ${o.title}` : o.title });
  }

  // The highest-value mix, by unbounded knapsack over the balance.
  const best = knapsack(affordable, available);
  if (best.length > 1) {
    const label = best.map((s) => `${s.times} × ${s.o.title}`).join(' + ');
    candidates.push({ steps: best, label });
  }

  const soonest = [...input.expiries].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const expiringSoon = soonest.filter((e) => new Date(e.expiresAt).getTime() - now.getTime() <= 30 * DAY);

  const plans: UsePlan[] = candidates.map((c) => {
    const pointsUsed = c.steps.reduce((n, s) => n + s.o.cost * s.times, 0);
    const totalValue = round2(c.steps.reduce((n, s) => n + s.o.value * s.times, 0));
    const visits = c.steps.reduce((n, s) => n + (s.o.merchantIds.length ? s.times : 0), 0);
    let extraSpend = 0;
    const warnings: string[] = [];
    for (const s of c.steps) {
      if (!s.o.minSpend) continue;
      const cat = categoryOf(s.o);
      const usual = (cat && habits.typicalSpend[cat]) ?? 0;
      const extra = Math.max(0, s.o.minSpend - usual);
      extraSpend += extra * s.times;
      if (extra > 0)
        warnings.push(
          usual
            ? `Needs a ${money(s.o.minSpend)} order; you usually spend about ${money(usual)}.`
            : `Needs a ${money(s.o.minSpend)} order.`,
        );
    }

    // Can the plan use the expiring points before they lapse, at the member's visit rate?
    let valueAtRisk = 0;
    if (expiringSoon.length) {
      const e = expiringSoon[0];
      const days = Math.max(0, (new Date(e.expiresAt).getTime() - now.getTime()) / DAY);
      const cat = categoryOf(c.steps[0].o);
      const perWeek = (cat && habits.visitsPerWeek[cat]) ?? 1;
      const usesInTime = Math.max(1, Math.floor((perWeek * days) / 7));
      let usedInTime = 0;
      let uses = 0;
      for (const s of [...c.steps].sort((a, b) => b.o.cost - a.o.cost)) {
        for (let i = 0; i < s.times && uses < usesInTime; i++, uses++) usedInTime += s.o.cost;
      }
      const unusable = Math.max(0, Math.min(e.points, pointsUsed) - usedInTime);
      const rate = totalValue / Math.max(1, pointsUsed);
      valueAtRisk = round2(unusable * rate);
      if (valueAtRisk > 0)
        warnings.push(`At your usual pace, about ${unusable.toLocaleString('en-US')} ${unit} would expire before you use them.`);
    }

    const score = round2(totalValue - 0.25 * extraSpend - 0.15 * visits - valueAtRisk);
    const vpp = pointsUsed ? totalValue / pointsUsed : 0;
    return {
      id: `${input.programId}:${c.steps.map((s) => `${s.o.id}x${s.times}`).join('+')}`,
      programId: input.programId,
      label: c.label,
      steps: c.steps.map((s) => ({ optionId: s.o.id, times: s.times })),
      pointsUsed,
      leftover: available - pointsUsed,
      totalValue,
      valuePerPoint: Math.round(vpp * 10000) / 10000,
      visits,
      extraSpend: round2(extraSpend),
      valueAtRisk,
      score,
      reasons: [],
      warnings,
    };
  });

  // De-duplicate identical plans, then rank.
  const unique = [...new Map(plans.map((p) => [p.id, p])).values()].sort((a, b) => b.score - a.score || b.totalValue - a.totalValue);
  const top = unique[0];
  for (const p of unique) {
    p.reasons.push(`${money(p.totalValue)} of value for ${p.pointsUsed.toLocaleString('en-US')} ${unit}.`);
    if (!p.extraSpend) p.reasons.push(p.steps.some((s) => options.find((o) => o.id === s.optionId)?.minSpend) ? 'Your usual order already meets the minimum.' : 'No minimum spend.');
    if (p.visits <= 1) p.reasons.push(p.visits === 1 ? 'Done in one visit.' : 'No visit needed.');
    else p.reasons.push(`Spread over ${p.visits} visits.`);
    if (p !== top) {
      const diff = round2(p.totalValue - top.totalValue);
      if (diff > 0) p.reasons.push(`Gets ${money(diff)} more than the top plan, but costs more to reach.`);
    }
  }
  return unique.slice(0, 3);
}

function knapsack(options: RewardOption[], budget: number) {
  // Points are coarse enough to work in units of the smallest cost's divisor.
  const unit = options.reduce((g, o) => gcd(g, o.cost), options[0].cost);
  const cap = Math.floor(budget / unit);
  if (cap > 20000) return [];
  const best = new Array(cap + 1).fill(0);
  const pick = new Array<number>(cap + 1).fill(-1);
  for (let w = 1; w <= cap; w++) {
    best[w] = best[w - 1];
    pick[w] = -2;
    options.forEach((o, i) => {
      const c = o.cost / unit;
      if (c <= w && best[w - c] + o.value > best[w] + 1e-9) {
        best[w] = best[w - c] + o.value;
        pick[w] = i;
      }
    });
  }
  const counts = new Map<number, number>();
  let w = cap;
  while (w > 0) {
    if (pick[w] === -2 || pick[w] === -1) w -= 1;
    else {
      counts.set(pick[w], (counts.get(pick[w]) ?? 0) + 1);
      w -= options[pick[w]].cost / unit;
    }
  }
  return [...counts.entries()].map(([i, times]) => ({ o: options[i], times: Math.min(MAX_TIMES, times) }));
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const round2 = (n: number) => Math.round(n * 100) / 100;
