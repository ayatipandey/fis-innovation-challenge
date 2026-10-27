import { BRANDS, CATEGORIES, buildCatalog, brandById } from '../../../shared/demo-data';
import type { Offer } from '../../../shared/types';

/**
 * Partner catalog adapter. In this prototype the only source is the synthetic
 * demo catalog. A live catalog fed by partner brands would implement the same
 * interface and mark offers as verified.
 */
export interface CatalogSource {
  list(): Offer[];
  get(id: string): Offer | undefined;
}

export function demoCatalog(now = new Date()): CatalogSource {
  const offers = buildCatalog(now);
  return {
    list: () => offers,
    get: (id) => offers.find((o) => o.id === id),
  };
}

export const catalogMeta = () => ({ brands: BRANDS, categories: CATEGORIES });

/** Shape the recommender expects: the offer plus its brand name. */
export const toRewardInput = (o: Offer) => ({ ...o, brandName: brandById(o.brandId)?.name ?? o.brandId });
