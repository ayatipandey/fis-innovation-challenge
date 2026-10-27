import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { PROGRAMS, brandById, programById } from '../../../shared/demo-data';
import type { RedemptionRecord } from '../../../shared/types';
import { destroySession, requireUser } from '../auth';
import type { DB } from '../db';
import { nowIso } from '../db';
import type { CatalogSource } from '../services/catalog';
import { catalogMeta, toRewardInput } from '../services/catalog';
import * as rec from '../services/recommender';
import { recover, redeem } from '../services/redemption';
import {
  addDemoPaymentMethod,
  brandHistory,
  cashbackSummary,
  connectDemoProgram,
  connectedBalances,
  disconnectProgram,
  getPreferences,
  listActivity,
  listFavorites,
  listPaymentMethods,
  listProgramLinks,
  listRedemptions,
  savePreferences,
  spendingFor,
} from '../store';
import {
  copilotSchema,
  eligibilitySchema,
  firstIssue,
  paymentMethodSchema,
  preferencesSchema,
  redeemSchema,
  timeQuery,
} from '../validation';

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
      paymentMethods: listPaymentMethods(db, userId).map((m) => m.kind),
      personalization: personal,
      balances: connectedBalances(db, userId),
    };
  }

  // ── Catalog and wallet ────────────────────────────────────────────────
  r.get('/catalog', (_req, res) => {
    res.json({ offers: catalog.list(), ...catalogMeta() });
  });

  r.get('/wallet', (req, res) => {
    const id = uid(req);
    const activated = (db.prepare('SELECT offer_id FROM activations WHERE user_id = ?').all(id) as { offer_id: string }[]).map((a) => a.offer_id);
    const recent = (db.prepare('SELECT offer_id FROM recently_viewed WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 6').all(id) as { offer_id: string }[]).map((a) => a.offer_id);
    res.json({
      programs: listProgramLinks(db, id),
      cashback: cashbackSummary(db, id),
      activity: listActivity(db, id),
      paymentMethods: listPaymentMethods(db, id),
      favorites: listFavorites(db, id),
      activated,
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

  // ── Favorites ─────────────────────────────────────────────────────────
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

  // ── Recommendations, eligibility, Copilot ─────────────────────────────
  r.get('/recommendations', async (req, res) => {
    const q = timeQuery.safeParse(req.query);
    const t = timeContext(q.success ? q.data.weekday : undefined, q.success ? q.data.hour : undefined);
    const prefs = getPreferences(db, uid(req));
    const result = await rec.recommend(userSummary(uid(req)), catalog.list(), t, prefs.privacy.location, 30);
    res.json({ ...result, location: prefs.privacy.location ? 'Demo location: SoHo, New York' : null });
  });

  r.post('/eligibility', async (req, res) => {
    const parsed = eligibilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    const offer = catalog.get(parsed.data.offerId);
    if (!offer) {
      res.status(404).json({ error: 'Reward not found.' });
      return;
    }
    const id = uid(req);
    const activated = Boolean(db.prepare('SELECT 1 FROM activations WHERE user_id = ? AND offer_id = ?').get(id, offer.id));
    const programRequired = offer.redemption.split?.programId ?? null;
    try {
      const out = await rec.eligibilityCheck({
        conditions: {
          channels: offer.valid.channels,
          paymentMethods: offer.valid.paymentMethods,
          minSpend: offer.minSpend,
          validFrom: offer.validFrom,
          expiresAt: offer.expiresAt,
          requiresProgram: offer.howToUse.pointsRedemption ? programRequired : null,
          activationRequired: offer.howToUse.activationRequired,
          excludedTransactions: offer.notValid.transactions,
        },
        context: {
          now: new Date().toISOString(),
          channel: parsed.data.channel,
          paymentMethod: parsed.data.paymentMethod,
          purchaseTotal: parsed.data.purchaseTotal,
          connectedPrograms: Object.keys(connectedBalances(db, id)),
          activated,
        },
      });
      res.json(out);
    } catch {
      res.json({ status: 'unknown', checks: [], summary: 'Eligibility can’t be checked right now. Review the conditions before you buy.', unavailable: true });
    }
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
        programs: PROGRAMS,
        time: timeContext(parsed.data.weekday, parsed.data.hour),
        location: { permitted: prefs.privacy.location },
      });
      res.json(out);
    } catch {
      res.status(503).json({ error: 'The Copilot service isn’t responding. Try again in a moment, or browse rewards in Explore.' });
    }
  });

  r.post('/compare-redemptions', async (req, res) => {
    try {
      res.json(await rec.compareRedemptions(req.body));
    } catch {
      res.status(503).json({ error: 'The value calculator isn’t responding. Try again in a moment.' });
    }
  });

  // ── Programs ──────────────────────────────────────────────────────────
  r.get('/programs', (req, res) => {
    res.json(listProgramLinks(db, uid(req)));
  });

  r.post('/programs/:programId/connect', (req, res) => {
    if (!programById(req.params.programId)) {
      res.status(404).json({ error: 'Program not found.' });
      return;
    }
    connectDemoProgram(db, uid(req), req.params.programId);
    res.json(listProgramLinks(db, uid(req)));
  });

  r.post('/programs/:programId/disconnect', (req, res) => {
    disconnectProgram(db, uid(req), req.params.programId);
    res.json(listProgramLinks(db, uid(req)));
  });

  // ── Payment methods ───────────────────────────────────────────────────
  r.get('/payment-methods', (req, res) => {
    res.json(listPaymentMethods(db, uid(req)));
  });

  r.post('/payment-methods', (req, res) => {
    const parsed = paymentMethodSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Perkly never accepts card numbers here. Choose a demo method to add.' });
      return;
    }
    addDemoPaymentMethod(db, uid(req), parsed.data.kind);
    res.status(201).json(listPaymentMethods(db, uid(req)));
  });

  r.post('/payment-methods/:id/preferred', (req, res) => {
    const id = uid(req);
    db.prepare('UPDATE payment_methods SET preferred = (id = ?) WHERE user_id = ?').run(req.params.id, id);
    res.json(listPaymentMethods(db, id));
  });

  r.delete('/payment-methods/:id', (req, res) => {
    const id = uid(req);
    db.prepare('DELETE FROM payment_methods WHERE id = ? AND user_id = ?').run(req.params.id, id);
    const rest = listPaymentMethods(db, id);
    if (rest.length && !rest.some((m) => m.preferred)) {
      db.prepare('UPDATE payment_methods SET preferred = 1 WHERE id = ?').run(rest[0].id);
    }
    res.json(listPaymentMethods(db, id));
  });

  // ── Activation and redemption ─────────────────────────────────────────
  r.post('/activations/:offerId', (req, res) => {
    const offer = catalog.get(req.params.offerId);
    if (!offer) {
      res.status(404).json({ error: 'Reward not found.' });
      return;
    }
    db.prepare('INSERT OR IGNORE INTO activations (user_id, offer_id, activated_at) VALUES (?, ?, ?)').run(uid(req), offer.id, nowIso());
    res.json({ activated: true, isDemo: true, message: 'Activated in demo mode. No provider was contacted.' });
  });

  r.post('/redemptions', (req, res) => {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    const out = redeem(db, catalog, uid(req), parsed.data);
    if (!out.ok) {
      res.status(out.status).json({ error: out.error, errors: out.errors });
      return;
    }
    res.status(201).json(out.record);
  });

  r.post('/redemptions/:id/recover', (req, res) => {
    const row = db.prepare('SELECT data FROM redemptions WHERE id = ? AND user_id = ?').get(req.params.id, uid(req)) as { data: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }
    res.json(recover(db, catalog, uid(req), JSON.parse(row.data) as RedemptionRecord));
  });

  r.get('/history', (req, res) => {
    res.json({ redemptions: listRedemptions(db, uid(req)), activity: listActivity(db, uid(req)) });
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
      programs: listProgramLinks(db, id).filter((p) => p.status === 'connected'),
      paymentMethods: listPaymentMethods(db, id).map(({ tokenRef: _t, ...m }) => m),
      redemptions: listRedemptions(db, id),
      activity: listActivity(db, id),
      note: 'Passwords are stored only as bcrypt hashes and are not included. Payment methods are demo references.',
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
