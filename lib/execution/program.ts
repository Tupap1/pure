// Servicio del programa (program_weeks) y de los hábitos (habits). Handler único consumido por
// manage_program (MCP) — Principio I: una sola vía de datos, sin lógica duplicada en la web.

import { addDays, localParts } from './time';
import { isoDayOfWeekForDateKey } from '../domain/execution';
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

// --- Resolución de semana (US-B1) ---------------------------------------------------------------

export type WeekResolution = { ok: true; week: ProgramWeekRecord } | { ok: false; reason: 'sin_programa' | 'programa_terminado' };

/** Helper: la semana con menor starts_on que sea mayor que todayKey, sin importar orden. */
function findNextWeekByStartsOn(weeks: ProgramWeekRecord[], todayKey: string): ProgramWeekRecord | null {
  const candidates = weeks.filter((w) => w.starts_on > todayKey);
  if (candidates.length === 0) return null;
  // Retorna la que tiene el menor starts_on
  return candidates.reduce((prev, curr) => (curr.starts_on < prev.starts_on ? curr : prev));
}

/**
 * Decide cuál es la semana para planear (US-B1, contracts/mcp-tools.md:plan_week:preview):
 * - si hoy es domingo y hay una semana que arranca mañana, esa;
 * - la que contiene hoy (findCurrentWeek);
 * - la más próxima con starts_on > hoy (menor starts_on);
 * - si nada aplica, `{ ok: false, reason: 'sin_programa' | 'programa_terminado' }`.
 * Exportada porque se reutiliza en lib/execution/routine.ts:rehearseRoutineSlot
 * (Principio I: una sola función decide "cuál es la semana que se está planeando").
 */
export function resolvePlanningWeek(weeks: ProgramWeekRecord[], todayKey: string): WeekResolution {
  // Paso 1: si hoy es domingo y existe una semana que arranca mañana
  if (isoDayOfWeekForDateKey(todayKey) === 7) {
    const tomorrowKey = addDays(todayKey, 1);
    const nextWeek = weeks.find((w) => w.starts_on === tomorrowKey);
    if (nextWeek) return { ok: true, week: nextWeek };
  }

  // Paso 2: la semana que contiene hoy
  const currentWeek = findCurrentWeek(weeks, todayKey);
  if (currentWeek) return { ok: true, week: currentWeek };

  // Paso 3: la más próxima con starts_on > hoy (menor starts_on, sin importar orden del arreglo)
  const nextWeek = findNextWeekByStartsOn(weeks, todayKey);
  if (nextWeek) return { ok: true, week: nextWeek };

  // Paso 4: sin semana disponible
  return { ok: false, reason: weeks.length === 0 ? 'sin_programa' : 'programa_terminado' };
}

/**
 * Decide cuál es la semana para ver (US-B1, contracts/mcp-tools.md:plan_week:open_view):
 * pasos 2 a 4 de resolvePlanningWeek (sin el salto del domingo).
 */
export function resolveViewWeek(weeks: ProgramWeekRecord[], todayKey: string): WeekResolution {
  // Paso 2: la semana que contiene hoy
  const currentWeek = findCurrentWeek(weeks, todayKey);
  if (currentWeek) return { ok: true, week: currentWeek };

  // Paso 3: la más próxima con starts_on > hoy (menor starts_on, sin importar orden del arreglo)
  const nextWeek = findNextWeekByStartsOn(weeks, todayKey);
  if (nextWeek) return { ok: true, week: nextWeek };

  // Paso 4: sin semana disponible
  return { ok: false, reason: weeks.length === 0 ? 'sin_programa' : 'programa_terminado' };
}

/** true si la semana ya empezó (starts_on <= todayKey); false si todavía no. */
export function weekHasStarted(week: ProgramWeekRecord, todayKey: string): boolean {
  return week.starts_on <= todayKey;
}

/**
 * Mensajes de error cuando la resolución falla (contracts/mcp-tools.md:plan_week).
 * `verbo` es 'planear' o 'ver'.
 */
export function weekNotFoundMessage(reason: 'sin_programa' | 'programa_terminado', verbo: 'planear' | 'ver'): string {
  if (reason === 'sin_programa') {
    return `No hay un programa creado: no hay semana para ${verbo}.`;
  } else {
    return `El programa ya terminó: no quedan semanas por ${verbo}.`;
  }
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
