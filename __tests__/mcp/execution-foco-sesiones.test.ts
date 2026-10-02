import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleManageTandas,
  handleManageProgram,
  handleGetToday,
  handleGetComplianceReport,
} from '../../lib/execution/handlers';
import { handleManageUniversities, handleManageSubjects } from '../../mcp-server/tools-handler';
import { runExecutionTick, type Pusher } from '../../lib/execution/tick';
import type { Mailer, MailerPayload } from '../../lib/execution/mailer';

// US-F1 (004) -- Temporizador libre y cronómetro. Una "sesión" es una tanda: el cronómetro es una
// tanda con `kind = 'cronometro'`, sin duración planeada ni fin previsto, que solo se cierra al
// terminarla o interrumpirla (FR-F06). Las horas van en UTC: Bogotá es UTC-5, así que las 23:00
// locales del lunes 14-sep son 2026-09-15T04:00:00Z.

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

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

function makeFakeMailer(): Mailer & { calls: MailerPayload[] } {
  const calls: MailerPayload[] = [];
  return {
    calls,
    async send(payload: MailerPayload) {
      calls.push(payload);
    },
  };
}

async function setupProgram(minTandasDia = 3) {
  return handleManageProgram('init', {
    starts_on: '2026-09-14', // lunes
    weeks: [{ min_tandas_dia: minTandasDia, phase: 'arranque' }],
  });
}

async function readAllTandas(): Promise<any[]> {
  const res = await handleManageTandas('read', {});
  expect(res.status).toBe('success');
  return res.status === 'success' ? (res.data as any).tandas : [];
}

