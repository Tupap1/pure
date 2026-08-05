import { NextResponse } from 'next/server';
import { pgPool } from '@/lib/db/pg-client';

const ALLOWED_TABLES = new Set([
  'universities',
  'professors',
  'subjects',
  'schedules',
  'deliverables',
  'syllabus_topics',
]);

export async function GET() {
  try {
    const [unis, profs, subs, scheds, delivs, topics] = await Promise.all([
      pgPool.query('SELECT * FROM universities ORDER BY name ASC'),
      pgPool.query('SELECT * FROM professors ORDER BY name ASC'),
      pgPool.query('SELECT * FROM subjects ORDER BY name ASC'),
      pgPool.query('SELECT * FROM schedules ORDER BY day_of_week ASC, start_time ASC'),
      pgPool.query('SELECT * FROM deliverables ORDER BY due_date ASC'),
      pgPool.query('SELECT * FROM syllabus_topics ORDER BY order_index ASC'),
    ]);

    return NextResponse.json({
      status: 'success',
      data: {
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
          grade: d.grade ? Number(d.grade) : undefined,
        })),
        syllabusTopics: topics.rows,
      },
    });
  } catch (error: any) {
    console.error('Error fetching PostgreSQL sync data:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, table, data } = body;

    if (!table || !data) {
      return NextResponse.json({ status: 'error', message: 'Missing table or data' }, { status: 400 });
    }

    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ status: 'error', message: 'Invalid or unauthorized table name' }, { status: 400 });
    }

    if (action === 'delete') {
      await pgPool.query(`DELETE FROM ${table} WHERE id = $1`, [data.id]);
      return NextResponse.json({ status: 'success', message: 'Record deleted from PostgreSQL' });
    }

    // UPSERT Handlers for each table
    if (table === 'universities') {
      await pgPool.query(
        `INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           modality = EXCLUDED.modality,
           scale_min = EXCLUDED.scale_min,
           scale_max = EXCLUDED.scale_max,
           passing_grade = EXCLUDED.passing_grade,
           color = EXCLUDED.color`,
        [data.id, data.name, data.modality, data.scale_min, data.scale_max, data.passing_grade, data.color || '#0ea5e9']
      );
    } else if (table === 'professors') {
      await pgPool.query(
        `INSERT INTO professors (id, university_id, name, email, office_hours, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           university_id = EXCLUDED.university_id,
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           office_hours = EXCLUDED.office_hours,
           notes = EXCLUDED.notes`,
        [data.id, data.university_id, data.name, data.email || null, data.office_hours || null, data.notes || null]
      );
    } else if (table === 'subjects') {
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
          data.id,
          data.university_id,
          data.professor_id || null,
          data.name,
          data.code || null,
          data.credits,
          data.difficulty,
          data.modality || 'presencial',
          data.target_grade || 4.5,
          data.current_grade || 0.0,
          data.max_absences || 4,
        ]
      );
    } else if (table === 'schedules') {
      await pgPool.query(
        `INSERT INTO schedules (id, subject_id, day_of_week, start_time, end_time, classroom)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           subject_id = EXCLUDED.subject_id,
           day_of_week = EXCLUDED.day_of_week,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           classroom = EXCLUDED.classroom`,
        [data.id, data.subject_id, data.day_of_week, data.start_time, data.end_time, data.classroom || null]
      );
    } else if (table === 'deliverables') {
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
          data.id,
          data.subject_id,
          data.topic_id || null,
          data.title,
          data.description || null,
          data.due_date,
          data.weight_percentage,
          data.grade || null,
          data.type || 'Parcial',
          data.location_modality || 'presencial',
          data.is_group || false,
          data.complexity || 'medio',
          data.status || 'pendiente',
        ]
      );
    }

    return NextResponse.json({ status: 'success', message: 'Record synchronized with PostgreSQL' });
  } catch (error: any) {
    console.error('Error syncing PostgreSQL mutation:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
