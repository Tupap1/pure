import { pgPool } from './pg-client';

export async function fetchAcademicOverviewFromDb() {
  const [unis, profs, subs, scheds, delivs, topics, uniRows] = await Promise.all([
    pgPool.query('SELECT COUNT(*)::int as count FROM universities'),
    pgPool.query('SELECT COUNT(*)::int as count FROM professors'),
    pgPool.query('SELECT COUNT(*)::int as count FROM subjects'),
    pgPool.query('SELECT COUNT(*)::int as count FROM schedules'),
    pgPool.query('SELECT COUNT(*)::int as count FROM deliverables'),
    pgPool.query('SELECT COUNT(*)::int as count FROM syllabus_topics'),
    pgPool.query('SELECT name, modality FROM universities ORDER BY name ASC'),
  ]);

  return {
    universitiesCount: unis.rows[0]?.count || 0,
    professorsCount: profs.rows[0]?.count || 0,
    subjectsCount: subs.rows[0]?.count || 0,
    schedulesCount: scheds.rows[0]?.count || 0,
    deliverablesCount: delivs.rows[0]?.count || 0,
    syllabusTopicsCount: topics.rows[0]?.count || 0,
    universities: uniRows.rows,
  };
}

/**
 * Trae únicamente lo necesario para calcular la carga académica: materias, horarios y la
 * política de sábados de cada universidad. Más liviano que `fetchAllDataFromDb`, que además
 * arrastra profesores, entregables y syllabus.
 */
export async function fetchAcademicLoadInputsFromDb() {
  const [unis, subs, scheds] = await Promise.all([
    pgPool.query('SELECT * FROM universities ORDER BY name ASC'),
    pgPool.query('SELECT * FROM subjects ORDER BY name ASC'),
    pgPool.query('SELECT * FROM schedules ORDER BY day_of_week ASC, start_time ASC'),
  ]);

  return {
    universities: unis.rows.map((u) => ({
      ...u,
      scale_min: Number(u.scale_min),
      scale_max: Number(u.scale_max),
      passing_grade: Number(u.passing_grade),
    })),
    subjects: subs.rows.map((s) => ({
      ...s,
      credits: Number(s.credits),
      difficulty: Number(s.difficulty),
      target_grade: Number(s.target_grade),
      current_grade: Number(s.current_grade),
    })),
    schedules: scheds.rows.map((sc) => ({
      ...sc,
      day_of_week: Number(sc.day_of_week),
    })),
  };
}

export async function fetchAllDataFromDb() {
  const [unis, profs, subs, scheds, delivs, topics, sessions] = await Promise.all([
    pgPool.query('SELECT * FROM universities ORDER BY name ASC'),
    pgPool.query('SELECT * FROM professors ORDER BY name ASC'),
    pgPool.query('SELECT * FROM subjects ORDER BY name ASC'),
    pgPool.query('SELECT * FROM schedules ORDER BY day_of_week ASC, start_time ASC'),
    pgPool.query('SELECT * FROM deliverables ORDER BY due_date ASC'),
    pgPool.query('SELECT * FROM syllabus_topics ORDER BY order_index ASC'),
    pgPool.query('SELECT * FROM class_sessions ORDER BY session_date DESC'),
  ]);

  return {
    universities: unis.rows.map((u) => ({
      ...u,
      scale_min: Number(u.scale_min),
      scale_max: Number(u.scale_max),
      passing_grade: Number(u.passing_grade),
    })),
    professors: profs.rows,
    subjects: subs.rows.map((s) => ({
      ...s,
      credits: Number(s.credits),
      difficulty: Number(s.difficulty),
      target_grade: Number(s.target_grade),
      current_grade: Number(s.current_grade),
      max_absences: s.max_absences ? Number(s.max_absences) : undefined,
    })),
    schedules: scheds.rows.map((sc) => ({
      ...sc,
      day_of_week: Number(sc.day_of_week),
    })),
    deliverables: delivs.rows.map((d) => ({
      ...d,
      weight_percentage: Number(d.weight_percentage),
      grade: d.grade !== null && d.grade !== undefined ? Number(d.grade) : undefined,
    })),
    syllabusTopics: topics.rows,
    classSessions: sessions.rows,
  };
}

