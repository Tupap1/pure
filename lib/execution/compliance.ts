// Servicio de cumplimiento (US6, get_compliance_report). Agrega, para un rango de días, la
// evaluación de cada uno (lib/domain/execution.ts:evaluateDay), los hábitos como fracción, las
// tandas (con el corte opcional de un reporte semanal) y los disparadores respondidos o sin
// responder. lib/execution/report.ts lo consume para construir el payload congelado del reporte
// semanal (US6); get_compliance_report (T055) lo expone tal cual por MCP.

import { addDays, localParts } from './time';
import { cachedSplitByLocalDay, loadObjectivesById } from './tandas';
import {
  fetchHabitsFromDb,
  fetchDailyChecksFromDb,
  fetchProgramWeeksFromDb,
  fetchRoutineSlotsFromDb,
  fetchSlotOutcomesFromDb,
  fetchTandasFromDb,
  fetchAllPlanViewsFromDb,
  HabitRecord,
  DailyCheckRecord,
  ProgramWeekRecord,
  RoutineSlotRecord,
  SlotOutcomeRecord,
  TandaRecord,
  PlanViewRecord,
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
import { tallyDay, type FocusObjectiveInput, type SplitByLocalDay } from '../domain/focus';

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

export interface AperturasPlan {
  libres_usadas: number;
  con_razon: number;
  total: number;
  razones: string[];
}

export interface RegistrosTardios {
  total: number;
  minutos: number;
}

export interface Correcciones {
  total: number;
  minutos_recortados: number;
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
  aperturas_plan: AperturasPlan;
  /** US-T2/FR-T14: tandas con late_logged=true en el rango pedido, y la suma de sus
   * actual_minutes. Siempre números explícitos, nunca null ni ausente (aunque sea { total: 0,
   * minutos: 0 }): un reporte silencioso sobre el registro tardío sería tan invisible como el
   * incidente que esta historia soluciona. */
  registros_tardios: RegistrosTardios;
  /** US-F4/FR-F23: sesiones corregidas (manage_tandas:correct) cuya corrección cayó en el rango, y
   * los minutos que recortaron (Σ original_minutes − actual_minutes). Se cuentan por la semana
   * local de `corrected_at`, no por la del inicio de la sesión. Siempre números explícitos, nunca
   * null ni ausente (ceros cuando no hubo ninguna), por la misma razón que `registros_tardios`. */
  correcciones: Correcciones;
}

export function summarizePlanOpenings(
  views: PlanViewRecord[],
  from: string,
  to: string,
  cutoff: Date
): AperturasPlan {
  const filtered = views.filter((v) => {
    if (v.surface !== 'semana') return false;
    const dateKey = localParts(new Date(v.viewed_at)).dateKey;
    if (dateKey < from || dateKey > to) return false;
    if (new Date(v.viewed_at).getTime() > cutoff.getTime()) return false;
    return true;
  });

  const libres_usadas = filtered.filter((v) => !v.was_gated).length;
  const con_razon = filtered.filter((v) => v.was_gated && v.reason).length;
  const total = filtered.length;
  const razones = filtered
    .filter((v) => v.was_gated && v.reason)
    .map((v) => v.reason as string);

  return { libres_usadas, con_razon, total, razones };
}

function evaluateOneDay(
  dateKey: string,
  weeks: ProgramWeekRecord[],
  tandas: TandaRecord[],
  habits: HabitRecord[],
  checks: DailyCheckRecord[],
  split: SplitByLocalDay,
  objetivosById: Map<string, FocusObjectiveInput>
): ComplianceDay {
  const week = weeks.find((w) => w.starts_on <= dateKey && dateKey <= addDays(w.starts_on, 6)) ?? null;
  // 004 (FR-F04, FR-F13, FR-F14a): el recuento del día sale de tallyDay sobre los TRAMOS del día,
  // no sobre `t.local_date === dateKey`: un cronómetro que cruza la medianoche aporta a cada día
  // solo sus minutos. `objetivosById` es el mapa real (FR-F13): una sesión de un objetivo sin
  // materia no suma unidades para el mínimo.
  const tally = tallyDay(dateKey, tandas, objetivosById, split);
  const checksForDate = checks.filter((c) => c.date === dateKey);
  const evaluationInput = {
    dateKey,
    minTandasDia: week ? week.min_tandas_dia : null,
    completedTandas: tally.completadas,
    completedUnits: tally.unidades,
    habits,
    checks: checksForDate.map((c) => ({ habit_id: c.habit_id, status: c.status })),
  };
  const evaluacion = evaluateDay(evaluationInput);
  const evaluacion_dia = describeDay(evaluationInput);
  return { date: dateKey, week_number: week?.week_number ?? null, evaluacion, evaluacion_dia };
}

export async function getCompliance(input: ComplianceInput): Promise<ComplianceResult> {
  const cutoff = input.cutoff ?? new Date(`${input.to}T23:59:59.999Z`);

  const [weeksRaw, habitsRaw, checksRaw, tandasRaw, slotsRaw, outcomesRaw, planViewsRaw, objetivosById] = await Promise.all([
    fetchProgramWeeksFromDb(),
    fetchHabitsFromDb(),
    fetchDailyChecksFromDb(),
    fetchTandasFromDb(),
    fetchRoutineSlotsFromDb(),
    fetchSlotOutcomesFromDb(),
    fetchAllPlanViewsFromDb(),
    loadObjectivesById(),
  ]);

  const weeks = (Array.isArray(weeksRaw) ? weeksRaw : []) as ProgramWeekRecord[];
  const habits = (Array.isArray(habitsRaw) ? habitsRaw : []) as HabitRecord[];
  const allChecks = (Array.isArray(checksRaw) ? checksRaw : []) as DailyCheckRecord[];
  const allTandas = (Array.isArray(tandasRaw) ? tandasRaw : []) as TandaRecord[];
  const tandasBeforeCutoff = allTandas.filter((t) => isTandaBeforeCutoff(t.started_at, cutoff));
  const slots = (Array.isArray(slotsRaw) ? slotsRaw : []) as RoutineSlotRecord[];
  const outcomes = (Array.isArray(outcomesRaw) ? outcomesRaw : []) as SlotOutcomeRecord[];
  const planViews = (Array.isArray(planViewsRaw) ? planViewsRaw : []) as PlanViewRecord[];

  // Un solo recorrido, desde el inicio del programa (o desde `from` si no hay programa) hasta
  // `to`: `dias_cumplidos_totales` es el acumulado de TODO el programa (FR-022), no solo del
  // rango pedido, así que hace falta evaluar también los días anteriores a `from`.
  const programStart = weeks[0]?.starts_on;
  const loopStart = programStart && programStart < input.from ? programStart : input.from;

  const allDays: ComplianceDay[] = [];
  const MAX_DAYS = 400; // salvaguarda: un programa de 10 semanas nunca se acerca a este límite
  const split = cachedSplitByLocalDay(); // un reparto por cronómetro, no uno por (día × cronómetro)
  let cursor = loopStart;
  while (cursor <= input.to && allDays.length < MAX_DAYS) {
    allDays.push(evaluateOneDay(cursor, weeks, tandasBeforeCutoff, habits, allChecks, split, objetivosById));
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

  // US-T2/FR-T14: sobre el mismo rango ya filtrado por cutoff y fecha (tandasInRange), nunca
  // ausente ni null -- { total: 0, minutos: 0 } cuando no hubo ningún registro tardío.
  const registrosTardiosEnRango = tandasInRange.filter((t) => t.late_logged);
  const registros_tardios: RegistrosTardios = {
    total: registrosTardiosEnRango.length,
    minutos: registrosTardiosEnRango.reduce((sum, t) => sum + (t.actual_minutes ?? 0), 0),
  };

  // US-F4/FR-F23: el criterio es la fecha local de la CORRECCIÓN (`corrected_at`), no la del inicio
  // de la sesión: una sesión del domingo corregida el lunes cuenta en la semana del lunes. Por eso
  // parte de todas las tandas y no de `tandasInRange`. Frente al `cutoff` del reporte congelado
  // cuenta solo lo corregido a más tardar en el corte (`corrected_at <= cutoff`): el reporte
  // congelado es una foto al domingo 19:00 y no se reescribe (spec.md, casos borde); una corrección
  // posterior aparece en el get_compliance_report de esa semana (cuyo corte es `now`) y en el
  // resumen de foco. Una sesión corregida a más tardar en el corte también empezó antes de él, así
  // que este filtro nunca incluye una tanda que `tandasBeforeCutoff` excluiría.
  const correccionesEnRango = allTandas.filter((t) => {
    if (!t.corrected || !t.corrected_at) return false;
    const correctedAt = new Date(t.corrected_at);
    if (correctedAt.getTime() > cutoff.getTime()) return false;
    const dateKey = localParts(correctedAt).dateKey;
    return dateKey >= input.from && dateKey <= input.to;
  });
  const correcciones: Correcciones = {
    total: correccionesEnRango.length,
    // Una corrección solo acorta, así que cada resta es >= 0; el Math.max protege la suma de una
    // fila inconsistente (p. ej. editada a mano) en vez de dejar que reste minutos al total.
    minutos_recortados: correccionesEnRango.reduce(
      (sum, t) => sum + Math.max(0, (t.original_minutes ?? 0) - (t.actual_minutes ?? 0)),
      0
    ),
  };

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
  const aperturas_plan = summarizePlanOpenings(planViews, input.from, input.to, cutoff);

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
    aperturas_plan,
    registros_tardios,
    correcciones,
  };
}
