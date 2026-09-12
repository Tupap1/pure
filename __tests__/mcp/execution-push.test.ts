import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleManageProgram,
  handleManageTandas,
  handleManageWeeklyReport,
  handleManageRoutineSlots,
  handleGetToday,
} from '../../lib/execution/handlers';
import { runExecutionTick, Pusher } from '../../lib/execution/tick';
import type { Mailer, MailerPayload } from '../../lib/execution/mailer';
import { upsertPushSubscriptionToDb, fetchPushSubscriptionsFromDb } from '../../lib/db/execution-pg';

// US7 — Avisos en el teléfono (FR-032, FR-033). runExecutionTick (US6, T054) ya finaliza tandas,
// congela y envía el reporte; esta historia le agrega los tres avisos push de
// contracts/notifications.md: fin de tanda, reporte congelado y fallo de envío. Cada uno se
// manda una sola vez (marcas end_notified_at / freeze_notified_at); nunca hay un cuarto tipo de
// aviso (FR-032). lib/execution/push.ts (Pusher real sobre web-push) todavía no existe a la
// altura de este commit RED (T061 lo crea): se carga con import() dinámico, igual que
// __tests__/mcp/weekly-report.test.ts hace con lib/execution/tick.

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

function makeFakeMailer(behavior: 'success' | 'fail' = 'success'): Mailer & { calls: MailerPayload[] } {
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

async function setupPartner() {
  return handleManageWeeklyReport('set_partner', {
    name: 'Andrés',
    email: 'andres@example.com',
    consented_at: '2026-09-11T00:00:00.000Z',
  });
}

describe('[001] US7 — Avisos en el teléfono', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
    delete process.env.ZEPTOMAIL_TOKEN;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('US7-AS2 · al cumplirse los 10 minutos con el teléfono bloqueado llega un único aviso "Terminó la tanda" en ≤ 20 s, marcado con end_notified_at', async () => {
    await setupProgram();

    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z')); // lunes, dentro de la semana 1
    await handleManageTandas('start', {});

    vi.setSystemTime(new Date('2026-09-14T15:10:05.000Z')); // +10 min y unos segundos: tiempo cumplido
    const pusher = makeFakePusher();
    const tick = await runExecutionTick(new Date(), { mailer: makeFakeMailer(), pusher });
    expect(tick.notified).toBe(1);
    expect(pusher.calls).toHaveLength(1);
    expect(pusher.calls[0]).toMatchObject({ title: 'Terminó la tanda', body: '10 minutos', tag: 'tanda', url: '/' });

    const read = await handleManageTandas('read', { from: '2026-09-14', to: '2026-09-14' });
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      const tanda = (read.data as any).tandas[0];
      expect(tanda.status).toBe('completada');
      expect(tanda.end_notified_at).toBeTruthy();
    }

    // Repetir el tick no debe reenviar: end_notified_at ya quedó marcado.
    const secondTick = await runExecutionTick(new Date(), { mailer: makeFakeMailer(), pusher });
    expect(secondTick.notified).toBe(0);
    expect(pusher.calls).toHaveLength(1);
  });

  it('US7-AS3 · al congelar el reporte llega un aviso con la hora límite de la nota; si falla el envío, llega un aviso del fallo', async () => {
    await setupProgram(2);
    await setupPartner();

    const failingMailer = makeFakeMailer('fail');
    const pusher = makeFakePusher();

    vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z')); // domingo 19:00:30 Bogotá: se congela
    await runExecutionTick(new Date(), { mailer: failingMailer, pusher });

    const freezeCalls = pusher.calls.filter((c) => c.tag === 'reporte');
    expect(freezeCalls).toHaveLength(1);
    expect(freezeCalls[0].title).toBe('Reporte de la semana congelado');
    expect(freezeCalls[0].body).toMatch(/^Tu nota hasta las \d{2}:\d{2}$/);
    expect(freezeCalls[0].url).toBe('/');

    const read = await handleManageWeeklyReport('read', { program_week_id: 'pw-01' });
    expect(read.status).toBe('success');
    if (read.status === 'success') expect((read.data as any).freeze_notified_at).toBeTruthy();

    // Repetir el tick de congelamiento no debe re-notificar (idempotente).
    await runExecutionTick(new Date(), { mailer: failingMailer, pusher });
    expect(pusher.calls.filter((c) => c.tag === 'reporte')).toHaveLength(1);

    // 3 intentos fallidos consecutivos, espaciados 10 min, agotan los reintentos -> aviso de fallo.
    vi.setSystemTime(new Date('2026-09-21T01:05:00.000Z')); // ventana cerrada: intento 1
    await runExecutionTick(new Date(), { mailer: failingMailer, pusher });
    vi.setSystemTime(new Date('2026-09-21T01:15:01.000Z')); // +10 min: intento 2
    await runExecutionTick(new Date(), { mailer: failingMailer, pusher });
    vi.setSystemTime(new Date('2026-09-21T01:25:02.000Z')); // +10 min: intento 3, se agota
    await runExecutionTick(new Date(), { mailer: failingMailer, pusher });

    const failCalls = pusher.calls.filter((c) => c.tag === 'reporte-fallo');
    expect(failCalls).toHaveLength(1);
    expect(failCalls[0].title).toBe('No se pudo enviar el reporte');
    expect(failCalls[0].url).toBe('/');

    // Repetir el tick sobre un reporte ya 'fallido' no debe volver a avisar del fallo.
    await runExecutionTick(new Date(), { mailer: failingMailer, pusher });
    expect(pusher.calls.filter((c) => c.tag === 'reporte-fallo')).toHaveLength(1);
  });

  it('US7-AS4 · una respuesta 404/410 del servicio de push borra la suscripción', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:andres@example.com';

    const { createWebPusher } = await import(/* @vite-ignore */ '../../lib/execution/push');
    const webpush = (await import('web-push')).default as any;

    await upsertPushSubscriptionToDb({ id: 'sub-viva', endpoint: 'https://viva.example.com/x', p256dh: 'p1', auth: 'a1' });
    await upsertPushSubscriptionToDb({ id: 'sub-muerta', endpoint: 'https://muerta.example.com/y', p256dh: 'p2', auth: 'a2' });

    webpush.sendNotification.mockImplementation((subscription: any) => {
      if (subscription.endpoint.includes('muerta')) {
        const error: any = new Error('Gone');
        error.statusCode = 410;
        return Promise.reject(error);
      }
      return Promise.resolve();
    });

    const pusher: Pusher = createWebPusher();
    const result = await pusher.notify({ title: 'Prueba', body: 'cuerpo', url: '/', tag: 'prueba' });

    expect(result.sent).toBe(1);
    expect(result.removed).toBe(1);

    const remainingRaw = await fetchPushSubscriptionsFromDb();
    const remaining = (Array.isArray(remainingRaw) ? remainingRaw : []).map((s: any) => s.id);
    expect(remaining).toContain('sub-viva');
    expect(remaining).not.toContain('sub-muerta');
  });

  it('sin VAPID configurado, notify() es un no-op y nunca lanza', async () => {
    const { createWebPusher } = await import(/* @vite-ignore */ '../../lib/execution/push');
    const pusher: Pusher = createWebPusher();
    await upsertPushSubscriptionToDb({ id: 'sub-1', endpoint: 'https://x.example.com/1', p256dh: 'p', auth: 'a' });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await pusher.notify({ title: 'Prueba', body: 'cuerpo', url: '/', tag: 'prueba' });
    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('US7-AS5 · en un día con disparadores configurados no se emite ningún otro tipo de aviso', async () => {
    await setupProgram();
    await handleManageRoutineSlots('create', {
      days_of_week: [1],
      cue_kind: 'hora',
      cue_text: 'sean las 8 de la mañana',
      action_text: 'estudiar Cálculo 20 minutos',
      anchor_time: '08:00',
    });

    const pusher = makeFakePusher();
    const mailer = makeFakeMailer();

    // Recorre varias horas del lunes: el disparador queda vigente y luego caduca, sin que eso
    // dispare ningún tipo de aviso (FR-032: solo fin de tanda, congelamiento y fallo de envío).
    for (const iso of ['2026-09-14T13:05:00.000Z', '2026-09-14T14:05:00.000Z', '2026-09-14T18:05:00.000Z']) {
      vi.setSystemTime(new Date(iso));
      await handleGetToday(undefined, new Date());
      await runExecutionTick(new Date(), { mailer, pusher });
    }

    expect(pusher.calls).toHaveLength(0);
  });
});
