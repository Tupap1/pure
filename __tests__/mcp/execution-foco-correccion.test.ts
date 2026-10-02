import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleManageTandas,
  handleManageProgram,
  handleManageWeeklyReport,
  handleGetComplianceReport,
} from '../../lib/execution/handlers';
import { runExecutionTick, type Pusher } from '../../lib/execution/tick';
import { renderReportText } from '../../lib/execution/report';
import type { Mailer, MailerPayload } from '../../lib/execution/mailer';
import { POST } from '@/app/api/execution/route';

// US-F4 (004) -- Corregir un cronómetro olvidado. `manage_tandas:correct` es la red de seguridad de
// un cronómetro sin tope: solo por MCP, solo acorta (o cierra un cronómetro en curso en un instante
// ya pasado), exige razón y conserva el original. Es la segunda excepción acotada al Principio III
// (después de log_late): acepta un instante del cliente (`ended_at`). Bogotá es UTC-5: las 14:00
// locales del lunes 14-sep son 2026-09-14T19:00:00Z; el día se cierra a las 03:00 locales (08:00Z)
// del siguiente. Los relojes se fijan con vi.setSystemTime ANTES de cada escritura.

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

const MON_14H = '2026-09-14T19:00:00.000Z'; // lunes 14-sep 14:00 local
const MON_18H = '2026-09-14T23:00:00.000Z'; // 18:00 local
const MON_15H = '2026-09-14T20:00:00.000Z'; // 15:00 local
const MON_15H10 = '2026-09-14T20:10:00.000Z'; // 15:10 local
const MON_22H = '2026-09-15T03:00:00.000Z'; // 22:00 local

function iso(value: unknown): string {
  return new Date(value as string).toISOString();
}

function dataOf(res: any): any {
  expect(res.status).toBe('success');
  return res.status === 'success' ? res.data : undefined;
}

function expectError(res: any, code: string) {
  expect(res.status).toBe('error');
  if (res.status === 'error') expect(res.code).toBe(code);
}

async function setupProgram(minTandasDia = 3, weeks = 1) {
  return handleManageProgram('init', {
    starts_on: '2026-09-14', // lunes
    weeks: Array.from({ length: weeks }, () => ({ min_tandas_dia: minTandasDia, phase: 'arranque' })),
  });
}

async function readAllTandas(): Promise<any[]> {
  return dataOf(await handleManageTandas('read', {})).tandas;
}

async function readTanda(id: string): Promise<any> {
  return (await readAllTandas()).find((t) => t.id === id);
}

/** Cronómetro de `startIso` a `endIso`, terminado en `endIso`. Deja el reloj en `endIso`. */
async function closedCronometro(startIso: string, endIso: string): Promise<any> {
  vi.setSystemTime(new Date(startIso));
  const start = dataOf(await handleManageTandas('start', { kind: 'cronometro' }));
  vi.setSystemTime(new Date(endIso));
  return dataOf(await handleManageTandas('finish', { id: start.tanda.id }));
}

/** Cronómetro que sigue en curso. Deja el reloj en `startIso`. */
async function runningCronometro(startIso: string): Promise<any> {
  vi.setSystemTime(new Date(startIso));
  return dataOf(await handleManageTandas('start', { kind: 'cronometro' })).tanda;
}

/** `reason = null` omite la razón por completo (un `undefined` activaría el valor por defecto). */
async function correct(id: string, endedAt: string, reason: string | null = 'olvidé pararlo') {
  return handleManageTandas('correct', { id, ended_at: endedAt, ...(reason === null ? {} : { reason }) });
}

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

