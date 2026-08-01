import { describe, it, expect } from 'vitest';
import { calculateWeightedGrade, calculateRequiredGradeForRemaining } from '@/lib/domain/subject';

describe('REQ-02: Dominio de Asignaturas y Cálculo de Notas Ponderadas', () => {
  it('debe calcular correctamente la nota actual ponderada basada en los trabajos calificados', () => {
    const deliverables = [
      { weight_percentage: 20, grade: 4.5, status: 'calificado' as const },
      { weight_percentage: 30, grade: 3.5, status: 'calificado' as const },
      { weight_percentage: 50, grade: 0.0, status: 'pendiente' as const },
    ];

    // (4.5 * 20 + 3.5 * 30) / (20 + 30) = (90 + 105) / 50 = 195 / 50 = 3.9
    const result = calculateWeightedGrade(deliverables);
    expect(result.currentGrade).toBe(3.9);
    expect(result.evaluatedWeightPercentage).toBe(50);
  });

  it('debe calcular correctamente la nota mínima requerida en el porcentaje restante para alcanzar la nota meta', () => {
    const deliverables = [
      { weight_percentage: 40, grade: 3.0, status: 'calificado' as const }, // Aporta 1.2
      { weight_percentage: 60, grade: undefined, status: 'pendiente' as const }, // Restante 60%
    ];

    const targetGrade = 4.0; // Se necesita 4.0 final -> Total acumulado necesario: 4.0 * 100 = 400 puntos
    // Puntos obtenidos: 3.0 * 40 = 120 puntos. Puntos faltantes: 400 - 120 = 280 puntos.
    // Nota requerida en el 60% restante: 280 / 60 = 4.67

    const required = calculateRequiredGradeForRemaining(deliverables, targetGrade);
    expect(required).toBe(4.67);
  });

  it('debe retornar null si ya se evaluó el 100% de la materia', () => {
    const deliverables = [
      { weight_percentage: 100, grade: 4.2, status: 'calificado' as const }
    ];

    const required = calculateRequiredGradeForRemaining(deliverables, 4.5);
    expect(required).toBeNull();
  });
});
