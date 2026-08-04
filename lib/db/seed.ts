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
  await pureDB.universities.bulkAdd(
    universities.map((u) => ({
      id: u.id,
      name: u.name,
      modality: u.modality,
      scale_min: u.scale_min,
      scale_max: u.scale_max,
      passing_grade: u.passing_grade,
      color: u.color,
      created_at: new Date().toISOString(),
    })) as UniversityEntity[]
  );

  // 2. Profesores
  await pureDB.professors.bulkAdd(
    professors.map((p) => ({
      id: p.id,
      university_id: p.university_id,
      name: p.name,
      email: p.email,
      created_at: new Date().toISOString(),
    }))
  );

  // 3. Materias
  await pureDB.subjects.bulkAdd(
    subjects.map((s) => ({
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
    })) as SubjectEntity[]
  );

  // 4. Horarios
  await pureDB.schedules.bulkAdd(
    schedules.map((sch, idx) => ({
      id: `sch-mcp-${idx}`,
      subject_id: sch.subject_id,
      day_of_week: sch.day_of_week,
      start_time: sch.start_time,
      end_time: sch.end_time,
      classroom: sch.classroom,
      created_at: new Date().toISOString(),
    })) as ScheduleEntity[]
  );
}

export async function seedDemoData() {
  await seedRealSemesterData();
}
