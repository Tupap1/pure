import { describe, it, expect } from 'vitest';
import {
  calculateDME,
  calculateNetFreeTime,
  calculateTotalClassHours,
  calculateCreditLoad,
  HOURS_PER_CREDIT_PER_SEMESTER,
  DEFAULT_SEMESTER_WEEKS,
} from '@/lib/algorithms/study-hours-dme';

describe('REQ-06: Algoritmo de Dosis Mínima Eficaz (DME) y Tiempo Libre', () => {
  it('debe calcular las horas semanales DME basadas en el estándar de Educación Superior (2h estudio independiente / crédito)', () => {
    const subject = {
      credits: 3,
      difficulty: 4, // Multiplicador: 0.8 + 4*0.1 = 1.2
      target_grade: 4.5,
      current_grade: 3.5, // Brecha: 4.5 - 3.5 = 1.0 -> Factor margen = 1.0 + 1.0 = 2.0
    };

    // Base Estándar Académico = 3 créditos * 2.0h = 6.0 horas estudio independiente
    // DME Base = 6.0 * 1.2 (dificultad) * 2.0 (margen) * 1.0 (sinergia) = 14.4 horas
    const result = calculateDME(subject, { percentageSharedTopics: 0, upcomingDeliverablesWeight7Days: 0 });
    
    expect(result.recommendedWeeklyHours).toBeGreaterThan(14.0);
    expect(result.recommendedWeeklyHours).toBeLessThan(15.0);
  });

  it('debe reducir las horas DME cuando la materia tiene alta sinergia temática compartida', () => {
    const subject = {
      credits: 3,
      difficulty: 3,
      target_grade: 4.0,
      current_grade: 4.0, // Nota igual a meta -> Factor margen = 0.8
    };

    const withoutSynergy = calculateDME(subject, { percentageSharedTopics: 0, upcomingDeliverablesWeight7Days: 0 });
    const with50PercentSynergy = calculateDME(subject, { percentageSharedTopics: 0.5, upcomingDeliverablesWeight7Days: 0 });

    expect(with50PercentSynergy.recommendedWeeklyHours).toBeLessThan(withoutSynergy.recommendedWeeklyHours);
  });

  it('debe calcular el tiempo libre neto semanal restando clases, estudio DME y sueño de las 168h', () => {
    const totalClassHours = 20;
    const totalDMEHours = 10;
    const estimatedSleepHoursPerNight = 7; // 49h por semana

    // 168 - (20 + 10 + 49) = 168 - 79 = 89 horas libres
    const netFreeTime = calculateNetFreeTime({
      classHours: totalClassHours,
      dmeHours: totalDMEHours,
      sleepHoursPerNight: estimatedSleepHoursPerNight
    });

    expect(netFreeTime).toBe(89);
  });

  it('debe ponderar con 0.5 las clases quincenales (sabado_a / sabado_b) al calcular el total de horas de clase', () => {
    const schedules = [
      { start_time: '08:00', end_time: '12:00', periodicity: 'sabado_a' as const }, // 4h quincenal -> 2h
      { start_time: '14:00', end_time: '18:00', periodicity: 'sabado_b' as const }, // 4h quincenal -> 2h
      { start_time: '18:00', end_time: '20:00', periodicity: 'semanal' as const },  // 2h semanal -> 2h
    ];

    const totalHours = calculateTotalClassHours(schedules);
    expect(totalHours).toBe(6); // 2 + 2 + 2 = 6h
  });

  it('debe calcular duraciones exactas con minutos fraccionales (ej: 09:00 a 10:30 es 1.5h)', () => {
    const schedules = [
      { start_time: '09:00', end_time: '10:30', periodicity: 'semanal' as const }, // 1.5h
      { start_time: '14:00', end_time: '17:30', periodicity: 'sabado_a' as const }, // 3.5h * 0.5 = 1.75h
    ];

    const totalHours = calculateTotalClassHours(schedules);
    expect(totalHours).toBe(3.25);
  });
});

