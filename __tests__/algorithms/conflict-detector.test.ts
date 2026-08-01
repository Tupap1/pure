import { describe, it, expect } from 'vitest';
import { detectScheduleConflicts, ScheduleSlot } from '@/lib/algorithms/conflict-detector';

describe('REQ-07: Detector de Traslapes de Horarios Multi-Universidad', () => {
  it('debe detectar un conflicto entre 2 clases de distintas universidades que se solapan en el mismo día y hora', () => {
    const schedules: ScheduleSlot[] = [
      {
        id: 'slot-1',
        subjectName: 'Cálculo Vectorial (Aeroespacial)',
        universityName: 'Universidad 1',
        day_of_week: 1, // Lunes
        start_time: '08:00',
        end_time: '10:00',
      },
      {
        id: 'slot-2',
        subjectName: 'Estructuras de Datos (Software)',
        universityName: 'Universidad 2',
        day_of_week: 1, // Lunes
        start_time: '09:00', // Solapamiento de 09:00 a 10:00
        end_time: '11:00',
      },
    ];

    const conflicts = detectScheduleConflicts(schedules);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].slotA.id).toBe('slot-1');
    expect(conflicts[0].slotB.id).toBe('slot-2');
    expect(conflicts[0].overlapMinutes).toBe(60);
  });

  it('no debe reportar conflicto si las clases son en días distintos o a horas consecutivas sin empalme', () => {
    const schedules: ScheduleSlot[] = [
      {
        id: 'slot-1',
        subjectName: 'Física I',
        universityName: 'Universidad 1',
        day_of_week: 1, // Lunes
        start_time: '08:00',
        end_time: '10:00',
      },
      {
        id: 'slot-2',
        subjectName: 'Programación I',
        universityName: 'Universidad 2',
        day_of_week: 1, // Lunes
        start_time: '10:00', // Termina una y empieza la otra justo a las 10:00
        end_time: '12:00',
      },
    ];

    const conflicts = detectScheduleConflicts(schedules);
    expect(conflicts).toHaveLength(0);
  });
});
