// Repositorio Postgres del Módulo de Ejecución. Todas las tablas de este archivo son
// solo-Postgres (no pasan por Dexie ni por /api/sync): los handlers de lib/execution/* son su
// única vía de lectura/escritura, igual que el resto de entidades de lib/db/repository-pg.ts.
//
// Mismo patrón que lib/db/repository-pg.ts: INSERT ... ON CONFLICT (id) DO UPDATE para el
// upsert, fetch por id o colección completa, delete por id. La generación de `id` por defecto
// (`prefijo-${Date.now()}`) es un respaldo: los servicios de lib/execution/* casi siempre
// calculan un id determinista ellos mismos (p.ej. `${date}:${habit_id}`) antes de llamar aquí.

import { PoolClient } from 'pg';
import { pgPool } from './pg-client';

/** BEGIN/COMMIT con ROLLBACK automático si `fn` lanza. Para escrituras que deben ser atómicas,
 * como crear las 10 semanas del programa en un solo `init`. */
export async function withExecutionTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// --- program_weeks ---

export interface ProgramWeekRecord {
  id: string;
  week_number: number;
  starts_on: string;
  phase: string;
  min_tandas_dia: number;
  created_at?: string;
}

export async function fetchProgramWeeksFromDb(id?: string): Promise<ProgramWeekRecord | ProgramWeekRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM program_weeks WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM program_weeks ORDER BY week_number ASC');
  return res.rows;
}

export async function saveProgramWeekToDb(week: Partial<ProgramWeekRecord>, client?: PoolClient): Promise<ProgramWeekRecord> {
  const runner = client ?? pgPool;
  const record: ProgramWeekRecord = {
    id: week.id || `pw-${Date.now()}`,
    week_number: week.week_number!,
    starts_on: week.starts_on!,
    phase: week.phase || 'arranque',
    min_tandas_dia: week.min_tandas_dia ?? 1,
  };
  const res = await runner.query(
    `INSERT INTO program_weeks (id, week_number, starts_on, phase, min_tandas_dia)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       week_number = EXCLUDED.week_number,
       starts_on = EXCLUDED.starts_on,
       phase = EXCLUDED.phase,
       min_tandas_dia = EXCLUDED.min_tandas_dia
     RETURNING *`,
    [record.id, record.week_number, record.starts_on, record.phase, record.min_tandas_dia]
  );
  return res.rows[0];
}

export async function deleteProgramWeekFromDb(id: string): Promise<void> {
  await pgPool.query('DELETE FROM program_weeks WHERE id = $1', [id]);
}

// --- habits ---

export interface HabitRecord {
  id: string;
  label: string;
  started_on: string;
  retired_on?: string | null;
  days_of_week?: number[] | null;
  target_days: number;
  created_at?: string;
}

export async function fetchHabitsFromDb(id?: string): Promise<HabitRecord | HabitRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM habits WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM habits ORDER BY started_on ASC');
  return res.rows;
}

export async function saveHabitToDb(habit: Partial<HabitRecord>): Promise<HabitRecord> {
  const record: HabitRecord = {
    id: habit.id || `habit-${Date.now()}`,
    label: habit.label!,
    started_on: habit.started_on!,
    retired_on: habit.retired_on ?? null,
    days_of_week: habit.days_of_week ?? null,
    target_days: habit.target_days ?? 66,
  };
  const res = await pgPool.query(
    `INSERT INTO habits (id, label, started_on, retired_on, days_of_week, target_days)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       label = EXCLUDED.label,
       started_on = EXCLUDED.started_on,
       retired_on = EXCLUDED.retired_on,
       days_of_week = EXCLUDED.days_of_week,
       target_days = EXCLUDED.target_days
     RETURNING *`,
    [record.id, record.label, record.started_on, record.retired_on, record.days_of_week, record.target_days]
  );
  return res.rows[0];
}

export async function deleteHabitFromDb(id: string): Promise<void> {
  await pgPool.query('DELETE FROM habits WHERE id = $1', [id]);
}

