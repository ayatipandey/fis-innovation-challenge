import { Router } from 'express';
import report from '../../../services/recommender/app/model/report.json' with { type: 'json' };
import { DEMO_NOTICE, MERCHANTS, OPTIONS, PROGRAMS } from '../../../shared/demo-data.js';
import type { DB } from '../db.js';
import { serviceHealth } from '../services/recommender.js';

/** Unauthenticated endpoints. Synthetic data only. */
export function publicRoutes(getDb: () => Promise<DB>) {
  const r = Router();

  r.get('/health', async (_req, res) => {
    res.json({ api: 'ok', ai: (await serviceHealth()) ? 'ok' : 'unavailable' });
  });

  r.get('/catalog', (_req, res) => {
    res.json({ programs: PROGRAMS, merchants: MERCHANTS, options: OPTIONS, notice: DEMO_NOTICE });
  });

  /**
   * Partner insights: the model's offline results on synthetic data, plus
   * aggregate counts from this demo deployment. No per-member data.
   */
  r.get('/insights', async (_req, res) => {
    const db = await getDb();
    const n = async (sql: string) => Number((await db.get<{ n: number }>(sql))?.n ?? 0);
    const ratings = await db.get<{ good: number; fine: number; bad: number }>('SELECT SUM(good) AS good, SUM(fine) AS fine, SUM(bad) AS bad FROM ratings');
    res.json({
      model: report,
      live: {
        members: await n('SELECT COUNT(*) AS n FROM users'),
        linkedPrograms: await n('SELECT COUNT(*) AS n FROM links'),
        momentsEvaluated: await n('SELECT COUNT(*) AS n FROM moments'),
        momentsSent: await n('SELECT COUNT(*) AS n FROM moments WHERE sent = 1'),
        redemptions: await n("SELECT COUNT(*) AS n FROM holds WHERE status = 'confirmed'"),
        holdsExpired: await n("SELECT COUNT(*) AS n FROM holds WHERE status = 'expired'"),
        ratings: { good: Number(ratings?.good ?? 0), fine: Number(ratings?.fine ?? 0), bad: Number(ratings?.bad ?? 0) },
      },
      notice: 'Model results are from invented training data. Live counts are from demo accounts on this deployment.',
    });
  });

  return r;
}
