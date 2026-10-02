// Modelo de vista puro de Hoy (US1-AS8, US3-AS8, US-T1-AS10/AS11). Sin dependencias de React ni del DOM, para
// que sea testeable en el entorno 'node' de Vitest (Constitución, Principio IV); useToday.ts es
// el único que lo llama desde un componente.

import { TANDA_DURATION_OPTIONS, TANDA_MINUTES_DEFAULT } from './constants';

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
 * Formatea un ISO string a hora local en formato HH:MM (zona 'es-CO').
 * Usado en la pantalla Hoy para mostrar horas de inicio, fin de tanda y envío de reporte.
 */
export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * US-T1-AS11: opciones de duración para iniciar una tanda (10, 25, 40, 60 minutos).
 * Se usa en la pantalla Hoy para ofrecer los botones de duración.
 * Derivada de TANDA_DURATION_OPTIONS, con el 10 marcado como opción primaria.
 */
export function tandaDurationOptions(): { minutes: number; isDefault: boolean }[] {
  return TANDA_DURATION_OPTIONS.map((minutes) => ({
    minutes,
    isDefault: minutes === TANDA_MINUTES_DEFAULT,
  }));
}