// --- daily_checks ---

export interface DailyCheckRecord {
  id: string;
  date: string;
  habit_id: string;
  status: string;
  value?: number | null;
  note?: string | null;
  logged_at?: string;
}

export async function fetchDailyChecksFromDb(id?: string): Promise<DailyCheckRecord | DailyCheckRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM daily_checks WHERE id = $1', [id]);
    if (!res.rows[0]) return null;
    return { ...res.rows[0], value: res.rows[0].value === null ? null : Number(res.rows[0].value) };
  }
  const res = await pgPool.query('SELECT * FROM daily_checks ORDER BY date ASC');
  return res.rows.map((r) => ({ ...r, value: r.value === null ? null : Number(r.value) }));
}

export async function saveDailyCheckToDb(check: Partial<DailyCheckRecord>): Promise<DailyCheckRecord> {
  const record: DailyCheckRecord = {
    id: check.id || `check-${Date.now()}`,
    date: check.date!,
    habit_id: check.habit_id!,
    status: check.status!,
    value: check.value ?? null,
    note: check.note ?? null,
  };
  const res = await pgPool.query(
    `INSERT INTO daily_checks (id, date, habit_id, status, value, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       value = EXCLUDED.value,
       note = EXCLUDED.note
     RETURNING *`,
    [record.id, record.date, record.habit_id, record.status, record.value, record.note]
  );
  return { ...res.rows[0], value: res.rows[0].value === null ? null : Number(res.rows[0].value) };
}

export async function deleteDailyCheckFromDb(id: string): Promise<void> {
  await pgPool.query('DELETE FROM daily_checks WHERE id = $1', [id]);
}

// --- routine_slots ---

export interface RoutineSlotRecord {
  id: string;
  days_of_week: number[];
  cue_kind: string;
  cue_text: string;
  action_text: string;
  anchor_time?: string | null;
  schedule_id?: string | null;
  subject_id?: string | null;
  habit_id?: string | null;
  kind: string;
  periodicity: string;
  is_active: boolean;
  created_at?: string;
}

export async function fetchRoutineSlotsFromDb(id?: string): Promise<RoutineSlotRecord | RoutineSlotRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM routine_slots WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM routine_slots ORDER BY created_at ASC');
  return res.rows;
}

export async function saveRoutineSlotToDb(slot: Partial<RoutineSlotRecord>): Promise<RoutineSlotRecord> {
  const record: RoutineSlotRecord = {
    id: slot.id || `slot-${Date.now()}`,
    days_of_week: slot.days_of_week!,
    cue_kind: slot.cue_kind!,
    cue_text: slot.cue_text!,
    action_text: slot.action_text!,
    anchor_time: slot.anchor_time ?? null,
    schedule_id: slot.schedule_id ?? null,
    subject_id: slot.subject_id ?? null,
    habit_id: slot.habit_id ?? null,
    kind: slot.kind || 'estudio',
    periodicity: slot.periodicity || 'semanal',
    is_active: slot.is_active ?? true,
  };
  const res = await pgPool.query(
    `INSERT INTO routine_slots
       (id, days_of_week, cue_kind, cue_text, action_text, anchor_time, schedule_id, subject_id, habit_id, kind, periodicity, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       days_of_week = EXCLUDED.days_of_week,
       cue_kind = EXCLUDED.cue_kind,
       cue_text = EXCLUDED.cue_text,
       action_text = EXCLUDED.action_text,
       anchor_time = EXCLUDED.anchor_time,
       schedule_id = EXCLUDED.schedule_id,
       subject_id = EXCLUDED.subject_id,
       habit_id = EXCLUDED.habit_id,
       kind = EXCLUDED.kind,
       periodicity = EXCLUDED.periodicity,
       is_active = EXCLUDED.is_active
     RETURNING *`,
    [
      record.id,
      record.days_of_week,
      record.cue_kind,
      record.cue_text,
      record.action_text,
      record.anchor_time,
      record.schedule_id,
      record.subject_id,
      record.habit_id,
      record.kind,
      record.periodicity,
      record.is_active,
    ]
  );
  return res.rows[0];
}

