import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { PROGRAMS, programById } from '../../../shared/demo-data.js';
import type { CategoryId, Moment, Preferences, Rating } from '../../../shared/types.js';
import { destroySession, requireUser } from '../auth.js';
import type { DB } from '../db.js';
import * as ai from '../services/recommender.js';
import * as store from '../store.js';
import { contextSchema, firstIssue, holdSchema, linkSchema, pilotSchema, preferencesSchema, programIds, rateSchema } from '../validation.js';

const NOUN: Partial<Record<CategoryId, string>> = {
  coffee: 'coffee',
  food: 'dining',
  groceries: 'grocery',
  books: 'book',
  entertainment: 'movie',
  shopping: 'shopping',
  transport: 'travel',
  wellness: 'wellness',
};

/** What a rating changes, said back to the member. */
export function ratingEffect(rating: Rating, key: string | null) {
  const [cat, bucket] = (key ?? ':').split(':');
  const noun = NOUN[cat as CategoryId] ?? 'these';
  const when = bucket ? ` in the ${bucket}` : '';
  if (rating === 'bad') return `Got it, fewer ${noun} reminders${when}.`;
  if (rating === 'good') return `Got it, Perkly will keep sending ${noun} reminders like this${when}.`;
  return `Noted. Your ${noun} reminders${when} stay as they are.`;
}

type Ctx = ReturnType<typeof contextSchema.parse>;

/** Time comes from the member's device (local time); server clock otherwise. */
function momentContext(c: Partial<Ctx> | undefined, prefs: Preferences): ai.MomentContext {
  const now = new Date();
  const located = prefs.privacy.location && c?.lat != null && c?.lng != null;
  return {
    now: now.toISOString(),
    hour: c?.hour ?? now.getHours(),
    minute: c?.minute ?? now.getMinutes(),
    weekday: c?.weekday ?? (now.getDay() + 6) % 7,
    lat: located ? c!.lat! : null,
    lng: located ? c!.lng! : null,
    source: c?.source ?? 'simulated',
  };
}

