// Servicio de planeación (US8-US9): tareas de 1-3 tandas, intención por materia, la vista de
// semana con su compuerta y el asistente del domingo. Handler único consumido por manage_tasks y
// plan_week (MCP) y, a través suyo, por app/api/execution/route.ts (Principio I). El reparto
// sugerido reusa computeAcademicLoad (norma de créditos, lib/algorithms/academic-load.ts) y la
// proyección/alertas reusan computeGradeProjections (US5, lib/execution/grade-projection.ts):
// ninguno de los dos se recalcula aquí.

import { localParts, addDays } from './time';
import { isoDayOfWeekForDateKey } from '../domain/execution';
import {
  fetchExecutionTasksFromDb,
  saveExecutionTaskToDb,
  deleteExecutionTaskFromDb,
  ExecutionTaskRecord,
  fetchIntentionsFromDb,
  saveIntentionToDb,
  IntentionRecord,
  fetchPlanViewsFromDb,
  savePlanViewToDb,
  fetchProgramWeeksFromDb,
  ProgramWeekRecord,
  fetchRoutineSlotsFromDb,
  RoutineSlotRecord,
  fetchSlotOutcomesFromDb,
  SlotOutcomeRecord,
  fetchPlanRehearsalsFromDb,
  PlanRehearsalRecord,
} from '../db/execution-pg';
import { fetchSubjectsFromDb, fetchSchedulesFromDb, fetchUniversitiesFromDb, fetchDeliverablesFromDb } from '../db/repository-pg';
import { computeAcademicLoad } from '../algorithms/academic-load';
import { computeGradeProjections } from './grade-projection';
import { getCompliance } from './compliance';
import { readTandas } from './tandas';
import { resolveRehearsalWeekId } from './routine';
import type { ExecutionResult } from '../validations/schemas';

// --- Tareas (tasks, US8) ---------------------------------------------------------------------

export interface TaskCreateInput {
  id?: string;
  title: string;
  subject_id: string;
  deliverable_id?: string;
  topic_id?: string;
  estimated_tandas: number;
  status?: string;
  scheduled_date?: string;
}

export async function createTask(input: TaskCreateInput): Promise<ExecutionResult<ExecutionTaskRecord>> {
  const saved = await saveExecutionTaskToDb(input);
  return { status: 'success', data: saved };
}

export interface TaskReadFilter {
  id?: string;
  subject_id?: string;
  status?: string;
}

export async function readTasks(filter: TaskReadFilter): Promise<ExecutionResult> {
  if (filter.id) {
    const task = await fetchExecutionTasksFromDb(filter.id);
    if (!task) {
      return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la tarea ${filter.id}.` };
    }
    return { status: 'success', data: task };
  }

  const allRaw = await fetchExecutionTasksFromDb();
  let all = (Array.isArray(allRaw) ? allRaw : []) as ExecutionTaskRecord[];
  if (filter.subject_id) all = all.filter((t) => t.subject_id === filter.subject_id);
  if (filter.status) all = all.filter((t) => t.status === filter.status);
  return { status: 'success', data: all };
}

export interface TaskUpdateInput {
  id: string;
  title?: string;
  subject_id?: string;
  deliverable_id?: string;
  topic_id?: string;
  estimated_tandas?: number;
  status?: string;
  scheduled_date?: string;
}

export async function updateTask(input: TaskUpdateInput): Promise<ExecutionResult<ExecutionTaskRecord>> {
  const existingRaw = await fetchExecutionTasksFromDb(input.id);
  const existing = existingRaw as ExecutionTaskRecord | null;
  if (!existing) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la tarea ${input.id}.` };
  }
  const saved = await saveExecutionTaskToDb({ ...existing, ...input });
  return { status: 'success', data: saved };
}

export async function deleteTask(id: string): Promise<ExecutionResult> {
  await deleteExecutionTaskFromDb(id);
  return { status: 'success', message: `Tarea ${id} eliminada.` };
}

/** FR-035: `today` nunca arrastra deuda — solo lo programado exactamente para hoy y todavía
 * pendiente. Lo de ayer sin hacer simplemente no aparece (ni aquí ni en ningún otro lado). */
