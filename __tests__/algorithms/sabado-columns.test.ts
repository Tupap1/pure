import { describe, it, expect } from 'vitest';
import {
  occursOnSabadoVariant,
  periodicitiesCollide,
  detectScheduleConflicts,
  ScheduleSlot,
} from '@/lib/algorithms/conflict-detector';

/**
 * Bug 1: la grilla fusionaba Sábado A y Sábado B en una sola columna, marcando EMPALME
 * entre clases que ocurren en semanas distintas. La grilla ahora arma una columna por
 * variante usando occursOnSabadoVariant.
 */
describe('Separación de columnas Sábado A / Sábado B', () => {
  const fisicaSabadoA = { periodicity: 'sabado_a' as const, classroom: 'Aula A304' };
  const webSabadoB = { periodicity: 'sabado_b' as const, classroom: 'Lab Redes A' };
  const semanal = { periodicity: 'semanal' as const, classroom: 'Aula 101' };

  it('coloca cada clase quincenal únicamente en su propia columna', () => {
    expect(occursOnSabadoVariant(fisicaSabadoA, 'sabado_a')).toBe(true);
    expect(occursOnSabadoVariant(fisicaSabadoA, 'sabado_b')).toBe(false);

    expect(occursOnSabadoVariant(webSabadoB, 'sabado_b')).toBe(true);
    expect(occursOnSabadoVariant(webSabadoB, 'sabado_a')).toBe(false);
  });

  it('replica las clases semanales en ambas columnas de sábado', () => {
    expect(occursOnSabadoVariant(semanal, 'sabado_a')).toBe(true);
    expect(occursOnSabadoVariant(semanal, 'sabado_b')).toBe(true);
  });

  it('trata como semanal un bloque de una universidad sin sábados alternos', () => {
    const slot = { periodicity: 'sabado_a' as const, has_alternating_saturdays: false };
    expect(occursOnSabadoVariant(slot, 'sabado_a')).toBe(true);
    expect(occursOnSabadoVariant(slot, 'sabado_b')).toBe(true);
  });

  it('deriva la variante del texto del aula cuando no hay campo periodicity', () => {
    expect(occursOnSabadoVariant({ classroom: 'Sábado A • Aula A304' }, 'sabado_a')).toBe(true);
    expect(occursOnSabadoVariant({ classroom: 'Sábado A • Aula A304' }, 'sabado_b')).toBe(false);
  });

  it('Física I (Sábado A 07:00) y Desarrollo Web (Sábado B 07:00) no comparten columna', () => {
    const columnA = [fisicaSabadoA, webSabadoB].filter((s) => occursOnSabadoVariant(s, 'sabado_a'));
    const columnB = [fisicaSabadoA, webSabadoB].filter((s) => occursOnSabadoVariant(s, 'sabado_b'));

    // La grilla marca EMPALME cuando una celda tiene más de un bloque.
    expect(columnA).toHaveLength(1);
    expect(columnB).toHaveLength(1);
  });

  it('dos clases del mismo Sábado A a la misma hora sí caen en la misma celda', () => {
    const otraSabadoA = { periodicity: 'sabado_a' as const, classroom: 'Aula B201' };
    const columnA = [fisicaSabadoA, otraSabadoA].filter((s) => occursOnSabadoVariant(s, 'sabado_a'));
    expect(columnA).toHaveLength(2);
  });

  it('una clase semanal choca con la quincenal en la columna correspondiente', () => {
    const columnA = [fisicaSabadoA, semanal].filter((s) => occursOnSabadoVariant(s, 'sabado_a'));
    expect(columnA).toHaveLength(2);
  });
});

describe('periodicitiesCollide', () => {
  it('solo exime la combinación sabado_a / sabado_b', () => {
    expect(periodicitiesCollide('sabado_a', 'sabado_b')).toBe(false);
    expect(periodicitiesCollide('sabado_b', 'sabado_a')).toBe(false);
    expect(periodicitiesCollide('sabado_a', 'sabado_a')).toBe(true);
    expect(periodicitiesCollide('sabado_b', 'sabado_b')).toBe(true);
    expect(periodicitiesCollide('semanal', 'sabado_a')).toBe(true);
    expect(periodicitiesCollide('sabado_b', 'semanal')).toBe(true);
    expect(periodicitiesCollide('semanal', 'semanal')).toBe(true);
  });

  it('mantiene coherente el banner de traslapes con el caso reportado', () => {
    const slots: ScheduleSlot[] = [
      {
        id: 'sch-fisica',
        subjectName: 'Física I',
        universityName: 'UdeC',
        day_of_week: 6,
        start_time: '07:00',
        end_time: '08:40',
        periodicity: 'sabado_a',
        has_alternating_saturdays: true,
      },
      {
        id: 'sch-web',
        subjectName: 'Desarrollo de Software Web',
        universityName: 'UdeC',
        day_of_week: 6,
        start_time: '07:00',
        end_time: '08:40',
        periodicity: 'sabado_b',
        has_alternating_saturdays: true,
      },
    ];

    expect(detectScheduleConflicts(slots)).toHaveLength(0);
  });
});
