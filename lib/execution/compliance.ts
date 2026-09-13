// Servicio de cumplimiento (US6, get_compliance_report). Agrega, para un rango de días, la
// evaluación de cada uno (lib/domain/execution.ts:evaluateDay), los hábitos como fracción, las
// tandas (con el corte opcional de un reporte semanal) y los disparadores respondidos o sin
// responder. lib/execution/report.ts lo consume para construir el payload congelado del reporte
// semanal (US6); get_compliance_report (T055) lo expone tal cual por MCP.

import { addDays } from './time';
import {
  fetchHabitsFromDb,
  fetchDailyChecksFromDb,
  fetchProgramWeeksFromDb,
  fetchRoutineSlotsFromDb,
  fetchSlotOutcomesFromDb,
  fetchTandasFromDb,
  HabitRecord,
  DailyCheckRecord,
  ProgramWeekRecord,
  RoutineSlotRecord,
  SlotOutcomeRecord,
  TandaRecord,
} from '../db/execution-pg';
import {
  isHabitActive,
  evaluateDay,
  describeDay,
  isTandaBeforeCutoff,
  isoDayOfWeekForDateKey,
  DayEvaluation,
  DayBreakdown,
} from '../domain/execution';

export interface ComplianceInput {
  /** YYYY-MM-DD, inicio del rango que se quiere reportar (p. ej. el lunes de la semana). */
  from: string;
  /** YYYY-MM-DD, fin del rango (p. ej. el domingo de la semana). */
  to: string;
  /** Instante de corte para las tandas (US6: el domingo 19:00 ya congelado). Sin corte, usa `to`
   * completo (fin del día, aproximado con `to 23:59` local) — get_compliance_report fuera del
   * contexto de un reporte semanal no necesita cortar nada. */
  cutoff?: Date;
}

export interface ComplianceDay {
  date: string;
  week_number: number | null;
  evaluacion: DayEvaluation | null;
  evaluacion_dia: DayBreakdown | null;
}

export interface ComplianceHabit {
  id: string;
  label: string;
  cumplidos: number;
  total: number;
}

export interface ComplianceSubjectTandas {
  subject_id: string | null;
  count: number;
  minutes: number;
}

export interface ComplianceResult {
  dias: ComplianceDay[];
  days_fulfilled: number;
  habitos: ComplianceHabit[];
  tandas: { completadas: number; interrumpidas: number; por_materia: ComplianceSubjectTandas[] };
  disparadores: { hecho: number; no: number; sin_respuesta: number };
  razones_interrupcion: string[];
  ediciones_tardias: number;
  dias_cumplidos_totales: number;
  horizonte: number;
}

function evaluateOneDay(
  dateKey: string,
  weeks: ProgramWeekRecord[],
  tandas: TandaRecord[],
  habits: HabitRecord[],
  checks: DailyCheckRecord[]
): ComplianceDay {
  const week = weeks.find((w) => w.starts_on <= dateKey && dateKey <= addDays(w.starts_on, 6)) ?? null;
  const completedThatDay = tandas.filter((t) => t.local_date === dateKey && t.status === 'completada').length;
  const checksForDate = checks.filter((c) => c.date === dateKey);
  const evaluationInput = {
    dateKey,
    minTandasDia: week ? week.min_tandas_dia : null,
    completedTandas: completedThatDay,
    habits,
    checks: checksForDate.map((c) => ({ habit_id: c.habit_id, status: c.status })),
  };
  const evaluacion = evaluateDay(evaluationInput);
  const evaluacion_dia = describeDay(evaluationInput);
  return { date: dateKey, week_number: week?.week_number ?? null, evaluacion, evaluacion_dia };
}

