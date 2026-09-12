import { describe, it, expect } from 'vitest';
import { projectSubjectGrade } from '@/lib/domain/subject';

// Instante fijo para las pruebas que dependen de "ahora" (US5-AS4). No corresponde a ningún
// escenario de reloj del servidor; solo fija un punto de referencia estable.
const NOW = new Date('2026-09-15T12:00:00Z');

describe('[001] US5 — Proyección de nota por materia', () => {
  it('US5-AS1 · Química (1.7 al 20%, 80% pendiente, aprobatoria 3.0, meta 4.5) da necesaria 3.33, meta 5.20 (inalcanzable) y techo 4.34', () => {
    const result = projectSubjectGrade(
      [
        { weight_percentage: 20, grade: 1.7, status: 'calificado' },
        { weight_percentage: 80, status: 'pendiente' },
      ],
      { scaleMax: 5, passingGrade: 3.0, targetGrade: 4.5 },
      NOW
    );

    expect(result.projection.consolidated).toBe(0.34);
    expect(result.projection.neededToPass).toBe(3.33);
    expect(result.projection.neededForTarget).toBe(5.2);
    expect(result.flags).toContain('meta_inalcanzable');
    expect(result.projection.ceiling).toBe(4.34);
  });

  it('US5-AS2 · pesos que suman 105% se marcan "pesos inconsistentes" y no calculan necesaria ni techo', () => {
    const result = projectSubjectGrade(
      [
        { weight_percentage: 50, grade: 4.0, status: 'calificado' },
        { weight_percentage: 55, status: 'pendiente' },
      ],
      { scaleMax: 5, passingGrade: 3.0, targetGrade: 4.5 },
      NOW
    );

    expect(result.flags).toContain('pesos_inconsistentes');
    expect(result.projection.neededToPass).toBeNull();
    expect(result.projection.neededForTarget).toBeNull();
    expect(result.projection.ceiling).toBeNull();
  });

  it('US5-AS3 · una evaluación "completado" sin nota se marca "entregado sin nota"', () => {
    const result = projectSubjectGrade(
      [
        { weight_percentage: 20, grade: 4.0, status: 'calificado' },
        { weight_percentage: 30, status: 'completado' },
        { weight_percentage: 50, status: 'pendiente' },
      ],
      { scaleMax: 5, passingGrade: 3.0, targetGrade: 4.5 },
      NOW
    );

    expect(result.flags).toContain('entregado_sin_nota');
    expect(result.projection.awaitingGradeWeight).toBe(30);
  });

  it('US5-AS4 · una evaluación pendiente cuya fecha ya pasó se marca "vencido sin registrar"', () => {
    const result = projectSubjectGrade(
      [
        { weight_percentage: 20, grade: 4.0, status: 'calificado' },
        { weight_percentage: 80, status: 'pendiente', due_date: '2026-09-01T23:59:00Z' },
      ],
      { scaleMax: 5, passingGrade: 3.0, targetGrade: 4.5 },
      NOW
    );

    expect(result.flags).toContain('vencido_sin_registrar');
  });

  it('US5-AS5 · una materia cuyo techo es menor que la aprobatoria se marca "materia perdida"', () => {
    const result = projectSubjectGrade(
      [
        { weight_percentage: 60, grade: 1.0, status: 'calificado' },
        { weight_percentage: 40, status: 'pendiente' },
      ],
      { scaleMax: 5, passingGrade: 3.0, targetGrade: 4.5 },
      NOW
    );

    expect(result.flags).toContain('materia_perdida');
    expect(result.projection.ceiling).toBe(2.6);
  });

  it('FR-027 · una materia sin evaluaciones registradas se marca "ciega"', () => {
    const result = projectSubjectGrade([], { scaleMax: 5, passingGrade: 3.0, targetGrade: 4.5 }, NOW);

    expect(result.flags).toEqual(['ciega']);
    expect(result.projection.neededToPass).toBeNull();
    expect(result.projection.ceiling).toBeNull();
  });

  it('US5-AS7 · una evaluación "entregada" con nota cuenta como calificada en cualquier vista', () => {
    const result = projectSubjectGrade(
      [{ weight_percentage: 20, grade: 4.0, status: 'entregado' }],
      { scaleMax: 5, passingGrade: 3.0, targetGrade: 4.5 },
      NOW
    );

    expect(result.projection.gradedWeight).toBe(20);
    expect(result.projection.consolidated).toBe(0.8);
  });
});
