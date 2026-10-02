-- Migración 015: Objetivos y frases (Módulo de Ejecución - Focus)
--
-- Razón: dos tablas nuevas, solo de Postgres (Módulo de Ejecución, no se sincronizan a Dexie);
-- la 015 va antes que la 016 porque `tandas.objective_id` referencia `objetivos`; las migraciones
-- no siembran datos: objetivos y frases entran solo por MCP (Principio I); `active_name_key` es
-- la unicidad condicional con columna anulable + UNIQUE (research R3).

CREATE TABLE IF NOT EXISTS objetivos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active_name_key TEXT UNIQUE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  weekly_target_minutes INT CHECK (weekly_target_minutes IS NULL OR weekly_target_minutes BETWEEN 1 AND 10080),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objetivos_subject ON objetivos(subject_id);

CREATE TABLE IF NOT EXISTS frases (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  translation TEXT,
  source TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
