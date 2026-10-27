// Data access for user-owned records. Demo data is always written with is_demo = 1
// and every value returned to the client carries isDemo so the UI can label it.

import { randomUUID } from 'node:crypto';
import {
  DEMO_PERSON,
  DEMO_PROGRAM_BALANCES,
  DEMO_SPENDING,
  PROGRAMS,
} from '../../shared/demo-data';
import type {
  Activity,
  PaymentMethod,
  PaymentMethodKind,
  Preferences,
  ProgramLink,
  RedemptionRecord,
  SpendingSummary,
} from '../../shared/types';
import type { DB } from './db';
import { nowIso } from './db';

export function defaultPreferences(privacy?: Partial<Preferences['privacy']>): Preferences {
  return {
    displayName: '',
    categories: [],
    subcategories: [],
    favoriteBrands: [],
    notifications: {
      preset: 'balanced',
      dailyLimit: 3,
      categories: [],
      favoriteBrandAlerts: true,
      expirationReminders: true,
      locationAlerts: false,
      quietHours: { enabled: true, start: '21:00', end: '08:00' },
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      channels: ['push'],
      routineAlerts: false,
    },
    accessibility: { textSize: 'default', highContrast: false, reducedMotion: false },
    privacy: { personalization: false, spendingData: false, location: false, marketing: false, ...privacy },
    onboarding: { completed: false, skipped: [] },
  };
}

