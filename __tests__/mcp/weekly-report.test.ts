import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageProgram, handleManageTandas, handleManageWeeklyReport } from '../../lib/execution/handlers';
import type { Mailer, MailerPayload } from '../../lib/execution/mailer';

interface TickResult {
  frozen: number;
  sent: number;
  failed: number;
  notified: number;
}
type RunExecutionTick = (now: Date, opts: { mailer: Mailer }) => Promise<TickResult>;

// lib/execution/tick.ts todavía no existe a la altura de este commit RED (T054 lo crea): se
// carga con `import()` dinámico en el beforeAll de abajo, para que cada prueba falle por su
// propia razón (TypeError al llamar una función que no existe) en vez de un solo "módulo no
// encontrado" que tapa el archivo entero.
let runExecutionTick: RunExecutionTick;

// US6 — Reporte semanal congelado por correo (FR-019..FR-024, FR-039). runExecutionTick es el
// tick idempotente (Constitución, "portabilidad": puede dispararse desde el propio proceso o
// desde un programador externo) que congela y envía; manage_weekly_report expone las mismas
// reglas para el asistente de IA y para `run_tick` (el disparador externo que exige FR-039).
//
// Nota de tiempos: `note_deadline = max(corte, now) + 60 min` (plan.md, US6 · Reporte): la
// ventana de nota es siempre una hora fresca desde el instante en que la semana REALMENTE se
// congela, no desde el corte teórico de las 19:00. Por eso cada prueba que además necesita que
// el reporte se ENVÍE hace dos avances de reloj: uno para congelar (justo después del corte) y
// otro, ya pasada esa hora fresca, para que la ventana cierre y el envío se intente.

interface FakeMailer extends Mailer {
  calls: MailerPayload[];
}

function makeFakeMailer(behavior: 'success' | 'fail' = 'success'): FakeMailer {
  const calls: MailerPayload[] = [];
  return {
    calls,
    async send(payload: MailerPayload) {
      calls.push(payload);
      if (behavior === 'fail') throw new Error('fallo simulado de envío');
    },
  };
}

async function setupProgram(weekCount = 1) {
  return handleManageProgram('init', {
    starts_on: '2026-09-14', // lunes
    weeks: Array.from({ length: weekCount }, () => ({ min_tandas_dia: 1, phase: 'arranque' })),
  });
}

async function setupPartner(overrides: Partial<{ name: string; email: string; consented_at: string }> = {}) {
  return handleManageWeeklyReport('set_partner', {
    name: 'Andrés',
    email: 'andres@example.com',
    consented_at: '2026-09-11T00:00:00.000Z',
    ...overrides,
  });
}

function readReport(programWeekId: string) {
  return handleManageWeeklyReport('read', { program_week_id: programWeekId }) as Promise<
    { status: 'success'; data: any } | { status: 'error'; code: string; message: string }
  >;
}

async function runTickAction() {
  const res = await handleManageWeeklyReport('run_tick', undefined);
  return res as { status: 'success'; data: { frozen: number; sent: number; failed: number; notified: number } };
}

