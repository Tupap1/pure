import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleManageProgram,
  handleManageFriction,
  handleManageWeeklyReport,
} from '../../lib/execution/handlers';
import { runExecutionTick as runTick } from '../../lib/execution/tick';
import { renderReportText } from '../../lib/execution/report';
import { fetchFrictionMeasuresFromDb, fetchFrictionRatingsFromDb } from '../../lib/db/execution-pg';
import type { Mailer } from '../../lib/execution/mailer';
import type { Pusher } from '../../lib/execution/tick';

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

function makeFakeMailer(): Mailer & { calls: any[] } {
  const calls: any[] = [];
  return {
    calls,
    async send(payload) {
      calls.push(payload);
    },
  };
}

describe('[002] US-B5 — Registrar la fricción del teléfono y sacarla cuando me irrita', () => {
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

  it('US-B5-AS1 · habilitar dos medidas y rechazar la tercera por límite', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));

    const enable1 = await handleManageFriction('enable', { measure_key: 'sin_biometria' });
    expect(enable1.status).toBe('success');
    if (enable1.status === 'success') {
      expect((enable1.data as any).ya_habilitada).toBe(false);
    }

    const enable2 = await handleManageFriction('enable', { measure_key: 'escala_grises' });
    expect(enable2.status).toBe('success');
    if (enable2.status === 'success') {
      expect((enable2.data as any).ya_habilitada).toBe(false);
    }

    const read1 = await handleManageFriction('read', {});
    expect(read1.status).toBe('success');
    if (read1.status === 'success') {
      expect((read1.data as any).total_activas).toBe(2);
    }

    const enable3 = await handleManageFriction('enable', { measure_key: 'clave_larga' });
    expect(enable3.status).toBe('error');
    if (enable3.status === 'error') {
      expect((enable3 as any).code).toBe('LIMITE_FRICCION');
      expect((enable3 as any).message).toMatch(/estrés/);
      expect((enable3 as any).message).toMatch(/vale 0/);
    }
  });

  it('US-B5-AS2 · habilitar una medida inválida se rechaza', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));

    const res = await handleManageFriction('enable', { measure_key: 'celular_afuera' });
    expect(res.status).toBe('error');
    if (res.status === 'error') {
      expect((res as any).code).toBe('DATOS_INVALIDOS');
    }
  });

  it('US-B5-AS3 · verificar una medida cambia su estado de confirmada', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));

    await handleManageFriction('enable', { measure_key: 'sin_biometria' });

    const readBefore = await handleManageFriction('read', {});
    expect(readBefore.status).toBe('success');
    if (readBefore.status === 'success') {
      const measure = (readBefore.data as any).activas[0];
      expect(measure.confirmada).toBe(false);
    }

    const verify = await handleManageFriction('verify', { measure_key: 'sin_biometria' });
    expect(verify.status).toBe('success');
    if (verify.status === 'success') {
      expect((verify.data as any).verified_at).toBeTruthy();
    }

    const readAfter = await handleManageFriction('read', {});
    expect(readAfter.status).toBe('success');
    if (readAfter.status === 'success') {
      const measure = (readAfter.data as any).activas[0];
      expect(measure.confirmada).toBe(true);
    }

    const verifyInactive = await handleManageFriction('verify', { measure_key: 'clave_larga' });
    expect(verifyInactive.status).toBe('error');
    if (verifyInactive.status === 'error') {
      expect((verifyInactive as any).code).toBe('NO_ENCONTRADO');
    }
  });

  it('US-B5-AS4 · deshabilitar o habilitar una medida que ya está en ese estado no cambia nada', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));

    const enable1 = await handleManageFriction('enable', { measure_key: 'sin_biometria' });
    expect(enable1.status).toBe('success');
    if (enable1.status === 'success') {
      expect((enable1.data as any).ya_habilitada).toBe(false);
      expect((enable1.data as any).started_on).toBe('2026-09-14');
    }

    // habilitar otra vez una medida ya habilitada no cambia nada (FR-B17): mismo started_on
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z'));
    const enableAgain = await handleManageFriction('enable', { measure_key: 'sin_biometria' });
    expect(enableAgain.status).toBe('success');
    if (enableAgain.status === 'success') {
      expect((enableAgain.data as any).ya_habilitada).toBe(true);
      expect((enableAgain.data as any).started_on).toBe('2026-09-14');
    }

    const disable1 = await handleManageFriction('disable', { measure_key: 'sin_biometria' });
    expect(disable1.status).toBe('success');
    if (disable1.status === 'success') {
      expect((disable1.data as any).drop_reason).toBe('manual');
      expect((disable1.data as any).disabled_at).toBeTruthy();
    }

    const readAfter = await handleManageFriction('read', {});
    expect(readAfter.status).toBe('success');
    if (readAfter.status === 'success') {
      expect((readAfter.data as any).total_activas).toBe(0);
    }

    // lee la medida ya deshabilitada directamente del repositorio, para comparar su disabled_at
    // contra el que quede tras la segunda deshabilitación
    const disabledRow = await fetchFrictionMeasuresFromDb('sin_biometria');
    const firstDisabledAt = !Array.isArray(disabledRow) ? disabledRow?.disabled_at : undefined;
    expect(firstDisabledAt).toBeTruthy();

    // deshabilitar otra vez una medida ya deshabilitada no cambia nada (FR-B17): mismo disabled_at
    vi.setSystemTime(new Date('2026-09-16T15:00:00.000Z'));
    const disable2 = await handleManageFriction('disable', { measure_key: 'sin_biometria' });
    expect(disable2.status).toBe('success');
    if (disable2.status === 'success') {
      expect((disable2.data as any).ya_deshabilitada).toBe(true);
      expect((disable2.data as any).disabled_at).toBe(firstDisabledAt);
    }
  });

  it('US-B5-AS5 · calificar la irritación es única por semana y rechaza valores inválidos', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-21T15:00:00.000Z')); // semana 2, martes

    const rate1 = await handleManageFriction('rate', { score: 8 });
    expect(rate1.status).toBe('success');

    const rate2 = await handleManageFriction('rate', { score: 6 });
    expect(rate2.status).toBe('success');

    const read = await handleManageFriction('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      expect((read.data as any).irritacion_semana_actual).toBe(6);
    }

    const rateInvalid = await handleManageFriction('rate', { score: 11 });
    expect(rateInvalid.status).toBe('error');
    if (rateInvalid.status === 'error') {
      expect((rateInvalid as any).code).toBe('DATOS_INVALIDOS');
    }

    const rateFuture = await handleManageFriction('rate', { score: 5, program_week_id: 'pw-03' });
    expect(rateFuture.status).toBe('error');
    if (rateFuture.status === 'error') {
      expect((rateFuture as any).code).toBe('FECHA_FUTURA');
    }
  });

  it('US-B5-AS6 · dos semanas con irritación alta retiran la medida más nueva', async () => {
    await setupProgram();

    // habilitar sin_biometria el 14
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    await handleManageFriction('enable', { measure_key: 'sin_biometria' });

    // habilitar escala_grises el 21 (semana 2)
    vi.setSystemTime(new Date('2026-09-21T15:00:00.000Z'));
    await handleManageFriction('enable', { measure_key: 'escala_grises' });

    // calificar semana 2 con 7
    await handleManageFriction('rate', { score: 7 });

    // calificar semana 3 con 8
    vi.setSystemTime(new Date('2026-09-26T15:00:00.000Z')); // dentro de semana 2
    vi.setSystemTime(new Date('2026-09-28T15:00:00.000Z')); // dentro de semana 3
    await handleManageFriction('rate', { score: 8 });

    // correr el tick
    const pusher = makeFakePusher();
    vi.setSystemTime(new Date('2026-09-28T15:01:00.000Z'));
    await runTick(new Date(), { mailer: makeFakeMailer(), pusher });

    // escala_grises debe estar deshabilitada, con motivo irritación, y sin_biometria sigue activa
    const read = await handleManageFriction('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      const scales = (read.data as any).activas.find((m: any) => m.measure_key === 'escala_grises');
      expect(scales).toBeUndefined();
      const biometria = (read.data as any).activas.find((m: any) => m.measure_key === 'sin_biometria');
      expect(biometria).toBeTruthy();
    }

    const scalesRowAfterFirstRun = await fetchFrictionMeasuresFromDb('escala_grises');
    const scalesAfterFirstRun = !Array.isArray(scalesRowAfterFirstRun) ? scalesRowAfterFirstRun : undefined;
    expect(scalesAfterFirstRun?.enabled_slot).toBeFalsy();
    expect(scalesAfterFirstRun?.drop_reason).toBe('irritacion');
    const firstDisabledAt = scalesAfterFirstRun?.disabled_at;
    expect(firstDisabledAt).toBeTruthy();

    // la calificación de pw-03 (la posterior del par) queda con la medida que retiró
    const ratingRow = await fetchFrictionRatingsFromDb('pw-03');
    const rating = !Array.isArray(ratingRow) ? ratingRow : undefined;
    expect(rating?.dropped_measure_id).toBe('escala_grises');

    // ningún aviso debe mencionar fricción: el retiro no envía avisos (FR-B20)
    const frictionCalls = pusher.calls.filter((c) => c.title.toLowerCase().includes('fricci') || c.body.toLowerCase().includes('fricci') || c.tag.toLowerCase().includes('fricci'));
    expect(frictionCalls).toHaveLength(0);

    // segunda corrida del tick: no cambia nada (FR-039 + FR-B20)
    vi.setSystemTime(new Date('2026-09-28T15:02:00.000Z'));
    await runTick(new Date(), { mailer: makeFakeMailer(), pusher });

    const scalesRowAfterSecondRun = await fetchFrictionMeasuresFromDb('escala_grises');
    const scalesAfterSecondRun = !Array.isArray(scalesRowAfterSecondRun) ? scalesRowAfterSecondRun : undefined;
    expect(scalesAfterSecondRun?.disabled_at).toBe(firstDisabledAt);

    // sin_biometria debe seguir habilitada
    const read2 = await handleManageFriction('read', {});
    expect(read2.status).toBe('success');
    if (read2.status === 'success') {
      const biometria = (read2.data as any).activas.find((m: any) => m.measure_key === 'sin_biometria');
      expect(biometria).toBeTruthy();
    }
  });

  it('US-B5-AS7 · una semana con baja irritación en medio no retira nada', async () => {
    await setupProgram();

    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    await handleManageFriction('enable', { measure_key: 'sin_biometria' });
    await handleManageFriction('enable', { measure_key: 'escala_grises' });

    // semana 1 con 8
    await handleManageFriction('rate', { score: 8 });

    // semana 2 con 6
    vi.setSystemTime(new Date('2026-09-21T15:00:00.000Z'));
    await handleManageFriction('rate', { score: 6 });

    // semana 3 con 8
    vi.setSystemTime(new Date('2026-09-28T15:00:00.000Z'));
    await handleManageFriction('rate', { score: 8 });

    // correr el tick
    const pusher = makeFakePusher();
    vi.setSystemTime(new Date('2026-09-28T15:01:00.000Z'));
    await runTick(new Date(), { mailer: makeFakeMailer(), pusher });

    // ninguna medida se retira: los pares (1,2)=8,6 y (2,3)=6,8 no llegan los dos a 7
    const read = await handleManageFriction('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      expect((read.data as any).total_activas).toBe(2);
    }
  });

  it('US-B5-AS8 · el reporte congelado menciona las medidas retiradas por irritación', async () => {
    // repetir preparación de AS6
    await setupProgram();

    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    await handleManageFriction('enable', { measure_key: 'sin_biometria' });

    vi.setSystemTime(new Date('2026-09-21T15:00:00.000Z'));
    await handleManageFriction('enable', { measure_key: 'escala_grises' });
    await handleManageFriction('rate', { score: 7 });

    vi.setSystemTime(new Date('2026-09-28T15:00:00.000Z'));
    await handleManageFriction('rate', { score: 8 });

    // el tick que retira escala_grises tiene que correr ANTES del corte de pw-03 (domingo 4 de
    // octubre, 19:00 Bogotá): si el retiro ocurriera recién en la corrida del congelamiento,
    // disabled_at quedaría después del corte y listIrritationDropsInRange lo dejaría fuera de
    // este reporte.
    const pusher = makeFakePusher();
    vi.setSystemTime(new Date('2026-09-28T15:01:00.000Z'));
    await runTick(new Date(), { mailer: makeFakeMailer(), pusher });

    // correr el tick que congela pw-03 (domingo 4 de octubre, 19:05 Bogotá)
    vi.setSystemTime(new Date('2026-10-05T00:05:00.000Z'));
    await runTick(new Date(), { mailer: makeFakeMailer(), pusher });

    const report = await handleManageWeeklyReport('read', { program_week_id: 'pw-03' });
    expect(report.status).toBe('success');
    if (report.status === 'success') {
      const payload = (report.data as any).payload;
      expect(payload.friccion_retiradas).toContainEqual({ measure_key: 'escala_grises', fecha: '2026-09-28' });
      expect(renderReportText(payload)).toContain('Fricción: se retiró "escala de grises" por irritación.');
    }

    // el retiro sigue sin avisar al teléfono (FR-B20)
    const frictionNotifications = pusher.calls.filter((c) => c.title.toLowerCase().includes('fricci') || c.body.toLowerCase().includes('fricci') || c.tag.toLowerCase().includes('fricci'));
    expect(frictionNotifications).toHaveLength(0);
  });

  it('US-B5-AS9 · la fricción muestra el total activo y la irritación de la semana', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-21T15:00:00.000Z')); // semana 2

    await handleManageFriction('enable', { measure_key: 'sin_biometria' });
    await handleManageFriction('enable', { measure_key: 'escala_grises' });

    const rateRes = await handleManageFriction('rate', { score: 5 });
    expect(rateRes.status).toBe('success');

    const read = await handleManageFriction('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      expect((read.data as any).total_activas).toBe(2);
      expect((read.data as any).limite).toBe(2);
      expect((read.data as any).irritacion_semana_actual).toBe(5);
    }

    // sin calificación
    vi.setSystemTime(new Date('2026-09-28T15:00:00.000Z')); // semana 3, sin calificar
    const readNoRate = await handleManageFriction('read', {});
    expect(readNoRate.status).toBe('success');
    if (readNoRate.status === 'success') {
      expect((readNoRate.data as any).irritacion_semana_actual).toBeNull();
    }
  });
});
