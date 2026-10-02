// Modelo de vista puro de Hoy (US1-AS8, US3-AS8, US-T1-AS10/AS11, US-F1-AS8/AS9, US-F2-AS9, US-F5-AS7). Sin dependencias de React ni del DOM, para
// que sea testeable en el entorno 'node' de Vitest (Constitución, Principio IV); useToday.ts es
// el único que lo llama desde un componente.

import { TANDA_DURATION_OPTIONS, TANDA_MINUTES_DEFAULT, TANDA_MINUTES_MAX, TANDA_MINUTES_MIN } from './constants';
import type { QuoteOfDay } from '../domain/focus';

/**
 * Offset entre el reloj del servidor y el del cliente, capturado una vez por cada respuesta de
 * get_today (`clientNowMs` es el `Date.now()` del cliente en el instante en que llegó
 * `serverNowIso`). Se guarda y se reutiliza en cada tick, en vez de comparar contra un
 * `Date.now()` fresco cada vez: eso volvería a exponer el desfase del reloj del cliente que el
 * offset existe para corregir.
 */
export function clockOffset(serverNowIso: string, clientNowMs: number): number {
  return new Date(serverNowIso).getTime() - clientNowMs;
}

/**
 * Segundos restantes hasta `endsAtIso`, con el reloj del cliente corregido por `offsetMs`
 * (US1-AS8): aunque el reloj del teléfono esté desfasado, el conteo usa la hora real del
 * servidor — `clientNowMs + offsetMs` — no la lectura cruda de `Date.now()` en el tick.
 */
export function secondsLeft(endsAtIso: string | null, offsetMs: number, clientNowMs: number): number | null {
  if (!endsAtIso) return null; // T014: cronómetro sin fin (spec 004)
  const correctedNowMs = clientNowMs + offsetMs;
  const remainingMs = new Date(endsAtIso).getTime() - correctedNowMs;
  return Math.max(0, Math.round(remainingMs / 1000));
}

/** Formatea segundos como `mm:ss`. Nunca negativo. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(safe / 60).toString().padStart(2, '0');
  const ss = (safe % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Segundos transcurridos desde `startedAtIso` (US-F1-AS9, FR-F09): el cronómetro cuenta hacia
 * arriba desde la hora de inicio que registró el servidor, con el reloj del cliente corregido por
 * `offsetMs` igual que `secondsLeft` — no con la lectura cruda de `Date.now()`. Son segundos
 * enteros (se trunca, no se redondea: el cronómetro no adelanta el segundo que aún no pasó) y
 * nunca negativos.
 */
export function elapsedSeconds(startedAtIso: string, offsetMs: number, clientNowMs: number): number {
  const correctedNowMs = clientNowMs + offsetMs;
  const elapsedMs = correctedNowMs - new Date(startedAtIso).getTime();
  return Math.max(0, Math.floor(elapsedMs / 1000));
}

/** Formatea segundos como `h:mm:ss` (US-F1-AS9): `3725` -> `1:02:05`. Nunca negativo. */
export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
  const ss = (safe % 60).toString().padStart(2, '0');
  return `${h}:${mm}:${ss}`;
}

/**
 * Estado de conexión con Pure (caso borde de spec.md: "¿Y si no hay conexión con Pure?"). Sin
 * `payload` (fetch fallido o todavía no resuelto) el modelo es 'offline'; TodayDashboard le
 * asocia la acción de reintento y el texto "No hay conexión con Pure".
 */
export function resolveConnectionState(payload: unknown): 'offline' | 'online' {
  return payload === null || payload === undefined ? 'offline' : 'online';
}

export interface TodayFooterInput {
  pending_checks: { habit_id: string; label: string }[];
  tandas_today: number;
  day_fulfilled: boolean | null;
  unidades_hoy?: number;
  min_requerido?: number | null;
}

export interface TodayFooterView {
  /** Hábitos de hoy sin responder: TodayDashboard los pinta como filas Sí/No que desaparecen al
   * responder (desaparecen porque get_today deja de devolverlos, no por estado local). */
  checks: { habit_id: string; label: string }[];
  /** "N de M tandas" si hay programa (unidades de mínimo), "N tandas hoy" sin programa, o null si no hay ninguna (FR-018: nunca "0 tandas"). */
  tandasLine: string | null;
  /** "Día cumplido", o null si no aplica. */
  dayFulfilledLine: string | null;
}

/**
 * Modelo de vista del pie de Hoy (US3-AS8, US-T1-AS10, FR-008/FR-018): a propósito solo expone estas tres
 * claves — nunca minutos totales, tandas faltantes, proyecciones de nota ni un selector de modo
 * de trabajo, aunque el backend los tuviera, porque este modelo nunca los recibe ni los calcula.
 *
 * US-T1-AS10: si `min_requerido` es numérico, devuelve "unidades de mínimo tandas" (ej. "6 de 3 tandas");
 * sin programa, usa el formato antiguo "N tandas hoy". Siempre null si cero unidades.
 */
