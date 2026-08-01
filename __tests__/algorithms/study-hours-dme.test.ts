import { describe, it, expect } from 'vitest';
import { calculateDME, calculateNetFreeTime } from '@/lib/algorithms/study-hours-dme';

describe('REQ-06: Algoritmo de Dosis Mínima Eficaz (DME) y Tiempo Libre', () => {
  it('debe calcular las horas semanales DME para una materia basada en créditos, dificultad y brecha de nota', () => {
    const subject = {
      credits: 3,
      difficulty: 4, // Multiplicador: 0.8 + 4*0.1 = 1.2
      target_grade: 4.5,
      current_grade: 3.5, // Brecha: 4.5 - 3.5 = 1.0 -> Factor margen = 1.0 + 1.0 = 2.0
    };

    // Base: 3 créditos * 1.2 = 3.6 horas
    // DME Base = 3.6 * 1.2 (dificultad) * 2.0 (margen) * 1.0 (sinergia) = 8.64 horas
    const result = calculateDME(subject, { percentageSharedTopics: 0, upcomingDeliverablesWeight7Days: 0 });
    
    expect(result.recommendedWeeklyHours).toBeGreaterThan(8.5);
    expect(result.recommendedWeeklyHours).toBeLessThan(9.0);
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

    // La sinergia debe reducir las horas requeridas
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
});
