// Data access for user-owned records. Demo records are always returned with
// isDemo so the UI can label them.

import { randomUUID } from 'node:crypto';
import { DEMO_PERSON, DEMO_SPENDING, brandById } from '../../shared/demo-data';
import type { Activity, Channel, Offer, Preferences, RewardUse, SpendingSummary } from '../../shared/types';
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

export function listUses(db: DB, userId: string): RewardUse[] {
  return (db.prepare('SELECT data FROM reward_uses WHERE user_id = ? ORDER BY created_at DESC').all(userId) as { data: string }[]).map(
    (r) => JSON.parse(r.data),
  );
}

export function recordUse(db: DB, userId: string, offer: Offer, channel: Channel, at = nowIso()): RewardUse {
  const use: RewardUse = {
    id: randomUUID(),
    offerId: offer.id,
    channel,
    createdAt: at,
    estimatedSaving: offer.valueEstimate.amount,
    status: 'reported_demo',
    isDemo: true,
  };
  db.prepare('INSERT INTO reward_uses (id, user_id, offer_id, data, created_at) VALUES (?, ?, ?, ?, ?)').run(
    use.id, userId, offer.id, JSON.stringify(use), at,
  );
  const brand = brandById(offer.brandId)?.name ?? '';
  addActivity(db, userId, {
    kind: 'used',
    label: `${brand}: ${offer.benefit.summary}`,
    amount: use.estimatedSaving != null ? `~$${use.estimatedSaving.toFixed(2)} saved` : 'Used',
    date: at,
  });
  return use;
}

export function brandHistory(db: DB, userId: string, brandOf: (offerId: string) => string | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const u of listUses(db, userId)) {
    const b = brandOf(u.offerId);
    if (b) counts[b] = (counts[b] ?? 0) + 1;
  }
  return counts;
}

/** Totals for the Home summary. Savings are estimates from each offer's stated value. */
export function usageSummary(db: DB, userId: string) {
  const uses = listUses(db, userId);
  const saved = uses.reduce((n, u) => n + (u.estimatedSaving ?? 0), 0);
  return { rewardsUsed: uses.length, estimatedSaved: Math.round(saved * 100) / 100, isDemo: true };
}

/** Seeds the fictional "Try the Demo" person. */
export function seedDemoUser(db: DB, userId: string, offers: Offer[]) {
  const prefs = defaultPreferences({ personalization: true, spendingData: true, location: true });
  prefs.displayName = DEMO_PERSON.displayName;
  prefs.categories = DEMO_PERSON.categories;
  prefs.favoriteBrands = DEMO_PERSON.favoriteBrands;
  prefs.notifications.categories = ['coffee', 'groceries'];
  prefs.onboarding = { completed: true, skipped: [] };
  savePreferences(db, userId, prefs);

  const ago = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();
  const find = (id: string) => offers.find((o) => o.id === id);
  const history: [string, Channel, number][] = [
    ['ember-flat-white', 'in_store', 1],
    ['kin-noodle-online', 'online', 4],
    ['greenleaf-10-off-75', 'in_store', 9],
    ['glide-rides', 'online', 12],
  ];
  for (const [id, ch, d] of history) {
    const o = find(id);
    if (o) recordUse(db, userId, o, ch, ago(d));
  }
  addActivity(db, userId, { kind: 'expired', label: 'Paragon Cinemas: second ticket free (unused)', amount: '$16.00 missed', date: ago(14) });
}
