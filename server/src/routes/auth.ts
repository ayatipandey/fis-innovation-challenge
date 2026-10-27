import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { EMAIL_RE, createSession, destroySession, hashPassword, passwordProblems, verifyPassword } from '../auth.js';
import { config } from '../config.js';
import type { DB } from '../db.js';
import { nowIso } from '../db.js';
import { defaultPreferences, getPreferences, savePreferences, seedDemoUser } from '../store.js';
import { firstIssue, loginSchema, registerSchema } from '../validation.js';

export function authRoutes(getDb: () => Promise<DB>, opts: { rateLimit: boolean }) {
  const r = Router();
  const limiter = opts.rateLimit
    ? rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts. Wait 15 minutes and try again.' } })
    : (_req: unknown, _res: unknown, next: () => void) => next();

  const sessionPayload = async (db: DB, userId: string, isDemo: boolean) => ({
    user: { id: userId, isDemo },
    preferences: await getPreferences(db, userId),
  });

  r.get('/session', async (req, res) => {
    if (!req.user) {
      res.json({ user: null });
      return;
    }
    res.json(await sessionPayload(await getDb(), req.user.id, req.user.isDemo));
  });

  r.post('/register', limiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    const { email, password, firstName, optional } = parsed.data;
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Enter an email address like name@example.com.', field: 'email' });
      return;
    }
    const problems = passwordProblems(password, email);
    if (problems.length) {
      res.status(400).json({ error: problems[0], field: 'password', problems });
      return;
    }
    const db = await getDb();
    if (await db.get('SELECT 1 FROM users WHERE email = ?', [email])) {
      res.status(409).json({ error: 'An account with this email already exists. Sign in instead.', field: 'email' });
      return;
    }

    const id = randomUUID();
    const hash = await hashPassword(password);
    await db.run('INSERT INTO users (id, email, password_hash, is_demo, created_at) VALUES (?, ?, ?, 0, ?)', [id, email, hash, nowIso()]);
    await db.run('INSERT INTO consents (user_id, terms_version, accepted_at, location, history, marketing) VALUES (?, ?, ?, ?, ?, ?)', [
      id, config.termsVersion, nowIso(), Number(optional.location), Number(optional.history), Number(optional.marketing),
    ]);
    const prefs = defaultPreferences({ location: optional.location, useHistory: optional.history, marketing: optional.marketing });
    prefs.displayName = firstName;
    await savePreferences(db, id, prefs);
    await createSession(db, res, id);
    res.status(201).json(await sessionPayload(db, id, false));
  });

  r.post('/login', limiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Enter your email and password.' });
      return;
    }
    const { email, password } = parsed.data;
    const db = await getDb();
    const row = await db.get<{ id: string; password_hash: string; is_demo: number }>('SELECT id, password_hash, is_demo FROM users WHERE email = ?', [email]);
    const ok = await verifyPassword(password, row?.password_hash);
    if (!row || !ok || row.is_demo) {
      res.status(401).json({ error: 'That email and password don’t match an account.' });
      return;
    }
    await createSession(db, res, row.id);
    res.json(await sessionPayload(db, row.id, false));
  });

  /** "Try the demo": a fresh, fictional account per visitor, kept apart from real users. */
  r.post('/demo', limiter, async (_req, res) => {
    const db = await getDb();
    const id = randomUUID();
    const email = `demo-${id.slice(0, 8)}@demo.perkly.invalid`;
    // Unusable random password: demo accounts can't be signed into with credentials.
    await db.run('INSERT INTO users (id, email, password_hash, is_demo, created_at) VALUES (?, ?, ?, 1, ?)', [id, email, `!demo:${randomUUID()}`, nowIso()]);
    await seedDemoUser(db, id);
    await createSession(db, res, id);
    res.status(201).json(await sessionPayload(db, id, true));
  });

  r.post('/logout', async (req, res) => {
    await destroySession(await getDb(), req, res);
    res.json({ ok: true });
  });

  return r;
}
