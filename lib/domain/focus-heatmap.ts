// Lógica pura del mapa de calor de foco (004, US-F3, FR-F17/FR-F18, research R10/R11): la rejilla
// (columnas = semanas de lunes a domingo, filas = días L…D), las etiquetas de mes, el formato de
// minutos y el modelo de vista de la franja de Hoy. Sin React, sin DOM, sin `Intl` y sin zona
// horaria del host: trabaja sobre fechas 'YYYY-MM-DD' que el servidor ya resolvió en PURE_TZ, con
// aritmética UTC sobre la fecha de calendario (mismo patrón que `dayNumber` de ./focus), así que
// se prueba en el entorno 'node' de Vitest. components/ui/FocusHeatmap.tsx solo la pinta.
//
// Importa de ./focus únicamente tipos (se borran al compilar) para no arrastrar al navegador el
// resto de las reglas de Foco, que dependen de la zona horaria del servidor.

import { HEAT_LEVEL_BOUNDS } from '../execution/constants';
import type { HeatLevel } from './focus';

const DAY_MS = 86_400_000;

/** Un día tal como lo entrega el resumen (`FocusSummary.dias`, `TodayPayload.foco_12_semanas`). */
export interface HeatmapDayInput {
  /** 'YYYY-MM-DD', fecha local del servidor. */
  date: string;
  minutos: number;
  nivel: HeatLevel;
}

/** Una celda de la rejilla. `nivel` es `null` en los días futuros de la semana en curso. */
export interface HeatmapCell {
  date: string;
  minutos: number;
  nivel: HeatLevel | null;
}

export interface HeatmapColumn {
  /** Lunes de la semana ('YYYY-MM-DD'). */
  lunes: string;
  /** Mes abreviado ('oct') solo en la primera columna de cada mes; `null` en las demás. */
  monthLabel: string | null;
  /** Siete celdas, de lunes (fila 0) a domingo (fila 6). */
  cells: HeatmapCell[];
}

export interface HeatmapGrid {
  columns: HeatmapColumn[];
}

/** Etiquetas de las filas de la rejilla, de lunes a domingo. */
export const HEATMAP_ROW_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

const MONTH_ABBREVIATIONS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/**
 * Columnas de distancia mínimas entre la etiqueta de la primera columna y la del mes siguiente.
 * Con celdas de 12 px y 3 px de hueco, una etiqueta de tres letras mide más que una columna pero
 * menos que dos: a distancia 1 se encimarían, a 2 caben.
 */
const MIN_LABEL_GAP_COLUMNS = 2;

