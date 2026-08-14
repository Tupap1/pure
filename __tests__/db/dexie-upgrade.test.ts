import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, it, expect, beforeEach } from 'vitest';
import { PureDatabase } from '@/lib/db/dexie-schema';

/**
 * IndexedDB solo aplica un esquema cuando el número de versión declarado es nuevo, así
 * que una tabla agregada a `version(1)` cuando los navegadores ya tienen esa versión
 * instalada depende del rescate de Dexie ("SchemaDiff: Schema was extended without
 * increasing the number passed to db.version()") para llegar a existir. Ese rescate
 * funciona, pero Dexie lo desaconseja y no deja rastro de la migración.
 *
 * Estas pruebas levantan primero una base con el esquema viejo, como la que ya está en
 * el navegador del usuario, y recién después abren el esquema actual: verifican que el
 * ascenso conserve los datos y que cada tabla nueva viaje en su propia versión.
 */

const DB_NAME = 'PureDB';

/** El esquema tal como salió en la versión 1, sin classSessions. */
class LegacyPureDatabase extends Dexie {
  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      universities: '++id, name, modality',
      professors: '++id, university_id, name',
      subjects: '++id, university_id, professor_id, name, difficulty',
      schedules: '++id, subject_id, day_of_week',
      syllabusTopics: '++id, subject_id, parent_id, mastery_status',
      deliverables: '++id, subject_id, topic_id, due_date, status, is_group',
      studySessions: '++id, subject_id, topic_id, deliverable_id, is_completed',
      syncQueue: '++id, action, table_name, timestamp',
    });
  }
}

describe('Migración del esquema local de Dexie', () => {
  beforeEach(async () => {
    await Dexie.delete(DB_NAME);
  });

  it('crea classSessions en una base que ya existía con el esquema de la versión 1', async () => {
    const legacy = new LegacyPureDatabase();
    await legacy.open();
    expect(legacy.verno).toBe(1);
    await legacy.table('universities').put({ id: 'uni-legacy', name: 'UdeA', modality: 'presencial' });
    legacy.close();

    const upgraded = new PureDatabase();
    await upgraded.open();

    await upgraded.classSessions.put({
      id: 'cs-1',
      subject_id: 'sub-1',
      session_date: '2026-08-14T10:00:00.000Z',
      title: 'Clase de prueba',
    });

    expect(await upgraded.classSessions.get('cs-1')).toMatchObject({ title: 'Clase de prueba' });
    upgraded.close();
  });

  it('conserva los datos que ya estaban guardados al subir de versión', async () => {
    const legacy = new LegacyPureDatabase();
    await legacy.open();
    await legacy.table('subjects').put({ id: 'sub-legacy', name: 'Cálculo III', university_id: 'uni-legacy' });
    legacy.close();

    const upgraded = new PureDatabase();
    await upgraded.open();

    expect(await upgraded.subjects.get('sub-legacy')).toMatchObject({ name: 'Cálculo III' });
    upgraded.close();
  });

  it('declara cada tabla nueva en su propia versión en vez de reescribir una ya publicada', async () => {
    const db = new PureDatabase();
    await db.open();
    // Si alguien vuelve a meter una tabla nueva dentro de version(1), este número
    // deja de subir y las bases ya instaladas se quedan sin ella.
    expect(db.verno).toBeGreaterThanOrEqual(2);
    db.close();
  });
});
