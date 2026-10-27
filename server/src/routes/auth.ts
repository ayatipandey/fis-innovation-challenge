import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { EMAIL_RE, createSession, destroySession, hashPassword, passwordProblems, verifyPassword } from '../auth';
import { config } from '../config';
import type { CatalogSource } from '../services/catalog';
import type { DB } from '../db';
import { nowIso } from '../db';
import { defaultPreferences, getPreferences, savePreferences, seedDemoUser } from '../store';
import { firstIssue, loginSchema, registerSchema } from '../validation';

export function authRoutes(db: DB, catalog: CatalogSource, opts: { rateLimit: boolean }) {
  const r = Router();
  const limiter = opts.rateLimit
    ? rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts. Wait 15 minutes and try again.' } })
    : (_req: unknown, _res: unknown, next: () => void) => next();

  const sessionPayload = (userId: string, email: string, isDemo: boolean) => ({
    user: { id: userId, email, isDemo },
    preferences: getPreferences(db, userId),
  });

  r.get('/session', (req, res) => {
    if (!req.user) {
      res.json({ user: null });
      return;
    }
    res.json(sessionPayload(req.user.id, req.user.email, req.user.isDemo));
  });

  r.post('/register', limiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }
    const { email, password, optional } = parsed.data;
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Enter an email address like name@example.com.', field: 'email' });
      return;
    }
    const problems = passwordProblems(password, email);
    if (problems.length) {
      res.status(400).json({ error: problems[0], field: 'password', problems });
      return;
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      res.status(409).json({ error: 'An account with this email already exists. Sign in instead.', field: 'email' });
      return;
    }

    const id = randomUUID();
    const hash = await hashPassword(password);
    db.prepare('INSERT INTO users (id, email, password_hash, is_demo, created_at) VALUES (?, ?, ?, 0, ?)').run(id, email, hash, nowIso());
    db.prepare('INSERT INTO consents (user_id, terms_version, accepted_at, spending_data, location, marketing) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, config.termsVersion, nowIso(), Number(optional.spendingData), Number(optional.location), Number(optional.marketing),
    );
    savePreferences(db, id, defaultPreferences({ personalization: true, spendingData: optional.spendingData, location: optional.location, marketing: optional.marketing }));
    createSession(db, res, id);
    res.status(201).json(sessionPayload(id, email, false));
  });

  r.post('/login', limiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Enter your email and password.' });
      return;
    }
    const { email, password } = parsed.data;
    const row = db.prepare('SELECT id, email, password_hash, is_demo FROM users WHERE email = ?').get(email) as
      | { id: string; email: string; password_hash: string; is_demo: number }
      | undefined;
    const ok = await verifyPassword(password, row?.password_hash);
    if (!row || !ok || row.is_demo) {
      res.status(401).json({ error: 'That email and password don’t match an account.' });
      return;
    }
    createSession(db, res, row.id);
    res.json(sessionPayload(row.id, row.email, false));
  });

  /** "Try the Demo": a fresh, fictional account per visitor, kept apart from real users. */
  r.post('/demo', limiter, async (_req, res) => {
    const id = randomUUID();
    const email = `demo-${id.slice(0, 8)}@demo.perkly.invalid`;
    // Unusable random password: demo accounts can't be signed into with credentials.
    db.prepare('INSERT INTO users (id, email, password_hash, is_demo, created_at) VALUES (?, ?, ?, 1, ?)').run(id, email, `!demo:${randomUUID()}`, nowIso());
    seedDemoUser(db, id, catalog.list());
    createSession(db, res, id);
    res.status(201).json(sessionPayload(id, email, true));
  });

  r.post('/logout', (req, res) => {
    destroySession(db, req, res);
    res.json({ ok: true });
  });

  return r;
}