export async function getTodayTasks(now: Date): Promise<ExecutionResult> {
  const dateKey = localParts(now).dateKey;
  const allRaw = await fetchExecutionTasksFromDb();
  const all = (Array.isArray(allRaw) ? allRaw : []) as ExecutionTaskRecord[];
  const today = all.filter((t) => t.scheduled_date === dateKey && t.status === 'pendiente');
  return { status: 'success', data: today };
}

// --- Intención (intentions, US8) -------------------------------------------------------------

export interface SetIntentionsInput {
  program_week_id: string;
  items: Array<{ subject_id: string; strength: number; reason?: string }>;
}

/**
 * FR-034: intención < 6 sin razón se rechaza (RAZON_REQUERIDA) antes de guardar nada — ni esa
 * materia ni las demás del mismo lote quedan a medias. No vive en el esquema Zod porque
 * IntentionItemSchema ya tiene un test de forma en verde que acepta `strength: 0` sin `reason`
 * (__tests__/validations/execution-schemas.test.ts): esa prueba solo valida el rango numérico, la
 * regla de negocio "hace falta una razón" es justo lo que esta función decide.
 */
export async function setIntentions(input: SetIntentionsInput): Promise<ExecutionResult<IntentionRecord[]>> {
  for (const item of input.items) {
    if (item.strength < 6 && (!item.reason || !item.reason.trim())) {
      return {
        status: 'error',
        code: 'RAZON_REQUERIDA',
        message: `La intención declarada para ${item.subject_id} es menor a 6: hace falta una razón para dejar de sugerirle disparadores.`,
      };
    }
  }

  const saved: IntentionRecord[] = [];
  for (const item of input.items) {
    saved.push(
      await saveIntentionToDb({
        program_week_id: input.program_week_id,
        subject_id: item.subject_id,
        strength: item.strength,
        reason: item.reason?.trim() || null,
      })
    );
  }
  return { status: 'success', data: saved };
}

// --- plan_week: preview (asistente del domingo, US8) ------------------------------------------