export async function getCompliance(input: ComplianceInput): Promise<ComplianceResult> {
  const cutoff = input.cutoff ?? new Date(`${input.to}T23:59:59.999Z`);

  const [weeksRaw, habitsRaw, checksRaw, tandasRaw, slotsRaw, outcomesRaw] = await Promise.all([
    fetchProgramWeeksFromDb(),
    fetchHabitsFromDb(),
    fetchDailyChecksFromDb(),
    fetchTandasFromDb(),
    fetchRoutineSlotsFromDb(),
    fetchSlotOutcomesFromDb(),
  ]);

  const weeks = (Array.isArray(weeksRaw) ? weeksRaw : []) as ProgramWeekRecord[];
  const habits = (Array.isArray(habitsRaw) ? habitsRaw : []) as HabitRecord[];
  const allChecks = (Array.isArray(checksRaw) ? checksRaw : []) as DailyCheckRecord[];
  const tandasBeforeCutoff = ((Array.isArray(tandasRaw) ? tandasRaw : []) as TandaRecord[]).filter((t) =>
    isTandaBeforeCutoff(t.started_at, cutoff)
  );
  const slots = (Array.isArray(slotsRaw) ? slotsRaw : []) as RoutineSlotRecord[];
  const outcomes = (Array.isArray(outcomesRaw) ? outcomesRaw : []) as SlotOutcomeRecord[];

  // Un solo recorrido, desde el inicio del programa (o desde `from` si no hay programa) hasta
  // `to`: `dias_cumplidos_totales` es el acumulado de TODO el programa (FR-022), no solo del
  // rango pedido, así que hace falta evaluar también los días anteriores a `from`.
  const programStart = weeks[0]?.starts_on;
  const loopStart = programStart && programStart < input.from ? programStart : input.from;

  const allDays: ComplianceDay[] = [];
  const MAX_DAYS = 400; // salvaguarda: un programa de 10 semanas nunca se acerca a este límite
  let cursor = loopStart;
  while (cursor <= input.to && allDays.length < MAX_DAYS) {
    allDays.push(evaluateOneDay(cursor, weeks, tandasBeforeCutoff, habits, allChecks));
    cursor = addDays(cursor, 1);
  }

  const dias = allDays.filter((d) => d.date >= input.from);
  const days_fulfilled = dias.filter((d) => d.evaluacion?.fulfilled).length;
  const dias_cumplidos_totales = allDays.filter((d) => d.evaluacion?.fulfilled).length;

  const habitos: ComplianceHabit[] = habits
    .map((h) => {
      const activeDays = dias.filter((d) => isHabitActive(h, d.date));
      const cumplidos = activeDays.filter((d) => {
        const check = allChecks.find((c) => c.date === d.date && c.habit_id === h.id);
        return check?.status === 'cumplido' || check?.status === 'na';
      }).length;
      return { id: h.id, label: h.label, cumplidos, total: activeDays.length };
    })
    .filter((h) => h.total > 0);

  const tandasInRange = tandasBeforeCutoff.filter((t) => t.local_date >= input.from && t.local_date <= input.to);
  const completadas = tandasInRange.filter((t) => t.status === 'completada').length;
  const interrumpidas = tandasInRange.filter((t) => t.status === 'interrumpida').length;

  const porMateriaMap = new Map<string, ComplianceSubjectTandas>();
  for (const t of tandasInRange) {
    const key = t.subject_id ?? 'sin-materia';
    const bucket = porMateriaMap.get(key) ?? { subject_id: t.subject_id ?? null, count: 0, minutes: 0 };
    bucket.count += 1;
    bucket.minutes += t.actual_minutes ?? 0;
    porMateriaMap.set(key, bucket);
  }

  const razones_interrupcion = tandasInRange
    .filter((t) => t.status === 'interrumpida' && t.interrupt_reason)
    .map((t) => t.interrupt_reason as string);

  const ediciones_tardias = tandasInRange.filter((t) => t.edited_after_lock).length;

  const outcomesInRange = outcomes.filter((o) => o.date >= input.from && o.date <= input.to);
  const hecho = outcomesInRange.filter((o) => o.outcome === 'hecho').length;
  const no = outcomesInRange.filter((o) => o.outcome === 'no').length;

  // Aproximación simple de "sin respuesta": un disparador activo ese día de la semana sin
  // outcome ese día — no reconstruye la ventana retroactiva de 4h de resolveCurrentTrigger.
  let sinRespuesta = 0;
  for (const dia of dias) {
    const dow = isoDayOfWeekForDateKey(dia.date);
    for (const slot of slots) {
      if (slot.is_active === false) continue;
      if (!slot.days_of_week.includes(dow)) continue;
      const hasOutcome = outcomesInRange.some((o) => o.date === dia.date && o.routine_slot_id === slot.id);
      if (!hasOutcome) sinRespuesta++;
    }
  }

  const horizonte = habits.length > 0 ? Math.max(...habits.map((h) => h.target_days ?? 66)) : 66;

  return {
    dias,
    days_fulfilled,
    habitos,
    tandas: { completadas, interrumpidas, por_materia: Array.from(porMateriaMap.values()) },
    disparadores: { hecho, no, sin_respuesta: sinRespuesta },
    razones_interrupcion,
    ediciones_tardias,
    dias_cumplidos_totales,
    horizonte,
  };
}
