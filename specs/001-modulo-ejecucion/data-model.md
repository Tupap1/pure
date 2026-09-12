# Data Model — Módulo de Ejecución

Todas las tablas del módulo son **solo-Postgres**: no pasan por Dexie ni por `/api/sync`. Las
reglas de validación viven en Zod (`lib/validations/schemas.ts`, sección "Módulo de Ejecución") y
en los servicios de `lib/execution/`. En SQL solo hay estructura compatible con pg-mem
(Constitución, Principio III).

## Convenciones

- `id TEXT PRIMARY KEY`. Los IDs son deterministas cuando la unicidad es natural
  (`${date}:${habit_id}`, `${date}:${routine_slot_id}`, `${program_week_id}:${routine_slot_id}`,
  `${program_week_id}:${subject_id}`). En el resto se usa `prefijo-${Date.now()}` (`tanda-`,
  `slot-`, `task-`, `partner-`, `view-`).
- Fechas de día como `TEXT 'YYYY-MM-DD'` en la zona `PURE_TZ`; horas como `TEXT 'HH:MM'`.
- `day_of_week` / `days_of_week`: 1 = lunes … 7 = domingo.
- Instantes (`TIMESTAMPTZ`) siempre tomados del reloj del servidor.

## Entidades y reglas de validación

| Entidad (tabla) | Reglas |
|---|---|
| Semana del programa (`program_weeks`) | `starts_on` es lunes; `week_number` ≥ 1 y único; `min_tandas_dia` 0–12; `phase` ∈ arranque/consolidacion/automatizacion. Solo se editan las semanas con `starts_on` futuro |
| Hábito (`habits`) | `id` es la clave estable (`levantada_0600`); `days_of_week` nulo (= todos) o subconjunto de 1–7; `target_days` 18–254; `retired_on` > `started_on` |
| Registro de hábito (`daily_checks`) | `status` ∈ cumplido/fallado/na; la fecha no puede ser futura y se acepta hasta las 03:00 del día siguiente; el hábito tiene que estar activo ese día; `note` ≤ 200 |
| Disparador (`routine_slots`) | `cue_text` 5–80; `action_text` 5–90; `cue_kind` ∈ hora/tras_clase/tras_habito/lugar; `anchor_time` obligatorio salvo en `tras_clase`; `tras_clase` exige `schedule_id` (el día y la periodicidad se copian del horario); `kind='habito'` exige `habit_id`; `periodicity ≠ semanal` solo con `days_of_week=[6]`. Esquema **estricto**: claves extra → `SOBRE_ESPECIFICACION` |
| Respuesta a disparador (`slot_outcomes`) | Una por disparador y día (ID determinista); `outcome` ∈ hecho/no |
| Ensayo (`plan_rehearsals`) | Uno por disparador y semana (ID determinista) |
| Tarea (`tasks`) | `title` 3–120; `estimated_tandas` 1–3 (Zod + `CHECK` como respaldo); `status` ∈ pendiente/hecha/descartada |
| Tanda (`tandas`) | `planned_minutes` 5–25 (10 por defecto); `interrupt_reason` 1–140 al interrumpir; los tiempos solo los fija el servidor; `running_lock` = 'running' ⇔ `status = 'en_curso'` |
| Destinatario (`accountability_partners`) | `consented_at` obligatorio; un solo vigente (`active_lock='active'`); `email` válido |
| Reporte (`weekly_reports`) | Uno por semana (`id = program_week_id`); `payload` inmutable tras congelar; `user_note` ≤ 400 y solo antes de `note_deadline` |
| Suscripción (`push_subscriptions`) | `id` = sha256(endpoint); `endpoint` es una URL https |
| Intención (`intentions`) | `strength` 0–10; `reason` obligatoria si `strength` < 6 |
| Apertura del plan (`plan_views`) | `surface` ∈ semana/planeacion; `reason` obligatoria desde la 3.ª apertura de la semana |

## SQL

```sql
-- 008_execution_core.sql — Fase de US1–US3 (+ tabla tasks, que usa la FK de tandas)
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

-- 009_weekly_reports.sql — US6
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

-- 010_push.sql — US7
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  user_agent TEXT, last_success_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
ALTER TABLE tandas ADD COLUMN IF NOT EXISTS end_notified_at TIMESTAMPTZ;
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS freeze_notified_at TIMESTAMPTZ;

-- 011_execution_planning.sql — US8–US9
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
```

Los siguientes archivos no se tocan: `db/schema.sql` (snapshot manual de las tablas base),
`lib/db/pg-client.ts` (el DDL de respaldo es solo para tablas base) y el esquema Dexie.

En `__tests__/helpers/test-db.ts`, `reset()` agrega las tablas nuevas **hijas primero**:
`tandas`, `slot_outcomes`, `plan_rehearsals`, `daily_checks`, `tasks`, `intentions`, `plan_views`,
`weekly_reports`, `accountability_partners`, `push_subscriptions`, `routine_slots`, `habits` y
`program_weeks`. Van antes de la lista actual.

## Transiciones de estado

```text
Tanda:    en_curso ──(tiempo cumplido o finish)──▶ completada
          en_curso ──(interrupt + razón)─────────▶ interrumpida
          (al cerrar: running_lock = NULL; sin transiciones de salida)

Reporte:  congelado ──(claim atómico)──▶ enviando ──(ok)──▶ enviado
                                         enviando ──(error, intentos < 3)──▶ congelado (reintento tras 10 min)
                                         enviando ──(error, intento 3)────▶ fallido
                                         enviando ──(>15 min sin respuesta)▶ congelado

Destinatario: vigente (active_lock='active') ──(set_partner de otro)──▶ histórico (active_lock=NULL)
```

## Valores derivados (en TypeScript, nunca almacenados en SQL)

| Valor | Regla |
|---|---|
| `local_date` | Fecha de `started_at` en `PURE_TZ` (`localParts`) |
| `locked_at` | `localDateTimeToInstant(addDays(local_date, 1), '03:00')` |
| Día cerrado | `now ≥ 03:00` del día siguiente a la fecha |
| Hábito activo | `started_on ≤ d`, `retired_on` nulo o `d < retired_on`, `days_of_week` nulo o incluye el día |
| Día cumplido | `evaluateDay`: tandas completadas ≥ `min_tandas_dia` y todo hábito activo `cumplido` o `na`. `null` fuera del programa |
| Variante de sábado | `getSabadoTypeForDate(mediodíaUTC(dateKey), ancla de la universidad)` |
| Disparador vigente | `resolveCurrentTrigger` (ver plan.md, US2) |
| Congelamiento | `localDateTimeToInstant(addDays(starts_on, 6), '19:00')` |
| Veredicto | ≥ 6/7 cumplida · ≤ 3/7 fallida · resto parcial |
| Proyección | `projectSubjectGrade` (ver plan.md, US5) |
