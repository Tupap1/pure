import { describe, it, expect } from 'vitest';
import {
  TandaCorrectSchema,
  ObjectiveCreateSchema,
  ObjectiveUpdateSchema,
  ObjectiveArchiveSchema,
  ObjectiveReadSchema,
  FocusSummarySchema,
  QuoteCreateSchema,
  QuoteCreateManySchema,
  QuoteUpdateSchema,
  QuoteDeactivateSchema,
  QuoteReadSchema,
  TandaReadSchema,
  TandaUpdateSchema,
} from '../../lib/validations/schemas';

describe('validations-schemas-foco', () => {
  describe('strict mode', () => {
    it('TandaCorrectSchema rejects unknown keys', () => {
      const result = TandaCorrectSchema.safeParse({
        id: 'tanda-1',
        ended_at: '2026-10-02T15:00:00Z',
        reason: 'Olvidé detener el cronómetro',
        unknown_key: 'should fail',
      });
      expect(result.success).toBe(false);
    });

    it('ObjectiveCreateSchema rejects unknown keys', () => {
      const result = ObjectiveCreateSchema.safeParse({
        name: 'LeetCode',
        subject_id: 'subj-1',
        unknown_key: 'should fail',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('field bounds', () => {
    it('ObjectiveCreateSchema.name rejects empty and >60 chars', () => {
      const tooLong = 'a'.repeat(61);
      expect(ObjectiveCreateSchema.safeParse({ name: '', subject_id: 'subj-1' }).success).toBe(false);
      expect(ObjectiveCreateSchema.safeParse({ name: tooLong, subject_id: 'subj-1' }).success).toBe(false);
    });

    it('ObjectiveCreateSchema.weekly_target_minutes rejects 0 and 10081', () => {
      expect(ObjectiveCreateSchema.safeParse({ name: 'Test', weekly_target_minutes: 0 }).success).toBe(false);
      expect(ObjectiveCreateSchema.safeParse({ name: 'Test', weekly_target_minutes: 10081 }).success).toBe(false);
    });

    it('TandaCorrectSchema.reason rejects empty and >140 chars', () => {
      const tooLong = 'a'.repeat(141);
      expect(
        TandaCorrectSchema.safeParse({
          id: 'tanda-1',
          ended_at: '2026-10-02T15:00:00Z',
          reason: '',
        }).success
      ).toBe(false);
      expect(
        TandaCorrectSchema.safeParse({
          id: 'tanda-1',
          ended_at: '2026-10-02T15:00:00Z',
          reason: tooLong,
        }).success
      ).toBe(false);
    });

    it('QuoteCreateSchema bounds: text 301, translation 301, source 121', () => {
      const text301 = 'a'.repeat(301);
      const translation301 = 'b'.repeat(301);
      const source121 = 'c'.repeat(121);

      expect(QuoteCreateSchema.safeParse({ text: text301 }).success).toBe(false);
      expect(QuoteCreateSchema.safeParse({ text: 'valid', translation: translation301 }).success).toBe(false);
      expect(QuoteCreateSchema.safeParse({ text: 'valid', source: source121 }).success).toBe(false);
    });

    it('QuoteCreateManySchema.frases rejects empty and >200', () => {
      expect(QuoteCreateManySchema.safeParse({ frases: [] }).success).toBe(false);
      const tooMany = Array.from({ length: 201 }, (_, i) => ({
        text: `quote${i}`,
      }));
      expect(QuoteCreateManySchema.safeParse({ frases: tooMany }).success).toBe(false);
    });

    it('FocusSummarySchema.weeks rejects 0 and 54', () => {
      expect(FocusSummarySchema.safeParse({ weeks: 0 }).success).toBe(false);
      expect(FocusSummarySchema.safeParse({ weeks: 54 }).success).toBe(false);
    });
  });

  describe('FocusSummarySchema refine: objective_id and subject_id together', () => {
    it('rejects both at once', () => {
      const result = FocusSummarySchema.safeParse({
        objective_id: 'obj-1',
        subject_id: 'subj-1',
      });
      expect(result.success).toBe(false);
    });

    it('accepts either one alone', () => {
      expect(FocusSummarySchema.safeParse({ objective_id: 'obj-1' }).success).toBe(true);
      expect(FocusSummarySchema.safeParse({ subject_id: 'subj-1' }).success).toBe(true);
    });

    it('accepts neither', () => {
      expect(FocusSummarySchema.safeParse({}).success).toBe(true);
    });
  });

  describe('TandaReadSchema and TandaUpdateSchema include objective_id', () => {
    it('TandaReadSchema accepts objective_id', () => {
      const result = TandaReadSchema.safeParse({
        objective_id: 'obj-1',
      });
      expect(result.success).toBe(true);
    });

    it('TandaUpdateSchema accepts objective_id', () => {
      const result = TandaUpdateSchema.safeParse({
        id: 'tanda-1',
        objective_id: 'obj-1',
      });
      expect(result.success).toBe(true);
    });
  });
});