export async function deleteRoutineSlotFromDb(id: string): Promise<void> {
  await pgPool.query('DELETE FROM routine_slots WHERE id = $1', [id]);
}

// --- slot_outcomes ---

export interface SlotOutcomeRecord {
  id: string;
  date: string;
  routine_slot_id: string;
  outcome: string;
  responded_at?: string;
}

export async function fetchSlotOutcomesFromDb(id?: string): Promise<SlotOutcomeRecord | SlotOutcomeRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM slot_outcomes WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM slot_outcomes ORDER BY date ASC');
  return res.rows;
}

export async function saveSlotOutcomeToDb(outcome: Partial<SlotOutcomeRecord>): Promise<SlotOutcomeRecord> {
  const record: SlotOutcomeRecord = {
    id: outcome.id || `outcome-${Date.now()}`,
    date: outcome.date!,
    routine_slot_id: outcome.routine_slot_id!,
    outcome: outcome.outcome!,
  };
  const res = await pgPool.query(
    `INSERT INTO slot_outcomes (id, date, routine_slot_id, outcome)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET outcome = EXCLUDED.outcome
     RETURNING *`,
    [record.id, record.date, record.routine_slot_id, record.outcome]
  );
  return res.rows[0];
}

export async function deleteSlotOutcomeFromDb(id: string): Promise<void> {
  await pgPool.query('DELETE FROM slot_outcomes WHERE id = $1', [id]);
}

// --- plan_rehearsals ---

export interface PlanRehearsalRecord {
  id: string;
  program_week_id: string;
  routine_slot_id: string;
  rehearsed_at?: string;
}

export async function fetchPlanRehearsalsFromDb(id?: string): Promise<PlanRehearsalRecord | PlanRehearsalRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM plan_rehearsals WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM plan_rehearsals ORDER BY rehearsed_at ASC');
  return res.rows;
}

export async function savePlanRehearsalToDb(rehearsal: Partial<PlanRehearsalRecord>): Promise<PlanRehearsalRecord> {
  const record: PlanRehearsalRecord = {
    id: rehearsal.id || `rehearsal-${Date.now()}`,
    program_week_id: rehearsal.program_week_id!,
    routine_slot_id: rehearsal.routine_slot_id!,
  };
  const res = await pgPool.query(
    `INSERT INTO plan_rehearsals (id, program_week_id, routine_slot_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET program_week_id = EXCLUDED.program_week_id, routine_slot_id = EXCLUDED.routine_slot_id
     RETURNING *`,
    [record.id, record.program_week_id, record.routine_slot_id]
  );
  return res.rows[0];
}

export async function deletePlanRehearsalFromDb(id: string): Promise<void> {
  await pgPool.query('DELETE FROM plan_rehearsals WHERE id = $1', [id]);
}

// --- tasks ---

export interface ExecutionTaskRecord {
  id: string;
  title: string;
  subject_id: string;
  deliverable_id?: string | null;
  topic_id?: string | null;
  estimated_tandas: number;
  status: string;
  scheduled_date?: string | null;
  completed_at?: string | null;
  source: string;
  created_at?: string;
}

export async function fetchExecutionTasksFromDb(id?: string): Promise<ExecutionTaskRecord | ExecutionTaskRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM tasks ORDER BY created_at ASC');
  return res.rows;
}

