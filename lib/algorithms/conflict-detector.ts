export interface ScheduleSlot {
  id: string;
  subjectName: string;
  universityName: string;
  day_of_week: number; // 1 = Lunes, 7 = Domingo
  start_time: string;  // "HH:MM" (ej: "08:00")
  end_time: string;    // "HH:MM" (ej: "10:00")
  classroom?: string;
  periodicity?: 'semanal' | 'sabado_a' | 'sabado_b';
  has_alternating_saturdays?: boolean;
}

export interface ScheduleConflict {
  slotA: ScheduleSlot;
  slotB: ScheduleSlot;
  overlapMinutes: number;
}

/**
 * Calculates whether a target date is Saturday A or Saturday B based on a customizable anchor date.
 */
/**
 * Sábado de referencia que se considera "Sábado A" cuando la universidad no tiene
 * configurado `first_sabado_a_date`.
 *
 * Es un supuesto, no un dato del estudiante: con la fecha real configurada el cálculo es
 * exacto, y sin ella la alternancia puede quedar invertida. Configúrala por institución.
 */
export const DEFAULT_SABADO_A_ANCHOR = '2026-08-01';

export function getSabadoTypeForDate(
  targetDate: Date,
  anchorDateStr: string = DEFAULT_SABADO_A_ANCHOR
): 'sabado_a' | 'sabado_b' {
  const anchor = new Date(anchorDateStr);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const diffWeeks = Math.floor((targetDate.getTime() - anchor.getTime()) / msPerWeek);
  const normalizedDiff = Math.abs(diffWeeks);
  return normalizedDiff % 2 === 0 ? 'sabado_a' : 'sabado_b';
}

/**
 * Helper to determine slot periodicity from periodicity property or classroom text.
 */
export function getSlotPeriodicity(slot: Partial<ScheduleSlot>): 'semanal' | 'sabado_a' | 'sabado_b' {
  if (slot.has_alternating_saturdays === false) return 'semanal';
  if (slot.periodicity) return slot.periodicity;
  const text = (slot.classroom || '').toLowerCase();
  if (text.includes('sábado a') || text.includes('sabado a') || text.includes('semana a') || text.includes('sábado 1') || text.includes('sabado 1')) {
    return 'sabado_a';
  }
  if (text.includes('sábado b') || text.includes('sabado b') || text.includes('semana b') || text.includes('sábado 2') || text.includes('sabado 2')) {
    return 'sabado_b';
  }
  return 'semanal';
}

/**
 * Dos periodicidades pueden chocar salvo que sean sábados alternos opuestos:
 * un `sabado_a` y un `sabado_b` nunca caen en la misma semana.
 */
export function periodicitiesCollide(
  pA: 'semanal' | 'sabado_a' | 'sabado_b',
  pB: 'semanal' | 'sabado_a' | 'sabado_b'
): boolean {
  return !((pA === 'sabado_a' && pB === 'sabado_b') || (pA === 'sabado_b' && pB === 'sabado_a'));
}

/**
 * Indica si un bloque se dicta en la variante de sábado indicada. Las clases semanales
 * ocurren todas las semanas, así que aparecen tanto en Sábado A como en Sábado B.
 */
export function occursOnSabadoVariant(
  slot: Partial<ScheduleSlot>,
  variant: 'sabado_a' | 'sabado_b'
): boolean {
  const periodicity = getSlotPeriodicity(slot);
  return periodicity === 'semanal' || periodicity === variant;
}

/**
  Convierte una hora en formato "HH:MM" a minutos transcurridos desde las 00:00
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + (minutes || 0);
}

/**
  Detecta conflictos y empalmes de horario entre clases registradas (REQ-07).
  Ignora empalmes entre clases quincenales alternadas (Sábado A vs Sábado B).
 */
export function detectScheduleConflicts(slots: ScheduleSlot[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const slotA = slots[i];
      const slotB = slots[j];

      // Mismo día de la semana
      if (slotA.day_of_week === slotB.day_of_week) {
        const pA = getSlotPeriodicity(slotA);
        const pB = getSlotPeriodicity(slotB);

        // Si una es Sábado A y la otra Sábado B, NO hay conflicto (se dictan en semanas distintas)
        if (!periodicitiesCollide(pA, pB)) {
          continue;
        }

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
