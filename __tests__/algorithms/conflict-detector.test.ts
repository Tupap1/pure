import { describe, it, expect } from 'vitest';
import { detectScheduleConflicts, getSabadoTypeForDate, ScheduleSlot } from '@/lib/algorithms/conflict-detector';

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

  it('NO debe reportar conflicto entre clases del mismo Sábado a la misma hora si una es Sábado A y la otra Sábado B', () => {
    const schedules: ScheduleSlot[] = [
      {
        id: 'slot-fisica',
        subjectName: 'Física I',
        universityName: 'UdeC',
        day_of_week: 6, // Sábado
        start_time: '07:00',
        end_time: '08:40',
        classroom: 'Sábado A • Aula A304',
      },
      {
        id: 'slot-web',
        subjectName: 'Desarrollo Software Web',
        universityName: 'UdeC',
        day_of_week: 6, // Sábado
        start_time: '07:00',
        end_time: '08:40',
        classroom: 'Sábado B • Lab Redes A',
      },
    ];

    const conflicts = detectScheduleConflicts(schedules);
    expect(conflicts).toHaveLength(0);
  });

  it('debe calcular correctamente el tipo de sábado (A o B) usando una fecha ancla personalizable', () => {
    const anchor = '2026-08-01'; // Sábado 1 de Agosto de 2026 = Sábado A

    const sabado1 = new Date('2026-08-01T12:00:00Z');
    expect(getSabadoTypeForDate(sabado1, anchor)).toBe('sabado_a');

    const sabado2 = new Date('2026-08-08T12:00:00Z');
    expect(getSabadoTypeForDate(sabado2, anchor)).toBe('sabado_b');

    const sabado3 = new Date('2026-08-15T12:00:00Z');
    expect(getSabadoTypeForDate(sabado3, anchor)).toBe('sabado_a');
  });
});
