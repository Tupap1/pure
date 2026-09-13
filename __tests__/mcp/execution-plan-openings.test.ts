import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleManageProgram,
  handlePlanWeek,
  handleGetComplianceReport,
  handleManageWeeklyReport,
} from '../../lib/execution/handlers';
import { runExecutionTick, type Pusher } from '../../lib/execution/tick';
import { renderReportText } from '../../lib/execution/report';

interface FakePusher extends Pusher {
  calls: Array<{ title: string; body: string; url: string; tag: string }>;
}

function makeFakePusher(): FakePusher {
  const calls: FakePusher['calls'] = [];
  return {
    calls,
    async notify(payload) {
      calls.push(payload);
      return { sent: 1, removed: 0 };
    },
  };
}

describe('[002] US-B3 — Ver cuántas veces abrí el plan', () => {
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

  it('US-B3-AS1 · el cumplimiento cuenta aperturas libres, con razón y total', async () => {
    // Programa de 2 semanas
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
      ],
    });

    // Lunes 15 a las 15:00
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z'));

    // Dos aperturas libres (sin reason)
    const open1 = await handlePlanWeek('open_view', {});
    expect(open1.status).toBe('success');

    const open2 = await handlePlanWeek('open_view', {});
    expect(open2.status).toBe('success');

    // Una apertura con reason
    const open3 = await handlePlanWeek('open_view', { reason: 'reviso antes del parcial' });
    expect(open3.status).toBe('success');

    // Consultar cumplimiento de semana 1
    const compliance = await handleGetComplianceReport({ program_week_id: 'pw-01' });
    expect(compliance.status).toBe('success');
    if (compliance.status !== 'success') return;
    const complianceData = (compliance.data as any);

    expect(complianceData.aperturas_plan).toEqual({
      libres_usadas: 2,
      con_razon: 1,
      total: 3,
      razones: ['reviso antes del parcial'],
    });
  });

  it('US-B3-AS2 · sin aperturas los conteos son cero y la lista vacía', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
      ],
    });

    const compliance = await handleGetComplianceReport({ program_week_id: 'pw-01' });
    expect(compliance.status).toBe('success');
    if (compliance.status !== 'success') return;
    const complianceData = (compliance.data as any);

    expect(complianceData.aperturas_plan).toEqual({
      libres_usadas: 0,
      con_razon: 0,
      total: 0,
      razones: [],
    });
  });

  it('US-B3-AS3 · las aperturas se cuentan solo en el rango consultado', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
      ],
    });

    // Apertura el lunes 14
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    await handlePlanWeek('open_view', {});

    // Apertura el lunes 21 (semana 2)
    vi.setSystemTime(new Date('2026-09-21T15:00:00.000Z'));
    await handlePlanWeek('open_view', {});

    // Consultar cumplimiento del 14 al 20 (solo la semana 1)
    vi.setSystemTime(new Date('2026-09-21T16:00:00.000Z'));
    const compliance = await handleGetComplianceReport({ from: '2026-09-14', to: '2026-09-20' });
    expect(compliance.status).toBe('success');
    if (compliance.status !== 'success') return;
    const complianceData = (compliance.data as any);

    expect(complianceData.aperturas_plan.total).toBe(1);
  });

  it('US-B3-AS4 · las aperturas de planeación no cuentan', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
      ],
    });

    // Sábado 13 a las 15:00 (antes de que empiece la semana 1)
    vi.setSystemTime(new Date('2026-09-13T20:00:00.000Z'));

    // Dos aperturas de planeación (la semana todavía no empieza)
    const open1 = await handlePlanWeek('open_view', { program_week_id: 'pw-01' });
    expect(open1.status).toBe('success');
    if (open1.status !== 'success') return;
    expect((open1.data as any).surface).toBe('planeacion');

    const open2 = await handlePlanWeek('open_view', { program_week_id: 'pw-01' });
    expect(open2.status).toBe('success');

    // Consultar cumplimiento del 13 al 20
    const compliance = await handleGetComplianceReport({ from: '2026-09-13', to: '2026-09-20' });
    expect(compliance.status).toBe('success');
    if (compliance.status !== 'success') return;
    const complianceData = (compliance.data as any);

    expect(complianceData.aperturas_plan.total).toBe(0);
  });

  it('US-B3-AS5 · el reporte congelado incluye las aperturas y las menciona', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
      ],
    });

    // Lunes 15, las tres aperturas
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z'));

    await handlePlanWeek('open_view', {});
    await handlePlanWeek('open_view', {});
    await handlePlanWeek('open_view', { reason: 'reviso antes del parcial' });

    // Domingo 20 a las 19:05 (congelar el reporte)
    vi.setSystemTime(new Date('2026-09-21T00:05:00.000Z'));
    const fakeMailer = { send: async () => {} };
    const fakePusher = makeFakePusher();

    await runExecutionTick(new Date(), { mailer: fakeMailer, pusher: fakePusher });

    // Leer el reporte congelado
    const report = await handleManageWeeklyReport('read', { program_week_id: 'pw-01' });
    expect(report.status).toBe('success');
    if (report.status !== 'success') return;
    const reportData = (report.data as any);

    expect(reportData.payload.aperturas_plan).toEqual({
      total: 3,
      con_razon: 1,
      libres_usadas: 2,
    });
    expect(reportData.payload.plan_openings).toBeUndefined();
    expect(renderReportText(reportData.payload)).toContain('Aperturas del plan: 3 (1 con razón)');
  });

  it('compatibilidad: un payload congelado con plan_openings conserva su línea', () => {
    // Test sin ID que verifica backward compatibility
    const payload = {
      program_week_id: 'pw-01',
      week_number: 1,
      starts_on: '2026-09-14',
      ends_on: '2026-09-20',
      verdict: 'cumplida' as any,
      days_fulfilled: 0,
      habits: [],
      accumulated_fulfilled_days: 0,
      horizon_days: 66,
      en_riesgo: { perdidas: [], necesita_refuerzo: [], abandonadas: [], ciegas_count: 0 },
      user_note: null,
      late_edits: 0,
      late: false,
      previous_report_failed: false,
      second_consecutive_failure: false,
      plan_openings: 1,
    };

    const text = renderReportText(payload as any);
    expect(text).toContain('Aperturas del plan: 1');
  });
});
