import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageTandas, handleGetToday, handleManageProgram } from '../../lib/execution/handlers';
import { runExecutionTick, type Pusher } from '../../lib/execution/tick';
import type { Mailer, MailerPayload } from '../../lib/execution/mailer';

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

describe('[002] US-B2 — La tanda olvidada no bloquea el sistema', () => {
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

  it('US-B2-AS1 · empezar una tanda nueva cierra la vencida en la misma acción', async () => {
    // Crear programa para que get_today funcione
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [{ min_tandas_dia: 1, phase: 'arranque' }],
    });

    // Empezar una tanda a las 15:00
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const first = await handleManageTandas('start', {});
    expect(first.status).toBe('success');
    if (first.status !== 'success') return;
    const firstTandaId = (first.data as any).tanda.id;

    // Avanzar 2 horas (la tanda de 10 minutos ya se cumplió hace mucho)
    vi.setSystemTime(new Date('2026-09-14T17:00:00.000Z'));
    // Empezar una segunda tanda
    const second = await handleManageTandas('start', {});
    expect(second.status).toBe('success');
    if (second.status !== 'success') return;

    // Leer las tandas: la primera debe estar completada, la segunda en curso
    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status !== 'success') return;

    const tandas = (read.data as any).tandas as any[];
    const first_tanda = tandas.find((t: any) => t.id === firstTandaId);

    expect(first_tanda).toBeDefined();
    expect(first_tanda.status).toBe('completada');
    expect(first_tanda.actual_minutes).toBe(10);
    expect(first_tanda.running_lock).toBeNull();
    expect(new Date(first_tanda.ended_at).toISOString()).toBe('2026-09-14T15:10:00.000Z');

    // Verify there's a second tanda in running state
    const running_tandas = tandas.filter((t: any) => t.status === 'en_curso');
    expect(running_tandas).toHaveLength(1);
  });

  it('US-B2-AS2 · el tick cierra la tanda una sola vez y notifica una vez', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [{ min_tandas_dia: 1, phase: 'arranque' }],
    });

    // Empezar una tanda a las 15:00
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    await handleManageTandas('start', {});

    // Saltar a 15:10:01 (pasado el tiempo de 10 minutos)
    vi.setSystemTime(new Date('2026-09-14T15:10:01.000Z'));
    const pusher = makeFakePusher();
    await runExecutionTick(new Date(), { mailer: makeFakeMailer(), pusher });

    // Debe haber exactamente 1 aviso con tag 'tanda'
    const tandaNotifications = pusher.calls.filter((c) => c.tag === 'tanda');
    expect(tandaNotifications).toHaveLength(1);

    // Verificar que la tanda se cerró
    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      const tanda = (read.data as any).tandas[0];
      expect(tanda.status).toBe('completada');
      expect(new Date(tanda.ended_at).toISOString()).toBe('2026-09-14T15:10:00.000Z');
    }

    // Segunda corrida a 15:10:25 (sin cambios)
    vi.setSystemTime(new Date('2026-09-14T15:10:25.000Z'));
    const pusher2 = makeFakePusher();
    await runExecutionTick(new Date(), { mailer: makeFakeMailer(), pusher: pusher2 });

    // Debe seguir habiendo un solo aviso (sin duplicados)
    expect(pusher2.calls.filter((c) => c.tag === 'tanda')).toHaveLength(0);

    // Verificar que la tanda no cambió
    const read2 = await handleManageTandas('read', {});
    expect(read2.status).toBe('success');
    if (read2.status === 'success') {
      const tanda = (read2.data as any).tandas[0];
      expect(tanda.status).toBe('completada');
      expect(new Date(tanda.ended_at).toISOString()).toBe('2026-09-14T15:10:00.000Z');
    }
  });

  it('US-B2-AS3 · una tanda a las 22:25 termina por tiempo sin cierre de hora', async () => {
    // Bogotá es UTC−5: 22:25 local = 03:25 UTC
    await handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: [{ min_tandas_dia: 1, phase: 'arranque' }],
    });

    // Empezar una tanda a las 22:25 Bogotá (03:25 UTC)
    vi.setSystemTime(new Date('2026-09-15T03:25:00.000Z'));
    const start = await handleManageTandas('start', {});
    expect(start.status).toBe('success');

    // A las 03:31 UTC (22:31 Bogotá), corre el tick (donde viviría un cierre por hora)
    vi.setSystemTime(new Date('2026-09-15T03:31:00.000Z'));
    const pusher3 = makeFakePusher();
    await runExecutionTick(new Date(), { mailer: makeFakeMailer(), pusher: pusher3 });

    // Después, la tanda sigue en curso
    const current = await handleManageTandas('current', {});
    expect(current.status).toBe('success');
    if (current.status === 'success') {
      const data = (current.data as any);
      expect(data.tanda.status).toBe('en_curso');
      expect(data.seconds_left).toBeGreaterThan(0);
    }

    // A las 03:35:01 UTC (22:35:01 Bogotá), se cumple el tiempo, corre el tick
    vi.setSystemTime(new Date('2026-09-15T03:35:01.000Z'));
    const pusher = makeFakePusher();
    await runExecutionTick(new Date(), { mailer: makeFakeMailer(), pusher });

    // Leer: la tanda debe estar completada con local_date: '2026-09-14'
    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      const tanda = (read.data as any).tandas[0];
      expect(tanda.status).toBe('completada');
      expect(tanda.local_date).toBe('2026-09-14');
    }

    // A las 03:36:00 UTC, get_today debe devolver tandas_today === 1
    vi.setSystemTime(new Date('2026-09-15T03:36:00.000Z'));
    const today = await handleGetToday();
    expect(today.status).toBe('success');
    if (today.status === 'success') {
      expect((today.data as any).tandas_today).toBe(1);
    }
  });
});
