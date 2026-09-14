import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleManageTandas,
  handleGetToday,
  handleManageProgram,
  handleManageDailyChecks,
  handleGetComplianceReport,
  handleManageWeeklyReport,
} from '../../lib/execution/handlers';
import { buildTodayFooterView } from '../../lib/execution/today-view';
import { runExecutionTick, type Pusher } from '../../lib/execution/tick';

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

describe('[002] US-B4 — Un día solo se cumple si hice las tandas mínimas', () => {
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

  it('US-B4-AS1 · pocas tandas y hábitos cumplidos da día no cumplido', async () => {
    // Programa de 3 semanas con mínimos 1, 3, 6
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
        { min_tandas_dia: 6, phase: 'consolidacion' },
      ],
    });

    // Crear hábitos h-a y h-b que empiezan el 14
    await handleManageProgram('upsert_habit', {
      id: 'h-a',
      label: 'Hábito A',
      started_on: '2026-09-14',
    });
    await handleManageProgram('upsert_habit', {
      id: 'h-b',
      label: 'Hábito B',
      started_on: '2026-09-14',
    });

    // Ir al martes 22 (semana 2, mínimo 3 tandas)
    vi.setSystemTime(new Date('2026-09-22T15:00:00.000Z'));

    // Completar 2 tandas: start 15:00, start 15:10:01, current 15:20:02
    const start1 = await handleManageTandas('start', {});
    expect(start1.status).toBe('success');

    vi.setSystemTime(new Date('2026-09-22T15:10:01.000Z'));
    const start2 = await handleManageTandas('start', {});
    expect(start2.status).toBe('success');

    vi.setSystemTime(new Date('2026-09-22T15:20:02.000Z'));
    const current = await handleManageTandas('current', {});
    expect(current.status).toBe('success');

    // Marcar hábitos como cumplidos
    await handleManageDailyChecks('set', { habit_id: 'h-a', status: 'cumplido' });
    await handleManageDailyChecks('set', { habit_id: 'h-b', status: 'cumplido' });

    // Verificar con get_today
    const today = await handleGetToday();
    expect(today.status).toBe('success');
    if (today.status !== 'success') return;
    const todayData = (today.data as any);

    expect(todayData.evaluacion_dia).toEqual({
      tandas_completadas: 2,
      min_requerido: 3,
      cumplio_tandas: false,
      cumplio_habitos: true,
      day_fulfilled: false,
    });

    // Verificar con get_compliance_report
    const compliance = await handleGetComplianceReport({ from: '2026-09-22', to: '2026-09-22' });
    expect(compliance.status).toBe('success');
    if (compliance.status !== 'success') return;
    const complianceData = (compliance.data as any);

    expect(complianceData.dias).toHaveLength(1);
    expect(complianceData.dias[0].evaluacion_dia).toEqual({
      tandas_completadas: 2,
      min_requerido: 3,
      cumplio_tandas: false,
      cumplio_habitos: true,
      day_fulfilled: false,
    });
  });

  it('US-B4-AS2 · tandas cumplidas y un hábito no cumplido da día no cumplido', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
        { min_tandas_dia: 6, phase: 'consolidacion' },
      ],
    });

    await handleManageProgram('upsert_habit', {
      id: 'h-a',
      label: 'Hábito A',
      started_on: '2026-09-14',
    });
    await handleManageProgram('upsert_habit', {
      id: 'h-b',
      label: 'Hábito B',
      started_on: '2026-09-14',
    });

    vi.setSystemTime(new Date('2026-09-22T15:00:00.000Z'));

    // Completar 3 tandas: start 15:00, start 15:10:01, start 15:20:02, current 15:30:03
    await handleManageTandas('start', {});
    vi.setSystemTime(new Date('2026-09-22T15:10:01.000Z'));
    await handleManageTandas('start', {});
    vi.setSystemTime(new Date('2026-09-22T15:20:02.000Z'));
    await handleManageTandas('start', {});
    vi.setSystemTime(new Date('2026-09-22T15:30:03.000Z'));
    await handleManageTandas('current', {});

    // h-a fallado, h-b cumplido
    await handleManageDailyChecks('set', { habit_id: 'h-a', status: 'fallado' });
    await handleManageDailyChecks('set', { habit_id: 'h-b', status: 'cumplido' });

    const today = await handleGetToday();
    expect(today.status).toBe('success');
    if (today.status !== 'success') return;
    const todayData = (today.data as any);

    expect(todayData.evaluacion_dia).toEqual({
      tandas_completadas: 3,
      min_requerido: 3,
      cumplio_tandas: true,
      cumplio_habitos: false,
      day_fulfilled: false,
    });
  });

  it('US-B4-AS3 · tandas cumplidas y un hábito sin registro da día no cumplido', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
        { min_tandas_dia: 6, phase: 'consolidacion' },
      ],
    });

    await handleManageProgram('upsert_habit', {
      id: 'h-a',
      label: 'Hábito A',
      started_on: '2026-09-14',
    });
    await handleManageProgram('upsert_habit', {
      id: 'h-b',
      label: 'Hábito B',
      started_on: '2026-09-14',
    });

    vi.setSystemTime(new Date('2026-09-22T15:00:00.000Z'));

    // Completar 3 tandas
    await handleManageTandas('start', {});
    vi.setSystemTime(new Date('2026-09-22T15:10:01.000Z'));
    await handleManageTandas('start', {});
    vi.setSystemTime(new Date('2026-09-22T15:20:02.000Z'));
    await handleManageTandas('start', {});
    vi.setSystemTime(new Date('2026-09-22T15:30:03.000Z'));
    await handleManageTandas('current', {});

    // Solo h-a cumplido, h-b sin registro
    await handleManageDailyChecks('set', { habit_id: 'h-a', status: 'cumplido' });

    const today = await handleGetToday();
    expect(today.status).toBe('success');
    if (today.status !== 'success') return;
    const todayData = (today.data as any);

    expect(todayData.evaluacion_dia.cumplio_habitos).toBe(false);
    expect(todayData.evaluacion_dia.day_fulfilled).toBe(false);
  });

  it('US-B4-AS4 · tandas cumplidas y hábitos según su horario da día cumplido', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
        { min_tandas_dia: 6, phase: 'consolidacion' },
      ],
    });

    await handleManageProgram('upsert_habit', {
      id: 'h-a',
      label: 'Hábito A',
      started_on: '2026-09-14',
    });
    await handleManageProgram('upsert_habit', {
      id: 'h-b',
      label: 'Hábito B',
      started_on: '2026-09-14',
    });
    // h-gym: lunes, jueves, viernes, sábado (days_of_week: [1, 4, 5, 6])
    await handleManageProgram('upsert_habit', {
      id: 'h-gym',
      label: 'Gym en la mañana',
      started_on: '2026-09-14',
      days_of_week: [1, 4, 5, 6],
    });

    vi.setSystemTime(new Date('2026-09-22T15:00:00.000Z'));

    // Completar 3 tandas
    await handleManageTandas('start', {});
    vi.setSystemTime(new Date('2026-09-22T15:10:01.000Z'));
    await handleManageTandas('start', {});
    vi.setSystemTime(new Date('2026-09-22T15:20:02.000Z'));
    await handleManageTandas('start', {});
    vi.setSystemTime(new Date('2026-09-22T15:30:03.000Z'));
    await handleManageTandas('current', {});

    // h-a y h-b cumplidos (h-gym no aplica el martes 22)
    await handleManageDailyChecks('set', { habit_id: 'h-a', status: 'cumplido' });
    await handleManageDailyChecks('set', { habit_id: 'h-b', status: 'cumplido' });

    const today = await handleGetToday();
    expect(today.status).toBe('success');
    if (today.status !== 'success') return;
    const todayData = (today.data as any);

    expect(todayData.evaluacion_dia).toEqual({
      tandas_completadas: 3,
      min_requerido: 3,
      cumplio_tandas: true,
      cumplio_habitos: true,
      day_fulfilled: true,
    });
  });

  it('US-B4-AS5 · un día fuera del programa no tiene evaluación', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
        { min_tandas_dia: 6, phase: 'consolidacion' },
      ],
    });

    // Sábado 12 está fuera del programa (que empieza el lunes 14)
    vi.setSystemTime(new Date('2026-09-12T20:00:00.000Z'));

    const today = await handleGetToday();
    expect(today.status).toBe('success');
    if (today.status !== 'success') return;
    const todayData = (today.data as any);

    expect(todayData.evaluacion_dia).toBeNull();

    // También en get_compliance_report
    const compliance = await handleGetComplianceReport({ from: '2026-09-12', to: '2026-09-12' });
    expect(compliance.status).toBe('success');
    if (compliance.status !== 'success') return;
    const complianceData = (compliance.data as any);

    expect(complianceData.dias[0].evaluacion_dia).toBeNull();
  });

  it('US-B4-AS6 · la pantalla Hoy no muestra el mínimo ni las tandas que faltan', async () => {
    // Esta es una regresión: nace en verde con el código actual
    const footerInput = {
      pending_checks: [],
      tandas_today: 2,
      day_fulfilled: false,
      evaluacion_dia: {
        tandas_completadas: 2,
        min_requerido: 3,
        cumplio_tandas: false,
        cumplio_habitos: true,
        day_fulfilled: false,
      },
    };

    const view = buildTodayFooterView(footerInput as any);
    const keys = Object.keys(view).sort();

    expect(keys).toEqual(['checks', 'dayFulfilledLine', 'tandasLine']);
    expect(JSON.stringify(view)).not.toMatch(/mínimo|faltan/i);
  });

  it('US-B4-AS7 · un hábito futuro no aparece en el cumplimiento de semanas pasadas', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [
        { min_tandas_dia: 1, phase: 'arranque' },
        { min_tandas_dia: 3, phase: 'consolidacion' },
        { min_tandas_dia: 6, phase: 'consolidacion' },
      ],
    });

    await handleManageProgram('upsert_habit', {
      id: 'h-a',
      label: 'Hábito A',
      started_on: '2026-09-14',
    });
    // h-gym empieza el 28 (fuera del rango de la semana 1)
    await handleManageProgram('upsert_habit', {
      id: 'h-gym',
      label: 'Gym en la mañana',
      started_on: '2026-09-28',
    });

    // Consultar cumplimiento de semana 1 (14-20)
    const compliance = await handleGetComplianceReport({ program_week_id: 'pw-01' });
    expect(compliance.status).toBe('success');
    if (compliance.status !== 'success') return;
    const complianceData = (compliance.data as any);

    const habitIds = complianceData.habitos.map((h: any) => h.id);
    expect(habitIds).toContain('h-a');
    expect(habitIds).not.toContain('h-gym');

    // Ahora congelar el reporte
    vi.setSystemTime(new Date('2026-09-21T00:05:00.000Z'));
    const fakeMailer = { send: async () => {} };
    const fakePusher = makeFakePusher();

    await runExecutionTick(new Date(), { mailer: fakeMailer, pusher: fakePusher });

    const report = await handleManageWeeklyReport('read', { program_week_id: 'pw-01' });
    expect(report.status).toBe('success');
    if (report.status !== 'success') return;
    const reportData = (report.data as any);

    const reportHabitIds = reportData.payload.habits.map((h: any) => h.id);
    expect(reportHabitIds).toContain('h-a');
    expect(reportHabitIds).not.toContain('h-gym');
  });
});