export async function saveExecutionTaskToDb(task: Partial<ExecutionTaskRecord>): Promise<ExecutionTaskRecord> {
  const record: ExecutionTaskRecord = {
    id: task.id || `task-${Date.now()}`,
    title: task.title!,
    subject_id: task.subject_id!,
    deliverable_id: task.deliverable_id ?? null,
    topic_id: task.topic_id ?? null,
    estimated_tandas: task.estimated_tandas ?? 1,
    status: task.status || 'pendiente',
    scheduled_date: task.scheduled_date ?? null,
    completed_at: task.completed_at ?? null,
    source: task.source || 'manual',
  };
  const res = await pgPool.query(
    `INSERT INTO tasks (id, title, subject_id, deliverable_id, topic_id, estimated_tandas, status, scheduled_date, completed_at, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       subject_id = EXCLUDED.subject_id,
       deliverable_id = EXCLUDED.deliverable_id,
       topic_id = EXCLUDED.topic_id,
       estimated_tandas = EXCLUDED.estimated_tandas,
       status = EXCLUDED.status,
       scheduled_date = EXCLUDED.scheduled_date,
       completed_at = EXCLUDED.completed_at,
       source = EXCLUDED.source
     RETURNING *`,
    [
      record.id,
      record.title,
      record.subject_id,
      record.deliverable_id,
      record.topic_id,
      record.estimated_tandas,
      record.status,
      record.scheduled_date,
      record.completed_at,
      record.source,
    ]
  );
  return res.rows[0];
}

export async function deleteExecutionTaskFromDb(id: string): Promise<void> {
  await pgPool.query('DELETE FROM tasks WHERE id = $1', [id]);
}

// --- tandas ---

export interface TandaRecord {
  id: string;
  subject_id?: string | null;
  topic_id?: string | null;
  deliverable_id?: string | null;
  task_id?: string | null;
  routine_slot_id?: string | null;
  study_block_id?: string | null;
  local_date: string;
  started_at: string;
  ended_at?: string | null;
  planned_minutes: number;
  actual_minutes?: number | null;
  status: string;
  running_lock?: string | null;
  interrupt_reason?: string | null;
  mode?: string | null;
  locked_at: string;
  edited_after_lock: boolean;
  end_notified_at?: string | null;
  created_at?: string;
}

export async function fetchTandasFromDb(id?: string): Promise<TandaRecord | TandaRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM tandas WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM tandas ORDER BY started_at ASC');
  return res.rows;
}

export async function saveTandaToDb(tanda: Partial<TandaRecord>): Promise<TandaRecord> {
  const record: TandaRecord = {
    id: tanda.id || `tanda-${Date.now()}`,
    subject_id: tanda.subject_id ?? null,
    topic_id: tanda.topic_id ?? null,
    deliverable_id: tanda.deliverable_id ?? null,
    task_id: tanda.task_id ?? null,
    routine_slot_id: tanda.routine_slot_id ?? null,
    study_block_id: tanda.study_block_id ?? null,
    local_date: tanda.local_date!,
    started_at: tanda.started_at!,
    ended_at: tanda.ended_at ?? null,
    planned_minutes: tanda.planned_minutes ?? 10,
    actual_minutes: tanda.actual_minutes ?? null,
    status: tanda.status || 'en_curso',
    running_lock: tanda.running_lock ?? null,
    interrupt_reason: tanda.interrupt_reason ?? null,
    mode: tanda.mode ?? null,
    locked_at: tanda.locked_at!,
    edited_after_lock: tanda.edited_after_lock ?? false,
  };
  const res = await pgPool.query(
    `INSERT INTO tandas
       (id, subject_id, topic_id, deliverable_id, task_id, routine_slot_id, study_block_id,
        local_date, started_at, ended_at, planned_minutes, actual_minutes, status, running_lock,
        interrupt_reason, mode, locked_at, edited_after_lock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO UPDATE SET
       subject_id = EXCLUDED.subject_id,
       topic_id = EXCLUDED.topic_id,
       deliverable_id = EXCLUDED.deliverable_id,
       task_id = EXCLUDED.task_id,
       routine_slot_id = EXCLUDED.routine_slot_id,
       study_block_id = EXCLUDED.study_block_id,
       ended_at = EXCLUDED.ended_at,
       actual_minutes = EXCLUDED.actual_minutes,
       status = EXCLUDED.status,
       running_lock = EXCLUDED.running_lock,
       interrupt_reason = EXCLUDED.interrupt_reason,
       mode = EXCLUDED.mode,
       edited_after_lock = EXCLUDED.edited_after_lock
     RETURNING *`,
    [
      record.id,
      record.subject_id,
      record.topic_id,
      record.deliverable_id,
      record.task_id,
      record.routine_slot_id,
      record.study_block_id,
      record.local_date,
      record.started_at,
      record.ended_at,
      record.planned_minutes,
      record.actual_minutes,
      record.status,
      record.running_lock,
      record.interrupt_reason,
      record.mode,
      record.locked_at,
      record.edited_after_lock,
    ]
  );
  return res.rows[0];
}

