import { pureDB } from '../db/dexie-schema';

let isProcessing = false;

/**
 * Processes pending outbox items from pureDB.syncQueue by sending POST requests to /api/sync.
 * Removes item from queue upon HTTP 200 OK.
 */
export async function processSyncQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const queueItems = await pureDB.syncQueue.orderBy('id').toArray();
    for (const item of queueItems) {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: item.action,
            table: item.table_name,
            data: item.data,
          }),
        });

        if (response.ok) {
          if (item.id !== undefined) {
            await pureDB.syncQueue.delete(item.id);
          }
        } else {
          console.warn(`⚠️ Sync engine POST /api/sync failed with status ${response.status}`);
          break; // Stop processing further items until network/server recovers
        }
      } catch (err) {
        console.warn('⚠️ Sync engine fetch error (offline or server down):', err);
        break;
      }
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Pulls remote PostgreSQL state from GET /api/sync and merges with local Dexie tables.
 */
export async function pullRemoteState() {
  try {
    const res = await fetch('/api/sync');
    if (!res.ok) return;

    const body = await res.json();
    if (body.status === 'success' && body.data) {
      const { universities, professors, subjects, schedules, deliverables, syllabusTopics } = body.data;

      await pureDB.transaction(
        'rw',
        [
          pureDB.universities,
          pureDB.professors,
          pureDB.subjects,
          pureDB.schedules,
          pureDB.deliverables,
          pureDB.syllabusTopics,
        ],
        async () => {
          if (universities?.length) await pureDB.universities.bulkPut(universities);
          if (professors?.length) await pureDB.professors.bulkPut(professors);
          if (subjects?.length) await pureDB.subjects.bulkPut(subjects);
          if (schedules?.length) await pureDB.schedules.bulkPut(schedules);
          if (deliverables?.length) await pureDB.deliverables.bulkPut(deliverables);
          if (syllabusTopics?.length) await pureDB.syllabusTopics.bulkPut(syllabusTopics);
        }
      );
    }
  } catch (err) {
    console.warn('⚠️ Could not pull remote state from /api/sync:', err);
  }
}
