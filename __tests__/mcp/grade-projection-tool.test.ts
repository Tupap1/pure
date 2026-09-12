import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleGetGradeProjection, handleManageTandas } from '../../lib/execution/handlers';
import { handleManageUniversities, handleManageSubjects, handleManageDeliverables } from '../../mcp-server/tools-handler';

// US5 — Proyección de nota por materia (FR-027/FR-028). get_grade_projection expone, por
// materia, lo que ya calcula projectSubjectGrade (lib/domain/subject.ts, T044/T046) y además
// eleva a "alerta" (para el reporte semanal y la agenda) dos de esos casos: una materia sin
// evaluaciones ("ciega") y una materia con una evaluación próxima (<7 días) sin tandas recientes
// (últimos 7 días) — "abandonada". Esta prueba solo verifica la parte que T047 agrega
// (computeAlerts + el ensamblado del tool); la aritmética de projectSubjectGrade ya está cubierta
// en __tests__/domain/grade-projection.test.ts.

describe('[001] US5 — Proyección de nota por materia', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('US5-AS6 · una materia sin evaluaciones se marca "ciega"; con evaluación a menos de 7 días y sin tandas en 7 días, "abandonada"', async () => {
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA', scale_max: 5, passing_grade: 3.0 });
    await handleManageSubjects('create', { id: 'sub-ciega', university_id: 'uni-1', name: 'Termodinámica' });
    await handleManageSubjects('create', { id: 'sub-abandonada', university_id: 'uni-1', name: 'Química' });
    await handleManageSubjects('create', { id: 'sub-activa', university_id: 'uni-1', name: 'Cálculo' });

    // martes 15 de septiembre 2026, 10:00 Bogotá
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z'));

    // sub-abandonada: una evaluación pendiente en 3 días, cero tandas en los últimos 7 días.
    await handleManageDeliverables('create', {
      id: 'ev-quimica',
      subject_id: 'sub-abandonada',
      title: 'Parcial 2',
      weight_percentage: 30,
      status: 'pendiente',
      due_date: '2026-09-18T23:59:00.000Z',
    });

    // sub-activa: la misma evaluación próxima, pero SÍ hay una tanda reciente -> no es abandonada.
    await handleManageDeliverables('create', {
      id: 'ev-calculo',
      subject_id: 'sub-activa',
      title: 'Quiz 3',
      weight_percentage: 20,
      status: 'pendiente',
      due_date: '2026-09-18T23:59:00.000Z',
    });
    const started = await handleManageTandas('start', { subject_id: 'sub-activa' });
    expect(started.status).toBe('success');

    const res = await handleGetGradeProjection();
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;

    const data = res.data as { materias: { subject_id: string; flags: string[] }[]; alertas: { kind: string; subject_id: string }[] };

    expect(data.alertas).toContainEqual(expect.objectContaining({ kind: 'ciega', subject_id: 'sub-ciega' }));
    expect(data.alertas).toContainEqual(expect.objectContaining({ kind: 'abandonada', subject_id: 'sub-abandonada' }));
    expect(data.alertas.find((a) => a.subject_id === 'sub-activa' && a.kind === 'abandonada')).toBeUndefined();

    const ciegaEntry = data.materias.find((m) => m.subject_id === 'sub-ciega');
    expect(ciegaEntry?.flags).toContain('ciega');
  });
});
