// Dominio puro del Módulo de Ejecución (Constitución, Principio III: la zona horaria, las reglas
// de negocio y los agregados viven en TypeScript, nunca en SQL). Estas funciones no tocan la
// base de datos: los servicios de lib/execution/* cargan los datos y les delegan la decisión.
//
// resolveCurrentTrigger (US2, FR-009..FR-011): decide cuál es el único disparador si-entonces
// vigente ahora mismo, si lo hay. isHabitActive y evaluateDay (US3, FR-014..FR-016): si un hábito
// aplica un día dado y si ese día queda cumplido, sin arrastrar deuda entre días.

import { localParts, localDateTimeToInstant } from '../execution/time';
import { occursOnSabadoVariant, getSabadoTypeForDate, DEFAULT_SABADO_A_ANCHOR } from '../algorithms/conflict-detector';
import { TRIGGER_WINDOW_MINUTES } from '../execution/constants';

// --- US2: resolveCurrentTrigger -------------------------------------------------------------

export type RoutineCueKind = 'hora' | 'tras_clase' | 'tras_habito' | 'lugar';
export type RoutineKind = 'estudio' | 'habito' | 'otro';
export type RoutinePeriodicity = 'semanal' | 'sabado_a' | 'sabado_b';

export interface TriggerSlotInput {
  id: string;
  is_active?: boolean | null;
  days_of_week: number[];
  cue_kind: RoutineCueKind;
  cue_text: string;
  action_text: string;
  /** HH:MM local. Obligatorio salvo en cue_kind='tras_clase', donde se ignora a favor del
   * end_time del horario referenciado por schedule_id. */
  anchor_time?: string | null;
  schedule_id?: string | null;
  subject_id?: string | null;
  habit_id?: string | null;
  kind: RoutineKind;
  periodicity?: RoutinePeriodicity | null;
}

export interface TriggerScheduleInput {
  id: string;
  end_time: string;
  subject_id?: string | null;
}

export interface TriggerSubjectInput {
  id: string;
  university_id?: string | null;
}

export interface TriggerUniversityInput {
  id: string;
  has_alternating_saturdays?: boolean | null;
  first_sabado_a_date?: string | null;
}

export interface ResolveCurrentTriggerInput {
  now: Date;
  slots: TriggerSlotInput[];
  schedules?: TriggerScheduleInput[];
  subjects?: TriggerSubjectInput[];
  universities?: TriggerUniversityInput[];
  /** IDs de routine_slots que ya tienen una respuesta registrada hoy (slot_outcomes). */
  respondedTodaySlotIds?: string[];
}

export interface CurrentTrigger {
  id: string;
  cue_text: string;
  action_text: string;
  cue_kind: RoutineCueKind;
  kind: RoutineKind;
  subject_id: string | null;
  habit_id: string | null;
}

/**
 * Ancla de alternancia de sábados a usar para un disparador: la de la universidad de su materia;
 * si no hay materia, o su universidad no tiene ancla propia, la primera universidad con
 * alternancia activa; en último caso, DEFAULT_SABADO_A_ANCHOR (plan.md, "US2 · Disparadores").
 */
function resolveSabadoAnchorDate(
  subjectId: string | null | undefined,
  subjects: TriggerSubjectInput[],
  universities: TriggerUniversityInput[]
): string {
  const subject = subjectId ? subjects.find((s) => s.id === subjectId) : undefined;
  const university = subject?.university_id
    ? universities.find((u) => u.id === subject.university_id)
    : undefined;
  if (university && university.has_alternating_saturdays !== false && university.first_sabado_a_date) {
    return university.first_sabado_a_date;
  }

  const withAlternation = universities.find((u) => u.has_alternating_saturdays !== false && u.first_sabado_a_date);
  if (withAlternation?.first_sabado_a_date) return withAlternation.first_sabado_a_date;

  return DEFAULT_SABADO_A_ANCHOR;
}

/**
 * Decide el único disparador vigente ahora mismo (FR-011): entre los candidatos elegibles
 * (activos, del día de la semana local, con la paridad de sábado correcta, cuya ancla ya pasó
 * pero no hace más de TRIGGER_WINDOW_MINUTES, y sin respuesta hoy), gana el de ancla más
 * reciente. Si no hay ninguno, devuelve null — nunca una lista (US2-AS1..AS5, AS10).
 */
