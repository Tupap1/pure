/**
 * Modelo de columnas de la matriz semanal de escritorio.
 *
 * Existe como módulo aparte porque la lógica de "qué clase va en qué columna" vivía
 * incrustada en ScheduleDashboard y no tenía tests: la matriz calculaba los empalmes
 * por su cuenta con `matchingSchedules.length > 1`, ignorando `periodicity`, y por eso
 * marcaba EMPALME entre tutorías de Sábado A y Sábado B aunque el detector oficial
 * (detectScheduleConflicts) ya las trataba bien.
 */

export type SabadoPeriodicity = 'semanal' | 'sabado_a' | 'sabado_b';

export interface GridColumn {
  key: string;
  label: string;
  dayNum: number; // 1 = Lunes .. 7 = Domingo
  /** null en días normales; en sábado indica a qué semana pertenece la columna. */
  sabado: 'sabado_a' | 'sabado_b' | null;
}

export interface GridScheduleLike {
  day_of_week: number;
  periodicity?: string;
}

export const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Indica si el sábado debe partirse en dos columnas: solo cuando la institución usa
 * sábados alternos y existe al menos una clase marcada como quincenal.
 */
export function shouldSplitSaturday(
  schedules: GridScheduleLike[],
  hasAlternatingSaturdays: boolean | undefined
): boolean {
  const hasSabadoAB = schedules.some(
    (s) => s.day_of_week === 6 && (s.periodicity === 'sabado_a' || s.periodicity === 'sabado_b')
  );
  return hasSabadoAB && (hasAlternatingSaturdays ?? true);
}

/**
 * Construye las columnas de la matriz, desdoblando el sábado en A y B cuando corresponde.
 */
export function buildScheduleColumns(
  schedules: GridScheduleLike[],
  hasAlternatingSaturdays: boolean | undefined
): GridColumn[] {
  const split = shouldSplitSaturday(schedules, hasAlternatingSaturdays);

  return DAY_LABELS.flatMap((day, idx): GridColumn[] => {
    const dayNum = idx + 1;
    if (dayNum === 6 && split) {
      return [
        { key: 'sab-a', label: 'Sábado A', dayNum, sabado: 'sabado_a' },
        { key: 'sab-b', label: 'Sábado B', dayNum, sabado: 'sabado_b' },
      ];
    }
    return [{ key: day, label: day, dayNum, sabado: null }];
  });
}

/**
 * Decide si un horario se dibuja en una columna dada.
 *
 * Una clase 'semanal' en sábado se dicta todas las semanas, así que aparece tanto en la
 * columna A como en la B — y por eso sí puede empalmar con una quincenal.
 */
export function belongsToColumn(sched: GridScheduleLike, col: GridColumn): boolean {
  if (sched.day_of_week !== col.dayNum) return false;
  if (!col.sabado) return true;
  const p = (sched.periodicity as SabadoPeriodicity) || 'semanal';
  return p === col.sabado || p === 'semanal';
}
