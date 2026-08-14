import { pureDB } from '../db/dexie-schema';
import { findShadowedIds, findOrphanIds } from './reconcile';
import {
  universityIdentity,
  professorIdentity,
  subjectIdentity,
  scheduleIdentity,
  deliverableIdentity,
  syllabusTopicIdentity,
  classSessionIdentity,
} from '../domain/entity-identity';

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
 *
 * Además del upsert, poda las filas locales que quedaron ensombrecidas por el remoto
 * (misma entidad lógica bajo otro `id`, típicamente de una re-ingesta anterior) junto a
 * sus hijos huérfanos. Sin esta poda las materias se acumulan en IndexedDB y la UI las
 * muestra repetidas.
 */
export async function pullRemoteState() {
  try {
    const res = await fetch('/api/sync');
    if (!res.ok) return;

    const body = await res.json();
    if (body.status !== 'success' || !body.data) return;

    const {
      universities = [],
      professors = [],
      subjects = [],
      schedules = [],
      deliverables = [],
      syllabusTopics = [],
      classSessions = [],
    } = body.data;

    // Un payload sin universidades es un servidor vacío o a medio arrancar: no se poda
    // nada a partir de él, porque no hay con qué decidir qué está obsoleto.
    if (!Array.isArray(universities) || universities.length === 0) return;

    await pureDB.transaction(
      'rw',
      [
        pureDB.universities,
        pureDB.professors,
        pureDB.subjects,
        pureDB.schedules,
        pureDB.deliverables,
        pureDB.syllabusTopics,
        pureDB.classSessions,
      ],
      async () => {
        await pureDB.universities.bulkPut(universities);
        if (professors?.length) await pureDB.professors.bulkPut(professors);
        if (subjects?.length) await pureDB.subjects.bulkPut(subjects);
        if (schedules?.length) await pureDB.schedules.bulkPut(schedules);
        if (deliverables?.length) await pureDB.deliverables.bulkPut(deliverables);
        if (syllabusTopics?.length) await pureDB.syllabusTopics.bulkPut(syllabusTopics);
        if (classSessions?.length) await pureDB.classSessions.bulkPut(classSessions);

        const uniqueIds = (ids: (string | number)[]) =>
          Array.from(new Set(ids.map(String))) as string[];

        const localUniversities = await pureDB.universities.toArray();
        const staleUniversityIds = uniqueIds(
          findShadowedIds(localUniversities, universities, universityIdentity)
        );
        if (staleUniversityIds.length) await pureDB.universities.bulkDelete(staleUniversityIds);
        const removedUniversityIds = new Set(staleUniversityIds);

        const localProfessors = await pureDB.professors.toArray();
        const staleProfessorIds = uniqueIds([
          ...findShadowedIds(localProfessors, professors, professorIdentity),
          ...findOrphanIds(localProfessors, professors, removedUniversityIds, (p) => p.university_id),
        ]);
        if (staleProfessorIds.length) await pureDB.professors.bulkDelete(staleProfessorIds);

        const localSubjects = await pureDB.subjects.toArray();
        const staleSubjectIds = uniqueIds([
          ...findShadowedIds(localSubjects, subjects, subjectIdentity),
          ...findOrphanIds(localSubjects, subjects, removedUniversityIds, (s) => s.university_id),
        ]);
        if (staleSubjectIds.length) await pureDB.subjects.bulkDelete(staleSubjectIds);
        const removedSubjectIds = new Set(staleSubjectIds);

        const localSchedules = await pureDB.schedules.toArray();
        const staleScheduleIds = uniqueIds([
          ...findShadowedIds(localSchedules, schedules, scheduleIdentity),
          ...findOrphanIds(localSchedules, schedules, removedSubjectIds, (s) => s.subject_id),
        ]);
        if (staleScheduleIds.length) await pureDB.schedules.bulkDelete(staleScheduleIds);

        const localDeliverables = await pureDB.deliverables.toArray();
        const staleDeliverableIds = uniqueIds([
          ...findShadowedIds(localDeliverables, deliverables, deliverableIdentity),
          ...findOrphanIds(localDeliverables, deliverables, removedSubjectIds, (d) => d.subject_id),
        ]);
        if (staleDeliverableIds.length) await pureDB.deliverables.bulkDelete(staleDeliverableIds);

        const localTopics = await pureDB.syllabusTopics.toArray();
        const staleTopicIds = uniqueIds([
          ...findShadowedIds(localTopics, syllabusTopics, syllabusTopicIdentity),
          ...findOrphanIds(localTopics, syllabusTopics, removedSubjectIds, (t) => t.subject_id),
        ]);
        if (staleTopicIds.length) await pureDB.syllabusTopics.bulkDelete(staleTopicIds);

        const localSessions = await pureDB.classSessions.toArray();
        const staleSessionIds = uniqueIds([
          ...findShadowedIds(localSessions, classSessions, classSessionIdentity),
          ...findOrphanIds(localSessions, classSessions, removedSubjectIds, (cs) => cs.subject_id),
        ]);
        if (staleSessionIds.length) await pureDB.classSessions.bulkDelete(staleSessionIds);
      }
    );
  } catch (err) {
    console.warn('⚠️ Could not pull remote state from /api/sync:', err);
  }
}