export function resolveCurrentTrigger(input: ResolveCurrentTriggerInput): CurrentTrigger | null {
  const { now, slots, schedules = [], subjects = [], universities = [], respondedTodaySlotIds = [] } = input;
  const local = localParts(now);
  const responded = new Set(respondedTodaySlotIds);

  let best: { slot: TriggerSlotInput; anchorMs: number } | null = null;

  for (const slot of slots) {
    if (slot.is_active === false) continue;
    if (!slot.days_of_week.includes(local.dayOfWeek)) continue;
    if (responded.has(slot.id)) continue; // US2-AS3: ya respondido hoy

    let anchorHHMM: string | null | undefined = slot.anchor_time;
    let scheduleForSlot: TriggerScheduleInput | undefined;

    if (slot.cue_kind === 'tras_clase') {
      scheduleForSlot = slot.schedule_id ? schedules.find((s) => s.id === slot.schedule_id) : undefined;
      if (!scheduleForSlot) continue; // huérfano: sin horario no hay ancla que evaluar
      anchorHHMM = scheduleForSlot.end_time; // FR-010: el ancla de un tras_clase es el fin de la clase
    }
    if (!anchorHHMM) continue; // dato inconsistente (no debería pasar el Zod estricto de create/update)

    const anchorSubjectId = slot.subject_id ?? scheduleForSlot?.subject_id ?? null;
    const sabadoAnchor = resolveSabadoAnchorDate(anchorSubjectId, subjects, universities);
    const variant = getSabadoTypeForDate(new Date(`${local.dateKey}T12:00:00Z`), sabadoAnchor);
    if (!occursOnSabadoVariant({ periodicity: slot.periodicity ?? 'semanal' }, variant)) continue; // US2-AS5

    const anchorMs = localDateTimeToInstant(local.dateKey, anchorHHMM).getTime();
    if (anchorMs > now.getTime()) continue; // US2-AS2: todavía no llega
    if (now.getTime() - anchorMs > TRIGGER_WINDOW_MINUTES * 60_000) continue; // US2-AS10

    if (!best || anchorMs > best.anchorMs) {
      best = { slot, anchorMs };
    }
  }

  if (!best) return null;
  const { slot } = best;
  return {
    id: slot.id,
    cue_text: slot.cue_text,
    action_text: slot.action_text,
    cue_kind: slot.cue_kind,
    kind: slot.kind,
    subject_id: slot.subject_id ?? null,
    habit_id: slot.habit_id ?? null,
  };
}

// --- US3: isHabitActive / evaluateDay -------------------------------------------------------

export interface HabitActiveInput {
  started_on: string;
  retired_on?: string | null;
  days_of_week?: number[] | null;
}

/** Día de la semana ISO (1=lunes..7=domingo) de una fecha de calendario, sin zona horaria: una
 * 'YYYY-MM-DD' ya es un día local, así que esto es aritmética de calendario pura (mismo patrón
 * que lib/execution/time.ts:mondayOf). */
function isoDayOfWeekForDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const sundayIsZero = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return sundayIsZero === 0 ? 7 : sundayIsZero;
}

/**
 * Un hábito está activo en `dateKey` solo entre su started_on y su retired_on (FR-014), y solo en
 * los días de la semana configurados (null/vacío = todos los días). data-model.md, "Hábito
 * activo": started_on <= d, retired_on nulo o d < retired_on, days_of_week nulo o incluye el día.
 */
export function isHabitActive(habit: HabitActiveInput, dateKey: string): boolean {
  if (habit.started_on > dateKey) return false; // US3-AS6: todavía no empieza
  if (habit.retired_on && dateKey >= habit.retired_on) return false;
  if (habit.days_of_week && habit.days_of_week.length > 0) {
    if (!habit.days_of_week.includes(isoDayOfWeekForDateKey(dateKey))) return false;
  }
  return true;
}

export interface HabitForEvaluation {
  id: string;
  started_on: string;
  retired_on?: string | null;
  days_of_week?: number[] | null;
}

export interface DailyCheckForEvaluation {
  habit_id: string;
  status: string;
}

export interface EvaluateDayInput {
  dateKey: string;
  /** Mínimo de tandas de la semana del programa que contiene `dateKey`; null si ese día cae
   * fuera del programa (evaluateDay devuelve null en ese caso). */
  minTandasDia: number | null | undefined;
  /** Tandas con status='completada' ese día (US3-AS1: "tandas completadas", no en curso ni
   * interrumpidas). */
  completedTandas: number;
  /** Todos los hábitos del sistema; isHabitActive decide cuáles aplican ese día. */
  habits: HabitForEvaluation[];
  /** Los checks registrados ese día (cualquier fecha ajena a dateKey se ignora si el llamador
   * ya filtró; esta función no vuelve a filtrar por fecha). */
  checks: DailyCheckForEvaluation[];
}

export interface DayEvaluation {
  tandasOk: boolean;
  habitsOk: boolean;
  fulfilled: boolean;
}

/**
 * FR-015/FR-016: un día queda cumplido si las tandas completadas alcanzan el mínimo de su semana
 * y todo hábito activo ese día quedó 'cumplido' o 'na' (un hábito sin registro cuenta como no
 * cumplido). Sin acumular deuda: cada llamada evalúa un solo día con su propio mínimo y sus
 * propios registros (US3-AS4). Devuelve null si el día cae fuera del programa (US3-AS-fuera).
 */
export function evaluateDay(input: EvaluateDayInput): DayEvaluation | null {
  if (input.minTandasDia == null) return null;

  const activeHabits = input.habits.filter((h) => isHabitActive(h, input.dateKey));
  const statusByHabit = new Map(input.checks.map((c) => [c.habit_id, c.status]));

  const tandasOk = input.completedTandas >= input.minTandasDia;
  const habitsOk = activeHabits.every((h) => {
    const status = statusByHabit.get(h.id);
    return status === 'cumplido' || status === 'na';
  });

  return { tandasOk, habitsOk, fulfilled: tandasOk && habitsOk };
}
