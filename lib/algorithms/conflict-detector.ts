export interface ScheduleSlot {
  id: string;
  subjectName: string;
  universityName: string;
  day_of_week: number; // 1 = Lunes, 7 = Domingo
  start_time: string;  // "HH:MM" (ej: "08:00")
  end_time: string;    // "HH:MM" (ej: "10:00")
}

export interface ScheduleConflict {
  slotA: ScheduleSlot;
  slotB: ScheduleSlot;
  overlapMinutes: number;
}

/**
  Convierte una hora en formato "HH:MM" a minutos transcurridos desde las 00:00
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + (minutes || 0);
}

/**
  Detecta conflictos y empalmes de horario entre clases registradas (REQ-07)
 */
export function detectScheduleConflicts(slots: ScheduleSlot[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const slotA = slots[i];
      const slotB = slots[j];

      // Mismo día de la semana
      if (slotA.day_of_week === slotB.day_of_week) {
        const startA = timeToMinutes(slotA.start_time);
        const endA = timeToMinutes(slotA.end_time);
        const startB = timeToMinutes(slotB.start_time);
        const endB = timeToMinutes(slotB.end_time);

        // Verificación de solapamiento: max(startA, startB) < min(endA, endB)
        const overlapStart = Math.max(startA, startB);
        const overlapEnd = Math.min(endA, endB);

        if (overlapStart < overlapEnd) {
          conflicts.push({
            slotA,
            slotB,
            overlapMinutes: overlapEnd - overlapStart
          });
        }
      }
    }
  }

  return conflicts;
}
