import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { pureDB } from '../../lib/db/dexie-schema';
import { saveUniversity, deleteUniversity, saveSubject } from '../../lib/db/repository';

describe('Local-First Outbox Sync Engine & Repository Suite', () => {
  beforeEach(async () => {
    await pureDB.universities.clear();
    await pureDB.subjects.clear();
    await pureDB.syncQueue.clear();
  });

  it('1. should write to IndexedDB AND enqueue mutation to syncQueue upon saveUniversity', async () => {
    const uni = {
      id: 'uni-test-1',
      name: 'Universidad Test TDD',
      modality: 'presencial' as const,
      scale_min: 0,
      scale_max: 5,
      passing_grade: 3,
      color: '#0ea5e9',
    };

    await saveUniversity(uni);

    const savedUni = await pureDB.universities.get('uni-test-1');
    expect(savedUni).toBeDefined();
    expect(savedUni?.name).toBe('Universidad Test TDD');

    const queueItems = await pureDB.syncQueue.toArray();
    expect(queueItems.length).toBe(1);
    expect(queueItems[0].action).toBe('insert');
    expect(queueItems[0].table_name).toBe('universities');
    expect(queueItems[0].data.id).toBe('uni-test-1');
  });

  it('2. should delete from IndexedDB AND enqueue delete mutation upon deleteUniversity', async () => {
    await pureDB.universities.put({
      id: 'uni-test-2',
      name: 'Universidad a eliminar',
      modality: 'virtual',
      scale_min: 0,
      scale_max: 5,
      passing_grade: 3,
      color: '#ff0000',
    });

    await deleteUniversity('uni-test-2');

    const deletedUni = await pureDB.universities.get('uni-test-2');
    expect(deletedUni).toBeUndefined();

    const queueItems = await pureDB.syncQueue.toArray();
    expect(queueItems.length).toBe(1);
    expect(queueItems[0].action).toBe('delete');
    expect(queueItems[0].table_name).toBe('universities');
    expect(queueItems[0].data.id).toBe('uni-test-2');
  });

  it('3. should support subject mutations in repository with syncQueue outbox pattern', async () => {
    const sub = {
      id: 'sub-test-1',
      university_id: 'uni-test-1',
      name: 'Materia TDD',
      credits: 3,
      difficulty: 4,
      modality: 'presencial' as const,
      target_grade: 4.5,
      current_grade: 0.0,
    };

    await saveSubject(sub);

    const savedSub = await pureDB.subjects.get('sub-test-1');
    expect(savedSub).toBeDefined();
    expect(savedSub?.name).toBe('Materia TDD');

    const queueItems = await pureDB.syncQueue.toArray();
    expect(queueItems.length).toBe(1);
    expect(queueItems[0].table_name).toBe('subjects');
  });
});
