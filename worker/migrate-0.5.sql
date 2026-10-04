-- Fahrtbriefing 0.5.0 — bestehende Datenbank auf Mehrbenutzer heben.
-- Anwenden (einmalig, nach schema.sql): wrangler d1 execute briefing --remote --file=migrate-0.5.sql
ALTER TABLE briefings ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'bwicki';
ALTER TABLE briefings ADD COLUMN material_owner TEXT;
CREATE INDEX IF NOT EXISTS briefings_owner ON briefings(owner_id, start_ms);
