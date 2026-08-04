export interface ScheduleItem {
  id?: string;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  classroom?: string;
}

/**
 * Filters schedules for a specific day of week (1 = Monday, 7 = Sunday)
 */
export function filterSchedulesByDay<T extends ScheduleItem>(schedules: T[], dayOfWeek: number): T[] {
  return schedules.filter(s => s.day_of_week === dayOfWeek);
}

/**
 * Sorts schedules chronologically by start_time
 */
export function sortSchedulesByTime<T extends ScheduleItem>(schedules: T[]): T[] {
  return [...schedules].sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/**
 * Helper to convert "HH:mm" to minutes from midnight
 */
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Helper to check if two schedules overlap
 */
export function isOverlapping<T extends ScheduleItem>(s1: T, s2: T): boolean {
  if (s1.id && s2.id && s1.id === s2.id) return false;
  const start1 = timeToMinutes(s1.start_time);
  const end1 = timeToMinutes(s1.end_time);
  const start2 = timeToMinutes(s2.start_time);
  const end2 = timeToMinutes(s2.end_time);

  return Math.max(start1, start2) < Math.min(end1, end2);
}

/**
 * Calculates conflict count for a given day of week
 */
export function getScheduleConflictCountForDay<T extends ScheduleItem>(schedules: T[], dayOfWeek: number): number {
  const daySchedules = filterSchedulesByDay(schedules, dayOfWeek);

  let conflictPairs = 0;
  for (let i = 0; i < daySchedules.length; i++) {
    for (let j = i + 1; j < daySchedules.length; j++) {
      if (isOverlapping(daySchedules[i], daySchedules[j])) {
        conflictPairs++;
      }
    }
  }
  return conflictPairs > 0 ? 1 : 0;
}