describe('[004] US-F1 — Temporizador libre y cronómetro', () => {
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

  it('US-F1-AS1 · empezar un cronómetro lo deja en curso sin duración planeada ni fin previsto, con la hora del servidor', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));

    // Un cronómetro con planned_minutes se rechaza sin escribir nada.
    const withPlan = await handleManageTandas('start', { kind: 'cronometro', planned_minutes: 30 });
    expect(withPlan.status).toBe('error');
    if (withPlan.status === 'error') expect(withPlan.code).toBe('DATOS_INVALIDOS');
    expect(await readAllTandas()).toHaveLength(0);

    const res = await handleManageTandas('start', { kind: 'cronometro' });
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;

    const { tanda, ends_at } = res.data as any;
    expect(tanda.kind).toBe('cronometro');
    expect(tanda.status).toBe('en_curso');
    expect(tanda.running_lock).toBe('running');
    expect(tanda.planned_minutes).toBeNull();
    expect(ends_at).toBeNull();
    expect(new Date(tanda.started_at).toISOString()).toBe('2026-09-14T15:00:00.000Z');
  });

  it('US-F1-AS1 · current y get_today de un cronómetro traen elapsed_seconds y ningún fin; un temporizador conserva su cuenta atrás', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    await handleManageTandas('start', { kind: 'cronometro' });

    vi.setSystemTime(new Date('2026-09-14T15:02:05.000Z'));
    const current = await handleManageTandas('current', {});
    expect(current.status).toBe('success');
    if (current.status !== 'success') return;
    expect((current.data as any).tanda.kind).toBe('cronometro');
    expect((current.data as any).seconds_left).toBeNull();
    expect((current.data as any).elapsed_seconds).toBe(125);

    const today = await handleGetToday();
    expect(today.status).toBe('success');
    if (today.status !== 'success') return;
    const running = (today.data as any).running_tanda;
    expect(running.kind).toBe('cronometro');
    expect(running.objective_id).toBeNull();
    expect(running.ends_at).toBeNull();
    expect(running.seconds_left).toBeNull();
    expect(running.elapsed_seconds).toBe(125);

    // Un temporizador sigue siendo cuenta atrás: seconds_left numérico, elapsed_seconds nulo.
    await handleManageTandas('interrupt', {
      id: (current.data as any).tanda.id,
      interrupt_reason: 'prueba',
    });
    vi.setSystemTime(new Date('2026-09-14T16:00:00.000Z'));
    await handleManageTandas('start', { planned_minutes: 25 });
    vi.setSystemTime(new Date('2026-09-14T16:05:00.000Z'));
    const timerCurrent = await handleManageTandas('current', {});
    expect(timerCurrent.status).toBe('success');
    if (timerCurrent.status !== 'success') return;
    expect((timerCurrent.data as any).seconds_left).toBe(20 * 60);
    expect((timerCurrent.data as any).elapsed_seconds).toBeNull();

    const timerToday = await handleGetToday();
    if (timerToday.status !== 'success') return;
    const timerRunning = (timerToday.data as any).running_tanda;
    expect(timerRunning.kind).toBe('temporizador');
    expect(timerRunning.seconds_left).toBe(20 * 60);
    expect(timerRunning.elapsed_seconds).toBeNull();
    expect(timerRunning.ends_at).toBe('2026-09-14T16:25:00.000Z');
  });

  it('US-F1-AS2 · un cronómetro de 3 horas no se cierra solo ni dispara el aviso de fin', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const start = await handleManageTandas('start', { kind: 'cronometro' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;
    const id = (start.data as any).tanda.id;

    vi.setSystemTime(new Date('2026-09-14T18:00:00.000Z')); // 3 horas después
    const pusher = makeFakePusher();
    const tick = await runExecutionTick(new Date(), { mailer: makeFakeMailer(), pusher });
    expect(tick.notified).toBe(0);
    expect(pusher.calls).toHaveLength(0);

    // Cualquier otra operación del módulo tampoco lo cierra.
    const current = await handleManageTandas('current', {});
    expect(current.status).toBe('success');
    if (current.status !== 'success') return;
    expect((current.data as any).tanda).not.toBeNull();
    expect((current.data as any).tanda.id).toBe(id);
    expect((current.data as any).tanda.status).toBe('en_curso');
    expect((current.data as any).tanda.running_lock).toBe('running');
  });

  it('US-F1-AS3 · temporizador de 45 y de 180 se aceptan; de 9, de 181 y de 12.5 se rechazan sin crear filas', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));

    for (const invalid of [9, 181, 12.5]) {
      const res = await handleManageTandas('start', { planned_minutes: invalid });
      expect(res.status).toBe('error');
      if (res.status === 'error') expect(res.code).toBe('DATOS_INVALIDOS');
    }
    expect(await readAllTandas()).toHaveLength(0);

    const forty = await handleManageTandas('start', { planned_minutes: 45 });
    expect(forty.status).toBe('success');
    if (forty.status !== 'success') return;
    expect((forty.data as any).tanda.kind).toBe('temporizador');
    expect((forty.data as any).tanda.planned_minutes).toBe(45);
    expect((forty.data as any).ends_at).toBe('2026-09-14T15:45:00.000Z');

    vi.setSystemTime(new Date('2026-09-14T15:46:00.000Z')); // se cierra sola
    const long = await handleManageTandas('start', { planned_minutes: 180 });
    expect(long.status).toBe('success');
    if (long.status !== 'success') return;
    expect((long.data as any).tanda.planned_minutes).toBe(180);
    expect((long.data as any).ends_at).toBe('2026-09-14T18:46:00.000Z');

    expect(await readAllTandas()).toHaveLength(2);
  });

  it('US-F1-AS4 · terminar un cronómetro a los 45 min 40 s lo deja completado con 45 minutos y la hora de fin del servidor', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const start = await handleManageTandas('start', { kind: 'cronometro' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;
    const id = (start.data as any).tanda.id;

    vi.setSystemTime(new Date('2026-09-14T15:45:40.000Z'));
    const finish = await handleManageTandas('finish', { id });
    expect(finish.status).toBe('success');
    if (finish.status !== 'success') return;

    const tanda = finish.data as any;
    expect(tanda.status).toBe('completada');
    expect(tanda.actual_minutes).toBe(45);
    expect(new Date(tanda.ended_at).toISOString()).toBe('2026-09-14T15:45:40.000Z');
    expect(tanda.running_lock).toBeNull();
    expect(tanda.edited_after_lock).toBe(false);
  });

  it('US-F1-AS5 · terminar un cronómetro con menos de 1 minuto da CRONOMETRO_MUY_CORTO y sigue en curso; interrumpirlo con razón lo deja con 0 minutos', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const start = await handleManageTandas('start', { kind: 'cronometro' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;
    const id = (start.data as any).tanda.id;

    vi.setSystemTime(new Date('2026-09-14T15:00:50.000Z'));
    const finish = await handleManageTandas('finish', { id });
    expect(finish.status).toBe('error');
    if (finish.status === 'error') expect(finish.code).toBe('CRONOMETRO_MUY_CORTO');

    const current = await handleManageTandas('current', {});
    expect(current.status).toBe('success');
    if (current.status === 'success') {
      expect((current.data as any).tanda.id).toBe(id);
      expect((current.data as any).tanda.status).toBe('en_curso');
    }

    vi.setSystemTime(new Date('2026-09-14T15:00:55.000Z'));
    const interrupt = await handleManageTandas('interrupt', { id, interrupt_reason: 'me llamaron' });
    expect(interrupt.status).toBe('success');
    if (interrupt.status !== 'success') return;
    expect((interrupt.data as any).status).toBe('interrumpida');
    expect((interrupt.data as any).actual_minutes).toBe(0);
    expect((interrupt.data as any).running_lock).toBeNull();
  });

  it('US-F1-AS7 · con una sesión en curso de cualquier tipo, empezar otra de cualquier tipo da TANDA_EN_CURSO y no crea nada', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const crono = await handleManageTandas('start', { kind: 'cronometro' });
    expect(crono.status).toBe('success');
    if (crono.status !== 'success') return;

    vi.setSystemTime(new Date('2026-09-14T15:03:00.000Z'));
    for (const input of [{ planned_minutes: 25 }, { kind: 'cronometro' }]) {
      const res = await handleManageTandas('start', input);
      expect(res.status).toBe('error');
      if (res.status === 'error') expect(res.code).toBe('TANDA_EN_CURSO');
    }
    expect(await readAllTandas()).toHaveLength(1);

    // Al revés: con un temporizador en curso, un cronómetro tampoco entra.
    await handleManageTandas('interrupt', { id: (crono.data as any).tanda.id, interrupt_reason: 'prueba' });
    vi.setSystemTime(new Date('2026-09-14T16:00:00.000Z'));
    const timer = await handleManageTandas('start', { planned_minutes: 40 });
    expect(timer.status).toBe('success');

    vi.setSystemTime(new Date('2026-09-14T16:03:00.000Z'));
    const second = await handleManageTandas('start', { kind: 'cronometro' });
    expect(second.status).toBe('error');
    if (second.status === 'error') expect(second.code).toBe('TANDA_EN_CURSO');
    expect(await readAllTandas()).toHaveLength(2);
  });

  it('US-F1-AS10 · un cronómetro de 23:00 a 01:30 reparte 60 min y 6 unidades al primer día y 90 y 9 al segundo', async () => {
    await setupProgram(3);

    vi.setSystemTime(new Date('2026-09-15T04:00:00.000Z')); // lunes 14 23:00 local
    const start = await handleManageTandas('start', { kind: 'cronometro' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;
    const id = (start.data as any).tanda.id;

    vi.setSystemTime(new Date('2026-09-15T06:30:00.000Z')); // martes 15 01:30 local
    const finish = await handleManageTandas('finish', { id });
    expect(finish.status).toBe('success');
    if (finish.status !== 'success') return;
    expect((finish.data as any).actual_minutes).toBe(150);

    const report = await handleGetComplianceReport({ from: '2026-09-14', to: '2026-09-15' });
    expect(report.status).toBe('success');
    if (report.status !== 'success') return;
    const dias = (report.data as any).dias;
    const first = dias.find((d: any) => d.date === '2026-09-14');
    const second = dias.find((d: any) => d.date === '2026-09-15');
    expect(first.evaluacion_dia.tandas_completadas).toBe(1);
    expect(first.evaluacion_dia.unidades_completadas).toBe(6);
    expect(first.evaluacion_dia.cumplio_tandas).toBe(true);
    expect(second.evaluacion_dia.tandas_completadas).toBe(1);
    expect(second.evaluacion_dia.unidades_completadas).toBe(9);
    expect(second.evaluacion_dia.cumplio_tandas).toBe(true);

    // Los minutos por día salen del resumen de manage_tandas:read (por_dia.minutos = minutos de foco).
    const read = await handleManageTandas('read', { from: '2026-09-14', to: '2026-09-15' });
    expect(read.status).toBe('success');
    if (read.status !== 'success') return;
    const porDia = (read.data as any).por_dia;
    expect(porDia.find((d: any) => d.date === '2026-09-14')).toMatchObject({ minutos: 60, unidades: 6, completadas: 1 });
    expect(porDia.find((d: any) => d.date === '2026-09-15')).toMatchObject({ minutos: 90, unidades: 9, completadas: 1 });

    // Un rango que empieza el 15 incluye el cronómetro aunque su local_date (día de inicio) sea el 14.
    const onlySecond = await handleManageTandas('read', { from: '2026-09-15', to: '2026-09-15' });
    expect(onlySecond.status).toBe('success');
    if (onlySecond.status !== 'success') return;
    expect((onlySecond.data as any).tandas.map((t: any) => t.id)).toContain(id);
    expect((onlySecond.data as any).por_dia).toEqual([
      expect.objectContaining({ date: '2026-09-15', minutos: 90, unidades: 9 }),
    ]);

    // Y un rango que solo cubre el 13 no lo incluye.
    const before = await handleManageTandas('read', { from: '2026-09-12', to: '2026-09-13' });
    expect(before.status).toBe('success');
    if (before.status === 'success') expect((before.data as any).tandas).toHaveLength(0);
  });

  it('US-F1-AS10 · un cronómetro de domingo 23:00 a lunes 01:00 reparte 60 + 60 en por_materia de cada semana', async () => {
    // 004 (FR-F14a): el cronómetro con materia cruza el cambio de semana. Cada reporte cuenta solo
    // los minutos de su tramo: ni los 120 enteros en la semana de inicio ni nada en la siguiente.
    vi.setSystemTime(new Date('2026-09-21T04:00:00.000Z')); // domingo 20 23:00 local
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA', scale_max: 5, passing_grade: 3.0 });
    await handleManageSubjects('create', { id: 'sub-calculo', university_id: 'uni-1', name: 'Cálculo' });
    const start = await handleManageTandas('start', { kind: 'cronometro', subject_id: 'sub-calculo' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;
    expect((start.data as any).tanda.local_date).toBe('2026-09-20');

    vi.setSystemTime(new Date('2026-09-21T06:00:00.000Z')); // lunes 21 01:00 local
    const finish = await handleManageTandas('finish', { id: (start.data as any).tanda.id });
    expect(finish.status).toBe('success');
    if (finish.status !== 'success') return;
    expect((finish.data as any).actual_minutes).toBe(120);

    const semanaQueTermina = await handleGetComplianceReport({ from: '2026-09-14', to: '2026-09-20' });
    expect(semanaQueTermina.status).toBe('success');
    if (semanaQueTermina.status !== 'success') return;
    expect((semanaQueTermina.data as any).tandas.completadas).toBe(1);
    expect((semanaQueTermina.data as any).tandas.por_materia).toEqual([
      { subject_id: 'sub-calculo', count: 1, minutes: 60 },
    ]);

    const semanaQueEmpieza = await handleGetComplianceReport({ from: '2026-09-21', to: '2026-09-27' });
    expect(semanaQueEmpieza.status).toBe('success');
    if (semanaQueEmpieza.status !== 'success') return;
    expect((semanaQueEmpieza.data as any).tandas.completadas).toBe(1);
    expect((semanaQueEmpieza.data as any).tandas.por_materia).toEqual([
      { subject_id: 'sub-calculo', count: 1, minutes: 60 },
    ]);

    // Una semana que no toca el cronómetro no lo cuenta.
    const semanaAjena = await handleGetComplianceReport({ from: '2026-09-28', to: '2026-10-04' });
    expect(semanaAjena.status).toBe('success');
    if (semanaAjena.status !== 'success') return;
    expect((semanaAjena.data as any).tandas.completadas).toBe(0);
    expect((semanaAjena.data as any).tandas.por_materia).toEqual([]);
  });

  it('US-F1-AS10 · un cronómetro del lunes 22:00 al miércoles 02:00 se reparte en 120, 1440 y 120 minutos', async () => {
    vi.setSystemTime(new Date('2026-09-15T03:00:00.000Z')); // lunes 14 22:00 local
    const start = await handleManageTandas('start', { kind: 'cronometro' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;

    vi.setSystemTime(new Date('2026-09-16T07:00:00.000Z')); // miércoles 16 02:00 local
    const finish = await handleManageTandas('finish', { id: (start.data as any).tanda.id });
    expect(finish.status).toBe('success');
    if (finish.status !== 'success') return;
    expect((finish.data as any).actual_minutes).toBe(1680);

    const read = await handleManageTandas('read', { from: '2026-09-14', to: '2026-09-16' });
    expect(read.status).toBe('success');
    if (read.status !== 'success') return;
    const porDia = (read.data as any).por_dia;
    expect(porDia.map((d: any) => [d.date, d.minutos, d.unidades])).toEqual([
      ['2026-09-14', 120, 12],
      ['2026-09-15', 1440, 144],
      ['2026-09-16', 120, 12],
    ]);
  });

  it('US-F1-AS10 · un temporizador de 23:30 a 00:30 sigue contando entero (60 minutos, 6 unidades) para su día de inicio [regresión]', async () => {
    await setupProgram(3);

    vi.setSystemTime(new Date('2026-09-18T04:30:00.000Z')); // jueves 17 23:30 local
    const start = await handleManageTandas('start', { planned_minutes: 60 });
    expect(start.status).toBe('success');

    vi.setSystemTime(new Date('2026-09-18T05:35:00.000Z')); // viernes 18 00:35 local: ya se cumplió
    // get_compliance_report es de solo lectura y no cierra tandas vencidas: cualquier operación de
    // manage_tandas lo hace primero (finalizeElapsed, FR-005).
    await handleManageTandas('current', {});
    const report = await handleGetComplianceReport({ from: '2026-09-17', to: '2026-09-18' });
    expect(report.status).toBe('success');
    if (report.status !== 'success') return;
    const dias = (report.data as any).dias;
    const startDay = dias.find((d: any) => d.date === '2026-09-17');
    const nextDay = dias.find((d: any) => d.date === '2026-09-18');
    expect(startDay.evaluacion_dia.tandas_completadas).toBe(1);
    expect(startDay.evaluacion_dia.unidades_completadas).toBe(6);
    expect(nextDay.evaluacion_dia.tandas_completadas).toBe(0);
    expect(nextDay.evaluacion_dia.unidades_completadas).toBe(0);

    const read = await handleManageTandas('read', { from: '2026-09-17', to: '2026-09-18' });
    expect(read.status).toBe('success');
    if (read.status !== 'success') return;
    expect((read.data as any).por_dia).toEqual([
      expect.objectContaining({ date: '2026-09-17', minutos: 60, unidades: 6, completadas: 1 }),
    ]);
  });

  it('US-F1-AS11 · un cronómetro que empezó el lunes y se termina el martes a las 04:00 queda con edited_after_lock', async () => {
    vi.setSystemTime(new Date('2026-09-15T01:00:00.000Z')); // lunes 14 20:00 local
    const start = await handleManageTandas('start', { kind: 'cronometro' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;
    const id = (start.data as any).tanda.id;
    expect((start.data as any).tanda.edited_after_lock).toBe(false);

    vi.setSystemTime(new Date('2026-09-15T09:00:00.000Z')); // martes 15 04:00 local, después del cierre de las 03:00
    const finish = await handleManageTandas('finish', { id });
    expect(finish.status).toBe('success');
    if (finish.status !== 'success') return;
    expect((finish.data as any).status).toBe('completada');
    expect((finish.data as any).edited_after_lock).toBe(true);
  });

  it('US-F1-AS11 · interrumpir un cronómetro después del cierre también lo marca; antes del cierre no', async () => {
    vi.setSystemTime(new Date('2026-09-15T01:00:00.000Z')); // lunes 14 20:00 local
    const start = await handleManageTandas('start', { kind: 'cronometro' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;

    vi.setSystemTime(new Date('2026-09-15T09:00:00.000Z')); // martes 15 04:00 local
    const late = await handleManageTandas('interrupt', {
      id: (start.data as any).tanda.id,
      interrupt_reason: 'me quedé dormido',
    });
    expect(late.status).toBe('success');
    if (late.status === 'success') expect((late.data as any).edited_after_lock).toBe(true);

    // Un cronómetro cerrado el mismo día, antes de las 03:00 del siguiente, no se marca.
    vi.setSystemTime(new Date('2026-09-15T20:00:00.000Z'));
    const second = await handleManageTandas('start', { kind: 'cronometro' });
    expect(second.status).toBe('success');
    if (second.status !== 'success') return;
    vi.setSystemTime(new Date('2026-09-15T20:30:00.000Z'));
    const finish = await handleManageTandas('finish', { id: (second.data as any).tanda.id });
    expect(finish.status).toBe('success');
    if (finish.status === 'success') {
      expect((finish.data as any).actual_minutes).toBe(30);
      expect((finish.data as any).edited_after_lock).toBe(false);
    }
  });
});
