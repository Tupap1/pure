// Servicio de Hoy (US1-US3). getToday agrega el estado del día para una sola pantalla: la hora
// del servidor, la semana del programa, la tanda en curso, cuántas tandas van hoy, el disparador
// vigente (US2) y los checks pendientes junto con si el día quedó cumplido (US3).

import { localParts } from './time';
import { readProgram } from './program';
import { currentTanda, readTandas } from './tandas';
import { resolveTodayTrigger } from './routine';
import { fetchHabitsFromDb, fetchDailyChecksFromDb, HabitRecord, DailyCheckRecord } from '../db/execution-pg';
import { isHabitActive, evaluateDay, describeDay, CurrentTrigger, DayBreakdown } from '../domain/execution';
import type { ExecutionResult } from '../validations/schemas';

export interface TodayRunningTanda {
  id: string;
  subject_id: string | null;
  started_at: string;
  ends_at: string;
  seconds_left: number;
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
  day_fulfilled: boolean | null;
  evaluacion_dia: DayBreakdown | null;
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
  const running_tanda: TodayRunningTanda | null = runningRaw
    ? {
        id: runningRaw.id,
        subject_id: runningRaw.subject_id ?? null,
        started_at: new Date(runningRaw.started_at).toISOString(),
        ends_at: new Date(
          new Date(runningRaw.started_at).getTime() + runningRaw.planned_minutes * 60_000
        ).toISOString(),
        seconds_left: secondsLeft ?? 0,
      }
    : null;

  // FR-018 ("tandas hechas hoy") y evaluateDay coinciden en qué cuenta como "hecha": solo
  // status='completada'. Una tanda interrumpida o todavía en curso no se acredita como estudiada
  // (auditoría US2/US3): antes, tandas_today contaba las tres, así que el pie podía decir "1
  // tanda hoy" apenas se tocaba "Empezar tanda", sin haber estudiado un minuto.
  const readRes = await readTandas({ from: dateKey, to: dateKey }, now);
  const completedToday =
    readRes.status === 'success' ? readRes.data!.tandas.filter((t) => t.status === 'completada').length : 0;

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
      day_fulfilled: evaluation ? evaluation.fulfilled : null,
      evaluacion_dia,
    },
  };
}
