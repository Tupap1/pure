import { getSlotPeriodicity } from './conflict-detector';

/**
 * Norma colombiana de créditos académicos.
 *
 * Decreto 1075 de 2015 (que compila el Decreto 1295 de 2010): un (1) crédito académico
 * equivale a cuarenta y ocho (48) horas de trabajo académico del estudiante por período,
 * repartidas entre horas de acompañamiento directo del docente y horas de trabajo independiente.
 *
 * En un semestre de 16 semanas eso equivale a 3 h/semana por crédito. En pregrado presencial
 * la relación típica es 1:2 (por cada hora de clase, dos de trabajo independiente), pero esa
 * relación NO se asume aquí: se deriva restando las horas de clase reales del horario, de modo
 * que un programa a distancia — con menos acompañamiento directo — reciba automáticamente más
 * carga de trabajo independiente, tal como manda la norma.
 */
export const HOURS_PER_CREDIT_PER_SEMESTER = 48;
export const DEFAULT_SEMESTER_WEEKS = 16;

/** Horas de una semana calendario. Denominador del balance de tiempo. */
export const TOTAL_WEEKLY_HOURS = 168;

export interface ClassScheduleHoursInput {
  start_time: string;
  end_time: string;
  periodicity?: 'semanal' | 'sabado_a' | 'sabado_b';
  classroom?: string;
  has_alternating_saturdays?: boolean;
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calcula la suma total de horas semanales de clase.
 * Duración calculada en minutos para soportar fracciones (ej: 09:00 a 10:30 = 1.5h).
 * Pondera 0.5 para horarios de Sábado A / Sábado B, porque esas clases se dictan en
 * semanas alternas: en promedio ocupan la mitad de su duración por semana.
 */
export function calculateTotalClassHours(schedules: ClassScheduleHoursInput[]): number {
  return schedules.reduce((sum, s) => {
    const startMins = parseTimeToMinutes(s.start_time);
    const endMins = parseTimeToMinutes(s.end_time);
    const durationHours = Math.max(0, (endMins - startMins) / 60);

    const periodicity = getSlotPeriodicity(s);
    const weight = (periodicity === 'sabado_a' || periodicity === 'sabado_b') ? 0.5 : 1.0;

    return sum + (durationHours * weight);
  }, 0);
}

export interface CreditLoadBreakdown {
  credits: number;
  /** Horas de trabajo académico total que la norma exige por semestre: créditos × 48. */
  semesterHours: number;
  /** El mismo total repartido en las semanas del semestre: créditos × 3 h/sem con 16 semanas. */
  weeklyTotalHours: number;
  /** Horas de acompañamiento directo, medidas del horario real de la materia. */
  weeklyClassHours: number;
  /** El resto del total normativo: lo que corresponde estudiar por cuenta propia. */
  weeklyIndependentHours: number;
  /**
   * Horas independientes por cada hora de clase. La norma de pregrado presencial apunta a 2.0.
   * `null` cuando la materia no tiene horario registrado y la relación no es calculable.
   */
  accompanimentRatio: number | null;
  /** No hay horarios registrados: todo el total normativo se atribuye a trabajo independiente. */
  hasNoSchedule: boolean;
  /** Las horas de clase por sí solas ya superan el total que exige la norma para esos créditos. */
  exceedsNorm: boolean;
}

/**
 * Reparte la carga normativa de una materia entre acompañamiento directo y trabajo independiente.
 *
 * El total lo fija la norma (créditos × 48h por semestre); las horas de clase salen del horario
 * real del estudiante, y el trabajo independiente es la diferencia. Por eso una materia a
 * distancia con 1.5h de tutoría semanal recibe más trabajo independiente que una presencial de
 * los mismos créditos con 4h de clase: es la misma exigencia total repartida distinto.
 */
export function calculateCreditLoad(
  subject: { credits: number },
  subjectSchedules: ClassScheduleHoursInput[] = [],
  semesterWeeks: number = DEFAULT_SEMESTER_WEEKS
): CreditLoadBreakdown {
  const credits = Math.max(0, subject.credits || 0);
  const weeks = semesterWeeks > 0 ? semesterWeeks : DEFAULT_SEMESTER_WEEKS;

  const semesterHours = credits * HOURS_PER_CREDIT_PER_SEMESTER;
  const weeklyTotalHours = roundTo(semesterHours / weeks, 2);
  const weeklyClassHours = roundTo(calculateTotalClassHours(subjectSchedules), 2);
  const weeklyIndependentHours = roundTo(Math.max(0, weeklyTotalHours - weeklyClassHours), 2);

  return {
    credits,
    semesterHours,
    weeklyTotalHours,
    weeklyClassHours,
    weeklyIndependentHours,
    accompanimentRatio: weeklyClassHours > 0 ? roundTo(weeklyIndependentHours / weeklyClassHours, 2) : null,
    hasNoSchedule: subjectSchedules.length === 0 || weeklyClassHours === 0,
    exceedsNorm: weeklyClassHours > weeklyTotalHours,
  };
}

export interface SubjectDMEParams {
  credits: number;
  difficulty: number; // 1 a 5
  target_grade: number;
  current_grade: number;
}

export interface DMEOptions {
  percentageSharedTopics?: number; // 0.0 a 1.0 (Porcentaje de sinergia)
  upcomingDeliverablesWeight7Days?: number; // Suma de pesos % en los próximos 7 días
  /**
   * Horas de trabajo independiente que exige la norma para esta materia, normalmente
   * `calculateCreditLoad(...).weeklyIndependentHours`. Si se omite, se cae al supuesto
   * presencial de 2h por crédito.
   */
  baseIndependentHours?: number;
}

export interface DMEResult {
  /** Lo que exige la norma, sin ajustar. Es el número "oficial", no una recomendación. */
  normativeWeeklyHours: number;
  /** La norma ajustada por dificultad, brecha de nota, sinergia y urgencia de entregas. */
  recommendedWeeklyHours: number;
  breakdown: {
    baseHours: number;
    difficultyMultiplier: number;
    marginFactor: number;
    synergyFactor: number;
    urgencyBonus: number;
  };
}

/**
 * Calcula la Dosis Mínima Eficaz (DME) de horas de estudio semanal para una materia (REQ-06)
 * Ajustado para soportar inicio de semestre (current_grade === 0) y carga multi-carrera de 12 materias.
 *
 * Devuelve dos cifras deliberadamente separadas: `normativeWeeklyHours` (lo que manda el
 * Decreto 1075) y `recommendedWeeklyHours` (esa base ajustada a la situación del estudiante),
 * para que la UI nunca presente una sugerencia personalizada como si fuera la exigencia legal.
 */
export function calculateDME(
  subject: SubjectDMEParams,
  options: DMEOptions = {}
): DMEResult {
  const percentageSharedTopics = options.percentageSharedTopics || 0;
  const upcomingDeliverablesWeight7Days = options.upcomingDeliverablesWeight7Days || 0;

  // 1. Horas base de trabajo independiente. Se prefiere la derivación normativa (norma menos
  //    horas de clase reales); sin ella se usa el supuesto presencial 1:2 de la norma
  //    (48h/semestre en 16 semanas = 3h/sem por crédito -> 1h clase + 2h estudio independiente).
  const baseHours = options.baseIndependentHours !== undefined
    ? Math.max(0, options.baseIndependentHours)
    : subject.credits * 2.0;

  // 2. Multiplicador por dificultad (1 a 5 -> 0.9 a 1.3)
  const difficultyMultiplier = 0.8 + (subject.difficulty * 0.1);

  // 3. Factor de margen de nota
  let marginFactor = 1.0;

  // Si está iniciando el semestre (current_grade === 0 o no registrado), la brecha NO se penaliza
  if (!subject.current_grade || subject.current_grade === 0) {
    marginFactor = 1.0; // Estado neutral inicial de semestre
  } else if (subject.current_grade >= subject.target_grade + 0.5) {
    marginFactor = 0.6; // Excelente margen -> Reducir horas
  } else if (subject.current_grade >= subject.target_grade) {
    marginFactor = 0.8; // Cumpliendo meta -> Ligera reducción
  } else {
    const gradeGap = subject.target_grade - subject.current_grade;
    if (gradeGap > 0) {
      marginFactor = 1.0 + Math.min(1.0, gradeGap); // Incremento controlado por brecha
    }
  }

  // 4. Factor de descuento por sinergia temática (ej: 50% compartido -> 0.85 multiplicador)
  const synergyFactor = 1.0 - (0.3 * percentageSharedTopics);

  // 5. Bonus por urgencia de entregas en 7 días
  const urgencyBonus = upcomingDeliverablesWeight7Days * 0.05;

  // Cálculo final
  const recommendedWeeklyHours = roundTo(
    (baseHours * difficultyMultiplier * marginFactor * synergyFactor) + urgencyBonus,
    2
  );

  return {
    normativeWeeklyHours: roundTo(baseHours, 2),
    recommendedWeeklyHours,
    breakdown: {
      baseHours,
      difficultyMultiplier,
      marginFactor,
      synergyFactor,
      urgencyBonus
    }
  };
}

export interface NetFreeTimeParams {
  classHours: number;
  dmeHours: number;
  sleepHoursPerNight: number;
}

/**
 * Calcula el Tiempo Libre Neto Semanal restante de las 168 horas totales (REQ-06).
 *
 * El resultado puede ser NEGATIVO a propósito: si la carga académica más el sueño superan las
 * 168h de la semana, el déficit es la información útil. Recortarlo a cero haría que una semana
 * imposible se viera igual que una semana apenas ajustada.
 */
export function calculateNetFreeTime(params: NetFreeTimeParams): number {
  const totalSleepHours = params.sleepHoursPerNight * 7;
  const occupiedHours = params.classHours + params.dmeHours + totalSleepHours;

  return roundTo(TOTAL_WEEKLY_HOURS - occupiedHours, 1);
}
