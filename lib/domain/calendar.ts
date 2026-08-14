/**
 * Utilidades de calendario para las vistas de horario y asistencia.
 *
 * Existen porque el timeline móvil traía el calendario escrito a mano — los días 18 a 24, el
 * rótulo "AGOSTO 2026" y una rejilla fija de 31 celdas — de modo que mostraba el mismo mes
 * para siempre. Todo se deriva ahora de la fecha real.
 *
 * Todas las funciones trabajan sobre la fecha local del usuario y devuelven cadenas
 * `YYYY-MM-DD` construidas con sus componentes locales, nunca con `toISOString()`, que
 * desplazaría el día según la zona horaria.
 */

/** Nombres de los días, empezando en lunes, que es como se dibujan las rejillas. */
export const SHORT_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Formatea una fecha como `YYYY-MM-DD` usando sus componentes locales. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Índice del día de la semana con el lunes en 0 y el domingo en 6.
 *
 * `Date.getDay()` numera el domingo como 0, lo que desalinea cualquier rejilla que empiece
 * en lunes.
 */
export function mondayFirstIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Las siete fechas de la semana que contiene `reference`, de lunes a domingo. */
export function getWeekDates(reference: Date = new Date()): Date[] {
  const monday = new Date(reference);
  monday.setDate(monday.getDate() - mondayFirstIndex(reference));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Cantidad real de días del mes que contiene `reference` (28 a 31). */
export function getDaysInMonth(reference: Date = new Date()): number {
  return new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
}

/** Todas las fechas `YYYY-MM-DD` del mes que contiene `reference`. */
export function getMonthDateKeys(reference: Date = new Date()): string[] {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  return Array.from({ length: getDaysInMonth(reference) }, (_, i) =>
    toDateKey(new Date(year, month, i + 1))
  );
}

/**
 * Celdas vacías que hay que anteponer para que el día 1 caiga bajo su día de la semana
 * en una rejilla que empieza en lunes.
 */
export function getMonthStartOffset(reference: Date = new Date()): number {
  return mondayFirstIndex(new Date(reference.getFullYear(), reference.getMonth(), 1));
}

/** Rótulo legible del mes, por ejemplo "agosto 2026". */
export function getMonthLabel(reference: Date = new Date(), locale = 'es-ES'): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(reference);
}
