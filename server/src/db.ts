import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createClient, type Client, type InArgs, type Transaction } from '@libsql/client';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consents (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  location INTEGER NOT NULL,
  history INTEGER NOT NULL,
  marketing INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS links (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  balance REAL NOT NULL,
  shares TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, program_id)
);
CREATE TABLE IF NOT EXISTS expiries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  points REAL NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS purchases (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (user_id, program_id, id)
);
CREATE TABLE IF NOT EXISTS holds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  points REAL NOT NULL,
  channel TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE (user_id, idem_key)
);
CREATE INDEX IF NOT EXISTS holds_active ON holds (user_id, program_id, status);
CREATE TABLE IF NOT EXISTS moments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session TEXT NOT NULL,
  sent INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ratings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  good INTEGER NOT NULL DEFAULT 0,
  fine INTEGER NOT NULL DEFAULT 0,
  bad INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, key)
);
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  amount TEXT NOT NULL,
  date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recently_viewed (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, option_id)
);
`;

export type Row = Record<string, unknown>;
export type Exec = Client | Transaction;

export interface DB {
  client: Client;
  all<T = Row>(sql: string, args?: InArgs, tx?: Exec): Promise<T[]>;
  get<T = Row>(sql: string, args?: InArgs, tx?: Exec): Promise<T | undefined>;
  run(sql: string, args?: InArgs, tx?: Exec): Promise<number>;
  /** Runs fn inside a write transaction; commits on success, rolls back on error. */
  write<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
}

let ready: Promise<DB> | null = null;

export function openDb(url: string, authToken?: string): Promise<DB> {
  if (url.startsWith('file:') && !url.includes(':memory:')) mkdirSync(dirname(url.slice(5)), { recursive: true });
  const client = createClient({ url, authToken });
  const db: DB = {
    client,
    async all(sql, args = [], tx) {
      const r = await (tx ?? client).execute({ sql, args });
      return r.rows as unknown as never[];
    },
    async get(sql, args = [], tx) {
      const r = await (tx ?? client).execute({ sql, args });
      return r.rows[0] as never;
    },
    async run(sql, args = [], tx) {
      const r = await (tx ?? client).execute({ sql, args });
      return r.rowsAffected;
    },
    async write(fn) {
      const tx = await client.transaction('write');
      try {
        const out = await fn(tx);
        await tx.commit();
        return out;
      } catch (err) {
        await tx.rollback().catch(() => undefined);
        throw err;
      } finally {
        tx.close();
      }
    },
  };
  return client
    .executeMultiple(`PRAGMA foreign_keys = ON;${url.startsWith('file:') ? 'PRAGMA journal_mode = WAL;' : ''}${SCHEMA}`)
    .then(() => db);
}

/** One shared connection per process (and per warm serverless instance). */
export function sharedDb(url: string, authToken?: string) {
  ready ??= openDb(url, authToken);
  return ready;
}

export const nowIso = () => new Date().toISOString();
