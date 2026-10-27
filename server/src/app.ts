import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { loadSession, requireClientHeader } from './auth';
import { config } from './config';
import type { DB } from './db';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { publicRoutes } from './routes/public';
import type { CatalogSource } from './services/catalog';

export function createApp(db: DB, catalog: CatalogSource, opts = { rateLimit: true, logRequests: true }) {
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

  app.use('/api', requireClientHeader, loadSession(db));
  app.use('/api', publicRoutes(catalog));
  app.use('/api/auth', authRoutes(db, opts));
  app.use('/api/me', meRoutes(db, catalog, opts));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // In production the API also serves the built web app.
  const dist = fileURLToPath(new URL('../../web/dist', import.meta.url));
  if (config.isProduction && existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(`${dist}/index.html`));
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      res.status(400).json({ error: 'The request couldn’t be read.' });
      return;
    }
    console.error('Unhandled error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
  };
  app.use(onError);
  return app;
}
