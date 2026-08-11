import { describe, it, expect } from 'vitest';
import { calculateDME, calculateNetFreeTime, calculateTotalClassHours } from '@/lib/algorithms/study-hours-dme';

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
