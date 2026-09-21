import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageTandas, handleGetToday } from '../../lib/execution/handlers';
import { handleManageProgram, handleGetComplianceReport } from '../../lib/execution/handlers';

// US-T1 — Tandas de duración variable, hasta 60 minutos (FR-T01..FR-T09).
// El rango pasa de 5-25 a 10-60, y el mínimo diario se compara contra unidades,
// no contra filas: una tanda completada vale max(1, floor(actual_minutes / 10)) unidades.

describe('[003] US-T1 — Tandas de duración variable', () => {
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

  // US-T1-AS1: start con planned_minutes: 60 crea tanda con esa duración
  it('US-T1-AS1 · start con 60 minutos deja la tanda en curso con fin previsto 60 minutos después', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));

    const res = await handleManageTandas('start', { planned_minutes: 60 });
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;

    const { tanda, ends_at } = res.data as any;
    expect(tanda.status).toBe('en_curso');
    expect(tanda.planned_minutes).toBe(60);
    expect(new Date(tanda.started_at).toISOString()).toBe('2026-09-14T15:00:00.000Z');
    expect(ends_at).toBe('2026-09-14T16:00:00.000Z');
  });

  // US-T1-AS2: start sin duración sigue usando 10 minutos
  it('US-T1-AS2 · start sin duración usa 10 minutos por defecto', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));

    const res = await handleManageTandas('start', {});
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;

    const { tanda } = res.data as any;
    expect(tanda.planned_minutes).toBe(10);
  });

  // US-T1-AS3: start con 9 o 61 minutos se rechaza
  it('US-T1-AS3 · start con 9 minutos se rechaza con DATOS_INVALIDOS', async () => {
    const res = await handleManageTandas('start', { planned_minutes: 9 });
    expect(res.status).toBe('error');
    if (res.status === 'error') {
      expect(res.code).toBe('DATOS_INVALIDOS');
    }
  });

  it('US-T1-AS3 · start con 61 minutos se rechaza con DATOS_INVALIDOS', async () => {
    const res = await handleManageTandas('start', { planned_minutes: 61 });
    expect(res.status).toBe('error');
    if (res.status === 'error') {
      expect(res.code).toBe('DATOS_INVALIDOS');
    }
  });

  // US-T1-AS5: día con tanda de 60 min cumple mínimo de 3
  it('US-T1-AS5 · con min_tandas_dia=3 y una tanda completada de 60 minutos, el día queda cumplido con unidades_completadas=6', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [{ min_tandas_dia: 3, phase: 'arranque' }],
    });

    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const start = await handleManageTandas('start', { planned_minutes: 60 });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;
    const tandaId = (start.data as any).tanda.id;

    // Completa la tanda
    vi.setSystemTime(new Date('2026-09-14T16:00:01.000Z'));
    const today = await handleGetToday();
    expect(today.status).toBe('success');
    if (today.status === 'success') {
      const payload = today.data as any;
      expect(payload.evaluacion_dia).not.toBeNull();
      expect(payload.evaluacion_dia.tandas_completadas).toBe(1);
      expect(payload.evaluacion_dia.unidades_completadas).toBe(6);
      expect(payload.evaluacion_dia.cumplio_tandas).toBe(true);
    }
  });

  // US-T1-AS6: día con tanda de 25 y 10 minutos
  it('US-T1-AS6 · un día con tandas de 25 y 10 minutos da tandas_completadas=2 y unidades_completadas=3', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [{ min_tandas_dia: 1, phase: 'arranque' }],
    });

    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const start1 = await handleManageTandas('start', { planned_minutes: 25 });
    expect(start1.status).toBe('success');
    if (start1.status !== 'success') return;
    const tanda1Id = (start1.data as any).tanda.id;

    vi.setSystemTime(new Date('2026-09-14T15:25:01.000Z'));
    await handleManageTandas('current', {}); // cierra la primera

    vi.setSystemTime(new Date('2026-09-14T16:00:00.000Z'));
    const start2 = await handleManageTandas('start', { planned_minutes: 10 });
    expect(start2.status).toBe('success');
    if (start2.status !== 'success') return;

    vi.setSystemTime(new Date('2026-09-14T16:10:01.000Z'));
    const today = await handleGetToday();
    expect(today.status).toBe('success');
    if (today.status === 'success') {
      const payload = today.data as any;
      expect(payload.evaluacion_dia.tandas_completadas).toBe(2);
      expect(payload.evaluacion_dia.unidades_completadas).toBe(3); // 2 + 1
    }

    const report = await handleGetComplianceReport();
    expect(report.status).toBe('success');
    if (report.status === 'success') {
      const data = report.data as any;
      const dayReport = data.dias.find((d: any) => d.date === '2026-09-14');
      expect(dayReport).toBeDefined();
      expect(dayReport.evaluacion_dia.tandas_completadas).toBe(2);
      expect(dayReport.evaluacion_dia.unidades_completadas).toBe(3);
    }
  });

  // US-T1-AS7: resumen por día trae unidades
  it('US-T1-AS7 · manage_tandas.read trae unidades en el resumen por día', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const start = await handleManageTandas('start', { planned_minutes: 40 });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;

    vi.setSystemTime(new Date('2026-09-14T15:40:01.000Z'));
    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      const data = read.data as any;
      expect(data.por_dia).toBeDefined();
      expect(Array.isArray(data.por_dia)).toBe(true);
      const today = data.por_dia.find((d: any) => d.date === '2026-09-14');
      expect(today).toBeDefined();
      expect(today.unidades).toBe(4); // floor(40 / 10) = 4
      expect(today.completadas).toBe(1);
    }
  });

  // US-T1-AS8: regresión - tanda de 60 min está en curso a los 59, completada a los 60
  it('US-T1-AS8 · una tanda de 60 minutos sigue en curso a los 59 y aparece completada a los 60 sin margen', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const start = await handleManageTandas('start', { planned_minutes: 60 });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;
    const tandaId = (start.data as any).tanda.id;

    // A los 59 minutos, debe estar en curso
    vi.setSystemTime(new Date('2026-09-14T15:59:00.000Z'));
    let current = await handleManageTandas('current', {});
    expect(current.status).toBe('success');
    if (current.status === 'success') {
      expect((current.data as any).tanda).not.toBeNull();
      expect((current.data as any).tanda.status).toBe('en_curso');
    }

    // A los 60 minutos, debe estar completada
    vi.setSystemTime(new Date('2026-09-14T16:00:01.000Z'));
    current = await handleManageTandas('current', {});
    expect(current.status).toBe('success');
    if (current.status === 'success') {
      expect((current.data as any).tanda).toBeNull(); // ya no hay tanda en curso
    }

    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      const closed = (read.data as any).tandas.find((t: any) => t.id === tandaId);
      expect(closed.status).toBe('completada');
      expect(closed.actual_minutes).toBe(60);
    }
  });
});
