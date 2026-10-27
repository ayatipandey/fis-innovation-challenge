import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { loadSession, requireClientHeader } from './auth.js';
import { config } from './config.js';
import type { DB } from './db.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { publicRoutes } from './routes/public.js';

export function createApp(getDb: () => Promise<DB>, opts = { rateLimit: true, logRequests: true }) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  // Logs method, path, status and timing only. Never bodies, cookies or emails.
  if (opts.logRequests) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api')) console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }

  app.use('/api', requireClientHeader, loadSession(getDb));
  app.use('/api', publicRoutes(getDb));
  app.use('/api/auth', authRoutes(getDb, opts));
  app.use('/api/me', meRoutes(getDb, opts));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // In production outside Vercel (npm start), the API also serves the built web app.
  const dist = resolve(process.cwd(), '../web/dist');
  if (config.isProduction && !process.env.VERCEL && existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(`${dist}/index.html`));
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      res.status(400).json({ error: 'The request couldn’t be read.' });
      return;
    }
    // Expected errors (409 conflicts, 404s) carry a status and a member-facing message.
    if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Unhandled error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
  };
  app.use(onError);
  return app;
}
