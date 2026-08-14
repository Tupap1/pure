import { describe, it, expect } from 'vitest';
import {
  UniversitySchema,
  ProfessorSchema,
  SubjectSchema,
  ScheduleSchema,
  DeliverableSchema,
  SyllabusTopicSchema,
  ClassSessionSchema,
  validateEntity
} from '@/lib/validations/schemas';

describe('Validation Schemas (Zod + TDD)', () => {
  describe('UniversitySchema', () => {
    it('should validate a correct university', () => {
      const validUni = {
        name: 'Universidad Nacional',
        modality: 'presencial',
        scale_min: 0,
        scale_max: 5,
        passing_grade: 3,
        color: '#38bdf8'
      };
      const result = validateEntity(UniversitySchema, validUni);
      expect(result.success).toBe(true);
    });

    it('should reject invalid university scale (min >= max)', () => {
      const invalidUni = {
        name: 'Uni Test',
        modality: 'virtual',
        scale_min: 5,
        scale_max: 5,
        passing_grade: 3,
        color: '#38bdf8'
      };
      const result = validateEntity(UniversitySchema, invalidUni);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.scale_max).toBeDefined();
      }
    });

    it('should reject passing grade outside scale min/max', () => {
      const invalidUni = {
        name: 'Uni Test 2',
        modality: 'presencial',
        scale_min: 0,
        scale_max: 5,
        passing_grade: 6, // Greater than max
        color: '#38bdf8'
      };
      const result = validateEntity(UniversitySchema, invalidUni);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.passing_grade).toBeDefined();
      }
    });
  });

  describe('ProfessorSchema', () => {
    it('should validate correct professor data', () => {
      const prof = {
        university_id: 'uni-1',
        name: 'Dr. Roberto Gómez',
        email: 'roberto@universidad.edu',
        office_hours: 'Lunes 14:00 - 16:00',
        notes: 'Exámenes conceptuales'
      };
      const result = validateEntity(ProfessorSchema, prof);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const prof = {
        university_id: 'uni-1',
        name: 'Dr. Gómez',
        email: 'not-an-email'
      };
      const result = validateEntity(ProfessorSchema, prof);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toBeDefined();
      }
    });
  });

  describe('SubjectSchema', () => {
    it('should validate correct subject data', () => {
      const subject = {
        university_id: 'uni-1',
        professor_id: 'prof-1',
        name: 'Aerodinámica I',
        code: 'AERO-301',
        credits: 4,
        difficulty: 4,
        modality: 'presencial',
        target_grade: 4.5,
        current_grade: 4.0
      };
      const result = validateEntity(SubjectSchema, subject);
      expect(result.success).toBe(true);
    });

    it('should reject subject with zero credits or invalid difficulty (>5)', () => {
      const subject = {
        university_id: 'uni-1',
        name: 'Materia Inválida',
        code: 'BAD-00',
        credits: 0,
        difficulty: 6
      };
      const result = validateEntity(SubjectSchema, subject);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.credits).toBeDefined();
        expect(result.errors.difficulty).toBeDefined();
      }
    });
  });

  describe('ScheduleSchema', () => {
    it('should validate valid class schedule', () => {
      const schedule = {
        subject_id: 'sub-1',
        day_of_week: 1, // Lunes
        start_time: '08:00',
        end_time: '10:00',
        classroom: 'Aula 204'
      };
      const result = validateEntity(ScheduleSchema, schedule);
      expect(result.success).toBe(true);
    });

    it('should reject end_time earlier than or equal to start_time', () => {
      const schedule = {
        subject_id: 'sub-1',
        day_of_week: 2,
        start_time: '10:00',
        end_time: '09:00',
        classroom: 'Lab 1'
      };
      const result = validateEntity(ScheduleSchema, schedule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.end_time).toBeDefined();
      }
    });
  });

  describe('DeliverableSchema', () => {
    it('should validate valid deliverable', () => {
      const deliv = {
        subject_id: 'sub-1',
        title: 'Proyecto Integrador Aero',
        weight_percentage: 25,
        due_date: '2026-10-15',
        type: 'Proyecto',
        is_group: true,
        complexity: 'Difícil',
        status: 'pendiente'
      };
      const result = validateEntity(DeliverableSchema, deliv);
      expect(result.success).toBe(true);
    });

    it('should reject invalid weight_percentage (> 100 or <= 0)', () => {
      const deliv = {
        subject_id: 'sub-1',
        title: 'Parcial 1',
        weight_percentage: 150,
        type: 'Parcial'
      };
      const result = validateEntity(DeliverableSchema, deliv);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.weight_percentage).toBeDefined();
      }
    });
  });

  describe('ClassSessionSchema', () => {
    it('should validate valid class session data', () => {
      const session = {
        subject_id: 'sub-1',
        session_date: '2026-08-13T10:00:00.000Z',
        title: 'Clase 01 - Introducción a la Dinámica',
        summary: 'Se presentaron las leyes de Newton aplicadas a fluidos.',
        notion_link: 'https://notion.so/clase-01',
        recording_url: 'https://youtube.com/watch?v=123456',
        topics_covered: ['Leyes de Newton', 'Fluidos'],
        notes: 'Repasar ejercicio 3.2'
      };
      const result = validateEntity(ClassSessionSchema, session);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URLs for notion or recording', () => {
      const invalidSession = {
        subject_id: 'sub-1',
        session_date: '2026-08-13T10:00:00.000Z',
        title: 'Clase 02',
        notion_link: 'invalid-url',
        recording_url: 'not-a-link'
      };
      const result = validateEntity(ClassSessionSchema, invalidSession);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.notion_link).toBeDefined();
        expect(result.errors.recording_url).toBeDefined();
      }
    });
  });
});
