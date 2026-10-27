import { Router } from 'express';
import { DEMO_NOTICE, PERSONAS } from '../../../shared/demo-data';
import type { CatalogSource } from '../services/catalog';
import { catalogMeta } from '../services/catalog';
import { recommend, serviceHealth } from '../services/recommender';

/** Unauthenticated endpoints for the landing page. Synthetic data only. */
export function publicRoutes(catalog: CatalogSource) {
  const r = Router();

  r.get('/health', async (_req, res) => {
    res.json({ api: 'ok', recommender: (await serviceHealth()) ? 'ok' : 'unavailable' });
  });

  r.get('/public/catalog', (_req, res) => {
    res.json({ offers: catalog.list(), ...catalogMeta(), notice: DEMO_NOTICE });
  });

  r.post('/public/persona-recommendations', async (req, res) => {
    const persona = PERSONAS.find((p) => p.id === req.body?.personaId);
    if (!persona) {
      res.status(400).json({ error: 'Choose one of the sample shoppers.' });
      return;
    }
    // A fixed weekday morning keeps the demo repeatable. No visitor data is used.
    const now = new Date();
    const result = await recommend(
      {
        categories: persona.categories,
        favoriteBrands: persona.favoriteBrands,
        spending: persona.spending,
        brandHistory: {},
        personalization: true,
      },
      catalog.list(),
      { now: now.toISOString(), weekday: 1, hour: 8 },
      false,
      4,
    );
    res.json({ ...result, persona: persona.id, notice: 'Sample shopper with synthetic spending. Your own data is not used.' });
  });

  return r;
}
