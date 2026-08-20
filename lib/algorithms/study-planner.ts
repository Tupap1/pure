import { StudyBlockEntity, DeliverableEntity, ScheduleEntity } from '@/lib/db/dexie-schema';

export interface StudyPlanInput {
  dmeHoursBySubject: Map<string, number>;
  schedules: ScheduleEntity[];
  deliverables: DeliverableEntity[];
  weekStartDate: Date;
}

export interface StudyBlockOutput extends StudyBlockEntity {
  id?: string;
}

interface FreeSlot {
  date: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface SubjectCushion {
  subject_id: string;
  cushion: number;
  dmeHours: number;
  allocatedHours: number;
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + (minutes || 0);
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const total = timeToMinutes(timeStr) + minutes;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

function dateToISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateForDayOfWeek(weekStart: Date, dayOfWeek: number): Date {
  const date = new Date(weekStart);
  const offset = (dayOfWeek === 7 ? 0 : dayOfWeek) - (weekStart.getDay() === 0 ? 7 : weekStart.getDay());
  date.setDate(date.getDate() + offset);
  return date;
}

export function calculateCushion(
  subjectId: string,
  dmeHours: number,
  availableHours: number,
  deliverables: DeliverableEntity[],
  referenceDate: Date = new Date()
): number {
  const subjectDeliverables = deliverables.filter(d => d.subject_id === subjectId && d.status === 'pendiente');
  if (subjectDeliverables.length === 0) return Infinity;

  const nearest = subjectDeliverables.reduce((closest, current) => {
    const currentDays = Math.ceil((new Date(current.due_date).getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    const closestDays = Math.ceil((new Date(closest.due_date).getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    return currentDays < closestDays ? current : closest;
  });

  const daysUntilDeadline = Math.max(0, Math.ceil((new Date(nearest.due_date).getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)));
  const hoursNeeded = dmeHours - availableHours;

  return daysUntilDeadline - (hoursNeeded * 2);
}

function findFreeSlots(schedules: ScheduleEntity[], weekStart: Date): FreeSlot[] {
  const dayStart = 6; // 06:00
  const dayEnd = 22; // 22:00

  const slots: FreeSlot[] = [];
  const occupiedByDay = new Map<number, Array<{ start: number; end: number }>>();

  for (let day = 1; day <= 7; day++) {
    occupiedByDay.set(day, []);
  }

  schedules.forEach(schedule => {
    const occupied = occupiedByDay.get(schedule.day_of_week) || [];
    occupied.push({
      start: timeToMinutes(schedule.start_time),
      end: timeToMinutes(schedule.end_time)
    });
    occupiedByDay.set(schedule.day_of_week, occupied);
  });

  occupiedByDay.forEach((occupied, dayOfWeek) => {
    occupied.sort((a, b) => a.start - b.start);

    let currentStart = dayStart * 60;
    const dayEndMins = dayEnd * 60;

    for (const block of occupied) {
      if (currentStart < block.start) {
        slots.push({
          date: dateToISO(getDateForDayOfWeek(weekStart, dayOfWeek)),
          day_of_week: dayOfWeek,
          start_time: formatMinutesToTime(currentStart),
          end_time: formatMinutesToTime(block.start)
        });
      }
      currentStart = Math.max(currentStart, block.end);
    }

    if (currentStart < dayEndMins) {
      slots.push({
        date: dateToISO(getDateForDayOfWeek(weekStart, dayOfWeek)),
        day_of_week: dayOfWeek,
        start_time: formatMinutesToTime(currentStart),
        end_time: formatMinutesToTime(dayEndMins)
      });
    }
  });

  return slots;
}

function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function determineStudyType(
  subjectId: string,
  deliverables: DeliverableEntity[],
  topicId?: string,
  currentDate: Date = new Date()
): 'exam_prep' | 'review' | 'study' | 'project' {
  const subjectDeliverables = deliverables.filter(
    d => d.subject_id === subjectId && d.status === 'pendiente'
  );

  const nearest = subjectDeliverables.length > 0
    ? subjectDeliverables.reduce((closest, current) => {
      const currentDays = Math.ceil((new Date(current.due_date).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      const closestDays = Math.ceil((new Date(closest.due_date).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      return currentDays < closestDays ? current : closest;
    })
    : null;

  if (nearest) {
    const daysUntil = Math.ceil((new Date(nearest.due_date).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 3) return 'exam_prep';
    if (nearest.type === 'examen_final' || nearest.type === 'parcial') return 'exam_prep';
    if (nearest.type === 'proyecto') return 'project';
  }

  return 'study';
}

export function generateStudyPlan(input: StudyPlanInput): StudyBlockOutput[] {
  const blocks: StudyBlockOutput[] = [];
  const freeSlots = findFreeSlots(input.schedules, input.weekStartDate);

  const subjectCushions: SubjectCushion[] = Array.from(input.dmeHoursBySubject.entries()).map(
    ([subjectId, dmeHours]) => ({
      subject_id: subjectId,
      cushion: calculateCushion(subjectId, dmeHours, 0, input.deliverables, input.weekStartDate),
      dmeHours,
      allocatedHours: 0
    })
  );

  subjectCushions.sort((a, b) => a.cushion - b.cushion);

  const slotIndex = [0];

  subjectCushions.forEach(subjectCushion => {
    let hoursToAllocate = subjectCushion.dmeHours;

    while (hoursToAllocate > 0 && slotIndex[0] < freeSlots.length) {
      const slot = freeSlots[slotIndex[0]];
      const slotDurationMins = timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time);
      const blockDurationMins = Math.min(90, slotDurationMins);
      const blockDurationHours = minutesToHours(blockDurationMins);

      if (blockDurationMins >= 30) {
        const type = determineStudyType(
          subjectCushion.subject_id,
          input.deliverables,
          undefined,
          new Date(slot.date)
        );

        blocks.push({
          subject_id: subjectCushion.subject_id,
          date: slot.date,
          start_time: slot.start_time,
          end_time: addMinutesToTime(slot.start_time, blockDurationMins),
          type,
          is_completed: false,
          source: 'algorithm'
        });

        hoursToAllocate = Math.max(0, hoursToAllocate - blockDurationHours);
        subjectCushion.allocatedHours += blockDurationHours;

        const remainingSlotMins = slotDurationMins - blockDurationMins;
        if (remainingSlotMins >= 15 + 30) {
          slot.start_time = addMinutesToTime(slot.start_time, blockDurationMins + 15);
        } else {
          slotIndex[0]++;
        }
      } else {
        slotIndex[0]++;
      }
    }
  });

  return blocks;
}
