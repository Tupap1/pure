import { useLiveQuery } from 'dexie-react-hooks';
import { pureDB } from '../db/dexie-schema';
import { pullRemoteState } from '../sync/sync-engine';
import { useEffect } from 'react';

export function usePureData() {
  useEffect(() => {
    // Sync with PostgreSQL server API on mount. pullRemoteState hace el upsert y además
    // poda las filas locales ensombrecidas por el remoto (duplicados de re-ingestas).
    void pullRemoteState();
  }, []);

  const universities = useLiveQuery(() => pureDB.universities.toArray(), [], []);
  const professors = useLiveQuery(() => pureDB.professors.toArray(), [], []);
  const subjects = useLiveQuery(() => pureDB.subjects.toArray(), [], []);
  const schedules = useLiveQuery(() => pureDB.schedules.toArray(), [], []);
  const syllabusTopics = useLiveQuery(() => pureDB.syllabusTopics.toArray(), [], []);
  const deliverables = useLiveQuery(() => pureDB.deliverables.toArray(), [], []);
  const studySessions = useLiveQuery(() => pureDB.studySessions.toArray(), [], []);
  const classSessions = useLiveQuery(() => pureDB.classSessions.toArray(), [], []);

  return {
    isLoaded: universities !== undefined,
    universities: universities || [],
    professors: professors || [],
    subjects: subjects || [],
    schedules: schedules || [],
    syllabusTopics: syllabusTopics || [],
    deliverables: deliverables || [],
    studySessions: studySessions || [],
    classSessions: classSessions || [],
  };
}
