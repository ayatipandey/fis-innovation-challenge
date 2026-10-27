import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';
import type { DB } from './db';

export const SESSION_COOKIE = 'perkly_sid';

export { EMAIL_RE, passwordProblems } from '../../shared/validation';

export const hashPassword = (password: string) => bcrypt.hash(password, config.bcryptCost);

// Compared against when the email doesn't exist, so response time doesn't reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-0', 10);

export async function verifyPassword(password: string, hash: string | undefined) {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return Boolean(hash) && ok;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function createSession(db: DB, res: Response, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionTtlDays * 86400_000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token), userId, expires.toISOString(),
  );
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    expires,
    path: '/',
  });
}

export function destroySession(db: DB, req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export interface SessionUser {
  id: string;
  email: string;
  isDemo: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function loadSession(db: DB) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      const row = db
        .prepare(
          `SELECT u.id, u.email, u.is_demo, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ?`,
        )
        .get(sha256(token)) as { id: string; email: string; is_demo: number; expires_at: string } | undefined;
      if (row && new Date(row.expires_at) > new Date()) {
        req.user = { id: row.id, email: row.email, isDemo: Boolean(row.is_demo) };
      }
    }
    next();
  };
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in to continue.' });
    return;
  }
  next();
}

/**
 * State-changing requests must carry a custom header. Browsers won't send it
 * cross-site without a CORS preflight, which this API never grants.
 */
export function requireClientHeader(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.get('x-perkly-client') !== 'web') {
    res.status(403).json({ error: 'Missing client header.' });
    return;
  }
  next();
}
