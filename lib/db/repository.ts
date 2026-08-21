import { pureDB, UniversityEntity, ProfessorEntity, SubjectEntity, ScheduleEntity, DeliverableEntity, SyllabusTopicEntity, ClassSessionEntity, AttendanceRecordEntity } from './dexie-schema';
import { calculateWeightedGrade } from '../domain/subject';

const nowIso = () => new Date().toISOString();

/**
 * Fuente única de `subject.current_grade` (arregla B3).
 *
 * Recalcula la nota actual de una materia a partir de SUS entregas calificadas usando el
 * mismo ponderado que el resto de la app (`calculateWeightedGrade`) y la persiste en el
 * registro de la materia. Antes `current_grade` se escribía a mano (0 o heredado) y nunca
 * se refrescaba, así que telemetría, DME y GPA leían un valor stale.
 *
 * Se invoca tras cada alta/baja de entrega para mantener el valor derivado al día. Si la
 * materia no existe localmente no hace nada (evita crear un registro incompleto).
 */
export async function recomputeSubjectCurrentGrade(subjectId: string): Promise<number | null> {
  if (!subjectId) return null;
  const subject = await pureDB.subjects.get(subjectId);
  if (!subject) return null;

  const subjectDeliverables = await pureDB.deliverables
    .where('subject_id')
    .equals(subjectId)
    .toArray();

  const { currentGrade } = calculateWeightedGrade(subjectDeliverables);

  // Evita una escritura (y un item en la cola de sync) si el valor no cambió.
  if (subject.current_grade === currentGrade) return currentGrade;

  await saveSubject({ ...subject, current_grade: currentGrade });
  return currentGrade;
}

// --- UNIVERSITIES ---
export async function saveUniversity(uni: UniversityEntity) {
  const record = {
    ...uni,
    id: uni.id || `uni-${Date.now()}`,
    created_at: uni.created_at || nowIso(),
  };

  await pureDB.universities.put(record);
  await pureDB.syncQueue.add({
    action: 'insert',
    table_name: 'universities',
    data: record,
    timestamp: nowIso(),
  });
  return record;
}

export async function deleteUniversity(id: string) {
  await pureDB.universities.delete(id);
  await pureDB.syncQueue.add({
    action: 'delete',
    table_name: 'universities',
    data: { id },
    timestamp: nowIso(),
  });
}

// --- PROFESSORS ---
export async function saveProfessor(prof: ProfessorEntity) {
  const record = {
    ...prof,
    id: prof.id || `prof-${Date.now()}`,
    created_at: prof.created_at || nowIso(),
  };

  await pureDB.professors.put(record);
  await pureDB.syncQueue.add({
    action: 'insert',
    table_name: 'professors',
    data: record,
    timestamp: nowIso(),
  });
  return record;
}

export async function deleteProfessor(id: string) {
  await pureDB.professors.delete(id);
  await pureDB.syncQueue.add({
    action: 'delete',
    table_name: 'professors',
    data: { id },
    timestamp: nowIso(),
  });
}

// --- SUBJECTS ---
export async function saveSubject(sub: SubjectEntity) {
  const record = {
    ...sub,
    id: sub.id || `sub-${Date.now()}`,
    created_at: sub.created_at || nowIso(),
  };

  await pureDB.subjects.put(record);
  await pureDB.syncQueue.add({
    action: 'insert',
    table_name: 'subjects',
    data: record,
    timestamp: nowIso(),
  });
  return record;
}

export async function deleteSubject(id: string) {
  await pureDB.subjects.delete(id);
  await pureDB.syncQueue.add({
    action: 'delete',
    table_name: 'subjects',
    data: { id },
    timestamp: nowIso(),
  });
}

