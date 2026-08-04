import { describe, it, expect } from 'vitest';
import {
  filterSchedulesByDay,
  sortSchedulesByTime,
  getScheduleConflictCountForDay
} from '@/lib/algorithms/schedule-mobile-transformer';

describe('Schedule Mobile Transformer (TDD)', () => {
  const mockSchedules = [
    { id: '1', subject_id: 's1', day_of_week: 1, start_time: '10:00', end_time: '12:00', classroom: 'A1' },
    { id: '2', subject_id: 's2', day_of_week: 1, start_time: '08:00', end_time: '10:00', classroom: 'B2' },
    { id: '3', subject_id: 's3', day_of_week: 1, start_time: '09:00', end_time: '11:00', classroom: 'C3' }, // Conflict with #1 and #2
    { id: '4', subject_id: 's4', day_of_week: 2, start_time: '14:00', end_time: '16:00', classroom: 'D4' },
  ];

  it('should filter schedules by selected day of week', () => {
    const mondaySchedules = filterSchedulesByDay(mockSchedules, 1);
    expect(mondaySchedules.length).toBe(3);
    expect(mondaySchedules.every(s => s.day_of_week === 1)).toBe(true);

    const tuesdaySchedules = filterSchedulesByDay(mockSchedules, 2);
    expect(tuesdaySchedules.length).toBe(1);
  });

  it('should sort schedules chronologically by start_time', () => {
    const mondaySchedules = filterSchedulesByDay(mockSchedules, 1);
    const sorted = sortSchedulesByTime(mondaySchedules);
    expect(sorted[0].start_time).toBe('08:00');
    expect(sorted[1].start_time).toBe('09:00');
    expect(sorted[2].start_time).toBe('10:00');
  });

  it('should correctly count conflicts in a given day', () => {
    const mondayConflicts = getScheduleConflictCountForDay(mockSchedules, 1);
    expect(mondayConflicts).toBe(1); // #3 overlaps with #2 (09:00-10:00) and #1 (10:00-11:00)

    const tuesdayConflicts = getScheduleConflictCountForDay(mockSchedules, 2);
    expect(tuesdayConflicts).toBe(0);
  });
});
