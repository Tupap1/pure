import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  saveClassSessionToDb,
  fetchClassSessionsFromDb,
  deleteClassSessionFromDb,
  saveUniversityToDb,
  saveSubjectToDb,
} from '../../lib/db/repository-pg';

/**
 * El camino de Postgres es el que corre en produccion, y tiene dos entradas distintas:
 * las migraciones de db/migrations y el bootstrap inline de initPostgresSchema, que es
 * el que usan el servidor MCP y los tests. class_sessions llego solo por la primera, asi
 * que cualquier entorno levantado por el bootstrap se caia al guardar una sesion.
 *
 * createTestDb ejecuta la secuencia exacta de produccion -migraciones y despues
 * bootstrap- sobre pg-mem, de modo que estas pruebas fallan si las dos definiciones se
 * vuelven a separar.
 */
describe('Sesiones de clase sobre el esquema real de Postgres', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
    await saveUniversityToDb({
      id: 'uni-1',
      name: 'Universidad de Cundinamarca',
      modality: 'presencial',
      scale_min: 0,
      scale_max: 5,
      passing_grade: 3,
      color: '#0ea5e9',
    });
    await saveSubjectToDb({
      id: 'sub-1',
      university_id: 'uni-1',
      name: 'Ecuaciones Diferenciales',
      code: 'MAT-304',
      credits: 3,
      difficulty: 3,
      modality: 'presencial',
      target_grade: 4.5,
      current_grade: 0,
    });
  });

  it('crea la tabla class_sessions en la secuencia de arranque de produccion', () => {
    const tables = Array.from(harness.db.public.listTables()).map((t) => t.name);
    expect(tables).toContain('class_sessions');
  });

  it('guarda y recupera una sesion con todos sus campos', async () => {
    await saveClassSessionToDb({
      id: 'cs-1',
      subject_id: 'sub-1',
      schedule_id: null,
      session_date: '2026-08-15T13:00:00.000Z',
      title: 'Clase 01 - Transformada de Laplace',
      summary: 'Definicion de la transformada y tabla de pares basicos.',
      notion_link: 'https://notion.so/clase-01-laplace',
      recording_url: 'https://loom.com/share/abc',
      topics_covered: ['laplace', 'inversas'],
      notes: 'Repasar la tabla antes del parcial.',
    });

    const saved = await fetchClassSessionsFromDb('cs-1');
    expect(saved).not.toBeNull();
    expect(saved.title).toBe('Clase 01 - Transformada de Laplace');
    expect(saved.notion_link).toBe('https://notion.so/clase-01-laplace');
    expect(saved.recording_url).toBe('https://loom.com/share/abc');
    expect(saved.notes).toBe('Repasar la tabla antes del parcial.');
    // topics_covered viaja como TEXT[]: es el unico campo que no es escalar y por eso
    // el que mas facilmente se degrada a string en un round-trip.
    expect(saved.topics_covered).toEqual(['laplace', 'inversas']);
  });

  it('actualiza la sesion existente en vez de duplicarla', async () => {
    await saveClassSessionToDb({
      id: 'cs-1',
      subject_id: 'sub-1',
      session_date: '2026-08-15T13:00:00.000Z',
      title: 'Clase 01 - Transformada de Laplace (corregida)',
      summary: null,
      notion_link: null,
      recording_url: null,
      topics_covered: [],
      notes: null,
    });

    const saved = await fetchClassSessionsFromDb('cs-1');
    expect(saved.title).toBe('Clase 01 - Transformada de Laplace (corregida)');

    // Sin id la funcion devuelve la coleccion completa: es ahi donde se nota si el
    // upsert inserto una fila nueva en vez de actualizar la existente.
    const all = await fetchClassSessionsFromDb();
    expect(all).toHaveLength(1);
  });

  it('elimina la sesion sin arrastrar la asignatura', async () => {
    await deleteClassSessionFromDb('cs-1');

    expect(await fetchClassSessionsFromDb('cs-1')).toBeNull();
    const subjects = await harness.pool.query('SELECT id FROM subjects WHERE id = $1', ['sub-1']);
    expect(subjects.rows).toHaveLength(1);
  });
});
