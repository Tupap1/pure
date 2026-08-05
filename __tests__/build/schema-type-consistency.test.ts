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
});
