-- US8-US9 — Planeación del domingo, tareas e intención por materia, y la compuerta de la vista
-- de semana. Sin plpgsql, sin `AT TIME ZONE` y sin índices únicos parciales (Constitución,
-- Principio III): la regla "razón obligatoria desde la 3.ª apertura de la semana" y el conteo de
-- aperturas son aritmética en TypeScript (lib/execution/planning.ts) sobre las filas de
-- plan_views, no una restricción de base de datos. `tasks` ya existe desde la migración 008
-- (fase de US1-US3, porque `tandas.task_id` la referencia).

CREATE TABLE IF NOT EXISTS intentions (
  id TEXT PRIMARY KEY,
  program_week_id TEXT NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  strength INT NOT NULL, reason TEXT, captured_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS plan_views (
  id TEXT PRIMARY KEY,
  program_week_id TEXT NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL, surface TEXT NOT NULL,
  was_gated BOOLEAN NOT NULL DEFAULT FALSE, reason TEXT);
CREATE INDEX IF NOT EXISTS idx_plan_views_week ON plan_views(program_week_id);
