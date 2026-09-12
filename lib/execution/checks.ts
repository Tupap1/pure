// Servicio de hábitos del día (US3 — Hábitos del día y día cumplido). Handler único consumido
// por manage_daily_checks (MCP) y, a través suyo, por app/api/execution/route.ts (Principio I).
// La decisión de si un día queda cumplido es dominio puro (lib/domain/execution.ts:evaluateDay);
// este archivo carga los datos (hábitos, checks, tandas por día, semanas del programa) y aplica
// las reglas que sí necesitan la base (fecha futura, día cerrado, hábito inactivo).

import { localParts, addDays, localDateTimeToInstant } from './time';
import { DAY_LOCK_TIME } from './constants';
import type { ExecutionResult } from '../validations/schemas';
import {
  fetchHabitsFromDb,
  HabitRecord,
  fetchDailyChecksFromDb,
  saveDailyCheckToDb,
  DailyCheckRecord,
  fetchProgramWeeksFromDb,
  ProgramWeekRecord,
} from '../db/execution-pg';
import { isHabitActive, evaluateDay } from '../domain/execution';
import { readTandas } from './tandas';

export interface DailyCheckSetInput {
  habit_id: string;
  status: 'cumplido' | 'fallado' | 'na';
  date?: string;
  value?: number;
  note?: string;
}

/** El mismo cierre que las tandas (DAY_LOCK_TIME, 03:00 del día siguiente a `date`). */
function dayClosesAt(date: string): Date {
  return localDateTimeToInstant(addDays(date, 1), DAY_LOCK_TIME);
}

/**
 * FR-015/US3-AS5: un check es válido hasta las 03:00 del día siguiente a `date`. Rechaza una
 * fecha futura (FECHA_FUTURA) y un hábito que no está activo ese día (HABITO_INACTIVO). Upsert
 * idempotente por `${date}:${habit_id}` (data-model.md).
 */
export async function setDailyCheck(
  input: DailyCheckSetInput,
  now: Date = new Date()
): Promise<ExecutionResult<DailyCheckRecord>> {
  const todayKey = localParts(now).dateKey;
  const date = input.date ?? todayKey;

  if (date > todayKey) {
    return {
      status: 'error',
      code: 'FECHA_FUTURA',
      message: `${date} todavía no llega: no se puede registrar un hábito por adelantado.`,
    };
  }

  if (now.getTime() >= dayClosesAt(date).getTime()) {
    return {
      status: 'error',
      code: 'DIA_CERRADO',
      message: `El día ${date} ya cerró: se acepta hasta las ${DAY_LOCK_TIME} del día siguiente.`,
    };
  }

  const habitRaw = await fetchHabitsFromDb(input.habit_id);
  const habit = habitRaw as HabitRecord | null;
  if (!habit || !isHabitActive(habit, date)) {
    return {
      status: 'error',
      code: 'HABITO_INACTIVO',
      message: `El hábito ${input.habit_id} no está activo el ${date}.`,
    };
  }

  const saved = await saveDailyCheckToDb({
    id: `${date}:${input.habit_id}`,
    date,
    habit_id: input.habit_id,
    status: input.status,
    value: input.value,
    note: input.note,
  });

  return { status: 'success', data: saved };
}

export interface DailyChecksReadInput {
  from?: string;
  to?: string;
}

/**
 * `{ dias: [{ date, week_number, checks[], evaluacion }] }` (contracts/mcp-tools.md). Sin rango
 * explícito, cubre desde el inicio del programa (o hoy, si no hay programa) hasta hoy.
 */
export async function readDailyChecks(
  input: DailyChecksReadInput,
  now: Date = new Date()
): Promise<ExecutionResult> {
  const todayKey = localParts(now).dateKey;

  const weeksRaw = await fetchProgramWeeksFromDb();
  const weeks = (Array.isArray(weeksRaw) ? weeksRaw : []) as ProgramWeekRecord[];
  const habitsRaw = await fetchHabitsFromDb();
  const habits = (Array.isArray(habitsRaw) ? habitsRaw : []) as HabitRecord[];
  const checksRaw = await fetchDailyChecksFromDb();
  const allChecks = (Array.isArray(checksRaw) ? checksRaw : []) as DailyCheckRecord[];

  const from = input.from ?? weeks[0]?.starts_on ?? todayKey;
  const to = input.to ?? todayKey;

  const tandasRes = await readTandas({ from, to }, now);
  const porDia = tandasRes.status === 'success' ? tandasRes.data!.por_dia : [];
  const completedByDate = new Map(porDia.map((d) => [d.date, d.completadas]));

  const dias: {
    date: string;
    week_number: number | null;
    checks: DailyCheckRecord[];
    evaluacion: ReturnType<typeof evaluateDay>;
  }[] = [];

  const MAX_DAYS = 400; // salvaguarda: un programa de 10 semanas nunca se acerca a este límite
  let cursor = from;
  while (cursor <= to && dias.length < MAX_DAYS) {
    const week = weeks.find((w) => w.starts_on <= cursor && cursor <= addDays(w.starts_on, 6)) ?? null;
    const checksForDate = allChecks.filter((c) => c.date === cursor);
    const evaluacion = evaluateDay({
      dateKey: cursor,
      minTandasDia: week ? week.min_tandas_dia : null,
      completedTandas: completedByDate.get(cursor) ?? 0,
      habits,
      checks: checksForDate.map((c) => ({ habit_id: c.habit_id, status: c.status })),
    });
    dias.push({ date: cursor, week_number: week?.week_number ?? null, checks: checksForDate, evaluacion });
    cursor = addDays(cursor, 1);
  }

  return { status: 'success', data: { dias } };
}