export function meRoutes(getDb: () => Promise<DB>, opts: { rateLimit: boolean }) {
  const r = Router();
  r.use(requireUser);
  const uid = (req: Request) => req.user!.id;
  const limiter = (limit: number) =>
    opts.rateLimit
      ? rateLimit({ windowMs: 60_000, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'That’s a lot of requests. Wait a minute and try again.' } })
      : (_q: unknown, _s: unknown, next: () => void) => next();

  async function engineInputs(db: DB, userId: string, prefs: Preferences, session: string) {
    const [links, habits, ratings, sentToday] = await Promise.all([
      store.listLinks(db, userId),
      store.habitsFor(db, userId, prefs),
      store.getRatings(db, userId),
      store.sentInSession(db, userId, session),
    ]);
    let candidates = ai.buildCandidates(links);
    if (!prefs.notifications.expirationReminders) candidates = candidates.map((c) => ({ ...c, expiringPoints: 0, daysToExpiry: null }));
    const enginePrefs: ai.EnginePrefs = {
      quietHours: prefs.notifications.quietHours,
      dailyLimit: prefs.notifications.dailyLimit,
      sentToday,
      locationAllowed: prefs.privacy.location && prefs.notifications.locationAlerts,
      personalization: prefs.privacy.personalization,
    };
    return { links, habits, ratings: prefs.privacy.personalization ? ratings : {}, candidates, enginePrefs };
  }

  // ── Overview ──────────────────────────────────────────────────────────
  r.get('/summary', async (req, res) => {
    const db = await getDb();
    const prefs = await store.getPreferences(db, uid(req));
    const { programs, habits } = await store.plansFor(db, uid(req), prefs);
    const holds = (await store.listHolds(db, uid(req))).filter((h) => h.status === 'held');
    const soon = Date.now() + 30 * 86400_000;
    const atRisk = programs.flatMap(({ link, program }) =>
      link.expiries.filter((e) => new Date(e.expiresAt).getTime() <= soon).map((e) => ({ programId: program.id, points: e.points, expiresAt: e.expiresAt })),
    );
    res.json({
      programs,
      habits,
      holds,
      atRisk,
      totals: {
        bestValue: Math.round(programs.reduce((n, p) => n + (p.plans[0]?.totalValue ?? 0), 0) * 100) / 100,
        valueAtRisk: Math.round(programs.reduce((n, p) => n + (p.plans[0]?.valueAtRisk ?? 0), 0) * 100) / 100,
      },
      activity: await store.listActivity(db, uid(req)),
    });
  });

  // ── Programs (read-only links) ────────────────────────────────────────
  r.get('/programs', async (req, res) => {
    const links = await store.listLinks(await getDb(), uid(req));
    res.json({ programs: PROGRAMS.map((p) => ({ program: p, link: links.find((l) => l.programId === p.id) ?? null })) });
  });

  r.post('/programs/:id/link', async (req, res) => {
    const id = String(req.params.id);
    if (!programIds.has(id)) {
      res.status(404).json({ error: 'Program not found.' });
      return;
    }
    const parsed = linkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    const db = await getDb();
    // The synthetic history is seeded per member, so linking again gives the same data.
    await store.linkProgram(db, uid(req), id, { history: parsed.data.shareHistory, visits: parsed.data.shareVisits }, uid(req));
    res.status(201).json({ link: (await store.listLinks(db, uid(req))).find((l) => l.programId === id) });
  });

  r.delete('/programs/:id', async (req, res) => {
    await store.unlinkProgram(await getDb(), uid(req), String(req.params.id));
    res.json({ ok: true });
  });

  r.get('/purchases', async (req, res) => {
    res.json({ purchases: await store.listPurchases(await getDb(), uid(req)), notice: 'Synthetic purchase history shared by sample programs.' });
  });

  // ── Plans (Explore) ───────────────────────────────────────────────────
  r.get('/plans', async (req, res) => {
    const db = await getDb();
    const prefs = await store.getPreferences(db, uid(req));
    res.json(await store.plansFor(db, uid(req), prefs));
  });

  // ── Holds ─────────────────────────────────────────────────────────────
  r.get('/holds', async (req, res) => {
    res.json({ holds: await store.listHolds(await getDb(), uid(req)) });
  });

  r.post('/holds', limiter(30), async (req, res) => {
    const parsed = holdSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    const { optionId, channel, idempotencyKey } = parsed.data;
    const hold = await store.createHold(await getDb(), uid(req), optionId, channel, idempotencyKey);
    res.status(201).json({ hold });
  });

  /** In the demo the member taps "the cashier scanned it" / completes the mock checkout. */
  r.post('/holds/:id/confirm', async (req, res) => {
    res.json({ hold: await store.confirmHold(await getDb(), uid(req), String(req.params.id)) });
  });

  r.post('/holds/:id/release', async (req, res) => {
    res.json({ hold: await store.releaseHold(await getDb(), uid(req), String(req.params.id)) });
  });

  // ── Moments ───────────────────────────────────────────────────────────
  r.post('/moments/evaluate', limiter(60), async (req, res) => {
    const parsed = contextSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    const db = await getDb();
    const prefs = await store.getPreferences(db, uid(req));
    const context = momentContext(parsed.data, prefs);
    const inputs = await engineInputs(db, uid(req), prefs, parsed.data.session);
    // Don't repeat a reward already sent in this session.
    const sentBefore = await store.sentOptionsInSession(db, uid(req), parsed.data.session);
    const fresh = inputs.candidates.filter((c) => !sentBefore.has(c.optionId));
    const result = await ai.evaluateMoment({ context, prefs: inputs.enginePrefs, habits: inputs.habits, ratings: inputs.ratings, candidates: fresh });
    const d = result.decision;
    let moment: Moment | null = null;
    if (d.optionId) {
      moment = {
        id: randomUUID(),
        optionId: d.optionId,
        merchantId: d.merchantId,
        sent: d.sent,
        title: d.title,
        body: d.body,
        reasons: d.reasons,
        suppressedBecause: d.suppressedBecause,
        uplift: d.uplift,
        pIfNotified: d.pIfNotified,
        pIfNot: d.pIfNot,
        distanceM: d.distanceM,
        at: context.now,
        context: context.source,
        ratingKey: d.category ? `${d.category}:${d.bucket}` : null,
        rating: null,
        ratingMessage: null,
        isDemo: true,
      };
      await store.saveMoment(db, uid(req), parsed.data.session, moment);
    }
    res.json({
      moment,
      decision: d,
      considered: result.considered,
      model: result.model,
      threshold: result.threshold,
      fallback: Boolean(result.fallback),
      context: { hour: context.hour, minute: context.minute, located: context.lat != null },
    });
  });

  r.get('/moments', async (req, res) => {
    res.json({ moments: await store.listMoments(await getDb(), uid(req)) });
  });

  r.post('/moments/:id/rate', async (req, res) => {
    const parsed = rateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Choose Good, Fine or Bad.' });
      return;
    }
    const db = await getDb();
    const existing = (await store.listMoments(db, uid(req), 200)).find((m) => m.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    const message = ratingEffect(parsed.data.rating, existing.ratingKey);
    const moment = await store.rateMoment(db, uid(req), existing.id, parsed.data.rating, existing.ratingKey ?? 'general:any', message);
    res.json({ moment, message });
  });

  r.delete('/ratings', async (req, res) => {
    await store.resetRatings(await getDb(), uid(req));
    res.json({ ok: true });
  });

  // ── Perkly's Pilot ────────────────────────────────────────────────────
  r.post('/pilot', limiter(20), async (req, res) => {
    const parsed = pilotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    const db = await getDb();
    const prefs = await store.getPreferences(db, uid(req));
    const context = momentContext(parsed.data.context, prefs);
    const inputs = await engineInputs(db, uid(req), prefs, parsed.data.context?.session ?? 'pilot');
    const { programs } = await store.plansFor(db, uid(req), prefs);
    const reply = await ai.askPilot({
      message: parsed.data.message,
      context,
      prefs: inputs.enginePrefs,
      habits: inputs.habits,
      ratings: inputs.ratings,
      candidates: inputs.candidates,
      programs: ai.planPayload(programs),
    });
    res.json(reply);
  });

  // ── Preferences, data rights ──────────────────────────────────────────
  r.get('/preferences', async (req, res) => {
    res.json(await store.getPreferences(await getDb(), uid(req)));
  });

  r.put('/preferences', async (req, res) => {
    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    const db = await getDb();
    await store.savePreferences(db, uid(req), parsed.data as Preferences);
    res.json(await store.getPreferences(db, uid(req)));
  });

  r.get('/activity', async (req, res) => {
    res.json({ activity: await store.listActivity(await getDb(), uid(req)) });
  });

  r.get('/export', async (req, res) => {
    const db = await getDb();
    const id = uid(req);
    const [preferences, links, purchases, holds, moments, ratings, activity] = await Promise.all([
      store.getPreferences(db, id),
      store.listLinks(db, id),
      store.listPurchases(db, id),
      store.listHolds(db, id),
      store.listMoments(db, id, 500),
      store.getRatings(db, id),
      store.listActivity(db, id),
    ]);
    res.setHeader('content-disposition', 'attachment; filename="perkly-data.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      account: { isDemo: req.user!.isDemo },
      preferences,
      linkedPrograms: links.map((l) => ({ ...l, program: programById(l.programId)?.name })),
      purchases,
      holds,
      notifications: moments,
      ratings,
      activity,
    });
  });

  r.delete('/account', async (req, res) => {
    const db = await getDb();
    const id = uid(req);
    await destroySession(db, req, res);
    await store.deleteUser(db, id);
    res.json({ ok: true });
  });

  return r;
}
