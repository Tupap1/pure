import { describe, it, expect } from 'vitest';
import {
  toDateKey,
  mondayFirstIndex,
  getWeekDates,
  getDaysInMonth,
  getMonthDateKeys,
  getMonthStartOffset,
  getMonthLabel,
} from '@/lib/domain/calendar';

describe('calendar', () => {
  describe('toDateKey', () => {
    it('formatea con ceros a la izquierda', () => {
      expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('usa componentes locales y no desplaza el día como toISOString', () => {
      // Medianoche local: toISOString() devolvería el día anterior en zonas al oeste de UTC.
      expect(toDateKey(new Date(2026, 7, 27, 0, 0, 0))).toBe('2026-08-27');
    });
  });

  describe('mondayFirstIndex', () => {
    it('coloca el lunes en 0 y el domingo en 6', () => {
      // 2026-08-10 es lunes.
      expect(mondayFirstIndex(new Date(2026, 7, 10))).toBe(0);
      expect(mondayFirstIndex(new Date(2026, 7, 16))).toBe(6);
    });
  });

  describe('getWeekDates', () => {
    it('devuelve siete fechas de lunes a domingo', () => {
      // 2026-08-12 es miércoles.
      const week = getWeekDates(new Date(2026, 7, 12));
      expect(week).toHaveLength(7);
      expect(toDateKey(week[0])).toBe('2026-08-10');
      expect(toDateKey(week[6])).toBe('2026-08-16');
    });

    it('cruza el cambio de mes sin romperse', () => {
      // 2026-09-01 es martes: la semana arranca el 31 de agosto.
      const week = getWeekDates(new Date(2026, 8, 1));
      expect(toDateKey(week[0])).toBe('2026-08-31');
      expect(toDateKey(week[6])).toBe('2026-09-06');
    });
  });

  describe('getDaysInMonth', () => {
    it('reconoce meses de 30 y 31 días', () => {
      expect(getDaysInMonth(new Date(2026, 7, 1))).toBe(31);
      expect(getDaysInMonth(new Date(2026, 8, 1))).toBe(30);
    });

    it('maneja febrero en año bisiesto y no bisiesto', () => {
      expect(getDaysInMonth(new Date(2026, 1, 1))).toBe(28);
      expect(getDaysInMonth(new Date(2028, 1, 1))).toBe(29);
    });
  });

  describe('getMonthDateKeys', () => {
    it('genera exactamente los días reales del mes', () => {
      const keys = getMonthDateKeys(new Date(2026, 8, 15));
      expect(keys).toHaveLength(30);
      expect(keys[0]).toBe('2026-09-01');
      expect(keys[29]).toBe('2026-09-30');
    });

    it('no inventa un día 31 en meses de 30', () => {
      expect(getMonthDateKeys(new Date(2026, 8, 1))).not.toContain('2026-09-31');
    });
  });

  describe('getMonthStartOffset', () => {
    it('alinea el día 1 bajo su día de la semana', () => {
      // 2026-08-01 es sábado -> 5 celdas vacías antes en una rejilla que empieza en lunes.
      expect(getMonthStartOffset(new Date(2026, 7, 20))).toBe(5);
      // 2026-06-01 es lunes -> sin desfase.
      expect(getMonthStartOffset(new Date(2026, 5, 10))).toBe(0);
    });
  });

  describe('getMonthLabel', () => {
    it('devuelve mes y año en español', () => {
      const label = getMonthLabel(new Date(2026, 7, 12));
      expect(label).toContain('agosto');
      expect(label).toContain('2026');
    });
  });
});
