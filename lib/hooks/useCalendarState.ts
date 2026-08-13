import { useState, useCallback } from 'react';

export type CalendarViewMode = 'day' | 'week' | 'month';

export interface CalendarState {
  viewMode: CalendarViewMode;
  displayDate: Date;
  setViewMode: (mode: CalendarViewMode) => void;
  setDisplayDate: (date: Date) => void;
  goNext: () => void;
  goPrev: () => void;
  goToday: () => void;
}

const safeAddMonths = (baseDate: Date, months: number): Date => {
  const d = new Date(baseDate);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) {
    d.setDate(0);
  }
  return d;
};

export function useCalendarState(
  initialDate: Date = new Date(),
  initialViewMode: CalendarViewMode = 'week'
): CalendarState {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(initialViewMode);
  const [displayDate, setDisplayDate] = useState<Date>(initialDate);

  const goNext = useCallback(() => {
    setDisplayDate((prevDate) => {
      const next = new Date(prevDate);
      if (viewMode === 'day') {
        next.setDate(next.getDate() + 1);
        return next;
      }
      if (viewMode === 'week') {
        next.setDate(next.getDate() + 7);
        return next;
      }
      return safeAddMonths(prevDate, 1);
    });
  }, [viewMode]);

  const goPrev = useCallback(() => {
    setDisplayDate((prevDate) => {
      const prev = new Date(prevDate);
      if (viewMode === 'day') {
        prev.setDate(prev.getDate() - 1);
        return prev;
      }
      if (viewMode === 'week') {
        prev.setDate(prev.getDate() - 7);
        return prev;
      }
      return safeAddMonths(prevDate, -1);
    });
  }, [viewMode]);

  const goToday = useCallback(() => {
    setDisplayDate(new Date());
  }, []);

  return {
    viewMode,
    displayDate,
    setViewMode,
    setDisplayDate,
    goNext,
    goPrev,
    goToday,
  };
}
