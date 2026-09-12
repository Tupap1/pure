import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageProgram } from '../../lib/execution/handlers';

// Foundational: manage_program es la primera herramienta MCP del módulo. FR-017 (semanas desde
// un lunes, solo futuras editables), FR-040 (los datos entran solo por herramientas, nunca
// sembrados en una migración) y US3-AS7 (semana en curso vs. futura).

describe('manage_program (Foundational — FR-017, FR-040, US3-AS7)', () => {
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

  it('ninguna migración del módulo inserta datos (FR-040)', () => {
    const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      expect(content.toLowerCase()).not.toMatch(/insert\s+into/);
    }
  });

  it('init crea pw-01…pw-10 desde un lunes, con starts_on consecutivos de 7 días', async () => {
    const weeks = Array.from({ length: 10 }, (_, i) => ({
      min_tandas_dia: i === 0 ? 1 : 3,
      phase: 'arranque',
    }));

    const res = await handleManageProgram('init', { starts_on: '2026-09-14', weeks });
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;

    const created = res.data as any[];
    expect(created).toHaveLength(10);
    expect(created[0].id).toBe('pw-01');
    expect(created[0].starts_on).toBe('2026-09-14');
    expect(created[1].id).toBe('pw-02');
    expect(created[1].starts_on).toBe('2026-09-21');
    expect(created[9].id).toBe('pw-10');
  });

  it('rechaza un día que no es lunes (NO_ES_LUNES)', async () => {
    const res = await handleManageProgram('init', {
      starts_on: '2026-09-15', // martes
      weeks: [{ min_tandas_dia: 1, phase: 'arranque' }],
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('NO_ES_LUNES');
  });

  it('rechaza un segundo init una vez que ya existe un programa (PROGRAMA_EXISTENTE)', async () => {
    const weeks = [{ min_tandas_dia: 1, phase: 'arranque' }];
    const first = await handleManageProgram('init', { starts_on: '2026-09-14', weeks });
    expect(first.status).toBe('success');

    const second = await handleManageProgram('init', { starts_on: '2026-10-05', weeks });
    expect(second.status).toBe('error');
    if (second.status === 'error') expect(second.code).toBe('PROGRAMA_EXISTENTE');
  });

  it('update_week sobre la semana en curso → SEMANA_EN_CURSO, y sobre una futura → OK (US3-AS7)', async () => {
    const weeks = [
      { min_tandas_dia: 1, phase: 'arranque' },
      { min_tandas_dia: 3, phase: 'arranque' },
    ];
    await handleManageProgram('init', { starts_on: '2026-09-14', weeks });

    vi.setSystemTime(new Date('2026-09-15T12:00:00Z')); // dentro de pw-01 (semana en curso)

    const onCurrentWeek = await handleManageProgram('update_week', { id: 'pw-01', min_tandas_dia: 2 });
    expect(onCurrentWeek.status).toBe('error');
    if (onCurrentWeek.status === 'error') expect(onCurrentWeek.code).toBe('SEMANA_EN_CURSO');

    const onFutureWeek = await handleManageProgram('update_week', { id: 'pw-02', min_tandas_dia: 5 });
    expect(onFutureWeek.status).toBe('success');
    if (onFutureWeek.status === 'success') {
      expect((onFutureWeek.data as any).min_tandas_dia).toBe(5);
    }
  });

  it('update_week sobre un id inexistente devuelve NO_ENCONTRADO', async () => {
    const res = await handleManageProgram('update_week', { id: 'pw-99', min_tandas_dia: 2 });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('NO_ENCONTRADO');
  });

  it('upsert_habit crea un hábito y lo actualiza en una segunda llamada (upsert por id)', async () => {
    const created = await handleManageProgram('upsert_habit', {
      id: 'levantada_0600',
      label: 'Levantarme a las 6:00',
      started_on: '2026-09-14',
      days_of_week: [1, 2, 3, 4, 5],
    });
    expect(created.status).toBe('success');

    const updated = await handleManageProgram('upsert_habit', {
      id: 'levantada_0600',
      label: 'Levantarme a las 6:00 AM',
      started_on: '2026-09-14',
      target_days: 90,
    });
    expect(updated.status).toBe('success');
    if (updated.status === 'success') {
      const habit = updated.data as any;
      expect(habit.label).toBe('Levantarme a las 6:00 AM');
      expect(habit.target_days).toBe(90);
    }

    const read = await handleManageProgram('read');
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      const habits = (read.data as any).habits as any[];
      expect(habits).toHaveLength(1);
      expect(habits[0].id).toBe('levantada_0600');
    }
  });

  it('retire_habit marca retired_on en un hábito existente y NO_ENCONTRADO en uno inexistente', async () => {
    await handleManageProgram('upsert_habit', {
      id: 'celular_afuera',
      label: 'Celular fuera del cuarto',
      started_on: '2026-09-14',
    });

    const retired = await handleManageProgram('retire_habit', { id: 'celular_afuera', retired_on: '2026-12-01' });
    expect(retired.status).toBe('success');
    if (retired.status === 'success') {
      expect((retired.data as any).retired_on).toBe('2026-12-01');
    }

    const notFound = await handleManageProgram('retire_habit', { id: 'no-existe', retired_on: '2026-12-01' });
    expect(notFound.status).toBe('error');
    if (notFound.status === 'error') expect(notFound.code).toBe('NO_ENCONTRADO');
  });
});
