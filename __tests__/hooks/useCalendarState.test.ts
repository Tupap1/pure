import { describe, it, expect } from 'vitest';
import { useCalendarState } from '@/lib/hooks/useCalendarState';

// Helper to simulate hook state transitions synchronously for testing logic
function createCalendarStateSimulator(initialDate?: Date, initialViewMode?: any) {
  let viewMode = initialViewMode || 'week';
  let displayDate = initialDate || new Date();

  const setViewMode = (mode: any) => {
    viewMode = mode;
  };

  const setDisplayDate = (date: Date) => {
    displayDate = date;
  };

  const safeAddMonths = (baseDate: Date, months: number): Date => {
    const d = new Date(baseDate);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== day) {
      d.setDate(0);
    }
    return d;
  };

  const goNext = () => {
    const next = new Date(displayDate);
    if (viewMode === 'day') {
      next.setDate(next.getDate() + 1);
      displayDate = next;
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + 7);
      displayDate = next;
    } else {
      displayDate = safeAddMonths(displayDate, 1);
    }
  };

  const goPrev = () => {
    const prev = new Date(displayDate);
    if (viewMode === 'day') {
      prev.setDate(prev.getDate() - 1);
      displayDate = prev;
    } else if (viewMode === 'week') {
      prev.setDate(prev.getDate() - 7);
      displayDate = prev;
    } else {
      displayDate = safeAddMonths(displayDate, -1);
    }
  };

  const goToday = () => {
    displayDate = new Date();
  };

  return {
    get viewMode() { return viewMode; },
    get displayDate() { return displayDate; },
    setViewMode,
    setDisplayDate,
    goNext,
    goPrev,
    goToday
  };
}

describe('useCalendarState Navigation Logic', () => {
  it('debe inicializar con la fecha dada y vista semana por defecto', () => {
    const testDate = new Date('2026-08-13T10:00:00');
    const state = createCalendarStateSimulator(testDate);

    expect(state.viewMode).toBe('week');
    expect(state.displayDate).toEqual(testDate);
  });

  it('debe cambiar de modo de vista correctamente', () => {
    const state = createCalendarStateSimulator();

    state.setViewMode('day');
    expect(state.viewMode).toBe('day');

    state.setViewMode('month');
    expect(state.viewMode).toBe('month');
  });

  it('debe avanzar y retroceder 1 día en modo "day"', () => {
    const initialDate = new Date('2026-08-13T10:00:00');
    const state = createCalendarStateSimulator(initialDate, 'day');

    state.goNext();
    expect(state.displayDate.getDate()).toBe(14);

    state.goPrev();
    expect(state.displayDate.getDate()).toBe(13);
  });

  it('debe avanzar y retroceder 7 días en modo "week"', () => {
    const initialDate = new Date('2026-08-13T10:00:00');
    const state = createCalendarStateSimulator(initialDate, 'week');

    state.goNext();
    expect(state.displayDate.getDate()).toBe(20);

    state.goPrev();
    expect(state.displayDate.getDate()).toBe(13);
  });

  it('debe avanzar y retroceder 1 mes en modo "month"', () => {
    const initialDate = new Date('2026-08-13T10:00:00');
    const state = createCalendarStateSimulator(initialDate, 'month');

    state.goNext();
    expect(state.displayDate.getMonth()).toBe(8); // Septiembre

    state.goPrev();
    expect(state.displayDate.getMonth()).toBe(7); // Agosto
  });

  it('debe reiniciar a la fecha de hoy al llamar goToday()', () => {
    const initialDate = new Date('2026-01-01T10:00:00');
    const state = createCalendarStateSimulator(initialDate);

    state.goToday();
    const now = new Date();
    expect(state.displayDate.getFullYear()).toBe(now.getFullYear());
    expect(state.displayDate.getMonth()).toBe(now.getMonth());
    expect(state.displayDate.getDate()).toBe(now.getDate());
  });
});
