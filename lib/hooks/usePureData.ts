import { useLiveQuery } from 'dexie-react-hooks';
import { pureDB } from '../db/dexie-schema';
import { seedRealSemesterData, clearAllData } from '../db/seed';
import { useEffect } from 'react';

export function usePureData() {
  useEffect(() => {
    pureDB.universities.get('uni-aeroespacial').then((legacyUni) => {
      if (legacyUni) {
        clearAllData().then(() => seedRealSemesterData());
      } else {
        pureDB.universities.count().then((count) => {
          if (count === 0) {
            seedRealSemesterData();
          }
        });
      }
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
