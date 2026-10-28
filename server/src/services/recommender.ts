// Client for the Python AI service (moment engine + Perkly's Pilot), with a
// simple rule-based fallback so the app keeps working when it is unreachable.

import { MERCHANTS, distanceM, optionsFor, programById } from '../../../shared/demo-data.js';
import type { Habits, LinkedProgram, UsePlan } from '../../../shared/types.js';
import { config } from '../config.js';

export interface MerchantIn {
  id: string;
  name: string;
  lat: number;
  lng: number;
  opens: number;
  closes: number;
  category: string;
}

export interface Candidate {
  optionId: string;
  programId: string;
  programName: string;
  unit: string;
  title: string;
  cost: number;
  value: number;
  minSpend: number | null;
  channels: string[];
  available: number;
  expiringPoints: number;
  daysToExpiry: number | null;
  category: string | null;
  merchants: MerchantIn[];
}

export interface MomentContext {
  now: string;
  hour: number;
  minute: number;
  weekday: number;
  lat: number | null;
  lng: number | null;
  source: 'simulated' | 'device';
}

export interface EnginePrefs {
  quietHours: { enabled: boolean; start: string; end: string };
  dailyLimit: number;
  sentToday: number;
  locationAllowed: boolean;
  personalization: boolean;
}

export type RatingCounts = Record<string, { good: number; fine: number; bad: number }>;

export interface MomentDecision {
  sent: boolean;
  optionId: string | null;
  programId: string | null;
  merchantId: string | null;
  title: string;
  body: string;
  reasons: string[];
  suppressedBecause: string | null;
  uplift: number;
  pIfNotified: number;
  pIfNot: number;
  distanceM: number | null;
  bucket: string;
  category: string | null;
}

export interface MomentResult {
  decision: MomentDecision;
  considered: unknown[];
  model: string;
  threshold: number;
  fallback?: boolean;
}

export interface PilotResult {
  reply: string;
  cards: string[];
  table: { columns: string[]; rows: string[][] } | null;
  notes: string[];
  followUps: string[];
  engine: string;
}

const DAY = 86400_000;

/** Every reward the member could afford right now, with the shops it works at. */
export function buildCandidates(links: LinkedProgram[], now = new Date()): Candidate[] {
  const out: Candidate[] = [];
  for (const l of links) {
    const p = programById(l.programId);
    if (!p) continue;
    const soon = l.expiries[0];
    for (const o of optionsFor(l.programId)) {
      if (o.cost > l.available) continue;
      const merchants = o.merchantIds.map((id) => MERCHANTS.find((m) => m.id === id)!).filter(Boolean);
      out.push({
        optionId: o.id,
        programId: p.id,
        programName: p.name,
        unit: p.unit,
        title: o.title,
        cost: o.cost,
        value: o.value,
        minSpend: o.minSpend,
        channels: o.channels,
        available: l.available,
        expiringPoints: soon ? soon.points : 0,
        daysToExpiry: soon ? Math.max(0, (new Date(soon.expiresAt).getTime() - now.getTime()) / DAY) : null,
        category: merchants[0]?.category ?? p.category,
        merchants: merchants.map((m) => ({ id: m.id, name: m.name, lat: m.lat, lng: m.lng, opens: m.opens, closes: m.closes, category: m.category })),
      });
    }
  }
  return out;
}

export function planPayload(programs: { link: LinkedProgram; plans: UsePlan[] }[], now = new Date()) {
  return programs.map(({ link, plans }) => {
    const p = programById(link.programId)!;
    return {
      programId: p.id,
      name: p.name,
      unit: p.unit,
      available: link.available,
      expiries: link.expiries.map((e) => ({ points: e.points, days: Math.max(0, (new Date(e.expiresAt).getTime() - now.getTime()) / DAY) })),
      plans: plans.map((pl) => ({
        label: pl.label,
        totalValue: pl.totalValue,
        pointsUsed: pl.pointsUsed,
        leftover: pl.leftover,
        visits: pl.visits,
        extraSpend: pl.extraSpend,
        valueAtRisk: pl.valueAtRisk,
        score: pl.score,
        reasons: pl.reasons,
        warnings: pl.warnings,
        optionIds: pl.steps.map((s) => s.optionId),
      })),
    };
  });
}

export class ServiceUnavailable extends Error {}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.recommenderTimeoutMs);
  try {
    const res = await fetch(`${config.recommenderUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(config.recommenderKey ? { 'x-service-key': config.recommenderKey } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new ServiceUnavailable(`AI service responded ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    throw err instanceof ServiceUnavailable ? err : new ServiceUnavailable(String(err));
  } finally {
    clearTimeout(timer);
  }
}

export interface MomentRequest {
  context: MomentContext;
  prefs: EnginePrefs;
  habits: Habits;
  ratings: RatingCounts;
  candidates: Candidate[];
}

export async function evaluateMoment(req: MomentRequest): Promise<MomentResult> {
  try {
    return await call<MomentResult>('/moments/evaluate', req);
  } catch {
    return fallbackMoment(req);
  }
}