export async function deleteTandaFromDb(id: string): Promise<void> {
  await pgPool.query('DELETE FROM tandas WHERE id = $1', [id]);
}

/** US7: marca el aviso "Terminó la tanda" como ya enviado, para que un tick repetido no lo
 * reenvíe. Función dedicada (en vez de pasar por saveTandaToDb) porque es la única escritura que
 * necesita esta columna, igual que markWeeklyReportSentInDb hace con weekly_reports más abajo. */
export async function markTandaEndNotifiedInDb(id: string, now: Date): Promise<TandaRecord | null> {
  const res = await pgPool.query(`UPDATE tandas SET end_notified_at = $2 WHERE id = $1 RETURNING *`, [
    id,
    now.toISOString(),
  ]);
  return res.rows[0] || null;
}

// --- accountability_partners (US6) ---

export interface AccountabilityPartnerRecord {
  id: string;
  name: string;
  email: string;
  consented_at: string;
  active_lock: string | null;
  created_at?: string;
}

export async function fetchAccountabilityPartnersFromDb(
  id?: string
): Promise<AccountabilityPartnerRecord | AccountabilityPartnerRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM accountability_partners WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM accountability_partners ORDER BY created_at ASC');
  return res.rows;
}

export async function fetchActivePartnerFromDb(): Promise<AccountabilityPartnerRecord | null> {
  const res = await pgPool.query(`SELECT * FROM accountability_partners WHERE active_lock = 'active' LIMIT 1`);
  return res.rows[0] || null;
}

/**
 * Deja este destinatario como el único vigente (data-model.md: "vigente ⇔ set_partner de otro ⇔
 * histórico"). Dentro de una transacción: desactiva el anterior (`active_lock = NULL`) y crea el
 * nuevo con `active_lock = 'active'` — nunca hay un instante con dos filas 'active' a la vez
 * (violaría la UNIQUE), igual que `running_lock` en tandas.
 */
