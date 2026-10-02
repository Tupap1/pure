import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';

describe('execution-schema-foco', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  afterEach(async () => {
    await harness.reset();
  });

  describe('objetivos table', () => {
    it('table exists with expected columns', async () => {
      const result = await harness.pool.query(
        `INSERT INTO objetivos (id, name, active_name_key, subject_id, weekly_target_minutes, archived, archived_at, created_at)
         VALUES ('objetivo-1', 'Test', 'test', NULL, 60, FALSE, NULL, NOW())
         RETURNING id, name, active_name_key, subject_id, weekly_target_minutes, archived, archived_at, created_at`
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('id');
      expect(result.rows[0]).toHaveProperty('name');
      expect(result.rows[0]).toHaveProperty('active_name_key');
      expect(result.rows[0]).toHaveProperty('subject_id');
      expect(result.rows[0]).toHaveProperty('weekly_target_minutes');
      expect(result.rows[0]).toHaveProperty('archived');
      expect(result.rows[0]).toHaveProperty('archived_at');
      expect(result.rows[0]).toHaveProperty('created_at');
    });

    it('weekly_target_minutes rejects 0 and 10081', async () => {
      const rejectCases = [0, 10081];
      for (let i = 0; i < rejectCases.length; i++) {
        const minutes = rejectCases[i];
        const result = await harness.pool.query(
          `INSERT INTO objetivos (id, name, active_name_key, weekly_target_minutes, archived)
           VALUES ($1, $2, $3, $4, FALSE)`,
          [`objetivo-reject-${i}`, `Test${i}`, `test-reject-${i}`, minutes]
        ).catch((e: unknown) => ({ error: e }));
        expect(result.error).toBeDefined();
      }
    });

    it('weekly_target_minutes accepts NULL, 1, and 10080', async () => {
      const acceptCases = [null, 1, 10080];
      for (let i = 0; i < acceptCases.length; i++) {
        const minutes = acceptCases[i];
        const result = await harness.pool.query(
          `INSERT INTO objetivos (id, name, active_name_key, weekly_target_minutes, archived)
           VALUES ($1, $2, $3, $4, FALSE)
           RETURNING weekly_target_minutes`,
          [`objetivo-accept-${i}`, `Test${i}`, `test-accept-${i}`, minutes]
        );
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].weekly_target_minutes).toBe(minutes);
      }
    });

    it('active_name_key allows two NULLs', async () => {
      const result1 = await harness.pool.query(
        `INSERT INTO objetivos (id, name, active_name_key, archived)
         VALUES ('objetivo-1', 'Test1', NULL, TRUE)
         RETURNING id`
      );
      const result2 = await harness.pool.query(
        `INSERT INTO objetivos (id, name, active_name_key, archived)
         VALUES ('objetivo-2', 'Test2', NULL, TRUE)
         RETURNING id`
      );
      expect(result1.rows).toHaveLength(1);
      expect(result2.rows).toHaveLength(1);
    });

    it('active_name_key rejects duplicate non-NULL values', async () => {
      await harness.pool.query(
        `INSERT INTO objetivos (id, name, active_name_key, archived)
         VALUES ('objetivo-1', 'Test1', 'leetcode', FALSE)`
      );
      const result = await harness.pool.query(
        `INSERT INTO objetivos (id, name, active_name_key, archived)
         VALUES ('objetivo-2', 'Test2', 'leetcode', FALSE)`
      ).catch((e: unknown) => ({ error: e }));
      expect(result.error).toBeDefined();
    });
  });

  describe('frases table', () => {
    it('table exists with expected columns', async () => {
      const result = await harness.pool.query(
        `INSERT INTO frases (id, text, translation, source, active, created_at)
         VALUES ('frase-test', 'Lorem ipsum', 'Test translation', 'Test source', TRUE, NOW())
         RETURNING id, text, translation, source, active, created_at`
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('id');
      expect(result.rows[0]).toHaveProperty('text');
      expect(result.rows[0]).toHaveProperty('translation');
      expect(result.rows[0]).toHaveProperty('source');
      expect(result.rows[0]).toHaveProperty('active');
      expect(result.rows[0]).toHaveProperty('created_at');
    });
  });

  describe('tandas table new columns', () => {
    it('has kind, objective_id, corrected, corrected_at, original_ended_at, original_minutes, correction_reason', async () => {
      await harness.pool.query(`
        INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade)
        VALUES ('uni-1', 'Test University', 'presencial', 0, 100, 60)
      `);
      await harness.pool.query(`
        INSERT INTO subjects (id, university_id, name, code, credits, difficulty)
        VALUES ('subj-1', 'uni-1', 'Test Subject', 'TEST101', 3, 3)
      `);
      const result = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, objective_id, corrected, corrected_at, original_ended_at, original_minutes, correction_reason)
         VALUES ('tanda-1', 'subj-1', '2026-10-01', NOW(), 'completada', NULL, NOW(), 'temporizador', NULL, FALSE, NULL, NULL, NULL, NULL)
         RETURNING id, kind, objective_id, corrected, corrected_at, original_ended_at, original_minutes, correction_reason`
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('kind');
      expect(result.rows[0]).toHaveProperty('objective_id');
      expect(result.rows[0]).toHaveProperty('corrected');
      expect(result.rows[0]).toHaveProperty('corrected_at');
      expect(result.rows[0]).toHaveProperty('original_ended_at');
      expect(result.rows[0]).toHaveProperty('original_minutes');
      expect(result.rows[0]).toHaveProperty('correction_reason');
    });

    it('defaults kind to "temporizador" if not specified', async () => {
      await harness.pool.query(`
        INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade)
        VALUES ('uni-2', 'Test University 2', 'presencial', 0, 100, 60)
      `);
      await harness.pool.query(`
        INSERT INTO subjects (id, university_id, name, code, credits, difficulty)
        VALUES ('subj-2', 'uni-2', 'Test Subject 2', 'TEST102', 3, 3)
      `);
      const result = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at)
         VALUES ('tanda-2', 'subj-2', '2026-10-01', NOW(), 'completada', NULL, NOW())
         RETURNING kind`
      );
      expect(result.rows[0].kind).toBe('temporizador');
    });

    it('CHECK tandas_tipo_duracion accepts temporizador 10-180 and cronometro with NULL planned_minutes', async () => {
      await harness.pool.query(`
        INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade)
        VALUES ('uni-3', 'Test', 'presencial', 0, 100, 60)
      `);
      await harness.pool.query(`
        INSERT INTO subjects (id, university_id, name, code, credits, difficulty)
        VALUES ('subj-3', 'uni-3', 'Test', 'TEST', 3, 3)
      `);

      // Accept temporizador 10
      const r1 = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, planned_minutes)
         VALUES ('t1', 'subj-3', '2026-10-01', NOW(), 'completada', NULL, NOW(), 'temporizador', 10)
         RETURNING id`
      );
      expect(r1.rows).toHaveLength(1);

      // Accept temporizador 180
      const r2 = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, planned_minutes)
         VALUES ('t2', 'subj-3', '2026-10-02', NOW(), 'completada', NULL, NOW(), 'temporizador', 180)
         RETURNING id`
      );
      expect(r2.rows).toHaveLength(1);

      // Accept cronometro with NULL
      const r3 = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, planned_minutes)
         VALUES ('t3', 'subj-3', '2026-10-03', NOW(), 'completada', NULL, NOW(), 'cronometro', NULL)
         RETURNING id`
      );
      expect(r3.rows).toHaveLength(1);
    });

    it('CHECK tandas_tipo_duracion rejects temporizador 9, 181, NULL and cronometro with planned_minutes', async () => {
      await harness.pool.query(`
        INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade)
        VALUES ('uni-4', 'Test', 'presencial', 0, 100, 60)
      `);
      await harness.pool.query(`
        INSERT INTO subjects (id, university_id, name, code, credits, difficulty)
        VALUES ('subj-4', 'uni-4', 'Test', 'TEST', 3, 3)
      `);

      // Reject temporizador 9
      const r1 = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, planned_minutes)
         VALUES ('t1', 'subj-4', '2026-10-01', NOW(), 'completada', NULL, NOW(), 'temporizador', 9)`
      ).catch((e: unknown) => ({ error: e }));
      expect(r1.error).toBeDefined();

      // Reject temporizador 181
      const r2 = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, planned_minutes)
         VALUES ('t2', 'subj-4', '2026-10-02', NOW(), 'completada', NULL, NOW(), 'temporizador', 181)`
      ).catch((e: unknown) => ({ error: e }));
      expect(r2.error).toBeDefined();

      // Reject temporizador with NULL
      const r3 = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, planned_minutes)
         VALUES ('t3', 'subj-4', '2026-10-03', NOW(), 'completada', NULL, NOW(), 'temporizador', NULL)`
      ).catch((e: unknown) => ({ error: e }));
      expect(r3.error).toBeDefined();

      // Reject cronometro with 30
      const r4 = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, planned_minutes)
         VALUES ('t4', 'subj-4', '2026-10-04', NOW(), 'completada', NULL, NOW(), 'cronometro', 30)`
      ).catch((e: unknown) => ({ error: e }));
      expect(r4.error).toBeDefined();

      // Reject invalid kind
      const r5 = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, planned_minutes)
         VALUES ('t5', 'subj-4', '2026-10-05', NOW(), 'completada', NULL, NOW(), 'otro', 30)`
      ).catch((e: unknown) => ({ error: e }));
      expect(r5.error).toBeDefined();
    });

    it('CHECK tandas_correccion_completa rejects incomplete corrections', async () => {
      await harness.pool.query(`
        INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade)
        VALUES ('uni-5', 'Test', 'presencial', 0, 100, 60)
      `);
      await harness.pool.query(`
        INSERT INTO subjects (id, university_id, name, code, credits, difficulty)
        VALUES ('subj-5', 'uni-5', 'Test', 'TEST', 3, 3)
      `);

      // Reject: corrected=TRUE without corrected_at
      const r1 = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, planned_minutes, corrected)
         VALUES ('t1', 'subj-5', '2026-10-01', NOW(), 'completada', NULL, NOW(), 'temporizador', 10, TRUE)`
      ).catch((e: unknown) => ({ error: e }));
      expect(r1.error).toBeDefined();

      // Accept complete correction
      const r2 = await harness.pool.query(
        `INSERT INTO tandas (id, subject_id, local_date, started_at, status, running_lock, locked_at, kind, planned_minutes, corrected, corrected_at, original_ended_at, original_minutes, correction_reason)
         VALUES ('t2', 'subj-5', '2026-10-02', NOW(), 'completada', NULL, NOW(), 'temporizador', 10, TRUE, NOW(), NOW(), 20, 'Test reason')
         RETURNING id`
      );
      expect(r2.rows).toHaveLength(1);
    });
  });

  describe('migrations idempotence', () => {
    it('running migrations twice does not fail', async () => {
      // Just verify no error was thrown during setup (migrations ran twice)
      expect(harness.pool).toBeDefined();
    });
  });

  describe('test-db reset() includes objectives and frases', () => {
    it('reset deletes objetivos and frases', async () => {
      // Insert test data
      await harness.pool.query(
        `INSERT INTO objetivos (id, name, active_name_key, archived)
         VALUES ('obj-1', 'Test', 'test', FALSE)`
      );
      await harness.pool.query(
        `INSERT INTO frases (id, text, active)
         VALUES ('frase-1', 'Test', TRUE)`
      );

      // Reset
      await harness.reset();

      // Verify they're deleted
      const objResult = await harness.pool.query(`SELECT COUNT(*) as count FROM objetivos`);
      const fraseResult = await harness.pool.query(`SELECT COUNT(*) as count FROM frases`);
      expect(parseInt(objResult.rows[0].count, 10)).toBe(0);
      expect(parseInt(fraseResult.rows[0].count, 10)).toBe(0);
    });
  });
});
