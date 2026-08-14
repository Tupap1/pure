import { describe, it, expect } from 'vitest';
import { pureDB } from '@/lib/db/dexie-schema';

describe('REQ-08: Capa de Base de Datos Relacional Local-First (Dexie.js IndexedDB)', () => {
  it('debe tener instanciadas todas las tablas principales de Pure', () => {
    expect(pureDB.universities).toBeDefined();
    expect(pureDB.professors).toBeDefined();
    expect(pureDB.subjects).toBeDefined();
    expect(pureDB.schedules).toBeDefined();
    expect(pureDB.syllabusTopics).toBeDefined();
    expect(pureDB.deliverables).toBeDefined();
    expect(pureDB.studySessions).toBeDefined();
    expect(pureDB.classSessions).toBeDefined();
    expect(pureDB.syncQueue).toBeDefined();
  });
});