export async function setActivePartnerInDb(input: {
  name: string;
  email: string;
  consented_at: string;
}): Promise<AccountabilityPartnerRecord> {
  return withExecutionTransaction(async (client) => {
    await client.query(`UPDATE accountability_partners SET active_lock = NULL WHERE active_lock = 'active'`);
    const id = `partner-${Date.now()}`;
    const res = await client.query(
      `INSERT INTO accountability_partners (id, name, email, consented_at, active_lock)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [id, input.name, input.email, input.consented_at]
    );
    return res.rows[0];
  });
}

// --- weekly_reports (US6) ---

export interface WeeklyReportRecord {
  id: string;
  program_week_id: string;
  partner_id: string | null;
  payload: any;
  verdict: string;
  user_note: string | null;
  frozen_at: string;
  note_deadline: string;
  status: string;
  attempts: number;
  last_attempt_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  freeze_notified_at?: string | null;
  created_at?: string;
}

/** El driver de Postgres normalmente ya entrega `jsonb` como objeto; esta función solo cubre el
 * caso (algunos entornos de pg-mem) en que llega como texto, y castea `attempts` a número. */
function normalizeWeeklyReportRow(row: any): WeeklyReportRecord {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  return { ...row, payload, attempts: Number(row.attempts) };
}

export async function fetchWeeklyReportsFromDb(id?: string): Promise<WeeklyReportRecord | WeeklyReportRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM weekly_reports WHERE id = $1', [id]);
    return res.rows[0] ? normalizeWeeklyReportRow(res.rows[0]) : null;
  }
  const res = await pgPool.query('SELECT * FROM weekly_reports ORDER BY frozen_at ASC');
  return res.rows.map(normalizeWeeklyReportRow);
}

/**
 * Congela una semana (id = program_week_id) una sola vez: `ON CONFLICT (id) DO NOTHING` hace que
 * un segundo tick concurrente que intente congelar la misma semana no haga nada y no lance error
 * (FR-039). Devuelve la fila insertada, o null si ya existía (otro proceso ya la había congelado).
 */
export async function insertWeeklyReportIfAbsentInDb(input: {
  id: string;
  program_week_id: string;
  partner_id: string | null;
  payload: unknown;
  verdict: string;
  frozen_at: string;
  note_deadline: string;
}): Promise<WeeklyReportRecord | null> {
  // US9: quien arma el payload (lib/execution/tick.ts:freezeOneWeek, para el congelamiento real
  // del domingo) todavía no sabe de "Aperturas del plan" — esa historia es posterior a la suya.
  // En vez de tocar ese archivo, se completa aquí mismo, justo antes de guardar, contando las
  // filas de plan_views de esta semana que pasaron por la compuerta (was_gated=true): así el
  // reporte realmente congelado lleva la misma cifra que manage_weekly_report:preview ya calcula
  // en lib/execution/handlers.ts. Si el caller ya trae `plan_openings` (el preview sí lo hace),
  // se respeta tal cual.
  const payload: Record<string, unknown> = { ...(input.payload as Record<string, unknown>) };
  if (payload.plan_openings == null) {
    const gatedRes = await pgPool.query('SELECT was_gated FROM plan_views WHERE program_week_id = $1', [
      input.program_week_id,
    ]);
    payload.plan_openings = gatedRes.rows.filter((r: { was_gated: boolean }) => r.was_gated).length;
  }

  const res = await pgPool.query(
    `INSERT INTO weekly_reports (id, program_week_id, partner_id, payload, verdict, frozen_at, note_deadline, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'congelado')
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      input.id,
      input.program_week_id,
      input.partner_id,
      JSON.stringify(payload),
      input.verdict,
      input.frozen_at,
      input.note_deadline,
    ]
  );
  return res.rows[0] ? normalizeWeeklyReportRow(res.rows[0]) : null;
}

export async function updateWeeklyReportNoteInDb(id: string, note: string): Promise<WeeklyReportRecord | null> {
  const res = await pgPool.query(`UPDATE weekly_reports SET user_note = $2 WHERE id = $1 RETURNING *`, [id, note]);
  return res.rows[0] ? normalizeWeeklyReportRow(res.rows[0]) : null;
}

/** Deja constancia, en el reporte ya congelado, de a qué destinatario se le terminó mandando —
 * relevante sobre todo cuando se congeló sin ninguno y se resolvió el vigente al momento de
 * enviar (auditoría US6: "guarda el partner_id en el reporte para que quede el registro"). */
export async function setWeeklyReportPartnerInDb(id: string, partnerId: string): Promise<WeeklyReportRecord | null> {
  const res = await pgPool.query(`UPDATE weekly_reports SET partner_id = $2 WHERE id = $1 RETURNING *`, [id, partnerId]);
  return res.rows[0] ? normalizeWeeklyReportRow(res.rows[0]) : null;
}

/**
 * Claim atómico (US6-AS4, FR-039): entre todas las llamadas concurrentes que compitan por el
 * mismo reporte, como mucho una obtiene la fila (y por lo tanto el permiso de enviarla). Si no
 * devuelve fila, es porque el reporte ya no está en 'congelado' (otro tick ya lo tomó, ya se
 * envió, o ya está fallido) y este intento no hace nada.
 */
export async function claimWeeklyReportForSendingInDb(id: string, now: Date): Promise<WeeklyReportRecord | null> {
  const res = await pgPool.query(
    `UPDATE weekly_reports SET status = 'enviando', attempts = attempts + 1, last_attempt_at = $2
     WHERE id = $1 AND status = 'congelado'
     RETURNING *`,
    [id, now.toISOString()]
  );
  return res.rows[0] ? normalizeWeeklyReportRow(res.rows[0]) : null;
}

export async function markWeeklyReportSentInDb(id: string, now: Date): Promise<WeeklyReportRecord | null> {
  const res = await pgPool.query(`UPDATE weekly_reports SET status = 'enviado', sent_at = $2 WHERE id = $1 RETURNING *`, [
    id,
    now.toISOString(),
  ]);
  return res.rows[0] ? normalizeWeeklyReportRow(res.rows[0]) : null;
}

/** `exhausted`: si ya se agotaron los 3 intentos, el reporte queda 'fallido'; si no, vuelve a
 * 'congelado' para que el siguiente tick lo reintente pasado el backoff. */
export async function markWeeklyReportFailedAttemptInDb(
  id: string,
  error: string,
  exhausted: boolean
): Promise<WeeklyReportRecord | null> {
  const status = exhausted ? 'fallido' : 'congelado';
  const res = await pgPool.query(`UPDATE weekly_reports SET status = $2, last_error = $3 WHERE id = $1 RETURNING *`, [
    id,
    status,
    error,
  ]);
  return res.rows[0] ? normalizeWeeklyReportRow(res.rows[0]) : null;
}

/**
 * Deshace un claim que no llegó a intentar el envío porque no hay destinatario (auditoría US6):
 * no tener un destinatario configurado no es un fallo de entrega (FR-023 es para eso), así que
 * el `attempts + 1` que puso el claim se revierte exactamente (`attempts - 1`) y `last_attempt_at`
 * vuelve al valor que tenía antes de este intento — nunca queda 'fallido' ni gastando el backoff
 * de un intento que en realidad no ocurrió.
 */
export async function revertClaimForMissingPartnerInDb(
  id: string,
  previousLastAttemptAt: string | null
): Promise<WeeklyReportRecord | null> {
  const res = await pgPool.query(
    `UPDATE weekly_reports
     SET status = 'congelado', attempts = attempts - 1, last_attempt_at = $2
     WHERE id = $1
     RETURNING *`,
    [id, previousLastAttemptAt]
  );
  return res.rows[0] ? normalizeWeeklyReportRow(res.rows[0]) : null;
}

/** Recuperación de un intento colgado: un reporte con más de `staleMinutes` en 'enviando' vuelve
 * a 'congelado' (plan.md, US6 · Reporte). Devuelve cuántos reportes se recuperaron así. */
export async function revertStuckSendingToFrozenInDb(now: Date, staleMinutes: number): Promise<number> {
  const allRaw = await fetchWeeklyReportsFromDb();
  const all = (Array.isArray(allRaw) ? allRaw : []) as WeeklyReportRecord[];
  let count = 0;
  for (const report of all) {
    if (report.status !== 'enviando' || !report.last_attempt_at) continue;
    const elapsedMinutes = (now.getTime() - new Date(report.last_attempt_at).getTime()) / 60_000;
    if (elapsedMinutes > staleMinutes) {
      await pgPool.query(`UPDATE weekly_reports SET status = 'congelado' WHERE id = $1`, [report.id]);
      count++;
    }
  }
  return count;
}

/** US7: marca el aviso "Reporte de la semana congelado" como ya enviado, para que congelar dos
 * veces la misma semana (no debería pasar por el insert idempotente, pero por si acaso) o releer
 * el estado del tick nunca lo reenvíe. */
export async function markWeeklyReportFreezeNotifiedInDb(id: string, now: Date): Promise<WeeklyReportRecord | null> {
  const res = await pgPool.query(`UPDATE weekly_reports SET freeze_notified_at = $2 WHERE id = $1 RETURNING *`, [
    id,
    now.toISOString(),
  ]);
  return res.rows[0] ? normalizeWeeklyReportRow(res.rows[0]) : null;
}

// --- push_subscriptions (US7) ---

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
  last_success_at?: string | null;
  created_at?: string;
}