export async function askPilot(body: MomentRequest & { message: string; programs: ReturnType<typeof planPayload> }): Promise<PilotResult> {
  try {
    return await call<PilotResult>('/pilot', body);
  } catch {
    return fallbackPilot(body.programs);
  }
}

export async function serviceHealth(): Promise<boolean> {
  try {
    await call('/health');
    return true;
  } catch {
    return false;
  }
}

// ── Fallbacks ───────────────────────────────────────────────────────────

export function bucketOf(hour: number) {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'late night';
}

function inQuiet(h: number, m: number, start: string, end: string) {
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const t = h * 60 + m;
  const s = toMin(start);
  const e = toMin(end);
  return s <= e ? t >= s && t < e : t >= s || t < e;
}

/** Rules only, no model: nearby, open, and expiring soon wins. */
export function fallbackMoment(req: MomentRequest): MomentResult {
  const { context: ctx, prefs } = req;
  const bucket = bucketOf(ctx.hour);
  const here = prefs.locationAllowed && ctx.lat != null && ctx.lng != null ? { lat: ctx.lat, lng: ctx.lng } : null;
  const scored = req.candidates
    .map((c) => {
      const m = here && c.merchants.length ? [...c.merchants].sort((a, b) => distanceM(here, a) - distanceM(here, b))[0] : c.merchants[0];
      const dist = here && m ? distanceM(here, m) : null;
      const open = !m || (m.opens <= ctx.hour && ctx.hour < m.closes);
      const expiringSoon = c.expiringPoints > 0 && c.daysToExpiry != null && c.daysToExpiry <= 14;
      const eligible = c.merchants.length ? (dist != null ? dist <= 600 && open : c.channels.includes('online')) : c.channels.includes('online') && expiringSoon;
      const urgency = c.expiringPoints > 0 && c.daysToExpiry != null && c.daysToExpiry <= 14 ? 2 : 1;
      return { c, m, dist, eligible, score: c.value * urgency * (dist != null ? 1.5 : 1) };
    })
    .filter((s) => s.eligible)
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  const base = { uplift: 0, pIfNotified: 0, pIfNot: 0, bucket };
  if (!top) {
    return {
      decision: { ...base, sent: false, optionId: null, programId: null, merchantId: null, title: 'Nothing to send right now', body: 'None of your rewards can be used nearby at the moment.', reasons: [], suppressedBecause: 'No affordable reward is close enough or open right now.', distanceM: null, category: null },
      considered: [],
      model: 'rules-fallback',
      threshold: 0,
      fallback: true,
    };
  }
  const { c, m, dist } = top;
  const place = m ? m.name.split(',')[0] : c.programName;
  const days = c.daysToExpiry != null && c.expiringPoints > 0 && c.daysToExpiry <= 30 ? Math.round(c.daysToExpiry) : null;
  const lead = dist != null ? `You’re ${dist} m from ${place} and have` : `Your ${c.programName} can get you`;
  const body = `${lead} ${c.title.charAt(0).toLowerCase()}${c.title.slice(1)} worth $${c.value.toFixed(2).replace('.00', '')}${days != null ? ` that expires in ${days} ${days === 1 ? 'day' : 'days'}` : ''}.`;
  let suppressed: string | null = null;
  if (prefs.quietHours.enabled && inQuiet(ctx.hour, ctx.minute, prefs.quietHours.start, prefs.quietHours.end)) suppressed = 'It’s within your quiet hours, so this waits until morning.';
  else if (prefs.sentToday >= prefs.dailyLimit) suppressed = `You’ve reached your limit of ${prefs.dailyLimit} notifications today.`;
  else if ((req.ratings[`${c.category}:${bucket}`]?.bad ?? 0) >= 2) suppressed = `You rated these reminders in the ${bucket} as Bad, so Perkly is holding back.`;
  return {
    decision: {
      ...base,
      sent: suppressed === null,
      optionId: c.optionId,
      programId: c.programId,
      merchantId: m?.id ?? null,
      title: `${place}: ${c.title}`,
      body,
      reasons: ['The AI service is unavailable, so simple rules picked this (distance, opening hours, expiry).'],
      suppressedBecause: suppressed,
      distanceM: dist,
      category: c.category,
    },
    considered: [],
    model: 'rules-fallback',
    threshold: 0,
    fallback: true,
  };
}

export function fallbackPilot(programs: ReturnType<typeof planPayload>): PilotResult {
  const rows = programs.filter((p) => p.plans[0]).map((p) => [p.name, p.plans[0].label, `$${p.plans[0].totalValue.toFixed(2)}`]);
  return {
    reply: rows.length
      ? 'Perkly’s Pilot is offline right now, so here are the top-ranked plans from the planner instead.'
      : 'Perkly’s Pilot is offline right now, and none of your linked balances cover a reward yet.',
    cards: [],
    table: rows.length ? { columns: ['Program', 'Best use', 'Value'], rows } : null,
    notes: ['Backup answer: the planner ranked these without the Pilot.'],
    followUps: [],
    engine: 'planner-fallback',
  };
}
