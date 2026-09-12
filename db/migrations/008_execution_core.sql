-- 008_execution_core.sql — Módulo de Ejecución: fase de US1–US3 (+ tabla tasks, que usa la
-- FK de tandas). Todas las tablas son solo-Postgres: no pasan por Dexie ni por /api/sync.
--
-- Compatibilidad con pg-mem (Constitución, Principio III): sin funciones/triggers plpgsql,
-- sin `AT TIME ZONE` y sin índices únicos parciales. La unicidad condicional de "como máximo
-- una tanda en curso" (FR-004) se modela con `running_lock TEXT UNIQUE`, que admite muchos
-- NULL (tandas cerradas) pero rechaza un segundo 'running', en vez de un índice único parcial
-- sobre `status` (que pg-mem aplica mal a consultas que no cubren el mismo predicado).

CREATE TABLE IF NOT EXISTS program_weeks (
  id TEXT PRIMARY KEY, week_number INT NOT NULL UNIQUE,
  starts_on TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL DEFAULT 'arranque',
  min_tandas_dia INT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, started_on TEXT NOT NULL, retired_on TEXT,
  days_of_week INT[], target_days INT NOT NULL DEFAULT 66, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS daily_checks (
  id TEXT PRIMARY KEY, date TEXT NOT NULL,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  status TEXT NOT NULL, value NUMERIC, note TEXT, logged_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_daily_checks_date ON daily_checks(date);
CREATE TABLE IF NOT EXISTS routine_slots (
  id TEXT PRIMARY KEY, days_of_week INT[] NOT NULL,
  cue_kind TEXT NOT NULL, cue_text TEXT NOT NULL, action_text TEXT NOT NULL, anchor_time TEXT,
  schedule_id TEXT REFERENCES schedules(id) ON DELETE SET NULL,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  habit_id TEXT REFERENCES habits(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'estudio', periodicity TEXT NOT NULL DEFAULT 'semanal',
  is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS slot_outcomes (
  id TEXT PRIMARY KEY, date TEXT NOT NULL,
  routine_slot_id TEXT NOT NULL REFERENCES routine_slots(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL, responded_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_slot_outcomes_date ON slot_outcomes(date);
CREATE TABLE IF NOT EXISTS plan_rehearsals (
  id TEXT PRIMARY KEY,
  program_week_id TEXT NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  routine_slot_id TEXT NOT NULL REFERENCES routine_slots(id) ON DELETE CASCADE,
  rehearsed_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  deliverable_id TEXT REFERENCES deliverables(id) ON DELETE SET NULL,
  topic_id TEXT REFERENCES syllabus_topics(id) ON DELETE SET NULL,
  estimated_tandas INT NOT NULL DEFAULT 1 CHECK (estimated_tandas BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'pendiente', scheduled_date TEXT, completed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual', created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_tasks_subject ON tasks(subject_id);
CREATE TABLE IF NOT EXISTS tandas (
  id TEXT PRIMARY KEY,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id TEXT REFERENCES syllabus_topics(id) ON DELETE SET NULL,
  deliverable_id TEXT REFERENCES deliverables(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  routine_slot_id TEXT REFERENCES routine_slots(id) ON DELETE SET NULL,
  study_block_id TEXT REFERENCES study_blocks(id) ON DELETE SET NULL,
  local_date TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL, ended_at TIMESTAMPTZ,
  planned_minutes INT NOT NULL DEFAULT 10, actual_minutes INT,
  status TEXT NOT NULL DEFAULT 'en_curso', running_lock TEXT UNIQUE,
  interrupt_reason TEXT, mode TEXT, locked_at TIMESTAMPTZ NOT NULL,
  edited_after_lock BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_tandas_local_date ON tandas(local_date);
CREATE INDEX IF NOT EXISTS idx_tandas_subject ON tandas(subject_id);
CREATE INDEX IF NOT EXISTS idx_tandas_status ON tandas(status);
