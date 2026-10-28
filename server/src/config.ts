import { resolve } from 'node:path';

const env = process.env;

/** Where the Python AI service lives: explicit URL, the Vercel production URL, or local dev. */
function recommenderUrl() {
  if (env.RECOMMENDER_URL) return env.RECOMMENDER_URL.replace(/\/$/, '');
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/api/ai`;
  return 'http://127.0.0.1:8001';
}

/** Only libSQL addresses work here; a Postgres DATABASE_URL from another integration is ignored. */
function libsqlUrl(url: string | undefined) {
  return url && /^(libsql|https?|wss?|file):/.test(url) ? url : undefined;
}

export const config = {
  port: Number(env.PORT ?? 4000),
  isProduction: env.NODE_ENV === 'production' || !!env.VERCEL,
  /**
   * libSQL URL: Turso (libsql://…) when deployed, a local file in development.
   * On Vercel without Turso it falls back to /tmp, which is per-instance and
   * temporary, so data can disappear. Connect Turso for a stable demo.
   */
  databaseUrl:
    env.TURSO_DATABASE_URL ?? libsqlUrl(env.DATABASE_URL) ?? (env.VERCEL ? 'file:/tmp/perkly.db' : `file:${resolve(process.cwd(), 'data/perkly.db')}`),
  databaseToken: env.TURSO_AUTH_TOKEN ?? env.DATABASE_AUTH_TOKEN,
  recommenderUrl: recommenderUrl(),
  recommenderKey: env.RECOMMENDER_SERVICE_KEY ?? '',
  recommenderTimeoutMs: Number(env.RECOMMENDER_TIMEOUT_MS ?? 4000),
  sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 7),
  bcryptCost: Number(env.BCRYPT_COST ?? 10),
  /** How long points stay on hold while a redemption completes. */
  holdMinutes: Number(env.HOLD_MINUTES ?? 120),
  termsVersion: '2026-10-draft',
};
