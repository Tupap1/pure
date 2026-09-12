import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';

/**
 * La migración 008 corre sobre pg-mem porque __tests__/helpers/test-db.ts ejecuta las
 * migraciones reales (Constitución, Principio III): si el SQL usara plpgsql, `AT TIME ZONE`
 * o un índice único parcial, este archivo fallaría aquí en vez de en producción.
 */
describe('[001] Migración 008 — esquema base del Módulo de Ejecución (Foundational)', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  it('crea sobre pg-mem las tablas de la migración 008', () => {
    const tables = Array.from(harness.db.public.listTables()).map((t) => t.name);
    for (const table of [
      'program_weeks',
      'habits',
      'daily_checks',
      'routine_slots',
      'slot_outcomes',
      'plan_rehearsals',
      'tasks',
      'tandas',
    ]) {
      expect(tables).toContain(table);
    }
  });

  it('running_lock TEXT UNIQUE admite varios NULL y rechaza un segundo "running" (FR-004)', async () => {
    const insertTanda = (id: string, runningLock: string | null) =>
      harness.pool.query(
        `INSERT INTO tandas (id, local_date, started_at, locked_at, running_lock)
         VALUES ($1, $2, now(), now(), $3)`,
        [id, '2026-09-14', runningLock]
      );

    // Varias tandas cerradas (running_lock NULL) conviven sin problema: NULL nunca choca
    // consigo mismo en una columna UNIQUE, sea Postgres real o pg-mem.
    await expect(insertTanda('tanda-null-1', null)).resolves.toBeDefined();
    await expect(insertTanda('tanda-null-2', null)).resolves.toBeDefined();

    // La primera tanda "en curso" sí puede tomar el lock...
    await expect(insertTanda('tanda-running-1', 'running')).resolves.toBeDefined();
    // ...pero una segunda con el mismo valor viola la UNIQUE: es la garantía de FR-004
    // (como máximo una tanda en curso), sin depender de un índice único parcial.
    await expect(insertTanda('tanda-running-2', 'running')).rejects.toThrow();
  });

  it('borrar un schedules deja routine_slots.schedule_id en NULL (ON DELETE SET NULL)', async () => {
    await harness.pool.query(`INSERT INTO universities (id, name, modality) VALUES ('uni-1', 'U1', 'presencial')`);
    await harness.pool.query(`INSERT INTO subjects (id, university_id, name) VALUES ('sub-1', 'uni-1', 'Cálculo')`);
    await harness.pool.query(
      `INSERT INTO schedules (id, subject_id, day_of_week, start_time, end_time) VALUES ('sch-1', 'sub-1', 1, '08:00', '10:00')`
    );
    await harness.pool.query(
      `INSERT INTO routine_slots (id, days_of_week, cue_kind, cue_text, action_text, schedule_id)
       VALUES ('slot-1', $1, 'tras_clase', 'salgo de Cálculo', 'reviso apuntes 10 minutos', 'sch-1')`,
      [[1]]
    );

    await harness.pool.query('DELETE FROM schedules WHERE id = $1', ['sch-1']);

    const res = await harness.pool.query('SELECT schedule_id FROM routine_slots WHERE id = $1', ['slot-1']);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].schedule_id).toBeNull();
  });

  it('harness.reset() vacía las tablas nuevas del módulo', async () => {
    await harness.pool.query(
      `INSERT INTO tandas (id, local_date, started_at, locked_at) VALUES ('tanda-x', '2026-09-14', now(), now())`
    );
    const before = await harness.pool.query('SELECT COUNT(*)::int AS count FROM tandas');
    expect(before.rows[0].count).toBe(1);

    await harness.reset();

    const after = await harness.pool.query('SELECT COUNT(*)::int AS count FROM tandas');
    expect(after.rows[0].count).toBe(0);
  });
});
