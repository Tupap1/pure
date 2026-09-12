-- US6 — Reporte semanal congelado por correo. Destinatario y reportes. Sin plpgsql, sin
-- `AT TIME ZONE` y sin índices únicos parciales (Constitución, Principio III): "un solo
-- destinatario vigente" se modela con `active_lock TEXT UNIQUE` (varios NULL, un solo 'active'),
-- igual que `running_lock` en tandas (migración 008).

CREATE TABLE IF NOT EXISTS accountability_partners (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL, active_lock TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS weekly_reports (
  id TEXT PRIMARY KEY,
  program_week_id TEXT NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  partner_id TEXT REFERENCES accountability_partners(id) ON DELETE SET NULL,
  payload JSONB NOT NULL, verdict TEXT NOT NULL, user_note TEXT,
  frozen_at TIMESTAMPTZ NOT NULL, note_deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'congelado', attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ, last_error TEXT, sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_weekly_reports_status ON weekly_reports(status);