export function buildTodayFooterView(input: TodayFooterInput): TodayFooterView {
  let tandasLine: string | null = null;

  if (input.min_requerido != null && input.unidades_hoy !== undefined) {
    // Con programa: "unidades de mínimo tandas"
    tandasLine = input.unidades_hoy > 0 ? `${input.unidades_hoy} de ${input.min_requerido} tandas` : null;
  } else if (input.tandas_today > 0) {
    // Sin programa: formato antiguo "N tandas hoy"
    tandasLine = `${input.tandas_today} tanda${input.tandas_today === 1 ? '' : 's'} hoy`;
  }

  return {
    checks: input.pending_checks,
    tandasLine,
    dayFulfilledLine: input.day_fulfilled ? 'Día cumplido' : null,
  };
}

/**
 * Describe un error de inicio de tanda (US-T3-AS1, AS2).
 * - Si status es 'success', devuelve null (sin error).
 * - Si no hay respuesta (null/undefined) o el código es 'SIN_CONEXION', devuelve el aviso de conexión.
 * - Si hay un message del servidor, lo devuelve.
 * - Si no hay message, devuelve el aviso de conexión por defecto.
 */
export function describeStartFailure(
  result: { status?: string; code?: string; message?: string } | null | undefined
): string | null {
  if (result?.status === 'success') {
    return null;
  }

  const fallbackMessage = 'No se pudo empezar la tanda. Revisa la conexión e inténtalo otra vez.';

  if (result === null || result === undefined) {
    return fallbackMessage;
  }

  if (result.code === 'SIN_CONEXION') {
    return fallbackMessage;
  }

  return result.message ?? fallbackMessage;
}

/**
 * Describe un error al terminar una sesión (US-F1-AS5, FR-F07). Igual que `describeStartFailure`,
 * pero con el aviso de conexión propio de terminar: el mensaje del servidor (por ejemplo el de
 * `CRONOMETRO_MUY_CORTO`) se muestra tal cual y `null` significa que no hubo error.
 */
export function describeFinishFailure(
  result: { status?: string; code?: string; message?: string } | null | undefined
): string | null {
  if (result?.status === 'success') {
    return null;
  }

  const fallbackMessage = 'No se pudo terminar la sesión. Revisa la conexión e inténtalo otra vez.';

  if (result === null || result === undefined || result.code === 'SIN_CONEXION') {
    return fallbackMessage;
  }

  return result.message ?? fallbackMessage;
}

/**
 * Formatea un ISO string a hora local en formato HH:MM (zona 'es-CO').
 * Usado en la pantalla Hoy para mostrar horas de inicio, fin de tanda y envío de reporte.
 */
export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * US-T1-AS11 · US-F1-AS8 (FR-F05): opciones de duración del temporizador en la pantalla Hoy
 * (10, 25, 40, 60 minutos, cada una inicia la sesión en un toque). Derivada de
 * TANDA_DURATION_OPTIONS, con el 10 marcado como opción primaria. Además de estos presets existe
 * el campo libre de 10 a 180 minutos (`parseFreeMinutes`); el cronómetro no tiene duración.
 */
export function tandaDurationOptions(): { minutes: number; isDefault: boolean }[] {
  return TANDA_DURATION_OPTIONS.map((minutes) => ({
    minutes,
    isDefault: minutes === TANDA_MINUTES_DEFAULT,
  }));
}

export type FreeMinutesResult = { ok: true; minutes: number } | { ok: false; error: string };

/**
 * US-F1-AS8 (FR-F05): valida el campo libre "Otro (10–180)" del temporizador. Solo acepta enteros
 * escritos con dígitos entre TANDA_MINUTES_MIN y TANDA_MINUTES_MAX; todo lo demás (vacío, decimal,
 * negativo, notación científica, fuera de rango) devuelve un mensaje en español que Hoy muestra
 * como una línea de texto bajo el campo.
 */
export function parseFreeMinutes(raw: string): FreeMinutesResult {
  const text = raw.trim();
  const range = `${TANDA_MINUTES_MIN} a ${TANDA_MINUTES_MAX}`;

  if (text === '') {
    return { ok: false, error: `Escribe los minutos, de ${range}.` };
  }
  if (!/^\d+$/.test(text)) {
    return { ok: false, error: `Usa un número entero de minutos, de ${range}.` };
  }

  const minutes = Number(text);
  if (minutes < TANDA_MINUTES_MIN || minutes > TANDA_MINUTES_MAX) {
    return { ok: false, error: `Los minutos van de ${range}.` };
  }
  return { ok: true, minutes };
}

/** Valor del `<select>` de objetivo para "Sin objetivo" (la opción por defecto, FR-008). */
export const OBJECTIVE_NONE_VALUE = 'none';

