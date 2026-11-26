-- ENGINORA CITY - Initial D1 Database Schema (MVP)
-- Safe to re-run: uses IF NOT EXISTS and never drops or overwrites existing records.

CREATE TABLE IF NOT EXISTS platform_config (
  id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  account_id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_verified_at INTEGER,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  commander_name TEXT NOT NULL,
  selected_server_id TEXT NOT NULL,
  registration_status TEXT NOT NULL DEFAULT 'unregistered',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_states (
  account_id TEXT PRIMARY KEY REFERENCES players(account_id) ON DELETE CASCADE,
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 3,
  revision INTEGER NOT NULL DEFAULT 1,
  last_tick_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('player', 'admin')),
  account_id TEXT REFERENCES players(account_id) ON DELETE CASCADE,
  admin_role TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS email_codes (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES players(account_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_codes(email, purpose, used_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_email_codes_account ON email_codes(account_id, purpose, created_at);
