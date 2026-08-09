import { pgPool } from '../lib/db/pg-client';

export async function fetchAcademicOverviewFromDb() {
  try {
    const [unis, profs, subs, scheds, delivs, topics] = await Promise.all([
      pgPool.query('SELECT COUNT(*)::int as count FROM universities'),
      pgPool.query('SELECT COUNT(*)::int as count FROM professors'),
      pgPool.query('SELECT COUNT(*)::int as count FROM subjects'),
      pgPool.query('SELECT COUNT(*)::int as count FROM schedules'),
      pgPool.query('SELECT COUNT(*)::int as count FROM deliverables'),
      pgPool.query('SELECT COUNT(*)::int as count FROM syllabus_topics'),
    ]);

    const uniRows = await pgPool.query('SELECT name, modality FROM universities ORDER BY name ASC');

    return {
      universitiesCount: unis.rows[0]?.count || 0,
      professorsCount: profs.rows[0]?.count || 0,
      subjectsCount: subs.rows[0]?.count || 0,
      schedulesCount: scheds.rows[0]?.count || 0,
      deliverablesCount: delivs.rows[0]?.count || 0,
      syllabusTopicsCount: topics.rows[0]?.count || 0,
      universities: uniRows.rows,
    };
  } catch (error) {
    console.warn('⚠️ Could not fetch overview from Postgres, using memory fallback:', error);
    return null;
  }
}

export async function saveUniversityToDb(uni: any) {
  try {
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
        uni.id,
        uni.name,
        uni.modality || 'presencial',
        uni.scale_min ?? 0.0,
        uni.scale_max ?? 5.0,
        uni.passing_grade ?? 3.0,
        uni.color || '#0ea5e9',
        uni.has_alternating_saturdays ?? true,
        uni.first_sabado_a_date || '2026-08-01',
      ]
    );
  } catch (error) {
    console.warn('⚠️ Could not persist university to Postgres:', error);
  }
}

export async function saveSubjectToDb(sub: any) {
  try {
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
        sub.id,
        sub.university_id,
        sub.professor_id || null,
        sub.name,
        sub.code || null,
        sub.credits ?? 3,
        sub.difficulty ?? 3,
        sub.modality || 'presencial',
        sub.target_grade ?? 4.5,
        sub.current_grade ?? 0.0,
        sub.max_absences ?? 4,
      ]
    );
  } catch (error) {
    console.warn('⚠️ Could not persist subject to Postgres:', error);
  }
}

export async function saveScheduleToDb(sched: any) {
  try {
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
        sched.id,
        sched.subject_id,
        sched.day_of_week,
        sched.start_time,
        sched.end_time,
        sched.classroom || null,
        sched.periodicity || 'semanal',
      ]
    );
  } catch (error) {
    console.warn('⚠️ Could not persist schedule to Postgres:', error);
  }
}

export async function saveDeliverableToDb(deliv: any) {
  try {
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
        deliv.id,
        deliv.subject_id,
        deliv.topic_id || null,
        deliv.title,
        deliv.description || null,
        deliv.due_date,
        deliv.weight_percentage ?? 20,
        deliv.grade ?? null,
        deliv.type || 'Parcial',
        deliv.location_modality || 'presencial',
        deliv.is_group ?? false,
        deliv.complexity || 'medio',
        deliv.status || 'pendiente',
      ]
    );
  } catch (error) {
    console.warn('⚠️ Could not persist deliverable to Postgres:', error);
  }
}
