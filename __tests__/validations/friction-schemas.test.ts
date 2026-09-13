import { describe, it, expect } from 'vitest';
import { FrictionMeasureSchema, FrictionRateSchema } from '@/lib/validations/schemas';

describe('[002] Esquemas Zod — fricción del teléfono (US-B5)', () => {
  describe('FrictionMeasureSchema', () => {
    it('acepta las cinco medidas válidas', () => {
      const validKeys = [
        'sin_biometria',
        'clave_larga',
        'escala_grises',
        'redes_fuera_home',
        'app_desinstalada',
      ];
      for (const key of validKeys) {
        const result = FrictionMeasureSchema.safeParse({ measure_key: key });
        expect(result.success).toBe(true);
      }
    });

    it('rechaza medidas inválidas como celular_afuera', () => {
      const result = FrictionMeasureSchema.safeParse({ measure_key: 'celular_afuera' });
      expect(result.success).toBe(false);
    });

    it('rechaza claves extra', () => {
      const result = FrictionMeasureSchema.safeParse({ measure_key: 'sin_biometria', extra: 'field' });
      expect(result.success).toBe(false);
    });
  });

  describe('FrictionRateSchema', () => {
    it('acepta score entero entre 0 y 10', () => {
      const validScores = [0, 1, 5, 7, 10];
      for (const score of validScores) {
        const result = FrictionRateSchema.safeParse({ score });
        expect(result.success).toBe(true);
      }
    });

    it('rechaza score 11', () => {
      const result = FrictionRateSchema.safeParse({ score: 11 });
      expect(result.success).toBe(false);
    });

    it('rechaza score negativo', () => {
      const result = FrictionRateSchema.safeParse({ score: -1 });
      expect(result.success).toBe(false);
    });

    it('rechaza score decimal', () => {
      const result = FrictionRateSchema.safeParse({ score: 7.5 });
      expect(result.success).toBe(false);
    });

    it('acepta program_week_id opcional', () => {
      const result = FrictionRateSchema.safeParse({ score: 5, program_week_id: 'pw-01' });
      expect(result.success).toBe(true);
    });

    it('rechaza claves extra', () => {
      const result = FrictionRateSchema.safeParse({ score: 5, extra: 'field' });
      expect(result.success).toBe(false);
    });
  });
});