function dayNumberOf(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

function dateKeyOf(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

/** Días desde el lunes de la semana de `dayNumber` (0 = lunes … 6 = domingo). 1970-01-01 fue jueves. */
function rowOf(dayNumber: number): number {
  return (((dayNumber + 3) % 7) + 7) % 7;
}

function monthIndexOf(dateKey: string): number {
  return Number(dateKey.slice(5, 7)) - 1;
}

/**
 * US-F3-AS8: arma la rejilla de `weeks` columnas que termina en la semana de `todayKey`.
 * - Columna: una semana de lunes a domingo; fila: un día (L…D). La primera columna empieza el
 *   lunes de hace `weeks − 1` semanas, que es donde empieza `FocusSummary.dias`.
 * - Minutos y nivel salen de `dias`. Un día pasado que el resumen no trae vale 0 con nivel 0: el
 *   servidor ya manda 0 explícito, esto solo evita un hueco si el payload viniera recortado.
 * - Los días posteriores a `todayKey` (el resto de la semana en curso) quedan vacíos, con
 *   `nivel: null` y 0 minutos, aunque `dias` los trajera.
 * - Cada mes se etiqueta una sola vez, en la primera columna cuyo lunes cae en ese mes. La
 *   etiqueta de la primera columna se omite si la del mes siguiente queda a menos de
 *   `MIN_LABEL_GAP_COLUMNS` columnas: se encimarían.
 */
export function buildHeatmapGrid(dias: readonly HeatmapDayInput[], weeks: number, todayKey: string): HeatmapGrid {
  const byDate = new Map<string, HeatmapDayInput>();
  for (const dia of dias) byDate.set(dia.date, dia);

  const todayNumber = dayNumberOf(todayKey);
  const currentMonday = todayNumber - rowOf(todayNumber);
  const firstMonday = currentMonday - (Math.max(1, Math.floor(weeks)) - 1) * 7;
  const columnCount = (currentMonday - firstMonday) / 7 + 1;

  const columns: HeatmapColumn[] = [];
  for (let c = 0; c < columnCount; c++) {
    const monday = firstMonday + c * 7;
    const cells: HeatmapCell[] = [];
    for (let row = 0; row < 7; row++) {
      const date = dateKeyOf(monday + row);
      if (monday + row > todayNumber) {
        cells.push({ date, minutos: 0, nivel: null });
        continue;
      }
      const known = byDate.get(date);
      cells.push({ date, minutos: known?.minutos ?? 0, nivel: known?.nivel ?? 0 });
    }

    const lunes = dateKeyOf(monday);
    const startsNewMonth = c === 0 || monthIndexOf(lunes) !== monthIndexOf(columns[c - 1].lunes);
    columns.push({ lunes, monthLabel: startsNewMonth ? MONTH_ABBREVIATIONS[monthIndexOf(lunes)] : null, cells });
  }

  // La primera columna siempre es "primera de su mes" dentro de la rejilla, pero si el mes cambia
  // en la columna siguiente su etiqueta quedaría pegada a la otra: se omite.
  if (columns.length > 1) {
    const nextLabelled = columns.findIndex((column, index) => index > 0 && column.monthLabel !== null);
    if (nextLabelled !== -1 && nextLabelled < MIN_LABEL_GAP_COLUMNS) columns[0].monthLabel = null;
  }

  return { columns };
}

/**
 * Minutos como texto corto para cifras del mapa y de la tabla: `400` -> "6 h 40 m", `45` -> "45 m",
 * `0` -> "0 m". Las horas exactas no llevan minutos (`60` -> "1 h", `120` -> "2 h"): "1 h 0 m" es
 * ruido. Los minutos de las horas no se rellenan con cero ("1 h 5 m", no "1 h 05 m"). Un valor
 * negativo o no finito cuenta como 0 y uno con decimales se redondea al minuto.
 */
export function formatFocusMinutes(minutes: number): string {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} m`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} m`;
}

/** 'YYYY-MM-DD' -> "5 oct": día sin cero y mes abreviado en español (sin `Intl`, igual en cualquier host). */
export function formatHeatmapDate(dateKey: string): string {
  return `${Number(dateKey.slice(8, 10))} ${MONTH_ABBREVIATIONS[monthIndexOf(dateKey)]}`;
}

/**
 * Texto de `title`/`aria-label` de una celda: "5 oct · 45 min" (siempre en minutos enteros, así
 * el número es el mismo que ve quien pasa el cursor y el que lee un lector de pantalla). Un día
 * futuro no tiene etiqueta: no hay dato que decir.
 */
export function heatmapCellLabel(cell: HeatmapCell): string | null {
  if (cell.nivel === null) return null;
  return `${formatHeatmapDate(cell.date)} · ${cell.minutos} min`;
}

export interface HeatmapLegendEntry {
  nivel: HeatLevel;
  /** Rango de minutos del nivel, en cifras: '0', '1–30', '31–90', '91–180', '>180' (FR-F17). */
  label: string;
}

/** Leyenda del mapa (FR-F17), derivada de `HEAT_LEVEL_BOUNDS` para que nunca discrepe del nivel. */
export function heatmapLegend(): HeatmapLegendEntry[] {
  const entries: HeatmapLegendEntry[] = [{ nivel: 0, label: '0' }];
  let lower = 1;
  HEAT_LEVEL_BOUNDS.forEach((upper, index) => {
    entries.push({ nivel: (index + 1) as HeatLevel, label: `${lower}–${upper}` });
    lower = upper + 1;
  });
  entries.push({ nivel: (HEAT_LEVEL_BOUNDS.length + 1) as HeatLevel, label: `>${HEAT_LEVEL_BOUNDS[HEAT_LEVEL_BOUNDS.length - 1]}` });
  return entries;
}

/** Semanas que pinta la franja de Hoy (FR-F18). */
export const FOCUS_STRIP_WEEKS = 12;

/** Lo que `buildFocusStripView` lee del payload de Hoy; los dos campos de foco pueden faltar. */
export interface FocusStripInput {
  /** Fecha local de Hoy ('YYYY-MM-DD'): `TodayPayload.date`. */
  date: string;
  foco_semana_minutos?: number | null;
  foco_12_semanas?: readonly HeatmapDayInput[] | null;
}

export interface FocusStripView {
  weekLabel: string;
  /** Total de la semana en minutos enfocados, ya con formato: "6 h 40 m". */
  totalText: string;
  grid: HeatmapGrid;
}

/**
 * Modelo de vista de la franja de foco de Hoy (FR-F18, research R10): a propósito solo expone
 * estas tres claves -- el total de la semana y la rejilla de 12 semanas --, nunca metas, minutos
 * que faltan, avance contra la meta, rachas ni "días activos", porque este modelo nunca los recibe
 * ni los calcula. Es aparte de `buildTodayFooterView`: el pie de Hoy (US3-AS8) sigue sin minutos.
 * Con un payload que aún no trae los campos de foco devuelve `null` y Hoy no pinta la franja.
 */
export function buildFocusStripView(input: FocusStripInput): FocusStripView | null {
  const { foco_semana_minutos: total, foco_12_semanas: dias } = input;
  if (typeof total !== 'number' || !Array.isArray(dias)) return null;

  return {
    weekLabel: 'Esta semana',
    totalText: formatFocusMinutes(total),
    grid: buildHeatmapGrid(dias, FOCUS_STRIP_WEEKS, input.date),
  };
}