// --- SCHEDULES ---
export async function saveSchedule(sched: ScheduleEntity) {
  const record = {
    ...sched,
    id: sched.id || `sch-${Date.now()}`,
    periodicity: sched.periodicity || 'semanal',
    created_at: sched.created_at || nowIso(),
  };

  await pureDB.schedules.put(record);
  await pureDB.syncQueue.add({
    action: 'insert',
    table_name: 'schedules',
    data: record,
    timestamp: nowIso(),
  });
  return record;
}

export async function deleteSchedule(id: string) {
  await pureDB.schedules.delete(id);
  await pureDB.syncQueue.add({
    action: 'delete',
    table_name: 'schedules',
    data: { id },
    timestamp: nowIso(),
  });
}

// --- DELIVERABLES ---
export async function saveDeliverable(deliv: DeliverableEntity) {
  const record = {
    ...deliv,
    id: deliv.id || `deliv-${Date.now()}`,
    created_at: deliv.created_at || nowIso(),
  };

  await pureDB.deliverables.put(record);
  await pureDB.syncQueue.add({
    action: 'insert',
    table_name: 'deliverables',
    data: record,
    timestamp: nowIso(),
  });
  // Mantiene `subject.current_grade` como valor derivado de las entregas (B3).
  await recomputeSubjectCurrentGrade(record.subject_id);
  return record;
}

export async function deleteDeliverable(id: string) {
  // Necesitamos el subject_id ANTES de borrar para poder recalcular su nota después.
  const existing = await pureDB.deliverables.get(id);
  await pureDB.deliverables.delete(id);
  await pureDB.syncQueue.add({
    action: 'delete',
    table_name: 'deliverables',
    data: { id },
    timestamp: nowIso(),
  });
  if (existing?.subject_id) {
    await recomputeSubjectCurrentGrade(existing.subject_id);
  }
}

// --- SYLLABUS TOPICS ---
export async function saveSyllabusTopic(topic: SyllabusTopicEntity) {
  const record = {
    ...topic,
    id: topic.id || `topic-${Date.now()}`,
    created_at: topic.created_at || nowIso(),
  };

  await pureDB.syllabusTopics.put(record);
  await pureDB.syncQueue.add({
    action: 'insert',
    table_name: 'syllabus_topics',
    data: record,
    timestamp: nowIso(),
  });
  return record;
}

export async function deleteSyllabusTopic(id: string) {
  await pureDB.syllabusTopics.delete(id);
  await pureDB.syncQueue.add({
    action: 'delete',
    table_name: 'syllabus_topics',
    data: { id },
    timestamp: nowIso(),
  });
}

// --- CLASS SESSIONS ---
export async function saveClassSession(session: ClassSessionEntity) {
  const record = {
    ...session,
    id: session.id || `session-${Date.now()}`,
    topics_covered: session.topics_covered || [],
    created_at: session.created_at || nowIso(),
    updated_at: nowIso(),
  };

  await pureDB.classSessions.put(record);
  await pureDB.syncQueue.add({
    action: 'insert',
    table_name: 'class_sessions',
    data: record,
    timestamp: nowIso(),
  });
  return record;
}

export async function deleteClassSession(id: string) {
  await pureDB.classSessions.delete(id);
  await pureDB.syncQueue.add({
    action: 'delete',
    table_name: 'class_sessions',
    data: { id },
    timestamp: nowIso(),
  });
}

// --- ATTENDANCE ---
export async function saveAttendanceRecord(rec: AttendanceRecordEntity) {
  const record = {
    ...rec,
    id: rec.id || `att-${Date.now()}`,
    created_at: rec.created_at || nowIso(),
  };

  await pureDB.attendanceRecords.put(record);
  await pureDB.syncQueue.add({
    action: 'insert',
    table_name: 'attendance_records',
    data: record,
    timestamp: nowIso(),
  });
  return record;
}

export async function deleteAttendanceRecord(id: string) {
  await pureDB.attendanceRecords.delete(id);
  await pureDB.syncQueue.add({
    action: 'delete',
    table_name: 'attendance_records',
    data: { id },
    timestamp: nowIso(),
  });
}
