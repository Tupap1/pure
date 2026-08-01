import { useLiveQuery } from 'dexie-react-hooks';
import { pureDB } from '../db/dexie-schema';
import { seedInitialData } from '../db/seed';
import { useEffect, useState } from 'react';

export function usePureData() {
  const [isSeeded, setIsSeeded] = useState(false);

  useEffect(() => {
    seedInitialData().then(() => setIsSeeded(true));
  }, []);

  const universities = useLiveQuery(() => pureDB.universities.toArray(), [], []);
  const professors = useLiveQuery(() => pureDB.professors.toArray(), [], []);
  const subjects = useLiveQuery(() => pureDB.subjects.toArray(), [], []);
  const schedules = useLiveQuery(() => pureDB.schedules.toArray(), [], []);
  const syllabusTopics = useLiveQuery(() => pureDB.syllabusTopics.toArray(), [], []);
  const deliverables = useLiveQuery(() => pureDB.deliverables.toArray(), [], []);
  const studySessions = useLiveQuery(() => pureDB.studySessions.toArray(), [], []);

  return {
    isLoaded: isSeeded && universities !== undefined,
    universities,
    professors,
    subjects,
    schedules,
    syllabusTopics,
    deliverables,
    studySessions,
  };
}
