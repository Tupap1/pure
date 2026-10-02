import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageTandas, handleManageProgram, handleGetToday } from '../../lib/execution/handlers';
import { handleManageUniversities, handleManageSubjects } from '../../mcp-server/tools-handler';

// US-T2 — Registro tardío acotado y visible (FR-T10..FR-T15). `log_late` es la única entrada del
// módulo que acepta instantes del cliente: una excepción deliberada y acotada al Principio III
// (documentada en plan.md), simétrica a `edited_after_lock`. Bogotá es UTC-5, así que las 18:00
// locales del 21-sep (lunes) son 2026-09-21T23:00:00Z.

const HOY_18H = new Date('2026-09-21T23:00:00.000Z'); // 18:00 local, 2026-09-21

describe('[003] US-T2 — Registro tardío acotado y visible', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
    // subject_id en tandas tiene FK a subjects: log_late exige un subject_id real.
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA', scale_max: 5, passing_grade: 3.0 });
    await handleManageSubjects('create', { id: 'sub-calculo', university_id: 'uni-1', name: 'Cálculo' });
    await handleManageSubjects('create', { id: 'sub-fisica', university_id: 'uni-1', name: 'Física' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('US-T2-AS1 · a las 18:00 registrar 15:00-16:00 deja una tanda completada de 60 minutos, late_logged y la fecha de hoy', async () => {
    vi.setSystemTime(HOY_18H);

    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-21T20:00:00.000Z', // 15:00 local
      ended_at: '2026-09-21T21:00:00.000Z', // 16:00 local
    });

    expect(res.status).toBe('success');
    if (res.status !== 'success') return;
    const tanda = res.data as any;
    expect(tanda.status).toBe('completada');
    expect(tanda.actual_minutes).toBe(60);
    expect(tanda.planned_minutes).toBe(60); // igual a actual_minutes: no hubo plan, hubo una sesión medida una sola vez
    expect(tanda.late_logged).toBe(true);
    expect(tanda.local_date).toBe('2026-09-21');
    expect(tanda.running_lock).toBeNull();
    expect(tanda.subject_id).toBe('sub-calculo');
  });

  it('US-T2-AS2 · una sesión que empezó ayer se rechaza con REGISTRO_TARDIO_INVALIDO y no crea nada', async () => {
    vi.setSystemTime(HOY_18H);

    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-20T20:00:00.000Z', // 15:00 local de AYER
      ended_at: '2026-09-20T21:00:00.000Z',
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('REGISTRO_TARDIO_INVALIDO');

    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') expect((read.data as any).tandas.length).toBe(0);
  });

  it('US-T2-AS2 · una sesión que empezó hace más de 6 horas se rechaza con REGISTRO_TARDIO_INVALIDO y no crea nada', async () => {
    vi.setSystemTime(HOY_18H);

    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-21T16:00:00.000Z', // 11:00 local: 7 horas antes de las 18:00
      ended_at: '2026-09-21T16:30:00.000Z',
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('REGISTRO_TARDIO_INVALIDO');

    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') expect((read.data as any).tandas.length).toBe(0);
  });

  it('US-T2-AS3 · ended_at en el futuro se rechaza con REGISTRO_TARDIO_INVALIDO', async () => {
    vi.setSystemTime(HOY_18H); // 18:00 local

    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-21T21:00:00.000Z', // 16:00 local
      ended_at: '2026-09-21T23:30:00.000Z', // 18:30 local: 30 min en el futuro
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('REGISTRO_TARDIO_INVALIDO');
  });

  it('US-T2-AS3 · ended_at anterior o igual a started_at se rechaza con REGISTRO_TARDIO_INVALIDO', async () => {
    vi.setSystemTime(HOY_18H);

    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-21T21:00:00.000Z',
      ended_at: '2026-09-21T21:00:00.000Z', // igual a started_at
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('REGISTRO_TARDIO_INVALIDO');
  });

  it('US-T2-AS4 · una duración de 9 minutos se rechaza con REGISTRO_TARDIO_INVALIDO', async () => {
    vi.setSystemTime(HOY_18H);

    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-21T22:00:00.000Z', // 17:00 local
      ended_at: '2026-09-21T22:09:00.000Z', // 9 minutos
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('REGISTRO_TARDIO_INVALIDO');
  });

  it('US-T2-AS4 · una duración de 61 minutos se rechaza con REGISTRO_TARDIO_INVALIDO', async () => {
    vi.setSystemTime(HOY_18H);

    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-21T20:00:00.000Z', // 15:00 local: dentro de la ventana de 6h
      ended_at: '2026-09-21T21:01:00.000Z', // 61 minutos después
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('REGISTRO_TARDIO_INVALIDO');
  });

  it('US-T2-AS5 · se solapa con una tanda ya registrada y se rechaza con REGISTRO_TARDIO_INVALIDO', async () => {
    vi.setSystemTime(HOY_18H);

    const first = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-21T20:00:00.000Z', // 15:00 local
      ended_at: '2026-09-21T20:10:00.000Z', // 15:10 local
    });
    expect(first.status).toBe('success');

    const overlapping = await handleManageTandas('log_late', {
      subject_id: 'sub-fisica',
      started_at: '2026-09-21T20:05:00.000Z', // 15:05 local: dentro del tramo anterior
      ended_at: '2026-09-21T20:20:00.000Z', // 15:20 local
    });
    expect(overlapping.status).toBe('error');
    if (overlapping.status === 'error') expect(overlapping.code).toBe('REGISTRO_TARDIO_INVALIDO');
  });

  it('US-T2-AS5 · una tanda en curso ocupa desde su inicio hasta ahora, y un registro que la cruza se rechaza', async () => {
    // Empieza una tanda normal de 60 min a las 17:30 local: sigue en curso a las 18:00 (termina a las 18:30).
    vi.setSystemTime(new Date('2026-09-21T22:30:00.000Z')); // 17:30 local
    const start = await handleManageTandas('start', { planned_minutes: 60 });
    expect(start.status).toBe('success');

    vi.setSystemTime(HOY_18H); // 18:00 local: la tanda anterior sigue en curso
    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-fisica',
      started_at: '2026-09-21T22:45:00.000Z', // 17:45 local: dentro de [17:30, ahora=18:00]
      ended_at: '2026-09-21T22:55:00.000Z', // 17:55 local
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('REGISTRO_TARDIO_INVALIDO');
  });

  it('US-T2-AS5 · un cronómetro iniciado ayer y todavía en curso ocupa hasta ahora: un registro de hoy 00:30-01:00 se rechaza', async () => {
    // 004 (FR-F14a / FR-T11): el cronómetro empezó AYER (local_date = 2026-09-20), pero sigue
    // corriendo a la 01:00 de hoy, así que ocupa [ayer 22:00, ahora]. Un solapamiento calculado solo
    // sobre las tandas de hoy lo dejaría pasar.
    vi.setSystemTime(new Date('2026-09-21T03:00:00.000Z')); // domingo 20 22:00 local
    const start = await handleManageTandas('start', { kind: 'cronometro' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;
    expect((start.data as any).tanda.local_date).toBe('2026-09-20');

    vi.setSystemTime(new Date('2026-09-21T06:00:00.000Z')); // lunes 21 01:00 local, el cronómetro sigue en curso
    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-fisica',
      started_at: '2026-09-21T05:30:00.000Z', // 00:30 local
      ended_at: '2026-09-21T06:00:00.000Z', // 01:00 local
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('REGISTRO_TARDIO_INVALIDO');

    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') expect((read.data as any).tandas).toHaveLength(1); // solo el cronómetro: no se creó nada
  });

  it('US-T2-AS5 · un cronómetro de ayer 23:00 a hoy 00:40 ya cerrado ocupa su tramo: un registro de hoy 00:20-00:50 se rechaza', async () => {
    vi.setSystemTime(new Date('2026-09-21T04:00:00.000Z')); // domingo 20 23:00 local
    const start = await handleManageTandas('start', { kind: 'cronometro' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;

    vi.setSystemTime(new Date('2026-09-21T05:40:00.000Z')); // lunes 21 00:40 local
    const finish = await handleManageTandas('finish', { id: (start.data as any).tanda.id });
    expect(finish.status).toBe('success');

    vi.setSystemTime(new Date('2026-09-21T06:00:00.000Z')); // lunes 21 01:00 local
    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-fisica',
      started_at: '2026-09-21T05:20:00.000Z', // 00:20 local: dentro del cronómetro, que terminó a las 00:40
      ended_at: '2026-09-21T05:50:00.000Z', // 00:50 local
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('REGISTRO_TARDIO_INVALIDO');

    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') expect((read.data as any).tandas).toHaveLength(1);
  });

  it('US-T2-AS5 · un cronómetro de ayer ya cerrado no bloquea un registro de hoy que empieza justo cuando él terminó [regresión]', async () => {
    vi.setSystemTime(new Date('2026-09-21T04:00:00.000Z')); // domingo 20 23:00 local
    const start = await handleManageTandas('start', { kind: 'cronometro' });
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;

    vi.setSystemTime(new Date('2026-09-21T05:40:00.000Z')); // lunes 21 00:40 local
    const finish = await handleManageTandas('finish', { id: (start.data as any).tanda.id });
    expect(finish.status).toBe('success');

    vi.setSystemTime(new Date('2026-09-21T06:00:00.000Z')); // lunes 21 01:00 local
    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-fisica',
      started_at: '2026-09-21T05:40:00.000Z', // 00:40 local: empieza exactamente cuando termina el cronómetro
      ended_at: '2026-09-21T05:55:00.000Z', // 00:55 local
    });
    expect(res.status).toBe('success');
  });

  it('US-T2-AS5 · que una tanda termine exactamente cuando otra empieza no cuenta como solapamiento', async () => {
    vi.setSystemTime(HOY_18H);

    const first = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-21T20:00:00.000Z', // 15:00 local
      ended_at: '2026-09-21T20:10:00.000Z', // 15:10 local
    });
    expect(first.status).toBe('success');

    const backToBack = await handleManageTandas('log_late', {
      subject_id: 'sub-fisica',
      started_at: '2026-09-21T20:10:00.000Z', // empieza justo cuando termina la anterior
      ended_at: '2026-09-21T20:20:00.000Z',
    });
    expect(backToBack.status).toBe('success');
  });

  it('US-T2-AS6 · los tres primeros registros tardíos del día se crean; el cuarto se rechaza con LIMITE_REGISTRO_TARDIO', async () => {
    vi.setSystemTime(HOY_18H); // 18:00 local

    const ventanas: [string, string][] = [
      ['2026-09-21T18:00:00.000Z', '2026-09-21T18:10:00.000Z'], // 13:00-13:10 local
      ['2026-09-21T19:00:00.000Z', '2026-09-21T19:10:00.000Z'], // 14:00-14:10 local
      ['2026-09-21T20:00:00.000Z', '2026-09-21T20:10:00.000Z'], // 15:00-15:10 local
      ['2026-09-21T21:00:00.000Z', '2026-09-21T21:10:00.000Z'], // 16:00-16:10 local
    ];

    for (let i = 0; i < 3; i++) {
      const res = await handleManageTandas('log_late', {
        subject_id: 'sub-calculo',
        started_at: ventanas[i][0],
        ended_at: ventanas[i][1],
      });
      expect(res.status).toBe('success');
    }

    const cuarto = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: ventanas[3][0],
      ended_at: ventanas[3][1],
    });
    expect(cuarto.status).toBe('error');
    if (cuarto.status === 'error') expect(cuarto.code).toBe('LIMITE_REGISTRO_TARDIO');

    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') expect((read.data as any).tandas.length).toBe(3);
  });

  it('US-T2-AS7 · con mínimo diario de 3, una tardía de 40 minutos como único registro cumple el mínimo con 4 unidades', async () => {
    await handleManageProgram('init', {
      starts_on: '2026-09-21', // lunes (misma semana que 2026-09-14, usado en otras pruebas de la 003)
      weeks: [{ min_tandas_dia: 3, phase: 'arranque' }],
    });

    vi.setSystemTime(HOY_18H); // 18:00 local, 2026-09-21
    const res = await handleManageTandas('log_late', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-21T21:40:00.000Z', // 16:40 local
      ended_at: '2026-09-21T22:20:00.000Z', // 17:20 local: 40 minutos
    });
    expect(res.status).toBe('success');

    const today = await handleGetToday();
    expect(today.status).toBe('success');
    if (today.status === 'success') {
      const payload = today.data as any;
      expect(payload.evaluacion_dia).not.toBeNull();
      expect(payload.evaluacion_dia.tandas_completadas).toBe(1);
      expect(payload.evaluacion_dia.unidades_completadas).toBe(4); // floor(40/10) = 4
      expect(payload.evaluacion_dia.cumplio_tandas).toBe(true);
      expect(payload.evaluacion_dia.day_fulfilled).toBe(true);
    }
  });

  it('US-T2-AS9 · [regresión] start sigue rechazando started_at/ended_at del cliente', async () => {
    vi.setSystemTime(HOY_18H);

    const res = await handleManageTandas('start', {
      subject_id: 'sub-calculo',
      started_at: '2026-09-21T20:00:00.000Z',
      ended_at: '2026-09-21T21:00:00.000Z',
    } as any);
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('DATOS_INVALIDOS');

    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') expect((read.data as any).tandas.length).toBe(0);
  });
});
