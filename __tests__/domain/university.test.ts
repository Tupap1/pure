import { describe, it, expect } from 'vitest';
import { validateUniversity, normalizeGrade } from '@/lib/domain/university';

describe('REQ-01: Dominio de Universidad y Escalas de Calificación', () => {
  it('debe validar correctamente una universidad con escala válida (0.0 a 5.0)', () => {
    const validUni = {
      name: 'Universidad Nacional (Aeroespacial)',
      modality: 'presencial' as const,
      scale_min: 0.0,
      scale_max: 5.0,
      passing_grade: 3.0,
      color: '#38bdf8'
    };

    const result = validateUniversity(validUni);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('debe rechazar una universidad si scale_min es mayor o igual a scale_max', () => {
    const invalidUni = {
      name: 'Uni Inválida',
      modality: 'virtual' as const,
      scale_min: 5.0,
      scale_max: 0.0,
      passing_grade: 3.0,
      color: '#a855f7'
    };

    const result = validateUniversity(invalidUni);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('La escala mínima debe ser estrictamente menor que la escala máxima');
  });

  it('debe rechazar si la nota de aprobación está fuera del rango [scale_min, scale_max]', () => {
    const invalidPassingUni = {
      name: 'Uni Nota Aprobatoria Fuera de Rango',
      modality: 'presencial' as const,
      scale_min: 0.0,
      scale_max: 5.0,
      passing_grade: 6.0, // Inválido porque 6.0 > 5.0
      color: '#38bdf8'
    };

    const result = validateUniversity(invalidPassingUni);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('La nota aprobatoria debe estar dentro del rango de la escala');
  });

  it('debe normalizar correctamente una nota a porcentaje de 0 a 100%', () => {
    const uniScale5 = { scale_min: 0.0, scale_max: 5.0 };
    const uniScale100 = { scale_min: 0.0, scale_max: 100.0 };

    // 4.0 de 5.0 equivale al 80%
    expect(normalizeGrade(4.0, uniScale5)).toBe(80);
    // 75 de 100 equivale al 75%
    expect(normalizeGrade(75, uniScale100)).toBe(75);
  });
});
