import type { StudySessionEntity } from '../db/dexie-schema';

/** Días que abarca el heatmap del dashboard. */
export const HEATMAP_DAYS = 28;

export interface StudyHeatmapDay {
  /** Fecha en formato YYYY-MM-DD, en la zona horaria local del estudiante. */
  date: string;
  /** Horas efectivamente estudiadas ese día, de sesiones marcadas como completadas. */
  hours: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

/**
 * Convierte un instante a su fecha en la zona horaria local.
 *
 * Deliberadamente NO se usa `toISOString().slice(0, 10)`: eso da la fecha en UTC, y en una
 * zona con desfase negativo como Colombia (UTC-5) una sesión de las 22:00 se contabilizaría
 * en el día siguiente. Es el mismo desfase que se corrigió para las fechas de entrega.
 */
function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function intensityForHours(hours: number): 0 | 1 | 2 | 3 | 4 {
  if (hours === 0) return 0;
  if (hours <= 2) return 1;
  if (hours <= 4) return 2;
  if (hours <= 6) return 3;
  return 4;
}

/**
 * Construye el heatmap de estudio a partir de las sesiones realmente completadas.
 *
 * Solo cuentan las sesiones con `is_completed`: el heatmap refleja lo que el estudiante
 * estudió, no lo que tenía planeado estudiar. Un día sin sesiones registradas vale 0h, y esa
 * es información real, no un hueco que haya que rellenar con estimaciones.
 */
export function computeStudyHeatmap(
  studySessions: StudySessionEntity[],
  referenceDate: Date = new Date(),
  days: number = HEATMAP_DAYS
): StudyHeatmapDay[] {
  // Agrupar las horas completadas por fecha local, en una sola pasada sobre las sesiones.
  const hoursByDate = new Map<string, number>();

  for (const session of studySessions) {
    if (!session.is_completed || !session.scheduled_start || !session.scheduled_end) continue;

    const start = new Date(session.scheduled_start);
    const end = new Date(session.scheduled_end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours <= 0) continue;

    const key = toLocalDateKey(start);
    hoursByDate.set(key, (hoursByDate.get(key) || 0) + durationHours);
  }

  const result: StudyHeatmapDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const date = toLocalDateKey(d);

    const hours = Math.round((hoursByDate.get(date) || 0) * 10) / 10;
    result.push({ date, hours, intensity: intensityForHours(hours) });
  }

  return result;
}
