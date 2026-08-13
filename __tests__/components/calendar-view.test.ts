import { describe, it, expect } from 'vitest';
import {
  getSabadoTypeForDate,
  occursOnSabadoVariant,
  detectScheduleConflicts,
  ScheduleSlot,
} from '@/lib/algorithms/conflict-detector';

describe('CalendarView Helper & Integration Logic', () => {
  const anchorDateStr = '2026-08-01'; // Sábado A

  it('debe determinar correctamente Sábado A o Sábado B para una fecha dada', () => {
    const sabadoA = new Date('2026-08-01T12:00:00'); // Mismo sábado que ancla
    expect(getSabadoTypeForDate(sabadoA, anchorDateStr)).toBe('sabado_a');

    const sabadoB = new Date('2026-08-08T12:00:00'); // 1 semana después -> Sábado B
    expect(getSabadoTypeForDate(sabadoB, anchorDateStr)).toBe('sabado_b');

    const sabadoA2 = new Date('2026-08-15T12:00:00'); // 2 semanas después -> Sábado A
    expect(getSabadoTypeForDate(sabadoA2, anchorDateStr)).toBe('sabado_a');
  });

  it('debe filtrar correctamente las clases en Sábado A vs Sábado B', () => {
    const classWeekly: Partial<ScheduleSlot> = { periodicity: 'semanal' };
    const classSatA: Partial<ScheduleSlot> = { periodicity: 'sabado_a' };
    const classSatB: Partial<ScheduleSlot> = { periodicity: 'sabado_b' };

    // En un Sábado A:
    expect(occursOnSabadoVariant(classWeekly, 'sabado_a')).toBe(true);
    expect(occursOnSabadoVariant(classSatA, 'sabado_a')).toBe(true);
    expect(occursOnSabadoVariant(classSatB, 'sabado_a')).toBe(false);

    // En un Sábado B:
    expect(occursOnSabadoVariant(classWeekly, 'sabado_b')).toBe(true);
    expect(occursOnSabadoVariant(classSatA, 'sabado_b')).toBe(false);
    expect(occursOnSabadoVariant(classSatB, 'sabado_b')).toBe(true);
  });

  it('debe detectar empalmes en la misma franja horaria excepto entre sábados opuestos', () => {
    const slots: ScheduleSlot[] = [
      {
        id: '1',
        subjectName: 'Matemáticas',
        universityName: 'Uni 1',
        day_of_week: 1, // Lunes
        start_time: '08:00',
        end_time: '10:00',
      },
      {
        id: '2',
        subjectName: 'Física',
        universityName: 'Uni 1',
        day_of_week: 1, // Lunes (conflicto con Matemáticas)
        start_time: '09:00',
        end_time: '11:00',
      },
      {
        id: '3',
        subjectName: 'Tutoría A',
        universityName: 'Uni 1',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'sabado_a',
      },
      {
        id: '4',
        subjectName: 'Tutoría B',
        universityName: 'Uni 1',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'sabado_b',
      },
    ];

    const conflicts = detectScheduleConflicts(slots);

    // Debe haber 1 solo conflicto (entre Matemáticas y Física el lunes)
    // No debe haber conflicto entre Tutoría A y Tutoría B porque se dictan en sábados alternos
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].slotA.subjectName).toBe('Matemáticas');
    expect(conflicts[0].slotB.subjectName).toBe('Física');
    expect(conflicts[0].overlapMinutes).toBe(60);
  });

  it('debe calcular la cuadrícula de 35 o 42 días para cualquier mes', () => {
    const generateMonthGrid = (year: number, month: number) => {
      const firstDayOfMonth = new Date(year, month, 1);
      const startDayRaw = firstDayOfMonth.getDay();
      const startIsoDay = startDayRaw === 0 ? 7 : startDayRaw;
      const gridStart = new Date(year, month, 1 - (startIsoDay - 1));

      const gridDays: Date[] = [];
      for (let i = 0; i < 35; i++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        gridDays.push(d);
      }

      if (
        gridDays[34].getMonth() === month &&
        gridDays[34].getDate() < new Date(year, month + 1, 0).getDate()
      ) {
        for (let i = 35; i < 42; i++) {
          const d = new Date(gridStart);
          d.setDate(gridStart.getDate() + i);
          gridDays.push(d);
        }
      }
      return gridDays;
    };

    const gridAugust2026 = generateMonthGrid(2026, 7); // Agosto 2026 (0-indexed 7)
    expect(gridAugust2026.length).toBeGreaterThanOrEqual(35);
    // El primer día de la grilla de agosto 2026 debe ser Lunes
    expect(gridAugust2026[0].getDay()).toBe(1); // 1 = Lunes
  });
});
