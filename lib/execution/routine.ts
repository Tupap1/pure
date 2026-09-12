// Servicio de disparadores si-entonces (US2 — Un solo disparador vigente). Handler único
// consumido por manage_routine_slots (MCP) y, a través suyo, por app/api/execution/route.ts
// (Principio I). La decisión de "cuál es el vigente ahora" es dominio puro
// (lib/domain/execution.ts:resolveCurrentTrigger); este archivo solo carga los datos y aplica
// los efectos de negocio que sí necesitan la base (crear, responder, ensayar).

import { localParts, addDays } from './time';
import type { ExecutionResult } from '../validations/schemas';
import {
  fetchRoutineSlotsFromDb,
  saveRoutineSlotToDb,
  deleteRoutineSlotFromDb,
  RoutineSlotRecord,
  fetchSlotOutcomesFromDb,
  saveSlotOutcomeToDb,
  SlotOutcomeRecord,
  fetchPlanRehearsalsFromDb,
  savePlanRehearsalToDb,
  fetchProgramWeeksFromDb,
  ProgramWeekRecord,
  saveDailyCheckToDb,
} from '../db/execution-pg';
import { fetchSchedulesFromDb, fetchSubjectsFromDb, fetchUniversitiesFromDb } from '../db/repository-pg';
import { resolveCurrentTrigger, CurrentTrigger } from '../domain/execution';

export interface RoutineSlotUpsertInput {
  id?: string;
  days_of_week: number[];
  cue_kind: 'hora' | 'tras_clase' | 'tras_habito' | 'lugar';
  cue_text: string;
  action_text: string;
  anchor_time?: string;
  schedule_id?: string;
  subject_id?: string;
  habit_id?: string;
  kind?: 'estudio' | 'habito' | 'otro';
  periodicity?: 'semanal' | 'sabado_a' | 'sabado_b';
  is_active?: boolean;
}

/**
 * create/update comparten la misma regla (contracts/mcp-tools.md): un tras_clase SIEMPRE hereda
 * days_of_week y periodicity de su horario (FR-010) — lo que mande el llamador en esos dos campos
 * se ignora a propósito, para que un disparador de clase nunca quede desincronizado si el horario
 * cambia de día o de alternancia.
 */
export async function upsertRoutineSlot(input: RoutineSlotUpsertInput): Promise<ExecutionResult<RoutineSlotRecord>> {
  let days_of_week = input.days_of_week;
  let periodicity = input.periodicity ?? 'semanal';

  if (input.cue_kind === 'tras_clase') {
    const scheduleRaw = input.schedule_id ? await fetchSchedulesFromDb(input.schedule_id) : null;
    const schedule = Array.isArray(scheduleRaw) ? scheduleRaw[0] : scheduleRaw;
    if (!schedule) {
      return {
        status: 'error',
        code: 'NO_ENCONTRADO',
        message: `No existe el horario ${input.schedule_id} referenciado por schedule_id.`,
      };
    }
    days_of_week = [schedule.day_of_week];
    periodicity = (schedule.periodicity as typeof periodicity) || 'semanal';
  }

  const saved = await saveRoutineSlotToDb({
    id: input.id,
    days_of_week,
    cue_kind: input.cue_kind,
    cue_text: input.cue_text,
    action_text: input.action_text,
    anchor_time: input.anchor_time,
    schedule_id: input.schedule_id,
    subject_id: input.subject_id,
    habit_id: input.habit_id,
    kind: input.kind,
    periodicity,
    is_active: input.is_active,
  });

  return { status: 'success', data: saved };
}

/** true si el tras_clase referencia un schedule_id que ya no existe (borrado después de crear el
 * disparador): "queda huérfano: no se muestra y se marca para revisión" (spec.md, Edge Cases). */
async function markOrphan(slot: RoutineSlotRecord): Promise<RoutineSlotRecord & { huerfano?: boolean }> {
  if (slot.cue_kind !== 'tras_clase') return slot;
  const scheduleRaw = slot.schedule_id ? await fetchSchedulesFromDb(slot.schedule_id) : null;
  const schedule = Array.isArray(scheduleRaw) ? scheduleRaw[0] : scheduleRaw;
  return schedule ? slot : { ...slot, huerfano: true };
}

export async function readRoutineSlots(id?: string): Promise<ExecutionResult> {
  const raw = await fetchRoutineSlotsFromDb(id);

  if (id) {
    if (!raw) {
      return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe el disparador ${id}.` };
    }
    const enriched = await markOrphan(raw as RoutineSlotRecord);
    return { status: 'success', data: enriched };
  }

  const list = (Array.isArray(raw) ? raw : []) as RoutineSlotRecord[];
  const enriched = await Promise.all(list.map(markOrphan));
  return { status: 'success', data: enriched };
}

export async function deleteRoutineSlot(id: string): Promise<ExecutionResult> {
  await deleteRoutineSlotFromDb(id);
  return { status: 'success', message: `Disparador ${id} eliminado.` };
}

export interface RoutineSlotRespondInput {
  routine_slot_id: string;
  outcome: 'hecho' | 'no';
}

/**
 * FR-012: registra la respuesta del día para un disparador (idempotente por
 * `${date}:${routine_slot_id}`: una segunda llamada el mismo día devuelve la respuesta original
 * con `ya_respondido: true`, sin volver a aplicar efectos). En un disparador de hábito, además
 * fija el check de ese hábito hoy (hecho -> cumplido, no -> fallado). El "hecho" real de un
 * disparador de estudio ocurre por manage_tandas:start con routine_slot_id (liga la tanda y
 * registra el outcome desde ahí): no hay botón "Hecho" para estudio en Hoy (T031).
 */
export async function respondToRoutineSlot(
  input: RoutineSlotRespondInput,
  now: Date = new Date()
): Promise<ExecutionResult> {
  const slotRaw = await fetchRoutineSlotsFromDb(input.routine_slot_id);
  const slot = slotRaw as RoutineSlotRecord | null;
  if (!slot) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe el disparador ${input.routine_slot_id}.` };
  }

  const dateKey = localParts(now).dateKey;
  const outcomeId = `${dateKey}:${input.routine_slot_id}`;

  const existingRaw = await fetchSlotOutcomesFromDb(outcomeId);
  const existing = existingRaw as SlotOutcomeRecord | null;
  if (existing) {
    return { status: 'success', data: { ...existing, ya_respondido: true } };
  }

  const saved = await saveSlotOutcomeToDb({
    id: outcomeId,
    date: dateKey,
    routine_slot_id: input.routine_slot_id,
    outcome: input.outcome,
  });

  if (slot.kind === 'habito' && slot.habit_id) {
    await saveDailyCheckToDb({
      id: `${dateKey}:${slot.habit_id}`,
      date: dateKey,
      habit_id: slot.habit_id,
      status: input.outcome === 'hecho' ? 'cumplido' : 'fallado',
    });
  }

  return { status: 'success', data: { ...saved, ya_respondido: false } };
}

