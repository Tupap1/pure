import { pureDB, UniversityEntity, ProfessorEntity, SubjectEntity, ScheduleEntity, DeliverableEntity, SyllabusTopicEntity } from './dexie-schema';

const nowIso = () => new Date().toISOString();

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
  return record;
}

export async function deleteDeliverable(id: string) {
  await pureDB.deliverables.delete(id);
  await pureDB.syncQueue.add({
    action: 'delete',
    table_name: 'deliverables',
    data: { id },
    timestamp: nowIso(),
  });
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
