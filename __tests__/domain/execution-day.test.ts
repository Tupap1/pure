import { describe, it, expect } from 'vitest';
import { evaluateDay, isHabitActive } from '../../lib/domain/execution';

// US3 — Hábitos del día y día cumplido (FR-014..FR-016). evaluateDay e isHabitActive son
// funciones puras: cada llamada evalúa un solo día con su propio mínimo y sus propios registros,
// sin arrastrar deuda de días anteriores (FR-016).

describe('[001] US3 — Hábitos del día y día cumplido', () => {
  const habitoManana = { id: 'levantada', started_on: '2026-09-14', days_of_week: null };
  const habitoCelular = { id: 'celular', started_on: '2026-09-14', days_of_week: null };

  it('US3-AS1 · con todos los hábitos activos cumplidos y al menos el mínimo de tandas, el día queda cumplido', () => {
    const result = evaluateDay({
      dateKey: '2026-09-14',
      minTandasDia: 1,
      completedTandas: 1,
      habits: [habitoManana, habitoCelular],
      checks: [
        { habit_id: 'levantada', status: 'cumplido' },
        { habit_id: 'celular', status: 'cumplido' },
      ],
    });
    expect(result?.fulfilled).toBe(true);
  });

  it('US3-AS2 · un hábito activo sin registro deja el día no cumplido', () => {
    const result = evaluateDay({
      dateKey: '2026-09-14',
      minTandasDia: 1,
      completedTandas: 1,
      habits: [habitoManana, habitoCelular],
      checks: [{ habit_id: 'levantada', status: 'cumplido' }], // 'celular' sin registro
    });
    expect(result?.habitsOk).toBe(false);
    expect(result?.fulfilled).toBe(false);
  });

  it('US3-AS3 · un hábito marcado "no aplica" no impide que el día quede cumplido', () => {
    const result = evaluateDay({
      dateKey: '2026-09-14',
      minTandasDia: 1,
      completedTandas: 1,
      habits: [habitoManana, habitoCelular],
      checks: [
        { habit_id: 'levantada', status: 'cumplido' },
        { habit_id: 'celular', status: 'na' },
      ],
    });
    expect(result?.fulfilled).toBe(true);
  });

  it('US3-AS4 · el mínimo de hoy es el de la semana, sin sumar lo que faltó ayer', () => {
    const ayer = evaluateDay({ dateKey: '2026-09-13', minTandasDia: 1, completedTandas: 0, habits: [], checks: [] });
    expect(ayer?.tandasOk).toBe(false);
    expect(ayer?.fulfilled).toBe(false);

    // El mínimo de hoy sigue siendo 1 (el de su semana), no 2: no hereda la deuda de ayer.
    const hoy = evaluateDay({ dateKey: '2026-09-14', minTandasDia: 1, completedTandas: 1, habits: [], checks: [] });
    expect(hoy?.tandasOk).toBe(true);
    expect(hoy?.fulfilled).toBe(true);
  });

  it('US3-AS6 · un hábito que empieza más adelante no se exige antes de su fecha de inicio', () => {
    const habitoFuturo = { id: 'nuevo', started_on: '2026-09-28', days_of_week: null };
    expect(isHabitActive(habitoFuturo, '2026-09-20')).toBe(false);
    expect(isHabitActive(habitoFuturo, '2026-09-28')).toBe(true);

    const result = evaluateDay({
      dateKey: '2026-09-20',
      minTandasDia: 1,
      completedTandas: 1,
      habits: [habitoFuturo],
      checks: [], // el hábito futuro no tiene registro y aun así el día queda cumplido
    });
    expect(result?.fulfilled).toBe(true);
  });

  it('un día fuera del programa (sin mínimo de semana) evalúa a null, no a no-cumplido', () => {
    const result = evaluateDay({
      dateKey: '2026-12-25',
      minTandasDia: null,
      completedTandas: 0,
      habits: [],
      checks: [],
    });
    expect(result).toBeNull();
  });
});
