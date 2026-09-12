// Servicio del programa (program_weeks) y de los hábitos (habits). Handler único consumido por
// manage_program (MCP) — Principio I: una sola vía de datos, sin lógica duplicada en la web.

import { addDays, localParts } from './time';
import type { ExecutionResult } from '../validations/schemas';
import {
  fetchProgramWeeksFromDb,
  saveProgramWeekToDb,
  fetchHabitsFromDb,
  saveHabitToDb,
  withExecutionTransaction,
  ProgramWeekRecord,
  HabitRecord,
} from '../db/execution-pg';

export interface ProgramInitInput {
  starts_on: string;
  weeks: { min_tandas_dia: number; phase: string }[];
}

/**
 * Crea las semanas del programa (`pw-01`...`pw-NN`) a partir del lunes `starts_on`, una vez.
 * Atómico: si una semana falla a mitad de camino, no deja el programa a medias (FR-017).
 */
export async function initProgram(input: ProgramInitInput): Promise<ExecutionResult<ProgramWeekRecord[]>> {
  const existingRaw = await fetchProgramWeeksFromDb();
  const existing = Array.isArray(existingRaw) ? existingRaw : [];
  if (existing.length > 0) {
    return {
      status: 'error',
      code: 'PROGRAMA_EXISTENTE',
      message: 'Ya existe un programa creado: init solo se ejecuta una vez (usa update_week para editar semanas futuras).',
    };
  }

  const weeks = await withExecutionTransaction(async (client) => {
    const created: ProgramWeekRecord[] = [];
    let cursor = input.starts_on;
    for (let index = 0; index < input.weeks.length; index++) {
      const weekNumber = index + 1;
      const week = input.weeks[index];
      const saved = await saveProgramWeekToDb(
        {
          id: `pw-${String(weekNumber).padStart(2, '0')}`,
          week_number: weekNumber,
          starts_on: cursor,
          phase: week.phase,
          min_tandas_dia: week.min_tandas_dia,
        },
        client
      );
      created.push(saved);
      cursor = addDays(cursor, 7);
    }
    return created;
  });

  return { status: 'success', message: `Programa creado con ${weeks.length} semanas.`, data: weeks };
}

/** Semana cuyo rango [starts_on, starts_on+6] contiene la fecha local de `now`, o null. */
function findCurrentWeek(weeks: ProgramWeekRecord[], todayKey: string): ProgramWeekRecord | null {
  return weeks.find((week) => week.starts_on <= todayKey && todayKey <= addDays(week.starts_on, 6)) || null;
}

export async function readProgram(now: Date = new Date()): Promise<ExecutionResult> {
  const weeksRaw = await fetchProgramWeeksFromDb();
  const weeks = (Array.isArray(weeksRaw) ? weeksRaw : []) as ProgramWeekRecord[];
  const habitsRaw = await fetchHabitsFromDb();
  const habits = (Array.isArray(habitsRaw) ? habitsRaw : []) as HabitRecord[];

  const todayKey = localParts(now).dateKey;
  const currentWeek = findCurrentWeek(weeks, todayKey);

  return { status: 'success', data: { weeks, current_week: currentWeek, habits } };
}

export interface ProgramUpdateWeekInput {
  id: string;
  min_tandas_dia?: number;
  phase?: string;
}

/** FR-017: solo se editan semanas cuyo `starts_on` es estrictamente futuro respecto a hoy. */
export async function updateProgramWeek(input: ProgramUpdateWeekInput, now: Date = new Date()): Promise<ExecutionResult<ProgramWeekRecord>> {
  const existingRaw = await fetchProgramWeeksFromDb(input.id);
  const existing = (Array.isArray(existingRaw) ? existingRaw[0] : existingRaw) as ProgramWeekRecord | null;
  if (!existing) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la semana ${input.id}.` };
  }

  const todayKey = localParts(now).dateKey;
  const alreadyStarted = existing.starts_on <= todayKey;
  if (alreadyStarted) {
    return {
      status: 'error',
      code: 'SEMANA_EN_CURSO',
      message: 'Solo se pueden editar semanas que todavía no empiezan.',
    };
  }

  const updated = await saveProgramWeekToDb({
    ...existing,
    min_tandas_dia: input.min_tandas_dia ?? existing.min_tandas_dia,
    phase: input.phase ?? existing.phase,
  });

  return { status: 'success', data: updated };
}

export interface HabitUpsertInput {
  id: string;
  label: string;
  started_on: string;
  days_of_week?: number[] | null;
  target_days?: number;
}

export async function upsertHabit(input: HabitUpsertInput): Promise<ExecutionResult<HabitRecord>> {
  const habit = await saveHabitToDb(input);
  return { status: 'success', data: habit };
}

export interface HabitRetireInput {
  id: string;
  retired_on: string;
}

export async function retireHabit(input: HabitRetireInput): Promise<ExecutionResult<HabitRecord>> {
  const existingRaw = await fetchHabitsFromDb(input.id);
  const existing = (Array.isArray(existingRaw) ? existingRaw[0] : existingRaw) as HabitRecord | null;
  if (!existing) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe el hábito ${input.id}.` };
  }

  const updated = await saveHabitToDb({ ...existing, retired_on: input.retired_on });
  return { status: 'success', data: updated };
}
