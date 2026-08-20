import { NextResponse } from 'next/server';
import {
  fetchAllDataFromDb,
  saveUniversityToDb,
  deleteUniversityFromDb,
  saveProfessorToDb,
  deleteProfessorFromDb,
  saveSubjectToDb,
  deleteSubjectFromDb,
  saveScheduleToDb,
  deleteScheduleFromDb,
  saveDeliverableToDb,
  deleteDeliverableFromDb,
  saveSyllabusTopicToDb,
  deleteSyllabusTopicFromDb,
  saveClassSessionToDb,
  deleteClassSessionFromDb,
  saveAttendanceRecordToDb,
  deleteAttendanceRecordFromDb,
} from '@/lib/db/repository-pg';

const ALLOWED_TABLES = new Set([
  'universities',
  'professors',
  'subjects',
  'schedules',
  'deliverables',
  'syllabus_topics',
  'class_sessions',
  'attendance_records',
]);

export async function GET() {
  try {
    const data = await fetchAllDataFromDb();
    return NextResponse.json({
      status: 'success',
      data,
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
      switch (table) {
        case 'universities':
          await deleteUniversityFromDb(data.id);
          break;
        case 'professors':
          await deleteProfessorFromDb(data.id);
          break;
        case 'subjects':
          await deleteSubjectFromDb(data.id);
          break;
        case 'schedules':
          await deleteScheduleFromDb(data.id);
          break;
        case 'deliverables':
          await deleteDeliverableFromDb(data.id);
          break;
        case 'syllabus_topics':
          await deleteSyllabusTopicFromDb(data.id);
          break;
        case 'class_sessions':
          await deleteClassSessionFromDb(data.id);
          break;
        case 'attendance_records':
          await deleteAttendanceRecordFromDb(data.id);
          break;
      }
      return NextResponse.json({ status: 'success', message: 'Record deleted from PostgreSQL' });
    }

    // UPSERT Handlers using unified repository
    switch (table) {
      case 'universities':
        await saveUniversityToDb(data);
        break;
      case 'professors':
        await saveProfessorToDb(data);
        break;
      case 'subjects':
        await saveSubjectToDb(data);
        break;
      case 'schedules':
        await saveScheduleToDb(data);
        break;
      case 'deliverables':
        await saveDeliverableToDb(data);
        break;
      case 'syllabus_topics':
        await saveSyllabusTopicToDb(data);
        break;
      case 'class_sessions':
        await saveClassSessionToDb(data);
        break;
      case 'attendance_records':
        await saveAttendanceRecordToDb(data);
        break;
    }

    return NextResponse.json({ status: 'success', message: 'Record synchronized with PostgreSQL' });
  } catch (error: any) {
    console.error('Error syncing PostgreSQL mutation:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
