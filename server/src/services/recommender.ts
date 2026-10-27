// Client for the Python recommendation service, with a deterministic local
// fallback so the app stays usable when the service is down.

import { brandById } from '../../../shared/demo-data';
import type { Offer, RecommendationResult, SpendingSummary } from '../../../shared/types';
import { config } from '../config';
import { toRewardInput } from './catalog';

export interface UserSummary {
  categories: string[];
  favoriteBrands: string[];
  spending: SpendingSummary | null;
  brandHistory: Record<string, number>;
  personalization: boolean;
}

export interface TimeContext {
  now: string;
  weekday: number;
  hour: number;
}

export class ServiceUnavailable extends Error {}

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.recommenderTimeoutMs);
  try {
    const res = await fetch(`${config.recommenderUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.recommenderKey ? { 'x-service-key': config.recommenderKey } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new ServiceUnavailable(`Recommender responded ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    throw err instanceof ServiceUnavailable ? err : new ServiceUnavailable(String(err));
  } finally {
    clearTimeout(timer);
  }
}

export async function recommend(
  user: UserSummary,
  offers: Offer[],
  time: TimeContext,
  locationPermitted: boolean,
  limit = 20,
): Promise<RecommendationResult> {
  try {
    return await post<RecommendationResult>('/api/recommendations', {
      user,
      rewards: offers.map(toRewardInput),
      time,
      location: { permitted: locationPermitted },
      limit,
    });
  } catch {
    return localFallback(user, offers, time, limit);
  }
}

/** Simpler, deterministic ranking used only when the service is unreachable. */
export function localFallback(user: UserSummary, offers: Offer[], time: TimeContext, limit = 20): RecommendationResult {
  const now = new Date(time.now).getTime();
  const share = user.personalization ? user.spending?.share ?? {} : {};
  const items = offers
    .filter((o) => new Date(o.expiresAt).getTime() > now && new Date(o.validFrom).getTime() <= now)
    .map((o) => {
      const reasons: string[] = [];
      let score = 0;
      const s = share[o.category] ?? 0;
      score += 40 * s;
      if (user.personalization && user.categories.includes(o.category)) score += 15;
      if (user.personalization && user.favoriteBrands.includes(o.brandId)) {
        score += 18;
        reasons.push(`${brandById(o.brandId)?.name ?? 'This brand'} is one of your favorite brands.`);
      }
      const days = (new Date(o.expiresAt).getTime() - now) / 86400_000;
      if (days <= 7) {
        score += 9;
        reasons.push('Expires within a week.');
      }
      if (o.valueEstimate.amount) score += 10 * Math.min(1, o.valueEstimate.amount / 50);
      if (!reasons.length) reasons.push('Ranked by a simpler backup method.');
      return { offerId: o.id, score: Math.round(score * 10) / 10, reasons, warnings: [] as string[], expires: o.expiresAt };
    })
    .sort((a, b) => b.score - a.score || a.expires.localeCompare(b.expires))
    .slice(0, limit)
    .map(({ expires: _e, ...r }) => r);
  return {
    items,
    engine: 'local-fallback-v1',
    generatedAt: new Date().toISOString(),
    note: 'The recommendation service is unavailable, so a simpler backup ranking is shown.',
  };
}

export const copilot = (body: unknown) => post<unknown>('/api/copilot', body);

export async function serviceHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1000);
  try {
    const res = await fetch(`${config.recommenderUrl}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
