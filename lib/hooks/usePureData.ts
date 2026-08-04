import { useLiveQuery } from 'dexie-react-hooks';
import { pureDB } from '../db/dexie-schema';
import { clearAllData } from '../db/seed';
import { useEffect } from 'react';

export function usePureData() {
  useEffect(() => {
    // Purge legacy mock data if user previously ran mock seed
    pureDB.universities.get('uni-aeroespacial').then((legacyUni) => {
      if (legacyUni) {
        clearAllData();
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
