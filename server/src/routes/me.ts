import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { brandById } from '../../../shared/demo-data';
import { mockPartner } from '../adapters';
import { destroySession, requireUser } from '../auth';
import type { DB } from '../db';
import { nowIso } from '../db';
import type { CatalogSource } from '../services/catalog';
import { catalogMeta, toRewardInput } from '../services/catalog';
import * as rec from '../services/recommender';
import {
  brandHistory,
  getPreferences,
  listActivity,
  listFavorites,
  listUses,
  recordUse,
  savePreferences,
  spendingFor,
  usageSummary,
} from '../store';
import { copilotSchema, firstIssue, preferencesSchema, timeQuery, useSchema } from '../validation';

export function meRoutes(db: DB, catalog: CatalogSource, opts: { rateLimit: boolean }) {
  const r = Router();
  r.use(requireUser);
  const uid = (req: Request) => req.user!.id;
  const copilotLimiter = opts.rateLimit
    ? rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'You’re asking quickly. Wait a minute and try again.' } })
    : (_q: unknown, _s: unknown, next: () => void) => next();

  function timeContext(weekday?: number, hour?: number): rec.TimeContext {
    const now = new Date();
    return { now: now.toISOString(), weekday: weekday ?? (now.getDay() + 6) % 7, hour: hour ?? now.getHours() };
  }

  /** Only the signals this user has allowed. */
  function userSummary(userId: string): rec.UserSummary {
    const prefs = getPreferences(db, userId);
    const personal = prefs.privacy.personalization;
    return {
      categories: prefs.categories,
      favoriteBrands: prefs.favoriteBrands,
      spending: personal ? spendingFor(prefs) : null,
      brandHistory: personal ? brandHistory(db, userId, (id) => catalog.get(id)?.brandId) : {},
      personalization: personal,
    };
  }

  // ── Catalog and member summary ────────────────────────────────────────
  r.get('/catalog', (_req, res) => {
    res.json({ offers: catalog.list(), ...catalogMeta() });
  });

  r.get('/wallet', (req, res) => {
    const id = uid(req);
    const recent = (db.prepare('SELECT offer_id FROM recently_viewed WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 6').all(id) as { offer_id: string }[]).map((a) => a.offer_id);
    res.json({
      summary: usageSummary(db, id),
      activity: listActivity(db, id),
      favorites: listFavorites(db, id),
      recentlyViewed: recent,
      spendingSource: spendingFor(getPreferences(db, id))?.source ?? 'none',
    });
  });

  // ── Preferences ───────────────────────────────────────────────────────
  r.get('/preferences', (req, res) => {
    res.json(getPreferences(db, uid(req)));
  });

  r.put('/preferences', (req, res) => {
    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    savePreferences(db, uid(req), parsed.data as ReturnType<typeof getPreferences>);
    res.json(getPreferences(db, uid(req)));
  });

  // ── Favorites and recently viewed ─────────────────────────────────────
  r.put('/favorites/:offerId', (req, res) => {
    if (!catalog.get(req.params.offerId)) {
      res.status(404).json({ error: 'Reward not found.' });
      return;
    }
    db.prepare('INSERT OR IGNORE INTO favorites (user_id, offer_id, created_at) VALUES (?, ?, ?)').run(uid(req), req.params.offerId, nowIso());
    res.json({ favorites: listFavorites(db, uid(req)) });
  });

  r.delete('/favorites/:offerId', (req, res) => {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND offer_id = ?').run(uid(req), req.params.offerId);
    res.json({ favorites: listFavorites(db, uid(req)) });
  });

  r.post('/viewed/:offerId', (req, res) => {
    if (catalog.get(req.params.offerId)) {
      db.prepare(
        `INSERT INTO recently_viewed (user_id, offer_id, viewed_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id, offer_id) DO UPDATE SET viewed_at = excluded.viewed_at`,
      ).run(uid(req), req.params.offerId, nowIso());
    }
    res.json({ ok: true });
  });

  // ── Recommendations and Copilot ───────────────────────────────────────
  r.get('/recommendations', async (req, res) => {
    const q = timeQuery.safeParse(req.query);
    const t = timeContext(q.success ? q.data.weekday : undefined, q.success ? q.data.hour : undefined);
    const prefs = getPreferences(db, uid(req));
    const result = await rec.recommend(userSummary(uid(req)), catalog.list(), t, prefs.privacy.location, 30);
    res.json({ ...result, location: prefs.privacy.location ? 'Demo location: SoHo, New York' : null });
  });

  r.post('/copilot', copilotLimiter, async (req, res) => {
    const parsed = copilotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    const prefs = getPreferences(db, uid(req));
    try {
      const out = await rec.copilot({
        message: parsed.data.message,
        user: userSummary(uid(req)),
        rewards: catalog.list().map(toRewardInput),
        time: timeContext(parsed.data.weekday, parsed.data.hour),
        location: { permitted: prefs.privacy.location },
      });
      res.json(out);
    } catch {
      res.status(503).json({ error: 'The Copilot service isn’t responding. Try again in a moment, or browse rewards in Explore.' });
    }
  });

  // ── Using a reward ────────────────────────────────────────────────────
  // The member uses the reward on the partner's site or in store; the partner
  // reports the purchase back. Here the partner report is simulated.
  r.post('/rewards/:offerId/use', (req, res) => {
    const parsed = useSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Choose online or in store.' });
      return;
    }
    const offer = catalog.get(req.params.offerId);
    if (!offer) {
      res.status(404).json({ error: 'This reward no longer exists.' });
      return;
    }
    if (new Date(offer.expiresAt) < new Date()) {
      res.status(409).json({ error: 'This reward has expired.' });
      return;
    }
    if (!offer.valid.channels.includes(parsed.data.channel)) {
      res.status(409).json({ error: `${brandById(offer.brandId)?.name} only accepts this reward ${offer.valid.channels.includes('online') ? 'online' : 'in store'}.` });
      return;
    }
    const report = mockPartner.reportUse(offer, parsed.data.channel);
    const use = recordUse(db, uid(req), offer, parsed.data.channel);
    res.status(201).json({ use, simulated: report.simulated });
  });

  r.get('/history', (req, res) => {
    res.json({ uses: listUses(db, uid(req)), activity: listActivity(db, uid(req)) });
  });

  // ── Data rights ───────────────────────────────────────────────────────
  r.get('/export', (req, res) => {
    const id = uid(req);
    const user = db.prepare('SELECT email, is_demo, created_at FROM users WHERE id = ?').get(id);
    const consents = db.prepare('SELECT terms_version, accepted_at, spending_data, location, marketing FROM consents WHERE user_id = ?').all(id);
    res.setHeader('content-disposition', 'attachment; filename="perkly-data-export.json"');
    res.json({
      exportedAt: nowIso(),
      account: user,
      consents,
      preferences: getPreferences(db, id),
      favorites: listFavorites(db, id).map((o) => ({ offerId: o, brand: brandById(catalog.get(o)?.brandId ?? '')?.name })),
      rewardsUsed: listUses(db, id),
      activity: listActivity(db, id),
      note: 'Passwords are stored only as bcrypt hashes and are not included. Perkly holds no payment details.',
    });
  });

  r.delete('/account', (req, res) => {
    if (req.body?.confirm !== 'DELETE') {
      res.status(400).json({ error: 'Type DELETE to confirm.' });
      return;
    }
    const id = uid(req);
    destroySession(db, req, res);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  return r;
}
