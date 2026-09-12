import { describe, it, expect } from 'vitest';
import { localParts, localDateTimeToInstant, addDays, mondayOf } from '@/lib/execution/time';

// FR-006: cada tanda pertenece al día local en que empezó (zona horaria configurable, por
// defecto America/Bogota), aunque termine después de medianoche UTC. Toda la aritmética de
// zona horaria vive aquí en TypeScript (Constitución, Principio III), nunca en SQL.

describe('[001] US1 — Tanda de 10 minutos en un toque', () => {
  describe('lib/execution/time.ts — zona horaria (FR-006)', () => {
    it('localParts descompone un instante UTC en fecha, día de la semana y minutos locales de Bogotá', () => {
      const parts = localParts('2026-09-15T01:30:00Z');
      expect(parts).toEqual({ dateKey: '2026-09-14', dayOfWeek: 1, minutes: 1230 });
    });

    it('localDateTimeToInstant convierte una fecha y hora local de Bogotá a su instante UTC', () => {
      const instant = localDateTimeToInstant('2026-09-15', '03:00');
      expect(instant.toISOString()).toBe('2026-09-15T08:00:00.000Z');
    });

    it('addDays suma días de calendario sin depender de la zona horaria del host', () => {
      expect(addDays('2026-09-14', 1)).toBe('2026-09-15');
      expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
      expect(addDays('2026-09-14', -1)).toBe('2026-09-13');
    });

    it('mondayOf devuelve el lunes de la semana que contiene la fecha dada', () => {
      expect(mondayOf('2026-09-14')).toBe('2026-09-14'); // ya es lunes
      expect(mondayOf('2026-09-20')).toBe('2026-09-14'); // domingo de esa semana
      expect(mondayOf('2026-09-16')).toBe('2026-09-14'); // miércoles de esa semana
    });

    it('US1-AS7 · un instante de las 04:55 UTC cae en el día anterior de Bogotá', () => {
      const parts = localParts('2026-09-15T04:55:00Z');
      expect(parts.dateKey).toBe('2026-09-14');
      expect(parts.dayOfWeek).toBe(1);
    });
  });
});
