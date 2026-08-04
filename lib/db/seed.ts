import { pureDB, UniversityEntity, SubjectEntity, ScheduleEntity } from './dexie-schema';
import { handleIngestAcademicEnrollment } from '../../mcp-server/tools-handler';

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

/**
 * Ingesta de datos de la aplicación a través del Servidor MCP.
 * Procesa la matrícula Multi-Universidad (UdeA + UdeC) usando handleIngestAcademicEnrollment.
 */
export async function seedRealSemesterData() {
  await clearAllData();

  // Ingesta via MCP Tool Pipeline
  const mcpResponse = handleIngestAcademicEnrollment();
  const { universities, professors, subjects, schedules } = mcpResponse.data;

  // 1. Universidades
  const uniEntities = universities.map((u) => ({
    id: u.id,
    name: u.name,
    modality: u.modality,
    scale_min: u.scale_min,
    scale_max: u.scale_max,
    passing_grade: u.passing_grade,
    color: u.color,
    created_at: new Date().toISOString(),
  })) as UniversityEntity[];

  await pureDB.universities.bulkAdd(uniEntities);

  // 2. Profesores
  const profEntities = professors.map((p) => ({
    id: p.id,
    university_id: p.university_id,
    name: p.name,
    email: p.email,
    created_at: new Date().toISOString(),
  }));

  await pureDB.professors.bulkAdd(profEntities);

  // 3. Materias
  const subEntities = subjects.map((s) => ({
    id: s.id,
    university_id: s.university_id,
    professor_id: s.professor_id,
    name: s.name,
    code: s.code,
    credits: s.credits,
    difficulty: s.difficulty,
    modality: s.modality,
    target_grade: s.target_grade,
    current_grade: 0,
    created_at: new Date().toISOString(),
  })) as SubjectEntity[];

  await pureDB.subjects.bulkAdd(subEntities);

  // 4. Horarios
  const schedEntities = schedules.map((sch, idx) => ({
    id: `sch-mcp-${idx}`,
    subject_id: sch.subject_id,
    day_of_week: sch.day_of_week,
    start_time: sch.start_time,
    end_time: sch.end_time,
    classroom: sch.classroom,
    created_at: new Date().toISOString(),
  })) as ScheduleEntity[];

  await pureDB.schedules.bulkAdd(schedEntities);

  // Sync all seeded data to PostgreSQL in background
  try {
    for (const u of uniEntities) await syncRecordToPostgres('universities', 'upsert', u);
    for (const p of profEntities) await syncRecordToPostgres('professors', 'upsert', p);
    for (const s of subEntities) await syncRecordToPostgres('subjects', 'upsert', s);
    for (const sc of schedEntities) await syncRecordToPostgres('schedules', 'upsert', sc);
  } catch (err) {
    console.warn('Postgres background sync error:', err);
  }
}

export async function seedDemoData() {
  await seedRealSemesterData();
}
