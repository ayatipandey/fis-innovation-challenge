// Data access. Balances, expiries and purchases are what a linked program shares
// with Perkly; in the prototype they are synthetic. Every record returned to the
// client carries isDemo so the UI can label it.

import { randomBytes, randomUUID } from 'node:crypto';
import type { Transaction } from '@libsql/client';
import { DEMO_BALANCES, DEMO_PERSON, OPTIONS, optionById, optionsFor, programById, syntheticPurchases } from '../../shared/demo-data.js';
import { computeHabits } from '../../shared/habits.js';
import { planBalance } from '../../shared/planner.js';
import { DEFAULT_THEME } from '../../shared/themes.js';
import type { Activity, Channel, Habits, Hold, LinkedProgram, Moment, Preferences, Purchase, Rating, UsePlan } from '../../shared/types.js';
import { config } from './config.js';
import type { DB, Exec } from './db.js';
import { nowIso } from './db.js';

export class Conflict extends Error {
  status = 409;
}

// ── Preferences ─────────────────────────────────────────────────────────

export function defaultPreferences(privacy?: Partial<Preferences['privacy']>): Preferences {
  return {
    displayName: '',
    categories: [],
    theme: DEFAULT_THEME,
    notifications: {
      preset: 'balanced',
      dailyLimit: 3,
      expirationReminders: true,
      locationAlerts: true,
      quietHours: { enabled: true, start: '21:00', end: '08:00' },
      channels: ['push'],
    },
    accessibility: { textSize: 'default', highContrast: false, reducedMotion: false },
    privacy: { personalization: true, location: false, useHistory: true, marketing: false, ...privacy },
    onboarding: { completed: false, skipped: [] },
  };
}

export async function getPreferences(db: DB, userId: string): Promise<Preferences> {
  const row = await db.get<{ data: string }>('SELECT data FROM preferences WHERE user_id = ?', [userId]);
  const base = defaultPreferences();
  if (!row) return base;
  const saved = JSON.parse(row.data) as Preferences;
  return {
    ...base,
    ...saved,
    notifications: { ...base.notifications, ...saved.notifications },
    accessibility: { ...base.accessibility, ...saved.accessibility },
    privacy: { ...base.privacy, ...saved.privacy },
    onboarding: { ...base.onboarding, ...saved.onboarding },
  };
}

