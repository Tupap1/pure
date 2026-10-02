// Resumen de foco (US-F3): minutos enfocados por día local, por semana de lunes a domingo y por
// objetivo, para el mapa de calor de Hoy (12 semanas) y de Command Center (52). Solo agrega: las
// reglas viven en lib/domain/focus.ts (qué suma, el reparto por medianoche del cronómetro y el
// nivel del mapa) y este archivo las aplica en UNA pasada sobre las sesiones, sin recorrer
// días × sesiones ni construir `Intl` por celda (SC-F03).
//
// Las sesiones que suman son las completadas e interrumpidas (FR-F14); una en curso no suma hasta
// que se cierra. El resumen se calcula al leer, así que una corrección (US-F4) o un cronómetro que
// se cierra después del reporte congelado aparecen aquí sin reescribir nada.

import { localParts, addDays, mondayOf } from './time';
import { FOCUS_WEEKS_DEFAULT } from './constants';
import { cachedSplitByLocalDay, loadObjectivesById, finalizeElapsed } from './tandas';
import { fetchTandasFromDb, type TandaRecord, type ObjectiveRecord } from '../db/execution-pg';
import { fetchSubjectsFromDb } from '../db/repository-pg';
import {
  sessionShares,
  heatLevel,
  type FocusTandaInput,
  type FocusObjectiveInput,
  type HeatLevel,
  type SplitByLocalDay,
} from '../domain/focus';
import type { ExecutionResult } from '../validations/schemas';

/** Filtro opcional del resumen: por objetivo o por materia, nunca los dos (lo valida el esquema). */
export interface FocusFilter {
  objective_id?: string;
  subject_id?: string;
}

export interface FocusSummaryInput extends FocusFilter {
  /** Semanas del rango, de 1 a 53 (52 por defecto). */
  weeks?: number;
}

/** Un día del mapa: `minutos` enfocados (0 explícito si no hubo foco) y su `nivel` 0..4 (FR-F17). */
export interface FocusDay {
  date: string;
  minutos: number;
  nivel: HeatLevel;
}

/** Total de una semana de lunes a domingo; la semana actual solo llega hasta hoy. */
export interface FocusWeek {
  lunes: string;
  minutos: number;
}

/** Una fila de la tabla por objetivo (FR-F16). `id` es null solo en 'sin_objetivo'. */
export interface FocusByObjectiveRow {
  tipo: 'objetivo' | 'materia' | 'sin_objetivo';
  id: string | null;
  nombre: string;
  minutos: number;
  /** Meta semanal en minutos; solo los objetivos la tienen. */
  meta: number | null;
  archivado: boolean;
}

export interface FocusSummary {
  rango: { desde: string; hasta: string; semanas: number };
  dias: FocusDay[];
  semanas: FocusWeek[];
  total_semana: number;
  /** Semana actual, SIN filtro: cada sesión cae en una sola fila y la suma es el total sin filtro. */
  por_objetivo: FocusByObjectiveRow[];
}

const SIN_OBJETIVO_NAME = 'Sin objetivo';
const ROW_ORDER: Record<FocusByObjectiveRow['tipo'], number> = { objetivo: 0, materia: 1, sin_objetivo: 2 };

/** FR-F14: solo las sesiones cerradas (completada o interrumpida) suman foco. */
function isFocusSession(t: FocusTandaInput): boolean {
  return t.status === 'completada' || t.status === 'interrumpida';
}

/**
 * US-F3-AS5: por objetivo, las sesiones ligadas a él; por materia, las que la tienen directa y las
 * de objetivos ligados a esa materia (una sesión con objetivo de otra materia aparece bajo las dos).
 */
function matchesFilter(
  t: FocusTandaInput,
  objetivosById: Map<string, FocusObjectiveInput>,
  filtro: FocusFilter
): boolean {
  if (filtro.objective_id) return t.objective_id === filtro.objective_id;
  if (filtro.subject_id) {
    if (t.subject_id === filtro.subject_id) return true;
    const objetivo = t.objective_id ? objetivosById.get(t.objective_id) : undefined;
    return objetivo?.subject_id === filtro.subject_id;
  }
  return true;
}

/**
 * Minutos enfocados de cada día de `from` a `to` (ambos 'YYYY-MM-DD', inclusive), con 0 explícito
 * en los días sin foco y su nivel del mapa. Una sola pasada sobre las sesiones: cada una reparte
 * sus minutos con `sessionShares` (el cronómetro cruza medianoches, el temporizador no) y se
 * acumulan por fecha. `filtro` recorta por objetivo o materia. `split` es inyectable para que
 * `getFocusSummary` comparta una sola caché de repartos entre sus pasadas.
 */
export function focusDays(
  tandas: FocusTandaInput[],
  objetivosById: Map<string, FocusObjectiveInput>,
  from: string,
  to: string,
  filtro: FocusFilter = {},
  split: SplitByLocalDay = cachedSplitByLocalDay()
): FocusDay[] {
  const minutesByDate = new Map<string, number>();
  for (const t of tandas) {
    if (!isFocusSession(t) || !matchesFilter(t, objetivosById, filtro)) continue;
    for (const share of sessionShares(t, split)) {
      if (share.date < from || share.date > to) continue;
      minutesByDate.set(share.date, (minutesByDate.get(share.date) ?? 0) + share.minutes);
    }
  }

  const days: FocusDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const minutos = minutesByDate.get(date) ?? 0;
    days.push({ date, minutos, nivel: heatLevel(minutos) });
  }
  return days;
}

