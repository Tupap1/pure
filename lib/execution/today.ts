// Servicio de Hoy (US1-US3). getToday agrega el estado del día para una sola pantalla: la hora
// del servidor, la semana del programa, la tanda en curso, cuántas tandas van hoy y el disparador
// vigente (US2). Los checks pendientes y el día cumplido (US3) todavía no tienen servicio
// propio en esta fase, así que se exponen con su forma final pero en su valor neutro (null / [])
// para que el contrato de get_today (contracts/mcp-tools.md) no cambie de forma cuando esa
// historia llegue — solo dejan de estar vacíos.

import { localParts } from './time';
import { readProgram } from './program';
import { currentTanda, readTandas } from './tandas';
import { resolveTodayTrigger } from './routine';
import { CurrentTrigger } from '../domain/execution';
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

  const readRes = await readTandas({ from: dateKey, to: dateKey }, now);
  const tandasToday = readRes.status === 'success' ? readRes.data!.tandas.length : 0;

  const trigger = await resolveTodayTrigger(now);

  return {
    status: 'success',
    data: {
      server_now: now.toISOString(),
      date: dateKey,
      week,
      running_tanda,
      trigger,
      pending_checks: [],
      tandas_today: tandasToday,
      day_fulfilled: null,
    },
  };
}
