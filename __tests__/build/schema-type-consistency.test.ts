import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { SubjectSchema, UniversitySchema, ScheduleSchema } from '@/lib/validations/schemas';
import { SubjectEntity, UniversityEntity, ScheduleEntity } from '@/lib/db/dexie-schema';

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
});
