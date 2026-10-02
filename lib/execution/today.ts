// Servicio de Hoy (US1-US3). getToday agrega el estado del día para una sola pantalla: la hora
// del servidor, la semana del programa, la tanda en curso, cuántas tandas van hoy, el disparador
// vigente (US2) y los checks pendientes junto con si el día quedó cumplido (US3).

import { localParts, addDays, mondayOf } from './time';
import { TODAY_HEATMAP_WEEKS } from './constants';
import { readProgram } from './program';
import { currentTanda, readTandas, cachedSplitByLocalDay, loadObjectivesById } from './tandas';
import { resolveTodayTrigger } from './routine';
import { focusDays, sumFocusMinutes, type FocusDay } from './focus';
import { fetchHabitsFromDb, fetchDailyChecksFromDb, HabitRecord, DailyCheckRecord } from '../db/execution-pg';
import { isHabitActive, evaluateDay, describeDay, CurrentTrigger, DayBreakdown } from '../domain/execution';
import { tallyDay } from '../domain/focus';
import type { ExecutionResult } from '../validations/schemas';

export interface TodayRunningTanda {
  id: string;
  subject_id: string | null;
  /** 004: tipo de sesión; el cronómetro no tiene fin previsto. */
  kind: 'temporizador' | 'cronometro';
  /** 004: objetivo ligado a la sesión (US-F2). */
  objective_id: string | null;
  started_at: string;
  /** Fin previsto del temporizador; null en el cronómetro. */
  ends_at: string | null;
  /** Cuenta atrás del temporizador; null en el cronómetro. */
  seconds_left: number | null;
  /** Segundos transcurridos del cronómetro (hacia arriba); null en el temporizador. */
  elapsed_seconds: number | null;
}

export interface TodayPendingCheck {
  habit_id: string;
  label: string;
}

export interface TodayPayload {
  server_now: string;
  date: string;
  week: { number: number; total: number; phase: string } | null;
  running_tanda: TodayRunningTanda | null;
  trigger: CurrentTrigger | null;
  pending_checks: TodayPendingCheck[];
  tandas_today: number;
  unidades_hoy: number;
  day_fulfilled: boolean | null;
  evaluacion_dia: DayBreakdown | null;
  /** 004 (US-F3, FR-F18): minutos enfocados de la semana actual, de lunes a hoy. */
  foco_semana_minutos: number;
  /** 004 (US-F3, FR-F18): días del mapa de las últimas 12 semanas (del lunes de hace 11 semanas a
   * hoy; menos de 84 si la semana en curso no terminó), con el mismo nivel que `get_focus_summary`. */
  foco_12_semanas: FocusDay[];
}

