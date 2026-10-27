import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

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
  spending_data INTEGER NOT NULL,
  location INTEGER NOT NULL,
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

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, offer_id)
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  token_ref TEXT NOT NULL,
  preferred INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS program_links (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  status TEXT NOT NULL,
  balance REAL NOT NULL,
  held REAL NOT NULL DEFAULT 0,
  linked_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, program_id)
);

CREATE TABLE IF NOT EXISTS activations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, offer_id)
);

CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
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
  offer_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, offer_id)
);
`;

export type DB = DatabaseSync;

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

export const nowIso = () => new Date().toISOString();
