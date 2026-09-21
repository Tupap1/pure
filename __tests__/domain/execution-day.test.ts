import { describe, it, expect } from 'vitest';
import { evaluateDay, isHabitActive, tandaUnits } from '../../lib/domain/execution';

// US3 — Hábitos del día y día cumplido (FR-014..FR-016). evaluateDay e isHabitActive son
// funciones puras: cada llamada evalúa un solo día con su propio mínimo y sus propios registros,
// sin arrastrar deuda de días anteriores (FR-016).
//
// US-T1 — Tandas de duración variable (FR-T04): tandaUnits calcula el valor en unidades de una
// tanda completada como max(1, floor(actual_minutes / 10)).

describe('[001] US3 — Hábitos del día y día cumplido', () => {
  const habitoManana = { id: 'levantada', started_on: '2026-09-14', days_of_week: null };
  const habitoCelular = { id: 'celular', started_on: '2026-09-14', days_of_week: null };

  it('US3-AS1 · con todos los hábitos activos cumplidos y al menos el mínimo de tandas, el día queda cumplido', () => {
    const result = evaluateDay({
      dateKey: '2026-09-14',
      minTandasDia: 1,
      completedTandas: 1,
      completedUnits: 1,
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
      completedUnits: 1,
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
      completedUnits: 1,
      habits: [habitoManana, habitoCelular],
      checks: [
        { habit_id: 'levantada', status: 'cumplido' },
        { habit_id: 'celular', status: 'na' },
      ],
    });
    expect(result?.fulfilled).toBe(true);
  });

  it('US3-AS4 · el mínimo de hoy es el de la semana, sin sumar lo que faltó ayer', () => {
    const ayer = evaluateDay({ dateKey: '2026-09-13', minTandasDia: 1, completedTandas: 0, completedUnits: 0, habits: [], checks: [] });
    expect(ayer?.tandasOk).toBe(false);
    expect(ayer?.fulfilled).toBe(false);

    // El mínimo de hoy sigue siendo 1 (el de su semana), no 2: no hereda la deuda de ayer.
    const hoy = evaluateDay({ dateKey: '2026-09-14', minTandasDia: 1, completedTandas: 1, completedUnits: 1, habits: [], checks: [] });
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
      completedUnits: 1,
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
      completedUnits: 0,
      habits: [],
      checks: [],
    });
    expect(result).toBeNull();
  });
});

describe('[003] US-T1 — Tandas de duración variable (función de dominio tandaUnits)', () => {
  it('US-T1-AS4 · tandaUnits(60) = 6, tandaUnits(25) = 2, tandaUnits(10) = 1, tandaUnits(8) = 1', () => {
    expect(tandaUnits(60)).toBe(6);
    expect(tandaUnits(25)).toBe(2);
    expect(tandaUnits(10)).toBe(1);
    expect(tandaUnits(8)).toBe(1);
  });

  it('tandaUnits con null o undefined devuelve 1 (mínimo)', () => {
    expect(tandaUnits(null)).toBe(1);
    expect(tandaUnits(undefined)).toBe(1);
  });

  it('tandaUnits con 0 devuelve 1 (mínimo)', () => {
    expect(tandaUnits(0)).toBe(1);
  });
});