describe('REQ-06: Carga por créditos según la norma colombiana (Decreto 1075 de 2015)', () => {
  it('expone la equivalencia legal de 48 horas por crédito en un semestre de 16 semanas', () => {
    expect(HOURS_PER_CREDIT_PER_SEMESTER).toBe(48);
    expect(DEFAULT_SEMESTER_WEEKS).toBe(16);

    // 1 crédito = 48h / 16 semanas = 3h por semana de trabajo académico total.
    const oneCredit = calculateCreditLoad({ credits: 1 }, []);
    expect(oneCredit.weeklyTotalHours).toBe(3);
  });

  it('reparte la carga de una materia presencial en la relación 1:2 que fija la norma', () => {
    // 4 créditos presenciales con 4h semanales de clase (dos bloques de 2h).
    const schedules = [
      { start_time: '08:00', end_time: '10:00', periodicity: 'semanal' as const },
      { start_time: '10:00', end_time: '12:00', periodicity: 'semanal' as const },
    ];

    const load = calculateCreditLoad({ credits: 4 }, schedules);

    expect(load.semesterHours).toBe(192); // 4 * 48
    expect(load.weeklyTotalHours).toBe(12); // 192 / 16
    expect(load.weeklyClassHours).toBe(4);
    expect(load.weeklyIndependentHours).toBe(8); // 12 - 4
    expect(load.accompanimentRatio).toBe(2); // exactamente la relación 1:2 de pregrado presencial
    expect(load.hasNoSchedule).toBe(false);
    expect(load.exceedsNorm).toBe(false);
  });

  it('asigna más trabajo independiente a una materia a distancia que a una presencial de los mismos créditos', () => {
    const presencial = calculateCreditLoad({ credits: 3 }, [
      { start_time: '08:00', end_time: '11:00', periodicity: 'semanal' as const }, // 3h de clase
    ]);
    const distancia = calculateCreditLoad({ credits: 3 }, [
      { start_time: '18:00', end_time: '19:30', periodicity: 'semanal' as const }, // 1.5h de tutoría
    ]);

    // Misma exigencia total (9h/sem), repartida distinto según el acompañamiento real.
    expect(presencial.weeklyTotalHours).toBe(9);
    expect(distancia.weeklyTotalHours).toBe(9);

    expect(presencial.weeklyIndependentHours).toBe(6);
    expect(distancia.weeklyIndependentHours).toBe(7.5);
    expect(distancia.weeklyIndependentHours).toBeGreaterThan(presencial.weeklyIndependentHours);
  });

  it('atribuye todo el total normativo al trabajo independiente cuando la materia no tiene horario registrado', () => {
    const load = calculateCreditLoad({ credits: 3 }, []);

    expect(load.weeklyClassHours).toBe(0);
    expect(load.weeklyIndependentHours).toBe(9); // la totalidad de 3 * 3h
    expect(load.accompanimentRatio).toBeNull(); // la relación no es calculable sin clase
    expect(load.hasNoSchedule).toBe(true);
  });

  it('propaga la ponderación 0.5 de las clases quincenales de sábado al reparto de la carga', () => {
    const load = calculateCreditLoad({ credits: 3 }, [
      { start_time: '08:00', end_time: '12:00', periodicity: 'sabado_a' as const }, // 4h quincenal -> 2h/sem
    ]);

    expect(load.weeklyClassHours).toBe(2);
    expect(load.weeklyIndependentHours).toBe(7); // 9 - 2
  });

  it('marca la materia cuyas horas de clase ya superan el total que exige la norma', () => {
    // 1 crédito solo da 3h/sem de trabajo académico, pero el horario registra 5h de clase.
    const load = calculateCreditLoad({ credits: 1 }, [
      { start_time: '08:00', end_time: '13:00', periodicity: 'semanal' as const },
    ]);

    expect(load.exceedsNorm).toBe(true);
    expect(load.weeklyIndependentHours).toBe(0); // nunca negativo
  });

  it('permite un semestre de duración distinta a las 16 semanas por defecto', () => {
    const load = calculateCreditLoad({ credits: 3 }, [], 18);

    expect(load.semesterHours).toBe(144); // el total del semestre no cambia
    expect(load.weeklyTotalHours).toBe(8); // 144 / 18, repartido en más semanas
  });
});

describe('REQ-06: DME derivado de la norma y balance con déficit visible', () => {
  it('usa las horas independientes derivadas de la norma como base cuando se le pasan', () => {
    const subject = { credits: 3, difficulty: 3, target_grade: 4.0, current_grade: 0 };
    // Dificultad 3 -> 1.1; sin nota registrada -> margen neutral 1.0.

    const conNorma = calculateDME(subject, { baseIndependentHours: 7.5 });
    expect(conNorma.normativeWeeklyHours).toBe(7.5);
    expect(conNorma.recommendedWeeklyHours).toBe(8.25); // 7.5 * 1.1

    const sinNorma = calculateDME(subject);
    expect(sinNorma.normativeWeeklyHours).toBe(6); // se cae al supuesto presencial 3 * 2.0
    expect(sinNorma.recommendedWeeklyHours).toBe(6.6);
  });

  it('separa la exigencia normativa de la recomendación ajustada a la situación del estudiante', () => {
    const subject = { credits: 3, difficulty: 5, target_grade: 4.5, current_grade: 3.5 };

    const result = calculateDME(subject, { baseIndependentHours: 6 });

    // La norma no se mueve por la dificultad ni por la brecha de nota.
    expect(result.normativeWeeklyHours).toBe(6);
    // La recomendación sí: 6 * 1.3 (dificultad 5) * 2.0 (brecha de 1.0) = 15.6
    expect(result.recommendedWeeklyHours).toBe(15.6);
    expect(result.recommendedWeeklyHours).toBeGreaterThan(result.normativeWeeklyHours);
  });

  it('devuelve un tiempo libre negativo cuando la carga académica supera las 168h de la semana', () => {
    // 168 - (30 clase + 100 independiente + 49 sueño) = -11
    const netFreeTime = calculateNetFreeTime({
      classHours: 30,
      dmeHours: 100,
      sleepHoursPerNight: 7,
    });

    expect(netFreeTime).toBe(-11);
  });
});
