import { useLiveQuery } from 'dexie-react-hooks';
import { pureDB } from '../db/dexie-schema';
import { seedRealSemesterData, clearAllData } from '../db/seed';
import { useEffect } from 'react';

export function usePureData() {
  useEffect(() => {
    // Sync with PostgreSQL server API on mount
    fetch('/api/sync')
      .then((res) => res.json())
      .then(async (res) => {
        if (res.status === 'success' && res.data) {
          const { universities, professors, subjects, schedules, deliverables, syllabusTopics } = res.data;

          if (universities && universities.length > 0) {
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
                await pureDB.universities.bulkPut(universities);
                if (professors?.length) await pureDB.professors.bulkPut(professors);
                if (subjects?.length) await pureDB.subjects.bulkPut(subjects);
                if (schedules?.length) await pureDB.schedules.bulkPut(schedules);
                if (deliverables?.length) await pureDB.deliverables.bulkPut(deliverables);
                if (syllabusTopics?.length) await pureDB.syllabusTopics.bulkPut(syllabusTopics);
              }
            );
            return;
          }
        }

        // Fallback to local Dexie seed if PostgreSQL has no records yet
        pureDB.universities.count().then((count) => {
          if (count < 2) {
            seedRealSemesterData();
          }
        });
      })
      .catch((err) => {
        console.warn('PostgreSQL sync fetch fallback to IndexedDB local:', err);
        pureDB.universities.count().then((count) => {
          if (count < 2) {
            seedRealSemesterData();
          }
        });
      });
  }, []);

  const universities = useLiveQuery(() => pureDB.universities.toArray(), [], []);
  const professors = useLiveQuery(() => pureDB.professors.toArray(), [], []);
  const subjects = useLiveQuery(() => pureDB.subjects.toArray(), [], []);
  const schedules = useLiveQuery(() => pureDB.schedules.toArray(), [], []);
  const syllabusTopics = useLiveQuery(() => pureDB.syllabusTopics.toArray(), [], []);
  const deliverables = useLiveQuery(() => pureDB.deliverables.toArray(), [], []);
  const studySessions = useLiveQuery(() => pureDB.studySessions.toArray(), [], []);

  return {
    isLoaded: universities !== undefined,
    universities: universities || [],
    professors: professors || [],
    subjects: subjects || [],
    schedules: schedules || [],
    syllabusTopics: syllabusTopics || [],
    deliverables: deliverables || [],
    studySessions: studySessions || [],
  };
}
