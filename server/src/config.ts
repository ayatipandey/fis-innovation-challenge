const env = process.env;

export const config = {
  port: Number(env.PORT ?? 4000),
  isProduction: env.NODE_ENV === 'production',
  databasePath: env.DATABASE_PATH ?? new URL('../data/perkly.db', import.meta.url).pathname,
  recommenderUrl: (env.RECOMMENDER_URL ?? 'http://127.0.0.1:8001').replace(/\/$/, ''),
  recommenderKey: env.RECOMMENDER_SERVICE_KEY ?? '',
  recommenderTimeoutMs: Number(env.RECOMMENDER_TIMEOUT_MS ?? 2500),
  sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 7),
  bcryptCost: Number(env.BCRYPT_COST ?? 12),
  /** Terms and privacy versions the consent dialog asks users to accept. */
  termsVersion: '2026-10-draft',
};
