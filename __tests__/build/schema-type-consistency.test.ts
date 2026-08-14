import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { SubjectSchema, UniversitySchema, ScheduleSchema, ClassSessionSchema } from '@/lib/validations/schemas';
import { SubjectEntity, UniversityEntity, ScheduleEntity, ClassSessionEntity } from '@/lib/db/dexie-schema';

describe('TDD / SDD: Type & Schema Consistency Validation', () => {
  it('should validate that SubjectSchema modality matches SubjectEntity modality', () => {
    const validSubject: SubjectEntity = {
      university_id: 'uni-1',
      name: 'Cálculo Vectorial',
      code: 'MAT-201',
      credits: 4,
      difficulty: 3,
      modality: 'hibrida',
      target_grade: 4.5,
      current_grade: 0,
    };

    const parseResult = SubjectSchema.safeParse(validSubject);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.modality).toBe('hibrida');
    }
  });

  it('should validate UniversitySchema and UniversityEntity consistency', () => {
    const validUni: UniversityEntity = {
      name: 'Universidad EAFIT',
      modality: 'hibrida',
      scale_min: 0,
      scale_max: 5,
      passing_grade: 3,
      color: '#0ea5e9',
    };

    const parseResult = UniversitySchema.safeParse(validUni);
    expect(parseResult.success).toBe(true);
  });

  it('should validate ScheduleSchema and ScheduleEntity round-trip consistency including periodicity', () => {
    const validSchedule: ScheduleEntity = {
      subject_id: 'sub-101',
      day_of_week: 6,
      start_time: '08:00',
      end_time: '12:00',
      classroom: 'Aula A304',
      periodicity: 'sabado_b',
    };

    const parseResult = ScheduleSchema.safeParse(validSchedule);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.periodicity).toBe('sabado_b');
    }
  });

  it('should verify that Postgres schema files contain periodicity column in schedules table', () => {
    const pgClientCode = fs.readFileSync(path.join(process.cwd(), 'lib/db/pg-client.ts'), 'utf-8');
    const migrationCode = fs.readFileSync(path.join(process.cwd(), 'db/migrations/002_add_sabado_ab_columns.sql'), 'utf-8');

    expect(pgClientCode).toContain('periodicity');
    expect(migrationCode.toLowerCase()).toContain('alter table schedules add column if not exists periodicity');
  });

  it('should validate ClassSessionSchema and ClassSessionEntity round-trip consistency', () => {
    const validSession: ClassSessionEntity = {
      subject_id: 'sub-101',
      schedule_id: 'sch-1',
      session_date: '2026-08-14T10:00:00.000Z',
      title: 'Transformada de Laplace',
      summary: 'Repaso de la tabla de transformadas.',
      notion_link: 'https://notion.so/clase-1',
      recording_url: 'https://loom.com/share/abc',
      topics_covered: ['laplace', 'inversas'],
      notes: null,
    };

    const parseResult = ClassSessionSchema.safeParse(validSession);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.topics_covered).toEqual(['laplace', 'inversas']);
    }
  });

  it('should keep class_sessions columns aligned across the migration, pg-client bootstrap and Dexie', () => {
    const pgClientCode = fs.readFileSync(path.join(process.cwd(), 'lib/db/pg-client.ts'), 'utf-8');
    const migrationCode = fs.readFileSync(
      path.join(process.cwd(), 'db/migrations/004_class_sessions.sql'),
      'utf-8'
    );

    // pg-client bootstrapea el esquema por su cuenta para el servidor MCP y los tests,
    // así que una tabla que solo exista en la migración se cae en ese camino.
    expect(pgClientCode).toContain('CREATE TABLE IF NOT EXISTS class_sessions');

    const columns: (keyof ClassSessionEntity)[] = [
      'subject_id',
      'schedule_id',
      'session_date',
      'title',
      'summary',
      'notion_link',
      'recording_url',
      'topics_covered',
      'notes',
      'updated_at',
    ];

    for (const column of columns) {
      expect(migrationCode, `la migración 004 no declara ${column}`).toContain(column);
      expect(pgClientCode, `pg-client no declara ${column} en class_sessions`).toContain(column);
    }
  });
});