export interface RoutineSlotRehearseInput {
  routine_slot_id: string;
  program_week_id?: string;
}

/** Semana en curso; si hoy es domingo, la siguiente (contracts/mcp-tools.md: "la semana en
 * curso, o la siguiente si es domingo" — el domingo es el día de planear la semana que viene). */
async function resolveRehearsalWeekId(now: Date): Promise<string | null> {
  const local = localParts(now);
  const targetDateKey = local.dayOfWeek === 7 ? addDays(local.dateKey, 1) : local.dateKey;

  const weeksRaw = await fetchProgramWeeksFromDb();
  const weeks = (Array.isArray(weeksRaw) ? weeksRaw : []) as ProgramWeekRecord[];
  const week = weeks.find((w) => w.starts_on <= targetDateKey && targetDateKey <= addDays(w.starts_on, 6));
  return week?.id ?? null;
}

/** FR-013: como máximo un ensayo por disparador y semana del programa (idempotente por
 * `${program_week_id}:${routine_slot_id}`). */
export async function rehearseRoutineSlot(
  input: RoutineSlotRehearseInput,
  now: Date = new Date()
): Promise<ExecutionResult<{ ya_ensayado: boolean }>> {
  const weekId = input.program_week_id ?? (await resolveRehearsalWeekId(now));
  if (!weekId) {
    return {
      status: 'error',
      code: 'NO_ENCONTRADO',
      message: 'No hay una semana del programa vigente (ni la siguiente) para ensayar este disparador.',
    };
  }

  const id = `${weekId}:${input.routine_slot_id}`;
  const existingRaw = await fetchPlanRehearsalsFromDb(id);
  if (existingRaw) {
    return { status: 'success', data: { ya_ensayado: true } };
  }

  await savePlanRehearsalToDb({ id, program_week_id: weekId, routine_slot_id: input.routine_slot_id });
  return { status: 'success', data: { ya_ensayado: false } };
}

/**
 * Wrapper de servicio para get_today (US1-US3): carga los disparadores activos, los horarios,
 * materias y universidades que resolveCurrentTrigger necesita para decidir el ancla y la paridad
 * de sábado, y las respuestas de hoy para excluir lo ya resuelto. Sigue el mismo convenio que
 * running_tanda en TodayRunningTanda: expone subject_id, no un objeto "subject" resuelto — el
 * nombre se busca en el cliente vía usePureData().subjects (T025/T021).
 */
export async function resolveTodayTrigger(now: Date = new Date()): Promise<CurrentTrigger | null> {
  const dateKey = localParts(now).dateKey;

  const [slotsRaw, schedulesRaw, subjectsRaw, universitiesRaw, outcomesRaw] = await Promise.all([
    fetchRoutineSlotsFromDb(),
    fetchSchedulesFromDb(),
    fetchSubjectsFromDb(),
    fetchUniversitiesFromDb(),
    fetchSlotOutcomesFromDb(),
  ]);

  const slots = (Array.isArray(slotsRaw) ? slotsRaw : []) as RoutineSlotRecord[];
  const schedules = (Array.isArray(schedulesRaw) ? schedulesRaw : []) as any[];
  const subjects = (Array.isArray(subjectsRaw) ? subjectsRaw : []) as any[];
  const universities = (Array.isArray(universitiesRaw) ? universitiesRaw : []) as any[];
  const outcomes = (Array.isArray(outcomesRaw) ? outcomesRaw : []) as SlotOutcomeRecord[];

  const respondedTodaySlotIds = outcomes.filter((o) => o.date === dateKey).map((o) => o.routine_slot_id);

  return resolveCurrentTrigger({
    now,
    slots: slots.map((s) => ({
      id: s.id,
      is_active: s.is_active,
      days_of_week: s.days_of_week,
      cue_kind: s.cue_kind as any,
      cue_text: s.cue_text,
      action_text: s.action_text,
      anchor_time: s.anchor_time,
      schedule_id: s.schedule_id,
      subject_id: s.subject_id,
      habit_id: s.habit_id,
      kind: s.kind as any,
      periodicity: s.periodicity as any,
    })),
    schedules: schedules.map((s) => ({ id: s.id, end_time: s.end_time, subject_id: s.subject_id })),
    subjects: subjects.map((s) => ({ id: s.id, university_id: s.university_id })),
    universities: universities.map((u) => ({
      id: u.id,
      has_alternating_saturdays: u.has_alternating_saturdays,
      first_sabado_a_date: u.first_sabado_a_date,
    })),
    respondedTodaySlotIds,
  });
}