describe('[004] US-F4 — Corregir un cronómetro olvidado', () => {
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

  it('US-F4-AS1 · un cronómetro en curso desde las 14:00 se corrige a las 22:00 con fin 15:10: 70 minutos, corregido, original 22:00 y 480, sin sesión en curso', async () => {
    await setupProgram();
    const running = await runningCronometro(MON_14H);

    vi.setSystemTime(new Date(MON_22H));
    const res = await correct(running.id, MON_15H10, 'olvidé pararlo');
    const tanda = dataOf(res);

    expect(tanda.id).toBe(running.id);
    expect(tanda.status).toBe('completada');
    expect(tanda.kind).toBe('cronometro');
    expect(tanda.actual_minutes).toBe(70);
    expect(iso(tanda.ended_at)).toBe(MON_15H10);
    expect(tanda.running_lock).toBeNull();
    expect(tanda.corrected).toBe(true);
    expect(iso(tanda.corrected_at)).toBe(MON_22H);
    expect(iso(tanda.original_ended_at)).toBe(MON_22H);
    expect(tanda.original_minutes).toBe(480);
    expect(tanda.correction_reason).toBe('olvidé pararlo');
    expect(tanda.edited_after_lock).toBe(false); // 22:00 sigue antes del cierre de las 03:00

    // Ya no hay sesión en curso: se puede empezar otra sin TANDA_EN_CURSO.
    const current = dataOf(await handleManageTandas('current', {}));
    expect(current.tanda).toBeNull();
    expect((await handleManageTandas('start', { planned_minutes: 10 })).status).toBe('success');
  });

  it('US-F4-AS1 · la razón se guarda sin los espacios de los extremos', async () => {
    const running = await runningCronometro(MON_14H);
    vi.setSystemTime(new Date(MON_22H));

    const tanda = dataOf(await correct(running.id, MON_15H10, '  me fui y no lo paré  '));
    expect(tanda.correction_reason).toBe('me fui y no lo paré');
  });

  it('US-F4-AS1 · corregir un cronómetro en curso DESPUÉS de su cierre del día lo marca edited_after_lock (US-F1-AS11)', async () => {
    const running = await runningCronometro(MON_14H); // locked_at = martes 03:00 local = 08:00Z
    const tuesday10h = '2026-09-15T15:00:00.000Z';
    vi.setSystemTime(new Date(tuesday10h));

    const tanda = dataOf(await correct(running.id, MON_15H10));
    expect(tanda.status).toBe('completada');
    expect(tanda.actual_minutes).toBe(70);
    expect(iso(tanda.original_ended_at)).toBe(tuesday10h);
    expect(tanda.original_minutes).toBe(20 * 60);
    expect(tanda.edited_after_lock).toBe(true);
  });

  it('US-F4-AS2 · una sesión cerrada de 14:00 a 18:00 corregida a 15:00 queda en 60, conserva el original y su estado', async () => {
    await setupProgram();
    const closed = await closedCronometro(MON_14H, MON_18H);
    expect(closed.actual_minutes).toBe(240);

    vi.setSystemTime(new Date('2026-09-14T23:30:00.000Z'));
    const tanda = dataOf(await correct(closed.id, MON_15H, 'paré antes'));

    expect(tanda.status).toBe('completada');
    expect(tanda.actual_minutes).toBe(60);
    expect(iso(tanda.ended_at)).toBe(MON_15H);
    expect(tanda.corrected).toBe(true);
    expect(iso(tanda.corrected_at)).toBe('2026-09-14T23:30:00.000Z');
    expect(iso(tanda.original_ended_at)).toBe(MON_18H);
    expect(tanda.original_minutes).toBe(240);
    expect(tanda.correction_reason).toBe('paré antes');
    expect(tanda.running_lock).toBeNull();
    expect(tanda.edited_after_lock).toBe(false); // sobre una sesión cerrada no se toca
  });

  it('US-F4-AS2 · un temporizador interrumpido o completado conserva su estado y su duración planeada; solo cambian fin y minutos', async () => {
    vi.setSystemTime(new Date(MON_14H));
    const interrupted = dataOf(await handleManageTandas('start', { planned_minutes: 60 })).tanda;
    vi.setSystemTime(new Date('2026-09-14T19:50:00.000Z'));
    dataOf(await handleManageTandas('interrupt', { id: interrupted.id, interrupt_reason: 'me llamaron' }));

    vi.setSystemTime(new Date('2026-09-14T20:00:00.000Z'));
    const completed = dataOf(await handleManageTandas('start', { planned_minutes: 25 })).tanda;
    vi.setSystemTime(new Date('2026-09-14T20:25:00.000Z'));
    dataOf(await handleManageTandas('finish', { id: completed.id }));

    vi.setSystemTime(new Date('2026-09-14T20:40:00.000Z'));
    const first = dataOf(await correct(interrupted.id, '2026-09-14T19:30:00.000Z', 'colgué tarde'));
    expect(first.status).toBe('interrumpida');
    expect(first.interrupt_reason).toBe('me llamaron');
    expect(first.kind).toBe('temporizador');
    expect(first.planned_minutes).toBe(60);
    expect(first.actual_minutes).toBe(30);
    expect(first.original_minutes).toBe(50);
    expect(iso(first.original_ended_at)).toBe('2026-09-14T19:50:00.000Z');

    const second = dataOf(await correct(completed.id, '2026-09-14T20:15:00.000Z', 'colgué tarde'));
    expect(second.status).toBe('completada');
    expect(second.kind).toBe('temporizador');
    expect(second.planned_minutes).toBe(25);
    expect(second.actual_minutes).toBe(15);
    expect(second.original_minutes).toBe(25);
    expect(iso(second.original_ended_at)).toBe('2026-09-14T20:25:00.000Z');
    // La hora de inicio y el día local nunca se tocan.
    expect(iso(second.started_at)).toBe('2026-09-14T20:00:00.000Z');
    expect(second.local_date).toBe('2026-09-14');
  });

  it('US-F4-AS3 · un fin igual o posterior al registrado, o anterior a inicio + 1 minuto, se rechaza con CORRECCION_INVALIDA y nada cambia', async () => {
    const closed = await closedCronometro(MON_14H, MON_18H);
    vi.setSystemTime(new Date('2026-09-14T23:30:00.000Z'));
    const before = await readTanda(closed.id);

    for (const endedAt of [
      MON_18H, // igual al registrado: no acorta
      '2026-09-14T23:00:01.000Z', // 1 s después del registrado
      '2026-09-15T01:00:00.000Z', // horas después
      '2026-09-14T19:00:59.000Z', // inicio + 59 s
      MON_14H, // el propio inicio
      '2026-09-14T18:00:00.000Z', // antes del inicio
    ]) {
      expectError(await correct(closed.id, endedAt), 'CORRECCION_INVALIDA');
      expect(await readTanda(closed.id)).toEqual(before);
    }
    expect((await readTanda(closed.id)).corrected).toBe(false);

    // La cota inferior es inclusiva: inicio + 60 s exactos se aceptan (1 minuto).
    const tanda = dataOf(await correct(closed.id, '2026-09-14T19:01:00.000Z'));
    expect(tanda.actual_minutes).toBe(1);
    expect(tanda.corrected).toBe(true);
  });

  it('US-F4-AS3 · en un cronómetro en curso, un fin posterior a ahora o anterior a inicio + 1 minuto se rechaza y sigue en curso', async () => {
    const running = await runningCronometro(MON_14H);
    vi.setSystemTime(new Date('2026-09-14T22:00:00.000Z'));
    const before = await readTanda(running.id);

    for (const endedAt of [
      '2026-09-14T22:00:01.000Z', // 1 s en el futuro
      '2026-09-14T23:00:00.000Z', // 1 h en el futuro
      '2026-09-14T19:00:59.000Z', // inicio + 59 s
      '2026-09-14T18:00:00.000Z', // antes del inicio
    ]) {
      expectError(await correct(running.id, endedAt), 'CORRECCION_INVALIDA');
      expect(await readTanda(running.id)).toEqual(before);
    }
    const current = dataOf(await handleManageTandas('current', {}));
    expect(current.tanda.id).toBe(running.id);
    expect(current.tanda.running_lock).toBe('running');
    expect(current.tanda.corrected).toBe(false);
  });

  it('US-F4-AS3 · en un cronómetro en curso, un fin igual a ahora se acepta: lo cierra como completado con los minutos hasta ahora', async () => {
    const running = await runningCronometro(MON_14H);
    const now = '2026-09-14T22:00:00.000Z';
    vi.setSystemTime(new Date(now));

    const tanda = dataOf(await correct(running.id, now, 'se me quedó corriendo'));
    expect(tanda.status).toBe('completada');
    expect(tanda.actual_minutes).toBe(180);
    expect(tanda.running_lock).toBeNull();
    expect(tanda.corrected).toBe(true);
    expect(iso(tanda.original_ended_at)).toBe(now);
    expect(tanda.original_minutes).toBe(180);
  });

  it('US-F4-AS4 · una segunda corrección conserva el original de la primera', async () => {
    const closed = await closedCronometro(MON_14H, MON_18H);

    vi.setSystemTime(new Date('2026-09-14T23:30:00.000Z'));
    dataOf(await correct(closed.id, MON_15H, 'primera'));

    const secondNow = '2026-09-15T01:00:00.000Z';
    vi.setSystemTime(new Date(secondNow));
    const second = dataOf(await correct(closed.id, '2026-09-14T19:30:00.000Z', 'segunda'));

    expect(second.actual_minutes).toBe(30);
    expect(iso(second.ended_at)).toBe('2026-09-14T19:30:00.000Z');
    expect(iso(second.original_ended_at)).toBe(MON_18H);
    expect(second.original_minutes).toBe(240);
    expect(second.correction_reason).toBe('segunda');
    expect(iso(second.corrected_at)).toBe(secondNow);

    // Tampoco se puede volver a alargar hasta el fin de la primera corrección.
    expectError(await correct(closed.id, MON_15H, 'tercera'), 'CORRECCION_INVALIDA');
    expect((await readTanda(closed.id)).actual_minutes).toBe(30);
  });

  it('US-F4-AS4 · un cronómetro cerrado por corrección y corregido otra vez conserva el "ahora" de la primera como original', async () => {
    const running = await runningCronometro(MON_14H);

    vi.setSystemTime(new Date('2026-09-14T22:00:00.000Z'));
    dataOf(await correct(running.id, MON_15H10, 'primera'));

    vi.setSystemTime(new Date('2026-09-14T22:10:00.000Z'));
    const second = dataOf(await correct(running.id, '2026-09-14T19:30:00.000Z', 'segunda'));

    expect(second.actual_minutes).toBe(30);
    expect(iso(second.original_ended_at)).toBe('2026-09-14T22:00:00.000Z');
    expect(second.original_minutes).toBe(180);
    expect(second.status).toBe('completada');
  });

  it('US-F4-AS5 · una sesión de hace dos semanas, con su día cerrado hace mucho, se corrige igual', async () => {
    const closed = await closedCronometro(MON_14H, MON_18H);

    const twoWeeksLater = '2026-09-28T15:00:00.000Z';
    vi.setSystemTime(new Date(twoWeeksLater));
    const tanda = dataOf(await correct(closed.id, MON_15H, 'lo recordé hoy'));

    expect(tanda.actual_minutes).toBe(60);
    expect(tanda.corrected).toBe(true);
    expect(iso(tanda.corrected_at)).toBe(twoWeeksLater);
    expect(tanda.edited_after_lock).toBe(false); // una sesión cerrada no cambia esta marca
  });

  it('US-F4-AS6 · sin razón, con razón en blanco o de 141 caracteres se rechaza con DATOS_INVALIDOS; con 140 se acepta', async () => {
    const closed = await closedCronometro(MON_14H, MON_18H);
    vi.setSystemTime(new Date('2026-09-14T23:30:00.000Z'));
    const before = await readTanda(closed.id);

    expectError(await correct(closed.id, MON_15H, null), 'DATOS_INVALIDOS');
    expectError(await correct(closed.id, MON_15H, ''), 'DATOS_INVALIDOS');
    expectError(await correct(closed.id, MON_15H, '   '), 'DATOS_INVALIDOS');
    expectError(await correct(closed.id, MON_15H, 'x'.repeat(141)), 'DATOS_INVALIDOS');
    expect(await readTanda(closed.id)).toEqual(before);

    // El resto de la forma también se valida: fecha ilegible, id ausente y claves ajenas.
    expectError(await handleManageTandas('correct', { id: closed.id, ended_at: 'ayer', reason: 'x' }), 'DATOS_INVALIDOS');
    expectError(await handleManageTandas('correct', { ended_at: MON_15H, reason: 'x' }), 'DATOS_INVALIDOS');
    expectError(
      await handleManageTandas('correct', { id: closed.id, ended_at: MON_15H, reason: 'x', started_at: MON_14H }),
      'DATOS_INVALIDOS'
    );
    expect(await readTanda(closed.id)).toEqual(before);

    const ok = dataOf(await correct(closed.id, MON_15H, 'x'.repeat(140)));
    expect(ok.correction_reason).toHaveLength(140);
  });

  it('US-F4-AS6 · un temporizador en curso no se corrige (CORRECCION_INVALIDA: para cortarlo existe interrupt) y sigue corriendo', async () => {
    vi.setSystemTime(new Date(MON_14H));
    const timer = dataOf(await handleManageTandas('start', { planned_minutes: 25 })).tanda;

    vi.setSystemTime(new Date('2026-09-14T19:05:00.000Z'));
    const before = await readTanda(timer.id);
    expectError(await correct(timer.id, '2026-09-14T19:03:00.000Z'), 'CORRECCION_INVALIDA');
    expect(await readTanda(timer.id)).toEqual(before);

    const current = dataOf(await handleManageTandas('current', {}));
    expect(current.tanda.id).toBe(timer.id);
    expect(current.tanda.status).toBe('en_curso');
  });

  it('US-F4-AS6 · una sesión inexistente da NO_ENCONTRADO', async () => {
    vi.setSystemTime(new Date(MON_22H));
    expectError(await correct('tanda-no-existe', MON_15H), 'NO_ENCONTRADO');
  });

  it('US-F4-AS7 · un día con mínimo 3 y un cronómetro de 480 minutos corregido a 20 pasa a 2 unidades y deja de cumplir', async () => {
    await setupProgram(3);
    const closed = await closedCronometro('2026-09-14T13:00:00.000Z', '2026-09-14T21:00:00.000Z'); // 08:00-16:00 local
    expect(closed.actual_minutes).toBe(480);

    const dayOf = async () => {
      const report = dataOf(await handleGetComplianceReport({ from: '2026-09-14', to: '2026-09-14' }));
      return report.dias.find((d: any) => d.date === '2026-09-14');
    };
    const beforeDay = await dayOf();
    expect(beforeDay.evaluacion_dia.unidades_completadas).toBe(48);
    expect(beforeDay.evaluacion_dia.cumplio_tandas).toBe(true);

    dataOf(await correct(closed.id, '2026-09-14T13:20:00.000Z', 'solo estudié 20 minutos'));

    const afterDay = await dayOf();
    expect(afterDay.evaluacion_dia.tandas_completadas).toBe(1);
    expect(afterDay.evaluacion_dia.unidades_completadas).toBe(2);
    expect(afterDay.evaluacion_dia.min_requerido).toBe(3);
    expect(afterDay.evaluacion_dia.cumplio_tandas).toBe(false);

    const read = dataOf(await handleManageTandas('read', { from: '2026-09-14', to: '2026-09-14' }));
    expect(read.por_dia).toEqual([{ date: '2026-09-14', completadas: 1, unidades: 2, interrumpidas: 0, minutos: 20 }]);
  });

  describe('US-F4-AS8 — correcciones en el reporte de cumplimiento y en el reporte semanal', () => {
    /** A: 480 min corregida a 70 (recorta 410). B: 60 min corregida a 30 (recorta 30). Ambas el lunes 14. */
    async function seedTwoCorrections(): Promise<{ a: any; b: any }> {
      const a = await closedCronometro('2026-09-14T13:00:00.000Z', '2026-09-14T21:00:00.000Z'); // 08:00-16:00 local
      vi.setSystemTime(new Date('2026-09-14T21:30:00.000Z'));
      dataOf(await correct(a.id, '2026-09-14T14:10:00.000Z', 'olvidé pararlo')); // 70 min

      const b = await closedCronometro('2026-09-14T22:00:00.000Z', '2026-09-14T23:00:00.000Z'); // 17:00-18:00 local
      vi.setSystemTime(new Date('2026-09-14T23:30:00.000Z'));
      dataOf(await correct(b.id, '2026-09-14T22:30:00.000Z', 'paré antes')); // 30 min
      return { a, b };
    }

    it('US-F4-AS8 · get_compliance_report trae correcciones { total: 2, minutos_recortados: 440 } en la semana en que se corrigió y { 0, 0 } en una sin correcciones', async () => {
      await setupProgram(3, 2);
      await seedTwoCorrections();

      const week1 = dataOf(await handleGetComplianceReport({ from: '2026-09-14', to: '2026-09-20' }));
      expect(week1.correcciones).toEqual({ total: 2, minutos_recortados: 440 });

      const week2 = dataOf(await handleGetComplianceReport({ from: '2026-09-21', to: '2026-09-27' }));
      expect(week2.correcciones).toEqual({ total: 0, minutos_recortados: 0 });

      const elsewhere = dataOf(await handleGetComplianceReport({ from: '2026-01-01', to: '2026-01-01' }));
      expect(elsewhere.correcciones).toEqual({ total: 0, minutos_recortados: 0 });
    });

    it('US-F4-AS8 · el payload de vista previa del reporte semanal trae correcciones, y la línea de texto solo cuando hubo alguna', async () => {
      await setupProgram(3, 2);
      await seedTwoCorrections();

      const week1 = dataOf(await handleManageWeeklyReport('preview', { program_week_id: 'pw-01' }));
      expect(week1.payload.correcciones).toEqual({ total: 2, minutos_recortados: 440 });
      expect(week1.text).toContain('Correcciones: 2 (440 min recortados)');

      const week2 = dataOf(await handleManageWeeklyReport('preview', { program_week_id: 'pw-02' }));
      expect(week2.payload.correcciones).toEqual({ total: 0, minutos_recortados: 0 });
      expect(week2.text).not.toContain('Correcciones');
    });

    it('US-F4-AS8 · la corrección se cuenta por la semana en que se hizo, no por la del inicio de la sesión', async () => {
      await setupProgram(3, 2);
      // Domingo 20: 10:00-14:00 locales (240 min). Se corrige el lunes 21 a las 10:00 locales.
      const closed = await closedCronometro('2026-09-20T15:00:00.000Z', '2026-09-20T19:00:00.000Z');
      expect(closed.actual_minutes).toBe(240);
      vi.setSystemTime(new Date('2026-09-21T15:00:00.000Z'));
      dataOf(await correct(closed.id, '2026-09-20T16:00:00.000Z', 'la corrijo hoy')); // 60 min: recorta 180

      const week1 = dataOf(await handleGetComplianceReport({ from: '2026-09-14', to: '2026-09-20' }));
      expect(week1.correcciones).toEqual({ total: 0, minutos_recortados: 0 });
      const week2 = dataOf(await handleGetComplianceReport({ from: '2026-09-21', to: '2026-09-27' }));
      expect(week2.correcciones).toEqual({ total: 1, minutos_recortados: 180 });
    });

    it('US-F4-AS8 · el payload congelado trae correcciones hasta el corte; una corrección posterior no lo reescribe pero sí aparece en el reporte de cumplimiento', async () => {
      await setupProgram(3, 1);
      await handleManageWeeklyReport('set_partner', {
        name: 'Andrés',
        email: 'andres@example.com',
        consented_at: '2026-09-11T00:00:00.000Z',
      });
      await seedTwoCorrections();
      // Una tercera sesión, del domingo, que se corregirá DESPUÉS del congelamiento.
      const c = await closedCronometro('2026-09-20T15:00:00.000Z', '2026-09-20T19:00:00.000Z'); // 240 min

      vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z')); // domingo 19:00:30 local: se congela
      const tick = await runExecutionTick(new Date(), { mailer: makeFakeMailer(), pusher: makeFakePusher() });
      expect(tick.frozen).toBe(1);

      const frozen = dataOf(await handleManageWeeklyReport('read', { program_week_id: 'pw-01' }));
      expect(frozen.status).toBe('congelado');
      expect(frozen.payload.correcciones).toEqual({ total: 2, minutos_recortados: 440 });
      expect(renderReportText(frozen.payload)).toContain('Correcciones: 2 (440 min recortados)');

      vi.setSystemTime(new Date('2026-09-21T01:00:00.000Z')); // 20:00 local: ya congelado
      dataOf(await correct(c.id, '2026-09-20T16:00:00.000Z', 'la corrijo tarde')); // recorta 180

      const stillFrozen = dataOf(await handleManageWeeklyReport('read', { program_week_id: 'pw-01' }));
      expect(stillFrozen.payload.correcciones).toEqual({ total: 2, minutos_recortados: 440 });

      const live = dataOf(await handleGetComplianceReport({ program_week_id: 'pw-01' }));
      expect(live.correcciones).toEqual({ total: 3, minutos_recortados: 620 });
    });

    it('US-F4-AS8 · un payload congelado sin sesiones corregidas trae { total: 0, minutos_recortados: 0 } y ninguna línea de texto', async () => {
      await setupProgram(3, 1);
      vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z'));
      const tick = await runExecutionTick(new Date(), { mailer: makeFakeMailer(), pusher: makeFakePusher() });
      expect(tick.frozen).toBe(1);

      const frozen = dataOf(await handleManageWeeklyReport('read', { program_week_id: 'pw-01' }));
      expect(frozen.payload.correcciones).toEqual({ total: 0, minutos_recortados: 0 });
      expect(renderReportText(frozen.payload)).not.toContain('Correcciones');
    });
  });

  it('US-F4-AS9 · POST /api/execution con manage_tandas:correct se rechaza por la lista blanca y no cambia nada', async () => {
    const closed = await closedCronometro(MON_14H, MON_18H);
    vi.setSystemTime(new Date('2026-09-14T23:30:00.000Z'));
    const before = await readTanda(closed.id);

    const response = await POST(
      new Request('http://localhost/api/execution', {
        method: 'POST',
        body: JSON.stringify({
          tool: 'manage_tandas',
          action: 'correct',
          data: { id: closed.id, ended_at: MON_15H, reason: 'desde la web' },
        }),
      })
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.status).toBe('error');
    expect(json.code).toBe('DATOS_INVALIDOS');
    expect(json.message).toContain('manage_tandas:correct');

    expect(await readTanda(closed.id)).toEqual(before);
  });
});
