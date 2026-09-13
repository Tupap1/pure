import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handlePlanWeek,
  handleManageProgram,
  handleManageRoutineSlots,
  handleManageWeeklyReport,
} from '../../lib/execution/handlers';
import { handleManageUniversities, handleManageSubjects } from '../../mcp-server/tools-handler';
import { resolvePlanningWeek, resolveViewWeek } from '../../lib/execution/program';
import * as executionPg from '../../lib/db/execution-pg';
import type { ExecutionResult } from '../../lib/validations/schemas';
import type { ProgramWeekRecord } from '../../lib/db/execution-pg';

describe('[002] US-B1 — Planear la semana que todavía no empieza', () => {
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

  async function setupProgram() {
    return handleManageProgram('init', {
      starts_on: '2026-09-14', // lunes
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
        { min_tandas_dia: 6, phase: 'consolidacion' },
      ],
    });
  }

  it('US-B1-AS1 · el domingo resuelve la semana que arranca mañana', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-13T20:00:00.000Z')); // domingo 13

    const res = await handlePlanWeek('preview', {});
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect((res.data as any).program_week_id).toBe('pw-01');
    }
  });

  it('US-B1-AS2 · dentro de la semana resuelve la semana en curso', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z')); // martes 15

    const res = await handlePlanWeek('preview', {});
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect((res.data as any).program_week_id).toBe('pw-01');
    }
  });

  it('US-B1-AS3 · el último día de la semana resuelve la siguiente', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-20T20:00:00.000Z')); // domingo 20

    const res = await handlePlanWeek('preview', {});
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect((res.data as any).program_week_id).toBe('pw-02');
    }
  });

  it('US-B1-AS4 · antes de que empiece el programa resuelve la primera', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-12T20:00:00.000Z')); // sábado 12

    const previewRes = await handlePlanWeek('preview', {});
    expect(previewRes.status).toBe('success');
    if (previewRes.status === 'success') {
      expect((previewRes.data as any).program_week_id).toBe('pw-01');
    }

    // crear disparador y ensayar
    const slotRes = await handleManageRoutineSlots('create', {
      days_of_week: [1],
      cue_kind: 'hora',
      cue_text: 'son las 7 am',
      action_text: 'abro el cuaderno',
      anchor_time: '07:00',
    });
    expect(slotRes.status).toBe('success');
    if (slotRes.status !== 'success') return;
    const slotId = (slotRes.data as any).id;

    const rehearseRes = await handleManageRoutineSlots('rehearse', { routine_slot_id: slotId });
    expect(rehearseRes.status).toBe('success');

    // repetir con program_week_id explícito
    const rehearseExplicitRes = await handleManageRoutineSlots('rehearse', {
      routine_slot_id: slotId,
      program_week_id: 'pw-01',
    });
    expect(rehearseExplicitRes.status).toBe('success');
    if (rehearseExplicitRes.status === 'success') {
      expect((rehearseExplicitRes.data as any).ya_ensayado).toBe(true);
    }
  });

  it('US-B1-AS5 · después del programa se rechaza con mensaje de fin', async () => {
    // sin programa
    vi.setSystemTime(new Date('2026-09-12T20:00:00.000Z'));
    const noProgRes = await handlePlanWeek('preview', {});
    expect(noProgRes.status).toBe('error');
    if (noProgRes.status === 'error') {
      expect((noProgRes as any).code).toBe('NO_ENCONTRADO');
      expect((noProgRes as any).message).toMatch(/no hay un programa/i);
    }

    // crear programa
    await setupProgram();

    // después de la última semana
    vi.setSystemTime(new Date('2026-10-05T15:00:00.000Z'));
    const afterProgRes = await handlePlanWeek('preview', {});
    expect(afterProgRes.status).toBe('error');
    if (afterProgRes.status === 'error') {
      expect((afterProgRes as any).code).toBe('NO_ENCONTRADO');
      expect((afterProgRes as any).message).toMatch(/programa ya terminó/i);
    }
  });

  it('US-B1-AS6 · indicar una semana explícita la usa sin resolución', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z')); // martes 15

    const res = await handlePlanWeek('preview', { program_week_id: 'pw-03' });
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect((res.data as any).program_week_id).toBe('pw-03');
    }

    // con una semana que no existe
    const notFoundRes = await handlePlanWeek('preview', { program_week_id: 'pw-99' });
    expect(notFoundRes.status).toBe('error');
    if (notFoundRes.status === 'error') {
      expect((notFoundRes as any).code).toBe('NO_ENCONTRADO');
    }

    // open_view con semana no existente
    const openNotFoundRes = await handlePlanWeek('open_view', { program_week_id: 'pw-99' });
    expect(openNotFoundRes.status).toBe('error');
    if (openNotFoundRes.status === 'error') {
      expect((openNotFoundRes as any).code).toBe('NO_ENCONTRADO');
    }

    // rehearse con semana no existente
    const slotRes = await handleManageRoutineSlots('create', {
      days_of_week: [1],
      cue_kind: 'hora',
      cue_text: 'prueba',
      action_text: 'prueba',
      anchor_time: '07:00',
    });
    expect(slotRes.status).toBe('success');
    if (slotRes.status === 'success') {
      const slotId = (slotRes.data as any).id;
      const rehearseNotFoundRes = await handleManageRoutineSlots('rehearse', {
        routine_slot_id: slotId,
        program_week_id: 'pw-99',
      });
      expect(rehearseNotFoundRes.status).toBe('error');
      if (rehearseNotFoundRes.status === 'error') {
        expect((rehearseNotFoundRes as any).code).toBe('NO_ENCONTRADO');
      }
    }
  });

  it('US-B1-AS7 · registrar intenciones para una semana válida las guarda', async () => {
    await setupProgram();
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA' });
    await handleManageSubjects('create', { id: 'sub-1', university_id: 'uni-1', name: 'Cálculo' });

    vi.setSystemTime(new Date('2026-09-13T20:00:00.000Z')); // domingo 13

    const res = await handlePlanWeek('set_intentions', {
      program_week_id: 'pw-01',
      items: [{ subject_id: 'sub-1', strength: 8 }],
    });
    expect(res.status).toBe('success');

    // con semana que no existe
    const notFoundRes = await handlePlanWeek('set_intentions', {
      program_week_id: 'pw-99',
      items: [{ subject_id: 'sub-1', strength: 8 }],
    });
    expect(notFoundRes.status).toBe('error');
    if (notFoundRes.status === 'error') {
      expect((notFoundRes as any).code).toBe('NO_ENCONTRADO');
    }
  });

  it('US-B1-AS8 · abrir una semana futura es planeación sin compuerta', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-13T20:00:00.000Z')); // domingo 13

    // dos aperturas sin razón a pw-01
    const open1 = await handlePlanWeek('open_view', { program_week_id: 'pw-01' });
    expect(open1.status).toBe('success');
    if (open1.status === 'success') {
      expect((open1.data as any).surface).toBe('planeacion');
      expect((open1.data as any).needs_reason).toBe(false);
      expect((open1.data as any).opens_this_week).toBe(0);
      expect((open1.data as any).program_week_id).toBe('pw-01');
    }

    const open2 = await handlePlanWeek('open_view', { program_week_id: 'pw-01' });
    expect(open2.status).toBe('success');
    if (open2.status === 'success') {
      expect((open2.data as any).surface).toBe('planeacion');
      expect((open2.data as any).needs_reason).toBe(false);
      expect((open2.data as any).opens_this_week).toBe(0);
      expect((open2.data as any).program_week_id).toBe('pw-01');
    }

    // martes 15, dentro de la semana 1
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z'));

    // dos aperturas sin razón a la semana en curso
    const open3 = await handlePlanWeek('open_view', {});
    expect(open3.status).toBe('success');
    if (open3.status === 'success') {
      expect((open3.data as any).surface).toBe('semana');
      expect((open3.data as any).needs_reason).toBe(false);
      expect((open3.data as any).opens_this_week).toBe(1);
    }

    const open4 = await handlePlanWeek('open_view', {});
    expect(open4.status).toBe('success');
    if (open4.status === 'success') {
      expect((open4.data as any).surface).toBe('semana');
      expect((open4.data as any).needs_reason).toBe(false);
      expect((open4.data as any).opens_this_week).toBe(2);
    }
  });

  it('US-B1-AS9 · sin indicar semana, abre la que contiene hoy o la próxima', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-12T20:00:00.000Z')); // sábado 12

    const resSab = await handlePlanWeek('open_view', {});
    expect(resSab.status).toBe('success');
    if (resSab.status === 'success') {
      expect((resSab.data as any).program_week_id).toBe('pw-01');
      expect((resSab.data as any).surface).toBe('planeacion');
    }

    vi.setSystemTime(new Date('2026-09-20T20:00:00.000Z')); // domingo 20

    const resDom = await handlePlanWeek('open_view', {});
    expect(resDom.status).toBe('success');
    if (resDom.status === 'success') {
      expect((resDom.data as any).program_week_id).toBe('pw-01');
      expect((resDom.data as any).surface).toBe('semana');
    }
  });

  it('US-B1-AS10 · la vista previa del reporte usa solo la semana en curso', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-13T20:00:00.000Z')); // domingo 13

    const resNoWeek = await handleManageWeeklyReport('preview', {});
    expect(resNoWeek.status).toBe('error');
    if (resNoWeek.status === 'error') {
      expect((resNoWeek as any).code).toBe('NO_ENCONTRADO');
    }

    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z')); // martes 15

    const resWithWeek = await handleManageWeeklyReport('preview', {});
    expect(resWithWeek.status).toBe('success');
    if (resWithWeek.status === 'success') {
      expect((resWithWeek.data as any).payload.program_week_id).toBe('pw-01');
    }
  });

  it('resolvePlanningWeek y resolveViewWeek eligen la próxima por starts_on aunque las semanas lleguen desordenadas', () => {
    // Arreglo de semanas desordenadas
    const weeks: any[] = [
      { id: 'pw-03', week_number: 3, starts_on: '2026-09-28', phase: 'consolidacion', min_tandas_dia: 6 },
      { id: 'pw-02', week_number: 2, starts_on: '2026-09-21', phase: 'consolidacion', min_tandas_dia: 3 },
      { id: 'pw-01', week_number: 1, starts_on: '2026-09-14', phase: 'arranque', min_tandas_dia: 1 },
    ];

    // Con todayKey = '2026-09-12' (sábado), ambos deben devolver pw-01
    const planningResult = resolvePlanningWeek(weeks, '2026-09-12');
    expect(planningResult.ok).toBe(true);
    if (planningResult.ok) {
      expect(planningResult.week.id).toBe('pw-01');
    }

    const viewResult = resolveViewWeek(weeks, '2026-09-12');
    expect(viewResult.ok).toBe(true);
    if (viewResult.ok) {
      expect(viewResult.week.id).toBe('pw-01');
    }

    // Con arreglo vacío, debe devolver error
    const emptyPlanningResult = resolvePlanningWeek([], '2026-09-12');
    expect(emptyPlanningResult.ok).toBe(false);
    if (!emptyPlanningResult.ok) {
      expect(emptyPlanningResult.reason).toBe('sin_programa');
    }

    const emptyViewResult = resolveViewWeek([], '2026-09-12');
    expect(emptyViewResult.ok).toBe(false);
    if (!emptyViewResult.ok) {
      expect(emptyViewResult.reason).toBe('sin_programa');
    }

    // Con todayKey = '2026-10-05' (después del programa), debe devolver 'programa_terminado'
    const afterPlanningResult = resolvePlanningWeek(weeks, '2026-10-05');
    expect(afterPlanningResult.ok).toBe(false);
    if (!afterPlanningResult.ok) {
      expect(afterPlanningResult.reason).toBe('programa_terminado');
    }

    const afterViewResult = resolveViewWeek(weeks, '2026-10-05');
    expect(afterViewResult.ok).toBe(false);
    if (!afterViewResult.ok) {
      expect(afterViewResult.reason).toBe('programa_terminado');
    }
  });

  it('dos aperturas simultáneas de la vista cuentan como una y ninguna falla', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z')); // martes 15, dentro de la semana 1

    const [a, b] = await Promise.all([handlePlanWeek('open_view', {}), handlePlanWeek('open_view', {})]);

    expect(a.status).toBe('success');
    if (a.status === 'success') {
      expect((a.data as any).opens_this_week).toBe(1);
    }

    expect(b.status).toBe('success');
    if (b.status === 'success') {
      expect((b.data as any).opens_this_week).toBe(1);
    }

    // Tercera apertura en serie: debe contar como 2
    const c = await handlePlanWeek('open_view', {});
    expect(c.status).toBe('success');
    if (c.status === 'success') {
      expect((c.data as any).opens_this_week).toBe(2);
    }
  });

  it('dos aperturas de planeación simultáneas no fallan', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-13T20:00:00.000Z')); // domingo 13

    const [a, b] = await Promise.all([
      handlePlanWeek('open_view', { program_week_id: 'pw-01' }),
      handlePlanWeek('open_view', { program_week_id: 'pw-01' }),
    ]);

    expect(a.status).toBe('success');
    if (a.status === 'success') {
      expect((a.data as any).surface).toBe('planeacion');
    }

    expect(b.status).toBe('success');
    if (b.status === 'success') {
      expect((b.data as any).surface).toBe('planeacion');
    }
  });

  it('si guardar la apertura falla, open_view responde error y no la da por hecha', async () => {
    await setupProgram();

    // Semana en curso (surface semana)
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z'));
    const spySemana = vi.spyOn(executionPg, 'savePlanViewToDb').mockRejectedValueOnce(new Error('base caída'));
    try {
      const res = await handlePlanWeek('open_view', {});
      expect(spySemana).toHaveBeenCalledTimes(1);
      expect(res.status).toBe('error');
    } finally {
      spySemana.mockRestore();
    }

    // Semana futura (surface planeacion)
    vi.setSystemTime(new Date('2026-09-13T20:00:00.000Z'));
    const spyPlaneacion = vi.spyOn(executionPg, 'savePlanViewToDb').mockRejectedValueOnce(new Error('base caída'));
    try {
      const res = await handlePlanWeek('open_view', { program_week_id: 'pw-01' });
      expect(spyPlaneacion).toHaveBeenCalledTimes(1);
      expect(res.status).toBe('error');
    } finally {
      spyPlaneacion.mockRestore();
    }
  });
});
