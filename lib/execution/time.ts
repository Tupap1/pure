// Aritmética de zona horaria del Módulo de Ejecución. Vive aquí, en TypeScript, y nunca en
// SQL (Constitución, Principio III): pg-mem no soporta funciones/triggers plpgsql ni
// `AT TIME ZONE`, y en producción el proceso corre en UTC (Docker), así que cualquier cálculo
// de "día local" tiene que resolver PURE_TZ explícitamente. Mismo patrón que
// lib/integrations/fireflies-sync.ts:14 (parseISO8601Date), reutilizado aquí para todo el
// módulo en vez de duplicarlo por separado en cada servicio.

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** Zona horaria del módulo. Configurable con `PURE_TZ`; por defecto la de Bogotá. */
export function resolveTimeZone(): string {
  return process.env.PURE_TZ || 'America/Bogota';
}

export interface LocalParts {
  /** Fecha local 'YYYY-MM-DD' en PURE_TZ. */
  dateKey: string;
  /** 1 = lunes ... 7 = domingo, igual que db/schema.sql:48. */
  dayOfWeek: number;
  /** Minutos transcurridos desde las 00:00 locales (0-1439). */
  minutes: number;
}

/** Descompone un instante (ISO string o Date) en fecha, día de la semana y minutos locales. */
export function localParts(input: string | Date): LocalParts {
  const date = typeof input === 'string' ? new Date(input) : input;
  const timeZone = resolveTimeZone();

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const weekday = get('weekday');

  let hour = parseInt(get('hour') || '0', 10);
  if (hour === 24) hour = 0; // algunos entornos devuelven '24' a medianoche (ver fireflies-sync.ts)
  const minute = parseInt(get('minute') || '0', 10);

  return {
    dateKey: `${year}-${month}-${day}`,
    dayOfWeek: WEEKDAY_TO_ISO[weekday] ?? 1,
    minutes: hour * 60 + minute,
  };
}

function dateKeyFromUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convierte una fecha local ('YYYY-MM-DD') y una hora local ('HH:MM'), en la zona `PURE_TZ`, a
 * su instante UTC real (usado por ejemplo para `locked_at` y el congelamiento del domingo).
 *
 * No hay forma directa en `Intl` de pedir "el offset de esta zona en este instante", así que se
 * resuelve por aproximación: se trata la fecha/hora como si ya fuera UTC (una primera
 * suposición), se observa a qué hora de pared cae ese instante en la zona objetivo, y se corrige
 * la suposición por la diferencia observada. Una sola pasada es exacta para zonas de offset fijo
 * como America/Bogota (sin horario de verano), que es el único caso que usa este módulo.
 */
export function localDateTimeToInstant(dateKey: string, timeHHMM: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = timeHHMM.split(':').map(Number);

  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const observed = localParts(new Date(naiveUtcMs));
  const [oYear, oMonth, oDay] = observed.dateKey.split('-').map(Number);
  const observedAsUtcMs = Date.UTC(
    oYear,
    oMonth - 1,
    oDay,
    Math.floor(observed.minutes / 60),
    observed.minutes % 60,
    0,
    0
  );

  const offsetMs = naiveUtcMs - observedAsUtcMs;
  return new Date(naiveUtcMs + offsetMs);
}

/**
 * Suma (o resta) días de calendario a una fecha 'YYYY-MM-DD'. Es aritmética de calendario pura:
 * ancla en UTC arbitrariamente para no arrastrar la zona horaria del host que ejecuta el
 * proceso, no representa ningún instante real.
 */
export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return dateKeyFromUtcDate(base);
}

/** Lunes de la semana ISO que contiene `dateKey` (day_of_week 1=lunes..7=domingo). */
export function mondayOf(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  const isoDayOfWeek = base.getUTCDay() === 0 ? 7 : base.getUTCDay();
  base.setUTCDate(base.getUTCDate() - (isoDayOfWeek - 1));
  return dateKeyFromUtcDate(base);
}

/** Tramo de una sesión en un día local: minutos enteros que le tocan a `date` ('YYYY-MM-DD'). */
export interface DayShareSplit {
  date: string;
  minutes: number;
}

/**
 * FR-F14a / research R6: reparte el intervalo [startIso, endIso] entre los días locales de
 * `PURE_TZ` que toca, cortando en cada medianoche local. Se usa solo con un cronómetro cerrado;
 * el temporizador nunca se reparte (lib/domain/focus.ts:sessionShares).
 *
 * Los minutos de cada tramo son acumulados con piso:
 * `floor((límite_k − inicio) / 60 s) − floor((límite_{k−1} − inicio) / 60 s)`, con el último
 * límite igual al fin. Así la suma de los tramos es exactamente `floor((fin − inicio) / 60 s)`
 * (el `actual_minutes` de la sesión) y no se pierde un minuto por redondear cada tramo por su
 * cuenta: 23:00:30 → 00:10:40 da 59 + 11 = 70, no 59 + 10 = 69.
 *
 * Un día aparece si el intervalo tiene longitud positiva dentro de él, aunque el piso le deje 0
 * minutos (23:59:30 → 00:01:00 da 0 + 1). Un fin exactamente en una medianoche no abre un tramo
 * vacío en el día siguiente. Una sesión de duración cero (o con el fin antes del inicio) da un
 * único tramo de 0 minutos en su día de inicio. Los límites salen de `localDateTimeToInstant`,
 * exacto para el offset fijo de America/Bogota; no se pide nada a SQL (Principio III).
 */
export function splitByLocalDay(startIso: string, endIso: string): DayShareSplit[] {
  const MINUTE_MS = 60_000;
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const startDate = localParts(new Date(startMs)).dateKey;
  if (!(endMs > startMs)) return [{ date: startDate, minutes: 0 }];

  const shares: DayShareSplit[] = [];
  let date = startDate;
  let flooredSoFar = 0; // floor((límite anterior − inicio) / 60 s)
  for (;;) {
    const nextDate = addDays(date, 1);
    const boundaryMs = localDateTimeToInstant(nextDate, '00:00').getTime();
    const limitMs = Math.min(boundaryMs, endMs);
    const floored = Math.floor((limitMs - startMs) / MINUTE_MS);
    shares.push({ date, minutes: floored - flooredSoFar });
    if (boundaryMs >= endMs) return shares;
    flooredSoFar = floored;
    date = nextDate;
  }
}
