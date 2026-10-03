-- Fahrtbriefing — D1-Schema (SQLite). Anwenden: wrangler d1 execute briefing --file=schema.sql [--remote]
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS secrets (
  name TEXT PRIMARY KEY,
  iv TEXT NOT NULL,
  ct TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS briefings (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  final_no INTEGER NOT NULL DEFAULT 0,
  start_ms INTEGER,
  tz TEXT,
  site TEXT,
  icao TEXT,
  elev REAL,
  reg TEXT,
  balloon TEXT,
  kind TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS briefings_start ON briefings(start_ms);
CREATE TABLE IF NOT EXISTS access_links (
  token TEXT PRIMARY KEY,
  briefing_id TEXT NOT NULL,
  person TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_opened_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS access_briefing ON access_links(briefing_id);
CREATE TABLE IF NOT EXISTS files (
  key TEXT PRIMARY KEY,
  briefing_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_ip ON login_attempts(ip, ts);
