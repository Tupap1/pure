// Modelo de vista puro de Hoy (US1-AS8, US3-AS8). Sin dependencias de React ni del DOM, para
// que sea testeable en el entorno 'node' de Vitest (Constitución, Principio IV); useToday.ts es
// el único que lo llama desde un componente.

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
export function secondsLeft(endsAtIso: string, offsetMs: number, clientNowMs: number): number {
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