export async function getToday(now: Date = new Date()): Promise<ExecutionResult<TodayPayload>> {
  const dateKey = localParts(now).dateKey;

  const programRes = await readProgram(now);
  const weeks = programRes.status === 'success' ? ((programRes.data as any).weeks as any[]) : [];
  const currentWeek = programRes.status === 'success' ? (programRes.data as any).current_week : null;
  const week = currentWeek
    ? { number: currentWeek.week_number, total: weeks.length, phase: currentWeek.phase }
    : null;

  const currentRes = await currentTanda(now);
  const runningRaw = currentRes.status === 'success' ? currentRes.data!.tanda : null;
  const secondsLeft = currentRes.status === 'success' ? currentRes.data!.seconds_left : null;
  const elapsedSeconds = currentRes.status === 'success' ? currentRes.data!.elapsed_seconds : null;
  const running_tanda: TodayRunningTanda | null = runningRaw
    ? {
        id: runningRaw.id,
        subject_id: runningRaw.subject_id ?? null,
        kind: runningRaw.kind,
        objective_id: runningRaw.objective_id ?? null,
        started_at: new Date(runningRaw.started_at).toISOString(),
        // El cronómetro no tiene duración planeada ni fin previsto: ends_at y seconds_left son null.
        ends_at:
          runningRaw.kind !== 'cronometro' && runningRaw.planned_minutes !== null
            ? new Date(
                new Date(runningRaw.started_at).getTime() + (runningRaw.planned_minutes as number) * 60_000
              ).toISOString()
            : null,
        seconds_left: secondsLeft,
        elapsed_seconds: elapsedSeconds,
      }
    : null;

  // FR-018 ("tandas hechas hoy") y evaluateDay coinciden en qué cuenta como "hecha": solo
  // status='completada'. Una tanda interrumpida o todavía en curso no se acredita como estudiada
  // (auditoría US2/US3): antes, tandas_today contaba las tres, así que el pie podía decir "1
  // tanda hoy" apenas se tocaba "Empezar tanda", sin haber estudiado un minuto.
  //
  // 004 (FR-F04, FR-F13, FR-F14a): completadas y unidades salen de tallyDay, la única regla de
  // unidades del sistema; con él un cronómetro que cruza la medianoche solo aporta a hoy los
  // minutos del tramo de hoy. Con el mapa real de objetivos (FR-F13, I1), una sesión de un objetivo
  // sin materia no cuenta en `tandas_today` ni en las unidades del mínimo.
  //
  // 004 (US-F3): una sola lectura de las sesiones de las últimas 12 semanas sirve para el recuento
  // de hoy (tallyDay solo mira los tramos de `dateKey`) y para el mapa (`focusDays`, la misma
  // agregación de get_focus_summary, sin repetirla aquí).
  const heatmapFrom = addDays(mondayOf(dateKey), -(TODAY_HEATMAP_WEEKS - 1) * 7);
  const readRes = await readTandas({ from: heatmapFrom, to: dateKey }, now);
  const windowTandas = readRes.status === 'success' ? readRes.data!.tandas : [];
  const objetivosById = await loadObjectivesById();
  const split = cachedSplitByLocalDay();
  const tally = tallyDay(dateKey, windowTandas, objetivosById, split);
  const completedToday = tally.completadas;
  // FR-T05: unidades de hoy, ahora según el tipo de sesión (FR-F04).
  const completedUnitsToday = tally.unidades;
  const foco_12_semanas = focusDays(windowTandas, objetivosById, heatmapFrom, dateKey, {}, split);
  const foco_semana_minutos = sumFocusMinutes(foco_12_semanas, mondayOf(dateKey));

  const trigger = await resolveTodayTrigger(now);

  const habitsRaw = await fetchHabitsFromDb();
  const habits = (Array.isArray(habitsRaw) ? habitsRaw : []) as HabitRecord[];
  const checksRaw = await fetchDailyChecksFromDb();
  const checksToday = ((Array.isArray(checksRaw) ? checksRaw : []) as DailyCheckRecord[]).filter(
    (c) => c.date === dateKey
  );

  const respondedHabitIds = new Set(checksToday.map((c) => c.habit_id));
  const pending_checks: TodayPendingCheck[] = habits
    .filter((h) => isHabitActive(h, dateKey) && !respondedHabitIds.has(h.id))
    .map((h) => ({ habit_id: h.id, label: h.label }));

  const evaluationInput = {
    dateKey,
    minTandasDia: currentWeek ? currentWeek.min_tandas_dia : null,
    completedTandas: completedToday,
    completedUnits: completedUnitsToday,
    habits,
    checks: checksToday.map((c) => ({ habit_id: c.habit_id, status: c.status })),
  };

  const evaluation = evaluateDay(evaluationInput);
  const evaluacion_dia = describeDay(evaluationInput);

  return {
    status: 'success',
    data: {
      server_now: now.toISOString(),
      date: dateKey,
      week,
      running_tanda,
      trigger,
      pending_checks,
      tandas_today: completedToday,
      unidades_hoy: completedUnitsToday,
      day_fulfilled: evaluation ? evaluation.fulfilled : null,
      evaluacion_dia,
      foco_semana_minutos,
      foco_12_semanas,
    },
  };
}