/** Suma los minutos de los días de `dias` desde `fromDate` en adelante (p. ej. de lunes a hoy). */
export function sumFocusMinutes(dias: FocusDay[], fromDate: string): number {
  return dias.reduce((sum, day) => (day.date >= fromDate ? sum + day.minutos : sum), 0);
}

/**
 * FR-F16: tabla por objetivo de la semana `from`..`to`, SIN filtro. Cada sesión cae en una sola
 * fila (su objetivo; si no, su materia; si no, "Sin objetivo"), así que la suma de las filas es el
 * total de la semana sin filtro. Los objetivos activos con meta aparecen aunque sumen 0; los
 * archivados solo si tienen minutos esta semana.
 */
function focusByObjective(
  tandas: FocusTandaInput[],
  objetivosById: Map<string, ObjectiveRecord>,
  subjectNames: Map<string, string>,
  from: string,
  to: string,
  split: SplitByLocalDay
): FocusByObjectiveRow[] {
  const rows = new Map<string, FocusByObjectiveRow>();

  const objectiveRow = (objective: ObjectiveRecord): FocusByObjectiveRow => {
    const key = `objetivo:${objective.id}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        tipo: 'objetivo',
        id: objective.id,
        nombre: objective.name,
        minutos: 0,
        meta: objective.weekly_target_minutes ?? null,
        archivado: Boolean(objective.archived),
      };
      rows.set(key, row);
    }
    return row;
  };

  for (const t of tandas) {
    if (!isFocusSession(t)) continue;
    let minutes = 0;
    for (const share of sessionShares(t, split)) {
      if (share.date >= from && share.date <= to) minutes += share.minutes;
    }
    if (minutes === 0) continue;

    const objective = t.objective_id ? objetivosById.get(t.objective_id) : undefined;
    let row: FocusByObjectiveRow;
    if (objective) {
      row = objectiveRow(objective);
    } else if (t.subject_id) {
      const key = `materia:${t.subject_id}`;
      row =
        rows.get(key) ??
        ({
          tipo: 'materia',
          id: t.subject_id,
          nombre: subjectNames.get(t.subject_id) ?? t.subject_id,
          minutos: 0,
          meta: null,
          archivado: false,
        } satisfies FocusByObjectiveRow);
      rows.set(key, row);
    } else {
      row =
        rows.get('sin_objetivo') ??
        ({
          tipo: 'sin_objetivo',
          id: null,
          nombre: SIN_OBJETIVO_NAME,
          minutos: 0,
          meta: null,
          archivado: false,
        } satisfies FocusByObjectiveRow);
      rows.set('sin_objetivo', row);
    }
    row.minutos += minutes;
  }

  for (const objective of objetivosById.values()) {
    if (!objective.archived && objective.weekly_target_minutes) objectiveRow(objective);
  }

  return Array.from(rows.values()).sort(
    (a, b) => ROW_ORDER[a.tipo] - ROW_ORDER[b.tipo] || b.minutos - a.minutos || a.nombre.localeCompare(b.nombre)
  );
}

/**
 * US-F3 / FR-F15: resumen de foco de `weeks` semanas (52 por defecto) que terminan hoy, con filtro
 * opcional por objetivo o materia. `desde` es el lunes de hace `weeks − 1` semanas y `hasta` es
 * hoy en la zona local. Lee tandas, objetivos y materias una sola vez y reparte cada sesión una
 * sola vez (`cachedSplitByLocalDay`), así que un año de sesiones se resuelve en memoria.
 */
export async function getFocusSummary(
  input: FocusSummaryInput = {},
  now: Date = new Date()
): Promise<ExecutionResult<FocusSummary>> {
  // Igual que las demás lecturas: un temporizador cuyo tiempo ya se cumplió se cierra antes de sumar.
  await finalizeElapsed(now);

  const weeks = input.weeks ?? FOCUS_WEEKS_DEFAULT;
  const hasta = localParts(now).dateKey;
  const lunesActual = mondayOf(hasta);
  const desde = addDays(lunesActual, -(weeks - 1) * 7);

  const [tandasRaw, objetivosById, materiasRaw] = await Promise.all([
    fetchTandasFromDb(),
    loadObjectivesById(),
    fetchSubjectsFromDb(),
  ]);
  const tandas = (Array.isArray(tandasRaw) ? tandasRaw : []) as TandaRecord[];
  const subjectNames = new Map(
    ((Array.isArray(materiasRaw) ? materiasRaw : []) as { id: string; name: string }[]).map((s) => [s.id, s.name])
  );
  const split = cachedSplitByLocalDay();

  const dias = focusDays(tandas, objetivosById, desde, hasta, input, split);
  const semanas: FocusWeek[] = [];
  for (let i = 0; i < weeks; i += 1) {
    const slice = dias.slice(i * 7, i * 7 + 7);
    semanas.push({ lunes: addDays(desde, i * 7), minutos: slice.reduce((sum, day) => sum + day.minutos, 0) });
  }

  return {
    status: 'success',
    data: {
      rango: { desde, hasta, semanas: weeks },
      dias,
      semanas,
      total_semana: sumFocusMinutes(dias, lunesActual),
      por_objetivo: focusByObjective(tandas, objetivosById, subjectNames, lunesActual, hasta, split),
    },
  };
}
