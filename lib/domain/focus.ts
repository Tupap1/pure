// Reglas puras de Foco (004): unidades por sesión, "cuenta para el mínimo", reparto por día,
// recuento del día, nivel del mapa de calor y frase del día. Sin `Intl`, sin `process.env` y sin
// base de datos: el reparto por medianoche local (que sí depende de PURE_TZ) llega inyectado como
// `split` -- en producción es `splitByLocalDay` de lib/execution/time.ts -- así que todo lo de
// aquí se prueba con falsos y sin reloj (research R7).
//
// Es la ÚNICA regla de unidades y de minutos por día del sistema (FR-F04, FR-F13): Hoy
// (today.ts), el reporte de cumplimiento (compliance.ts) y la lectura de tandas (tandas.ts, de
// donde cuelga checks.ts) llaman a `tallyDay`. Si un sitio calcula por su cuenta, Hoy y el reporte
// dicen cosas distintas del mismo día.
//
// Las interfaces de entrada son mínimas y estructurales (TandaRecord, ObjectiveRecord y
// QuoteRecord de lib/db/execution-pg.ts las satisfacen) para que este módulo no importe nada de
// lib/db/.

import { tandaUnits } from './execution';
import { HEAT_LEVEL_BOUNDS, TANDA_UNIT_MINUTES } from '../execution/constants';

export type FocusKind = 'temporizador' | 'cronometro';

/** Tramo de una sesión en un día local: `minutes` enteros que le tocan a `date` ('YYYY-MM-DD'). */
export interface DayShare {
  date: string;
  minutes: number;
}

/** Firma de `splitByLocalDay` (lib/execution/time.ts), inyectable para probar sin zona horaria. */
export type SplitByLocalDay = (startIso: string, endIso: string) => DayShare[];

/** Lo mínimo que estas reglas leen de una tanda (temporizador o cronómetro). */
export interface FocusTandaInput {
  kind: FocusKind;
  /** 'en_curso' | 'completada' | 'interrumpida'. Solo las dos últimas suman (FR-F14). */
  status: string;
  /** Día local de inicio ('YYYY-MM-DD'); el temporizador pertenece entero a este día. */
  local_date: string;
  started_at: string;
  ended_at?: string | null;
  actual_minutes?: number | null;
  objective_id?: string | null;
  subject_id?: string | null;
  topic_id?: string | null;
  task_id?: string | null;
  deliverable_id?: string | null;
}

/** Lo mínimo que `countsTowardMinimum` lee de un objetivo. */
export interface FocusObjectiveInput {
  subject_id?: string | null;
}

export interface FocusQuoteInput {
  id: string;
  text: string;
  translation?: string | null;
  source?: string | null;
  active: boolean;
}

/** Forma pública de la frase del día (`TodayPayload.frase_del_dia`). */
export interface QuoteOfDay {
  text: string;
  translation: string | null;
  source: string | null;
}

/** Recuento de un día (data-model, "Recuento del día"). `completadas` y `unidades` alimentan
 * `evaluateDay`; `minutos_foco` es lo que dibuja el mapa de calor. */
export interface DayTally {
  completadas: number;
  unidades: number;
  interrumpidas: number;
  minutos_foco: number;
}

/** Nivel del mapa de calor: 0 sin foco; 1 a 4 según `HEAT_LEVEL_BOUNDS` (FR-F17). */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

const DAY_MS = 86_400_000;

/**
 * FR-F04: unidades que vale una sesión completada con `minutes` minutos.
 * - temporizador: `max(1, floor(minutes / 10))`, que es la `tandaUnits` de la 003 (se conserva y se
 *   delega: la usan sus tests);
 * - cronómetro: `floor(minutes / 10)`, así que menos de 10 minutos valen 0.
 *
 * En un cronómetro repartido entre días (FR-F14a), `minutes` son los del tramo de ese día.
 */
export function sessionUnits(kind: FocusKind, minutes: number): number {
  if (kind === 'cronometro') return Math.max(0, Math.floor(minutes / TANDA_UNIT_MINUTES));
  return tandaUnits(minutes);
}

/**
 * FR-F13: una sesión cuenta para el mínimo diario salvo que se cumplan las tres a la vez:
 * tiene objetivo, ese objetivo no tiene materia, y la sesión no tiene materia, tema, tarea ni
 * entrega propios. Una tanda sin ningún vínculo cuenta (regresión US-F2-AS7). Si el objetivo ya no
 * existe (referencia anulada, `objetivo` nulo) se trata como sin objetivo.
 */