// --- UNIVERSITIES ---
export async function fetchUniversitiesFromDb(id?: string) {
  if (id) {
    const res = await pgPool.query('SELECT * FROM universities WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const u = res.rows[0];
    return {
      ...u,
      scale_min: Number(u.scale_min),
      scale_max: Number(u.scale_max),
      passing_grade: Number(u.passing_grade),
    };
  }
  const res = await pgPool.query('SELECT * FROM universities ORDER BY name ASC');
  return res.rows.map((u) => ({
    ...u,
    scale_min: Number(u.scale_min),
    scale_max: Number(u.scale_max),
    passing_grade: Number(u.passing_grade),
  }));
}

export async function saveUniversityToDb(uni: any) {
  const record = {
    id: uni.id || `uni-${Date.now()}`,
    name: uni.name,
    modality: uni.modality || 'presencial',
    scale_min: uni.scale_min ?? 0.0,
    scale_max: uni.scale_max ?? 5.0,
    passing_grade: uni.passing_grade ?? 3.0,
    color: uni.color || '#0ea5e9',
    has_alternating_saturdays: uni.has_alternating_saturdays ?? true,
    first_sabado_a_date: uni.first_sabado_a_date || '2026-08-01',
  };

  await pgPool.query(
    `INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade, color, has_alternating_saturdays, first_sabado_a_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       modality = EXCLUDED.modality,
       scale_min = EXCLUDED.scale_min,
       scale_max = EXCLUDED.scale_max,
       passing_grade = EXCLUDED.passing_grade,
       color = EXCLUDED.color,
       has_alternating_saturdays = EXCLUDED.has_alternating_saturdays,
       first_sabado_a_date = EXCLUDED.first_sabado_a_date`,
    [
      record.id,
      record.name,
      record.modality,
      record.scale_min,
      record.scale_max,
      record.passing_grade,
      record.color,
      record.has_alternating_saturdays,
      record.first_sabado_a_date,
    ]
  );
  return record;
}

export async function deleteUniversityFromDb(id: string) {
  await pgPool.query('DELETE FROM universities WHERE id = $1', [id]);
}

// --- PROFESSORS ---
export async function fetchProfessorsFromDb(id?: string) {
  if (id) {
    const res = await pgPool.query('SELECT * FROM professors WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM professors ORDER BY name ASC');
  return res.rows;
}

export async function saveProfessorToDb(prof: any) {
  const record = {
    id: prof.id || `prof-${Date.now()}`,
    university_id: prof.university_id,
    name: prof.name,
    email: prof.email || null,
    office_hours: prof.office_hours || null,
    notes: prof.notes || null,
  };

  await pgPool.query(
    `INSERT INTO professors (id, university_id, name, email, office_hours, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       university_id = EXCLUDED.university_id,
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       office_hours = EXCLUDED.office_hours,
       notes = EXCLUDED.notes`,
    [record.id, record.university_id, record.name, record.email, record.office_hours, record.notes]
  );
  return record;
}

export async function deleteProfessorFromDb(id: string) {
  await pgPool.query('DELETE FROM professors WHERE id = $1', [id]);
}

// --- SUBJECTS ---
export async function fetchSubjectsFromDb(id?: string) {
  if (id) {
    const res = await pgPool.query('SELECT * FROM subjects WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const s = res.rows[0];
    return {
      ...s,
      credits: Number(s.credits),
      difficulty: Number(s.difficulty),
      target_grade: Number(s.target_grade),
      current_grade: Number(s.current_grade),
      max_absences: s.max_absences ? Number(s.max_absences) : undefined,
    };
  }
  const res = await pgPool.query('SELECT * FROM subjects ORDER BY name ASC');
  return res.rows.map((s) => ({
    ...s,
    credits: Number(s.credits),
    difficulty: Number(s.difficulty),
    target_grade: Number(s.target_grade),
    current_grade: Number(s.current_grade),
    max_absences: s.max_absences ? Number(s.max_absences) : undefined,
  }));
}

export async function saveSubjectToDb(sub: any) {
  const record = {
    id: sub.id || `sub-${Date.now()}`,
    university_id: sub.university_id,
    professor_id: sub.professor_id || null,
    name: sub.name,
    code: sub.code || null,
    credits: Number(sub.credits ?? 3),
    difficulty: Number(sub.difficulty ?? 3),
    modality: sub.modality || 'presencial',
    target_grade: Number(sub.target_grade ?? 4.5),
    current_grade: Number(sub.current_grade ?? 0.0),
    max_absences: sub.max_absences ? Number(sub.max_absences) : 4,
  };

  await pgPool.query(
    `INSERT INTO subjects (id, university_id, professor_id, name, code, credits, difficulty, modality, target_grade, current_grade, max_absences)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       university_id = EXCLUDED.university_id,
       professor_id = EXCLUDED.professor_id,
       name = EXCLUDED.name,
       code = EXCLUDED.code,
       credits = EXCLUDED.credits,
       difficulty = EXCLUDED.difficulty,
       modality = EXCLUDED.modality,
       target_grade = EXCLUDED.target_grade,
       current_grade = EXCLUDED.current_grade,
       max_absences = EXCLUDED.max_absences`,
    [
      record.id,
      record.university_id,
      record.professor_id,
      record.name,
      record.code,
      record.credits,
      record.difficulty,
      record.modality,
      record.target_grade,
      record.current_grade,
      record.max_absences,
    ]
  );
  return record;
}

export async function deleteSubjectFromDb(id: string) {
  await pgPool.query('DELETE FROM subjects WHERE id = $1', [id]);
}

// --- SCHEDULES ---
export async function fetchSchedulesFromDb(id?: string) {
  if (id) {
    const res = await pgPool.query('SELECT * FROM schedules WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const sc = res.rows[0];
    return {
      ...sc,
      day_of_week: Number(sc.day_of_week),
    };
  }
  const res = await pgPool.query('SELECT * FROM schedules ORDER BY day_of_week ASC, start_time ASC');
  return res.rows.map((sc) => ({
    ...sc,
    day_of_week: Number(sc.day_of_week),
  }));
}

export async function saveScheduleToDb(sched: any) {
  const periodicity = sched.periodicity || 'semanal';
  if (!['semanal', 'sabado_a', 'sabado_b'].includes(periodicity)) {
    throw new Error(`Valor de periodicidad inválido: '${sched.periodicity}'. Debe ser 'semanal', 'sabado_a' o 'sabado_b'.`);
  }

  const record = {
    id: sched.id || `sch-${Date.now()}`,
    subject_id: sched.subject_id,
    day_of_week: Number(sched.day_of_week),
    start_time: sched.start_time,
    end_time: sched.end_time,
    classroom: sched.classroom || null,
    periodicity,
  };

  await pgPool.query(
    `INSERT INTO schedules (id, subject_id, day_of_week, start_time, end_time, classroom, periodicity)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       subject_id = EXCLUDED.subject_id,
       day_of_week = EXCLUDED.day_of_week,
       start_time = EXCLUDED.start_time,
       end_time = EXCLUDED.end_time,
       classroom = EXCLUDED.classroom,
       periodicity = EXCLUDED.periodicity`,
    [
      record.id,
      record.subject_id,
      record.day_of_week,
      record.start_time,
      record.end_time,
      record.classroom,
      record.periodicity,
    ]
  );
  return record;
}

export async function deleteScheduleFromDb(id: string) {
  await pgPool.query('DELETE FROM schedules WHERE id = $1', [id]);
}

// --- DELIVERABLES ---
export async function fetchDeliverablesFromDb(id?: string) {
  if (id) {
    const res = await pgPool.query('SELECT * FROM deliverables WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const d = res.rows[0];
    return {
      ...d,
      weight_percentage: Number(d.weight_percentage),
      grade: d.grade !== null && d.grade !== undefined ? Number(d.grade) : undefined,
    };
  }
  const res = await pgPool.query('SELECT * FROM deliverables ORDER BY due_date ASC');
  return res.rows.map((d) => ({
    ...d,
    weight_percentage: Number(d.weight_percentage),
    grade: d.grade !== null && d.grade !== undefined ? Number(d.grade) : undefined,
  }));
}

export async function saveDeliverableToDb(deliv: any) {
  const record = {
    id: deliv.id || `deliv-${Date.now()}`,
    subject_id: deliv.subject_id,
    topic_id: deliv.topic_id || null,
    title: deliv.title,
    description: deliv.description || null,
    due_date: deliv.due_date || new Date().toISOString(),
    weight_percentage: Number(deliv.weight_percentage ?? 20),
    grade: deliv.grade !== undefined && deliv.grade !== null ? Number(deliv.grade) : null,
    type: deliv.type || 'Parcial',
    location_modality: deliv.location_modality || 'presencial',
    is_group: deliv.is_group ?? false,
    complexity: deliv.complexity || 'medio',
    status: deliv.status || 'pendiente',
  };

  await pgPool.query(
    `INSERT INTO deliverables (id, subject_id, topic_id, title, description, due_date, weight_percentage, grade, type, location_modality, is_group, complexity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (id) DO UPDATE SET
       subject_id = EXCLUDED.subject_id,
       topic_id = EXCLUDED.topic_id,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       due_date = EXCLUDED.due_date,
       weight_percentage = EXCLUDED.weight_percentage,
       grade = EXCLUDED.grade,
       type = EXCLUDED.type,
       location_modality = EXCLUDED.location_modality,
       is_group = EXCLUDED.is_group,
       complexity = EXCLUDED.complexity,
       status = EXCLUDED.status`,
    [
      record.id,
      record.subject_id,
      record.topic_id,
      record.title,
      record.description,
      record.due_date,
      record.weight_percentage,
      record.grade,
      record.type,
      record.location_modality,
      record.is_group,
      record.complexity,
      record.status,
    ]
  );
  return record;
}

export async function deleteDeliverableFromDb(id: string) {
  await pgPool.query('DELETE FROM deliverables WHERE id = $1', [id]);
}

// --- SYLLABUS TOPICS ---
export async function fetchSyllabusTopicsFromDb(id?: string) {
  if (id) {
    const res = await pgPool.query('SELECT * FROM syllabus_topics WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM syllabus_topics ORDER BY order_index ASC');
  return res.rows;
}

export async function saveSyllabusTopicToDb(topic: any) {
  const record = {
    id: topic.id || `topic-${Date.now()}`,
    subject_id: topic.subject_id,
    parent_id: topic.parent_id || null,
    title: topic.title,
    description: topic.description || null,
    mastery_status: topic.mastery_status || 'no_iniciado',
    order_index: Number(topic.order_index ?? 0),
  };

  await pgPool.query(
    `INSERT INTO syllabus_topics (id, subject_id, parent_id, title, description, mastery_status, order_index)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       subject_id = EXCLUDED.subject_id,
       parent_id = EXCLUDED.parent_id,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       mastery_status = EXCLUDED.mastery_status,
       order_index = EXCLUDED.order_index`,
    [
      record.id,
      record.subject_id,
      record.parent_id,
      record.title,
      record.description,
      record.mastery_status,
      record.order_index,
    ]
  );
  return record;
}

export async function deleteSyllabusTopicFromDb(id: string) {
  await pgPool.query('DELETE FROM syllabus_topics WHERE id = $1', [id]);
}

export async function deleteSyllabusTopicsBySubjectFromDb(subjectId: string) {
  await pgPool.query('DELETE FROM syllabus_topics WHERE subject_id = $1', [subjectId]);
}

// --- CLASS SESSIONS ---
export async function fetchClassSessionsFromDb(id?: string) {
  if (id) {
    const res = await pgPool.query('SELECT * FROM class_sessions WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const res = await pgPool.query('SELECT * FROM class_sessions ORDER BY session_date DESC');
  return res.rows;
}

export async function saveClassSessionToDb(session: any) {
  const record = {
    id: session.id || `session-${Date.now()}`,
    subject_id: session.subject_id,
    schedule_id: session.schedule_id || null,
    session_date: session.session_date || new Date().toISOString(),
    title: session.title,
    summary: session.summary || null,
    notion_link: session.notion_link || null,
    recording_url: session.recording_url || null,
    topics_covered: session.topics_covered || [],
    notes: session.notes || null,
    updated_at: new Date().toISOString(),
  };

  await pgPool.query(
    `INSERT INTO class_sessions (id, subject_id, schedule_id, session_date, title, summary, notion_link, recording_url, topics_covered, notes, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       subject_id = EXCLUDED.subject_id,
       schedule_id = EXCLUDED.schedule_id,
       session_date = EXCLUDED.session_date,
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       notion_link = EXCLUDED.notion_link,
       recording_url = EXCLUDED.recording_url,
       topics_covered = EXCLUDED.topics_covered,
       notes = EXCLUDED.notes,
       updated_at = EXCLUDED.updated_at`,
    [
      record.id,
      record.subject_id,
      record.schedule_id,
      record.session_date,
      record.title,
      record.summary,
      record.notion_link,
      record.recording_url,
      record.topics_covered,
      record.notes,
      record.updated_at,
    ]
  );
  return record;
}

export async function deleteClassSessionFromDb(id: string) {
  await pgPool.query('DELETE FROM class_sessions WHERE id = $1', [id]);
}

// --- ATTENDANCE ---
export async function fetchAttendanceRecordsFromDb(subjectId?: string) {
  if (subjectId) {
    const res = await pgPool.query('SELECT * FROM attendance_records WHERE subject_id = $1 ORDER BY date DESC', [subjectId]);
    return res.rows;
  }
  const res = await pgPool.query('SELECT * FROM attendance_records ORDER BY date DESC');
  return res.rows;
}

export async function saveAttendanceRecordToDb(rec: any) {
  const record = {
    id: rec.id || `att-${Date.now()}`,
    subject_id: rec.subject_id,
    date: rec.date,
    status: rec.status || 'presente',
    note: rec.note || null,
  };

  await pgPool.query(
    `INSERT INTO attendance_records (id, subject_id, date, status, note)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       subject_id = EXCLUDED.subject_id,
       date = EXCLUDED.date,
       status = EXCLUDED.status,
       note = EXCLUDED.note`,
    [record.id, record.subject_id, record.date, record.status, record.note]
  );
  return record;
}

export async function deleteAttendanceRecordFromDb(id: string) {
  await pgPool.query('DELETE FROM attendance_records WHERE id = $1', [id]);
}

// --- STUDY BLOCKS ---
export async function fetchStudyBlocksFromDb(subjectId?: string) {
  let query = 'SELECT * FROM study_blocks';
  const params: any[] = [];

  if (subjectId) {
    query += ' WHERE subject_id = $1';
    params.push(subjectId);
  }

  query += ' ORDER BY date ASC, start_time ASC';
  const res = await pgPool.query(query, params);
  return res.rows;
}

export async function saveStudyBlockToDb(block: any) {
  const record = {
    id: block.id,
    subject_id: block.subject_id,
    topic_id: block.topic_id || null,
    deliverable_id: block.deliverable_id || null,
    date: block.date,
    start_time: block.start_time,
    end_time: block.end_time,
    type: block.type || 'study',
    is_completed: block.is_completed ?? false,
    actual_minutes: block.actual_minutes || null,
    source: block.source || 'manual',
    plan_id: block.plan_id || null,
  };

  await pgPool.query(
    `INSERT INTO study_blocks (id, subject_id, topic_id, deliverable_id, date, start_time, end_time, type, is_completed, actual_minutes, source, plan_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       subject_id = EXCLUDED.subject_id,
       topic_id = EXCLUDED.topic_id,
       deliverable_id = EXCLUDED.deliverable_id,
       date = EXCLUDED.date,
       start_time = EXCLUDED.start_time,
       end_time = EXCLUDED.end_time,
       type = EXCLUDED.type,
       is_completed = EXCLUDED.is_completed,
       actual_minutes = EXCLUDED.actual_minutes,
       source = EXCLUDED.source,
       plan_id = EXCLUDED.plan_id`,
    [record.id, record.subject_id, record.topic_id, record.deliverable_id, record.date, record.start_time, record.end_time, record.type, record.is_completed, record.actual_minutes, record.source, record.plan_id]
  );
}

export async function deleteStudyBlockFromDb(id: string) {
  await pgPool.query('DELETE FROM study_blocks WHERE id = $1', [id]);
}

// --- FLASHCARDS ---
export async function fetchFlashcardsFromDb(subjectId?: string) {
  let query = 'SELECT * FROM flashcards';
  const params: any[] = [];

  if (subjectId) {
    query += ' WHERE subject_id = $1';
    params.push(subjectId);
  }

  query += ' ORDER BY due ASC';
  const res = await pgPool.query(query, params);
  return res.rows.map((row: any) => ({
    ...row,
    stability: Number(row.stability),
    difficulty: Number(row.difficulty),
  }));
}

export async function saveFlashcardToDb(card: any) {
  const record = {
    id: card.id,
    subject_id: card.subject_id,
    topic_id: card.topic_id,
    question: card.question,
    answer: card.answer,
    question_type: card.question_type || 'open',
    options: card.options || null,
    due: card.due,
    stability: card.stability || 0,
    difficulty: card.difficulty || 0,
    elapsed_days: card.elapsed_days || 0,
    scheduled_days: card.scheduled_days || 0,
    reps: card.reps || 0,
    lapses: card.lapses || 0,
    state: card.state || 0,
    last_review: card.last_review || null,
    source: card.source || 'manual',
  };

  await pgPool.query(
    `INSERT INTO flashcards (id, subject_id, topic_id, question, answer, question_type, options, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (id) DO UPDATE SET
       question = EXCLUDED.question,
       answer = EXCLUDED.answer,
       question_type = EXCLUDED.question_type,
       options = EXCLUDED.options,
       due = EXCLUDED.due,
       stability = EXCLUDED.stability,
       difficulty = EXCLUDED.difficulty,
       elapsed_days = EXCLUDED.elapsed_days,
       scheduled_days = EXCLUDED.scheduled_days,
       reps = EXCLUDED.reps,
       lapses = EXCLUDED.lapses,
       state = EXCLUDED.state,
       last_review = EXCLUDED.last_review,
       source = EXCLUDED.source`,
    [record.id, record.subject_id, record.topic_id, record.question, record.answer, record.question_type, record.options, record.due, record.stability, record.difficulty, record.elapsed_days, record.scheduled_days, record.reps, record.lapses, record.state, record.last_review, record.source]
  );
}

export async function deleteFlashcardFromDb(id: string) {
  await pgPool.query('DELETE FROM flashcards WHERE id = $1', [id]);
}

export async function fetchDueFlashcardsFromDb(dateStr: string) {
  const res = await pgPool.query(
    'SELECT * FROM flashcards WHERE due <= $1 ORDER BY due ASC',
    [dateStr]
  );
  return res.rows.map((row: any) => ({
    ...row,
    stability: Number(row.stability),
    difficulty: Number(row.difficulty),
  }));
}

// --- CLASS SESSIONS HELPER ---
export async function fetchClassSessionByFirefliesIdFromDb(firefliesId: string) {
  const res = await pgPool.query(
    'SELECT * FROM class_sessions WHERE fireflies_transcript_id = $1',
    [firefliesId]
  );
  return res.rows[0] || null;
}
