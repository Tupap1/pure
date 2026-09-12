import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageDailyChecks, handleManageProgram } from '../../lib/execution/handlers';

// US3 — Hábitos del día y día cumplido (FR-014..FR-016). manage_daily_checks:set registra el
// estado de un hábito un día dado: se acepta hasta las 03:00 del día siguiente a esa fecha
// (después, DIA_CERRADO), nunca para una fecha futura (FECHA_FUTURA), y solo si el hábito está
// activo ese día (HABITO_INACTIVO). Es upsert idempotente por `${date}:${habit_id}`.

describe('[001] US3 — Hábitos del día y día cumplido', () => {
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

  it('US3-AS5 · registrar un hábito de ayer después de las 03:00 de hoy se rechaza porque el día ya cerró', async () => {
    await handleManageProgram('upsert_habit', { id: 'levantada', label: 'Levantarme', started_on: '2026-09-13' });

    vi.setSystemTime(new Date('2026-09-15T08:01:00.000Z')); // 03:01 Bogotá del 15: el 14 ya cerró
    const res = await handleManageDailyChecks('set', { habit_id: 'levantada', status: 'cumplido', date: '2026-09-14' });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('DIA_CERRADO');
  });

  it('registrar un hábito en una fecha futura se rechaza (FECHA_FUTURA)', async () => {
    await handleManageProgram('upsert_habit', { id: 'levantada', label: 'Levantarme', started_on: '2026-09-13' });

    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z')); // 10:00 Bogotá
    const res = await handleManageDailyChecks('set', { habit_id: 'levantada', status: 'cumplido', date: '2026-09-15' });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('FECHA_FUTURA');
  });

  it('registrar un hábito que no está activo ese día se rechaza (HABITO_INACTIVO)', async () => {
    await handleManageProgram('upsert_habit', {
      id: 'salida-lunes',
      label: 'Solo lunes',
      started_on: '2026-09-14',
      days_of_week: [1],
    });

    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z')); // martes 15, 10:00 Bogotá
    const res = await handleManageDailyChecks('set', { habit_id: 'salida-lunes', status: 'cumplido' }); // date por defecto: hoy (martes)
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('HABITO_INACTIVO');
  });

  it('set es idempotente por ${date}:${habit_id} — una segunda llamada actualiza el mismo registro, no lo duplica', async () => {
    await handleManageProgram('upsert_habit', { id: 'levantada', label: 'Levantarme', started_on: '2026-09-14' });
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z')); // 10:00 Bogotá

    const first = await handleManageDailyChecks('set', { habit_id: 'levantada', status: 'cumplido' });
    expect(first.status).toBe('success');

    const second = await handleManageDailyChecks('set', { habit_id: 'levantada', status: 'na', note: 'cambié de opinión' });
    expect(second.status).toBe('success');
    if (second.status === 'success') {
      const record = second.data as any;
      expect(record.id).toBe('2026-09-14:levantada');
      expect(record.status).toBe('na');
    }

    const read = await handleManageDailyChecks('read', { from: '2026-09-14', to: '2026-09-14' });
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      const dia = (read.data as any).dias.find((d: any) => d.date === '2026-09-14');
      expect(dia.checks).toHaveLength(1); // no se duplicó
    }
  });
});