export function countsTowardMinimum(t: FocusTandaInput, objetivo: FocusObjectiveInput | null): boolean {
  if (!t.objective_id || !objetivo) return true;
  if (objetivo.subject_id) return true;
  return Boolean(t.subject_id || t.topic_id || t.task_id || t.deliverable_id);
}

/**
 * FR-F14a: tramos por día de una sesión. Un cronómetro cerrado se reparte con `split` (corta en
 * cada medianoche local, minutos acumulados con piso: la suma es `actual_minutes`). Un
 * temporizador, o cualquier sesión sin `ended_at`, da un solo tramo en su día de inicio con
 * `actual_minutes ?? 0`: el temporizador que cruza la medianoche no se reparte (US-F1-AS10).
 */
export function sessionShares(t: FocusTandaInput, split: SplitByLocalDay): DayShare[] {
  if (t.kind === 'cronometro' && t.ended_at) return split(t.started_at, t.ended_at);
  return [{ date: t.local_date, minutes: t.actual_minutes ?? 0 }];
}

/**
 * Recuento de `dateKey` sobre los tramos de las sesiones dadas (data-model, "Recuento del día"):
 * - `completadas`: filas `completada` con un tramo ese día que cuentan para el mínimo. Un
 *   cronómetro repartido es 1 completada en cada día que toca (R7);
 * - `unidades`: Σ `sessionUnits(kind, minutos_del_tramo)` de esas mismas filas;
 * - `interrumpidas`: filas `interrumpida` con tramo ese día (aunque den 0 minutos);
 * - `minutos_foco`: Σ minutos de los tramos de completadas + interrumpidas, cuenten o no para el
 *   mínimo (FR-F14: el foco de un objetivo sin materia sigue siendo foco).
 *
 * Las sesiones en curso no suman. `objetivosById` resuelve `objective_id` para
 * `countsTowardMinimum`; un id ausente del mapa se trata como sin objetivo.
 */
export function tallyDay(
  dateKey: string,
  tandas: FocusTandaInput[],
  objetivosById: Map<string, FocusObjectiveInput>,
  split: SplitByLocalDay
): DayTally {
  const tally: DayTally = { completadas: 0, unidades: 0, interrumpidas: 0, minutos_foco: 0 };

  for (const t of tandas) {
    if (t.status !== 'completada' && t.status !== 'interrumpida') continue;

    const tramos = sessionShares(t, split).filter((share) => share.date === dateKey);
    if (tramos.length === 0) continue;
    const minutes = tramos.reduce((sum, share) => sum + share.minutes, 0);

    tally.minutos_foco += minutes;
    if (t.status === 'interrumpida') {
      tally.interrumpidas += 1;
      continue;
    }
    const objetivo = t.objective_id ? objetivosById.get(t.objective_id) ?? null : null;
    if (countsTowardMinimum(t, objetivo)) {
      tally.completadas += 1;
      tally.unidades += sessionUnits(t.kind, minutes);
    }
  }

  return tally;
}

/**
 * FR-F17: nivel del mapa de calor para un día con `minutes` minutos enfocados. Con los cortes
 * `HEAT_LEVEL_BOUNDS` = [30, 90, 180]: 0 → 0; 1–30 → 1; 31–90 → 2; 91–180 → 3; > 180 → 4.
 */
export function heatLevel(minutes: number): HeatLevel {
  if (!(minutes > 0)) return 0;
  let level = 1;
  for (const bound of HEAT_LEVEL_BOUNDS) if (minutes > bound) level += 1;
  return level as HeatLevel;
}

/**
 * Días desde 1970-01-01 de una fecha de calendario 'YYYY-MM-DD' (R5). Aritmética UTC sobre la
 * fecha local ya resuelta, sin zona horaria del host (mismo patrón que `isoDayOfWeekForDateKey`).
 */
export function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/**
 * FR-F26 / R5: frase del día por rotación determinista. Toma las frases activas ordenadas por `id`
 * (estable entre despliegues, porque el id sale del texto) y elige la de índice
 * `dayNumber(dateKey) mod N`: el mismo día da la misma frase, días consecutivos dan frases
 * distintas (N ≥ 2) y en N días seguidos sale cada una exactamente una vez. Sin activas: `null`.
 * Desactivar una frase cambia N y reordena la rotación; la spec no pide continuidad.
 */
export function quoteOfDay(dateKey: string, frases: FocusQuoteInput[]): QuoteOfDay | null {
  const activas = frases.filter((f) => f.active).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (activas.length === 0) return null;

  const n = activas.length;
  const elegida = activas[((dayNumber(dateKey) % n) + n) % n];
  return {
    text: elegida.text,
    translation: elegida.translation ?? null,
    source: elegida.source ?? null,
  };
}
