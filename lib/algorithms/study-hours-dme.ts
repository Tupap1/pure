export interface SubjectDMEParams {
  credits: number;
  difficulty: number; // 1 a 5
  target_grade: number;
  current_grade: number;
}

export interface DMEOptions {
  percentageSharedTopics?: number; // 0.0 a 1.0 (Porcentaje de sinergia)
  upcomingDeliverablesWeight7Days?: number; // Suma de pesos % en los próximos 7 días
}

export interface DMEResult {
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
 */
export function calculateDME(
  subject: SubjectDMEParams,
  options: DMEOptions = {}
): DMEResult {
  const percentageSharedTopics = options.percentageSharedTopics || 0;
  const upcomingDeliverablesWeight7Days = options.upcomingDeliverablesWeight7Days || 0;

  // 1. Horas base por crédito
  const baseHours = subject.credits * 1.2;

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
  const recommendedWeeklyHours = Math.round(
    ((baseHours * difficultyMultiplier * marginFactor * synergyFactor) + urgencyBonus) * 100
  ) / 100;

  return {
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
 * Calcula el Tiempo Libre Neto Semanal restante de las 168 horas totales (REQ-06)
 */
export function calculateNetFreeTime(params: NetFreeTimeParams): number {
  const totalWeeklyHours = 168;
  const totalSleepHours = params.sleepHoursPerNight * 7;
  const occupiedHours = params.classHours + params.dmeHours + totalSleepHours;

  const raw = totalWeeklyHours - occupiedHours;
  return Math.max(0, Math.round(raw * 10) / 10);
}