async function resolveTargetAndPastWeek(
  programWeekId: string | undefined,
  now: Date
): Promise<{ target: ProgramWeekRecord; past: ProgramWeekRecord | null } | null> {
  const weeksRaw = await fetchProgramWeeksFromDb();
  const weeks = (Array.isArray(weeksRaw) ? weeksRaw : []) as ProgramWeekRecord[];

  const targetId = programWeekId ?? (await resolveRehearsalWeekId(now)) ?? undefined;
  if (!targetId) return null;

  const target = weeks.find((w) => w.id === targetId);
  if (!target) return null;

  const past = weeks.find((w) => w.week_number === target.week_number - 1) ?? null;
  return { target, past };
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function previewPlanWeek(input: { program_week_id?: string }, now: Date): Promise<ExecutionResult> {
  const resolved = await resolveTargetAndPastWeek(input.program_week_id, now);
  if (!resolved) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: 'No hay una semana del programa para planear.' };
  }
  const { target, past } = resolved;

  const [subjectsRaw, schedulesRaw, universitiesRaw, deliverablesRaw, slotsRaw, rehearsalsRaw, intentions, projections] =
    await Promise.all([
      fetchSubjectsFromDb(),
      fetchSchedulesFromDb(),
      fetchUniversitiesFromDb(),
      fetchDeliverablesFromDb(),
      fetchRoutineSlotsFromDb(),
      fetchPlanRehearsalsFromDb(),
      fetchIntentionsFromDb(target.id),
      computeGradeProjections(now),
    ]);

  const subjects = (Array.isArray(subjectsRaw) ? subjectsRaw : []) as any[];
  const schedules = (Array.isArray(schedulesRaw) ? schedulesRaw : []) as any[];
  const universities = (Array.isArray(universitiesRaw) ? universitiesRaw : []) as any[];
  const deliverables = (Array.isArray(deliverablesRaw) ? deliverablesRaw : []) as any[];
  const slots = (Array.isArray(slotsRaw) ? slotsRaw : []) as RoutineSlotRecord[];
  const rehearsals = (Array.isArray(rehearsalsRaw) ? rehearsalsRaw : []) as PlanRehearsalRecord[];

  const rehearsedSlotIds = new Set(
    rehearsals.filter((r) => r.program_week_id === target.id).map((r) => r.routine_slot_id)
  );

  const semana_pasada = past
    ? await getCompliance({ from: past.starts_on, to: addDays(past.starts_on, 6), cutoff: now })
    : null;

  const nowMs = now.getTime();
  const horizonMs = nowMs + FOURTEEN_DAYS_MS;
  const flagsBySubject = new Map(projections.materias.map((m) => [m.subject_id, m.flags]));
  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));

  const entregas_14_dias = deliverables
    .filter((d) => {
      if (!d.due_date) return false;
      const dueMs = new Date(d.due_date).getTime();
      return dueMs >= nowMs && dueMs <= horizonMs;
    })
    .map((d) => ({
      id: d.id,
      title: d.title,
      subject_id: d.subject_id,
      subject_name: subjectNameById.get(d.subject_id) ?? d.subject_id,
      due_date: d.due_date,
      weight_percentage: d.weight_percentage,
      status: d.status,
      subject_flags: flagsBySubject.get(d.subject_id) ?? [],
    }))
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const disparadores = slots
    .filter((s) => s.is_active !== false)
    .map((s) => ({
      id: s.id,
      cue_text: s.cue_text,
      action_text: s.action_text,
      cue_kind: s.cue_kind,
      kind: s.kind,
      subject_id: s.subject_id ?? null,
      days_of_week: s.days_of_week,
      ensayado: rehearsedSlotIds.has(s.id),
    }));

  // FR-034 (US8-AS1): una materia con intención < 6 esta semana no recibe reparto sugerido.
  const lowIntentionSubjectIds = new Set(intentions.filter((i) => i.strength < 6).map((i) => i.subject_id));

  const load = computeAcademicLoad(subjects as any, schedules as any, universities as any, {
    deliverables: deliverables as any,
    referenceDate: now,
  });

  // FR-036: el número sale SOLO de la norma de créditos (weeklyIndependentHours); urgencia y
  // proyección van en columnas aparte, nunca mezcladas en el mismo número.
  const reparto_sugerido = load.perSubject
    .filter((item) => !lowIntentionSubjectIds.has(item.subject.id as string))
    .map((item) => {
      const projection = projections.materias.find((m) => m.subject_id === item.subject.id);
      return {
        subject_id: item.subject.id as string,
        name: item.subject.name as string,
        normative_hours: item.creditLoad.weeklyIndependentHours,
        suggested_tandas: Math.round(item.creditLoad.weeklyIndependentHours * 6), // 6 tandas de 10 min por hora
        urgencia: item.upcomingDeliverablesWeight,
        proyeccion: projection
          ? { neededToPass: projection.projection.neededToPass, neededForTarget: projection.projection.neededForTarget }
          : null,
      };
    });

  return {
    status: 'success',
    data: {
      program_week_id: target.id,
      week_number: target.week_number,
      starts_on: target.starts_on,
      semana_pasada,
      entregas_14_dias,
      flags_proyeccion: projections.alertas,
      intenciones: intentions,
      disparadores,
      reparto_sugerido,
    },
  };
}

// --- plan_week: open_view (compuerta de la vista de semana, US9) ------------------------------

type TriggerDayOutcome = 'hecho' | 'no' | 'sin_respuesta' | null;

export interface WeekTriggerRow {
  id: string;
  cue_text: string;
  action_text: string;
  dias: Record<string, TriggerDayOutcome>;
}

/** Rejilla de la semana (sin gráficas, DESIGN.md): cada disparador con su resultado por día
 * (hecho/no/sin_respuesta; null si el día todavía no llega) y las tandas por día
 * (lib/execution/tandas.ts:readTandas, ya agregadas). Aproximación simple, igual que
 * lib/execution/compliance.ts: no reconstruye la alternancia de sábados de resolveCurrentTrigger,
 * solo cruza days_of_week contra el día de la semana. */
