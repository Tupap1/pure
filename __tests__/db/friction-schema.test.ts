import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';

/**
 * La migración 012 corre sobre pg-mem (Constitución, Principio III): si el SQL usara
 * plpgsql, `AT TIME ZONE` o un índice único parcial, este archivo fallaría en pg-mem
 * en lugar de hacerlo silenciosamente en producción.
 */
describe('[002] Migración 012 — fricción del teléfono (US-B5)', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  it('crea sobre pg-mem las tablas friction_measures y friction_ratings', () => {
    const tables = Array.from(harness.db.public.listTables()).map((t) => t.name);
    expect(tables).toContain('friction_measures');
    expect(tables).toContain('friction_ratings');
  });

  it('enabled_slot TEXT UNIQUE admite varios NULL y rechaza un segundo slot ocupado', async () => {
    const insertMeasure = (id: string, enabledSlot: string | null) =>
      harness.pool.query(
        `INSERT INTO friction_measures (id, enabled_slot) VALUES ($1, $2)`,
        [id, enabledSlot]
      );

    // Varias medidas deshabilitadas (enabled_slot NULL) conviven sin problema
    await expect(insertMeasure('sin_biometria', null)).resolves.toBeDefined();
    await expect(insertMeasure('clave_larga', null)).resolves.toBeDefined();

    // La primera medida con slot 'a' sí puede tomar el lock...
    await expect(insertMeasure('escala_grises', 'a')).resolves.toBeDefined();
    // ...pero una segunda con el mismo slot viola la UNIQUE
    await expect(insertMeasure('redes_fuera_home', 'a')).rejects.toThrow();
  });

  it('el reclamo condicionado devuelve 0 filas si el slot está ocupado', async () => {
    // Inserta dos medidas: una con slot 'a' (habilitada), otra sin slot (deshabilitada)
    await harness.pool.query(
      `INSERT INTO friction_measures (id, enabled_slot, started_on, enabled_at)
       VALUES ($1, 'a', '2026-09-14', now())`,
      ['sin_biometria']
    );
    await harness.pool.query(
      `INSERT INTO friction_measures (id) VALUES ($1)`,
      ['clave_larga']
    );

    // Intenta reclamar el slot 'a' en la medida deshabilitada: falla porque ya está ocupado
    const res = await harness.pool.query(
      `UPDATE friction_measures
       SET enabled_slot = $2, started_on = $3, enabled_at = now(), verified_at = NULL, disabled_at = NULL, drop_reason = NULL
       WHERE id = $1 AND enabled_slot IS NULL AND NOT EXISTS (SELECT 1 FROM friction_measures f2 WHERE f2.enabled_slot = $2)
       RETURNING *`,
      ['clave_larga', 'a', '2026-09-14']
    );
    expect(res.rows).toHaveLength(0);
  });

  it('el reclamo condicionado devuelve 1 fila si el slot está libre', async () => {
    // Inserta una medida deshabilitada
    await harness.pool.query(
      `INSERT INTO friction_measures (id) VALUES ($1)`,
      ['sin_biometria']
    );

    // Reclama el slot 'a': debe devolver la fila actualizada
    const res = await harness.pool.query(
      `UPDATE friction_measures
       SET enabled_slot = $2, started_on = $3, enabled_at = now(), verified_at = NULL, disabled_at = NULL, drop_reason = NULL
       WHERE id = $1 AND enabled_slot IS NULL AND NOT EXISTS (SELECT 1 FROM friction_measures f2 WHERE f2.enabled_slot = $2)
       RETURNING *`,
      ['sin_biometria', 'a', '2026-09-14']
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].enabled_slot).toBe('a');
    expect(res.rows[0].id).toBe('sin_biometria');
  });

  it('score CHECK rechaza 11 y acepta 0-10', async () => {
    // Crea un programa para tener un program_week_id válido
    await harness.pool.query(
      `INSERT INTO program_weeks (id, week_number, starts_on)
       VALUES ($1, 1, '2026-09-14')`
    );

    // Score 11 viola el CHECK
    await expect(
      harness.pool.query(
        `INSERT INTO friction_ratings (id, program_week_id, score, rated_at)
         VALUES ($1, $2, 11, now())`,
        ['rating-1', 'pw-01']
      )
    ).rejects.toThrow();

    // Score 10 es válido
    await expect(
      harness.pool.query(
        `INSERT INTO friction_ratings (id, program_week_id, score, rated_at)
         VALUES ($1, $2, 10, now())`,
        ['rating-2', 'pw-01']
      )
    ).resolves.toBeDefined();

    // Score 0 también es válido
    await expect(
      harness.pool.query(
        `INSERT INTO friction_ratings (id, program_week_id, score, rated_at)
         VALUES ($1, $2, 0, now())`,
        ['rating-3', 'pw-01']
      )
    ).resolves.toBeDefined();
  });

  it('friction_ratings.program_week_id rechaza una semana inexistente', async () => {
    await expect(
      harness.pool.query(
        `INSERT INTO friction_ratings (id, program_week_id, score, rated_at)
         VALUES ($1, 'pw-inexistente', 5, now())`,
        ['rating-1']
      )
    ).rejects.toThrow();
  });

  it('harness.reset() vacía friction_measures y friction_ratings', async () => {
    // Inserta una medida y una calificación
    await harness.pool.query(
      `INSERT INTO program_weeks (id, week_number, starts_on)
       VALUES ($1, 1, '2026-09-14')`
    );
    await harness.pool.query(
      `INSERT INTO friction_measures (id) VALUES ($1)`,
      ['sin_biometria']
    );
    await harness.pool.query(
      `INSERT INTO friction_ratings (id, program_week_id, score, rated_at)
       VALUES ($1, $2, 5, now())`,
      ['rating-1', 'pw-01']
    );

    let before = await harness.pool.query('SELECT COUNT(*)::int AS count FROM friction_measures');
    expect(before.rows[0].count).toBe(1);
    before = await harness.pool.query('SELECT COUNT(*)::int AS count FROM friction_ratings');
    expect(before.rows[0].count).toBe(1);

    await harness.reset();

    const after1 = await harness.pool.query('SELECT COUNT(*)::int AS count FROM friction_measures');
    expect(after1.rows[0].count).toBe(0);
    const after2 = await harness.pool.query('SELECT COUNT(*)::int AS count FROM friction_ratings');
    expect(after2.rows[0].count).toBe(0);
  });
});
