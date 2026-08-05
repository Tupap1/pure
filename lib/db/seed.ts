import { pureDB } from './dexie-schema';

export async function clearAllData() {
  await pureDB.transaction(
    'rw',
    [
      pureDB.universities,
      pureDB.professors,
      pureDB.subjects,
      pureDB.schedules,
      pureDB.syllabusTopics,
      pureDB.deliverables,
      pureDB.studySessions,
    ],
    async () => {
      await pureDB.universities.clear();
      await pureDB.professors.clear();
      await pureDB.subjects.clear();
      await pureDB.schedules.clear();
      await pureDB.syllabusTopics.clear();
      await pureDB.deliverables.clear();
      await pureDB.studySessions.clear();
    }
  );
}

export async function syncRecordToPostgres(table: string, action: 'upsert' | 'delete', data: any) {
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, table, data }),
    });
  } catch (error) {
    console.warn(`PostgreSQL sync skipped for ${table}:`, error);
  }
}