export async function savePreferences(db: DB, userId: string, prefs: Preferences) {
  await db.run(
    `INSERT INTO preferences (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [userId, JSON.stringify(prefs), nowIso()],
  );
}

// ── Activity ────────────────────────────────────────────────────────────

export async function addActivity(db: DB, userId: string, a: Omit<Activity, 'id' | 'isDemo'>, tx?: Exec) {
  await db.run('INSERT INTO activity (id, user_id, kind, label, amount, date) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), userId, a.kind, a.label, a.amount, a.date], tx);
}

export async function listActivity(db: DB, userId: string): Promise<Activity[]> {
  const rows = await db.all<Omit<Activity, 'isDemo'>>('SELECT id, kind, label, amount, date FROM activity WHERE user_id = ? ORDER BY date DESC LIMIT 50', [userId]);
  return rows.map((a) => ({ ...a, isDemo: true as const }));
}

// ── Holds ───────────────────────────────────────────────────────────────

interface HoldRow {
  id: string;
  program_id: string;
  option_id: string;
  points: number;
  channel: Channel;
  code: string;
  status: Hold['status'];
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
}

const toHold = (r: HoldRow): Hold => ({
  id: r.id,
  programId: r.program_id,
  optionId: r.option_id,
  points: r.points,
  channel: r.channel,
  code: r.code,
  status: r.status,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  resolvedAt: r.resolved_at,
  isDemo: true,
});

/** Holds past their 2-hour window release their points. */
async function expireStaleHolds(db: DB, userId: string, tx?: Exec) {
  const now = nowIso();
  const stale = await db.all<HoldRow>("SELECT * FROM holds WHERE user_id = ? AND status = 'held' AND expires_at <= ?", [userId, now], tx);
  for (const h of stale) {
    await db.run("UPDATE holds SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'held'", [now, h.id], tx);
    const o = optionById(h.option_id);
    await addActivity(db, userId, { kind: 'expired', label: `Hold expired: ${o?.title ?? h.option_id}`, amount: `${h.points} returned`, date: now }, tx);
  }
}

async function heldPoints(db: DB, userId: string, programId: string, tx?: Exec) {
  const r = await db.get<{ n: number | null }>(
    "SELECT SUM(points) AS n FROM holds WHERE user_id = ? AND program_id = ? AND status = 'held' AND expires_at > ?",
    [userId, programId, nowIso()],
    tx,
  );
  return Number(r?.n ?? 0);
}

export async function listHolds(db: DB, userId: string): Promise<Hold[]> {
  await expireStaleHolds(db, userId);
  const rows = await db.all<HoldRow>('SELECT * FROM holds WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', [userId]);
  return rows.map(toHold);
}

/**
 * Places a hold on points for one reward. Runs in a write transaction so two
 * requests can't both spend the same balance, and uses an idempotency key so a
 * double tap returns the same hold instead of creating a second one.
 */
export async function createHold(db: DB, userId: string, optionId: string, channel: Channel, idemKey: string): Promise<Hold> {
  const option = optionById(optionId);
  if (!option) throw Object.assign(new Error('This reward no longer exists.'), { status: 404 });
  if (!option.channels.includes(channel)) throw new Conflict(`This reward can only be used ${option.channels.includes('online') ? 'online' : 'in store'}.`);
  return db.write(async (tx: Transaction) => {
    const existing = await db.get<HoldRow>('SELECT * FROM holds WHERE user_id = ? AND idem_key = ?', [userId, idemKey], tx);
    if (existing) return toHold(existing);
    await expireStaleHolds(db, userId, tx);
    const link = await db.get<{ balance: number }>('SELECT balance FROM links WHERE user_id = ? AND program_id = ?', [userId, option.programId], tx);
    if (!link) throw new Conflict(`Link ${programById(option.programId)?.name} first.`);
    const available = Number(link.balance) - (await heldPoints(db, userId, option.programId, tx));
    if (available < option.cost) {
      throw new Conflict(
        available > 0
          ? `You have ${available.toLocaleString('en-US')} available, and this needs ${option.cost.toLocaleString('en-US')}. Some points may be on hold for another reward.`
          : 'All of these points are on hold for another reward.',
      );
    }
    const now = new Date();
    const hold: HoldRow = {
      id: randomUUID(),
      program_id: option.programId,
      option_id: option.id,
      points: option.cost,
      channel,
      code: `${programById(option.programId)?.monogram ?? 'PK'}-${randomBytes(4).toString('hex').toUpperCase()}`,
      status: 'held',
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + config.holdMinutes * 60_000).toISOString(),
      resolved_at: null,
    };
    await db.run(
      'INSERT INTO holds (id, user_id, program_id, option_id, points, channel, code, status, idem_key, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [hold.id, userId, hold.program_id, hold.option_id, hold.points, hold.channel, hold.code, hold.status, idemKey, hold.created_at, hold.expires_at],
      tx,
    );
    await addActivity(db, userId, { kind: 'held', label: `On hold: ${option.title}`, amount: `${option.cost} held`, date: hold.created_at }, tx);
    return toHold(hold);
  });
}

/** The program confirms the transaction: the held points are spent, soonest-expiring first. */
export async function confirmHold(db: DB, userId: string, holdId: string): Promise<Hold> {
  return db.write(async (tx) => {
    await expireStaleHolds(db, userId, tx);
    const h = await db.get<HoldRow>('SELECT * FROM holds WHERE id = ? AND user_id = ?', [holdId, userId], tx);
    if (!h) throw Object.assign(new Error('Hold not found.'), { status: 404 });
    if (h.status === 'confirmed') return toHold(h);
    if (h.status !== 'held') throw new Conflict(h.status === 'expired' ? 'This hold expired and the points were returned. Start again.' : 'This hold was released.');
    const now = nowIso();
    await db.run("UPDATE holds SET status = 'confirmed', resolved_at = ? WHERE id = ? AND status = 'held'", [now, h.id], tx);
    await db.run('UPDATE links SET balance = balance - ? WHERE user_id = ? AND program_id = ?', [h.points, userId, h.program_id], tx);
    let left = Number(h.points);
    const batches = await db.all<{ id: string; points: number }>('SELECT id, points FROM expiries WHERE user_id = ? AND program_id = ? AND points > 0 ORDER BY expires_at', [userId, h.program_id], tx);
    for (const b of batches) {
      if (left <= 0) break;
      const take = Math.min(left, Number(b.points));
      await db.run('UPDATE expiries SET points = points - ? WHERE id = ?', [take, b.id], tx);
      left -= take;
    }
    const o = optionById(h.option_id);
    await addActivity(db, userId, { kind: 'redeemed', label: o?.title ?? h.option_id, amount: `−${h.points} (${o ? `$${o.value.toFixed(2)}` : ''})`, date: now }, tx);
    return toHold({ ...h, status: 'confirmed', resolved_at: now });
  });
}

export async function releaseHold(db: DB, userId: string, holdId: string): Promise<Hold> {
  return db.write(async (tx) => {
    const h = await db.get<HoldRow>('SELECT * FROM holds WHERE id = ? AND user_id = ?', [holdId, userId], tx);
    if (!h) throw Object.assign(new Error('Hold not found.'), { status: 404 });
    if (h.status !== 'held') return toHold(h);
    const now = nowIso();
    await db.run("UPDATE holds SET status = 'released', resolved_at = ? WHERE id = ?", [now, h.id], tx);
    await addActivity(db, userId, { kind: 'released', label: `Released: ${optionById(h.option_id)?.title ?? h.option_id}`, amount: `${h.points} returned`, date: now }, tx);
    return toHold({ ...h, status: 'released', resolved_at: now });
  });
}

// ── Linked programs ─────────────────────────────────────────────────────

export async function listLinks(db: DB, userId: string): Promise<LinkedProgram[]> {
  await expireStaleHolds(db, userId);
  const links = await db.all<{ program_id: string; balance: number; shares: string; linked_at: string }>('SELECT program_id, balance, shares, linked_at FROM links WHERE user_id = ?', [userId]);
  const out: LinkedProgram[] = [];
  for (const l of links) {
    const held = await heldPoints(db, userId, l.program_id);
    const expiries = await db.all<{ points: number; expires_at: string }>(
      'SELECT points, expires_at FROM expiries WHERE user_id = ? AND program_id = ? AND points > 0 AND expires_at > ? ORDER BY expires_at',
      [userId, l.program_id, nowIso()],
    );
    out.push({
      programId: l.program_id,
      balance: Number(l.balance),
      held,
      available: Number(l.balance) - held,
      expiries: expiries.map((e) => ({ points: Number(e.points), expiresAt: e.expires_at })),
      linkedAt: l.linked_at,
      shares: JSON.parse(l.shares),
      isDemo: true,
    });
  }
  return out;
}

/** Simulates the program's consent screen and the read-only data it then shares. */
export async function linkProgram(db: DB, userId: string, programId: string, shares: { history: boolean; visits: boolean }, seed: string) {
  const demo = DEMO_BALANCES[programId];
  if (!demo) throw Object.assign(new Error('Program not found.'), { status: 404 });
  const now = new Date();
  await db.write(async (tx) => {
    const exists = await db.get('SELECT 1 FROM links WHERE user_id = ? AND program_id = ?', [userId, programId], tx);
    if (exists) {
      await db.run('UPDATE links SET shares = ? WHERE user_id = ? AND program_id = ?', [JSON.stringify(shares), userId, programId], tx);
    } else {
      await db.run('INSERT INTO links (user_id, program_id, balance, shares, linked_at) VALUES (?, ?, ?, ?, ?)', [userId, programId, demo.balance, JSON.stringify(shares), now.toISOString()], tx);
      for (const e of demo.expiring) {
        await db.run('INSERT INTO expiries (id, user_id, program_id, points, expires_at) VALUES (?, ?, ?, ?, ?)', [randomUUID(), userId, programId, e.points, new Date(now.getTime() + e.inDays * 86400_000).toISOString()], tx);
      }
      await addActivity(db, userId, { kind: 'linked', label: `Linked ${programById(programId)?.name}`, amount: `${demo.balance.toLocaleString('en-US')} read`, date: now.toISOString() }, tx);
    }
    await db.run('DELETE FROM purchases WHERE user_id = ? AND program_id = ?', [userId, programId], tx);
    if (shares.history) {
      for (const p of syntheticPurchases(seed, programId, now)) {
        await db.run('INSERT INTO purchases (user_id, id, program_id, merchant_id, category, amount, at) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, p.id, p.programId, p.merchantId, p.category, p.amount, p.at], tx);
      }
    }
  });
}

export async function unlinkProgram(db: DB, userId: string, programId: string) {
  await db.write(async (tx) => {
    const now = nowIso();
    await db.run("UPDATE holds SET status = 'released', resolved_at = ? WHERE user_id = ? AND program_id = ? AND status = 'held'", [now, userId, programId], tx);
    for (const t of ['links', 'expiries', 'purchases']) await db.run(`DELETE FROM ${t} WHERE user_id = ? AND program_id = ?`, [userId, programId], tx);
  });
}

export async function listPurchases(db: DB, userId: string): Promise<Purchase[]> {
  const rows = await db.all<{ id: string; program_id: string; merchant_id: string; category: Purchase['category']; amount: number; at: string }>(
    'SELECT id, program_id, merchant_id, category, amount, at FROM purchases WHERE user_id = ? ORDER BY at',
    [userId],
  );
  return rows.map((r) => ({ id: r.id, programId: r.program_id, merchantId: r.merchant_id, category: r.category, amount: Number(r.amount), at: r.at }));
}

export async function habitsFor(db: DB, userId: string, prefs: Preferences): Promise<Habits> {
  if (!prefs.privacy.personalization || !prefs.privacy.useHistory) return computeHabits([]);
  return computeHabits(await listPurchases(db, userId));
}

export async function plansFor(db: DB, userId: string, prefs: Preferences) {
  const [links, habits] = await Promise.all([listLinks(db, userId), habitsFor(db, userId, prefs)]);
  const programs = links.map((l) => {
    const p = programById(l.programId)!;
    const plans: UsePlan[] = planBalance({ programId: l.programId, options: optionsFor(l.programId), available: l.available, expiries: l.expiries, habits, unit: p.unit });
    const nextReward = optionsFor(l.programId).filter((o) => o.cost > l.available).sort((a, b) => a.cost - b.cost)[0];
    return { link: l, program: p, plans, nextReward: nextReward ? { optionId: nextReward.id, pointsNeeded: nextReward.cost - l.available } : null };
  });
  return { programs, habits };
}

// ── Moments and ratings ─────────────────────────────────────────────────

export async function saveMoment(db: DB, userId: string, session: string, m: Moment) {
  await db.run('INSERT INTO moments (id, user_id, session, sent, data, created_at) VALUES (?, ?, ?, ?, ?, ?)', [m.id, userId, session, m.sent ? 1 : 0, JSON.stringify(m), m.at]);
}

export async function sentInSession(db: DB, userId: string, session: string) {
  const since = new Date(Date.now() - 86400_000).toISOString();
  const r = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM moments WHERE user_id = ? AND session = ? AND sent = 1 AND created_at > ?', [userId, session, since]);
  return Number(r?.n ?? 0);
}

export async function sentOptionsInSession(db: DB, userId: string, session: string) {
  const rows = await db.all<{ data: string }>('SELECT data FROM moments WHERE user_id = ? AND session = ? AND sent = 1', [userId, session]);
  return new Set(rows.map((r) => (JSON.parse(r.data) as Moment).optionId));
}

export async function listMoments(db: DB, userId: string, limit = 20): Promise<Moment[]> {
  const rows = await db.all<{ data: string }>('SELECT data FROM moments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
  return rows.map((r) => JSON.parse(r.data));
}

export async function getRatings(db: DB, userId: string) {
  const rows = await db.all<{ key: string; good: number; fine: number; bad: number }>('SELECT key, good, fine, bad FROM ratings WHERE user_id = ?', [userId]);
  return Object.fromEntries(rows.map((r) => [r.key, { good: Number(r.good), fine: Number(r.fine), bad: Number(r.bad) }]));
}

export async function rateMoment(db: DB, userId: string, momentId: string, rating: Rating, key: string, message: string) {
  const row = await db.get<{ data: string }>('SELECT data FROM moments WHERE id = ? AND user_id = ?', [momentId, userId]);
  if (!row) throw Object.assign(new Error('Notification not found.'), { status: 404 });
  const m = { ...(JSON.parse(row.data) as Moment), rating, ratingMessage: message };
  await db.write(async (tx) => {
    await db.run('UPDATE moments SET data = ? WHERE id = ?', [JSON.stringify(m), momentId], tx);
    await db.run(
      `INSERT INTO ratings (user_id, key, ${rating}) VALUES (?, ?, 1)
       ON CONFLICT(user_id, key) DO UPDATE SET ${rating} = ${rating} + 1`,
      [userId, key],
      tx,
    );
  });
  return m;
}

export async function resetRatings(db: DB, userId: string) {
  await db.run('DELETE FROM ratings WHERE user_id = ?', [userId]);
}

// ── Account ─────────────────────────────────────────────────────────────

export async function deleteUser(db: DB, userId: string) {
  // Explicit deletes: remote libSQL connections don't always enforce cascades.
  await db.write(async (tx) => {
    for (const t of ['sessions', 'consents', 'preferences', 'links', 'expiries', 'purchases', 'holds', 'moments', 'ratings', 'activity', 'recently_viewed'])
      await db.run(`DELETE FROM ${t} WHERE user_id = ?`, [userId], tx);
    await db.run('DELETE FROM users WHERE id = ?', [userId], tx);
  });
}

/** Seeds the fictional "Try the Demo" student. */
export async function seedDemoUser(db: DB, userId: string) {
  const prefs = defaultPreferences({ location: true });
  prefs.displayName = DEMO_PERSON.displayName;
  prefs.categories = DEMO_PERSON.categories;
  prefs.onboarding = { completed: true, skipped: [] };
  await savePreferences(db, userId, prefs);
  for (const id of DEMO_PERSON.linked) await linkProgram(db, userId, id, { history: true, visits: true }, 'john-doe-demo');
  const d = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();
  await addActivity(db, userId, { kind: 'redeemed', label: 'A free latte', amount: '−25 ($5.00)', date: d(3) });
  await addActivity(db, userId, { kind: 'redeemed', label: '$5 off your shop', amount: '−500 ($5.00)', date: d(8) });
}

export const allOptionIds = () => OPTIONS.map((o) => o.id);