describe('[001] US6 — Reporte semanal congelado por correo', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
    const modulePath = '../../lib/execution/tick';
    ({ runExecutionTick } = await import(/* @vite-ignore */ modulePath));
  });

  beforeEach(async () => {
    await harness.reset();
    // El mailer real (createZeptoMailer) no debe intervenir en estas pruebas ni heredar
    // variables de otro archivo de test que corra en el mismo worker de Vitest.
    delete process.env.ZEPTOMAIL_TOKEN;
    delete process.env.ZEPTOMAIL_URL;
    delete process.env.REPORT_FROM;
    delete process.env.REPORT_FROM_NAME;
    delete process.env.REPORT_REPLY_TO;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('US6-AS1 · a las 19:00 del domingo el proceso programado congela el reporte de la semana con los datos hasta ese instante', async () => {
    await setupProgram();
    await setupPartner();

    vi.setSystemTime(new Date('2026-09-20T23:59:00.000Z')); // domingo 18:59 Bogotá: el corte no ha llegado
    let tick = await runExecutionTick(new Date(), { mailer: makeFakeMailer() });
    expect(tick.frozen).toBe(0);

    vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z')); // domingo 19:00:30 Bogotá: ya pasó
    tick = await runExecutionTick(new Date(), { mailer: makeFakeMailer() });
    expect(tick.frozen).toBe(1);

    const read = await readReport('pw-01');
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      expect(read.data.status).toBe('congelado');
      expect(read.data.payload.week_number).toBe(1);
    }
  });

  it('US6-AS2 · registrar tandas después de congelar no cambia los números del reporte', async () => {
    await setupProgram();
    await setupPartner();

    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z')); // martes, dentro de la semana 1
    await handleManageTandas('start', {});

    vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z')); // corte del domingo
    await runExecutionTick(new Date(), { mailer: makeFakeMailer() });

    const before = await readReport('pw-01');
    expect(before.status).toBe('success');
    const daysBefore = before.status === 'success' ? before.data.payload.days_fulfilled : null;

    // Una tanda nueva DESPUÉS de congelar no debe tocar el payload ya guardado.
    vi.setSystemTime(new Date('2026-09-21T00:10:00.000Z'));
    await handleManageTandas('start', {});

    const after = await readReport('pw-01');
    expect(after.status).toBe('success');
    if (after.status === 'success') {
      expect(after.data.payload.days_fulfilled).toBe(daysBefore);
    }
  });

  it('US6-AS3 · la nota se guarda dentro de la ventana de 60 minutos y se rechaza después de que cierra', async () => {
    await setupProgram();
    await setupPartner();

    vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z')); // congela: ventana hasta ~01:00:30
    await runExecutionTick(new Date(), { mailer: makeFakeMailer() });

    vi.setSystemTime(new Date('2026-09-21T00:30:00.000Z')); // dentro de la ventana
    const ok = await handleManageWeeklyReport('set_note', { program_week_id: 'pw-01', note: 'una nota' });
    expect(ok.status).toBe('success');

    vi.setSystemTime(new Date('2026-09-21T01:05:00.000Z')); // la ventana ya cerró
    const rejected = await handleManageWeeklyReport('set_note', { program_week_id: 'pw-01', note: 'otra nota' });
    expect(rejected.status).toBe('error');
    if (rejected.status === 'error') expect(rejected.code).toBe('VENTANA_CERRADA');
  });

  it('set_note sobre una semana sin reporte congelado devuelve REPORTE_NO_CONGELADO', async () => {
    await setupProgram();
    const res = await handleManageWeeklyReport('set_note', { program_week_id: 'pw-01', note: 'nota' });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('REPORTE_NO_CONGELADO');
  });

  it('US6-AS4 · a las 20:00, con la ventana de nota cerrada, el reporte se envía exactamente una vez aunque el tick corra varias veces', async () => {
    await setupProgram();
    await setupPartner();

    vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z'));
    await runExecutionTick(new Date(), { mailer: makeFakeMailer() }); // congela; ventana hasta ~01:00:30

    vi.setSystemTime(new Date('2026-09-21T01:05:00.000Z')); // ventana cerrada
    const mailer = makeFakeMailer();
    const first = await runExecutionTick(new Date(), { mailer });
    expect(first.sent).toBe(1);

    const second = await runExecutionTick(new Date(), { mailer });
    expect(second.sent).toBe(0);
    expect(mailer.calls).toHaveLength(1);

    const sendAgain = await handleManageWeeklyReport('send', { program_week_id: 'pw-01' });
    expect(sendAgain.status).toBe('error');
    if (sendAgain.status === 'error') expect(sendAgain.code).toBe('YA_ENVIADO');
  });

  it('run_tick ejecuta un tick completo y repetirlo no duplica envíos (FR-039)', async () => {
    await setupProgram();
    await setupPartner();

    vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z')); // domingo 19:00:30 Bogotá: se congela
    const frozen = await runTickAction();
    expect(frozen.status).toBe('success');
    expect(frozen.data.frozen).toBe(1);
    expect(frozen.data.sent).toBe(0); // la ventana de nota (fresca) sigue abierta

    vi.setSystemTime(new Date('2026-09-21T01:05:00.000Z')); // la ventana ya cerró
    const first = await runTickAction();
    expect(first.status).toBe('success');
    expect(first.data.frozen).toBe(0); // ya estaba congelado: no se congela dos veces
    expect(first.data.sent + first.data.failed).toBe(1); // un solo intento (sin ZEPTOMAIL_TOKEN, falla)

    const second = await runTickAction();
    expect(second.status).toBe('success');
    expect(second.data.frozen).toBe(0);
    expect(second.data.sent).toBe(0);
    expect(second.data.failed).toBe(0); // dentro del backoff de 10 min: no reintenta todavía
  });

  it('US6-AS6 · si el envío falla, hay como máximo 3 reintentos espaciados, el reporte queda fallido y el siguiente lo menciona', async () => {
    await setupProgram(2);
    await setupPartner();

    const failingMailer = makeFakeMailer('fail');

    vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z')); // congela; ventana hasta ~01:00:30
    await runExecutionTick(new Date(), { mailer: failingMailer });

    vi.setSystemTime(new Date('2026-09-21T01:05:00.000Z')); // ventana cerrada: 1er intento
    await runExecutionTick(new Date(), { mailer: failingMailer });
    let read = await readReport('pw-01');
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      expect(read.data.status).toBe('congelado'); // vuelve a congelado: aún quedan intentos
      expect(read.data.attempts).toBe(1);
    }

    vi.setSystemTime(new Date('2026-09-21T01:15:01.000Z')); // +10min: 2do intento
    await runExecutionTick(new Date(), { mailer: failingMailer });
    vi.setSystemTime(new Date('2026-09-21T01:25:02.000Z')); // +10min: 3er intento
    await runExecutionTick(new Date(), { mailer: failingMailer });

    read = await readReport('pw-01');
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      expect(read.data.status).toBe('fallido');
      expect(read.data.attempts).toBe(3);
      expect(read.data.last_error).toContain('fallo simulado');
    }
    expect(failingMailer.calls).toHaveLength(3);

    // La semana 2 (siguiente) menciona que el reporte anterior no se pudo entregar.
    vi.setSystemTime(new Date('2026-09-28T00:00:30.000Z')); // corte de la semana 2
    await runExecutionTick(new Date(), { mailer: makeFakeMailer() });
    const read2 = await readReport('pw-02');
    expect(read2.status).toBe('success');
    if (read2.status === 'success') {
      expect(read2.data.payload.previous_report_failed).toBe(true);
    }
  });

  it('US6-AS8 · si el sistema estuvo apagado el domingo, al volver congela con el corte original y late=true', async () => {
    await setupProgram();
    await setupPartner();

    // Pure "arranca" el lunes: el tick corre por primera vez muy después del corte del domingo.
    vi.setSystemTime(new Date('2026-09-21T14:00:00.000Z')); // lunes 09:00 Bogotá
    const tick = await runExecutionTick(new Date(), { mailer: makeFakeMailer() });
    expect(tick.frozen).toBe(1);

    const read = await readReport('pw-01');
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      expect(read.data.payload.late).toBe(true);
      // frozen_at usa el corte ORIGINAL del domingo, no el instante en que arrancó el lunes.
      expect(new Date(read.data.frozen_at).toISOString()).toBe('2026-09-21T00:00:00.000Z');
      // La ventana de nota es de 60 minutos, contados desde que Pure realmente se puso al día.
      expect(new Date(read.data.note_deadline).toISOString()).toBe('2026-09-21T15:00:00.000Z');
    }
  });

  it('US6-AS9 · sin destinatario con consentimiento el envío falla por falta de destinatario', async () => {
    await setupProgram();
    // Sin set_partner: no hay destinatario vigente.

    vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z')); // congela; ventana hasta ~01:00:30
    const frozen = await runExecutionTick(new Date(), { mailer: makeFakeMailer() });
    expect(frozen.frozen).toBe(1);

    vi.setSystemTime(new Date('2026-09-21T01:05:00.000Z')); // ventana cerrada: se intenta enviar
    const tick = await runExecutionTick(new Date(), { mailer: makeFakeMailer() });
    expect(tick.failed).toBe(1);

    const read = await readReport('pw-01');
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      expect(read.data.last_error).toContain('SIN_PARTNER');
    }
  });

  it('registrar un destinatario sin consented_at se rechaza (CONSENTIMIENTO_REQUERIDO)', async () => {
    const res = await handleManageWeeklyReport('set_partner', { name: 'Andrés', email: 'andres@example.com' } as any);
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('CONSENTIMIENTO_REQUERIDO');
  });

  it('caso borde · si se cambia de destinatario después del congelamiento, el envío usa el vigente al congelar', async () => {
    await setupProgram();
    await setupPartner({ name: 'Andrés', email: 'andres@example.com' });

    vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z'));
    await runExecutionTick(new Date(), { mailer: makeFakeMailer() }); // congela con Andrés como vigente

    // Cambia el destinatario DESPUÉS de congelar, dentro de la ventana de nota.
    await setupPartner({ name: 'Otra Persona', email: 'otra@example.com' });

    vi.setSystemTime(new Date('2026-09-21T01:05:00.000Z')); // ventana cerrada: se envía
    const mailer = makeFakeMailer();
    await runExecutionTick(new Date(), { mailer });

    expect(mailer.calls).toHaveLength(1);
    expect(mailer.calls[0].to).toBe('andres@example.com'); // el vigente AL CONGELAR, no el actual
  });
});