async function buildWeekGrid(weekStart: string, weekEnd: string, now: Date) {
  const [slotsRaw, outcomesRaw, tandasRes] = await Promise.all([
    fetchRoutineSlotsFromDb(),
    fetchSlotOutcomesFromDb(),
    readTandas({ from: weekStart, to: weekEnd }, now),
  ]);
  const slots = (Array.isArray(slotsRaw) ? slotsRaw : []) as RoutineSlotRecord[];
  const outcomes = (Array.isArray(outcomesRaw) ? outcomesRaw : []) as SlotOutcomeRecord[];

  const days: string[] = [];
  for (let cursor = weekStart; cursor <= weekEnd; cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }
  const todayKey = localParts(now).dateKey;

  const disparadores: WeekTriggerRow[] = slots
    .filter((slot) => slot.is_active !== false)
    .map((slot) => {
      const dias: Record<string, TriggerDayOutcome> = {};
      for (const day of days) {
        if (!slot.days_of_week.includes(isoDayOfWeekForDateKey(day))) continue;
        if (day > todayKey) {
          dias[day] = null;
          continue;
        }
        const outcome = outcomes.find((o) => o.date === day && o.routine_slot_id === slot.id);
        dias[day] = (outcome?.outcome as 'hecho' | 'no' | undefined) ?? 'sin_respuesta';
      }
      return { id: slot.id, cue_text: slot.cue_text, action_text: slot.action_text, dias };
    })
    .filter((row) => Object.keys(row.dias).length > 0);

  const tandas_por_dia = tandasRes.status === 'success' ? tandasRes.data!.por_dia : [];

  return { disparadores, tandas_por_dia };
}

/**
 * FR-037: libre 2 veces por semana; desde la 3.ª exige `reason` (RAZON_REQUERIDA si falta) y esa
 * apertura queda `was_gated=true`. El conteo es por semana del programa vigente hoy (nunca "la
 * siguiente si es domingo": la vista de semana siempre muestra la semana en curso, no la que se
 * está planeando). No hay claim atómico como en tandas/weekly_reports porque no hace falta
 * garantizar exclusión mutua entre dispositivos aquí — el id determinista por ordinal
 * (`${program_week_id}:view-N`) ya evita duplicar una misma apertura si esta función se llama dos
 * veces con el mismo conteo previo.
 */
export async function openPlanView(input: { reason?: string }, now: Date): Promise<ExecutionResult> {
  const weeksRaw = await fetchProgramWeeksFromDb();
  const weeks = (Array.isArray(weeksRaw) ? weeksRaw : []) as ProgramWeekRecord[];
  const todayKey = localParts(now).dateKey;
  const week = weeks.find((w) => w.starts_on <= todayKey && todayKey <= addDays(w.starts_on, 6));
  if (!week) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: 'No hay una semana del programa vigente para ver.' };
  }

  const existing = await fetchPlanViewsFromDb(week.id, 'semana');
  const priorCount = existing.length;
  const hasReason = !!input.reason && !!input.reason.trim();

  if (priorCount >= 2 && !hasReason) {
    return {
      status: 'error',
      code: 'RAZON_REQUERIDA',
      message: 'Ya abriste la vista de la semana 2 veces esta semana: la próxima apertura necesita una razón.',
    };
  }

  const wasGated = priorCount >= 2;
  await savePlanViewToDb({
    id: `${week.id}:view-${priorCount + 1}`,
    program_week_id: week.id,
    viewed_at: now.toISOString(),
    surface: 'semana',
    was_gated: wasGated,
    reason: wasGated ? input.reason!.trim() : null,
  });

  const grid = await buildWeekGrid(week.starts_on, addDays(week.starts_on, 6), now);

  return {
    status: 'success',
    data: {
      allowed: true,
      needs_reason: wasGated,
      opens_this_week: priorCount + 1,
      ...grid,
    },
  };
}

/** Cuántas aperturas de esta semana pasaron por la compuerta (US9-AS1): lo que
 * lib/execution/handlers.ts añade al payload del reporte semanal como "Aperturas del plan" (el
 * congelamiento real en lib/execution/tick.ts la completa por su cuenta si no la recibe, vía
 * lib/db/execution-pg.ts:insertWeeklyReportIfAbsentInDb). */
export async function countGatedPlanOpenings(programWeekId: string): Promise<number> {
  const views = await fetchPlanViewsFromDb(programWeekId);
  return views.filter((v) => v.was_gated).length;
}
