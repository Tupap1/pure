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

  it('NO debe reportar conflicto entre sabado_a y sabado_b explícitos a la misma hora', () => {
    const schedules: ScheduleSlot[] = [
      {
        id: 's1',
        subjectName: 'Física I',
        universityName: 'UdeC',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'sabado_a',
      },
      {
        id: 's2',
        subjectName: 'Cálculo',
        universityName: 'UdeC',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'sabado_b',
      },
    ];

    expect(detectScheduleConflicts(schedules)).toHaveLength(0);
  });

  it('SÍ debe reportar conflicto entre sabado_a y clase semanal en sábado a la misma hora', () => {
    const schedules: ScheduleSlot[] = [
      {
        id: 's1',
        subjectName: 'Física I',
        universityName: 'UdeC',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'sabado_a',
      },
      {
        id: 's2',
        subjectName: 'Química General',
        universityName: 'UdeA',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'semanal',
      },
    ];

    expect(detectScheduleConflicts(schedules)).toHaveLength(1);
  });

  it('SÍ debe reportar conflicto entre dos clases sabado_a solapadas a la misma hora', () => {
    const schedules: ScheduleSlot[] = [
      {
        id: 's1',
        subjectName: 'Física I',
        universityName: 'UdeC',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'sabado_a',
      },
      {
        id: 's2',
        subjectName: 'Álgebra Lineal',
        universityName: 'UdeC',
        day_of_week: 6,
        start_time: '09:00',
        end_time: '11:00',
        periodicity: 'sabado_a',
      },
    ];

    expect(detectScheduleConflicts(schedules)).toHaveLength(1);
  });

  it('debe tratar como semanal cuando la universidad tiene has_alternating_saturdays = false', () => {
    const schedules: ScheduleSlot[] = [
      {
        id: 's1',
        subjectName: 'Física I',
        universityName: 'UdeA',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'sabado_a',
        has_alternating_saturdays: false,
      },
      {
        id: 's2',
        subjectName: 'Química',
        universityName: 'UdeA',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'sabado_b',
        has_alternating_saturdays: false,
      },
    ];

    expect(detectScheduleConflicts(schedules)).toHaveLength(1);
  });

  it('Regresión Tarea 1: el mapeo de ScheduleDashboard conserva periodicity, classroom y has_alternating_saturdays', () => {
    const rawSchedules = [
      { id: 'sch-1', subject_id: 'sub-1', day_of_week: 6, start_time: '08:00', end_time: '12:00', classroom: 'Aula A304', periodicity: 'sabado_a' as const },
      { id: 'sch-2', subject_id: 'sub-2', day_of_week: 6, start_time: '08:00', end_time: '12:00', classroom: 'Lab B', periodicity: 'sabado_b' as const },
    ];
    const subjects = [
      { id: 'sub-1', university_id: 'uni-1', name: 'Física' },
      { id: 'sub-2', university_id: 'uni-1', name: 'Cálculo' },
    ];
    const universities = [
      { id: 'uni-1', name: 'UdeC', has_alternating_saturdays: true },
    ];

    // Simulación del mapeo en ScheduleDashboard.tsx
    const mappedSlots = rawSchedules.map((s) => {
      const sub = subjects.find((sb) => sb.id === s.subject_id);
      const uni = universities.find((u) => u.id === sub?.university_id);
      return {
        id: s.id!,
        subjectName: sub?.name || 'Materia',
        universityName: uni?.name || 'Universidad',
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        classroom: s.classroom,
        periodicity: s.periodicity,
        has_alternating_saturdays: uni?.has_alternating_saturdays,
      };
    });

    expect(mappedSlots[0].periodicity).toBe('sabado_a');
    expect(mappedSlots[0].classroom).toBe('Aula A304');
    expect(mappedSlots[0].has_alternating_saturdays).toBe(true);

    const conflicts = detectScheduleConflicts(mappedSlots);
    expect(conflicts).toHaveLength(0);
  });
});