/** Lo que `objectiveSelectorOptions` necesita de un objetivo de `manage_objectives read`. */
export interface ObjectiveSelectorObjective {
  id: string;
  name: string;
  archived?: boolean;
  // El resto de la forma que devuelve `read`; el selector no lo usa, pero se acepta tal cual.
  subject_id?: string | null;
  weekly_target_minutes?: number | null;
}

/** Lo que necesita de una materia (las de Dexie traen `id` opcional). */
export interface ObjectiveSelectorSubject {
  id?: string;
  name: string;
}

export interface ObjectiveSelectorOption {
  /** Valor del `<option>`: `none`, `objetivo:<id>` o `materia:<id>` (el prefijo evita que un id de objetivo choque con el de una materia). */
  value: string;
  label: string;
  /** Tipo de opción: define si la sesión viaja con `objective_id` (objetivo) o `subject_id` (materia). */
  kind: 'none' | 'objetivo' | 'materia';
  id: string | null;
}

const compareNames = (a: string, b: string): number => a.localeCompare(b, 'es', { sensitivity: 'base' });

/**
 * US-F2-AS9 (FR-008 de la 001): opciones del selector de objetivo de Hoy. Primero "Sin objetivo"
 * (valor por defecto, para que empezar siga siendo un toque), luego los objetivos activos en orden
 * alfabético en español (sin distinguir mayúsculas ni tildes) y luego las materias, también en
 * orden alfabético. Los objetivos archivados no se ofrecen. Una materia sin `id` se omite: no
 * habría a qué ligar la sesión. No muta sus entradas.
 */
export function objectiveSelectorOptions(
  objetivos: readonly ObjectiveSelectorObjective[],
  materias: readonly ObjectiveSelectorSubject[]
): ObjectiveSelectorOption[] {
  const objectiveOptions: ObjectiveSelectorOption[] = objetivos
    .filter((o) => o.archived !== true)
    .map((o) => ({ value: `objetivo:${o.id}`, label: o.name, kind: 'objetivo' as const, id: o.id }))
    .sort((a, b) => compareNames(a.label, b.label));

  const subjectOptions: ObjectiveSelectorOption[] = materias
    .filter((m): m is ObjectiveSelectorSubject & { id: string } => !!m.id)
    .map((m) => ({ value: `materia:${m.id}`, label: m.name, kind: 'materia' as const, id: m.id }))
    .sort((a, b) => compareNames(a.label, b.label));

  return [
    { value: OBJECTIVE_NONE_VALUE, label: 'Sin objetivo', kind: 'none', id: null },
    ...objectiveOptions,
    ...subjectOptions,
  ];
}

/**
 * US-F2-AS9: traduce el valor elegido en el selector a los campos que `manage_tandas start`
 * acepta: `objective_id` para un objetivo, `subject_id` para una materia, nada para "Sin objetivo".
 * Un valor que ya no está entre las opciones (p. ej. el objetivo se archivó mientras estaba
 * elegido) cuenta como "Sin objetivo": empezar nunca se bloquea por esto.
 */
export function startTargetFromSelection(
  value: string,
  options: readonly ObjectiveSelectorOption[]
): { objective_id?: string; subject_id?: string } {
  const option = options.find((o) => o.value === value);
  if (!option || option.id === null) return {};
  return option.kind === 'objetivo' ? { objective_id: option.id } : { subject_id: option.id };
}

/** Lo que `quoteLineView` necesita de la frase del día (`TodayPayload.frase_del_dia`). */
export type QuoteLineInput = Pick<QuoteOfDay, 'text'> & Partial<Pick<QuoteOfDay, 'translation' | 'source'>>;

/** La frase del día lista para pintar: el latín y, si hay, la línea de abajo. */
export interface QuoteLineView {
  latin: string;
  /** "traducción · fuente"; solo la traducción o solo la fuente si falta la otra; null si faltan ambas. */
  detail: string | null;
}

/**
 * US-F5-AS7 (FR-F27): arma la línea de la frase del día en Hoy. El latín va solo y debajo, en
 * `detail`, "traducción · fuente" (si falta una de las dos va la otra sin separador; si faltan
 * ambas, `detail` es null). Cada parte se recorta y una parte en blanco cuenta como ausente. Sin
 * frase —o con el texto en blanco— devuelve null (US-F5-AS4): Hoy no pinta nada, ni contenedor
 * vacío. Es solo formato de texto: no añade comillas, iconos ni énfasis (Constitución 1.1.0).
 */
export function quoteLineView(frase: QuoteLineInput | null | undefined): QuoteLineView | null {
  if (!frase) return null;
  const latin = typeof frase.text === 'string' ? frase.text.trim() : '';
  if (latin === '') return null;

  const detail = [frase.translation, frase.source]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part !== '')
    .join(' · ');

  return { latin, detail: detail === '' ? null : detail };
}