export async function fetchPushSubscriptionsFromDb(
  id?: string
): Promise<PushSubscriptionRecord | PushSubscriptionRecord[] | null> {
  if (id) {
    const res = await pgPool.query('SELECT * FROM push_subscriptions WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM push_subscriptions ORDER BY created_at ASC');
  return res.rows;
}

/** Upsert por `id` (= sha256(endpoint), calculado por quien llama): activar los avisos dos veces
 * desde el mismo dispositivo actualiza la misma fila en vez de duplicarla (US7-AS1). */
export async function upsertPushSubscriptionToDb(sub: {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
}): Promise<PushSubscriptionRecord> {
  const res = await pgPool.query(
    `INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       endpoint = EXCLUDED.endpoint,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent
     RETURNING *`,
    [sub.id, sub.endpoint, sub.p256dh, sub.auth, sub.user_agent ?? null]
  );
  return res.rows[0];
}

export async function deletePushSubscriptionFromDb(id: string): Promise<void> {
  await pgPool.query('DELETE FROM push_subscriptions WHERE id = $1', [id]);
}

export async function markPushSubscriptionSuccessInDb(id: string, now: Date): Promise<void> {
  await pgPool.query('UPDATE push_subscriptions SET last_success_at = $2 WHERE id = $1', [id, now.toISOString()]);
}

// --- intentions (US8) ---

export interface IntentionRecord {
  id: string;
  program_week_id: string;
  subject_id: string;
  strength: number;
  reason?: string | null;
  captured_at?: string;
}

export async function fetchIntentionsFromDb(programWeekId?: string): Promise<IntentionRecord[]> {
  if (programWeekId) {
    const res = await pgPool.query('SELECT * FROM intentions WHERE program_week_id = $1 ORDER BY captured_at ASC', [
      programWeekId,
    ]);
    return res.rows;
  }
  const res = await pgPool.query('SELECT * FROM intentions ORDER BY captured_at ASC');
  return res.rows;
}

/** `id` determinista `${program_week_id}:${subject_id}` (data-model.md): registrar de nuevo la
 * intención de una materia en la misma semana reemplaza la anterior en vez de duplicarla. */
export async function saveIntentionToDb(intention: {
  program_week_id: string;
  subject_id: string;
  strength: number;
  reason?: string | null;
}): Promise<IntentionRecord> {
  const id = `${intention.program_week_id}:${intention.subject_id}`;
  const res = await pgPool.query(
    `INSERT INTO intentions (id, program_week_id, subject_id, strength, reason)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET strength = EXCLUDED.strength, reason = EXCLUDED.reason
     RETURNING *`,
    [id, intention.program_week_id, intention.subject_id, intention.strength, intention.reason ?? null]
  );
  return res.rows[0];
}

// --- plan_views (US9) ---

export interface PlanViewRecord {
  id: string;
  program_week_id: string;
  viewed_at: string;
  surface: string;
  was_gated: boolean;
  reason?: string | null;
}

export async function fetchPlanViewsFromDb(programWeekId: string, surface?: string): Promise<PlanViewRecord[]> {
  if (surface) {
    const res = await pgPool.query(
      'SELECT * FROM plan_views WHERE program_week_id = $1 AND surface = $2 ORDER BY viewed_at ASC',
      [programWeekId, surface]
    );
    return res.rows;
  }
  const res = await pgPool.query('SELECT * FROM plan_views WHERE program_week_id = $1 ORDER BY viewed_at ASC', [
    programWeekId,
  ]);
  return res.rows;
}

export async function savePlanViewToDb(view: {
  id: string;
  program_week_id: string;
  viewed_at: string;
  surface: string;
  was_gated: boolean;
  reason?: string | null;
}): Promise<PlanViewRecord> {
  const res = await pgPool.query(
    `INSERT INTO plan_views (id, program_week_id, viewed_at, surface, was_gated, reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [view.id, view.program_week_id, view.viewed_at, view.surface, view.was_gated, view.reason ?? null]
  );
  return res.rows[0];
}