export function getPreferences(db: DB, userId: string): Preferences {
  const row = db.prepare('SELECT data FROM preferences WHERE user_id = ?').get(userId) as { data: string } | undefined;
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

export function savePreferences(db: DB, userId: string, prefs: Preferences) {
  db.prepare(
    `INSERT INTO preferences (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(userId, JSON.stringify(prefs), nowIso());
}

/** Spending data only exists when the user has switched it on. In this prototype it is synthetic. */
export function spendingFor(prefs: Preferences): SpendingSummary | null {
  return prefs.privacy.spendingData ? DEMO_SPENDING : null;
}

export function listFavorites(db: DB, userId: string): string[] {
  return (db.prepare('SELECT offer_id FROM favorites WHERE user_id = ? ORDER BY created_at').all(userId) as { offer_id: string }[]).map(
    (r) => r.offer_id,
  );
}

export function listPaymentMethods(db: DB, userId: string): PaymentMethod[] {
  const rows = db
    .prepare('SELECT id, kind, label, token_ref, preferred, is_demo FROM payment_methods WHERE user_id = ? ORDER BY created_at')
    .all(userId) as { id: string; kind: PaymentMethodKind; label: string; token_ref: string; preferred: number; is_demo: number }[];
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    tokenRef: r.token_ref,
    preferred: Boolean(r.preferred),
    isDemo: Boolean(r.is_demo),
  }));
}

const DEMO_METHOD_LABELS: Record<Exclude<PaymentMethodKind, 'in_store'>, string> = {
  saved_card: 'Demo Visa ending in 4242',
  apple_pay: 'Apple Pay (simulated)',
  online_banking: 'Demo checking account ending in 6789',
};

export function addDemoPaymentMethod(db: DB, userId: string, kind: Exclude<PaymentMethodKind, 'in_store'>): PaymentMethod {
  const existing = listPaymentMethods(db, userId).find((m) => m.kind === kind);
  if (existing) return existing;
  const id = randomUUID();
  const preferred = listPaymentMethods(db, userId).length === 0;
  // A real integration stores only the provider's token. The demo token is random and maps to nothing.
  const tokenRef = `pm_demo_${randomUUID().slice(0, 12)}`;
  db.prepare(
    'INSERT INTO payment_methods (id, user_id, kind, label, token_ref, preferred, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
  ).run(id, userId, kind, DEMO_METHOD_LABELS[kind], tokenRef, preferred ? 1 : 0, nowIso());
  return listPaymentMethods(db, userId).find((m) => m.id === id)!;
}

export function listProgramLinks(db: DB, userId: string): ProgramLink[] {
  const rows = db
    .prepare('SELECT program_id, status, balance, held, linked_at, is_demo FROM program_links WHERE user_id = ?')
    .all(userId) as { program_id: string; status: 'connected' | 'disconnected'; balance: number; held: number; linked_at: string | null; is_demo: number }[];
  return PROGRAMS.map((p) => {
    const r = rows.find((x) => x.program_id === p.id);
    return {
      programId: p.id,
      status: r?.status ?? 'disconnected',
      balance: r && r.status === 'connected' ? r.balance : 0,
      linkedAt: r?.linked_at ?? null,
      isDemo: true,
    };
  });
}

export function connectedBalances(db: DB, userId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of listProgramLinks(db, userId)) if (l.status === 'connected') out[l.programId] = l.balance;
  return out;
}

export function connectDemoProgram(db: DB, userId: string, programId: string) {
  const existing = db.prepare('SELECT balance FROM program_links WHERE user_id = ? AND program_id = ?').get(userId, programId) as
    | { balance: number }
    | undefined;
  const balance = existing?.balance ?? DEMO_PROGRAM_BALANCES[programId] ?? 0;
  db.prepare(
    `INSERT INTO program_links (user_id, program_id, status, balance, linked_at, is_demo) VALUES (?, ?, 'connected', ?, ?, 1)
     ON CONFLICT(user_id, program_id) DO UPDATE SET status = 'connected', linked_at = excluded.linked_at`,
  ).run(userId, programId, balance, nowIso());
}

export function disconnectProgram(db: DB, userId: string, programId: string) {
  db.prepare(`UPDATE program_links SET status = 'disconnected' WHERE user_id = ? AND program_id = ?`).run(userId, programId);
}

export function addActivity(db: DB, userId: string, a: Omit<Activity, 'id' | 'isDemo'>) {
  db.prepare('INSERT INTO activity (id, user_id, kind, label, amount, date) VALUES (?, ?, ?, ?, ?, ?)').run(
    randomUUID(), userId, a.kind, a.label, a.amount, a.date,
  );
}

export function listActivity(db: DB, userId: string): Activity[] {
  return (db.prepare('SELECT id, kind, label, amount, date FROM activity WHERE user_id = ? ORDER BY date DESC LIMIT 50').all(userId) as Omit<Activity, 'isDemo'>[]).map(
    (a) => ({ ...a, isDemo: true as const }),
  );
}

export function listRedemptions(db: DB, userId: string): RedemptionRecord[] {
  return (db.prepare('SELECT data FROM redemptions WHERE user_id = ? ORDER BY created_at DESC').all(userId) as { data: string }[]).map(
    (r) => JSON.parse(r.data),
  );
}

export function saveRedemption(db: DB, userId: string, rec: RedemptionRecord) {
  db.prepare(
    `INSERT INTO redemptions (id, user_id, offer_id, data, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
  ).run(rec.id, userId, rec.offerId, JSON.stringify(rec), rec.createdAt);
}

export function brandHistory(db: DB, userId: string, brandOf: (offerId: string) => string | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of listRedemptions(db, userId)) {
    if (r.status !== 'completed_demo') continue;
    const b = brandOf(r.offerId);
    if (b) counts[b] = (counts[b] ?? 0) + 1;
  }
  return counts;
}

export function cashbackSummary(db: DB, userId: string) {
  const rows = listActivity(db, userId);
  const parse = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;
  const available = rows.filter((a) => a.kind === 'cashback').reduce((n, a) => n + parse(a.amount), 0);
  const pending = rows.filter((a) => a.kind === 'pending').reduce((n, a) => n + parse(a.amount), 0);
  return { available: Math.round(available * 100) / 100, pending: Math.round(pending * 100) / 100, isDemo: true };
}

/** Seeds the fictional "Try the Demo" person. */
export function seedDemoUser(db: DB, userId: string) {
  const prefs = defaultPreferences({ personalization: true, spendingData: true, location: true });
  prefs.displayName = DEMO_PERSON.displayName;
  prefs.categories = DEMO_PERSON.categories;
  prefs.favoriteBrands = DEMO_PERSON.favoriteBrands;
  prefs.notifications.categories = ['coffee', 'groceries'];
  prefs.onboarding = { completed: true, skipped: [] };
  savePreferences(db, userId, prefs);

  for (const id of ['ember-rewards', 'greenleaf-plus', 'northwind-miles', 'maison-circle']) connectDemoProgram(db, userId, id);
  addDemoPaymentMethod(db, userId, 'apple_pay');
  addDemoPaymentMethod(db, userId, 'saved_card');

  const d = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();
  addActivity(db, userId, { kind: 'earned', label: 'Ember Rewards: 6 points on a flat white', amount: '+6 pts', date: d(1) });
  addActivity(db, userId, { kind: 'cashback', label: 'Harvest Lane produce cashback', amount: '$2.15', date: d(3) });
  addActivity(db, userId, { kind: 'pending', label: 'Kin Noodle Bar cashback, posting', amount: '$5.00', date: d(2) });
  addActivity(db, userId, { kind: 'redeemed', label: 'Greenleaf Plus: 1,000 points at checkout', amount: '−$10.00', date: d(6) });
  addActivity(db, userId, { kind: 'cashback', label: 'Glide Rides ride credit', amount: '$3.00', date: d(9) });
  addActivity(db, userId, { kind: 'expired', label: 'Paragon Cinemas 2-for-1 (unused)', amount: '$16.00', date: d(14) });
  addActivity(db, userId, { kind: 'earned', label: 'Northwind Miles: flight to Chicago', amount: '+1,240 mi', date: d(18) });
  addActivity(db, userId, { kind: 'cashback', label: 'Kin Noodle Bar cashback', amount: '$5.00', date: d(21) });
  addActivity(db, userId, { kind: 'cashback', label: 'Harvest Lane produce cashback', amount: '$4.45', date: d(24) });
}
